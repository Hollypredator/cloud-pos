import fs from "node:fs";
import path from "node:path";

function fail(message) {
  throw new Error(`[phase8:pilot] ${message}`);
}

function ensureFile(relPath) {
  const absPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(absPath)) {
    fail(`dosya bulunamadi: ${relPath}`);
  }
  return fs.readFileSync(absPath, "utf8");
}

function run() {
  ensureFile("docs/phases/phase-7-staging-uat-and-pilot-prep.md");
  ensureFile("docs/staging-uat.md");
  ensureFile("docs/go-live-checklist.md");
  ensureFile("docs/backup-monitoring.md");
  ensureFile(".github/workflows/ops-monitoring.yml");

  const goLive = ensureFile("docs/go-live-checklist.md");
  const unchecked = goLive
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("- [ ]"));

  if (unchecked.length > 0) {
    fail(`go-live checklist acik maddeler var: ${unchecked.join(" | ")}`);
  }

  console.log("[phase8:pilot] ok");
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
