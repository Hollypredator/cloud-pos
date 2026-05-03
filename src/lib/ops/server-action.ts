import { getCurrentUserWithRole } from "@/lib/auth";
import { makeOpsCommandEnvelope, executeOpsCommand } from "@/lib/ops/command-executor";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { logUserActivity } from "@/lib/server/user-activity";
import type { OpsCommandResult, OpsCommandType } from "@/lib/types";

type ExecuteWebOpsCommandInput = {
  type: OpsCommandType;
  payload: Record<string, unknown>;
  branchId?: string | null;
  businessId?: string | null;
  actorId?: string | null;
  idempotencyKey?: string;
  commandId?: string;
};

export async function executeWebOpsCommand(input: ExecuteWebOpsCommandInput): Promise<OpsCommandResult> {
  const [auth, scope] = await Promise.all([getCurrentUserWithRole(), getBusinessScopeContext()]);

  if (auth.user?.id) {
    // Background activity log
    logUserActivity(auth.user.id, "profiles");
  }

  const command = makeOpsCommandEnvelope({
    type: input.type,
    payload: input.payload,
    businessId: input.businessId ?? scope.businessId ?? null,
    branchId: input.branchId ?? scope.branchId ?? null,
    actorId: input.actorId ?? auth.user?.id ?? null,
    deviceId: "web-online",
    idempotencyKey: input.idempotencyKey,
    commandId: input.commandId,
  });

  return executeOpsCommand(command, { enforceCashOnly: false });
}
