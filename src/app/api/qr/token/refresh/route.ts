import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { getTableByQr } from "@/lib/domains/orders";
import { createQrAccessToken, getQrAccessTokenExpiryDate } from "@/lib/qr-access";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";

type Body = {
  qrCodeIdentifier?: string;
  businessSlug?: string;
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
      logApiEvent("warn", "qr.token.refresh.invalid_body", { correlationId });
      return json({ ok: false, code: "INVALID_BODY", message: "Gecersiz istek govdesi." }, { status: 400 });
    }

    const qrCodeIdentifier = body.qrCodeIdentifier?.trim();
    if (!qrCodeIdentifier) {
      logApiEvent("warn", "qr.token.refresh.missing_qr", { correlationId });
      return json({ ok: false, code: "MISSING_QR", message: "qrCodeIdentifier zorunlu." }, { status: 400 });
    }

    const table = await getTableByQr(qrCodeIdentifier, body.businessSlug);
    if (!table) {
      logApiEvent("warn", "qr.token.refresh.table_not_found", {
        correlationId,
        qrCodeIdentifier,
        businessSlug: body.businessSlug ?? null,
      });
      return json({ ok: false, code: "TABLE_NOT_FOUND", message: "Masa bulunamadı." }, { status: 404 });
    }

    const qrAccessToken = createQrAccessToken({
      qrCodeIdentifier,
      businessSlug: body.businessSlug,
    });
    if (!qrAccessToken) {
      logApiEvent("error", "qr.token.refresh.misconfigured", { correlationId });
      return json(
        { ok: false, code: "QR_TOKEN_MISCONFIGURED", message: "QR erisim token ayari eksik." },
        { status: 503 },
      );
    }

    const expiresAt = getQrAccessTokenExpiryDate().toISOString();
    logApiEvent("info", "qr.token.refresh.success", {
      correlationId,
      qrCodeIdentifier,
      businessSlug: body.businessSlug ?? null,
      operationMs: Math.round(performance.now() - startedAt),
    });
    return json({
      ok: true,
      qrAccessToken,
      expiresAt,
    });
  } catch (error) {
    logApiEvent("error", "qr.token.refresh.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, code: "UNHANDLED", message: "Beklenmeyen bir hata olustu." }, { status: 500 });
  }
}
