import type { OpsCommand, OpsCommandType, SyncPushRequest } from "@/lib/types";

const OPS_COMMAND_TYPES: OpsCommandType[] = [
  "ORDER_CREATE",
  "ORDER_STATUS_SET",
  "ORDER_FINANCIALS_SET",
  "ORDER_ITEM_CANCEL",
  "PAYMENT_SALE_CASH",
  "ORDER_CANCEL",
  "ORDER_REFUND_CASH",
  "DELIVERY_ASSIGN",
  "DELIVERY_COMPLETE",
  "TABLE_STATUS_SET",
  "TABLE_POSITION_SET",
  "TABLE_SEAT_COUNT_SET",
  "TABLE_REQUEST_RESOLVE",
  "CASH_SESSION_OPEN",
  "CASH_SESSION_CLOSE",
];

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function asNonEmptyString(input: unknown) {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : null;
}

function isOpsCommandType(input: unknown): input is OpsCommandType {
  return typeof input === "string" && OPS_COMMAND_TYPES.includes(input as OpsCommandType);
}

function toIsoString(input: unknown) {
  const value = asNonEmptyString(input);
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return date.toISOString();
}

export function parseOpsCommand(input: unknown): { ok: true; value: OpsCommand } | { ok: false; error: string } {
  if (!isObjectRecord(input)) {
    return { ok: false, error: "Komut govdesi gecerli bir obje olmali." };
  }

  const commandId = asNonEmptyString(input.command_id);
  const idempotencyKey = asNonEmptyString(input.idempotency_key);
  const deviceId = asNonEmptyString(input.device_id);
  const type = input.type;
  const createdAt = toIsoString(input.created_at) ?? new Date().toISOString();

  if (!commandId) {
    return { ok: false, error: "command_id zorunlu." };
  }
  if (!idempotencyKey) {
    return { ok: false, error: "idempotency_key zorunlu." };
  }
  if (!deviceId) {
    return { ok: false, error: "device_id zorunlu." };
  }
  if (!isOpsCommandType(type)) {
    return { ok: false, error: "type geçersiz." };
  }

  const payload = isObjectRecord(input.payload) ? input.payload : {};

  return {
    ok: true,
    value: {
      command_id: commandId,
      idempotency_key: idempotencyKey,
      type,
      business_id: asNonEmptyString(input.business_id),
      branch_id: asNonEmptyString(input.branch_id),
      actor_id: asNonEmptyString(input.actor_id),
      device_id: deviceId,
      created_at: createdAt,
      payload,
    },
  };
}

export function parseSyncPushRequest(input: unknown): { ok: true; value: SyncPushRequest } | { ok: false; error: string } {
  if (!isObjectRecord(input)) {
    return { ok: false, error: "Push isteği gecerli bir obje olmali." };
  }

  const deviceId = asNonEmptyString(input.device_id);
  const branchId = asNonEmptyString(input.branch_id);
  const commandsRaw = Array.isArray(input.commands) ? input.commands : null;

  if (!deviceId) {
    return { ok: false, error: "device_id zorunlu." };
  }
  if (!branchId) {
    return { ok: false, error: "branch_id zorunlu." };
  }
  if (!commandsRaw) {
    return { ok: false, error: "commands dizi olmali." };
  }

  const commands: OpsCommand[] = [];
  for (const rawCommand of commandsRaw) {
    const parsed = parseOpsCommand(rawCommand);
    if (!parsed.ok) {
      return parsed;
    }
    commands.push(parsed.value);
  }

  return {
    ok: true,
    value: {
      device_id: deviceId,
      branch_id: branchId,
      business_id: asNonEmptyString(input.business_id),
      lock_token: asNonEmptyString(input.lock_token) ?? undefined,
      commands,
    },
  };
}

export function getOpsCommandTypes() {
  return [...OPS_COMMAND_TYPES];
}
