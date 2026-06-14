import type { AppRole, BusinessType } from "@/lib/types";
import type { FeatureKey } from "@/lib/features";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  roles: AppRole[];
  feature?: FeatureKey;
  requiresBusinessScope?: boolean;
  businessTypes?: BusinessType[];
};

export const operationLinks: SidebarNavItem[] = [
  { href: "/ops", label: "Yönetim Paneli", icon: "YP", roles: ["admin", "kitchen", "cashier"] },
  { href: "/tables", label: "Masa Takip", icon: "MT", roles: ["admin", "kitchen", "cashier"], businessTypes: ["restaurant_cafe"] },
  { href: "/admin/orders", label: "Siparişler", icon: "SP", roles: ["owner", "admin", "waiter", "cashier"] },
  { href: "/pickup-board", label: "Pickup Board", icon: "PB", roles: ["admin", "kitchen", "cashier"], businessTypes: ["self_service_coffee"] },
  { href: "/kitchen", label: "Mutfak", icon: "MK", roles: ["admin", "kitchen"], feature: "kitchen_display", businessTypes: ["restaurant_cafe"] },
  { href: "/admin/reports", label: "Raporlar", icon: "RP", roles: ["admin"], feature: "advanced_reports", businessTypes: ["restaurant_cafe", "self_service_coffee"] },
  { href: "/cashier/session", label: "Gün İşlemleri", icon: "GI", roles: ["admin", "cashier"], feature: "shift_management" },
  { href: "/cashier", label: "Adisyonlar", icon: "AD", roles: ["admin", "cashier", "waiter"] },
  { href: "/admin/audit", label: "Islem Loglari", icon: "LG", roles: ["admin"], feature: "audit_logs", businessTypes: ["restaurant_cafe"] },
  { href: "/admin/finance", label: "Gelir/Gider", icon: "GG", roles: ["admin"], feature: "finance_dashboard", businessTypes: ["restaurant_cafe"] },
  { href: "/admin/accounting", label: "Muhasebe", icon: "MH", roles: ["admin"], feature: "finance_dashboard", businessTypes: ["restaurant_cafe"] },
  { href: "/admin/stock", label: "Stok", icon: "ST", roles: ["admin"], feature: "inventory_management", businessTypes: ["restaurant_cafe", "self_service_coffee"] },
  { href: "/admin/settings", label: "İşletme Ayarlar?", icon: "AY", roles: ["owner"], businessTypes: ["restaurant_cafe", "self_service_coffee"] },
  { href: "/admin/businesses", label: "Şubeler", icon: "SB", roles: ["owner"], feature: "multi_branch", requiresBusinessScope: true, businessTypes: ["restaurant_cafe", "self_service_coffee"] },
  { href: "/admin/products", label: "Ürünler", icon: "UR", roles: ["admin"] },
  { href: "/admin/tables", label: "Bolge ve Masa", icon: "MS", roles: ["admin"], businessTypes: ["restaurant_cafe"] },
  { href: "/delivery", label: "Teslimat", icon: "DL", roles: ["admin", "cashier"], feature: "delivery_dispatch", businessTypes: ["restaurant_cafe"] },
  { href: "/admin/roles", label: "Personel", icon: "PR", roles: ["owner"], feature: "staff_management", businessTypes: ["restaurant_cafe", "self_service_coffee"] },
];

export const marketOperationLinks: SidebarNavItem[] = [
  { href: "/cashier", label: "Satış", icon: "S", roles: ["admin", "cashier", "waiter"] },
  { href: "/cashier/session", label: "Hesap", icon: "H", roles: ["admin", "cashier"], feature: "shift_management" },
  { href: "/admin/orders", label: "Operasyon", icon: "O", roles: ["owner", "admin", "waiter", "cashier"] },
  { href: "/admin/products", label: "Ürün", icon: "U", roles: ["admin"], feature: "market_catalog" },
  { href: "/admin/stock", label: "Stok", icon: "T", roles: ["admin"], feature: "inventory_management" },
  { href: "/admin/reports", label: "Rapor", icon: "R", roles: ["admin"], feature: "advanced_reports" },
  { href: "/admin/finance", label: "Finans", icon: "F", roles: ["admin"], feature: "finance_dashboard" },
  { href: "/admin/settings", label: "Ayar", icon: "A", roles: ["owner"] },
];

export const sidebarPresetOrders = {
  owner: {
    management_first: [
      "/ops",
      "/tables",
      "/admin/orders",
      "/admin/reports",
      "/admin/finance",
      "/admin/accounting",
      "/admin/stock",
      "/admin/audit",
      "/admin/settings",
      "/admin/businesses",
      "/admin/roles",
      "/admin/products",
      "/admin/tables",
      "/cashier/session",
      "/cashier",
      "/kitchen",
      "/pickup-board",
      "/delivery",
    ],
    service_first: [
      "/ops",
      "/tables",
      "/admin/orders",
      "/cashier",
      "/kitchen",
      "/pickup-board",
      "/delivery",
      "/admin/tables",
      "/cashier/session",
      "/admin/products",
      "/admin/reports",
      "/admin/finance",
      "/admin/accounting",
      "/admin/stock",
      "/admin/audit",
      "/admin/settings",
      "/admin/businesses",
      "/admin/roles",
    ],
  },
  admin: {
    management_first: [
      "/ops",
      "/tables",
      "/admin/orders",
      "/admin/products",
      "/admin/stock",
      "/admin/tables",
      "/cashier/session",
      "/cashier",
      "/kitchen",
      "/pickup-board",
      "/delivery",
      "/admin/reports",
      "/admin/finance",
      "/admin/accounting",
      "/admin/audit",
    ],
    service_first: [
      "/ops",
      "/tables",
      "/admin/orders",
      "/cashier",
      "/kitchen",
      "/pickup-board",
      "/delivery",
      "/admin/tables",
      "/cashier/session",
      "/admin/products",
      "/admin/stock",
      "/admin/reports",
      "/admin/finance",
      "/admin/accounting",
      "/admin/audit",
    ],
  },
} as const;

export const defaultOwnerSidebarOrder = sidebarPresetOrders.owner.management_first;
export const defaultAdminSidebarOrder = sidebarPresetOrders.admin.service_first;
