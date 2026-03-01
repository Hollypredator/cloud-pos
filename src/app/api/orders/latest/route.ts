import { NextResponse } from "next/server";
import { getLatestOrderByTableId, getTableByQr } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qrCodeIdentifier = searchParams.get("qr");
  const businessSlug = searchParams.get("b") ?? undefined;
  if (!qrCodeIdentifier) {
    return NextResponse.json({ ok: false, message: "qr parametresi gerekli." }, { status: 400 });
  }

  const table = await getTableByQr(qrCodeIdentifier, businessSlug);
  if (!table) {
    return NextResponse.json({ ok: false, message: "Masa bulunamadi." }, { status: 404 });
  }

  const { order } = await getLatestOrderByTableId(table.id);
  if (!order) {
    return NextResponse.json({ ok: true, order: null });
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      status: order.status,
      totalPrice: order.total_price,
      finalPrice: order.final_price ?? order.total_price,
      createdAt: order.created_at,
      items: order.items.map((item) => ({
        productId: item.product_id,
        name: item.name,
        quantity: item.quantity,
      })),
    },
  });
}
