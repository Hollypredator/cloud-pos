"use client";

import type {
  Category,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
} from "@/lib/types";

/**
 * Kasanin cevrimdisi okuyabilmesi icin katalog anlik goruntusunu yerelde tutar.
 *
 * Bugune kadar yalnizca YAZMA tarafi cevrimdisi calisiyordu
 * (`offline-queue.ts`). Okuma sunucu bileseninden geliyordu; internet
 * kesildiginde kasa ekrani hic acilmiyor, yalnizca service worker'in onbellege
 * aldigi gezinme calisiyordu. Offline-first icin okuma da yerelden gelmeli.
 *
 * Tasarim:
 *   - Tek anlik goruntu, tek surum damgasi. Varlik basina ayri onbellek
 *     tutmak menu yeni / recete eski gibi tutarsiz durum uretir.
 *   - Depo yalnizca saklar; tazeleme politikasi cagirana ait.
 *   - Bayat veri SILINMEZ. Internet yokken bayat menu, menusuz kasadan iyidir;
 *     yasi gosterilir, karari kasiyer verir.
 */

const DB_NAME = "cloudpos-catalog";
const DB_VERSION = 1;
const STORE = "snapshot";
const SNAPSHOT_KEY = "current";

export type CatalogSnapshot = {
  syncedAt: string;
  business: {
    slug: string;
    name: string;
    branchId: string | null;
    branchName: string | null;
  };
  menu: {
    categories: Category[];
    products: Product[];
    modifierGroups: ProductModifierGroup[];
    modifierOptions: ProductModifierOption[];
    usingDemoData: boolean;
  };
  recipes: Array<{ productId: string; ingredientId: string; quantity: number; yieldFactor: number }>;
  ingredients: Array<{ id: string; name: string; unit: string; cost: number }>;
  modifierEffects: Array<{
    optionId: string;
    mode: string;
    ingredientId: string | null;
    targetIngredientId: string | null;
    quantity: number | null;
    multiplier: number | null;
  }>;
  recipeSchemaReady: boolean;
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
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Katalog deposu açılamadı."));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Katalog işlemi başarısız."));
        transaction.oncomplete = () => db.close();
      }),
  );
}

export async function readCachedCatalog(): Promise<CatalogSnapshot | null> {
  if (!isBrowser()) return null;
  try {
    const value = await tx<CatalogSnapshot | undefined>("readonly", (store) => store.get(SNAPSHOT_KEY));
    return value ?? null;
  } catch {
    return null;
  }
}

export async function writeCachedCatalog(snapshot: CatalogSnapshot): Promise<void> {
  if (!isBrowser()) return;
  try {
    await tx("readwrite", (store) => store.put(snapshot, SNAPSHOT_KEY));
  } catch {
    // Depo yazilamadi (kota, gizli sekme). Cevrimici calisma bozulmaz;
    // yalnizca cevrimdisi okuma devre disi kalir.
  }
}

/** Anlik goruntunun yasi, dakika cinsinden. */
export function snapshotAgeMinutes(snapshot: CatalogSnapshot | null, now = Date.now()): number | null {
  if (!snapshot?.syncedAt) return null;
  const synced = Date.parse(snapshot.syncedAt);
  if (!Number.isFinite(synced)) return null;
  return Math.max(0, Math.round((now - synced) / 60000));
}

export type CatalogFetchResult =
  | { status: "fresh"; snapshot: CatalogSnapshot }
  | { status: "cached"; snapshot: CatalogSnapshot; reason: string }
  | { status: "empty"; reason: string };

/**
 * Sunucudan tazeler; basarisiz olursa yereldekini doner.
 *
 * Bayat veriyle calismak, verisiz kalmaktan iyidir: kasiyer kahve satmaya
 * devam eder. Durum cagirana bildirilir ki arayuz yasi gosterebilsin.
 */
export async function loadCatalog(options?: { signal?: AbortSignal }): Promise<CatalogFetchResult> {
  const cached = await readCachedCatalog();

  if (isBrowser() && !navigator.onLine) {
    return cached
      ? { status: "cached", snapshot: cached, reason: "Çevrimdışı" }
      : { status: "empty", reason: "Çevrimdışı ve yerel katalog yok." };
  }

  try {
    const response = await fetch("/api/ops/catalog-snapshot", {
      signal: options?.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const snapshot = (await response.json()) as CatalogSnapshot;
    await writeCachedCatalog(snapshot);
    return { status: "fresh", snapshot };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return cached
      ? { status: "cached", snapshot: cached, reason: "Sunucuya ulaşılamadı" }
      : { status: "empty", reason: "Katalog alınamadı ve yerel kopya yok." };
  }
}

/** Cikis/tenant degisiminde yerel kopyayi temizler. */
export async function clearCachedCatalog(): Promise<void> {
  if (!isBrowser()) return;
  try {
    await tx("readwrite", (store) => store.delete(SNAPSHOT_KEY));
  } catch {
    // Yoksay: temizlenememesi calismayi engellemez.
  }
}
