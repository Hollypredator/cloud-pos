import { performance } from "node:perf_hooks";

const baseUrl = (process.env.PERF_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const runs = Math.max(1, Number.parseInt(process.env.PERF_RUNS || "5", 10) || 5);
const warmupRuns = Math.max(0, Number.parseInt(process.env.PERF_WARMUP_RUNS || "1", 10) || 1);
const authCookie = (process.env.PERF_AUTH_COOKIE || "").trim();
const requireAuthBaseline = process.env.PERF_REQUIRE_AUTH_BASELINE === "true";
const allowLocalAuthBaseline = process.env.PERF_ALLOW_LOCAL_AUTH_BASELINE === "true";
const vercelBypassToken = (process.env.VERCEL_PROTECTION_BYPASS || "").trim();
const requestTimeoutMs = Math.max(250, Number.parseInt(process.env.PERF_REQUEST_TIMEOUT_MS || "4000", 10) || 4000);

const apiBudgetMs = Number(process.env.PERF_API_BUDGET_MS || 200);
const apiP95BudgetMs = Number(process.env.PERF_API_P95_BUDGET_MS || 300);
const pageBudgetMs = Number(process.env.PERF_PAGE_BUDGET_MS || 900);
const pageP95BudgetMs = Number(process.env.PERF_PAGE_P95_BUDGET_MS || 1200);
const operationBudgetMs = Number(process.env.PERF_OPERATION_BUDGET_MS || 500);
const operationP95BudgetMs = Number(process.env.PERF_OPERATION_P95_BUDGET_MS || 700);

const alertDispatchSecret = (process.env.PERF_ALERT_DISPATCH_SECRET || process.env.ALERT_DISPATCH_SECRET || "").trim();
const autoSessionCloseSecret = (process.env.PERF_AUTO_SESSION_CLOSE_SECRET || process.env.AUTO_SESSION_CLOSE_SECRET || "").trim();

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  const p95 = sorted[p95Index] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const min = sorted[0] ?? 0;
  return { avg, p95, min, max };
}

function fmt(ms) {
  return `${ms.toFixed(2)}ms`;
}

function parseMetricHeader(response, headerName) {
  const value = Number(response.headers.get(headerName));
  return Number.isFinite(value) ? value : null;
}

function isLocalBaseUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function buildTargets() {
  const targets = [
    { name: "api.health", type: "api", path: "/api/health", expected: [200], requiresAuth: false },
    { name: "api.app_shell", type: "api", path: "/api/app-shell", expected: [200], requiresAuth: false },
    { name: "page.login", type: "page", path: "/login", expected: [200], requiresAuth: false },
    { name: "page.root", type: "page", path: "/", expected: [200], requiresAuth: false },
    { name: "page.ops", type: "page", path: "/ops", expected: [200], requiresAuth: true },
    { name: "page.kitchen", type: "page", path: "/kitchen", expected: [200], requiresAuth: true },
    { name: "page.cashier", type: "page", path: "/cashier", expected: [200], requiresAuth: true },
    { name: "page.admin_products", type: "page", path: "/admin/products", expected: [200], requiresAuth: true },
    { name: "page.admin_tables", type: "page", path: "/admin/tables", expected: [200], requiresAuth: true },
    { name: "api.metrics_ops", type: "api", path: "/api/metrics/ops", expected: [200], requiresAuth: true },
  ];

  if (alertDispatchSecret) {
    targets.push({
      name: "op.alert_dispatch_preview",
      type: "operation",
      path: "/api/alerts/dispatch",
      expected: [200],
      requiresAuth: false,
      headers: {
        "x-alert-secret": alertDispatchSecret,
      },
    });
  }

  if (autoSessionCloseSecret) {
    targets.push({
      name: "op.session_auto_close_dry_run",
      type: "operation",
      path: "/api/cashier/session/auto-close",
      expected: [200],
      requiresAuth: false,
      headers: {
        "x-auto-close-secret": autoSessionCloseSecret,
      },
    });
  }

  return targets.filter((target) => {
    if (!target.requiresAuth) {
      return true;
    }
    if (authCookie) {
      return true;
    }
    return !requireAuthBaseline;
  });
}

function withBypass(url) {
  if (!vercelBypassToken) {
    return url;
  }
  const target = new URL(url);
  target.searchParams.set("x-vercel-set-bypass-cookie", "true");
  target.searchParams.set("x-vercel-protection-bypass", vercelBypassToken);
  return target.toString();
}

async function timedRequest(target) {
  const url = withBypass(new URL(target.path, baseUrl).toString());
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), requestTimeoutMs);
  const headers = {
    "User-Agent": "cloud-pos-perf-sla-check/1.0",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(target.headers ?? {}),
  };
  if (authCookie) {
    headers.Cookie = authCookie;
  }

  try {
    const response = await fetch(url, {
      method: target.method || "GET",
      redirect: "follow",
      headers,
      signal: controller.signal,
    });
    await response.arrayBuffer();
    const elapsed = performance.now() - startedAt;
    return {
      status: response.status,
      ms: elapsed,
      appShellMs: parseMetricHeader(response, "x-app-shell-ms"),
      operationMs: parseMetricHeader(response, "x-operation-ms"),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runTarget(target) {
  const durations = [];
  const statuses = [];
  const appShellDurations = [];
  const operationDurations = [];
  let error = null;

  for (let index = 0; index < runs; index += 1) {
    try {
      const result = await timedRequest(target);
      durations.push(result.ms);
      statuses.push(result.status);
      if (typeof result.appShellMs === "number") {
        appShellDurations.push(result.appShellMs);
      }
      if (typeof result.operationMs === "number") {
        operationDurations.push(result.operationMs);
      }
    } catch (innerError) {
      error = innerError instanceof Error ? innerError.message : "unknown_error";
      break;
    }
  }

  if (error) {
    return {
      ...target,
      ok: false,
      reason: error,
      statuses,
      metrics: null,
    };
  }

  const hasUnexpectedStatus = statuses.some((status) => !target.expected.includes(status));
  const metric = stats(durations);
  const appShellMetric = appShellDurations.length > 0 ? stats(appShellDurations) : null;
  const operationMetric = operationDurations.length > 0 ? stats(operationDurations) : null;
  const budget = target.type === "api" ? apiBudgetMs : target.type === "operation" ? operationBudgetMs : pageBudgetMs;
  const p95Budget =
    target.type === "api" ? apiP95BudgetMs : target.type === "operation" ? operationP95BudgetMs : pageP95BudgetMs;
  const withinBudget = metric.avg <= budget && metric.p95 <= p95Budget;

  return {
    ...target,
    ok: !hasUnexpectedStatus && withinBudget,
    reason: hasUnexpectedStatus
      ? `unexpected_statuses=${[...new Set(statuses)].join(",")}`
      : withinBudget
        ? null
        : `budget_exceeded(avg=${fmt(metric.avg)},p95=${fmt(metric.p95)})`,
    statuses,
    metrics: metric,
    headerMetrics: {
      appShell: appShellMetric,
      operation: operationMetric,
    },
    budget,
    p95Budget,
  };
}

async function warmupTarget(target) {
  if (warmupRuns <= 0) {
    return;
  }

  for (let index = 0; index < warmupRuns; index += 1) {
    try {
      await timedRequest(target);
    } catch {
      // Warmup should not fail the whole run.
    }
  }
}

async function run() {
  if (requireAuthBaseline && !authCookie) {
    console.error("[perf:sla] PERF_REQUIRE_AUTH_BASELINE=true icin PERF_AUTH_COOKIE zorunludur.");
    process.exit(1);
  }
  if (requireAuthBaseline && !allowLocalAuthBaseline && isLocalBaseUrl(baseUrl)) {
    console.error("[perf:sla] auth baseline staging URL ile alinmali. PERF_BASE_URL localhost olamaz.");
    process.exit(1);
  }

  const targets = buildTargets();
  if (targets.length === 0) {
    console.error("[perf:sla] olculecek hedef bulunamadı. PERF_AUTH_COOKIE tanimlaman gerekebilir.");
    process.exit(1);
  }

  console.log(
    `[perf:sla] base=${baseUrl} runs=${runs} warmup=${warmupRuns} auth=${authCookie ? "on" : "off"} require_auth_baseline=${requireAuthBaseline ? "on" : "off"}`,
  );
  console.log(
    `[perf:sla] budgets api_avg<=${apiBudgetMs}ms api_p95<=${apiP95BudgetMs}ms op_avg<=${operationBudgetMs}ms op_p95<=${operationP95BudgetMs}ms page_avg<=${pageBudgetMs}ms page_p95<=${pageP95BudgetMs}ms timeout=${requestTimeoutMs}ms`,
  );
  if (!alertDispatchSecret) {
    console.log("[perf:sla] info op.alert_dispatch_preview skipped (secret missing)");
  }
  if (!autoSessionCloseSecret) {
    console.log("[perf:sla] info op.session_auto_close_dry_run skipped (secret missing)");
  }

  const results = [];
  for (const target of targets) {
    await warmupTarget(target);
    const result = await runTarget(target);
    results.push(result);
    if (!result.metrics) {
      console.log(`[perf:sla] ${target.name} FAIL reason=${result.reason}`);
      continue;
    }
    const uniqueStatuses = [...new Set(result.statuses)].join(",");
    const marker = result.ok ? "PASS" : "FAIL";
    const appShellMetricText = result.headerMetrics?.appShell
      ? ` app_shell_avg=${fmt(result.headerMetrics.appShell.avg)} app_shell_p95=${fmt(result.headerMetrics.appShell.p95)}`
      : "";
    const operationMetricText = result.headerMetrics?.operation
      ? ` operation_avg=${fmt(result.headerMetrics.operation.avg)} operation_p95=${fmt(result.headerMetrics.operation.p95)}`
      : "";
    console.log(
      `[perf:sla] ${target.name} ${marker} status=${uniqueStatuses} avg=${fmt(result.metrics.avg)} p95=${fmt(result.metrics.p95)} min=${fmt(result.metrics.min)} max=${fmt(result.metrics.max)} budget=${result.budget}ms p95_budget=${result.p95Budget}ms${appShellMetricText}${operationMetricText}`,
    );
    if (!result.ok) {
      console.log(`[perf:sla] ${target.name} reason=${result.reason}`);
    }
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    process.exit(1);
  }

  console.log("[perf:sla] ok");
}

run().catch((error) => {
  console.error("[perf:sla] failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
