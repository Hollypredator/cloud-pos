import { NextResponse } from "next/server";
import { getOrderHistoryByTableId, getTableByQr } from "@/lib/domains/orders";
import { verifyQrAccessToken } from "@/lib/qr-access";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qrCodeIdentifier = searchParams.get("qr");
  const businessSlug = searchParams.get("b") ?? undefined;
  const accessToken = searchParams.get("t");
  if (!qrCodeIdentifier) {
    return NextResponse.json({ ok: false, message: "qr parametresi gerekli." }, { status: 400 });
  }

  const tokenCheck = verifyQrAccessToken({ token: accessToken, qrCodeIdentifier, businessSlug });
  if (!tokenCheck.ok) {
    if (tokenCheck.reason === "misconfigured") {
      return NextResponse.json({ ok: false, message: "QR API token ayari eksik." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, message: "QR API erişim token geçersiz." }, { status: 403 });
  }

  const table = await getTableByQr(qrCodeIdentifier, businessSlug);
  if (!table) {
    return NextResponse.json({ ok: false, message: "Masa bulunamadi." }, { status: 404 });
  }

  const { orders } = await getOrderHistoryByTableId(table.id, 8);

  return NextResponse.json(
    {
      ok: true,
      orders: orders.map((order) => ({
        id: order.id,
        checkNumber: order.check_number ?? null,
        status: order.status,
        totalPrice: order.total_price,
        finalPrice: order.final_price ?? order.total_price,
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
