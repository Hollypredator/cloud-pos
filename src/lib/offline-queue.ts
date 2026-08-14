"use client";

import type { OpsCommandType } from "@/lib/types";

/**
 * Cevrimdisi yazma kuyrugu.
 *
 * Internet kesildiginde siparis ve odeme IndexedDB'ye yazilir, baglanti gelince
 * `/api/ops/command` ucuna gonderilir. Her kaydin idempotency anahtari vardir;
 * ayni komut iki kez islenmez.
 *
 * Takeaway icin cevrimdisi kolay: masa yok, acik hesap yok, `pay_at_order` —
 * siparis kapanir kapanmaz biter, cakisma yuzeyi neredeyse sifir.
 *
 * Hata ayrimi onemli:
 *   - Ag hatasi  -> kayit bekler, sonra tekrar denenir
 *   - REJECT     -> sunucu isi reddetti, tekrar denemek anlamsiz; "failed"
 *                   isaretlenir ve kasiyere gosterilir
 * Ikisini ayirmadan "basarisiz sayisi" tutmak, para sessizce kaybolmasina yol acar.
 */

const DB_NAME = "cloudpos-offline";
const DB_VERSION = 1;
const STORE = "commands";
const CHANGED_EVENT = "offline-queue:changed";

export type QueuedCommandStatus = "pending" | "failed";

export type QueuedCommand = {
  id?: number;
  type: OpsCommandType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: number;
  attempts: number;
  status: QueuedCommandStatus;
  lastError?: string;
  /** Ayni satisa ait komutlari birlikte gostermek icin (siparis + odeme). */
  groupId?: string;
};

export type SyncReport = {
  sent: number;
  failed: number;
  stillPending: number;
};

function isBrowser() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB bu ortamda kullanılamıyor."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB açılamadı."));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB işlemi başarısız."));
        transaction.oncomplete = () => db.close();
      }),
  );
}

function announce() {
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  }
}

/** Kuyruk degisince tetiklenir. Arayuz bekleyen sayisini bununla tazeler. */
export function onQueueChanged(handler: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(CHANGED_EVENT, handler);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}

export async function enqueueCommand(input: {
  type: OpsCommandType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  groupId?: string;
}): Promise<string> {
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  const record: QueuedCommand = {
    type: input.type,
    payload: input.payload,
    idempotencyKey,
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
    groupId: input.groupId,
  };
  await tx("readwrite", (store) => store.add(record));
  announce();
  return idempotencyKey;
}

export function listCommands(): Promise<QueuedCommand[]> {
  return tx<QueuedCommand[]>("readonly", (store) => store.getAll());
}

export async function countPending(): Promise<number> {
  const all = await listCommands();
  return all.filter((command) => command.status === "pending").length;
}

export async function countFailed(): Promise<number> {
  const all = await listCommands();
  return all.filter((command) => command.status === "failed").length;
}

async function removeCommand(id: number) {
  await tx("readwrite", (store) => store.delete(id));
}

async function markFailed(command: QueuedCommand, error: string) {
  await tx("readwrite", (store) =>
    store.put({ ...command, status: "failed", attempts: command.attempts + 1, lastError: error }),
  );
}

async function bumpAttempt(command: QueuedCommand, error: string) {
  await tx("readwrite", (store) => store.put({ ...command, attempts: command.attempts + 1, lastError: error }));
}

type OpsCommandResponse = {
  ok?: boolean;
  message?: string;
  result?: {
    status?: string;
    message?: string;
    data?: Record<string, unknown> & { order_id?: unknown };
  };
};

/**
 * Cevrimdisi siparis gercek kimligini aldiktan sonra, ayni gruptaki bekleyen
 * komutlarin `offline:<groupId>` referansini gercek order_id ile degistirir.
 * Bu yapilmazsa odeme var olmayan bir siparise gider ve reddedilir.
 */
async function relinkGroup(groupId: string, realOrderId: string) {
  const placeholder = `offline:${groupId}`;
  const all = await listCommands();
  const affected = all.filter(
    (command) => command.groupId === groupId && command.payload?.order_id === placeholder,
  );

  for (const command of affected) {
    await tx("readwrite", (store) =>
      store.put({ ...command, payload: { ...command.payload, order_id: realOrderId } }),
    );
  }
}

/**
 * Sunucu cevabi "bu komut zaten islenmis" anlamina mi geliyor?
 *
 * Postgres benzersizlik ihlalini 23505 ile bildirir; Supabase bunu mesaja
 * tasir. Kalici reddi bundan ayirmak sart: biri korumanin calistigini,
 * digeri gercek bir sorunu gosterir.
 */
function isIdempotentReplay(httpStatus: number, message?: string) {
  if (httpStatus === 409) return true;
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes("23505") ||
    text.includes("duplicate key") ||
    text.includes("already exists") ||
    text.includes("idempotent")
  );
}

let syncing = false;

/**
 * Bekleyen komutlari sirayla gonderir.
 *
 * Sirali gonderim zorunlu: odeme, kendi siparisinden once gidemez. Bir komut ag
 * hatasi verirse dongu durur — sonraki komutlar sirasini korur.
 */
export async function syncQueue(): Promise<SyncReport> {
  if (!isBrowser() || syncing) {
    return { sent: 0, failed: 0, stillPending: await safeCountPending() };
  }

  syncing = true;
  let sent = 0;
  let failed = 0;

  try {
    const all = await listCommands();
    const pending = all
      .filter((command) => command.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt);

    // `pending` dongu basinda bir kez okundu. relinkGroup veritabanini gunceller
    // ama bellekteki kopyayi degil; bu harita olmadan odeme hala `offline:<id>`
    // ile gonderilir ve "invalid input syntax for type uuid" ile reddedilir.
    const resolvedOrderIds = new Map<string, string>();

    for (const command of pending) {
      let payload = command.payload;
      const groupId = command.groupId;
      if (groupId && resolvedOrderIds.has(groupId) && payload?.order_id === `offline:${groupId}`) {
        payload = { ...payload, order_id: resolvedOrderIds.get(groupId) };
      }

      let response: Response;
      try {
        response = await fetch("/api/ops/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: command.type,
            payload,
            idempotency_key: command.idempotencyKey,
          }),
        });
      } catch {
        // Ag hala yok. Sira korunur, dongu durur.
        await bumpAttempt(command, "Bağlantı yok.");
        break;
      }

      // `/api/ops/command` cevabi { ok, result: { status, data, message } } seklinde.
      let body: OpsCommandResponse = {};
      try {
        body = (await response.json()) as OpsCommandResponse;
      } catch {
        body = {};
      }

      const commandStatus = body.result?.status;
      const failMessage = body.result?.message ?? body.message;

      // Idempotans ihlali basarisizlik degil, korumanin calismasidir.
      //
      // `uniq_ingredient_movement_sale_line` ayni siparis kalemi ayni malzemeyi
      // iki kez dusuremesin diye var. Cevrimdisi kuyruk ayni siparisi tekrar
      // gonderdiginde tam da bu indeks devreye girer. Kalici hata sayilirsa
      // kasiyere "basarisiz" gorunur, kayit panelde birikir ve gercek hatalar
      // gurultude kaybolur (CEO review bulgu 3A).
      if (isIdempotentReplay(response.status, failMessage)) {
        if (command.id !== undefined) await removeCommand(command.id);
        sent += 1;
        continue;
      }

      if (response.ok && commandStatus === "ACK") {
        // Cevrimdisi acilan siparisin gercek kimligi ancak burada belli olur.
        // Ayni gruptaki odeme komutu `offline:<groupId>` tasiyor; gonderilmeden
        // once gercek order_id ile degistirilmeli.
        const createdOrderId = body.result?.data?.order_id;
        if (command.type === "ORDER_CREATE" && groupId && typeof createdOrderId === "string") {
          resolvedOrderIds.set(groupId, createdOrderId);
          await relinkGroup(groupId, createdOrderId);
        }

        if (command.id !== undefined) await removeCommand(command.id);
        sent += 1;
        continue;
      }

      // 5xx gecici olabilir; tekrar denenir. Diger her sey sunucunun kalici
      // reddidir (REJECT/gecersiz veri) — tekrar denemek ayni sonucu verir.
      if (response.status >= 500) {
        await bumpAttempt(command, failMessage ?? `Sunucu hatası (${response.status}).`);
        break;
      }

      await markFailed(command, failMessage ?? `Komut reddedildi (${response.status}).`);
      failed += 1;
    }
  } finally {
    syncing = false;
    announce();
  }

  return { sent, failed, stillPending: await safeCountPending() };
}

async function safeCountPending() {
  try {
    return await countPending();
  } catch {
    return 0;
  }
}

/** Kalici reddedilmis kaydi kuyruktan siler (kasiyer inceledikten sonra). */
export async function discardFailed(id: number) {
  await removeCommand(id);
  announce();
}

/** Yalnizca kalici reddedilmis kayitlar. Kasiyer paneli bunlari gosterir. */
export async function listFailed(): Promise<QueuedCommand[]> {
  const all = await listCommands();
  return all.filter((command) => command.status === "failed").sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Reddedilmis kaydi yeniden dener.
 *
 * Sunucu reddi genelde kalicidir, ama gecici bir sebep de olabilir (sube kilidi,
 * yetki, gecici veri tutarsizligi). Idempotency anahtari degismedigi icin tekrar
 * gondermek cift tahsilat riski tasimaz.
 */
export async function retryFailed(id: number) {
  const all = await listCommands();
  const command = all.find((item) => item.id === id);
  if (!command) return;

  await tx("readwrite", (store) => store.put({ ...command, status: "pending", lastError: undefined }));
  announce();
  await syncQueue();
}

/** Baglanti gelince otomatik senkron. Uygulama acilisinda bir kez cagrilir. */
export function startAutoSync() {
  if (!isBrowser()) return () => {};

  const trigger = () => void syncQueue();
  window.addEventListener("online", trigger);
  if (navigator.onLine) trigger();

  return () => window.removeEventListener("online", trigger);
}
