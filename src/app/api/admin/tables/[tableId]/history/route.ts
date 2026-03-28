import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { canUseDemoModeBypass, getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getOrderHistoryByTableId } from "@/lib/domains/orders";

function isOpenOrderStatus(status: string) {
  return status === "pending" || status === "preparing" || status === "ready" || status === "served" || status === "partially_paid";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ tableId: string }> },
) {
  const startedAt = performance.now();
  const auth = await getCurrentUserWithRole();
  const canAccess = canUseDemoModeBypass(auth.usingDemoData) || (!!auth.user && hasRoleAccess(auth.role, ["admin"]));
  if (!canAccess) {
    return NextResponse.json({ ok: false, message: "Yetkisiz erişim." }, { status: 403 });
  }

  const params = await context.params;
  const tableId = String(params.tableId ?? "").trim();
  if (!tableId) {
    return NextResponse.json({ ok: false, message: "tableId gerekli." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? 8);
  const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 8;

  const { orders } = await getOrderHistoryByTableId(tableId, limit);
  const latestOrder = orders.find((order) => isOpenOrderStatus(order.status)) ?? null;

  return NextResponse.json(
    {
      ok: true,
      latestOrder: latestOrder
        ? {
            id: latestOrder.id,
            checkNumber: latestOrder.check_number ?? null,
            status: latestOrder.status,
            totalPrice: Number(latestOrder.total_price),
            finalPrice: Number(latestOrder.final_price ?? latestOrder.total_price),
            remainingBalance: Number(latestOrder.remaining_balance ?? 0),
            createdAt: latestOrder.created_at,
          }
        : null,
      orders: orders.map((order) => ({
        id: order.id,
        checkNumber: order.check_number ?? null,
        status: order.status,
        totalPrice: Number(order.total_price),
        finalPrice: Number(order.final_price ?? order.total_price),
        amountPaid: Number(order.amount_paid ?? 0),
        remainingBalance: Number(order.remaining_balance ?? 0),
        createdAt: order.created_at,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "x-operation-ms": Math.round(performance.now() - startedAt).toString(),
      },
    },
  );
}
