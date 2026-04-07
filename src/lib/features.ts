import type { BranchProfile, BusinessPlan } from "@/lib/types";

export type FeatureKey =
  | "kitchen_display"
  | "delivery_dispatch"
  | "advanced_reports"
  | "finance_dashboard"
  | "staff_management"
  | "inventory_management"
  | "audit_logs"
  | "shift_management"
  | "custom_branding"
  | "multi_branch"
  | "market_catalog"
  | "market_import"
  | "market_station";

export type FeatureOverrideMap = Partial<Record<FeatureKey, boolean>>;
export type EffectiveCapabilities = Record<FeatureKey, boolean>;

const PLAN_ORDER: Record<BusinessPlan, number> = {
  starter: 0,
  growth: 1,
  custom: 2,
};

export const PLAN_LABELS: Record<BusinessPlan, string> = {
  starter: "Starter",
  growth: "Growth",
  custom: "Custom",
};

export const FEATURE_META: Record<
  FeatureKey,
  { title: string; description: string; requiredPlan: BusinessPlan }
> = {
  kitchen_display: {
    title: "Mutfak Operasyonu",
    description: "Istasyon bazli mutfak akisi ve hazirlama board'u Growth paketle acilir.",
    requiredPlan: "growth",
  },
  delivery_dispatch: {
    title: "Teslimat ve Kurye",
    description: "Kurye atama, dispatch ve teslimat yonetimi Growth paketle acilir.",
    requiredPlan: "growth",
  },
  advanced_reports: {
    title: "Gelismis Raporlar",
    description: "Detayli satis, cari ve personel raporlari Growth paketle acilir.",
    requiredPlan: "growth",
  },
  finance_dashboard: {
    title: "Finans Panosu",
    description: "Gelir-gider ve odeme dagilimlari Growth paketle acilir.",
    requiredPlan: "growth",
  },
  staff_management: {
    title: "Personel ve Roller",
    description: "Ekip yonetimi ve rol bazli erisim Growth paketle acilir.",
    requiredPlan: "growth",
  },
  inventory_management: {
    title: "Stok ve Recete",
    description: "Stok hareketleri ve urun takibi Growth paketle acilir.",
    requiredPlan: "growth",
  },
  audit_logs: {
    title: "Islem Loglari",
    description: "Operasyon gecmisi ve denetim kayitlari Growth paketle acilir.",
    requiredPlan: "growth",
  },
  shift_management: {
    title: "Gun Islemleri",
    description: "Vardiya ve kasa gun sonu akisi Growth paketle acilir.",
    requiredPlan: "growth",
  },
  custom_branding: {
    title: "Ozel Markalama",
    description: "Marka uyarlama ve ozel ekran tasarimlari Custom paketle acilir.",
    requiredPlan: "custom",
  },
  multi_branch: {
    title: "Coklu Sube",
    description: "Coklu sube ve merkezden yonetim Custom paketle acilir.",
    requiredPlan: "custom",
  },
  market_catalog: {
    title: "Market Katalog",
    description: "Market odakli kategori, barkod ve birim alanlari Growth paketle acilir.",
    requiredPlan: "growth",
  },
  market_import: {
    title: "Market Import",
    description: "JSON dry-run ve commit import paneli Growth paketle acilir.",
    requiredPlan: "growth",
  },
  market_station: {
    title: "Market Istasyonlari",
    description: "Kasiyer, kasap ve sarkuteri istasyon profilleri Growth paketle acilir.",
    requiredPlan: "growth",
  },
};

const PROFILE_FEATURE_ALLOWLIST: Record<BranchProfile, ReadonlySet<FeatureKey>> = {
  restaurant: new Set<FeatureKey>([
    "kitchen_display",
    "delivery_dispatch",
    "advanced_reports",
    "finance_dashboard",
    "staff_management",
    "inventory_management",
    "audit_logs",
    "shift_management",
    "custom_branding",
    "multi_branch",
  ]),
  enterprise_market: new Set<FeatureKey>([
    "advanced_reports",
    "finance_dashboard",
    "staff_management",
    "inventory_management",
    "audit_logs",
    "shift_management",
    "custom_branding",
    "multi_branch",
    "market_catalog",
    "market_import",
    "market_station",
  ]),
};

export function hasFeature(plan: BusinessPlan, feature: FeatureKey) {
  return PLAN_ORDER[plan] >= PLAN_ORDER[FEATURE_META[feature].requiredPlan];
}

export function getRequiredPlan(feature: FeatureKey) {
  return FEATURE_META[feature].requiredPlan;
}

export function getPlanLabel(plan: BusinessPlan) {
  return PLAN_LABELS[plan];
}

export function isFeatureAllowedForBranchProfile(feature: FeatureKey, branchProfile: BranchProfile) {
  return PROFILE_FEATURE_ALLOWLIST[branchProfile].has(feature);
}

export function buildPlanCapabilities(plan: BusinessPlan): EffectiveCapabilities {
  return (Object.keys(FEATURE_META) as FeatureKey[]).reduce((acc, feature) => {
    acc[feature] = hasFeature(plan, feature);
    return acc;
  }, {} as EffectiveCapabilities);
}

export function buildEffectiveCapabilities(input: {
  plan: BusinessPlan;
  branchProfile: BranchProfile;
  overrides?: FeatureOverrideMap;
}): EffectiveCapabilities {
  const base = buildPlanCapabilities(input.plan);
  const overrides = input.overrides ?? {};
  const effective = {} as EffectiveCapabilities;

  for (const feature of Object.keys(FEATURE_META) as FeatureKey[]) {
    const overrideValue = overrides[feature];
    const enabledByPlan = overrideValue ?? base[feature];
    effective[feature] = Boolean(enabledByPlan && isFeatureAllowedForBranchProfile(feature, input.branchProfile));
  }

  return effective;
}
