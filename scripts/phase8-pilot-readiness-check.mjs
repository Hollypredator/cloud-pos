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

  const goLive = ensureFile("docs/go-live-checklist.md");
  const unchecked = goLive
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("- [ ]"));

  const allowedManual = [
    "- [ ] Staging UAT tamamlandi ve imzali onay alindi.",
    "- [ ] Veritabani yedekleme politikasi production ortaminda aktif.",
    "- [ ] Uptime monitoru `/api/health` endpointine baglandi.",
    "- [ ] Alert dispatch cron gorevi production'da aktif edildi (`POST /api/alerts/dispatch` + `x-alert-secret`).",
  ];

  const unexpectedUnchecked = unchecked.filter((line) => !allowedManual.includes(line.trim()));
  if (unexpectedUnchecked.length > 0) {
    fail(`beklenmeyen acik checklist maddeleri var: ${unexpectedUnchecked.join(" | ")}`);
  }

  console.log("[phase8:pilot] ok");
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
