import { getActiveBusinessSlug } from "@/lib/business-server";
import { getBusinessContextBySlug } from "@/lib/data";
import { FEATURE_META, getRequiredPlan, hasFeature, type FeatureKey } from "@/lib/features";
import type { BusinessPlan } from "@/lib/types";

export async function getActiveBusinessPlanContext() {
  const activeSlug = await getActiveBusinessSlug();
  const { business, usingDemoData } = await getBusinessContextBySlug(activeSlug);
  const plan = (business?.plan ?? "growth") as BusinessPlan;

  return {
    plan,
    usingDemoData,
    businessName: business?.name ?? "Demo Business",
    businessSlug: business?.slug ?? activeSlug,
  };
}

export async function getFeatureAccess(feature: FeatureKey) {
  const context = await getActiveBusinessPlanContext();
  return {
    ...context,
    feature,
    enabled: hasFeature(context.plan, feature),
    requiredPlan: getRequiredPlan(feature),
    title: FEATURE_META[feature].title,
    description: FEATURE_META[feature].description,
  };
}
