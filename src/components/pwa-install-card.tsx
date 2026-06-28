"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "cloudpos:pwa-install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7;

let pendingInstallEvent: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    pendingInstallEvent = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent("cloudpos:install-prompt-ready"));
  });
}

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

function isIOSSafari() {
  const userAgent = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(userAgent));
  const isSafari = /Safari/.test(userAgent);
  const isNotChromeIOS = !/CriOS/.test(userAgent);
  const isNotFirefoxIOS = !/FxiOS/.test(userAgent);
  return isIOS && isSafari && isNotChromeIOS && isNotFirefoxIOS;
}

function isIOSDevice() {
  const userAgent = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(userAgent));
}

function isFirefoxDesktop() {
  const userAgent = navigator.userAgent || "";
  return /Firefox\//.test(userAgent) && !/Mobile|Android/.test(userAgent);
}

export function PwaInstallCard({ enabled }: { enabled: boolean }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(pendingInstallEvent);
  const [isPrompting, setIsPrompting] = useState(false);
  const [installError, setInstallError] = useState(false);
  const [installed, setInstalled] = useState(() => (typeof window === "undefined" ? false : isStandaloneMode()));
  const [dismissed, setDismissed] = useState(() => (typeof window === "undefined" ? false : readDismissState()));
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSSafariState, setIsIOSSafariState] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);
  const canPrompt = Boolean(installEvent);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const media = window.matchMedia("(display-mode: standalone)");
    const applyInstalled = () => setInstalled(isStandaloneMode(media));

    const handlePromptReady = () => {
      setInstallEvent(pendingInstallEvent);
      setInstallError(false);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      pendingInstallEvent = null;
    };

    setIsIOS(isIOSDevice());
    setIsIOSSafariState(isIOSSafari());
    setIsFirefox(isFirefoxDesktop());
    window.addEventListener("cloudpos:install-prompt-ready", handlePromptReady);
    window.addEventListener("appinstalled", handleInstalled);
    media.addEventListener("change", applyInstalled);

    return () => {
      window.removeEventListener("cloudpos:install-prompt-ready", handlePromptReady);
      window.removeEventListener("appinstalled", handleInstalled);
      media.removeEventListener("change", applyInstalled);
    };
  }, [enabled]);

  const visible = useMemo(() => enabled && !installed && !dismissed, [dismissed, enabled, installed]);
  if (!visible) {
    return null;
  }

  async function handleInstall() {
    if (!installEvent || isPrompting) {
      return;
    }

    setIsPrompting(true);
    setInstallError(false);

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        pendingInstallEvent = null;
        setInstallEvent(null);
      }
    } catch {
      setInstallError(true);
    } finally {
      setIsPrompting(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    writeDismissState();
  }

  const showIOSHelp = isIOS && !canPrompt;
  const showFirefoxHelp = isFirefox && !canPrompt;
  const showGenericHelp = !canPrompt && !isIOS && !isFirefox;

  return (
    <aside
      role="dialog"
      aria-label="Cloud POS cihaza kur"
      aria-live="polite"
      className="no-print fixed inset-x-3 bottom-[calc(84px+var(--safe-area-bottom))] z-40 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.18)] backdrop-blur md:inset-x-auto md:bottom-4 md:right-4 md:max-w-[340px]"
    >
      <p className="text-sm font-semibold text-slate-900">Cloud POS&apos;u cihaza kurun</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        Ana ekrandan app gibi açılır, internet kesilse bile çalışır.
      </p>

      {installError ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          Kurulum başlatılamadı. Tarayıcıyı yeniden başlatıp tekrar deneyin.
        </div>
      ) : null}

      {canPrompt ? (
        <button
          type="button"
          onClick={() => {
            void handleInstall();
          }}
          disabled={isPrompting}
          aria-label="Cihaza kur"
          className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          <Download aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
          {isPrompting ? "Kuruluyor..." : "Cihaza Kur"}
        </button>
      ) : showIOSHelp ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
          {isIOSSafariState ? (
            <ol className="list-decimal space-y-1 pl-4">
              <li className="flex items-center gap-1.5">
                <Share aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                Safari paylaş düğmesine basın
              </li>
              <li>
                <strong>Ana Ekrana Ekle</strong> seçeneğini seçin
              </li>
            </ol>
          ) : (
            <p>
              Safari&apos;i açın, Paylaş düğmesine basın, sonra <strong>Ana Ekrana Ekle</strong> seçeneğini kullanın.
            </p>
          )}
        </div>
      ) : showFirefoxHelp ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
          Firefox&apos;ta adres çubuğundaki kur simgesini kullanın.
        </div>
      ) : showGenericHelp ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
          Tarayıcı menüsünden <strong>Uygulama olarak yükle</strong> seçeneğini kullanabilirsiniz.
        </div>
      ) : null}

      {canPrompt ? (
        <p className="mt-2 text-center text-[11px] leading-4 text-slate-500">
          Ana ekrana kısayol ekler. İzin istemez.
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Şimdilik kapat"
        className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
        Şimdilik kapat
      </button>
    </aside>
  );
}
