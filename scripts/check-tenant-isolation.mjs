import fs from "node:fs";
import path from "node:path";

const targetFile = path.join(process.cwd(), "src", "lib", "data.ts");
const criticalRules = [
  {
    functionName: "createTableRequest",
    checks: [/getTableByQr\(/, /business_id\s*:/, /branch_id\s*:/],
  },
  {
    functionName: "createOrder",
    checks: [/getDefaultBusinessScope\(/, /business_id\s*:/, /branch_id\s*:/],
  },
  {
    functionName: "updateOrderStatus",
    checks: [/getDefaultBusinessScope\(/, /\.eq\("business_id"/, /\.eq\("branch_id"/],
  },
  {
    functionName: "openCashSession",
    checks: [/getDefaultBusinessScope\(/, /\.eq\("business_id"/, /\.eq\("branch_id"/],
  },
  {
    functionName: "closeCashSession",
    checks: [/getDefaultBusinessScope\(/, /\.eq\("business_id"/, /\.eq\("branch_id"/],
  },
  {
    functionName: "getPaymentOverview",
    checks: [/getDefaultBusinessScope\(/, /listScopedFinancePayments\(/, /businessId:\s*scope\.businessId/],
  },
];

function findFunctionBodyStart(source, functionIndex) {
  let parenDepth = 0;
  let seenOpenParen = false;
  for (let i = functionIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") {
      parenDepth += 1;
      seenOpenParen = true;
      continue;
    }
    if (ch === ")") {
      parenDepth -= 1;
      continue;
    }
    if (ch === "{" && seenOpenParen && parenDepth === 0) {
      return i;
    }
  }
  return -1;
}

function extractFunctionBody(source, functionName) {
  const headRegex = new RegExp(`export\\s+async\\s+function\\s+${functionName}\\s*\\(`);
  const match = headRegex.exec(source);
  if (!match || match.index < 0) {
    return null;
  }

  const openBraceIndex = findFunctionBodyStart(source, match.index);
  if (openBraceIndex < 0) {
    return null;
  }

  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBraceIndex, i + 1);
      }
    }
  }

  return null;
}

function run() {
  if (!fs.existsSync(targetFile)) {
    throw new Error(`Dosya bulunamadı: ${targetFile}`);
  }
  const source = fs.readFileSync(targetFile, "utf8");
  const failures = [];

  console.log("[check-tenant-isolation] kritik fonksiyonlar");
  for (const rule of criticalRules) {
    const body = extractFunctionBody(source, rule.functionName);
    if (!body) {
      failures.push({ functionName: rule.functionName, reason: "Fonksiyon bulunamadı." });
      console.log(`- ${rule.functionName}: missing`);
      continue;
    }

    const checkResults = rule.checks.map((check) => check.test(body));
    const pass = checkResults.every(Boolean);

    const labels = rule.checks.map((check, idx) => `c${idx + 1}=${checkResults[idx] ? "ok" : "missing"}`).join(" ");
    console.log(`- ${rule.functionName}: ${labels}`);

    if (!pass) {
      failures.push({
        functionName: rule.functionName,
        reason: "Tenant izolasyon pattern'leri eksik.",
      });
    }
  }

  if (failures.length) {
    console.error("[check-tenant-isolation] hatali fonksiyonlar:");
    for (const failure of failures) {
      console.error(`  - ${failure.functionName}: ${failure.reason}`);
    }
    process.exit(1);
  }

  console.log("[check-tenant-isolation] tamamlandi.");
}

run();
