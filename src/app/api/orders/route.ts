import { NextResponse } from "next/server";
import { getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { createOrder, getBusinessContextBySlug, getTableByQr } from "@/lib/data";
import type { FulfillmentStatus, OrderChannel } from "@/lib/types";

type Body = {
  tableId?: string;
  businessSlug?: string;
  qrCodeIdentifier?: string;
  channel?: OrderChannel;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNote?: string;
  courierName?: string;
  courierPhone?: string;
  fulfillmentStatus?: FulfillmentStatus;
  items?: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    modifiers?: Array<{
      group_id?: string;
      group_name: string;
      option_id?: string;
      option_name: string;
      price_delta: number;
      quantity?: number;
    }>;
  }>;
  totalPrice?: number;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Gecersiz istek govdesi." }, { status: 400 });
  }

  const channel = body.channel ?? "dine_in";
  if (!body.items?.length || typeof body.totalPrice !== "number") {
    return NextResponse.json({ ok: false, message: "Eksik siparis alanlari var." }, { status: 400 });
  }

  if (channel === "dine_in" && !body.qrCodeIdentifier) {
    return NextResponse.json({ ok: false, message: "Masa siparisi icin QR kodu gerekli." }, { status: 400 });
  }

  if (body.qrCodeIdentifier) {
    const auth = await getCurrentUserWithRole();
    if (!auth.user || !hasRoleAccess(auth.role, ["admin", "waiter", "cashier"])) {
      return NextResponse.json(
        { ok: false, message: "QR uzerinden dogrudan siparis kapali. Lutfen garsona iletin." },
        { status: 403 },
      );
    }
  }

  let table = null;
  if (body.qrCodeIdentifier) {
    table = await getTableByQr(body.qrCodeIdentifier, body.businessSlug);
    if (channel === "dine_in" && !table) {
      return NextResponse.json({ ok: false, message: "Masa bulunamadi." }, { status: 404 });
    }
  }

  const businessContext = await getBusinessContextBySlug(body.businessSlug);
  const result = await createOrder({
    tableId: table?.id ?? null,
    businessId: table?.business_id ?? businessContext.businessId ?? undefined,
    items: body.items,
    totalPrice: body.totalPrice,
    channel,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    deliveryAddress: body.deliveryAddress,
    deliveryNote: body.deliveryNote,
    courierName: body.courierName,
    courierPhone: body.courierPhone,
    fulfillmentStatus: body.fulfillmentStatus,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "Siparis kaydedilemedi.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, orderId: result.id });
}
