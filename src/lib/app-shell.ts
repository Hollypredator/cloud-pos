import type { ApplicationSettings } from "@/lib/app-settings";
import type { AppRole, BusinessPlan, StaffAccessScope } from "@/lib/types";

export type AppShellPayload = {
  role: AppRole | null;
  hasUser: boolean;
  usingDemoData: boolean;
  sessionUserId: string | null;
  sessionBusinessId: string | null;
  sessionBranchId: string | null;
  activeBusinessSlug: string;
  businesses: Array<{ slug: string; name: string }>;
  activeBranchId: string;
  branches: Array<{ id: string; name: string }>;
  currentPlan: BusinessPlan;
  branchAccessScope: StaffAccessScope;
  canSwitchBranches: boolean;
  brandName: string;
  logoUrl?: string;
  sidebarTheme: ApplicationSettings["sidebarTheme"];
  sidebarAccentColor: ApplicationSettings["sidebarAccentColor"];
  ownerSidebarOrder: ApplicationSettings["ownerSidebarOrder"];
  adminSidebarOrder: ApplicationSettings["adminSidebarOrder"];
  mobileAppExperienceEnabled: ApplicationSettings["mobileAppExperienceEnabled"];
  mobileReadOnlyPwaEnabled: ApplicationSettings["mobileReadOnlyPwaEnabled"];
};
