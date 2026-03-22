export type WebPerfProfileMode = "standard" | "ferrari_safe";
export type WebPerfRouteBucket = "critical" | "interactive" | "dashboard";

export type WebPerfProfile = {
  mode: WebPerfProfileMode;
  bucket: WebPerfRouteBucket;
  route: string;
  refreshDebounceMs: number;
  refreshMinIntervalMs: number;
  duplicateWindowMs: number;
  interactionGuardMs: number;
  bridgeDebounceMs: number;
  bridgeMinIntervalMs: number;
  connectionStateMinHoldMs: number;
};

function normalizePathname(pathname: string | null | undefined) {
  if (!pathname) {
    return "/";
  }
  const trimmed = pathname.trim();
  return trimmed || "/";
}

function readFlag(name: string, fallback: boolean) {
  const value = process.env[name] ?? process.env[`NEXT_PUBLIC_${name}`];
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function getRouteBucket(pathname: string): WebPerfRouteBucket {
  if (
    pathname === "/cashier" ||
    pathname.startsWith("/cashier/") ||
    pathname === "/kitchen" ||
    pathname.startsWith("/kitchen/")
  ) {
    return "critical";
  }

  if (
    pathname === "/tables" ||
    pathname.startsWith("/tables/") ||
    pathname === "/service-requests" ||
    pathname.startsWith("/service-requests/") ||
    pathname === "/delivery" ||
    pathname.startsWith("/delivery/")
  ) {
    return "interactive";
  }

  return "dashboard";
}

function isFerrariEnabled(pathname: string) {
  if (pathname === "/cashier" || pathname.startsWith("/cashier/")) {
    return readFlag("WEB_PERF_FERRARI_CASHIER", true);
  }
  if (pathname === "/kitchen" || pathname.startsWith("/kitchen/")) {
    return readFlag("WEB_PERF_FERRARI_KITCHEN", true);
  }
  if (pathname === "/ops" || pathname.startsWith("/ops/")) {
    return readFlag("WEB_PERF_FERRARI_OPS", false);
  }
  if (pathname === "/tables" || pathname.startsWith("/tables/")) {
    return readFlag("WEB_PERF_FERRARI_TABLES", false);
  }
  if (pathname === "/service-requests" || pathname.startsWith("/service-requests/")) {
    return readFlag("WEB_PERF_FERRARI_SERVICE", false);
  }
  if (pathname === "/delivery" || pathname.startsWith("/delivery/")) {
    return readFlag("WEB_PERF_FERRARI_DELIVERY", false);
  }
  return false;
}

function createStandardProfile(bucket: WebPerfRouteBucket, route: string): WebPerfProfile {
  if (bucket === "critical") {
    return {
      mode: "standard",
      bucket,
      route,
      refreshDebounceMs: 650,
      refreshMinIntervalMs: 3200,
      duplicateWindowMs: 1400,
      interactionGuardMs: 1800,
      bridgeDebounceMs: 300,
      bridgeMinIntervalMs: 1200,
      connectionStateMinHoldMs: 1200,
    };
  }

  if (bucket === "interactive") {
    return {
      mode: "standard",
      bucket,
      route,
      refreshDebounceMs: 750,
      refreshMinIntervalMs: 3600,
      duplicateWindowMs: 1500,
      interactionGuardMs: 1800,
      bridgeDebounceMs: 360,
      bridgeMinIntervalMs: 1400,
      connectionStateMinHoldMs: 1200,
    };
  }

  return {
    mode: "standard",
    bucket,
    route,
    refreshDebounceMs: 1100,
    refreshMinIntervalMs: 4500,
    duplicateWindowMs: 1800,
    interactionGuardMs: 1800,
    bridgeDebounceMs: 700,
    bridgeMinIntervalMs: 3500,
    connectionStateMinHoldMs: 1400,
  };
}

function createFerrariProfile(bucket: WebPerfRouteBucket, route: string): WebPerfProfile {
  if (bucket === "critical") {
    return {
      mode: "ferrari_safe",
      bucket,
      route,
      refreshDebounceMs: 550,
      refreshMinIntervalMs: 1300,
      duplicateWindowMs: 900,
      interactionGuardMs: 1200,
      bridgeDebounceMs: 180,
      bridgeMinIntervalMs: 420,
      connectionStateMinHoldMs: 1200,
    };
  }

  if (bucket === "interactive") {
    return {
      mode: "ferrari_safe",
      bucket,
      route,
      refreshDebounceMs: 850,
      refreshMinIntervalMs: 1700,
      duplicateWindowMs: 1200,
      interactionGuardMs: 1200,
      bridgeDebounceMs: 240,
      bridgeMinIntervalMs: 600,
      connectionStateMinHoldMs: 1200,
    };
  }

  return {
    mode: "ferrari_safe",
    bucket,
    route,
    refreshDebounceMs: 1200,
    refreshMinIntervalMs: 2500,
    duplicateWindowMs: 1700,
    interactionGuardMs: 1200,
    bridgeDebounceMs: 420,
    bridgeMinIntervalMs: 900,
    connectionStateMinHoldMs: 1500,
  };
}

export function getWebPerfProfile(pathname: string | null | undefined): WebPerfProfile {
  const route = normalizePathname(pathname);
  const bucket = getRouteBucket(route);
  const ferrariEnabled = isFerrariEnabled(route);
  return ferrariEnabled ? createFerrariProfile(bucket, route) : createStandardProfile(bucket, route);
}
