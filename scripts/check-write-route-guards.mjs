import fs from "node:fs";
import path from "node:path";

const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
const guardPatterns = [
  /requireRole\(/,
  /getCurrentUserWithRole\(/,
  /requirePlatformPermission\(/,
  /requireSupportRole\(/,
  /verifyQrAccessToken\(/,
  /getSyncActorContext\(/,
  /getTableByQr\(/,
  /checkSecret\(/,
];
const auditPatterns = [
  /logAuditEvent\(/,
  /writeSupportAuditLog\(/,
  /logApiEvent\(/,
  /recordCommandAttempt\(/,
  /setAlertDispatch\(/,
  /createOrder\(/,
  /createTableRequest\(/,
];
const publicWriteRoutes = new Set(["src/app/api/locale/route.ts", "src/app/api/qr/funnel/route.ts"]);
const noAuditRequiredRoutes = new Set([
  "src/app/api/branch/active/route.ts",
  "src/app/api/business/active/route.ts",
  "src/app/api/locale/route.ts",
  "src/app/api/station/active/route.ts",
]);

function walkRoutes(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRoutes(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      files.push(fullPath);
    }
  }
  return files;
}

function toRel(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function run() {
  const apiDir = path.join(process.cwd(), "src", "app", "api");
  if (!fs.existsSync(apiDir)) {
    throw new Error(`API klasoru bulunamadi: ${apiDir}`);
  }

  const routeFiles = walkRoutes(apiDir);
  const writeRoutes = [];
  for (const filePath of routeFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    const methods = writeMethods.filter((method) =>
      new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`).test(source),
    );
    if (!methods.length) {
      continue;
    }

    const relPath = toRel(filePath);
    const isPublicWriteRoute = publicWriteRoutes.has(relPath);
    const hasGuard = isPublicWriteRoute || guardPatterns.some((pattern) => pattern.test(source));
    const hasAuditHint = auditPatterns.some((pattern) => pattern.test(source));
    writeRoutes.push({
      file: relPath,
      methods,
      hasGuard,
      hasAuditHint,
      isPublicWriteRoute,
      noAuditRequired: noAuditRequiredRoutes.has(relPath),
    });
  }

  if (!writeRoutes.length) {
    console.log("[check-write-route-guards] write route bulunamadi.");
    return;
  }

  console.log("[check-write-route-guards] write route ozeti");
  for (const route of writeRoutes) {
    console.log(
      `- ${route.file} methods=${route.methods.join(",")} guard=${route.hasGuard ? "ok" : "missing"} audit_hint=${route.hasAuditHint ? "seen" : "not-seen"}${route.isPublicWriteRoute ? " public=yes" : ""}`,
    );
  }

  const missingGuard = writeRoutes.filter((route) => !route.hasGuard);
  if (missingGuard.length) {
    console.error("[check-write-route-guards] guard eksik endpointler bulundu:");
    for (const route of missingGuard) {
      console.error(`  - ${route.file}`);
    }
    process.exit(1);
  }

  const missingAuditHint = writeRoutes.filter((route) => !route.hasAuditHint && !route.noAuditRequired);
  if (missingAuditHint.length) {
    console.error("[check-write-route-guards] policy disi audit izi eksik endpointler:");
    for (const route of missingAuditHint) {
      console.error(`  - ${route.file}`);
    }
    process.exit(1);
  }

  console.log("[check-write-route-guards] tamamlandi.");
}

run();
