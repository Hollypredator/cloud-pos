import { readFileSync } from "node:fs";

const files = {
  login: readFileSync("src/app/login/page.tsx", "utf8"),
  mobileShell: readFileSync("src/components/mobile-ops-shell.tsx", "utf8"),
  cashier: readFileSync("src/app/cashier/page.tsx", "utf8"),
  cashierSession: readFileSync("src/app/cashier/session/page.tsx", "utf8"),
  middleware: readFileSync("middleware.ts", "utf8"),
  mobileLayout: readFileSync("src/app/m/layout.tsx", "utf8"),
  serviceWorker: readFileSync("public/sw.js", "utf8"),
};

const checks = [
  {
    name: "authenticated login redirects to the resolved mobile-aware next path",
    pass: files.login.includes("redirect(resolvedNext);") && !files.login.includes('redirect("/ops");'),
  },
  {
    name: "mobile shell does not link directly to desktop cashier session",
    pass: !files.mobileShell.includes('href: "/cashier/session"') && files.mobileShell.includes('href: "/m/cashier/session"'),
  },
  {
    name: "mobile shell does not link directly to desktop admin table management",
    pass: !files.mobileShell.includes('href: "/admin/tables"'),
  },
  {
    name: "cashier page resolves mobile cashier hrefs for mobile markup",
    pass:
      files.cashier.includes("const cashierPath = renderMobileMarkup ? \"/m/cashier\" : \"/cashier\";") &&
      files.cashier.includes("const cashierSessionPath = renderMobileMarkup ? \"/m/cashier/session\" : \"/cashier/session\";"),
  },
  {
    name: "cashier session accepts a sanitized mobile return path",
    pass:
      files.cashierSession.includes("function resolveCashierSessionReturnPath") &&
      files.cashierSession.includes('returnPath === "/m/cashier/session"'),
  },
  {
    name: "mobile protected routes redirect unauthenticated users before page rendering",
    pass:
      files.mobileLayout.includes("<MobileAuthRedirect />") &&
      files.mobileLayout.includes("!hasAuthCookie && isServiceRoleConfigured()"),
  },
  {
    name: "ops service worker cache is versioned for mobile shell changes",
    pass:
      files.serviceWorker.includes('const OPS_CACHE_VERSION = "v9";') &&
      files.serviceWorker.includes("cleanupOldOpsCaches()") &&
      files.serviceWorker.includes("OPS_SKIP_WAITING"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Mobile PWA route hardening check failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(`Mobile PWA route hardening check passed (${checks.length} checks).`);
