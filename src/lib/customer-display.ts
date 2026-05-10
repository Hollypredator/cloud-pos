"use client";

import type { CustomerDisplayEvent, CustomerDisplaySnapshot } from "@/lib/types";

export const CUSTOMER_DISPLAY_SESSIONS_STORAGE_KEY = "cloudpos.customer-display.sessions.v1";
export const CUSTOMER_DISPLAY_SNAPSHOT_PREFIX = "cloudpos.customer-display.snapshot.";
export const CUSTOMER_DISPLAY_CHANNEL_PREFIX = "cloudpos.customer-display.channel.";
const DEFAULT_TTL_MS = 10 * 60 * 1000;

export type CustomerDisplaySessionRecord = {
  sessionId: string;
  pairCode: string;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
};

type CustomerDisplaySessionStore = {
  activeSessionId?: string;
  sessions: CustomerDisplaySessionRecord[];
};

function now() {
  return Date.now();
}

function randomSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function randomPairCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function readStore(): CustomerDisplaySessionStore {
  if (typeof window === "undefined") {
    return { sessions: [] };
  }
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_SESSIONS_STORAGE_KEY);
    if (!raw) {
      return { sessions: [] };
    }
    const parsed = JSON.parse(raw) as CustomerDisplaySessionStore;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sessions)) {
      return { sessions: [] };
    }
    return parsed;
  } catch {
    return { sessions: [] };
  }
}

function writeStore(store: CustomerDisplaySessionStore) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CUSTOMER_DISPLAY_SESSIONS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota/storage errors
  }
}

function cleanupSessions(store: CustomerDisplaySessionStore, at = now()) {
  const sessions = store.sessions.filter((session) => session.expiresAt > at);
  const activeSessionId =
    store.activeSessionId && sessions.some((session) => session.sessionId === store.activeSessionId)
      ? store.activeSessionId
      : undefined;
  return { sessions, activeSessionId };
}

function snapshotKey(sessionId: string) {
  return `${CUSTOMER_DISPLAY_SNAPSHOT_PREFIX}${sessionId}`;
}

export function getCustomerDisplayChannelName(sessionId: string) {
  return `${CUSTOMER_DISPLAY_CHANNEL_PREFIX}${sessionId}`;
}

export function createCustomerDisplaySession(ttlMs = DEFAULT_TTL_MS) {
  const store = cleanupSessions(readStore());
  const record: CustomerDisplaySessionRecord = {
    sessionId: randomSessionId(),
    pairCode: randomPairCode(),
    createdAt: now(),
    expiresAt: now() + ttlMs,
    lastSeenAt: now(),
  };
  const nextStore: CustomerDisplaySessionStore = {
    activeSessionId: record.sessionId,
    sessions: [record, ...store.sessions].slice(0, 12),
  };
  writeStore(nextStore);
  return record;
}

export function getActiveCustomerDisplaySession() {
  const store = cleanupSessions(readStore());
  writeStore(store);
  if (!store.activeSessionId) {
    return null;
  }
  return store.sessions.find((session) => session.sessionId === store.activeSessionId) ?? null;
}

export function clearActiveCustomerDisplaySession() {
  const store = cleanupSessions(readStore());
  const nextStore = { ...store, activeSessionId: undefined };
  writeStore(nextStore);
}

export function resolveCustomerDisplaySessionByPairCode(pairCode: string) {
  const normalized = pairCode.trim();
  const store = cleanupSessions(readStore());
  const session = store.sessions.find((item) => item.pairCode === normalized) ?? null;
  if (session) {
    session.lastSeenAt = now();
    store.activeSessionId = session.sessionId;
    writeStore(store);
  } else {
    writeStore(store);
  }
  return session;
}

export function persistCustomerDisplaySnapshot(sessionId: string, snapshot: CustomerDisplaySnapshot) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(snapshotKey(sessionId), JSON.stringify(snapshot));
  } catch {
    // ignore quota/storage errors
  }
}

export function readCustomerDisplaySnapshot(sessionId: string) {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(snapshotKey(sessionId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CustomerDisplaySnapshot;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function publishCustomerDisplaySnapshot(sessionId: string, snapshot: CustomerDisplaySnapshot) {
  persistCustomerDisplaySnapshot(sessionId, snapshot);
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return;
  }
  const event: CustomerDisplayEvent = {
    type: "snapshot",
    snapshot,
    sentAt: now(),
  };
  const channel = new BroadcastChannel(getCustomerDisplayChannelName(sessionId));
  channel.postMessage(event);
  channel.close();
}

export function subscribeCustomerDisplay(
  sessionId: string,
  onEvent: (event: CustomerDisplayEvent) => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== snapshotKey(sessionId) || !event.newValue) {
      return;
    }
    try {
      const snapshot = JSON.parse(event.newValue) as CustomerDisplaySnapshot;
      onEvent({
        type: "snapshot",
        snapshot,
        sentAt: now(),
      });
    } catch {
      // ignore parse errors
    }
  };

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(getCustomerDisplayChannelName(sessionId));
    channel.onmessage = (message) => {
      const payload = message.data as CustomerDisplayEvent | undefined;
      if (!payload || typeof payload !== "object") {
        return;
      }
      onEvent(payload);
    };
  }

  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    if (channel) {
      channel.close();
    }
  };
}
