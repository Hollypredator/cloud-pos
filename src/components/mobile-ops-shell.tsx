"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { PwaRuntime } from "@/components/pwa-runtime";
import { hasFeature, type FeatureKey } from "@/lib/features";
import type { AppShellPayload } from "@/lib/app-shell";
import type { AppRole } from "@/lib/types";

type MobileAction = {
  href: string;
  label: string;
  icon: string;
  roles: AppRole[];
  group: "order" | "ops" | "management";
  feature?: FeatureKey;
};

function resolveMobileActions(activeBusinessType: AppShellPayload["activeBusinessType"]): MobileAction[] {
  if (activeBusinessType === "self_service_coffee") {
    return [
      { href: "/m/tables?flow=new-order", label: "Siparis Ac", icon: "SP", roles: ["owner", "admin", "cashier", "waiter"], group: "order" },
      { href: "/m/cashier", label: "Siparis Yonetimi", icon: "SY", roles: ["admin", "cashier", "waiter"], group: "order" },
      { href: "/m/kitchen", label: "Mutfak", icon: "MK", roles: ["admin", "kitchen"], group: "ops", feature: "kitchen_display" },
      { href: "/cashier/session", label: "Gun Islemleri", icon: "GI", roles: ["admin", "cashier"], group: "management" },
    ];
  }

  return [
    { href: "/m/tables", label: "Masa Akisi", icon: "MS", roles: ["admin", "cashier"], group: "order" },
    { href: "/m/tables?flow=new-order", label: "Siparis Ac", icon: "SP", roles: ["owner", "admin", "cashier"], group: "order" },
    { href: "/m/cashier", label: "Adisyon", icon: "AD", roles: ["admin", "cashier", "waiter"], group: "order" },
    { href: "/m/kitchen", label: "Mutfak", icon: "MK", roles: ["admin", "kitchen"], group: "ops", feature: "kitchen_display" },
    { href: "/m/delivery", label: "Teslimat", icon: "DL", roles: ["admin", "cashier"], group: "ops", feature: "delivery_dispatch" },
    { href: "/m/service-requests", label: "Talepler", icon: "TR", roles: ["admin", "cashier"], group: "ops" },
    { href: "/cashier/session", label: "Gun Islemleri", icon: "GI", roles: ["admin", "cashier"], group: "management" },
    { href: "/admin/tables", label: "Masa Yonetimi", icon: "MY", roles: ["owner", "admin"], group: "management" },
  ];
}

function resolveMobileTitle(pathname: string | null, activeBusinessType: AppShellPayload["activeBusinessType"]) {
  if (!pathname) return "Operasyon";
  if (pathname === "/m/ops" || pathname.startsWith("/m/ops/")) return "Operasyon";
  if (pathname === "/m/tables" || pathname.startsWith("/m/tables/")) return "Masa Takip";
  if (pathname === "/m/cashier" || pathname.startsWith("/m/cashier/")) {
    return activeBusinessType === "self_service_coffee" ? "Siparis Yonetimi" : "Adisyon";
  }
  if (pathname === "/m/kitchen" || pathname.startsWith("/m/kitchen/")) return "Mutfak";
  if (pathname === "/m/delivery" || pathname.startsWith("/m/delivery/")) return "Teslimat";
  if (pathname === "/m/service-requests" || pathname.startsWith("/m/service-requests/")) return "Masa Talepleri";
  return "Operasyon";
}

function canAccessAction(role: AppRole | null, usingDemoData: boolean, allowedRoles: AppRole[]) {
  return usingDemoData || (!!role && (allowedRoles.includes(role) || (role === "owner" && allowedRoles.includes("admin"))));
}

function isFeatureEnabled(
  currentPlan: AppShellPayload["currentPlan"],
  effectiveCapabilities: AppShellPayload["effectiveCapabilities"] | undefined,
  feature?: FeatureKey,
) {
  if (!feature) {
    return true;
  }
  if (typeof effectiveCapabilities?.[feature] === "boolean") {
    return Boolean(effectiveCapabilities[feature]);
  }
  return hasFeature(currentPlan, feature);
}

function actionGroupLabel(group: MobileAction["group"]) {
  if (group === "order") return "Sipariş ve Kasa";
  if (group === "ops") return "Servis ve Dagitim";
  return "Yönetim";
}

function buildQueryString(searchParams: ReturnType<typeof useSearchParams>) {
  const query = searchParams?.toString() ?? "";
  return query ? `?${query}` : "";
}

function resolveLargeScreenHref(pathname: string | null, searchParams: ReturnType<typeof useSearchParams>) {
  if (!pathname) return "/ops";

  if (pathname === "/m/ops" || pathname.startsWith("/m/ops/")) {
    return "/ops";
  }
  if (pathname === "/m/tables" || pathname.startsWith("/m/tables/")) {
    const flow = searchParams?.get("flow");
    const tableId = searchParams?.get("tableId")?.trim();
    if (flow === "new-order") {
      return tableId ? `/admin/orders?table=${encodeURIComponent(tableId)}` : "/admin/orders";
    }
    return `/tables${buildQueryString(searchParams)}`;
  }
  if (pathname === "/m/cashier" || pathname.startsWith("/m/cashier/")) {
    return `/cashier${buildQueryString(searchParams)}`;
  }
  if (pathname === "/m/kitchen" || pathname.startsWith("/m/kitchen/")) {
    return `/kitchen${buildQueryString(searchParams)}`;
  }
  if (pathname === "/m/delivery" || pathname.startsWith("/m/delivery/")) {
    return `/delivery${buildQueryString(searchParams)}`;
  }
  if (pathname === "/m/service-requests" || pathname.startsWith("/m/service-requests/")) {
    return `/service-requests${buildQueryString(searchParams)}`;
  }
  return "/ops";
}

export function MobileOpsShell({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData: AppShellPayload | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shellData, setShellData] = useState<AppShellPayload | null>(initialData);
  const [isOffline, setIsOffline] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);

  const activeBusinessType = shellData?.activeBusinessType ?? "restaurant_cafe";
  const mobileTitle = resolveMobileTitle(pathname, activeBusinessType);
  const pwaEnabled = Boolean(shellData?.mobileReadOnlyPwaEnabled);
  const role = shellData?.role ?? null;
  const usingDemoData = Boolean(shellData?.usingDemoData);
  const currentPlan = shellData?.currentPlan ?? "growth";

  const loadShellData = useEffectEvent(async () => {
    try {
      const response = await fetch("/api/app-shell", { method: "GET", credentials: "same-origin" });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as AppShellPayload;
      setShellData(data);
    } catch {}
  });

  const groupedActions = useMemo(() => {
    const sourceActions = resolveMobileActions(activeBusinessType);
    const actions = sourceActions.filter(
      (action) =>
        canAccessAction(role, usingDemoData, action.roles) &&
        isFeatureEnabled(currentPlan, shellData?.effectiveCapabilities, action.feature),
    );

    return ["order", "ops", "management"].map((groupKey) => {
      const group = groupKey as MobileAction["group"];
      return {
        key: group,
        title: group === "order" && activeBusinessType === "self_service_coffee" ? "Siparis Yonetimi" : actionGroupLabel(group),
        actions: actions.filter((item) => item.group === group),
      };
    });
  }, [activeBusinessType, currentPlan, role, shellData?.effectiveCapabilities, usingDemoData]);

  useEffect(() => {
    if (!shellData) {
      void loadShellData();
    }
  }, [shellData]);

  useEffect(() => {
    const apply = () => setIsOffline(!navigator.onLine);
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, []);

  useEffect(() => {
    if (!pwaEnabled || !isOffline) {
      return;
    }

    const handleSubmit = (event: Event) => {
      if (!(event.target instanceof HTMLFormElement)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, [isOffline, pwaEnabled]);

  useEffect(() => {
    const media = window.matchMedia("(hover: none) and (pointer: coarse)");
    const apply = () => setIsCoarsePointer(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const apply = () => setIsNarrowViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const shouldStayInMobileApp = isCoarsePointer || isNarrowViewport;
    if (shouldStayInMobileApp) {
      return;
    }
    const largeScreenHref = resolveLargeScreenHref(pathname, searchParams);
    router.replace(largeScreenHref);
  }, [isCoarsePointer, isNarrowViewport, pathname, router, searchParams]);

  return (
    <>
      <PwaRuntime enabled={pwaEnabled} />
      <div
        className={`m-ops-shell mobile-app-mode min-h-screen overflow-x-clip ${isOffline ? "offline-mode" : ""} ${
          isOffline && pwaEnabled ? "offline-read-only" : ""
        }`}
      >
        <header className="no-print fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[980px] items-center justify-between gap-3 px-3 pb-2 pt-[calc(var(--safe-area-top)+8px)]">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {shellData?.brandName ?? "Cloud POS"}
              </p>
              <p className="truncate text-[1.1rem] font-semibold text-slate-950">{mobileTitle}</p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                isOffline ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isOffline ? "Offline" : "Canli"}
            </span>
          </div>
          {isOffline ? (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
              Baglanti gerekli. Offline modda yalnızca okunabilir kullanım açık.
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-[980px] px-3 pb-[calc(104px+var(--safe-area-bottom))] pt-[calc(74px+var(--safe-area-top))]">
          {children}
        </main>

        <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 backdrop-blur">
          <div className="mx-auto grid w-full max-w-[980px] grid-cols-[1fr_auto] gap-2 px-3 pb-[calc(var(--safe-area-bottom)+8px)] pt-2">
            <Link
              href="/m/ops"
              scroll={false}
              className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={() => setActionsOpen((prev) => !prev)}
              className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800"
            >
              Actions
            </button>
          </div>
        </nav>

        {actionsOpen ? (
          <div className="no-print fixed inset-0 z-50 bg-slate-950/45" onClick={() => setActionsOpen(false)}>
            <div
              className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[28px] border-t border-slate-200 bg-white px-4 pb-[calc(var(--safe-area-bottom)+16px)] pt-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto w-full max-w-[980px] space-y-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Hızlı Is Akışları</p>
                  <button
                    type="button"
                    onClick={() => setActionsOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Kapat
                  </button>
                </div>

                {groupedActions
                  .filter((group) => group.actions.length > 0)
                  .map((group) => (
                    <section key={group.key} className="rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.title}</p>
                      <div className="mt-2 grid gap-2">
                        {group.actions.map((action) => (
                          <Link
                            key={action.href}
                            href={action.href}
                            scroll={false}
                            onClick={() => setActionsOpen(false)}
                            className="flex min-h-[54px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
                          >
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white">
                              {action.icon}
                            </span>
                            <span>{action.label}</span>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/m/ops"
                    scroll={false}
                    onClick={() => setActionsOpen(false)}
                    className="inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
                  >
                    Home
                  </Link>
                  {shellData?.hasUser ? (
                    <div className="flex justify-center">
                      <LogoutButton redirectPath="/login" />
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Giriş
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
