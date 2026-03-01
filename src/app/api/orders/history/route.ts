import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qrCodeIdentifier = searchParams.get("qr");
  if (!qrCodeIdentifier) {
    return NextResponse.json({ ok: false, message: "qr parametresi gerekli." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, orders: [] });
}
