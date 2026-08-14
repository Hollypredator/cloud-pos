import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getOrderReceipt } from "@/lib/domains/orders";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import type { PaymentMethod } from "@/lib/types";

/**
 * `pay_at_order` tahsilati.
 *
 * Neden server action degil de API rotasi:
 * `AdminOrderEntry` siparis acildiktan sonra `live-ops:update` yayinliyor, bu da
 * RSC tazelemesi baslatiyor ve akista olan server action istegini iptal ediyor
 * (`POST /admin/orders -> net::ERR_ABORTED`). Odeme hic calismiyordu. API rotasi
 * sayfanin RSC yasam dongusune bagli degil, tazeleme onu iptal etmez.
 *
 * Tutar istemciden alinmiyor: `completeOrderPayment` amount bos geldiginde
 * siparisin kalan bakiyesini kapatir. Sepet ile kayit arasinda fark olusursa
 * yanlis tahsilat yapilmamali.
 */

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  card: "Kart",
  mixed: "Karma",
};

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cash" || value === "card" || value === "mixed";
}

export async function POST(request: Request) {
  await requireRole(["owner", "admin", "cashier"], "/admin/orders");

  let body: { orderId?: unknown; method?: unknown; idempotencyKey?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const method = isPaymentMethod(body.method) ? body.method : "cash";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined;

  if (!orderId) {
    return NextResponse.json({ ok: false, message: "Sipariş bulunamadı, ödeme kaydedilemedi." }, { status: 400 });
  }

  let remaining = 0;
  try {
    const result = await executeWebOpsCommand({
      type: "PAYMENT_SALE_CASH",
      idempotencyKey,
      payload: { order_id: orderId, method },
    });

    if (result.status !== "ACK") {
      return NextResponse.json({ ok: false, message: result.message ?? "Ödeme alınamadı." }, { status: 409 });
    }

    remaining = typeof result.data?.remaining === "number" ? result.data.remaining : 0;
  } catch {
    return NextResponse.json({ ok: false, message: "Ödeme sırasında beklenmeyen hata oluştu." }, { status: 500 });
  }

  // Odeme kaydedildi. Fis verisi alinamasa bile satis gecerli — fis hatasi
  // odemeyi basarisiz gostermez.
  let receipt = null;
  try {
    const { order } = await getOrderReceipt(orderId);
    if (order) {
      receipt = {
        orderNo: order.check_number ?? null,
        customerName: order.customer_name ?? null,
        items: (order.items ?? []).map((item) => ({
          name: item.name,
          qty: item.quantity,
          lineTotal: item.line_total,
          modifiers: (item.modifiers ?? []).map((modifier) =>
            modifier.price_delta
              ? `${modifier.option_name} (${modifier.price_delta > 0 ? "+" : ""}${modifier.price_delta.toFixed(2)} TL)`
              : modifier.option_name,
          ),
        })),
        subtotal: order.total_price,
        discount: order.discount_amount ?? 0,
        total: order.final_price ?? order.total_price,
        paymentLabel: PAYMENT_LABELS[method],
      };
    }
  } catch {
    receipt = null;
  }

  return NextResponse.json({
    ok: true,
    message: remaining > 0 ? `Ödeme alındı. Kalan: ${remaining.toFixed(2)} TL` : "Ödeme alındı, sipariş kapandı.",
    remaining,
    receipt,
  });
}
