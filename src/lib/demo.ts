import type { AppRole } from "@/lib/types";

export type DemoStaffAccount = {
  fullName: string;
  email: string;
  password: string;
  role: AppRole;
  summary: string;
};

export type DemoPresentationItem = {
  title: string;
  body: string;
};

export type DemoPackage = {
  name: string;
  price: string;
  summary: string;
};

export type DemoSectionStyle = {
  paddingTop: number;
  paddingBottom: number;
  contentPadding: number;
  radius: number;
  surface: "transparent" | "white" | "glass" | "dark";
};

export type DemoSectionStyles = Record<
  "hero" | "metrics" | "presentation" | "accounts" | "orders" | "tables" | "stock" | "packages" | "closing",
  DemoSectionStyle
>;

export type DemoPageContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  previewBadge: string;
  opsCtaLabel: string;
  loginCtaLabel: string;
  showMetrics: boolean;
  showPresentationFlow: boolean;
  flowEyebrow: string;
  flowTitle: string;
  showStaffAccounts: boolean;
  accountsEyebrow: string;
  accountsTitle: string;
  accountsBody: string;
  showRecentOrders: boolean;
  recentOrdersTitle: string;
  recentOrdersCtaLabel: string;
  showTableStatus: boolean;
  tableStatusTitle: string;
  showLowStock: boolean;
  lowStockTitle: string;
  lowStockLabel: string;
  showPackages: boolean;
  showClosingCta: boolean;
  closingCtaTitle: string;
  closingCtaBody: string;
  closingCtaPrimaryLabel: string;
  closingCtaSecondaryLabel: string;
  sectionStyles: DemoSectionStyles;
  packages: DemoPackage[];
  presentationFlow: DemoPresentationItem[];
  staffAccounts: DemoStaffAccount[];
};

export const defaultDemoSectionStyles: DemoSectionStyles = {
  hero: { paddingTop: 0, paddingBottom: 0, contentPadding: 0, radius: 32, surface: "transparent" },
  metrics: { paddingTop: 0, paddingBottom: 0, contentPadding: 0, radius: 24, surface: "transparent" },
  presentation: { paddingTop: 0, paddingBottom: 0, contentPadding: 0, radius: 24, surface: "transparent" },
  accounts: { paddingTop: 0, paddingBottom: 0, contentPadding: 0, radius: 24, surface: "transparent" },
  orders: { paddingTop: 0, paddingBottom: 0, contentPadding: 0, radius: 24, surface: "transparent" },
  tables: { paddingTop: 0, paddingBottom: 0, contentPadding: 0, radius: 24, surface: "transparent" },
  stock: { paddingTop: 0, paddingBottom: 0, contentPadding: 0, radius: 24, surface: "transparent" },
  packages: { paddingTop: 0, paddingBottom: 0, contentPadding: 0, radius: 24, surface: "transparent" },
  closing: { paddingTop: 0, paddingBottom: 0, contentPadding: 0, radius: 32, surface: "transparent" },
};

export const defaultDemoStaffAccounts: DemoStaffAccount[] = [
  {
    fullName: "Aylin Demir",
    email: "demo-admin@cloudpos.local",
    password: "Demo123!",
    role: "owner",
    summary: "Tüm yönetim ekranlari, ürünler, masalar ve raporlar için ana hesap.",
  },
  {
    fullName: "Mert Kaya",
    email: "demo-kasa@cloudpos.local",
    password: "Demo123!",
    role: "cashier",
    summary: "Kasa, ödeme tamamlama, vardiya acilis ve gün sonu kontrolleri için.",
  },
  {
    fullName: "Selin Acar",
    email: "demo-mutfak@cloudpos.local",
    password: "Demo123!",
    role: "kitchen",
    summary: "Mutfak kuyrugu, hazırlama ve sipariş ilerletme akışı için.",
  },
  {
    fullName: "Can Yildiz",
    email: "demo-servis@cloudpos.local",
    password: "Demo123!",
    role: "waiter",
    summary: "Masa talepleri, servis operasyonu ve masa durumu için.",
  },
];

export const defaultDemoPresentationFlow: DemoPresentationItem[] = [
  {
    title: "1. Giriş ve Rol Ayrimi",
    body: "Admin hesabi ile girip tek ekrandan ürün, masa ve personel yönetimini göster.",
  },
  {
    title: "2. Müşteri Siparişi",
    body: "QR menü veya masa siparişi uzerinden gelen siparişin mutfaga nasıl dustugunu anlat.",
  },
  {
    title: "3. Mutfak ve Kasa Akışı",
    body: "Mutfakta hazırlama, kasada ödeme tamamlama ve masa bosaltma akışını takip et.",
  },
  {
    title: "4. Yönetim ve Raporlama",
    body: "Gün sonu ciro, kritik stok ve rol yönetimi ekranlarini kapatista sun.",
  },
];

export const defaultDemoPackages: DemoPackage[] = [
  {
    name: "Starter",
    price: "29.900 TL",
    summary: "Tek şube, QR menü ve temel operasyon paneli ile hızlı kurulum.",
  },
  {
    name: "Growth",
    price: "54.900 TL",
    summary: "Kasa vardiya, raporlar, stok takibi ve rol bazli ekip yönetimi dahil.",
  },
  {
    name: "Custom",
    price: "Teklif",
    summary: "Marka uyarlama, özel entegrasyonlar ve saha kurulumu ile teslim.",
  },
];

export const demoStaffAccounts = defaultDemoStaffAccounts;
export const demoPresentationFlow = defaultDemoPresentationFlow;
export const demoPackages = defaultDemoPackages;

export const defaultDemoPageContent: DemoPageContent = {
  heroEyebrow: "Cloud POS",
  heroTitle: "Demo Operasyon Paneli",
  heroBody:
    "Bu ekran tanitim gorusmeleri için hazırlandi. Veriler canli sistem hissi vermek için kurgulanmis Örnek senaryo uzerinden akar.",
  previewBadge: "Demo Preview",
  opsCtaLabel: "Personel Paneli",
  loginCtaLabel: "Personel Girişi",
  showMetrics: true,
  showPresentationFlow: true,
  flowEyebrow: "Sunum Sırasi",
  flowTitle: "Müşteriye nasıl anlatacaksin",
  showStaffAccounts: true,
  accountsEyebrow: "Hazır Demo Hesaplari",
  accountsTitle: "Rol bazli kullanicilar",
  accountsBody: "Bu hesaplari admin panelinden tek tikla olusturup tanitimda farkli rol ekranlarini gösterebilirsin.",
  showRecentOrders: true,
  recentOrdersTitle: "Son Siparişler",
  recentOrdersCtaLabel: "Gerçek panele gec",
  showTableStatus: true,
  tableStatusTitle: "Masa Durumu",
  showLowStock: true,
  lowStockTitle: "Kritik Stok",
  lowStockLabel: "Örnek veri",
  showPackages: true,
  showClosingCta: false,
  closingCtaTitle: "Demo sonrasinda canli kuruluma gecin",
  closingCtaBody: "Marka uyarlama, ekip kurulumu ve şube bazli operasyon kurgusunu canli ortama birlikte tasiyalim.",
  closingCtaPrimaryLabel: "Teklif Planla",
  closingCtaSecondaryLabel: "Canlı Demoya Dön",
  sectionStyles: defaultDemoSectionStyles,
  packages: defaultDemoPackages,
  presentationFlow: defaultDemoPresentationFlow,
  staffAccounts: defaultDemoStaffAccounts,
};

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
}

function sanitizeSectionStyle(value: unknown, fallback: DemoSectionStyle): DemoSectionStyle {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<DemoSectionStyle>;
  return {
    paddingTop: typeof item.paddingTop === "number" ? item.paddingTop : fallback.paddingTop,
    paddingBottom: typeof item.paddingBottom === "number" ? item.paddingBottom : fallback.paddingBottom,
    contentPadding: typeof item.contentPadding === "number" ? item.contentPadding : fallback.contentPadding,
    radius: typeof item.radius === "number" ? item.radius : fallback.radius,
    surface:
      item.surface === "transparent" || item.surface === "white" || item.surface === "glass" || item.surface === "dark"
        ? item.surface
        : fallback.surface,
  };
}

function sanitizeSectionStyles(value: unknown, fallback: DemoSectionStyles): DemoSectionStyles {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<Record<keyof DemoSectionStyles, DemoSectionStyle>>;
  return {
    hero: sanitizeSectionStyle(item.hero, fallback.hero),
    metrics: sanitizeSectionStyle(item.metrics, fallback.metrics),
    presentation: sanitizeSectionStyle(item.presentation, fallback.presentation),
    accounts: sanitizeSectionStyle(item.accounts, fallback.accounts),
    orders: sanitizeSectionStyle(item.orders, fallback.orders),
    tables: sanitizeSectionStyle(item.tables, fallback.tables),
    stock: sanitizeSectionStyle(item.stock, fallback.stock),
    packages: sanitizeSectionStyle(item.packages, fallback.packages),
    closing: sanitizeSectionStyle(item.closing, fallback.closing),
  };
}

function sanitizePresentationFlow(value: unknown, fallback: DemoPresentationItem[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => ({
      title: sanitizeText(item?.title),
      body: sanitizeText(item?.body),
    }))
    .filter((item) => item.title || item.body);
  return items.length > 0 ? items : fallback;
}

function sanitizePackages(value: unknown, fallback: DemoPackage[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => ({
      name: sanitizeText(item?.name),
      price: sanitizeText(item?.price),
      summary: sanitizeText(item?.summary),
    }))
    .filter((item) => item.name || item.price || item.summary);
  return items.length > 0 ? items : fallback;
}

function sanitizeStaffAccounts(value: unknown, fallback: DemoStaffAccount[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => ({
      fullName: sanitizeText(item?.fullName),
      email: sanitizeText(item?.email),
      password: sanitizeText(item?.password, "Demo123!"),
      role:
        item?.role === "owner" || item?.role === "admin" || item?.role === "waiter" || item?.role === "kitchen" || item?.role === "cashier"
          ? item.role
          : "owner",
      summary: sanitizeText(item?.summary),
    }))
    .filter((item) => item.fullName || item.email || item.summary);
  return items.length > 0 ? items : fallback;
}

export function normalizeDemoPageContent(input?: Partial<DemoPageContent> | null): DemoPageContent {
  const merged = {
    ...defaultDemoPageContent,
    ...(input ?? {}),
  };

  return {
    heroEyebrow: sanitizeText(merged.heroEyebrow, defaultDemoPageContent.heroEyebrow),
    heroTitle: sanitizeText(merged.heroTitle, defaultDemoPageContent.heroTitle),
    heroBody: sanitizeText(merged.heroBody, defaultDemoPageContent.heroBody),
    previewBadge: sanitizeText(merged.previewBadge, defaultDemoPageContent.previewBadge),
    opsCtaLabel: sanitizeText(merged.opsCtaLabel, defaultDemoPageContent.opsCtaLabel),
    loginCtaLabel: sanitizeText(merged.loginCtaLabel, defaultDemoPageContent.loginCtaLabel),
    showMetrics: sanitizeBoolean(merged.showMetrics, defaultDemoPageContent.showMetrics),
    showPresentationFlow: sanitizeBoolean(merged.showPresentationFlow, defaultDemoPageContent.showPresentationFlow),
    flowEyebrow: sanitizeText(merged.flowEyebrow, defaultDemoPageContent.flowEyebrow),
    flowTitle: sanitizeText(merged.flowTitle, defaultDemoPageContent.flowTitle),
    showStaffAccounts: sanitizeBoolean(merged.showStaffAccounts, defaultDemoPageContent.showStaffAccounts),
    accountsEyebrow: sanitizeText(merged.accountsEyebrow, defaultDemoPageContent.accountsEyebrow),
    accountsTitle: sanitizeText(merged.accountsTitle, defaultDemoPageContent.accountsTitle),
    accountsBody: sanitizeText(merged.accountsBody, defaultDemoPageContent.accountsBody),
    showRecentOrders: sanitizeBoolean(merged.showRecentOrders, defaultDemoPageContent.showRecentOrders),
    recentOrdersTitle: sanitizeText(merged.recentOrdersTitle, defaultDemoPageContent.recentOrdersTitle),
    recentOrdersCtaLabel: sanitizeText(merged.recentOrdersCtaLabel, defaultDemoPageContent.recentOrdersCtaLabel),
    showTableStatus: sanitizeBoolean(merged.showTableStatus, defaultDemoPageContent.showTableStatus),
    tableStatusTitle: sanitizeText(merged.tableStatusTitle, defaultDemoPageContent.tableStatusTitle),
    showLowStock: sanitizeBoolean(merged.showLowStock, defaultDemoPageContent.showLowStock),
    lowStockTitle: sanitizeText(merged.lowStockTitle, defaultDemoPageContent.lowStockTitle),
    lowStockLabel: sanitizeText(merged.lowStockLabel, defaultDemoPageContent.lowStockLabel),
    showPackages: sanitizeBoolean(merged.showPackages, defaultDemoPageContent.showPackages),
    showClosingCta: sanitizeBoolean(merged.showClosingCta, defaultDemoPageContent.showClosingCta),
    closingCtaTitle: sanitizeText(merged.closingCtaTitle, defaultDemoPageContent.closingCtaTitle),
    closingCtaBody: sanitizeText(merged.closingCtaBody, defaultDemoPageContent.closingCtaBody),
    closingCtaPrimaryLabel: sanitizeText(merged.closingCtaPrimaryLabel, defaultDemoPageContent.closingCtaPrimaryLabel),
    closingCtaSecondaryLabel: sanitizeText(merged.closingCtaSecondaryLabel, defaultDemoPageContent.closingCtaSecondaryLabel),
    sectionStyles: sanitizeSectionStyles(merged.sectionStyles, defaultDemoPageContent.sectionStyles),
    packages: sanitizePackages(merged.packages, defaultDemoPageContent.packages),
    presentationFlow: sanitizePresentationFlow(merged.presentationFlow, defaultDemoPageContent.presentationFlow),
    staffAccounts: sanitizeStaffAccounts(merged.staffAccounts, defaultDemoPageContent.staffAccounts),
  };
}
