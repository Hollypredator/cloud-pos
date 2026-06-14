import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { OpsCommandResult, SyncEvent } from "@/lib/types";

function isMissingTableError(message?: string | null, table?: string) {
  const normalized = (message ?? "").toLowerCase();
  if (!table) {
    return normalized.includes("does not exist");
  }
  return normalized.includes(table.toLowerCase()) && normalized.includes("does not exist");
}

function safeJsonPayload(raw: unknown) {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function toSyncEvent(row: Record<string, unknown>): SyncEvent {
  return {
    sequence: Number(row.sequence ?? 0),
    business_id: typeof row.business_id === "string" ? row.business_id : null,
    branch_id: typeof row.branch_id === "string" ? row.branch_id : null,
    event_type: String(row.event_type ?? "unknown"),
    entity_type: String(row.entity_type ?? "unknown"),
    entity_id: String(row.entity_id ?? ""),
    payload: safeJsonPayload(row.payload),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export function parseSyncCursor(cursor: string | null | undefined) {
  const value = Number(cursor ?? "0");
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

export async function listSyncEvents(input: {
  businessId?: string | null;
  branchId?: string | null;
  cursor?: number;
  limit?: number;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false as const, error: "Sunucu Supabase bağlantısı kurulamadi.", events: [] as SyncEvent[], nextCursor: String(input.cursor ?? 0) };
  }

  const cursor = Math.max(0, Math.floor(input.cursor ?? 0));
  const limit = Math.max(1, Math.min(500, Math.floor(input.limit ?? 100)));

  let query = supabase
    .from("ops_sync_events")
    .select("sequence, business_id, branch_id, event_type, entity_type, entity_id, payload, created_at")
    .gt("sequence", cursor)
    .order("sequence", { ascending: true })
    .limit(limit);

  if (input.businessId) {
    query = query.eq("business_id", input.businessId);
  }
  if (input.branchId) {
    query = query.eq("branch_id", input.branchId);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error.message, "ops_sync_events")) {
      return {
        ok: false as const,
        error: "ops_sync_events tablosu bulunamadı. Migration çalıştırın.",
        events: [] as SyncEvent[],
        nextCursor: String(cursor),
      };
    }
    return { ok: false as const, error: error.message, events: [] as SyncEvent[], nextCursor: String(cursor) };
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map(toSyncEvent);
  const nextCursor = rows.length > 0 ? String(rows[rows.length - 1]?.sequence ?? cursor) : String(cursor);

  return {
    ok: true as const,
    events: rows,
    nextCursor,
  };
}

export async function recordCommandAttempt(input: {
  commandId: string;
  idempotencyKey: string;
  deviceId: string;
  branchId: string | null;
  businessId: string | null;
  result: OpsCommandResult;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase.from("ops_command_attempts").insert({
    command_id: input.commandId,
    idempotency_key: input.idempotencyKey,
    device_id: input.deviceId,
    branch_id: input.branchId,
    business_id: input.businessId,
    result_status: input.result.status,
    message: input.result.message ?? null,
    result_payload: input.result.data ?? {},
    attempted_at: new Date().toISOString(),
  });
}
