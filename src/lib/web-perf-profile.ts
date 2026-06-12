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
    pathname === "/m/cashier" ||
    pathname.startsWith("/m/cashier/") ||
    pathname === "/kitchen" ||
    pathname.startsWith("/kitchen/") ||
    pathname === "/m/kitchen" ||
    pathname.startsWith("/m/kitchen/") ||
    pathname === "/admin/orders" ||
    pathname.startsWith("/admin/orders/")
  ) {
    return "critical";
  }

  if (
    pathname === "/tables" ||
    pathname.startsWith("/tables/") ||
    pathname === "/m/tables" ||
    pathname.startsWith("/m/tables/") ||
    pathname === "/service-requests" ||
    pathname.startsWith("/service-requests/") ||
    pathname === "/m/service-requests" ||
    pathname.startsWith("/m/service-requests/") ||
    pathname === "/delivery" ||
    pathname.startsWith("/delivery/") ||
    pathname === "/m/delivery" ||
    pathname.startsWith("/m/delivery/")
  ) {
    return "interactive";
  }

  return "dashboard";
}

function isFerrariEnabled(pathname: string) {
  if (pathname === "/cashier" || pathname.startsWith("/cashier/") || pathname === "/m/cashier" || pathname.startsWith("/m/cashier/")) {
    return readFlag("WEB_PERF_FERRARI_CASHIER", true);
  }
  if (pathname === "/kitchen" || pathname.startsWith("/kitchen/") || pathname === "/m/kitchen" || pathname.startsWith("/m/kitchen/")) {
    return readFlag("WEB_PERF_FERRARI_KITCHEN", true);
  }
  if (pathname === "/admin/orders" || pathname.startsWith("/admin/orders/")) {
    return true;
  }
  if (pathname === "/ops" || pathname.startsWith("/ops/")) {
    return readFlag("WEB_PERF_FERRARI_OPS", false);
  }
  if (pathname === "/tables" || pathname.startsWith("/tables/") || pathname === "/m/tables" || pathname.startsWith("/m/tables/")) {
    return readFlag("WEB_PERF_FERRARI_TABLES", true);
  }
  if (
    pathname === "/service-requests" ||
    pathname.startsWith("/service-requests/") ||
    pathname === "/m/service-requests" ||
    pathname.startsWith("/m/service-requests/")
  ) {
    return readFlag("WEB_PERF_FERRARI_SERVICE", true);
  }
  if (pathname === "/delivery" || pathname.startsWith("/delivery/") || pathname === "/m/delivery" || pathname.startsWith("/m/delivery/")) {
    return readFlag("WEB_PERF_FERRARI_DELIVERY", true);
  }
  return false;
}

function createStandardProfile(bucket: WebPerfRouteBucket, route: string): WebPerfProfile {
  if (bucket === "critical") {
    return {
      mode: "standard",
      bucket,
      route,
      refreshDebounceMs: 720,
      refreshMinIntervalMs: 3600,
      duplicateWindowMs: 1400,
      interactionGuardMs: 2400,
      bridgeDebounceMs: 360,
      bridgeMinIntervalMs: 1450,
      connectionStateMinHoldMs: 1200,
    };
  }

  if (bucket === "interactive") {
    return {
      mode: "standard",
      bucket,
      route,
      refreshDebounceMs: 900,
      refreshMinIntervalMs: 4200,
      duplicateWindowMs: 1500,
      interactionGuardMs: 2400,
      bridgeDebounceMs: 460,
      bridgeMinIntervalMs: 1800,
      connectionStateMinHoldMs: 1200,
    };
  }

  return {
    mode: "standard",
    bucket,
    route,
    refreshDebounceMs: 1400,
    refreshMinIntervalMs: 6500,
    duplicateWindowMs: 2200,
    interactionGuardMs: 2600,
    bridgeDebounceMs: 900,
    bridgeMinIntervalMs: 5200,
    connectionStateMinHoldMs: 1400,
  };
}

function createFerrariProfile(bucket: WebPerfRouteBucket, route: string): WebPerfProfile {
  if (bucket === "critical") {
    return {
      mode: "ferrari_safe",
      bucket,
      route,
      refreshDebounceMs: 520,
      refreshMinIntervalMs: 1500,
      duplicateWindowMs: 1000,
      interactionGuardMs: 1700,
      bridgeDebounceMs: 220,
      bridgeMinIntervalMs: 560,
      connectionStateMinHoldMs: 1200,
    };
  }

  if (bucket === "interactive") {
    return {
      mode: "ferrari_safe",
      bucket,
      route,
      refreshDebounceMs: 920,
      refreshMinIntervalMs: 2200,
      duplicateWindowMs: 1400,
      interactionGuardMs: 1800,
      bridgeDebounceMs: 320,
      bridgeMinIntervalMs: 850,
      connectionStateMinHoldMs: 1200,
    };
  }

  return {
    mode: "ferrari_safe",
    bucket,
    route,
    refreshDebounceMs: 1500,
    refreshMinIntervalMs: 4200,
    duplicateWindowMs: 2200,
    interactionGuardMs: 2200,
    bridgeDebounceMs: 640,
    bridgeMinIntervalMs: 2200,
    connectionStateMinHoldMs: 1500,
  };
}

export function getWebPerfProfile(pathname: string | null | undefined): WebPerfProfile {
  const route = normalizePathname(pathname);
  const bucket = getRouteBucket(route);
  const ferrariEnabled = isFerrariEnabled(route);
  return ferrariEnabled ? createFerrariProfile(bucket, route) : createStandardProfile(bucket, route);
}
