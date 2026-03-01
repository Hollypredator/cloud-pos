import type { AppRole } from "@/lib/types";
import type { FeatureKey } from "@/lib/features";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  roles: AppRole[];
  feature?: FeatureKey;
  requiresBusinessScope?: boolean;
};

export const operationLinks: SidebarNavItem[] = [
  { href: "/ops", label: "Yonetim Paneli", icon: "YP", roles: ["admin", "waiter", "kitchen", "cashier"] },
  { href: "/kitchen", label: "Mutfak", icon: "MK", roles: ["admin", "kitchen"], feature: "kitchen_display" },
  { href: "/admin/reports", label: "Raporlar", icon: "RP", roles: ["admin"], feature: "advanced_reports" },
  { href: "/cashier/session", label: "Gun Islemleri", icon: "GI", roles: ["admin", "cashier"], feature: "shift_management" },
  { href: "/cashier", label: "Adisyonlar", icon: "AD", roles: ["admin", "cashier"] },
  { href: "/admin/audit", label: "Islem Loglari", icon: "LG", roles: ["admin"], feature: "audit_logs" },
  { href: "/admin/finance", label: "Gelir/Gider", icon: "GG", roles: ["admin"], feature: "finance_dashboard" },
  { href: "/admin/settings", label: "Isletme Ayarlari", icon: "AY", roles: ["admin"] },
  { href: "/admin/businesses", label: "Subeler", icon: "SB", roles: ["admin"], feature: "multi_branch", requiresBusinessScope: true },
  { href: "/admin/products", label: "Urunler", icon: "UR", roles: ["admin"] },
  { href: "/admin/tables", label: "Bolge ve Masa", icon: "MS", roles: ["admin"] },
  { href: "/delivery", label: "Teslimat", icon: "DL", roles: ["admin", "waiter", "cashier"], feature: "delivery_dispatch" },
  { href: "/admin/roles", label: "Personel", icon: "PR", roles: ["admin"], feature: "staff_management" },
];

export const sidebarPresetOrders = {
  owner: {
    management_first: [
      "/ops",
      "/admin/reports",
      "/admin/finance",
      "/admin/audit",
      "/admin/settings",
      "/admin/businesses",
      "/admin/roles",
      "/admin/products",
      "/admin/tables",
      "/cashier/session",
      "/cashier",
      "/kitchen",
      "/delivery",
    ],
    service_first: [
      "/ops",
      "/cashier",
      "/kitchen",
      "/delivery",
      "/admin/tables",
      "/cashier/session",
      "/admin/orders",
      "/admin/products",
      "/admin/reports",
      "/admin/finance",
      "/admin/audit",
      "/admin/roles",
      "/admin/settings",
      "/admin/businesses",
    ],
  },
  admin: {
    management_first: [
      "/ops",
      "/admin/products",
      "/admin/tables",
      "/cashier/session",
      "/cashier",
      "/kitchen",
      "/delivery",
      "/admin/reports",
      "/admin/finance",
      "/admin/audit",
      "/admin/roles",
      "/admin/settings",
    ],
    service_first: [
      "/ops",
      "/cashier",
      "/kitchen",
      "/delivery",
      "/admin/tables",
      "/cashier/session",
      "/admin/products",
      "/admin/reports",
      "/admin/finance",
      "/admin/audit",
      "/admin/roles",
      "/admin/settings",
    ],
  },
} as const;

export const defaultOwnerSidebarOrder = sidebarPresetOrders.owner.management_first;
export const defaultAdminSidebarOrder = sidebarPresetOrders.admin.service_first;

