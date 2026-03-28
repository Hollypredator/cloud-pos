import type { BusinessPlan } from "@/lib/types";

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
  | "multi_branch";

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
    description: "Istasyon bazli mutfak akışı ve hazirlama board'u Growth paketle açılır.",
    requiredPlan: "growth",
  },
  delivery_dispatch: {
    title: "Teslimat ve Kurye",
    description: "Kurye atama, dispatch ve teslimat yönetimi Growth paketle açılır.",
    requiredPlan: "growth",
  },
  advanced_reports: {
    title: "Gelismis Raporlar",
    description: "Detayli satis, cari ve personel raporlari Growth paketle açılır.",
    requiredPlan: "growth",
  },
  finance_dashboard: {
    title: "Finans Panosu",
    description: "Gelir-gider, ödeme dagilimlari ve detayli finans yorumu Growth paketle açılır.",
    requiredPlan: "growth",
  },
  staff_management: {
    title: "Personel ve Roller",
    description: "Ekip yönetimi ve rol bazli erişim Growth paketle açılır.",
    requiredPlan: "growth",
  },
  inventory_management: {
    title: "Stok ve Reçete",
    description: "Stok hareketleri ve ürün takibi Growth paketle açılır.",
    requiredPlan: "growth",
  },
  audit_logs: {
    title: "İşlem Loglari",
    description: "Operasyon gecmisi ve denetim kayıtları Growth paketle açılır.",
    requiredPlan: "growth",
  },
  shift_management: {
    title: "Gun Islemleri",
    description: "Vardiya ve kasa gun sonu akışı Growth paketle açılır.",
    requiredPlan: "growth",
  },
  custom_branding: {
    title: "Özel Markalama",
    description: "Marka uyarlama ve özel ekran tasarimlari Custom paketle açılır.",
    requiredPlan: "custom",
  },
  multi_branch: {
    title: "Coklu Şube",
    description: "Coklu şube ve merkezden yönetim Custom paketle açılır.",
    requiredPlan: "custom",
  },
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
