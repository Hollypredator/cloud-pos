import { NextResponse } from "next/server";
import { getApplicationSettings, getAppShellSnapshot, getGeneralSettings } from "@/lib/data";

export async function GET() {
  const [shellSnapshot, { settings: generalSettings }, { settings: applicationSettings }] = await Promise.all([
    getAppShellSnapshot(),
    getGeneralSettings(),
    getApplicationSettings(),
  ]);

  const activeBusiness =
    shellSnapshot.businesses.find((item) => item.slug === shellSnapshot.activeBusinessSlug) ??
    shellSnapshot.businesses[0];

  return NextResponse.json({
    role: shellSnapshot.role,
    hasUser: !!shellSnapshot.user,
    usingDemoData: shellSnapshot.usingDemoData,
    activeBusinessSlug: shellSnapshot.activeBusinessSlug,
    businesses: shellSnapshot.businesses.map((item) => ({ slug: item.slug, name: item.name })),
    activeBranchId: shellSnapshot.activeBranchId ?? "",
    branches: shellSnapshot.branches.map((item) => ({ id: item.id, name: item.name })),
    currentPlan: activeBusiness?.plan ?? "growth",
    branchAccessScope: shellSnapshot.accessScope ?? "business",
    canSwitchBranches: shellSnapshot.usingDemoData || shellSnapshot.accessScope !== "branch",
    brandName: generalSettings.siteName,
    logoUrl: generalSettings.logoUrl || undefined,
    sidebarTheme: applicationSettings.sidebarTheme,
    sidebarAccentColor: applicationSettings.sidebarAccentColor,
    ownerSidebarOrder: applicationSettings.ownerSidebarOrder,
    adminSidebarOrder: applicationSettings.adminSidebarOrder,
  });
}
