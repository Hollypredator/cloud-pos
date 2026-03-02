import { unstable_cache } from "next/cache";
import { cache } from "react";
import {
  defaultApplicationSettings,
  defaultGeneralSettings,
  normalizeApplicationSettings,
  normalizeGeneralSettings,
  type ApplicationSettings,
  type GeneralSettings,
} from "@/lib/app-settings";
import type { AppShellPayload } from "@/lib/app-shell";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SiteContent, StaffAccessScope } from "@/lib/types";
import { getAppShellContext } from "@/lib/server/app-context";

const getCachedAppShellSettingsRows = unstable_cache(
  async () => {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("app_settings")
      .select("key, content")
      .in("key", ["general_settings", "application_settings"]);

    if (error) {
      return { error: true as const, rows: [] as Array<Pick<SiteContent, "key" | "content">> };
    }

    return {
      error: false as const,
      rows: (data ?? []) as Array<Pick<SiteContent, "key" | "content">>,
    };
  },
  ["app-shell-settings"],
  { tags: ["app-settings-general", "app-settings-application"] },
);

export async function getAppShellUiSettings() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      generalSettings: defaultGeneralSettings,
      applicationSettings: defaultApplicationSettings,
      usingDemoData: true,
    };
  }

  const cached = await getCachedAppShellSettingsRows();
  if (!cached || cached.error) {
    return {
      generalSettings: defaultGeneralSettings,
      applicationSettings: defaultApplicationSettings,
      usingDemoData: false,
    };
  }

  const generalRow = cached.rows.find((row) => row.key === "general_settings") ?? null;
  const applicationRow = cached.rows.find((row) => row.key === "application_settings") ?? null;

  return {
    generalSettings: normalizeGeneralSettings((generalRow?.content as Partial<GeneralSettings> | null) ?? null),
    applicationSettings: normalizeApplicationSettings((applicationRow?.content as Partial<ApplicationSettings> | null) ?? null),
    usingDemoData: false,
  };
}

export const getAppShellPayload = cache(async (): Promise<AppShellPayload> => {
  const [shellSnapshot, { generalSettings, applicationSettings }] = await Promise.all([
    getAppShellContext(),
    getAppShellUiSettings(),
  ]);

  const activeBusiness =
    shellSnapshot.businesses.find((item) => item.slug === shellSnapshot.activeBusinessSlug) ??
    shellSnapshot.businesses[0];

  return {
    role: shellSnapshot.role,
    hasUser: shellSnapshot.hasUser,
    usingDemoData: shellSnapshot.usingDemoData,
    activeBusinessSlug: shellSnapshot.activeBusinessSlug,
    businesses: shellSnapshot.businesses.map((item) => ({ slug: item.slug, name: item.name })),
    activeBranchId: shellSnapshot.activeBranchId ?? "",
    branches: shellSnapshot.branches,
    currentPlan: activeBusiness?.plan ?? "growth",
    branchAccessScope: (shellSnapshot.accessScope ?? "business") as StaffAccessScope,
    canSwitchBranches: shellSnapshot.usingDemoData || shellSnapshot.accessScope !== "branch",
    brandName: generalSettings.siteName,
    logoUrl: generalSettings.logoUrl || undefined,
    sidebarTheme: applicationSettings.sidebarTheme,
    sidebarAccentColor: applicationSettings.sidebarAccentColor,
    ownerSidebarOrder: applicationSettings.ownerSidebarOrder,
    adminSidebarOrder: applicationSettings.adminSidebarOrder,
  };
});
