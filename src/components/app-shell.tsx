"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";
import { PwaInstallCard } from "@/components/pwa-install-card";
import { PwaRuntime } from "@/components/pwa-runtime";
import { hasFeature, type FeatureKey } from "@/lib/features";
import { normalizeLocale, translateUiText } from "@/lib/i18n";
import type { AppShellPayload } from "@/lib/app-shell";
import type { AppRole } from "@/lib/types";

const shellPrefixes = ["/ops", "/kitchen", "/cashier", "/service-requests", "/tables", "/delivery", "/admin"];
const mobileOpsPrefixes = [
  "/ops",
  "/tables",
  "/cashier",
  "/kitchen",
  "/delivery",
  "/service-requests",
  "/admin",
  "/admin/tables",
  "/admin/orders",
];

type MobileQuickAction = {
  href: string;
  label: string;
  icon: string;
  roles: AppRole[];
  group: "order_flow" | "service_flow" | "management";
  feature?: FeatureKey;
};

const mobileQuickActions: MobileQuickAction[] = [
  { href: "/tables", label: "Masa Takip", icon: "MT", roles: ["admin", "waiter", "kitchen", "cashier"], group: "order_flow" },
  { href: "/admin/orders", label: "Siparis Baslat", icon: "SP", roles: ["owner", "admin", "waiter", "cashier"], group: "order_flow" },
  { href: "/cashier", label: "Adisyonlar", icon: "AD", roles: ["admin", "cashier"], group: "order_flow" },
  { href: "/service-requests", label: "Masa Talepleri", icon: "SR", roles: ["admin", "waiter", "cashier"], group: "service_flow" },
  { href: "/delivery", label: "Teslimat", icon: "DL", roles: ["admin", "waiter", "cashier"], group: "service_flow", feature: "delivery_dispatch" },
  { href: "/kitchen", label: "Mutfak", icon: "MK", roles: ["admin", "kitchen"], group: "service_flow", feature: "kitchen_display" },
  { href: "/cashier/session", label: "Gun Islemleri", icon: "GI", roles: ["admin", "cashier"], group: "management" },
  { href: "/tables", label: "Masa Yonetimi", icon: "MY", roles: ["owner", "admin"], group: "management" },
];

function getLocale() {
  if (typeof document === "undefined") return "tr";
  return normalizeLocale(document.documentElement.lang || "tr");
}

function isScopedPath(pathname: string | null, prefixes: string[]) {
  if (!pathname) {
    return false;
  }
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function resolveMobileOpsRedirect(pathname: string | null) {
  if (!pathname) {
    return null;
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/demo-ops")) {
    return "/ops";
  }
  if (pathname.startsWith("/admin/orders")) {
    return null;
  }
  if (pathname.startsWith("/admin/tables")) {
    return "/tables";
  }
  if (pathname.startsWith("/admin")) {
    return "/ops";
  }
  return null;
}

function resolveMobileTitle(pathname: string | null, locale: "tr" | "en" | "fr") {
  if (!pathname) {
    return translateUiText("Operasyon", locale);
  }
  if (pathname === "/ops" || pathname.startsWith("/ops/")) return translateUiText("Operasyon Merkezi", locale);
  if (pathname === "/tables" || pathname.startsWith("/tables/")) return translateUiText("Masa Takip", locale);
  if (pathname === "/admin/orders" || pathname.startsWith("/admin/orders/")) return translateUiText("Siparis Akisi", locale);
  if (pathname === "/admin/tables" || pathname.startsWith("/admin/tables/")) return translateUiText("Masa Takip", locale);
  if (pathname === "/cashier" || pathname.startsWith("/cashier/")) return translateUiText("Kasa Ekrani", locale);
  if (pathname === "/kitchen" || pathname.startsWith("/kitchen/")) return translateUiText("Mutfak Board", locale);
  if (pathname === "/delivery" || pathname.startsWith("/delivery/")) return translateUiText("Teslimat Board", locale);
  if (pathname === "/service-requests" || pathname.startsWith("/service-requests/")) return translateUiText("Masa Talepleri", locale);
  if (pathname === "/admin") return translateUiText("Operasyon Merkezi", locale);
  return translateUiText("Operasyon", locale);
}

function canAccessQuickAction(role: AppRole | null, usingDemoData: boolean, roles: AppRole[]) {
  return usingDemoData || (!!role && (roles.includes(role) || (role === "owner" && roles.includes("admin"))));
}

export function AppShell({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: AppShellPayload | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [shellData, setShellData] = useState<AppShellPayload | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const hasRequestedInitialRef = useRef(false);
  const locale = getLocale();

  const showShell = useMemo(
    () => isScopedPath(pathname, shellPrefixes),
    [pathname],
  );
  const isMobileOpsRoute = useMemo(
    () => isScopedPath(pathname, mobileOpsPrefixes),
    [pathname],
  );
  const mobileExperienceEnabled = shellData?.mobileAppExperienceEnabled ?? true;
  const mobileAppMode = Boolean(mobileExperienceEnabled && isCoarsePointer && isMobileOpsRoute);
  const pwaEnabled = Boolean(shellData?.mobileReadOnlyPwaEnabled);
  const pwaRuntimeEnabled = Boolean(pwaEnabled && mobileAppMode);
  const mobileTitle = resolveMobileTitle(pathname, locale);
  const quickActions = useMemo(() => {
    if (!shellData) {
      return [];
    }
    return mobileQuickActions.filter(
      (action) =>
        canAccessQuickAction(shellData.role, shellData.usingDemoData, action.roles) &&
        (!action.feature || hasFeature(shellData.currentPlan, action.feature)),
    );
  }, [shellData]);
  const quickActionGroups = useMemo(() => {
    const byGroup = {
      order_flow: [] as MobileQuickAction[],
      service_flow: [] as MobileQuickAction[],
      management: [] as MobileQuickAction[],
    };
    for (const action of quickActions) {
      byGroup[action.group].push(action);
    }
    return [
      {
        key: "order_flow" as const,
        title: translateUiText("Siparis ve Kasa", locale),
        description: translateUiText("Masa ac, adisyona gec, tahsilat yap.", locale),
        actions: byGroup.order_flow,
      },
      {
        key: "service_flow" as const,
        title: translateUiText("Servis ve Dagitim", locale),
        description: translateUiText("Mutfak, teslimat ve masa taleplerini yonet.", locale),
        actions: byGroup.service_flow,
      },
      {
        key: "management" as const,
        title: translateUiText("Yonetim", locale),
        description: translateUiText("Gunluk oturum ve ayar aksiyonlari.", locale),
        actions: byGroup.management,
      },
    ];
  }, [locale, quickActions]);

  const loadShellData = useEffectEvent(async (force = false) => {
    if (!force && loading) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/app-shell", {
        method: "GET",
        credentials: "same-origin",
        ...(force ? { cache: "no-store" as const } : {}),
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as AppShellPayload;
      setShellData((prev) => {
        if (!prev) {
          return data;
        }
        if (
          prev.sessionUserId === data.sessionUserId &&
          prev.sessionBusinessId === data.sessionBusinessId &&
          prev.sessionBranchId === data.sessionBranchId &&
          prev.role === data.role &&
          prev.hasUser === data.hasUser &&
          prev.activeBusinessSlug === data.activeBusinessSlug &&
          prev.activeBranchId === data.activeBranchId &&
          prev.sidebarTheme === data.sidebarTheme &&
          prev.sidebarAccentColor === data.sidebarAccentColor &&
          prev.brandName === data.brandName &&
          prev.logoUrl === data.logoUrl &&
          prev.currentPlan === data.currentPlan &&
          prev.mobileAppExperienceEnabled === data.mobileAppExperienceEnabled &&
          prev.mobileReadOnlyPwaEnabled === data.mobileReadOnlyPwaEnabled
        ) {
          return prev;
        }
        return data;
      });
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (!showShell) {
      return;
    }
    const media = window.matchMedia("(hover: none) and (pointer: coarse)");
    const apply = () => setIsCoarsePointer(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [showShell]);

  useEffect(() => {
    if (!mobileAppMode) {
      return;
    }
    const redirectPath = resolveMobileOpsRedirect(pathname);
    if (!redirectPath || pathname === redirectPath) {
      return;
    }
    router.replace(redirectPath);
  }, [mobileAppMode, pathname, router]);

  useEffect(() => {
    if (!showShell) {
      return;
    }
    const apply = () => setIsOffline(!navigator.onLine);
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, [showShell]);

  useEffect(() => {
    setActionsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!showShell || !pwaRuntimeEnabled || !isOffline) {
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
  }, [isOffline, pwaRuntimeEnabled, showShell]);

  useEffect(() => {
    if (!showShell) {
      return;
    }
    if (initialData) {
      setShellData(initialData);
      hasRequestedInitialRef.current = true;
      return;
    }
    if (hasRequestedInitialRef.current) {
      return;
    }
    hasRequestedInitialRef.current = true;
    void loadShellData();
  }, [initialData, loadShellData, showShell]);

  useEffect(() => {
    if (!showShell || shellData) {
      return;
    }

    void loadShellData();
  }, [pathname, shellData, showShell]);

  useEffect(() => {
    if (!showShell) {
      return;
    }

    function handleRefresh() {
      void loadShellData(true);
    }

    window.addEventListener("app-shell:refresh", handleRefresh);
    return () => window.removeEventListener("app-shell:refresh", handleRefresh);
  }, [showShell]);

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <>
      <PwaRuntime enabled={pwaRuntimeEnabled} />
      <PwaInstallCard enabled={pwaRuntimeEnabled} />
      <div
        className={`min-h-screen overflow-x-clip ${mobileAppMode ? "bg-slate-100" : "bg-[linear-gradient(180deg,#f4f6f9_0%,#eceff4_100%)]"} md:flex ${mobileAppMode ? "mobile-app-mode" : ""} ${
          mobileAppMode && isOffline ? "offline-mode" : ""
        } ${isOffline && pwaRuntimeEnabled ? "offline-read-only" : ""}`}
      >
        {!mobileAppMode ? (
          shellData ? (
            <AppNav
              role={shellData.role}
              hasUser={shellData.hasUser}
              usingDemoData={shellData.usingDemoData}
              activeBusinessSlug={shellData.activeBusinessSlug}
              businesses={shellData.businesses}
              activeBranchId={shellData.activeBranchId}
              branches={shellData.branches}
              currentPlan={shellData.currentPlan}
              branchAccessScope={shellData.branchAccessScope}
              canSwitchBranches={shellData.canSwitchBranches}
              brandName={shellData.brandName}
              logoUrl={shellData.logoUrl}
              sidebarTheme={shellData.sidebarTheme}
              sidebarAccentColor={shellData.sidebarAccentColor}
              ownerSidebarOrder={shellData.ownerSidebarOrder}
              adminSidebarOrder={shellData.adminSidebarOrder}
              mobileAppMode={mobileAppMode}
            />
          ) : (
            <div className="hidden w-[252px] shrink-0 border-r border-slate-200 bg-white/70 md:block" />
          )
        ) : null}

        <div
          className={`min-w-0 flex-1 overflow-x-clip ${
            mobileAppMode
              ? "pb-[calc(88px+var(--safe-area-bottom))] pt-[calc(68px+var(--safe-area-top))]"
              : "pb-28 md:pb-0"
          }`}
        >
          {!mobileAppMode && isOffline && pwaRuntimeEnabled ? (
            <div className="no-print sticky top-0 z-30 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {translateUiText("Baglanti kesildi. Offline modda yalnizca okunabilir kullanim acik.", locale)}
            </div>
          ) : null}
          {children}
        </div>

        {mobileAppMode ? (
          <>
            <div className="no-print fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white md:hidden">
              <div className="mx-auto flex w-full max-w-[980px] items-center justify-between gap-3 px-3 pb-2 pt-[calc(var(--safe-area-top)+8px)]">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {shellData?.brandName ?? "Cloud POS"}
                  </p>
                  <p className="truncate text-[1.06rem] font-semibold text-slate-900">{mobileTitle}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                    isOffline ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {isOffline ? translateUiText("Offline", locale) : translateUiText("Canli", locale)}
                </span>
              </div>
              {isOffline ? (
                <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
                  {translateUiText("Baglanti gerekli. Offline modda sadece okunabilir kullanim acik.", locale)}
                </div>
              ) : null}
            </div>

            <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden">
              <div className="mx-auto grid w-full max-w-[980px] grid-cols-[1fr_auto] gap-2 px-3 pb-[calc(var(--safe-area-bottom)+8px)] pt-2">
                <Link
                  href="/ops"
                  scroll={false}
                  onClick={() => setActionsOpen(false)}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                >
                  {translateUiText("Home", locale)}
                </Link>
                <button
                  type="button"
                  onClick={() => setActionsOpen((prev) => !prev)}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800"
                >
                  {translateUiText("Actions", locale)}
                </button>
              </div>
            </div>

            {actionsOpen ? (
              <div className="no-print fixed inset-0 z-50 bg-slate-950/40 md:hidden" onClick={() => setActionsOpen(false)}>
                <div
                  className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] border-t border-slate-200 bg-white px-4 pb-[calc(var(--safe-area-bottom)+16px)] pt-4"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mx-auto w-full max-w-[980px]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {translateUiText("Hizli Aksiyonlar", locale)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActionsOpen(false)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        {translateUiText("Kapat", locale)}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {quickActionGroups
                        .filter((group) => group.actions.length > 0)
                        .map((group) => (
                          <section key={group.key} className="rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{group.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                            <div className="mt-3 grid gap-2">
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
                                  <span>{translateUiText(action.label, locale)}</span>
                                </Link>
                              ))}
                            </div>
                          </section>
                        ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link
                        href="/ops"
                        scroll={false}
                        onClick={() => setActionsOpen(false)}
                        className="inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
                      >
                        {translateUiText("Home", locale)}
                      </Link>
                      {shellData?.hasUser ? (
                        <div className="flex justify-center">
                          <LogoutButton />
                        </div>
                      ) : (
                        <Link
                          href="/login"
                          className="inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                        >
                          {translateUiText("Giris", locale)}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
