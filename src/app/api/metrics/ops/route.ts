import { NextResponse } from "next/server";
import { getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getOpsMetricsSnapshot } from "@/lib/data";

export async function GET() {
  const auth = await getCurrentUserWithRole();
  if (!auth.user || !hasRoleAccess(auth.role, ["admin"])) {
    return NextResponse.json({ ok: false, message: "Yetkisiz" }, { status: 401 });
  }

  const metrics = await getOpsMetricsSnapshot();

  return NextResponse.json(
    {
      ok: true,
      timestamp: new Date().toISOString(),
      metrics,
    },
    { status: 200 },
  );
}
