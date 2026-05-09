"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { ALL_BRANCHES_VALUE } from "@/lib/business";
import { getPlanLabel, getRequiredPlan, hasFeature, type FeatureKey } from "@/lib/features";
import { normalizeLocale, translateUiText } from "@/lib/i18n";
import type { AppRole, BranchProfile, BusinessPlan, BusinessType, StaffAccessScope } from "@/lib/types";
import type { ApplicationSettings } from "@/lib/app-settings";
import { defaultAdminSidebarOrder, defaultOwnerSidebarOrder, operationLinks } from "@/lib/sidebar-config";

const sidebarThemes: Record<
  ApplicationSettings["sidebarTheme"],
  {
    asideClassName: string;
    backgroundImage: string;
    brandBadgeClassName: string;
    activeItemClassName: string;
    activeIconClassName: string;
    footerBadgeClassName: string;
  }
> = {
  ember: {
    asideClassName: "border-[rgba(255,255,255,0.08)]",
    backgroundImage:
      "radial-gradient(circle at 0% 0%, rgba(255,120,72,0.30), transparent 24%), radial-gradient(circle at 100% 16%, rgba(255,199,94,0.18), transparent 20%), radial-gradient(circle at 50% 100%, rgba(67,176,143,0.18), transparent 28%), linear-gradient(180deg, #231713 0%, #33211a 36%, #1b2a28 100%)",
    brandBadgeClassName: "bg-[linear-gradient(135deg,#ff7848_0%,#ffc75e_100%)] shadow-[0_14px_24px_rgba(255,120,72,0.30)]",
    activeItemClassName: "bg-[linear-gradient(90deg,rgba(255,120,72,0.24)_0%,rgba(255,255,255,0.08)_100%)] shadow-[inset_4px_0_0_#ff7848,0_14px_24px_rgba(27,42,40,0.26)]",
    activeIconClassName: "bg-[linear-gradient(135deg,#ff7848_0%,#ffc75e_100%)] shadow-[0_12px_24px_rgba(255,120,72,0.28)]",
    footerBadgeClassName: "bg-[linear-gradient(135deg,#1f9d84_0%,#6dd3b0_100%)] shadow-[0_12px_22px_rgba(31,157,132,0.26)]",
  },
  ocean: {
    asideClassName: "border-[rgba(255,255,255,0.08)]",
    backgroundImage:
      "radial-gradient(circle at top left, rgba(34,211,238,0.24), transparent 24%), radial-gradient(circle at 80% 18%, rgba(59,130,246,0.18), transparent 22%), radial-gradient(circle at 65% 100%, rgba(16,185,129,0.12), transparent 26%), linear-gradient(180deg, #0f172a 0%, #10263c 38%, #133040 100%)",
    brandBadgeClassName: "bg-[linear-gradient(135deg,#22d3ee_0%,#3b82f6_100%)] shadow-[0_14px_24px_rgba(34,211,238,0.24)]",
    activeItemClassName: "bg-[linear-gradient(90deg,rgba(34,211,238,0.16)_0%,rgba(255,255,255,0.08)_100%)] shadow-[inset_3px_0_0_#22d3ee,0_12px_20px_rgba(8,47,73,0.24)]",
    activeIconClassName: "bg-[linear-gradient(135deg,#22d3ee_0%,#3b82f6_100%)] shadow-[0_12px_24px_rgba(59,130,246,0.22)]",
    footerBadgeClassName: "bg-[linear-gradient(135deg,#14b8a6_0%,#22c55e_100%)] shadow-[0_12px_22px_rgba(20,184,166,0.24)]",
  },
  night: {
    asideClassName: "border-[rgba(255,255,255,0.06)]",
    backgroundImage:
      "radial-gradient(circle at top left, rgba(168,85,247,0.18), transparent 20%), radial-gradient(circle at 85% 20%, rgba(244,114,182,0.1), transparent 18%), radial-gradient(circle at 70% 100%, rgba(148,163,184,0.12), transparent 24%), linear-gradient(180deg, #111111 0%, #171717 42%, #202020 100%)",
    brandBadgeClassName: "bg-[linear-gradient(135deg,#a855f7_0%,#f472b6_100%)] shadow-[0_14px_24px_rgba(168,85,247,0.22)]",
    activeItemClassName: "bg-[linear-gradient(90deg,rgba(168,85,247,0.16)_0%,rgba(255,255,255,0.08)_100%)] shadow-[inset_3px_0_0_#a855f7,0_12px_20px_rgba(15,15,15,0.22)]",
    activeIconClassName: "bg-[linear-gradient(135deg,#a855f7_0%,#f472b6_100%)] shadow-[0_12px_24px_rgba(168,85,247,0.2)]",
    footerBadgeClassName: "bg-[linear-gradient(135deg,#475569_0%,#cbd5e1_100%)] shadow-[0_12px_22px_rgba(100,116,139,0.22)]",
  },
};

function roleLabel(role: AppRole | null, usingDemoData: boolean) {
  if (usingDemoData) return "DEMO";
  if (!role) return "GUEST";
  if (role === "owner") return "OWNER";
  return role.toUpperCase();
}

function branchOptionLabel(branch: { name: string; branch_profile?: BranchProfile }) {
  return branch.name;
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, value));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 6 ? normalized : "ff7848";
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function mixHex(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  const mixed = {
    r: clamp(Math.round(r + (target - r) * ratio)),
    g: clamp(Math.round(g + (target - g) * ratio)),
    b: clamp(Math.round(b + (target - b) * ratio)),
  };
  return `#${mixed.r.toString(16).padStart(2, "0")}${mixed.g.toString(16).padStart(2, "0")}${mixed.b.toString(16).padStart(2, "0")}`;
}

function hexToRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getLocale() {
  if (typeof document === "undefined") return "tr";
  return normalizeLocale(document.documentElement.lang || "tr");
}

function resolveActiveHref(pathname: string | null, hrefs: string[]) {
  if (!pathname) {
    return null;
  }
  let bestMatch: string | null = null;
  for (const href of hrefs) {
    const exact = pathname === href;
    const nested = pathname.startsWith(`${href}/`);
    if (!exact && !nested) {
      continue;
    }
    if (!bestMatch || href.length > bestMatch.length) {
      bestMatch = href;
    }
  }
  return bestMatch;
}

function isFeatureEnabled(
  currentPlan: BusinessPlan,
  effectiveCapabilities: Partial<Record<FeatureKey, boolean>> | undefined,
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

export function AppNav({
  role,
  hasUser,
  usingDemoData,
  activeBusinessSlug,
  businesses,
  activeBranchId,
  activeBranchProfile,
  hasMixedBranchProfiles,
  forcedBranchSelectionFromAll,
  branches,
  currentPlan,
  effectiveCapabilities,
  branchAccessScope,
  canSwitchBranches,
  brandName,
  logoUrl,
  sidebarTheme,
  sidebarAccentColor,
  ownerSidebarOrder,
  adminSidebarOrder,
  activeBusinessType,
  mobileAppMode = false,
}: {
  role: AppRole | null;
  hasUser: boolean;
  usingDemoData: boolean;
  activeBusinessSlug: string;
  businesses: Array<{ slug: string; name: string }>;
  activeBranchId: string;
  activeBranchProfile: BranchProfile;
  hasMixedBranchProfiles: boolean;
  forcedBranchSelectionFromAll: boolean;
  branches: Array<{ id: string; name: string; branch_profile?: BranchProfile }>;
  currentPlan: BusinessPlan;
  effectiveCapabilities?: Partial<Record<FeatureKey, boolean>>;
  branchAccessScope: StaffAccessScope;
  canSwitchBranches: boolean;
  brandName: string;
  logoUrl?: string;
  sidebarTheme: ApplicationSettings["sidebarTheme"];
  sidebarAccentColor: ApplicationSettings["sidebarAccentColor"];
  ownerSidebarOrder: ApplicationSettings["ownerSidebarOrder"];
  adminSidebarOrder: ApplicationSettings["adminSidebarOrder"];
  activeBusinessType: BusinessType;
  mobileAppMode?: boolean;
}) {
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const lastPathRef = useRef<string | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const pathname = usePathname();
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);
  const locale = getLocale();
  const canSelectAllBranches = branchAccessScope === "business" && !hasMixedBranchProfiles;
  const resolvedActiveBranchId =
    activeBranchId === ALL_BRANCHES_VALUE && !canSelectAllBranches
      ? branches[0]?.id ?? ""
      : activeBranchId;

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("gopos_nav_collapsed") === "1");
    } catch {}
    setSidebarHydrated(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [mobileAppMode, pathname]);

  useEffect(() => {
    const node = sidebarScrollRef.current;
    if (!node) {
      return;
    }
    try {
      const raw = window.sessionStorage.getItem("app-nav-scroll-y");
      const restored = raw ? Number.parseInt(raw, 10) : 0;
      if (Number.isFinite(restored) && restored > 0) {
        node.scrollTop = restored;
      }
    } catch {}

    const handleScroll = () => {
      try {
        window.sessionStorage.setItem("app-nav-scroll-y", String(node.scrollTop));
      } catch {}
    };
    node.addEventListener("scroll", handleScroll, { passive: true });
    return () => node.removeEventListener("scroll", handleScroll);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("gopos_nav_collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  async function switchBusiness(slug: string) {
    if (!slug || slug === activeBusinessSlug) return;
    setIsSwitching(true);
    try {
      const response = await fetch("/api/business/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!response.ok) {
        return;
      }
      router.refresh();
      window.dispatchEvent(new Event("app-shell:refresh"));
    } finally {
      setIsSwitching(false);
    }
  }

  async function switchBranch(branchId: string) {
    if (branchId === resolvedActiveBranchId) return;
    setIsSwitching(true);
    try {
      const response = await fetch("/api/branch/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
      });
      if (!response.ok) {
        return;
      }
      router.refresh();
      window.dispatchEvent(new Event("app-shell:refresh"));
    } finally {
      setIsSwitching(false);
    }
  }

  const allowAll = usingDemoData;
  const isMarketSidebar = false && activeBranchProfile === "enterprise_market";
  const theme = sidebarThemes[sidebarTheme] ?? sidebarThemes.ember;
  const resolvedOrder = role === "owner" ? ownerSidebarOrder : adminSidebarOrder;
  const orderPreset: string[] = useMemo(
    () =>
      resolvedOrder.length > 0
        ? [...resolvedOrder]
        : role === "owner"
          ? [...defaultOwnerSidebarOrder]
          : [...defaultAdminSidebarOrder],
    [resolvedOrder, role],
  );
  const sidebarLinks = operationLinks;
  const accentBase = /^#[0-9a-fA-F]{6}$/.test(sidebarAccentColor) ? sidebarAccentColor : "#ff7848";
  const accentBright = mixHex(accentBase, 0.28);
  const accentDark = mixHex(accentBase, -0.18);
  const sidebarBorderClass = isMarketSidebar ? "border-[rgba(122,175,255,0.22)]" : theme.asideClassName;
  const sidebarBackgroundImage = isMarketSidebar
    ? "radial-gradient(circle at 0% 0%, rgba(77,142,247,0.3), transparent 28%), radial-gradient(circle at 100% 12%, rgba(39,86,161,0.28), transparent 24%), linear-gradient(180deg, #0c1728 0%, #0a1322 42%, #0a101c 100%)"
    : theme.backgroundImage;
  const visibleLinks = useMemo(
    () => {
      const allowed = sidebarLinks.filter(
        (link) =>
          (allowAll || (!!role && (link.roles.includes(role) || (role === "owner" && link.roles.includes("admin"))))) &&
          (!link.requiresBusinessScope || branchAccessScope === "business") &&
          (!link.businessTypes || link.businessTypes.includes(activeBusinessType)),
      );
      if (isMarketSidebar) {
        return allowed;
      }
      return allowed.sort((a, b) => {
        const aIndex = orderPreset.indexOf(a.href);
        const bIndex = orderPreset.indexOf(b.href);
        return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
      });
    },
    [activeBusinessType, allowAll, branchAccessScope, isMarketSidebar, orderPreset, role, sidebarLinks],
  );
  const desktopCollapsed = collapsed && !isMarketSidebar;
  const sidebarWidthClass = isMarketSidebar ? "w-[110px]" : desktopCollapsed ? "w-[88px]" : "w-[252px]";
  const activeHref = resolveActiveHref(pathname, visibleLinks.map((link) => link.href));
  const mobilePrimaryLinks = visibleLinks.slice(0, 4);

  useEffect(() => {
    const candidates = visibleLinks
      .filter((link) => isFeatureEnabled(currentPlan, effectiveCapabilities, link.feature))
      .map((link) => link.href)
      .slice(0, 6);

    if (candidates.length === 0) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const prefetchLinks = () => {
      if (cancelled) {
        return;
      }
      for (const href of candidates) {
        void router.prefetch(href);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = (
        window as Window & {
          requestIdleCallback: (
            callback: () => void,
            options?: { timeout?: number },
          ) => number;
        }
      ).requestIdleCallback(prefetchLinks, { timeout: 1200 });
    } else {
      timer = setTimeout(prefetchLinks, 450);
    }

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (
          window as Window & {
            cancelIdleCallback: (id: number) => void;
          }
        ).cancelIdleCallback(idleId);
      }
    };
  }, [currentPlan, effectiveCapabilities, router, visibleLinks]);

  useEffect(() => {
    if (!pathname) {
      return;
    }
    const previousPath = lastPathRef.current;
    lastPathRef.current = pathname;

    const node = sidebarScrollRef.current;
    if (!node) {
      return;
    }

    try {
      const raw = window.sessionStorage.getItem("app-nav-scroll-y");
      const restored = raw ? Number.parseInt(raw, 10) : 0;
      if (Number.isFinite(restored) && restored >= 0) {
        node.scrollTop = restored;
      }
    } catch {}

    if (!previousPath || previousPath === pathname) {
      return;
    }

    const activeNode = linkRefs.current[activeHref ?? ""] ?? null;
    if (!activeNode) {
      return;
    }

    const nodeTop = node.scrollTop;
    const nodeBottom = nodeTop + node.clientHeight;
    const itemTop = activeNode.offsetTop;
    const itemBottom = itemTop + activeNode.offsetHeight;
    if (itemTop < nodeTop || itemBottom > nodeBottom) {
      const target = Math.max(0, itemTop - Math.floor(node.clientHeight * 0.3));
      node.scrollTop = target;
      try {
        window.sessionStorage.setItem("app-nav-scroll-y", String(target));
      } catch {}
    }
  }, [activeHref, pathname]);

  return (
    <>
      {!mobileAppMode ? (
        <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{brandName}</p>
              <p className="truncate text-xs text-slate-500">
                {roleLabel(role, usingDemoData)} - {businesses.find((item) => item.slug === activeBusinessSlug)?.name ?? activeBusinessSlug}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-base text-slate-700 shadow-sm"
                aria-label={translateUiText("Menu", locale)}
              >
                {mobileOpen ? "x" : "="}
              </button>
              {!hasUser ? <Link href="/login" className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white">{translateUiText("Giris", locale)}</Link> : <LogoutButton />}
            </div>
          </div>
        </nav>
      ) : null}

      {!mobileAppMode && mobileOpen ? (
        <div className="no-print fixed inset-0 z-40 bg-slate-950/40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute inset-x-0 top-[58px] max-h-[calc(100vh-72px)] overflow-y-auto rounded-t-[28px] border-t border-slate-200 bg-white px-3 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{translateUiText("Aktif isletme", locale)}</p>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none"
                  value={activeBusinessSlug}
                  disabled={isSwitching || businesses.length === 0}
                  onChange={(event) => void switchBusiness(event.target.value)}
                >
                  {businesses.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{translateUiText("Aktif sube", locale)}</p>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none"
                  value={resolvedActiveBranchId}
                  disabled={isSwitching || branches.length === 0 || !canSwitchBranches}
                  onChange={(event) => void switchBranch(event.target.value)}
                >
                  {canSelectAllBranches ? <option value={ALL_BRANCHES_VALUE}>{translateUiText("Tum Subeler", locale)}</option> : null}
                  {branches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {branchOptionLabel(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                {visibleLinks.map((link) => {
                  const locked = !isFeatureEnabled(currentPlan, effectiveCapabilities, link.feature);
                  if (locked) {
                    return (
                      <div key={link.href} className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                        {translateUiText(link.label, locale)}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      scroll={false}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold ${
                        activeHref === link.href ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-700">
                        {link.icon}
                      </span>
                      <span>{translateUiText(link.label, locale)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!mobileAppMode && mobilePrimaryLinks.length > 0 ? (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 py-1.5 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          <div className="grid grid-cols-4 gap-2">
            {mobilePrimaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                scroll={false}
                className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl px-2 py-1.5 text-center text-[10px] font-semibold leading-tight ${
                  activeHref === link.href ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                <span className="mb-1 text-[13px]">{link.icon}</span>
                <span>{translateUiText(link.label, locale)}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <aside
        className={`hidden min-h-screen shrink-0 flex-col border-r text-white md:flex ${
          sidebarBorderClass
        } ${sidebarWidthClass} ${sidebarHydrated ? "transition-[width] duration-200 ease-out" : ""}`}
        style={{ backgroundImage: sidebarBackgroundImage }}
      >
        <div className="border-b border-white/10 px-4 py-6">
          <div className={`flex items-center ${isMarketSidebar ? "justify-center" : "justify-between"} gap-2`}>
            <div className={`min-w-0 ${isMarketSidebar ? "w-full text-center" : ""}`}>
              {logoUrl ? (
                <div className={`flex items-center gap-3 ${isMarketSidebar ? "justify-center" : ""}`}>
                  <Image src={logoUrl} alt={brandName} width={40} height={40} className="h-10 w-10 rounded-xl object-contain" unoptimized />
                  {!desktopCollapsed && !isMarketSidebar ? <p className="font-display truncate text-xl font-black tracking-tight text-white">{brandName}</p> : null}
                </div>
              ) : (
                <div className={`flex items-center gap-3 ${isMarketSidebar ? "justify-center" : ""}`}>
                  <span
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-base font-black text-white ${theme.brandBadgeClassName}`}
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${accentBase} 0%, ${accentBright} 100%)`,
                      boxShadow: `0 14px 24px ${hexToRgba(accentBase, 0.3)}`,
                    }}
                  >
                    {isMarketSidebar ? "M" : brandName.slice(0, 2).toUpperCase()}
                  </span>
                  {!desktopCollapsed && !isMarketSidebar ? <p className="font-display truncate text-[1.75rem] font-black leading-none tracking-tight text-white">{brandName}</p> : null}
                </div>
              )}
              {isMarketSidebar ? (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/55">{translateUiText("Market", locale)}</p>
              ) : !desktopCollapsed ? (
                <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[rgba(255,255,255,0.56)]">{translateUiText("operations cockpit", locale)}</p>
              ) : null}
            </div>
            {!isMarketSidebar ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              >
                {desktopCollapsed ? ">" : "<"}
              </button>
            ) : null}
          </div>
        </div>

        <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto px-2 py-4">
          {!desktopCollapsed && !isMarketSidebar ? (
            <>
              <div className="mb-4 rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.06)] p-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{translateUiText("Aktif isletme", locale)}</p>
                <select
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-white outline-none"
                  value={activeBusinessSlug}
                  disabled={isSwitching || businesses.length === 0}
                  onChange={(event) => void switchBusiness(event.target.value)}
                >
                  {businesses.map((item) => (
                    <option key={item.slug} value={item.slug} className="text-slate-900">
                      {item.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-white/50">{isSwitching ? translateUiText("Isletme degistiriliyor...", locale) : roleLabel(role, usingDemoData)}</p>
              </div>
              <div className="mt-3 rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.05)] p-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{translateUiText("Aktif sube", locale)}</p>
                <select
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-white outline-none"
                  value={resolvedActiveBranchId}
                  disabled={isSwitching || branches.length === 0 || !canSwitchBranches}
                  onChange={(event) => void switchBranch(event.target.value)}
                >
                  {canSelectAllBranches ? (
                    <option value={ALL_BRANCHES_VALUE} className="text-slate-900">
                      {translateUiText("Tum Subeler", locale)}
                    </option>
                  ) : null}
                  {branches.map((item) => (
                    <option key={item.id} value={item.id} className="text-slate-900">
                      {branchOptionLabel(item)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-white/45">
                  {hasMixedBranchProfiles ? translateUiText("Karisik profilli tenantta Tum Subeler secimi devre disidir.", locale) : branchAccessScope === "business" ? translateUiText("Tum subeleri gorebilirsin.", locale) : translateUiText("Bu kullanici yalnizca atanmis subeyi gorur.", locale)}
                </p>
                {forcedBranchSelectionFromAll ? (
                  <p className="mt-2 text-xs text-amber-200">
                    {translateUiText("ALL secimi mevcut cookie'de oldugu icin sube seviyesine zorlandi.", locale)}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {isMarketSidebar && !desktopCollapsed ? (
            <div className="mb-3 rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.06)] p-2.5 backdrop-blur">
              <p className="text-center text-[9px] uppercase tracking-[0.2em] text-white/52">Aktif Sube</p>
              <select
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] font-semibold text-white outline-none"
                value={resolvedActiveBranchId}
                disabled={isSwitching || branches.length === 0 || !canSwitchBranches}
                onChange={(event) => void switchBranch(event.target.value)}
              >
                {canSelectAllBranches ? (
                  <option value={ALL_BRANCHES_VALUE} className="text-slate-900">
                    Tum Subeler
                  </option>
                ) : null}
                {branches.map((item) => (
                  <option key={item.id} value={item.id} className="text-slate-900">
                    {branchOptionLabel(item)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-center text-[9px] text-white/46">
                {isSwitching ? "Sube degistiriliyor..." : roleLabel(role, usingDemoData)}
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            {visibleLinks.map((link) => {
              const locked = !isFeatureEnabled(currentPlan, effectiveCapabilities, link.feature);
              const isLinkActive = !locked && activeHref === link.href;
              const className = isMarketSidebar
                ? `group flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                    locked
                      ? "cursor-not-allowed border border-white/10 bg-white/5 text-white/35"
                      : isLinkActive
                        ? "bg-white/14 text-white shadow-[0_10px_18px_rgba(15,23,42,0.3)]"
                        : "text-white/72 hover:bg-white/10 hover:text-white"
                  }`
                : `group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                    locked
                      ? "cursor-not-allowed border border-white/10 bg-white/5 text-white/40"
                      : isLinkActive
                        ? `${theme.activeItemClassName} text-white`
                        : "text-white/75 hover:bg-white/6 hover:text-white"
                  }`;
              const iconClassName = isMarketSidebar
                ? `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition ${
                    locked
                      ? "bg-white/6 text-white/45"
                      : isLinkActive
                        ? "bg-white text-slate-900 shadow-[0_10px_20px_rgba(15,23,42,0.26)]"
                        : "bg-white/12 text-white/85 group-hover:bg-white/18"
                  }`
                : `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition ${
                    locked
                      ? "bg-white/5 text-white/45"
                      : isLinkActive
                        ? `${theme.activeIconClassName} text-white`
                        : "bg-white/8 text-white/80 group-hover:bg-white/12"
                  }`;

              if (locked) {
                const requiredPlan = link.feature ? getRequiredPlan(link.feature) : "growth";
                return (
                  <div key={link.href} title={`${translateUiText(link.label, locale)} - ${getPlanLabel(requiredPlan)} ${translateUiText("ile acilir", locale)}`} className={className}>
                    <span className={iconClassName}>{link.icon}</span>
                    {isMarketSidebar ? (
                      <span className="text-center leading-tight text-white/55">{translateUiText(link.label, locale)}</span>
                    ) : !desktopCollapsed ? (
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{translateUiText(link.label, locale)}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/35">{getPlanLabel(requiredPlan)} {translateUiText("ile acilir", locale)}</div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  scroll={false}
                  ref={(node) => {
                    linkRefs.current[link.href] = node;
                  }}
                  onClick={() => {
                    const node = sidebarScrollRef.current;
                    if (!node) {
                      return;
                    }
                    try {
                      window.sessionStorage.setItem("app-nav-scroll-y", String(node.scrollTop));
                    } catch {}
                  }}
                  title={desktopCollapsed || isMarketSidebar ? translateUiText(link.label, locale) : undefined}
                  className={className}
                  style={
                    isLinkActive && !isMarketSidebar
                      ? {
                          backgroundImage: `linear-gradient(90deg, ${hexToRgba(accentBase, 0.24)} 0%, rgba(255,255,255,0.08) 100%)`,
                          boxShadow: `inset 4px 0 0 ${accentBase}, 0 14px 24px rgba(15,23,42,0.18)`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={iconClassName}
                    style={
                      isLinkActive && !isMarketSidebar
                        ? {
                            backgroundImage: `linear-gradient(135deg, ${accentBase} 0%, ${accentBright} 100%)`,
                            boxShadow: `0 12px 24px ${hexToRgba(accentBase, 0.28)}`,
                          }
                        : undefined
                    }
                  >
                    {link.icon}
                  </span>
                  {isMarketSidebar ? (
                    <span className="line-clamp-2 text-center leading-tight">{translateUiText(link.label, locale)}</span>
                  ) : !desktopCollapsed ? (
                    <span className="truncate">{translateUiText(link.label, locale)}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        <div className={`border-t border-white/10 ${isMarketSidebar ? "px-2 py-3" : "px-3 py-4"}`}>
          {!desktopCollapsed && !isMarketSidebar ? (
            <div className="mb-3 flex items-center justify-between rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.05)] px-3 py-3">
              <div>
                <p className="font-display text-sm font-semibold text-white">{activeBusinessSlug}</p>
                <p className="text-xs text-white/55">{translateUiText("Operasyon erisimi", locale)}</p>
              </div>
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${theme.footerBadgeClassName}`}
                style={{
                  backgroundImage: `linear-gradient(135deg, ${accentDark} 0%, ${accentBright} 100%)`,
                  boxShadow: `0 12px 22px ${hexToRgba(accentDark, 0.24)}`,
                }}
              >
                {roleLabel(role, usingDemoData).slice(0, 2)}
              </span>
            </div>
          ) : null}
          {!hasUser ? (
            <Link href="/login" className={`block rounded-2xl bg-[linear-gradient(135deg,#ff6a3d_0%,#f2b44f_100%)] text-center font-semibold text-white shadow-[0_14px_24px_rgba(255,106,61,0.24)] ${isMarketSidebar ? "px-2 py-2 text-[10px] uppercase tracking-[0.15em]" : "px-4 py-3 text-sm"}`}>
              {translateUiText("Giris", locale)}
            </Link>
          ) : (
            <div className={isMarketSidebar ? "flex justify-center" : undefined}>
              <LogoutButton />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}






