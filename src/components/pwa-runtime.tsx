"use client";

import { useEffect } from "react";

const OPS_CACHE_PREFIX = "ops-";
const RELOAD_MARKER_KEY = "cloudpos:pwa-controller-reload-at";
const RELOAD_MARKER_TTL_MS = 30_000;

async function clearOpsCaches() {
  if (!("caches" in window)) {
    return;
  }
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(OPS_CACHE_PREFIX)).map((key) => caches.delete(key)));
}

async function notifyServiceWorkersForCacheClear() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    registration.active?.postMessage({ type: "OPS_CLEAR_CACHES" });
    registration.waiting?.postMessage({ type: "OPS_CLEAR_CACHES" });
  }
}

export function PwaRuntime({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (!enabled) {
      void (async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations
              .filter((registration) => registration.active?.scriptURL.includes("/sw.js"))
              .map((registration) => registration.unregister()),
          );
        } catch {}
        try {
          await clearOpsCaches();
        } catch {}
      })();
      return;
    }

    let reloading = false;

    const shouldReloadForControllerChange = () => {
      try {
        const raw = window.sessionStorage.getItem(RELOAD_MARKER_KEY);
        const lastReloadAt = raw ? Number.parseInt(raw, 10) : 0;
        return !Number.isFinite(lastReloadAt) || Date.now() - lastReloadAt > RELOAD_MARKER_TTL_MS;
      } catch {
        return true;
      }
    };

    const markControllerReload = () => {
      try {
        window.sessionStorage.setItem(RELOAD_MARKER_KEY, Date.now().toString());
      } catch {}
    };

    const handleControllerChange = () => {
      if (reloading || !shouldReloadForControllerChange()) {
        return;
      }
      reloading = true;
      markControllerReload();
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "OPS_SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            installingWorker.postMessage({ type: "OPS_SKIP_WAITING" });
          }
        });
      });
    }).catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [enabled]);

  useEffect(() => {
    const handleClear = () => {
      void (async () => {
        try {
          await notifyServiceWorkersForCacheClear();
        } catch {}
        try {
          await clearOpsCaches();
        } catch {}
      })();
    };

    window.addEventListener("app-shell:sw-clear", handleClear);
    return () => window.removeEventListener("app-shell:sw-clear", handleClear);
  }, []);

  return null;
}
