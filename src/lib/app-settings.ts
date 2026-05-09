export type GeneralSettings = {
  siteName: string;
  siteTagline: string;
  contactPhone: string;
  whatsappPhone: string;
  supportEmail: string;
  address: string;
  logoUrl: string;
  footerNote: string;
};

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  notificationEmail: string;
};

export type SeoSettings = {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  twitterHandle: string;
  indexable: boolean;
  canonicalUrl: string;
};

export type ApplicationSettings = {
  appPrintingEnabled: boolean;
  demoMode: boolean;
  embeddedDemoCatalogEnabled: boolean;
  mobileAppExperienceEnabled: boolean;
  mobileReadOnlyPwaEnabled: boolean;
  autoSessionCloseEnabled: boolean;
  autoSessionCloseTime: string;
  requireNoOpenChecksForSessionClose: boolean;
  sidebarTheme: "ember" | "ocean" | "night";
  sidebarOrder: "default" | "service_first" | "management_first";
  sidebarAccentColor: string;
  ownerSidebarOrder: string[];
  adminSidebarOrder: string[];
};

export const sidebarThemeOptions = [
  { value: "ember", label: "Sicak Turuncu" },
  { value: "ocean", label: "Okyanus" },
  { value: "night", label: "Gece Grafit" },
] as const;

export const sidebarOrderOptions = [
  { value: "default", label: "Dengeli Standart" },
  { value: "service_first", label: "Servis Önce" },
  { value: "management_first", label: "Yönetim Önce" },
] as const;

export const defaultGeneralSettings: GeneralSettings = {
  siteName: "Cloud POS",
  siteTagline: "Yeni nesil cafe ve restoran operasyonu",
  contactPhone: "+90 555 000 00 00",
  whatsappPhone: "+90 555 000 00 00",
  supportEmail: "info@cloudpos.local",
  address: "Istanbul",
  logoUrl: "",
  footerNote: "Cloud POS ile masa, sipariş, mutfak ve kasa akislarini tek panelde yönetin.",
};

export const defaultSmtpSettings: SmtpSettings = {
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  fromEmail: "",
  fromName: "Cloud POS",
  replyToEmail: "",
  notificationEmail: "",
};

export const defaultSeoSettings: SeoSettings = {
  metaTitle: "Cloud POS | Cafe ve restoran operasyonu",
  metaDescription: "Cloud POS ile masa, sipariş, mutfak, kasa ve raporlama akislarini tek panelde yönetin.",
  ogTitle: "Cloud POS",
  ogDescription: "Cafe ve restoranlar için yeni nesil operasyon, QR menü ve raporlama platformu.",
  ogImageUrl: "",
  twitterHandle: "",
  indexable: true,
  canonicalUrl: "",
};

export const defaultApplicationSettings: ApplicationSettings = {
  appPrintingEnabled: false,
  demoMode: false,
  embeddedDemoCatalogEnabled: true,
  mobileAppExperienceEnabled: true,
  mobileReadOnlyPwaEnabled: false,
  autoSessionCloseEnabled: false,
  autoSessionCloseTime: "00:00",
  requireNoOpenChecksForSessionClose: true,
  sidebarTheme: "ember",
  sidebarOrder: "default",
  sidebarAccentColor: "#ff7848",
  ownerSidebarOrder: [],
  adminSidebarOrder: [],
};

function normalizeHexColor(value: string | undefined) {
  const normalized = (value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : defaultApplicationSettings.sidebarAccentColor;
}

function normalizeSidebarOrder(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.startsWith("/"));
}

function normalizeTimeValue(value: unknown) {
  const normalized = String(value ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : defaultApplicationSettings.autoSessionCloseTime;
}

export function normalizeGeneralSettings(input?: Partial<GeneralSettings> | null): GeneralSettings {
  return {
    ...defaultGeneralSettings,
    ...(input ?? {}),
  };
}

export function normalizeSmtpSettings(input?: Partial<SmtpSettings> | null): SmtpSettings {
  const merged = {
    ...defaultSmtpSettings,
    ...(input ?? {}),
  };

  return {
    ...merged,
    port: Number(merged.port) || defaultSmtpSettings.port,
    secure: Boolean(merged.secure),
  };
}

export function isSmtpConfigured(settings: SmtpSettings) {
  return Boolean(settings.host && settings.port && settings.username && settings.password && settings.fromEmail);
}

export function normalizeSeoSettings(input?: Partial<SeoSettings> | null): SeoSettings {
  const merged = {
    ...defaultSeoSettings,
    ...(input ?? {}),
  };

  return {
    ...merged,
    indexable: Boolean(merged.indexable),
  };
}

export function normalizeApplicationSettings(input?: Partial<ApplicationSettings> | null): ApplicationSettings {
  const merged = {
    ...defaultApplicationSettings,
    ...(input ?? {}),
  };

  return {
    appPrintingEnabled: Boolean(merged.appPrintingEnabled),
    demoMode: Boolean(merged.demoMode),
    embeddedDemoCatalogEnabled:
      typeof merged.embeddedDemoCatalogEnabled === "boolean"
        ? merged.embeddedDemoCatalogEnabled
        : defaultApplicationSettings.embeddedDemoCatalogEnabled,
    mobileAppExperienceEnabled: Boolean(merged.mobileAppExperienceEnabled),
    mobileReadOnlyPwaEnabled: Boolean(merged.mobileReadOnlyPwaEnabled),
    autoSessionCloseEnabled: Boolean(merged.autoSessionCloseEnabled),
    autoSessionCloseTime: normalizeTimeValue(merged.autoSessionCloseTime),
    requireNoOpenChecksForSessionClose: Boolean(merged.requireNoOpenChecksForSessionClose),
    sidebarTheme:
      merged.sidebarTheme === "ocean" || merged.sidebarTheme === "night" ? merged.sidebarTheme : "ember",
    sidebarOrder:
      merged.sidebarOrder === "service_first" || merged.sidebarOrder === "management_first"
        ? merged.sidebarOrder
        : "default",
    sidebarAccentColor: normalizeHexColor(typeof merged.sidebarAccentColor === "string" ? merged.sidebarAccentColor : undefined),
    ownerSidebarOrder: normalizeSidebarOrder(merged.ownerSidebarOrder),
    adminSidebarOrder: normalizeSidebarOrder(merged.adminSidebarOrder),
  };
}
