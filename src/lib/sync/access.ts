import { canUseDemoModeBypass, getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getBusinessScopeContext } from "@/lib/server/app-context";

export type SyncActorContext = {
  actorId: string | null;
  businessId: string | null;
  branchId: string | null;
  accessScope: "business" | "branch";
  branchAccessIds: string[];
  usingDemoData: boolean;
};

export async function getSyncActorContext(): Promise<
  | { ok: true; value: SyncActorContext }
  | { ok: false; status: number; error: string }
> {
  const auth = await getCurrentUserWithRole();
  const allowDemoBypass = canUseDemoModeBypass(auth.usingDemoData);

  const hasWriteRole = allowDemoBypass || (!!auth.user && hasRoleAccess(auth.role, ["admin", "waiter", "cashier", "kitchen"]));
  if (!hasWriteRole) {
    return { ok: false, status: 403, error: "Sync yazma yetkiniz yok." };
  }

  const scope = allowDemoBypass ? null : await getBusinessScopeContext();

  return {
    ok: true,
    value: {
      actorId: auth.user?.id ?? null,
      businessId: scope?.businessId ?? null,
      branchId: scope?.branchId ?? null,
      accessScope: (auth.accessScope ?? "business") as "business" | "branch",
      branchAccessIds: auth.branchAccessIds ?? [],
      usingDemoData: allowDemoBypass,
    },
  };
}

export function canAccessBranch(input: {
  actor: SyncActorContext;
  branchId: string | null | undefined;
}) {
  const branchId = input.branchId ?? null;
  if (!branchId) {
    return false;
  }

  if (input.actor.accessScope === "business") {
    return true;
  }

  const allowedBranches = new Set<string>();
  for (const value of input.actor.branchAccessIds) {
    if (value) {
      allowedBranches.add(value);
    }
  }
  if (input.actor.branchId) {
    allowedBranches.add(input.actor.branchId);
  }

  return allowedBranches.has(branchId);
}
