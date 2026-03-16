import fs from "node:fs";
import path from "node:path";

function fail(message) {
  throw new Error(`[phase7:uat] ${message}`);
}

function ensureFile(relPath) {
  const absPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(absPath)) {
    fail(`dosya bulunamadi: ${relPath}`);
  }
  return fs.readFileSync(absPath, "utf8");
}

function run() {
  ensureFile("docs/staging-uat.md");
  ensureFile("docs/go-live-checklist.md");
  ensureFile("docs/incident-runbook.md");
  ensureFile("docs/phases/phase-6-observability-and-support.md");

  const packageJson = JSON.parse(ensureFile("package.json"));
  const scripts = packageJson.scripts ?? {};
  const requiredScripts = [
    "ops:smoke",
    "perf:sla",
    "phase2:runtime",
    "phase3:runtime",
    "phase4:reconciliation",
    "phase5:consistency",
    "phase6:observability",
  ];
  for (const scriptName of requiredScripts) {
    if (!scripts[scriptName]) {
      fail(`package.json script eksik: ${scriptName}`);
    }
  }

  const routeFiles = [
    "src/app/admin/orders/page.tsx",
    "src/app/kitchen/page.tsx",
    "src/app/cashier/page.tsx",
    "src/app/cashier/session/page.tsx",
    "src/app/admin/tables/page.tsx",
    "src/app/service-requests/page.tsx",
    "src/app/api/health/route.ts",
  ];
  for (const routeFile of routeFiles) {
    ensureFile(routeFile);
  }

  console.log("[phase7:uat] ok");
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
