export type LandingFeatureItem = {
  title: string;
  body: string;
};

export type LandingProcessItem = {
  title: string;
  body: string;
};

export type LandingPackage = {
  name: string;
  price: string;
  summary: string;
};

export type LandingFaqItem = {
  title: string;
  body: string;
};

export type LandingSectionStyle = {
  paddingTop: number;
  paddingBottom: number;
  paddingX: number;
  radius: number;
  containerWidth: "narrow" | "default" | "wide";
  surface: "transparent" | "white" | "glass" | "dark";
  border: "none" | "light" | "strong";
  shadow: "none" | "soft" | "medium" | "strong";
  textAlign: "left" | "center";
};

type LandingSectionBase = {
  id: string;
  style: LandingSectionStyle;
};

export type LandingSection =
  | (LandingSectionBase & {
      type: "hero";
      badge: string;
      title: string;
      body: string;
      primaryCtaLabel: string;
      secondaryCtaLabel: string;
    })
  | (LandingSectionBase & {
      type: "feature_grid";
      eyebrow: string;
      items: LandingFeatureItem[];
    })
  | (LandingSectionBase & {
      type: "process_steps";
      eyebrow: string;
      items: LandingProcessItem[];
    })
  | (LandingSectionBase & {
      type: "pricing_grid";
      eyebrow: string;
      items: LandingPackage[];
    })
  | (LandingSectionBase & {
      type: "credibility";
      eyebrow: string;
      title: string;
      body: string;
      references: string[];
    })
  | (LandingSectionBase & {
      type: "faq_grid";
      eyebrow: string;
      items: LandingFaqItem[];
    })
  | (LandingSectionBase & {
      type: "contact_cta";
      eyebrow: string;
      title: string;
      body: string;
    });

export type LegacyLandingContentShape = {
  heroBadge?: string;
  heroTitle?: string;
  heroBody?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  highlights?: LandingFeatureItem[];
  packages?: LandingPackage[];
  objections?: LandingFaqItem[];
  references?: string[];
  credibilityTitle?: string;
  credibilityBody?: string;
};

export type LandingContent = {
  pageTitle: string;
  topLoginLabel: string;
  topDemoLabel: string;
  businessPhone: string;
  sections: LandingSection[];
};

export const defaultLandingContent: LandingContent = {
  pageTitle: "Ana Sayfa",
  topLoginLabel: "Personel Girisi",
  topDemoLabel: "Demo Panel",
  businessPhone: "+90 555 000 00 00",
  sections: [
    {
      id: "hero-main",
      style: { paddingTop: 40, paddingBottom: 56, paddingX: 0, radius: 32, containerWidth: "wide", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type: "hero",
      badge: "Cloud POS",
      title: "Cafe ve restoran operasyonunu tek panelden yonetin.",
      body:
        "Cloud POS; masa, adisyon, mutfak, kasa ve yonetsel raporlari ayni sistemde toplar. Musteri menuyu kendi telefonunda gorur, siparis ve operasyon akisi personel tarafindan yonetilir.",
      primaryCtaLabel: "Panele Giris",
      secondaryCtaLabel: "Demo Incele",
    },
    {
      id: "feature-grid-main",
      style: { paddingTop: 24, paddingBottom: 28, paddingX: 0, radius: 32, containerWidth: "wide", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type: "feature_grid",
      eyebrow: "One Cikanlar",
      items: [
        {
          title: "QR Menu",
          body: "Musteri masada menuyu kendi telefonundan gorur, siparis akisi personel tarafindan yonetilir.",
        },
        {
          title: "Canli Operasyon",
          body: "Mutfak, kasa ve servis ekipleri ayni akisi es zamanli izler ve operasyon kopmadan ilerler.",
        },
        {
          title: "Yonetsel Kontrol",
          body: "Masa, urun, roller, finans ve raporlar tek panelden yonetilir.",
        },
      ],
    },
    {
      id: "process-main",
      style: { paddingTop: 28, paddingBottom: 28, paddingX: 0, radius: 32, containerWidth: "default", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type: "process_steps",
      eyebrow: "Nasil Calisir",
      items: [
        { title: "1. Kurulum", body: "Isletme, sube, masa ve personel yapisi kisa surede hazirlanir." },
        { title: "2. Operasyon", body: "Adisyon, mutfak, servis ve kasa akisi ayni sistemde ilerler." },
        { title: "3. Takip", body: "Gun sonu, finans ve yonetsel raporlar panel uzerinden izlenir." },
      ],
    },
    {
      id: "pricing-main",
      style: { paddingTop: 28, paddingBottom: 32, paddingX: 0, radius: 32, containerWidth: "wide", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type: "pricing_grid",
      eyebrow: "Paketler",
      items: [
        {
          name: "Starter",
          price: "29.900 TL",
          summary: "Tek sube, QR menu ve temel operasyon modulleriyle hizli baslangic.",
        },
        {
          name: "Growth",
          price: "54.900 TL",
          summary: "Kasa, vardiya, rapor, stok ve rol bazli ekip yonetimi dahil.",
        },
        {
          name: "Custom",
          price: "Teklif",
          summary: "Marka uyarlama, ozel entegrasyonlar ve kuruma ozel operasyon kurgusu.",
        },
      ],
    },
    {
      id: "credibility-main",
      style: { paddingTop: 28, paddingBottom: 28, paddingX: 0, radius: 32, containerWidth: "default", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type: "credibility",
      eyebrow: "Neden Cloud POS",
      title: "Operasyonun diline uygun, sahada kullanima hazir",
      body:
        "Mutfak, kasa, servis ve yonetim ekranlari rol bazli ayrilir. Boylesiyle ekipler kendi is akisini gorur, yonetim ise tum resmi tek panelden takip eder.",
      references: ["Nord Roast", "Atelier Bakehouse", "Mimoza Brasserie", "Kule Kahve"],
    },
    {
      id: "contact-main",
      style: { paddingTop: 28, paddingBottom: 32, paddingX: 0, radius: 32, containerWidth: "default", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type: "contact_cta",
      eyebrow: "Iletisim",
      title: "Demo ve kurulum sureci icin bizimle iletisime gecin",
      body: "Bilgilerinizi birakin. Isterseniz dogrudan WhatsApp veya telefon uzerinden de bize ulasabilirsiniz.",
    },
    {
      id: "faq-main",
      style: { paddingTop: 28, paddingBottom: 48, paddingX: 0, radius: 32, containerWidth: "wide", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type: "faq_grid",
      eyebrow: "Sik Sorulan Sorular",
      items: [
        {
          title: "Kurulum ne kadar surer?",
          body: "Kurulum suresi isletmenin sube, urun ve operasyon yapisina gore planlanir. Pilot kurulumlar kisa surede baslatilabilir.",
        },
        {
          title: "Ekipler farkli ekran mi kullanir?",
          body: "Evet. Mutfak, kasa, servis ve yonetim ayni sistemin rol bazli ayri ekranlarini kullanir.",
        },
        {
          title: "QR ile siparis aliniyor mu?",
          body: "Hayir. QR tarafi su an sadece menu goruntuleme icin kullanilir; siparis ekleme personel ekranlarindan yapilir.",
        },
      ],
    },
  ],
};

export const emptyLandingContent: LandingContent = {
  pageTitle: "Yeni Sayfa",
  topLoginLabel: defaultLandingContent.topLoginLabel,
  topDemoLabel: defaultLandingContent.topDemoLabel,
  businessPhone: defaultLandingContent.businessPhone,
  sections: [],
};

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeNumber(value: unknown, fallback: number, min = 0, max = 240) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function sanitizeSectionStyle(value: unknown, fallback: LandingSectionStyle): LandingSectionStyle {
  const style = typeof value === "object" && value ? (value as Record<string, unknown>) : {};

  return {
    paddingTop: sanitizeNumber(style.paddingTop, fallback.paddingTop),
    paddingBottom: sanitizeNumber(style.paddingBottom, fallback.paddingBottom),
    paddingX: sanitizeNumber(style.paddingX, fallback.paddingX),
    radius: sanitizeNumber(style.radius, fallback.radius, 0, 64),
    containerWidth:
      style.containerWidth === "narrow" || style.containerWidth === "default" || style.containerWidth === "wide"
        ? style.containerWidth
        : fallback.containerWidth,
    surface:
      style.surface === "transparent" || style.surface === "white" || style.surface === "glass" || style.surface === "dark"
        ? style.surface
        : fallback.surface,
    border:
      style.border === "none" || style.border === "light" || style.border === "strong"
        ? style.border
        : fallback.border,
    shadow:
      style.shadow === "none" || style.shadow === "soft" || style.shadow === "medium" || style.shadow === "strong"
        ? style.shadow
        : fallback.shadow,
    textAlign:
      style.textAlign === "left" || style.textAlign === "center"
        ? style.textAlign
        : fallback.textAlign,
  };
}

function sanitizeStringList(values: unknown, fallback: string[] = []) {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const sanitized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return sanitized.length > 0 ? sanitized : fallback;
}

function sanitizeFeatureItems(values: unknown, fallback: LandingFeatureItem[]) {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const sanitized = values
    .map((item) => ({
      title: sanitizeText(item?.title),
      body: sanitizeText(item?.body),
    }))
    .filter((item) => item.title || item.body);

  return sanitized.length > 0 ? sanitized : fallback;
}

function sanitizePackageItems(values: unknown, fallback: LandingPackage[]) {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const sanitized = values
    .map((item) => ({
      name: sanitizeText(item?.name),
      price: sanitizeText(item?.price),
      summary: sanitizeText(item?.summary),
    }))
    .filter((item) => item.name || item.price || item.summary);

  return sanitized.length > 0 ? sanitized : fallback;
}

function sanitizeFaqItems(values: unknown, fallback: LandingFaqItem[]) {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const sanitized = values
    .map((item) => ({
      title: sanitizeText(item?.title),
      body: sanitizeText(item?.body),
    }))
    .filter((item) => item.title || item.body);

  return sanitized.length > 0 ? sanitized : fallback;
}

function sanitizeProcessItems(values: unknown, fallback: LandingProcessItem[]) {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const sanitized = values
    .map((item) => ({
      title: sanitizeText(item?.title),
      body: sanitizeText(item?.body),
    }))
    .filter((item) => item.title || item.body);

  return sanitized.length > 0 ? sanitized : fallback;
}

function modernizeLandingText(value: string) {
  return value
    .replace(/Hospitality OS/gi, "Cloud POS")
    .replace(/Hospitality Control System/gi, "Cloud POS")
    .replace(/QR Siparis/gi, "QR Menu")
    .replace(/QR siparis/gi, "QR menu")
    .replace(/Demo ve Teklif/gi, "Demo Talebi")
    .replace(/Musteri gorusmesini buradan kapat/gi, "Isletmeniz icin uygun kurulumu birlikte planlayalim")
    .replace(/Demo tarihi netlestir/gi, "WhatsApp veya telefonla bize ulasin")
    .replace(/Hizli Iletisim/gi, "Dogrudan Iletisim")
    .replace(/Teklif Talebi Gonder/gi, "Talep Gonder")
    .replace(/WhatsApp ile Teklif Al/gi, "WhatsApp ile Ulas")
    .replace(/Hemen Ara/gi, "Telefonla Ara")
    .replace(/QR uzerinden dogrudan siparis kapali\. Lutfen garsona iletin\./gi, "QR uzerinden siparis alinmiyor. Siparisler personel tarafindan yonetilir.")
    .replace(/Masaya oturan musteri menuyu acsin, siparisi dogrudan sisteme dussun\./gi, "Masaya oturan musteri menuyu kendi telefonunda acsin, siparisi ekip yonetsin.")
    .replace(/Musteri menuyu acsin, siparisi dogrudan sisteme dussun\./gi, "Musteri menuyu acsin, siparis akisini ekip yonetsin.")
    .replace(/QR siparis zorunlu mu\?/gi, "QR ile siparis aliniyor mu?")
    .replace(/Hayir\. Masa bazli operasyon QR ile veya personel ekranlari uzerinden birlikte yurutulebilir\./gi, "Hayir. QR tarafi sadece menu goruntuleme icindir; siparis ekleme personel ekranlarindan yapilir.");
}

function modernizeLandingSection(section: LandingSection): LandingSection {
  if (section.type === "hero") {
    return {
      ...section,
      badge: modernizeLandingText(section.badge),
      title: modernizeLandingText(section.title),
      body: modernizeLandingText(section.body),
      primaryCtaLabel: modernizeLandingText(section.primaryCtaLabel),
      secondaryCtaLabel: modernizeLandingText(section.secondaryCtaLabel),
    };
  }

  if (section.type === "feature_grid") {
    return {
      ...section,
      eyebrow: modernizeLandingText(section.eyebrow),
      items: section.items.map((item) => ({
        title: modernizeLandingText(item.title),
        body: modernizeLandingText(item.body),
      })),
    };
  }

  if (section.type === "process_steps") {
    return {
      ...section,
      eyebrow: modernizeLandingText(section.eyebrow),
      items: section.items.map((item) => ({
        title: modernizeLandingText(item.title),
        body: modernizeLandingText(item.body),
      })),
    };
  }

  if (section.type === "pricing_grid") {
    return {
      ...section,
      eyebrow: modernizeLandingText(section.eyebrow),
      items: section.items.map((item) => ({
        name: modernizeLandingText(item.name),
        price: modernizeLandingText(item.price),
        summary: modernizeLandingText(item.summary),
      })),
    };
  }

  if (section.type === "credibility") {
    return {
      ...section,
      eyebrow: modernizeLandingText(section.eyebrow),
      title: modernizeLandingText(section.title),
      body: modernizeLandingText(section.body),
      references: section.references.map((item) => modernizeLandingText(item)),
    };
  }

  if (section.type === "faq_grid") {
    return {
      ...section,
      eyebrow: modernizeLandingText(section.eyebrow),
      items: section.items.map((item) => ({
        title: modernizeLandingText(item.title),
        body: modernizeLandingText(item.body),
      })),
    };
  }

  return {
    ...section,
    eyebrow: modernizeLandingText(section.eyebrow),
    title: modernizeLandingText(section.title),
    body: modernizeLandingText(section.body),
  };
}

function normalizeSection(section: unknown, index: number): LandingSection | null {
  if (!section || typeof section !== "object") {
    return null;
  }

  const sectionRecord = section as Record<string, unknown>;
  if (typeof sectionRecord.type !== "string") {
    return null;
  }

  const fallbackId = `section-${index + 1}`;
  const id = sanitizeText(sectionRecord.id, fallbackId);

  switch (sectionRecord.type) {
    case "hero": {
      const fallback = defaultLandingContent.sections.find((item) => item.type === "hero");
      if (!fallback || fallback.type !== "hero") return null;
      return {
        id,
        style: sanitizeSectionStyle(sectionRecord.style, fallback.style),
        type: "hero",
        badge: sanitizeText(sectionRecord.badge, fallback.badge),
        title: sanitizeText(sectionRecord.title, fallback.title),
        body: sanitizeText(sectionRecord.body, fallback.body),
        primaryCtaLabel: sanitizeText(sectionRecord.primaryCtaLabel, fallback.primaryCtaLabel),
        secondaryCtaLabel: sanitizeText(sectionRecord.secondaryCtaLabel, fallback.secondaryCtaLabel),
      };
    }
    case "feature_grid": {
      const fallback = defaultLandingContent.sections.find((item) => item.type === "feature_grid");
      if (!fallback || fallback.type !== "feature_grid") return null;
      return {
        id,
        style: sanitizeSectionStyle(sectionRecord.style, fallback.style),
        type: "feature_grid",
        eyebrow: sanitizeText(sectionRecord.eyebrow, fallback.eyebrow),
        items: sanitizeFeatureItems(sectionRecord.items, fallback.items),
      };
    }
    case "process_steps": {
      const fallback = defaultLandingContent.sections.find((item) => item.type === "process_steps");
      if (!fallback || fallback.type !== "process_steps") return null;
      return {
        id,
        style: sanitizeSectionStyle(sectionRecord.style, fallback.style),
        type: "process_steps",
        eyebrow: sanitizeText(sectionRecord.eyebrow, fallback.eyebrow),
        items: sanitizeProcessItems(sectionRecord.items, fallback.items),
      };
    }
    case "pricing_grid": {
      const fallback = defaultLandingContent.sections.find((item) => item.type === "pricing_grid");
      if (!fallback || fallback.type !== "pricing_grid") return null;
      return {
        id,
        style: sanitizeSectionStyle(sectionRecord.style, fallback.style),
        type: "pricing_grid",
        eyebrow: sanitizeText(sectionRecord.eyebrow, fallback.eyebrow),
        items: sanitizePackageItems(sectionRecord.items, fallback.items),
      };
    }
    case "credibility": {
      const fallback = defaultLandingContent.sections.find((item) => item.type === "credibility");
      if (!fallback || fallback.type !== "credibility") return null;
      return {
        id,
        style: sanitizeSectionStyle(sectionRecord.style, fallback.style),
        type: "credibility",
        eyebrow: sanitizeText(sectionRecord.eyebrow, fallback.eyebrow),
        title: sanitizeText(sectionRecord.title, fallback.title),
        body: sanitizeText(sectionRecord.body, fallback.body),
        references: sanitizeStringList(sectionRecord.references, fallback.references),
      };
    }
    case "faq_grid": {
      const fallback = defaultLandingContent.sections.find((item) => item.type === "faq_grid");
      if (!fallback || fallback.type !== "faq_grid") return null;
      return {
        id,
        style: sanitizeSectionStyle(sectionRecord.style, fallback.style),
        type: "faq_grid",
        eyebrow: sanitizeText(sectionRecord.eyebrow, fallback.eyebrow),
        items: sanitizeFaqItems(sectionRecord.items, fallback.items),
      };
    }
    case "contact_cta": {
      const fallback = defaultLandingContent.sections.find((item) => item.type === "contact_cta");
      if (!fallback || fallback.type !== "contact_cta") return null;
      return {
        id,
        style: sanitizeSectionStyle(sectionRecord.style, fallback.style),
        type: "contact_cta",
        eyebrow: sanitizeText(sectionRecord.eyebrow, fallback.eyebrow),
        title: sanitizeText(sectionRecord.title, fallback.title),
        body: sanitizeText(sectionRecord.body, fallback.body),
      };
    }
    default:
      return null;
  }
}

function buildSectionsFromLegacy(input: LegacyLandingContentShape) {
  const heroFallback = defaultLandingContent.sections.find((item) => item.type === "hero");
  const featureFallback = defaultLandingContent.sections.find((item) => item.type === "feature_grid");
  const pricingFallback = defaultLandingContent.sections.find((item) => item.type === "pricing_grid");
  const credibilityFallback = defaultLandingContent.sections.find((item) => item.type === "credibility");
  const faqFallback = defaultLandingContent.sections.find((item) => item.type === "faq_grid");

  if (
    !heroFallback ||
    heroFallback.type !== "hero" ||
    !featureFallback ||
    featureFallback.type !== "feature_grid" ||
    !pricingFallback ||
    pricingFallback.type !== "pricing_grid" ||
    !credibilityFallback ||
    credibilityFallback.type !== "credibility" ||
    !faqFallback ||
    faqFallback.type !== "faq_grid"
  ) {
    return defaultLandingContent.sections;
  }

  return defaultLandingContent.sections.map((section) => {
    if (section.type === "hero") {
      return {
        ...section,
        style: heroFallback.style,
        badge: sanitizeText(input.heroBadge, heroFallback.badge),
        title: sanitizeText(input.heroTitle, heroFallback.title),
        body: sanitizeText(input.heroBody, heroFallback.body),
        primaryCtaLabel: sanitizeText(input.primaryCtaLabel, heroFallback.primaryCtaLabel),
        secondaryCtaLabel: sanitizeText(input.secondaryCtaLabel, heroFallback.secondaryCtaLabel),
      };
    }

    if (section.type === "feature_grid") {
      return {
        ...section,
        style: featureFallback.style,
        items: sanitizeFeatureItems(input.highlights, featureFallback.items),
      };
    }

    if (section.type === "pricing_grid") {
      return {
        ...section,
        style: pricingFallback.style,
        items: sanitizePackageItems(input.packages, pricingFallback.items),
      };
    }

    if (section.type === "credibility") {
      return {
        ...section,
        style: credibilityFallback.style,
        title: sanitizeText(input.credibilityTitle, credibilityFallback.title),
        body: sanitizeText(input.credibilityBody, credibilityFallback.body),
        references: sanitizeStringList(input.references, credibilityFallback.references),
      };
    }

    if (section.type === "faq_grid") {
      return {
        ...section,
        style: faqFallback.style,
        items: sanitizeFaqItems(input.objections, faqFallback.items),
      };
    }

    return section;
  });
}

export function createLandingSectionTemplate(type: LandingSection["type"]): LandingSection {
  const baseId = `${type}-${Math.random().toString(36).slice(2, 8)}`;

  if (type === "hero") {
    return {
      id: baseId,
      style: { paddingTop: 40, paddingBottom: 56, paddingX: 0, radius: 32, containerWidth: "wide", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type,
      badge: "Yeni Blok",
      title: "Baslik girin",
      body: "Bu hero blokunu studio icinden duzenleyin.",
      primaryCtaLabel: "Giris Yap",
      secondaryCtaLabel: "Demo Ac",
    };
  }

  if (type === "feature_grid") {
    return {
      id: baseId,
      style: { paddingTop: 24, paddingBottom: 24, paddingX: 0, radius: 32, containerWidth: "wide", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type,
      eyebrow: "One Cikanlar",
      items: [{ title: "Kart 1", body: "Aciklama" }],
    };
  }

  if (type === "process_steps") {
    return {
      id: baseId,
      style: { paddingTop: 24, paddingBottom: 24, paddingX: 0, radius: 32, containerWidth: "default", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type,
      eyebrow: "Akis",
      items: [{ title: "Adim 1", body: "Aciklama" }],
    };
  }

  if (type === "pricing_grid") {
    return {
      id: baseId,
      style: { paddingTop: 24, paddingBottom: 24, paddingX: 0, radius: 32, containerWidth: "wide", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type,
      eyebrow: "Paketler",
      items: [{ name: "Paket", price: "Teklif", summary: "Aciklama" }],
    };
  }

  if (type === "credibility") {
    return {
      id: baseId,
      style: { paddingTop: 24, paddingBottom: 24, paddingX: 0, radius: 32, containerWidth: "default", surface: "glass", border: "none", shadow: "soft", textAlign: "left" },
      type,
      eyebrow: "Guven",
      title: "Guven basligi",
      body: "Aciklama",
      references: ["Referans 1"],
    };
  }

  if (type === "faq_grid") {
    return {
      id: baseId,
      style: { paddingTop: 24, paddingBottom: 24, paddingX: 0, radius: 32, containerWidth: "wide", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
      type,
      eyebrow: "SSS",
      items: [{ title: "Soru", body: "Cevap" }],
    };
  }

  return {
    id: baseId,
    style: { paddingTop: 24, paddingBottom: 32, paddingX: 0, radius: 32, containerWidth: "default", surface: "transparent", border: "none", shadow: "none", textAlign: "left" },
    type: "contact_cta",
    eyebrow: "Iletisim",
    title: "Iletisim basligi",
    body: "Aciklama",
  };
}

export function normalizeLandingContent(input?: Partial<LandingContent> | (Partial<LandingContent> & LegacyLandingContentShape) | null): LandingContent {
  const merged = {
    ...defaultLandingContent,
    ...(input ?? {}),
  };

  const hasExplicitSectionsField =
    Boolean(input) && typeof input === "object" && Object.prototype.hasOwnProperty.call(input, "sections");

  const normalizedSections =
    hasExplicitSectionsField
      ? ((Array.isArray((input as LandingContent | null | undefined)?.sections) ? (input as LandingContent).sections : []) as LandingSection[])
          .map((section, index) => normalizeSection(section, index))
          .filter((section): section is LandingSection => Boolean(section))
      : buildSectionsFromLegacy((input as LegacyLandingContentShape | null | undefined) ?? {});

  return {
    pageTitle: sanitizeText(merged.pageTitle, defaultLandingContent.pageTitle),
    topLoginLabel: sanitizeText(merged.topLoginLabel, defaultLandingContent.topLoginLabel),
    topDemoLabel: sanitizeText(merged.topDemoLabel, defaultLandingContent.topDemoLabel),
    businessPhone: sanitizeText(merged.businessPhone, defaultLandingContent.businessPhone),
    sections: (hasExplicitSectionsField ? normalizedSections : normalizedSections.length > 0 ? normalizedSections : defaultLandingContent.sections).map(modernizeLandingSection),
  };
}
