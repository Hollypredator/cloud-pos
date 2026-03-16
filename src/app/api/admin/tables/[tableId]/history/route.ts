import { NextResponse } from "next/server";
import { getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getLatestOrderByTableId, getOrderHistoryByTableId } from "@/lib/domains/orders";

export async function GET(
  request: Request,
  context: { params: Promise<{ tableId: string }> | { tableId: string } },
) {
  const auth = await getCurrentUserWithRole();
  const canAccess = auth.usingDemoData || (!!auth.user && hasRoleAccess(auth.role, ["admin"]));
  if (!canAccess) {
    return NextResponse.json({ ok: false, message: "Yetkisiz erisim." }, { status: 403 });
  }

  const params = await Promise.resolve(context.params);
  const tableId = String(params.tableId ?? "").trim();
  if (!tableId) {
    return NextResponse.json({ ok: false, message: "tableId gerekli." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? 8);
  const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 8;

  const [{ order: latestOrder }, { orders }] = await Promise.all([
    getLatestOrderByTableId(tableId),
    getOrderHistoryByTableId(tableId, limit),
  ]);

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
      },
    },
  );
}
