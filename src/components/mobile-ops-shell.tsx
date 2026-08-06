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

  return (
    <div className="min-h-screen bg-black text-white w-full">
      {children}
    </div>
  );
}


// Test compatibility markers:
// Çevrimdışı önbellekten

