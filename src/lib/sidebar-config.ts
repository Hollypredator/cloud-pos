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
  { href: "/ops", label: "Yönetim Paneli", icon: "YP", roles: ["admin", "waiter", "kitchen", "cashier"] },
  { href: "/tables", label: "Masa Takip", icon: "MT", roles: ["admin", "waiter", "kitchen", "cashier"] },
  { href: "/admin/orders", label: "Siparisler", icon: "SP", roles: ["owner", "admin", "waiter", "cashier"] },
  { href: "/kitchen", label: "Mutfak", icon: "MK", roles: ["admin", "kitchen"], feature: "kitchen_display" },
  { href: "/admin/reports", label: "Raporlar", icon: "RP", roles: ["admin"], feature: "advanced_reports" },
  { href: "/cashier/session", label: "Gun Islemleri", icon: "GI", roles: ["admin", "cashier"], feature: "shift_management" },
  { href: "/cashier", label: "Adisyonlar", icon: "AD", roles: ["admin", "cashier"] },
  { href: "/admin/audit", label: "İşlem Loglari", icon: "LG", roles: ["admin"], feature: "audit_logs" },
  { href: "/admin/finance", label: "Gelir/Gider", icon: "GG", roles: ["admin"], feature: "finance_dashboard" },
  { href: "/admin/settings", label: "İşletme Ayarlari", icon: "AY", roles: ["owner"] },
  { href: "/admin/businesses", label: "Subeler", icon: "SB", roles: ["owner"], feature: "multi_branch", requiresBusinessScope: true },
  { href: "/admin/products", label: "Urunler", icon: "UR", roles: ["admin"] },
  { href: "/admin/tables", label: "Bölge ve Masa", icon: "MS", roles: ["admin"] },
  { href: "/delivery", label: "Teslimat", icon: "DL", roles: ["admin", "waiter", "cashier"], feature: "delivery_dispatch" },
  { href: "/admin/roles", label: "Personel", icon: "PR", roles: ["owner"], feature: "staff_management" },
];

export const sidebarPresetOrders = {
  owner: {
    management_first: [
      "/ops",
      "/tables",
      "/admin/orders",
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
      "/tables",
      "/admin/orders",
      "/cashier",
      "/kitchen",
      "/delivery",
      "/admin/tables",
      "/cashier/session",
      "/admin/products",
      "/admin/reports",
      "/admin/finance",
      "/admin/audit",
      "/admin/settings",
      "/admin/businesses",
    ],
  },
  admin: {
    management_first: [
      "/ops",
      "/tables",
      "/admin/orders",
      "/admin/products",
      "/admin/tables",
      "/cashier/session",
      "/cashier",
      "/kitchen",
      "/delivery",
      "/admin/reports",
      "/admin/finance",
      "/admin/audit",
    ],
    service_first: [
      "/ops",
      "/tables",
      "/admin/orders",
      "/cashier",
      "/kitchen",
      "/delivery",
      "/admin/tables",
      "/cashier/session",
      "/admin/products",
      "/admin/reports",
      "/admin/finance",
      "/admin/audit",
    ],
  },
} as const;

export const defaultOwnerSidebarOrder = sidebarPresetOrders.owner.management_first;
export const defaultAdminSidebarOrder = sidebarPresetOrders.admin.service_first;
