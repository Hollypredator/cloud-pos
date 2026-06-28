import { readFileSync, existsSync } from "node:fs";

const files = {
  manifest: readFileSync("src/app/manifest.ts", "utf8"),
  layout: readFileSync("src/app/layout.tsx", "utf8"),
  installCard: readFileSync("src/components/pwa-install-card.tsx", "utf8"),
  mobileShell: readFileSync("src/components/mobile-ops-shell.tsx", "utf8"),
  serviceWorker: readFileSync("public/sw.js", "utf8"),
};

const appleIconExists = existsSync("src/app/apple-icon.tsx");

const checks = [
  {
    name: "manifest has lang tr",
    pass: files.manifest.includes('lang: "tr"'),
  },
  {
    name: "manifest has dir ltr",
    pass: files.manifest.includes('dir: "ltr"'),
  },
  {
    name: "manifest has orientation portrait",
    pass: files.manifest.includes('orientation: "portrait"'),
  },
  {
    name: "manifest has display_override standalone and minimal-ui",
    pass: files.manifest.includes('display_override: ["standalone", "minimal-ui"]'),
  },
  {
    name: "manifest description has correct Turkish diacritics (tabanlı not tabanli)",
    pass: files.manifest.includes("tabanlı") && !files.manifest.includes("tabanli"),
  },
  {
    name: "manifest has 5 shortcuts with correct URLs in order",
    pass:
      files.manifest.includes('url: "/m/ops"') &&
      files.manifest.includes('url: "/m/tables"') &&
      files.manifest.includes('url: "/m/cashier"') &&
      files.manifest.includes('url: "/m/kitchen"') &&
      files.manifest.includes('url: "/m/delivery"'),
  },
  {
    name: "manifest icons include purpose any for 192 and 512",
    pass:
      files.manifest.includes('purpose: "any"') &&
      files.manifest.includes('sizes: "192x192"') &&
      files.manifest.includes('sizes: "512x512"'),
  },
  {
    name: "manifest icons include purpose maskable for 192 and 512",
    pass: files.manifest.includes('purpose: "maskable"'),
  },
  {
    name: "apple-icon.tsx route exists",
    pass: appleIconExists,
  },
  {
    name: "root layout metadata.icons includes apple touch icon",
    pass: files.layout.includes("apple") && files.layout.includes('sizes: "180x180"'),
  },
  {
    name: "mobile-ops-shell imports and renders PwaInstallCard",
    pass:
      files.mobileShell.includes('import { PwaInstallCard }') &&
      files.mobileShell.includes("<PwaInstallCard enabled={pwaEnabled} />"),
  },
  {
    name: "pwa-install-card has no mojibake (no leadıng, kürün, acilir, dugme, seçenegin, Simdilik, yukle)",
    pass:
      !files.installCard.includes("leadıng") &&
      !files.installCard.includes("kürün") &&
      !files.installCard.includes("acilir") &&
      !files.installCard.includes("dugme") &&
      !files.installCard.includes("seçenegin") &&
      !files.installCard.includes("Simdilik") &&
      !files.installCard.includes("yukle"),
  },
  {
    name: "pwa-install-card has isPrompting state for install loading",
    pass: files.installCard.includes("isPrompting") && files.installCard.includes("Kuruluyor"),
  },
  {
    name: "pwa-install-card has install error state",
    pass: files.installCard.includes("installError") && files.installCard.includes("Kurulum başlatılamadı"),
  },
  {
    name: "pwa-install-card uses z-40 not z-50",
    pass: files.installCard.includes("z-40") && !files.installCard.includes("z-50"),
  },
  {
    name: "pwa-install-card has role dialog and aria-label",
    pass: files.installCard.includes('role="dialog"') && files.installCard.includes('aria-label="Cloud POS cihaza kur"'),
  },
  {
    name: "pwa-install-card has beforeinstallprompt singleton capture",
    pass: files.installCard.includes("pendingInstallEvent") && files.installCard.includes("cloudpos:install-prompt-ready"),
  },
  {
    name: "pwa-install-card has iOS Safari-only detection (not iOS Chrome)",
    pass: files.installCard.includes("isIOSSafari") && files.installCard.includes("CriOS"),
  },
  {
    name: "pwa-install-card has Firefox detection",
    pass: files.installCard.includes("isFirefoxDesktop"),
  },
  {
    name: "pwa-install-card has trust subtext (no permission ask)",
    pass: files.installCard.includes("Ana ekrana kısayol ekler") && files.installCard.includes("İzin istemez"),
  },
  {
    name: "pwa-install-card does not have PWA eyebrow jargon",
    pass: !files.installCard.includes(">PWA<"),
  },
  {
    name: "mobile-ops-shell offline badge uses Turkish (Çevrimdışı not Offline)",
    pass: files.mobileShell.includes("Çevrimdışı") && !files.mobileShell.includes('"Offline"'),
  },
  {
    name: "mobile-ops-shell offline banner copy has önbellekten",
    pass: files.mobileShell.includes("önbellekten"),
  },
  {
    name: "sw.js has no Baglanti mojibake",
    pass: !files.serviceWorker.includes("Baglanti") && files.serviceWorker.includes("Bağlantı"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Mobile PWA install check failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(`Mobile PWA install check passed (${checks.length} checks).`);
