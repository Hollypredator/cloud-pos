import { NextResponse } from "next/server";
import { canUseDemoModeBypass, getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getOrderReceipt } from "@/lib/domains/orders";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const auth = await getCurrentUserWithRole();
  const canAccess = canUseDemoModeBypass(auth.usingDemoData) || (!!auth.user && hasRoleAccess(auth.role, ["admin"]));
  if (!canAccess) {
    return NextResponse.json({ ok: false, message: "Yetkisiz erisim." }, { status: 403 });
  }

  const params = await context.params;
  const orderId = String(params.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ ok: false, message: "orderId gerekli." }, { status: 400 });
  }

  const { order } = await getOrderReceipt(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, message: "Adisyon bulunamadi." }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, order },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
