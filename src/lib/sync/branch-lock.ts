import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { BranchLockState } from "@/lib/types";

const DEFAULT_LOCK_TTL_SECONDS = 120;

type LockResult = {
  ok: boolean;
  state?: BranchLockState;
  conflict?: BranchLockState;
  error?: string;
};

function isMissingTableError(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("device_branch_locks") && normalized.includes("does not exist");
}

function mapRow(row: Record<string, unknown> | null): BranchLockState | undefined {
  if (!row) {
    return undefined;
  }

  return {
    branch_id: String(row.branch_id ?? ""),
    business_id: typeof row.business_id === "string" ? row.business_id : null,
    device_id: String(row.device_id ?? ""),
    lock_token: String(row.lock_token ?? ""),
    status: (row.status as BranchLockState["status"]) ?? "active",
    acquired_at: String(row.acquired_at ?? new Date().toISOString()),
    renewed_at: String(row.renewed_at ?? new Date().toISOString()),
    expires_at: String(row.expires_at ?? new Date().toISOString()),
    actor_id: typeof row.actor_id === "string" ? row.actor_id : null,
  };
}

function isActiveAndNotExpired(lock: BranchLockState | undefined) {
  if (!lock || lock.status !== "active") {
    return false;
  }
  return new Date(lock.expires_at).valueOf() > Date.now();
}

export async function getBranchLockState(branchId: string): Promise<LockResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Sunucu Supabase baglantisi kurulamadi." };
  }

  const { data, error } = await supabase
    .from("device_branch_locks")
    .select("branch_id, business_id, device_id, lock_token, status, acquired_at, renewed_at, expires_at, actor_id")
    .eq("branch_id", branchId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) {
      return { ok: false, error: "Sync lock tablosu bulunamadi. Migration calistirin." };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, state: mapRow((data ?? null) as Record<string, unknown> | null) };
}

export async function acquireBranchLock(input: {
  branchId: string;
  businessId?: string | null;
  deviceId: string;
  actorId?: string | null;
  ttlSeconds?: number;
}): Promise<LockResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Sunucu Supabase baglantisi kurulamadi." };
  }

  const ttlSeconds = Math.max(30, Math.floor(input.ttlSeconds ?? DEFAULT_LOCK_TTL_SECONDS));
  const now = new Date();
  const expiresAt = new Date(now.valueOf() + ttlSeconds * 1000).toISOString();

  const currentResult = await getBranchLockState(input.branchId);
  if (!currentResult.ok) {
    return currentResult;
  }

  const currentLock = currentResult.state;
  if (isActiveAndNotExpired(currentLock) && currentLock?.device_id !== input.deviceId) {
    return {
      ok: false,
      error: "Branch lock baska bir cihaz tarafindan tutuluyor.",
      conflict: currentLock,
    };
  }

  const lockToken = crypto.randomUUID();
  const payload = {
    branch_id: input.branchId,
    business_id: input.businessId ?? null,
    device_id: input.deviceId,
    lock_token: lockToken,
    status: "active",
    acquired_at: now.toISOString(),
    renewed_at: now.toISOString(),
    expires_at: expiresAt,
    actor_id: input.actorId ?? null,
  };

  let write = await supabase
    .from("device_branch_locks")
    .upsert(payload, { onConflict: "branch_id" })
    .select("branch_id, business_id, device_id, lock_token, status, acquired_at, renewed_at, expires_at, actor_id")
    .maybeSingle();

  if (write.error && isMissingTableError(write.error.message)) {
    return { ok: false, error: "Sync lock tablosu bulunamadi. Migration calistirin." };
  }

  if (write.error) {
    return { ok: false, error: write.error.message };
  }

  const state = mapRow((write.data ?? null) as Record<string, unknown> | null);
  if (!state) {
    return { ok: false, error: "Branch lock kaydi olusturulamadi." };
  }

  return { ok: true, state };
}

export async function renewBranchLock(input: {
  branchId: string;
  deviceId: string;
  lockToken: string;
  actorId?: string | null;
  ttlSeconds?: number;
}): Promise<LockResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Sunucu Supabase baglantisi kurulamadi." };
  }

  const ttlSeconds = Math.max(30, Math.floor(input.ttlSeconds ?? DEFAULT_LOCK_TTL_SECONDS));
  const now = new Date();
  const expiresAt = new Date(now.valueOf() + ttlSeconds * 1000).toISOString();

  const currentResult = await getBranchLockState(input.branchId);
  if (!currentResult.ok) {
    return currentResult;
  }

  const current = currentResult.state;
  if (!current || current.status !== "active") {
    return { ok: false, error: "Yenilenecek aktif lock bulunamadi." };
  }
  if (current.device_id !== input.deviceId || current.lock_token !== input.lockToken) {
    return { ok: false, error: "Lock yenileme yetkisi yok.", conflict: current };
  }

  const { data, error } = await supabase
    .from("device_branch_locks")
    .update({
      renewed_at: now.toISOString(),
      expires_at: expiresAt,
      actor_id: input.actorId ?? current.actor_id,
      status: "active",
    })
    .eq("branch_id", input.branchId)
    .eq("device_id", input.deviceId)
    .eq("lock_token", input.lockToken)
    .select("branch_id, business_id, device_id, lock_token, status, acquired_at, renewed_at, expires_at, actor_id")
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) {
      return { ok: false, error: "Sync lock tablosu bulunamadi. Migration calistirin." };
    }
    return { ok: false, error: error.message };
  }

  const state = mapRow((data ?? null) as Record<string, unknown> | null);
  if (!state) {
    return { ok: false, error: "Lock yenilenemedi." };
  }

  return { ok: true, state };
}

export async function releaseBranchLock(input: {
  branchId: string;
  deviceId: string;
  lockToken: string;
  actorId?: string | null;
}): Promise<LockResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Sunucu Supabase baglantisi kurulamadi." };
  }

  const currentResult = await getBranchLockState(input.branchId);
  if (!currentResult.ok) {
    return currentResult;
  }

  const current = currentResult.state;
  if (!current || current.status !== "active") {
    return { ok: true, state: current };
  }
  if (current.device_id !== input.deviceId || current.lock_token !== input.lockToken) {
    return { ok: false, error: "Lock birakma yetkisi yok.", conflict: current };
  }

  const { data, error } = await supabase
    .from("device_branch_locks")
    .update({
      status: "released",
      renewed_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      actor_id: input.actorId ?? current.actor_id,
    })
    .eq("branch_id", input.branchId)
    .eq("device_id", input.deviceId)
    .eq("lock_token", input.lockToken)
    .select("branch_id, business_id, device_id, lock_token, status, acquired_at, renewed_at, expires_at, actor_id")
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) {
      return { ok: false, error: "Sync lock tablosu bulunamadi. Migration calistirin." };
    }
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    state: mapRow((data ?? null) as Record<string, unknown> | null),
  };
}

export function validateLockForDevice(input: {
  state: BranchLockState | undefined;
  deviceId: string;
  lockToken: string;
}) {
  if (!input.state) {
    return { ok: false, error: "Branch lock bulunamadi." };
  }
  if (input.state.status !== "active") {
    return { ok: false, error: "Branch lock aktif degil." };
  }
  if (new Date(input.state.expires_at).valueOf() <= Date.now()) {
    return { ok: false, error: "Branch lock suresi doldu." };
  }
  if (input.state.device_id !== input.deviceId || input.state.lock_token !== input.lockToken) {
    return { ok: false, error: "Branch lock cihaza ait degil." };
  }
  return { ok: true };
}
