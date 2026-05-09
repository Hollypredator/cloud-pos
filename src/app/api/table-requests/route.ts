import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { createTableRequest } from "@/lib/domains/tables";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { getQrAccessFailurePayload, verifyQrAccessToken } from "@/lib/qr-access";
import type { TableRequestType } from "@/lib/types";

type Body = {
  businessSlug?: string;
  qrCodeIdentifier?: string;
  accessToken?: string;
  requestType?: TableRequestType;
  note?: string;
};

export async function POST(request: Request) {
  const startedAt = performance.now();
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) => {
    const response = withCorrelationId(NextResponse.json(body, init), correlationId);
    response.headers.set("x-operation-ms", Math.round(performance.now() - startedAt).toString());
    return response;
  };

  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      logApiEvent("warn", "table_requests.create.invalid_body", { correlationId });
      return json({ ok: false, code: "INVALID_BODY", message: "Gecersiz istek govdesi." }, { status: 400 });
    }

    if (!body.qrCodeIdentifier || !body.requestType) {
      logApiEvent("warn", "table_requests.create.missing_fields", { correlationId });
      return json({ ok: false, code: "MISSING_FIELDS", message: "Eksik alanlar var." }, { status: 400 });
    }

    if (body.requestType !== "call_waiter" && body.requestType !== "request_bill") {
      logApiEvent("warn", "table_requests.create.invalid_type", {
        correlationId,
        requestType: body.requestType,
      });
      return json({ ok: false, code: "INVALID_TYPE", message: "Gecersiz talep tipi." }, { status: 400 });
    }

    const tokenCheck = verifyQrAccessToken({
      token: body.accessToken,
      qrCodeIdentifier: body.qrCodeIdentifier,
      businessSlug: body.businessSlug,
    });
    if (!tokenCheck.ok) {
      const failure = getQrAccessFailurePayload(tokenCheck.reason);
      logApiEvent(failure.status >= 500 ? "error" : "warn", "table_requests.create.qr_token_invalid", {
        correlationId,
        reason: tokenCheck.reason,
        qrCodeIdentifier: body.qrCodeIdentifier,
        businessSlug: body.businessSlug ?? null,
      });
      return json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
    }

    const result = await createTableRequest({
      businessSlug: body.businessSlug,
      qrCodeIdentifier: body.qrCodeIdentifier,
      requestType: body.requestType,
      note: body.note,
    });

    if (!result.ok) {
      logApiEvent("error", "table_requests.create.failed", {
        correlationId,
        requestType: body.requestType,
        error: result.error ?? "unknown",
      });
      return json({ ok: false, code: "REQUEST_CREATE_FAILED", message: result.error ?? "Talep olusturulamadi." }, { status: 500 });
    }

    logApiEvent("info", "table_requests.create.success", {
      correlationId,
      requestId: result.id ?? null,
      requestType: body.requestType,
      operationMs: Math.round(performance.now() - startedAt),
    });
    return json({ ok: true, requestId: result.id ?? null });
  } catch (error) {
    logApiEvent("error", "table_requests.create.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, code: "UNHANDLED", message: "Talep olusturulurken beklenmeyen hata olustu." }, { status: 500 });
  }
}
