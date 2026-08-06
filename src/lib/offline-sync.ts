"use client";

const DB_NAME = "cloudpos-sync-db";
const STORE_NAME = "pending-commands";

export type PendingCommand = {
  id?: number;
  type: string;
  payload: any;
  idempotency_key: string;
  timestamp: number;
};

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported on this platform"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addPendingCommand(type: string, payload: any): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const item: PendingCommand = {
      type,
      payload,
      idempotency_key: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingCommands(): Promise<PendingCommand[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePendingCommand(id: number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function syncPendingCommands(): Promise<{ success: number; failed: number }> {
  try {
    const pending = await getPendingCommands();
    if (pending.length === 0) {
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    for (const cmd of pending) {
      try {
        const response = await fetch("/api/ops/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: cmd.type,
            payload: cmd.payload,
            idempotency_key: cmd.idempotency_key,
          }),
        });

        if (response.ok) {
          if (cmd.id !== undefined) {
            await deletePendingCommand(cmd.id);
          }
          successCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    if (successCount > 0) {
      window.dispatchEvent(new CustomEvent("pwa:sync-complete"));
    }

    return { success: successCount, failed: failedCount };
  } catch {
    return { success: 0, failed: 0 };
  }
}

export async function printToLocalDaemon(payload: Record<string, any>): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:9100/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    // Fallback if local print daemon is offline
    return false;
  }
}

// Auto-register online listener
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void syncPendingCommands();
  });
}

