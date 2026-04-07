import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  FEATURE_META,
  buildEffectiveCapabilities,
  getRequiredPlan,
  type FeatureKey,
  type FeatureOverrideMap,
} from "@/lib/features";
import { getRequestAppContext } from "@/lib/server/app-context";
import type { BranchProfile, BusinessPlan } from "@/lib/types";

type FeatureOverrideRow = {
  feature_key: FeatureKey;
  enabled: boolean;
};

type FeatureAccessInput = {
  plan: BusinessPlan;
  branchProfile: BranchProfile;
  overrides: FeatureOverrideMap;
};

async function readFeatureOverridesForBusiness(businessId: string | null): Promise<FeatureOverrideMap> {
  if (!businessId) {
    return {};
  }

  const readWithClient = async (
    supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>> | NonNullable<Awaited<ReturnType<typeof getSupabaseAuthServerClient>>>,
  ) => {
    const { data, error } = await supabase
      .from("support_feature_flag_overrides")
      .select("feature_key, enabled")
      .eq("business_id", businessId);

    if (error) {
      if (error.message.toLowerCase().includes("support_feature_flag_overrides")) {
        return {} as FeatureOverrideMap;
      }
      return {} as FeatureOverrideMap;
    }

    return ((data ?? []) as FeatureOverrideRow[]).reduce((acc, row) => {
      acc[row.feature_key] = Boolean(row.enabled);
      return acc;
    }, {} as FeatureOverrideMap);
  };

  const serviceClient = getSupabaseServerClient();
  if (serviceClient) {
    const cacheKey = `feature-overrides:${businessId}`;
    const reader = unstable_cache(
      async () => readWithClient(serviceClient),
      [cacheKey],
      { revalidate: 30, tags: ["support-feature-overrides"] },
    );

    return reader();
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return {};
  }

  return readWithClient(authClient);
}

function toFeatureAccess(input: FeatureAccessInput, feature: FeatureKey) {
  const effectiveCapabilities = buildEffectiveCapabilities({
    plan: input.plan,
    branchProfile: input.branchProfile,
    overrides: input.overrides,
  });

  return {
    feature,
    enabled: effectiveCapabilities[feature],
    requiredPlan: getRequiredPlan(feature),
    title: FEATURE_META[feature].title,
    description: FEATURE_META[feature].description,
    effectiveCapabilities,
  };
}

export const getActiveBusinessPlanContext = cache(async () => {
  const context = await getRequestAppContext();
  const plan = (context.activeBusiness?.plan ?? "growth") as BusinessPlan;
  const branchProfile = (context.activeBranchProfile ?? "restaurant") as BranchProfile;
  const overrides = await readFeatureOverridesForBusiness(context.businessId ?? null);
  const effectiveCapabilities = buildEffectiveCapabilities({ plan, branchProfile, overrides });

  return {
    plan,
    usingDemoData: context.usingDemoData,
    businessName: context.activeBusiness?.name ?? "Demo Business",
    businessSlug: context.activeSlug,
    branchProfile,
    overrides,
    effectiveCapabilities,
  };
});

export const getFeatureAccess = cache(async (feature: FeatureKey) => {
  const context = await getActiveBusinessPlanContext();
  const access = toFeatureAccess(
    {
      plan: context.plan,
      branchProfile: context.branchProfile,
      overrides: context.overrides,
    },
    feature,
  );

  return {
    ...context,
    ...access,
  };
});
