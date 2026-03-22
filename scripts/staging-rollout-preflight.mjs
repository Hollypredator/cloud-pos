import fs from "node:fs";
import path from "node:path";

function fail(message) {
  throw new Error(`[rollout:preflight] ${message}`);
}

function warn(message) {
  console.warn(`[rollout:preflight] warn ${message}`);
}

function info(message) {
  console.log(`[rollout:preflight] ${message}`);
}

function ensureFile(relPath) {
  const absPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(absPath)) {
    fail(`dosya bulunamadi: ${relPath}`);
  }
  return fs.readFileSync(absPath, "utf8");
}

function ensureScript(packageJson, scriptName) {
  const scripts = packageJson.scripts ?? {};
  if (!scripts[scriptName]) {
    fail(`package.json script eksik: ${scriptName}`);
  }
}

function ensureFlagLiteral(value, name) {
  if (!value) {
    return;
  }
  if (value !== "true" && value !== "false") {
    fail(`${name} yalnizca true/false olabilir.`);
  }
}

function run() {
  ensureFile("supabase/migrations/20260321_add_ops_sync_locks_and_events.sql");
  ensureFile("supabase/migrations/20260321_add_ops_aggregate_rpcs_and_indexes.sql");
  ensureFile("docs/staging-uat.md");
  ensureFile("docs/phases/phase-7-staging-uat-and-pilot-prep.md");
  ensureFile("src/lib/pos/feature-flags.ts");

  const packageJson = JSON.parse(ensureFile("package.json"));
  ensureScript(packageJson, "ops:smoke");
  ensureScript(packageJson, "perf:sla");

  ensureFlagLiteral(process.env.NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES, "NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES");
  ensureFlagLiteral(process.env.NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER, "NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER");
  ensureFlagLiteral(process.env.PERF_REQUIRE_AUTH_BASELINE, "PERF_REQUIRE_AUTH_BASELINE");

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!appUrl) {
    warn("NEXT_PUBLIC_APP_URL bos. Staging smoke komutlarinda URL set etmelisin.");
  }

  if (appUrl && appUrl.includes("vercel.app") && !(process.env.VERCEL_PROTECTION_BYPASS || "").trim()) {
    warn("vercel.app URL tespit edildi. Deployment protection varsa VERCEL_PROTECTION_BYPASS token gerekli.");
  }

  const perfBaseUrl = (process.env.PERF_BASE_URL || "").trim();
  if (!perfBaseUrl) {
    warn("PERF_BASE_URL bos. Auth perf baseline oncesi set etmelisin.");
  }

  if (!(process.env.STAGING_ADMIN_ACCOUNT_READY === "true")) {
    warn("STAGING_ADMIN_ACCOUNT_READY=true degil. Admin test hesabinin hazir oldugunu manuel dogrula.");
  }

  info("ok");
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
