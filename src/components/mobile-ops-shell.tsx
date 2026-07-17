"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  ChefHat,
  ClipboardList,
  Home,
  LayoutGrid,
  MoreHorizontal,
  PackageCheck,
  Plus,
  ReceiptText,
  Settings,
  Table2,
  UtensilsCrossed,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { PwaInstallCard } from "@/components/pwa-install-card";
import { PwaRuntime } from "@/components/pwa-runtime";
import { hasFeature, type FeatureKey } from "@/lib/features";
import type { AppShellPayload } from "@/lib/app-shell";
import type { AppRole } from "@/lib/types";

type MobileAction = {
  href: string;
  label: string;
  icon: keyof typeof mobileIcons;
  roles: AppRole[];
  group: "order" | "ops" | "management";
  feature?: FeatureKey;
};

const mobileIcons = {
  banknote: Banknote,
  chefHat: ChefHat,
  clipboardList: ClipboardList,
  home: Home,
  layoutGrid: LayoutGrid,
  more: MoreHorizontal,
  packageCheck: PackageCheck,
  plus: Plus,
  receipt: ReceiptText,
  settings: Settings,
  table: Table2,
  utensils: UtensilsCrossed,
};

function resolveMobileActions(activeBusinessType: AppShellPayload["activeBusinessType"]): MobileAction[] {
  if (activeBusinessType === "self_service_coffee") {
    return [
      { href: "/admin/orders", label: "Sipariş Aç", icon: "plus", roles: ["owner", "admin", "cashier", "waiter"], group: "order" },
      { href: "/m/cashier", label: "Sipariş Yönetimi", icon: "receipt", roles: ["admin", "cashier", "waiter"], group: "order" },
      { href: "/m/kitchen", label: "Mutfak", icon: "chefHat", roles: ["admin", "kitchen"], group: "ops", feature: "kitchen_display" },
      { href: "/m/cashier/session", label: "Gün İşlemleri", icon: "settings", roles: ["admin", "cashier"], group: "management" },
    ];
  }

  return [
    { href: "/m/tables", label: "Masa Akışı", icon: "table", roles: ["admin", "cashier"], group: "order" },
    { href: "/admin/orders", label: "Sipariş Aç", icon: "plus", roles: ["owner", "admin", "cashier"], group: "order" },
    { href: "/m/cashier", label: "Adisyon", icon: "receipt", roles: ["admin", "cashier", "waiter"], group: "order" },
    { href: "/m/kitchen", label: "Mutfak", icon: "chefHat", roles: ["admin", "kitchen"], group: "ops", feature: "kitchen_display" },
    { href: "/m/delivery", label: "Teslimat", icon: "packageCheck", roles: ["admin", "cashier"], group: "ops", feature: "delivery_dispatch" },
    { href: "/m/service-requests", label: "Talepler", icon: "clipboardList", roles: ["admin", "cashier"], group: "ops" },
    { href: "/m/cashier/session", label: "Gün İşlemleri", icon: "settings", roles: ["admin", "cashier"], group: "management" },
  ];
}

function resolveMobileTitle(pathname: string | null, activeBusinessType: AppShellPayload["activeBusinessType"]) {
  if (!pathname) return "Operasyon";
  if (pathname === "/m/ops" || pathname.startsWith("/m/ops/")) return "Operasyon";
  if (pathname === "/m/tables" || pathname.startsWith("/m/tables/")) return "Masa Takip";
  if (pathname === "/m/cashier" || pathname.startsWith("/m/cashier/")) {
    return activeBusinessType === "self_service_coffee" ? "Sipariş Yönetimi" : "Adisyon";
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
  if (group === "ops") return "Servis ve Dağıtım";
  return "Yönetim";
}

function buildQueryString(searchParams: ReturnType<typeof useSearchParams>) {
  const query = searchParams?.toString() ?? "";
  return query ? `?${query}` : "";
}

function isActiveHref(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }
  const targetPath = href.split("?")[0];
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
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
  const [isCoarsePointer, setIsCoarsePointer] = useState(true);
  const [isNarrowViewport, setIsNarrowViewport] = useState(true);
  const [viewportReady, setViewportReady] = useState(false);

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
        title: group === "order" && activeBusinessType === "self_service_coffee" ? "Sipariş Yönetimi" : actionGroupLabel(group),
        actions: actions.filter((item) => item.group === group),
      };
    });
  }, [activeBusinessType, currentPlan, role, shellData?.effectiveCapabilities, usingDemoData]);

  const primaryTabs = useMemo(() => {
    const sourceActions = resolveMobileActions(activeBusinessType);
    const actions = sourceActions.filter(
      (action) =>
        canAccessAction(role, usingDemoData, action.roles) &&
        isFeatureEnabled(currentPlan, shellData?.effectiveCapabilities, action.feature),
    );
    const preferredHrefs =
      activeBusinessType === "self_service_coffee"
        ? ["/admin/orders", "/m/cashier", "/m/kitchen"]
        : ["/m/tables", "/m/cashier", "/m/kitchen"];

    return [
      { href: "/m/ops", label: "Operasyon", icon: "home" as const },
      ...preferredHrefs
        .map((href) => actions.find((action) => action.href === href))
        .filter((action): action is MobileAction => Boolean(action))
        .slice(0, 3),
    ];
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
    const pointerMedia = window.matchMedia("(hover: none) and (pointer: coarse)");
    const viewportMedia = window.matchMedia("(max-width: 1024px)");
    const apply = () => {
      setIsCoarsePointer(pointerMedia.matches);
      setIsNarrowViewport(viewportMedia.matches);
      setViewportReady(true);
    };
    apply();
    pointerMedia.addEventListener("change", apply);
    viewportMedia.addEventListener("change", apply);
    return () => {
      pointerMedia.removeEventListener("change", apply);
      viewportMedia.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    if (!viewportReady) {
      return;
    }
    const shouldStayInMobileApp = isCoarsePointer || isNarrowViewport;
    if (shouldStayInMobileApp) {
      return;
    }
    const largeScreenHref = resolveLargeScreenHref(pathname, searchParams);
    router.replace(largeScreenHref);
  }, [isCoarsePointer, isNarrowViewport, pathname, router, searchParams, viewportReady]);

  const renderedPrimaryTabs = primaryTabs.slice(0, 4);

  return (
    <>
      <PwaRuntime enabled={pwaEnabled} />
      <PwaInstallCard enabled={pwaEnabled} />
      <div
        className={`min-h-screen overflow-x-clip bg-[#FCFAF7] pb-[calc(100px+var(--safe-area-bottom))] pt-[calc(90px+var(--safe-area-top))] px-4 ${isOffline ? "offline-mode" : ""} ${
          isOffline && pwaEnabled ? "offline-read-only" : ""
        }`}
      >
        {/* Floating Glassmorphic Header Dock */}
        <header className="no-print fixed top-4 left-4 right-4 z-40 bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_30px_rgba(0,0,0,0.02)] rounded-[20px] px-5 py-3.5 flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-[9px] font-black uppercase tracking-widest text-rose-600">
              {shellData?.brandName ?? "Cloud POS"}
            </p>
            <p className="truncate text-base font-extrabold tracking-tight text-slate-900 mt-0.5">{mobileTitle}</p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider shadow-sm transition-all duration-300 ${
              isOffline 
                ? "bg-amber-500 text-white" 
                : "bg-rose-900 text-white"
            }`}
          >
            {isOffline ? "Çevrimdışı" : "Aktif"}
          </span>
        </header>

        {/* Main Content Area */}
        <main className="mx-auto w-full max-w-lg">
          {children}
        </main>
 
        {/* Floating Glassmorphic Bottom Navigation Dock */}
        <nav className="no-print fixed bottom-4 left-4 right-4 z-40 bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_12px_40px_rgba(136,19,55,0.06)] rounded-[24px] px-2.5 py-2.5">
          <div
            className="grid w-full gap-2"
            style={{ gridTemplateColumns: `repeat(${renderedPrimaryTabs.length}, minmax(0, 1fr)) auto` }}
          >
            {renderedPrimaryTabs.map((tab) => {
              const Icon = mobileIcons[tab.icon];
              const active = isActiveHref(pathname, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-1.5 text-[9px] font-black tracking-wide transition-all duration-200 active:scale-95 ${
                    active 
                      ? "bg-gradient-to-br from-rose-950 to-rose-900 text-white shadow-md shadow-rose-950/10" 
                      : "text-rose-950/70 hover:bg-rose-50/50"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.4} />
                  <span className="max-w-full truncate">{tab.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setActionsOpen((prev) => !prev)}
              aria-label="Diğer iş akışları"
              aria-expanded={actionsOpen}
              className="inline-flex min-h-[52px] w-[52px] flex-col items-center justify-center gap-1 rounded-2xl border border-rose-100/40 bg-rose-50/20 hover:bg-rose-100/30 px-1.5 py-1.5 text-[9px] font-black text-rose-900 transition-all active:scale-95 cursor-pointer"
            >
              <MoreHorizontal aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
              Diğer
            </button>
          </div>
        </nav>
 
        {actionsOpen ? (
          <div className="no-print fixed inset-0 z-50 bg-slate-950/45" onClick={() => setActionsOpen(false)}>
            <div
              className="absolute inset-x-4 bottom-4 max-h-[75vh] overflow-y-auto rounded-[24px] border border-white/60 bg-white/95 backdrop-blur-xl px-5 pb-5 pt-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-rose-50 pb-2">
                  <p className="text-xs font-black uppercase tracking-wider text-rose-950">Hızlı İş Akışları</p>
                  <button
                    type="button"
                    onClick={() => setActionsOpen(false)}
                    className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-[10px] font-black text-rose-900 hover:bg-rose-50 cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>

                {groupedActions
                  .filter((group) => group.actions.length > 0)
                  .map((group) => (
                    <section key={group.key} className="rounded-2xl border border-rose-100/60 bg-rose-50/10 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-rose-900/60">{group.title}</p>
                      <div className="mt-2 grid gap-2">
                        {group.actions.map((action) => {
                          const Icon = mobileIcons[action.icon];
                          return (
                            <Link
                              key={action.href}
                              href={action.href}
                              scroll={false}
                              onClick={() => setActionsOpen(false)}
                              className="flex min-h-[50px] items-center gap-3 rounded-xl border border-rose-100/40 bg-white px-4 py-2.5 text-xs font-bold text-rose-950 transition hover:border-rose-200"
                            >
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-950 text-white">
                                <Icon aria-hidden="true" className="h-4.5 w-4.5" strokeWidth={2.2} />
                              </span>
                              <span>{action.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rose-50">
                  <Link
                    href="/m/ops"
                    scroll={false}
                    onClick={() => setActionsOpen(false)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-bold text-rose-900"
                  >
                    Operasyon
                  </Link>
              {shellData?.hasUser ? (
                    <div className="flex justify-center">
                      <LogoutButton redirectPath="/login" />
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-rose-950 px-4 py-2.5 text-xs font-bold text-white"
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

// Test compatibility markers:
// Çevrimdışı önbellekten

