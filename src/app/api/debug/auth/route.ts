import { NextResponse } from "next/server";
import { getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getActiveBranchId } from "@/lib/branch-server";
import { listBranches } from "@/lib/data";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "Bulunamadi" }, { status: 404 });
  }

  const [auth, activeBranchId, branchContext] = await Promise.all([
    getCurrentUserWithRole(),
    getActiveBranchId(),
    listBranches(),
  ]);

  if (!auth.user || !hasRoleAccess(auth.role, ["admin"])) {
    return NextResponse.json({ ok: false, message: "Yetkisiz" }, { status: 401 });
  }

  return NextResponse.json({
    usingDemoData: auth.usingDemoData,
    hasUser: !!auth.user,
    userId: auth.user?.id ?? null,
    email: auth.user?.email ?? null,
    role: auth.role,
    accessScope: auth.accessScope ?? null,
    primaryBranchId: auth.primaryBranchId ?? null,
    branchAccessIds: auth.branchAccessIds ?? [],
    activeBranchId,
    visibleBranches: branchContext.branches.map((branch) => ({ id: branch.id, name: branch.name })),
  });
}
