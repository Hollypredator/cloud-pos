"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";

const SNAPSHOT_STORAGE_KEY = "cloudpos.query.snapshot.cache.v1";
const SNAPSHOT_MAX_ITEMS = 32;

type SnapshotEntry = {
  queryKey: QueryKey;
  data: unknown;
  updatedAt: number;
};

type SnapshotStore = Record<string, SnapshotEntry>;

function readSnapshotStore(): SnapshotStore {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as SnapshotStore;
  } catch {
    return {};
  }
}

function writeSnapshotStore(store: SnapshotStore) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota / serialization errors.
  }
}

function toCacheToken(queryKey: QueryKey) {
  try {
    return JSON.stringify(queryKey);
  } catch {
    return "";
  }
}

function trimSnapshotStore(store: SnapshotStore): SnapshotStore {
  const entries = Object.entries(store).sort((left, right) => right[1].updatedAt - left[1].updatedAt);
  return Object.fromEntries(entries.slice(0, SNAPSHOT_MAX_ITEMS));
}

export function persistQuerySnapshot(queryKey: QueryKey, data: unknown) {
  const token = toCacheToken(queryKey);
  if (!token) {
    return;
  }
  const store = readSnapshotStore();
  store[token] = {
    queryKey,
    data,
    updatedAt: Date.now(),
  };
  writeSnapshotStore(trimSnapshotStore(store));
}

export function hydrateQuerySnapshots(queryClient: QueryClient) {
  const store = readSnapshotStore();
  for (const entry of Object.values(store)) {
    if (!Array.isArray(entry.queryKey)) {
      continue;
    }
    queryClient.setQueryData(entry.queryKey, entry.data);
  }
}
