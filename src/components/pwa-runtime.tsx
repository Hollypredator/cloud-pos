"use client";

import { useEffect } from "react";

const OPS_CACHE_PREFIX = "ops-";

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

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
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
