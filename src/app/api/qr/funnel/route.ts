import { NextResponse } from "next/server";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";

type QrFunnelStep =
  | "scan"
  | "cart_add"
  | "cart_view"
  | "cart_remove"
  | "checkout_open"
  | "checkout_abandon"
  | "checkout_confirm_view"
  | "checkout_confirm_ack"
  | "order_submit"
  | "order_ack";

type Body = {
  step?: QrFunnelStep;
  businessSlug?: string;
  qrCodeIdentifier?: string;
  cartItems?: number;
  cartTotal?: number;
  orderId?: string;
};

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) =>
    withCorrelationId(NextResponse.json(body, init), correlationId);

  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ ok: false, message: "Gecersiz istek govdesi." }, { status: 400 });
    }

    const step = body.step;
    if (
      !step ||
      ![
        "scan",
        "cart_add",
        "cart_view",
        "cart_remove",
        "checkout_open",
        "checkout_abandon",
        "checkout_confirm_view",
        "checkout_confirm_ack",
        "order_submit",
        "order_ack",
      ].includes(step)
    ) {
      return json({ ok: false, message: "Gecersiz funnel adimi." }, { status: 400 });
    }

    logApiEvent("info", "qr.funnel.step", {
      correlationId,
      step,
      businessSlug: body.businessSlug ?? null,
      qrCodeIdentifier: body.qrCodeIdentifier ?? null,
      cartItems: typeof body.cartItems === "number" ? body.cartItems : null,
      cartTotal: typeof body.cartTotal === "number" ? body.cartTotal : null,
      orderId: body.orderId ?? null,
    });

    return json({ ok: true });
  } catch (error) {
    logApiEvent("error", "qr.funnel.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Beklenmeyen bir hata olustu." }, { status: 500 });
  }
}
