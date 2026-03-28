import { NextResponse } from "next/server";
import { createTableRequest } from "@/lib/domains/tables";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { verifyQrAccessToken } from "@/lib/qr-access";
import type { TableRequestType } from "@/lib/types";

type Body = {
  businessSlug?: string;
  qrCodeIdentifier?: string;
  accessToken?: string;
  requestType?: TableRequestType;
  note?: string;
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
      logApiEvent("warn", "table_requests.create.invalid_body", { correlationId });
      return json({ ok: false, message: "Geçersiz istek govdesi." }, { status: 400 });
    }

    if (!body.qrCodeIdentifier || !body.requestType) {
      logApiEvent("warn", "table_requests.create.missing_fields", { correlationId });
      return json({ ok: false, message: "Eksik alanlar var." }, { status: 400 });
    }

    if (body.requestType !== "call_waiter" && body.requestType !== "request_bill") {
      logApiEvent("warn", "table_requests.create.invalid_type", {
        correlationId,
        requestType: body.requestType,
      });
      return json({ ok: false, message: "Geçersiz talep tipi." }, { status: 400 });
    }

    const tokenCheck = verifyQrAccessToken({
      token: body.accessToken,
      qrCodeIdentifier: body.qrCodeIdentifier,
      businessSlug: body.businessSlug,
    });
    if (!tokenCheck.ok) {
      if (tokenCheck.reason === "misconfigured") {
        logApiEvent("error", "table_requests.create.token_misconfigured", { correlationId });
        return json({ ok: false, message: "QR API token ayari eksik." }, { status: 503 });
      }
      logApiEvent("warn", "table_requests.create.invalid_token", { correlationId });
      return json({ ok: false, message: "QR API erişim token geçersiz." }, { status: 403 });
    }

    const result = await createTableRequest({
      businessSlug: body.businessSlug,
      qrCodeIdentifier: body.qrCodeIdentifier,
      requestType: body.requestType,
      note: body.note,
    });

    if (!result.ok) {
      logApiEvent("error", "table_requests.create.failed", { correlationId });
      return json({ ok: false, message: result.error ?? "Talep oluşturulamadı." }, { status: 500 });
    }

    logApiEvent("info", "table_requests.create.success", {
      correlationId,
      requestId: result.id ?? null,
      requestType: body.requestType,
    });
    return json({ ok: true, requestId: result.id ?? null });
  } catch (error) {
    logApiEvent("error", "table_requests.create.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Talep oluşturulurken beklenmeyen hata oluştu." }, { status: 500 });
  }
}
