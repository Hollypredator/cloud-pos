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
import { DEFAULT_BUSINESS_SLUG, normalizeBusinessSlug } from "@/lib/business";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SiteContent, StaffAccessScope } from "@/lib/types";
import { getAppShellContext } from "@/lib/server/app-context";

function buildScopedGeneralSettingsKey(activeBusinessSlug?: string) {
  return `general_settings:${normalizeBusinessSlug(activeBusinessSlug)}`;
}

function readBooleanSetting(input: unknown, key: string, fallback: boolean) {
  if (!input || typeof input !== "object") {
    return fallback;
  }
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : fallback;
}

async function getCachedAppShellSettingsRows(activeBusinessSlug?: string) {
  const generalSettingsKey = buildScopedGeneralSettingsKey(activeBusinessSlug);
  const cachedReader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from("app_settings")
        .select("key, content")
        .in("key", [generalSettingsKey, "general_settings", "application_settings"]);

      if (error) {
        return { error: true as const, rows: [] as Array<Pick<SiteContent, "key" | "content">> };
      }

      return {
        error: false as const,
        rows: (data ?? []) as Array<Pick<SiteContent, "key" | "content">>,
      };
    },
    [`app-shell-settings:${generalSettingsKey}`],
    { tags: ["app-settings-general", `app-settings-general:${generalSettingsKey}`, "app-settings-application"] },
  );

  return cachedReader();
}

export async function getAppShellUiSettings(activeBusinessSlug?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      generalSettings: defaultGeneralSettings,
      applicationSettings: defaultApplicationSettings,
      usingDemoData: true,
    };
  }

  const generalSettingsKey = buildScopedGeneralSettingsKey(activeBusinessSlug);
  const cached = await getCachedAppShellSettingsRows(activeBusinessSlug);
  if (!cached || cached.error) {
    return {
      generalSettings: defaultGeneralSettings,
      applicationSettings: defaultApplicationSettings,
      usingDemoData: false,
    };
  }

  const generalRow =
    cached.rows.find((row) => row.key === generalSettingsKey) ??
    cached.rows.find((row) => row.key === "general_settings") ??
    null;
  const applicationRow = cached.rows.find((row) => row.key === "application_settings") ?? null;

  return {
    generalSettings: normalizeGeneralSettings((generalRow?.content as Partial<GeneralSettings> | null) ?? null),
    applicationSettings: normalizeApplicationSettings((applicationRow?.content as Partial<ApplicationSettings> | null) ?? null),
    usingDemoData: false,
  };
}

export function getFallbackAppShellPayload(): AppShellPayload {
  const fallbackMobileAppExperienceEnabled = readBooleanSetting(
    defaultApplicationSettings,
    "mobileAppExperienceEnabled",
    true,
  );
  const fallbackMobileReadOnlyPwaEnabled = readBooleanSetting(
    defaultApplicationSettings,
    "mobileReadOnlyPwaEnabled",
    false,
  );
  return {
    role: null,
    hasUser: false,
    usingDemoData: true,
    sessionUserId: null,
    sessionBusinessId: null,
    sessionBranchId: null,
    activeBusinessSlug: DEFAULT_BUSINESS_SLUG,
    businesses: [],
    activeBranchId: "",
    branches: [],
    currentPlan: "growth",
    branchAccessScope: "business",
    canSwitchBranches: true,
    brandName: defaultGeneralSettings.siteName,
    logoUrl: undefined,
    sidebarTheme: defaultApplicationSettings.sidebarTheme,
    sidebarAccentColor: defaultApplicationSettings.sidebarAccentColor,
    ownerSidebarOrder: defaultApplicationSettings.ownerSidebarOrder,
    adminSidebarOrder: defaultApplicationSettings.adminSidebarOrder,
    mobileAppExperienceEnabled: fallbackMobileAppExperienceEnabled,
    mobileReadOnlyPwaEnabled: fallbackMobileReadOnlyPwaEnabled,
  };
}

export const getAppShellPayload = cache(async (): Promise<AppShellPayload> => {
  const shellSnapshot = await getAppShellContext();
  const { generalSettings, applicationSettings } = await getAppShellUiSettings(shellSnapshot.activeBusinessSlug);
  const mobileAppExperienceEnabled = readBooleanSetting(
    applicationSettings,
    "mobileAppExperienceEnabled",
    true,
  );
  const mobileReadOnlyPwaEnabled = readBooleanSetting(
    applicationSettings,
    "mobileReadOnlyPwaEnabled",
    false,
  );

  const activeBusiness =
    shellSnapshot.businesses.find((item) => item.slug === shellSnapshot.activeBusinessSlug) ??
    shellSnapshot.businesses[0];

  return {
    role: shellSnapshot.role,
    hasUser: shellSnapshot.hasUser,
    usingDemoData: shellSnapshot.usingDemoData,
    sessionUserId: shellSnapshot.sessionUserId,
    sessionBusinessId: shellSnapshot.sessionBusinessId,
    sessionBranchId: shellSnapshot.sessionBranchId,
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
    mobileAppExperienceEnabled,
    mobileReadOnlyPwaEnabled,
  };
});
