import { spawnSync } from "node:child_process";

const wave = process.argv[2];

function fail(message) {
  throw new Error(`[rollout:wave] ${message}`);
}

function info(message) {
  console.log(`[rollout:wave] ${message}`);
}

function normalizeUrl(raw) {
  const value = (raw || "").trim();
  return value.replace(/\/$/, "");
}

function isLocalHost(rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function runNpmScript(scriptName) {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/c", "npm", "run", scriptName] : ["run", scriptName];

  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    fail(`${scriptName} baslatilamadi: ${result.error.message}`);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function requireValue(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    fail(`${name} zorunlu.`);
  }
  return value;
}

function assertFlag(name, expected) {
  const value = requireValue(name);
  if (value !== expected) {
    fail(`${name}=${value} bulundu, beklenen ${expected}.`);
  }
}

function runTablesWave() {
  const appUrl = normalizeUrl(requireValue("NEXT_PUBLIC_APP_URL"));
  if (isLocalHost(appUrl)) {
    fail("Tables wave staging URL ile calismali. NEXT_PUBLIC_APP_URL localhost olamaz.");
  }
  assertFlag("NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES", "true");
  assertFlag("NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER", "false");

  info("dalga=tables flag kontrol? gecti, ops smoke calistiriliyor...");
  runNpmScript("ops:smoke");
  info("tables smoke gate PASS. Manuel checklist: /tables render, empty->reserved->empty, optimistic Isleniyor, duplicate submit kontrol?.");
}

function runCashierWave() {
  const appUrl = normalizeUrl(requireValue("NEXT_PUBLIC_APP_URL"));
  if (isLocalHost(appUrl)) {
    fail("Cashier wave staging URL ile calismali. NEXT_PUBLIC_APP_URL localhost olamaz.");
  }
  assertFlag("NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES", "true");
  assertFlag("NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER", "true");

  info("dalga=cashier flag kontrol? gecti, ops smoke calistiriliyor...");
  runNpmScript("ops:smoke");
  info("cashier smoke gate PASS. Manuel checklist: financials/payment/item-cancel/cancel/refund ACK-REJECT geri bildirimleri.");
}

function runPerfAuthWave() {
  const perfBaseUrl = normalizeUrl(requireValue("PERF_BASE_URL"));
  if (isLocalHost(perfBaseUrl)) {
    fail("Auth perf baseline staging URL ile alinmali. PERF_BASE_URL localhost olamaz.");
  }
  assertFlag("PERF_REQUIRE_AUTH_BASELINE", "true");
  requireValue("PERF_AUTH_COOKIE");

  info("dalga=perf-auth kontrol? gecti, perf:sla calistiriliyor...");
  runNpmScript("perf:sla");
  info("perf gate PASS. Hedef: auth page avg<=900ms, p95<=1200ms.");
}

function printUsageAndExit() {
  console.log("Kullanim: node scripts/staging-rollout-wave-check.mjs <tables|cashier|perf-auth>");
  process.exit(1);
}

try {
  if (!wave) {
    printUsageAndExit();
  }

  if (wave === "tables") {
    if (requireValue("NEXT_PUBLIC_APP_URL").includes("vercel.app") && !(process.env.VERCEL_PROTECTION_BYPASS || "").trim()) {
      fail("vercel.app staging icin VERCEL_PROTECTION_BYPASS token gerekli olabilir.");
    }
    runTablesWave();
  } else if (wave === "cashier") {
    if (requireValue("NEXT_PUBLIC_APP_URL").includes("vercel.app") && !(process.env.VERCEL_PROTECTION_BYPASS || "").trim()) {
      fail("vercel.app staging icin VERCEL_PROTECTION_BYPASS token gerekli olabilir.");
    }
    runCashierWave();
  } else if (wave === "perf-auth") {
    if (requireValue("PERF_BASE_URL").includes("vercel.app") && !(process.env.VERCEL_PROTECTION_BYPASS || "").trim()) {
      fail("vercel.app perf auth icin VERCEL_PROTECTION_BYPASS token gerekli olabilir.");
    }
    runPerfAuthWave();
  } else {
    printUsageAndExit();
  }

  info("ok");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
