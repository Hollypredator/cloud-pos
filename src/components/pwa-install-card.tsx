"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "cloudpos:pwa-install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function readDismissState() {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      return false;
    }
    const timestamp = Number.parseInt(raw, 10);
    if (!Number.isFinite(timestamp)) {
      return false;
    }
    return Date.now() - timestamp < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function writeDismissState() {
  try {
    window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
  } catch {}
}

function isStandaloneMode(media?: MediaQueryList) {
  const displayModeMedia = media ?? window.matchMedia("(display-mode: standalone)");
  const iosStandalone =
    typeof window.navigator !== "undefined" &&
    typeof (window.navigator as Navigator & { standalone?: boolean }).standalone === "boolean" &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return displayModeMedia.matches || iosStandalone;
}

function isIOSDevice() {
  const userAgent = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(userAgent));
}

export function PwaInstallCard({ enabled }: { enabled: boolean }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => (typeof window === "undefined" ? false : isStandaloneMode()));
  const [dismissed, setDismissed] = useState(() => (typeof window === "undefined" ? false : readDismissState()));
  const [isIOS, setIsIOS] = useState(false);
  const canPrompt = Boolean(installEvent);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const media = window.matchMedia("(display-mode: standalone)");
    const applyInstalled = () => setInstalled(isStandaloneMode(media));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    setIsIOS(isIOSDevice());
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    media.addEventListener("change", applyInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      media.removeEventListener("change", applyInstalled);
    };
  }, [enabled]);

  const visible = useMemo(() => enabled && !installed && !dismissed, [dismissed, enabled, installed]);
  if (!visible) {
    return null;
  }

  async function handleInstall() {
    if (!installEvent) {
      return;
    }

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
    } catch {}
    setInstallEvent(null);
  }

  function handleDismiss() {
    setDismissed(true);
    writeDismissState();
  }

  return (
    <aside className="no-print fixed inset-x-3 bottom-[calc(84px+var(--safe-area-bottom))] z-50 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.18)] backdrop-blur md:inset-x-auto md:bottom-4 md:right-4 md:max-w-[340px]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">PWA</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">Cloud POS'u cihaza kürün</p>
      <p className="mt-1 text-xs leadıng-5 text-slate-600">
        Kurulumdan sonra POS ayri pencere olarak acilir, ana ekran kısa yolu eklenir ve operasyon ekranlari cache ile daha kararli yüklenir.
      </p>

      {canPrompt ? (
        <button
          type="button"
          onClick={() => {
            void handleInstall();
          }}
          className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
        >
          Cihaza Kur
        </button>
      ) : isIOS ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leadıng-5 text-slate-700">
          Safari'de Paylas dugmesine basin, sonra <strong>Ana Ekrana Ekle</strong> seçenegini kullanin.
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leadıng-5 text-slate-700">
          Tarayici menüsünden <strong>Uygulama olarak yukle</strong> seçenegini kullanabilirsiniz.
        </div>
      )}

      <button
        type="button"
        onClick={handleDismiss}
        className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
      >
        Simdilik kapat
      </button>
    </aside>
  );
}
