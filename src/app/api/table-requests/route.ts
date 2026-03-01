import { NextResponse } from "next/server";
import { createTableRequest } from "@/lib/data";
import type { TableRequestType } from "@/lib/types";

type Body = {
  businessSlug?: string;
  qrCodeIdentifier?: string;
  requestType?: TableRequestType;
  note?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Gecersiz istek govdesi." }, { status: 400 });
  }

  if (!body.qrCodeIdentifier || !body.requestType) {
    return NextResponse.json({ ok: false, message: "Eksik alanlar var." }, { status: 400 });
  }

  if (body.requestType !== "call_waiter" && body.requestType !== "request_bill") {
    return NextResponse.json({ ok: false, message: "Gecersiz talep tipi." }, { status: 400 });
  }

  const result = await createTableRequest({
    businessSlug: body.businessSlug,
    qrCodeIdentifier: body.qrCodeIdentifier,
    requestType: body.requestType,
    note: body.note,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.error ?? "Talep olusturulamadi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, requestId: result.id ?? null });
}
