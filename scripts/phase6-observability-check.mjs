import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "middleware.ts",
  "src/app/api/orders/route.ts",
  "src/app/api/table-requests/route.ts",
  "src/app/api/alerts/dispatch/route.ts",
  "src/app/api/metrics/ops/route.ts",
  "src/app/api/health/route.ts",
];

const requiredPatterns = new Map([
  ["middleware.ts", [/x-correlation-id/, /withCorrelationId\(/, /NextResponse\.next\(\{[\s\S]*headers:/]],
  ["src/app/api/orders/route.ts", [/getCorrelationId\(/, /withCorrelationId\(/, /logApiEvent\(/]],
  ["src/app/api/table-requests/route.ts", [/getCorrelationId\(/, /withCorrelationId\(/, /logApiEvent\(/]],
  ["src/app/api/alerts/dispatch/route.ts", [/getCorrelationId\(/, /withCorrelationId\(/, /logApiEvent\(/]],
  ["src/app/api/metrics/ops/route.ts", [/getCorrelationId\(/, /withCorrelationId\(/, /logApiEvent\(/]],
  ["src/app/api/health/route.ts", [/getCorrelationId\(/, /withCorrelationId\(/, /logApiEvent\(/]],
]);

function fail(message) {
  throw new Error(`[phase6:observability] ${message}`);
}

function run() {
  for (const relPath of requiredFiles) {
    const absPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(absPath)) {
      fail(`dosya bulunamadı: ${relPath}`);
    }

    const source = fs.readFileSync(absPath, "utf8");
    const patterns = requiredPatterns.get(relPath) ?? [];
    for (const pattern of patterns) {
      if (!pattern.test(source)) {
        fail(`zorunlu desen eksik: ${relPath} -> ${String(pattern)}`);
      }
    }
  }

  console.log("[phase6:observability] ok");
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
