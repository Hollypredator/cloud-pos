import { NextResponse } from "next/server";
import { getApplicationSettings } from "@/lib/data";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const OPEN_ORDER_STATUSES = ["pending", "preparing", "ready", "served", "partially_paid"] as const;
const DEFAULT_TIMEZONE = "Europe/Istanbul";

type OpenSessionRow = {
  id: string;
  business_id: string | null;
  branch_id: string | null;
  opened_at: string;
  opening_cash: number | null;
  note: string | null;
};

type LocalStamp = {
  day: string;
  minutes: number;
};

function checkSecret(request: Request) {
  const secret = process.env.AUTO_SESSION_CLOSE_SECRET;
  if (!secret) return null;
  return request.headers.get("x-auto-close-secret") === secret;
}

function parseHourMinuteToMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function toLocalStamp(value: Date | string, timeZone: string): LocalStamp {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "00");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "00");

  return {
    day: `${year}-${month}-${day}`,
    minutes: hour * 60 + minute,
  };
}

function isSessionDueToday(input: {
  sessionOpenedAt: string;
  now: Date;
  timeZone: string;
  targetMinutes: number;
}) {
  const nowLocal = toLocalStamp(input.now, input.timeZone);
  const openedLocal = toLocalStamp(input.sessionOpenedAt, input.timeZone);

  if (openedLocal.day < nowLocal.day) {
    return true;
  }
  if (openedLocal.day > nowLocal.day) {
    return false;
  }
  if (nowLocal.minutes < input.targetMinutes) {
    return false;
  }
  return openedLocal.minutes <= input.targetMinutes;
}

function applySessionScope<T extends { eq: (column: string, value: unknown) => T; is: (column: string, value: null) => T }>(
  query: T,
  row: Pick<OpenSessionRow, "business_id" | "branch_id">,
) {
  let scoped = query;
  if (row.business_id) {
    scoped = scoped.eq("business_id", row.business_id);
  }
  if (row.branch_id) {
    scoped = scoped.eq("branch_id", row.branch_id);
  } else {
    scoped = scoped.is("branch_id", null);
  }
  return scoped;
}

async function runAutoCloseTick(input: { dryRun: boolean; correlationId: string }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false as const, status: 503, message: "Supabase service role tanımlı değil." };
  }

  const { settings } = await getApplicationSettings();
  const timeZone = process.env.AUTO_SESSION_CLOSE_TZ || DEFAULT_TIMEZONE;
  const cutoffMinutes = parseHourMinuteToMinutes(settings.autoSessionCloseTime);
  if (cutoffMinutes === null) {
    return { ok: false as const, status: 500, message: "autoSessionCloseTime geçersiz formatta." };
  }

  if (!settings.autoSessionCloseEnabled) {
    return {
      ok: true as const,
      skipped: true,
      reason: "disabled",
      summary: { closed: 0, skippedOpenChecks: 0, skippedNotDue: 0, failed: 0, totalOpenSessions: 0 },
      settings: {
        autoSessionCloseEnabled: settings.autoSessionCloseEnabled,
        autoSessionCloseTime: settings.autoSessionCloseTime,
        requireNoOpenChecksForSessionClose: settings.requireNoOpenChecksForSessionClose,
        timeZone,
      },
    };
  }

  const { data: openRows, error: openRowsError } = await supabase
    .from("cash_register_sessions")
    .select("id, business_id, branch_id, opened_at, opening_cash, note")
    .eq("status", "open");

  if (openRowsError) {
    return { ok: false as const, status: 500, message: openRowsError.message };
  }

  const now = new Date();
  const nowLocal = toLocalStamp(now, timeZone);
  const sessions = (openRows ?? []) as OpenSessionRow[];
  const details: Array<Record<string, unknown>> = [];
  let closed = 0;
  let skippedOpenChecks = 0;
  let skippedNotDue = 0;
  let failed = 0;

  for (const session of sessions) {
    const due = isSessionDueToday({
      sessionOpenedAt: session.opened_at,
      now,
      timeZone,
      targetMinutes: cutoffMinutes,
    });
    if (!due) {
      skippedNotDue += 1;
      details.push({ sessionId: session.id, action: "skip_not_due" });
      continue;
    }

    if (settings.requireNoOpenChecksForSessionClose) {
      let openOrdersQuery = supabase
        .from("orders")
        .select("id")
        .in("status", [...OPEN_ORDER_STATUSES])
        .limit(1);
      openOrdersQuery = applySessionScope(openOrdersQuery, session);
      const { data: openOrderRows, error: openOrderError } = await openOrdersQuery;
      if (openOrderError) {
        failed += 1;
        details.push({ sessionId: session.id, action: "failed", reason: "open_order_query_failed", error: openOrderError.message });
        continue;
      }
      if ((openOrderRows?.length ?? 0) > 0) {
        skippedOpenChecks += 1;
        details.push({ sessionId: session.id, action: "skip_open_checks", openOrderDetected: true });
        continue;
      }
    }

    let cashQuery = supabase
      .from("payments")
      .select("amount, payment_type")
      .eq("method", "cash")
      .gte("created_at", session.opened_at);
    cashQuery = applySessionScope(cashQuery, session);
    const { data: cashRows, error: cashError } = await cashQuery;
    if (cashError) {
      failed += 1;
      details.push({ sessionId: session.id, action: "failed", reason: "cash_query_failed", error: cashError.message });
      continue;
    }

    const expectedCash = (cashRows ?? []).reduce((sum, row) => {
      const amount = Number((row as { amount?: number }).amount ?? 0);
      if ((row as { payment_type?: string }).payment_type === "refund") {
        return sum - amount;
      }
      return sum + amount;
    }, Math.max(0, Number(session.opening_cash ?? 0)));
    const roundedExpected = Math.round(expectedCash * 100) / 100;
    const autoNote = `Otomatik gun sonu (${settings.autoSessionCloseTime}, ${timeZone})`;
    const nextNote = session.note ? `${session.note} | ${autoNote}` : autoNote;

    if (input.dryRun) {
      closed += 1;
      details.push({ sessionId: session.id, action: "would_close", expectedCash: roundedExpected });
      continue;
    }

    let closeQuery = supabase
      .from("cash_register_sessions")
      .update({
        status: "closed",
        closed_at: now.toISOString(),
        closing_cash: roundedExpected,
        expected_cash: roundedExpected,
        closed_by: null,
        note: nextNote,
      })
      .eq("id", session.id)
      .eq("status", "open");
    closeQuery = applySessionScope(closeQuery, session);

    const { error: closeError } = await closeQuery;
    if (closeError) {
      failed += 1;
      details.push({ sessionId: session.id, action: "failed", reason: "close_failed", error: closeError.message });
      continue;
    }

    closed += 1;
    details.push({ sessionId: session.id, action: "closed", expectedCash: roundedExpected });

    await supabase.from("audit_logs").insert({
      actor_id: null,
      entity_type: "cash_register_session",
      entity_id: session.id,
      action: "auto_close",
      details: {
        reason: "scheduled_auto_close",
        timeZone,
        cutOffTime: settings.autoSessionCloseTime,
        expectedCash: roundedExpected,
        closedAt: now.toISOString(),
      },
    });
  }

  logApiEvent("info", "cashier.session.auto_close.summary", {
    correlationId: input.correlationId,
    dryRun: input.dryRun,
    totalOpenSessions: sessions.length,
    closed,
    skippedOpenChecks,
    skippedNotDue,
    failed,
  });

  return {
    ok: true as const,
    dryRun: input.dryRun,
    nowLocal,
    summary: {
      totalOpenSessions: sessions.length,
      closed,
      skippedOpenChecks,
      skippedNotDue,
      failed,
    },
    details,
    settings: {
      autoSessionCloseEnabled: settings.autoSessionCloseEnabled,
      autoSessionCloseTime: settings.autoSessionCloseTime,
      requireNoOpenChecksForSessionClose: settings.requireNoOpenChecksForSessionClose,
      timeZone,
    },
  };
}

function unauthorized(correlationId: string) {
  logApiEvent("warn", "cashier.session.auto_close.unauthorized", { correlationId });
  return withCorrelationId(NextResponse.json({ ok: false, message: "Yetkisiz" }, { status: 401 }), correlationId);
}

function misconfigured(correlationId: string) {
  logApiEvent("error", "cashier.session.auto_close.secret_missing", { correlationId });
  return withCorrelationId(
    NextResponse.json({ ok: false, message: "AUTO_SESSION_CLOSE_SECRET tanımlı değil." }, { status: 503 }),
    correlationId,
  );
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) => {
    const response = withCorrelationId(NextResponse.json(body, init), correlationId);
    response.headers.set("x-operation-ms", String(Date.now() - startedAt));
    return response;
  };

  const secretValid = checkSecret(request);
  if (secretValid === null) return misconfigured(correlationId);
  if (!secretValid) return unauthorized(correlationId);

  const result = await runAutoCloseTick({ dryRun: true, correlationId });
  if (!result.ok) {
    return json({ ok: false, message: result.message }, { status: result.status });
  }
  return json(result);
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) => {
    const response = withCorrelationId(NextResponse.json(body, init), correlationId);
    response.headers.set("x-operation-ms", String(Date.now() - startedAt));
    return response;
  };

  const secretValid = checkSecret(request);
  if (secretValid === null) return misconfigured(correlationId);
  if (!secretValid) return unauthorized(correlationId);

  const result = await runAutoCloseTick({ dryRun: false, correlationId });
  if (!result.ok) {
    return json({ ok: false, message: result.message }, { status: result.status });
  }
  return json(result);
}
