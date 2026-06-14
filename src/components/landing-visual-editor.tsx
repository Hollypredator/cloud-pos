"use client";

import { useMemo, useState } from "react";
import { LandingPageRenderer } from "@/components/landing-page-renderer";
import type { GeneralSettings } from "@/lib/app-settings";
import { createLandingSectionTemplate, type LandingContent, type LandingSection } from "@/lib/site-content";

type SectionType = LandingSection["type"];

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  rows = 4,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min = 0,
  max = 240,
  step = 4,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function updateArrayItem<T>(items: T[], index: number, updater: (item: T) => T) {
  return items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

export function LandingVisualEditor({
  pageSlug,
  content,
  settings,
  action,
}: {
  pageSlug: string;
  content: LandingContent;
  settings: GeneralSettings;
  action: (formData: FormData) => void;
}) {
  const [pageTitle, setPageTitle] = useState(content.pageTitle);
  const [topLoginLabel, setTopLoginLabel] = useState(content.topLoginLabel);
  const [topDemoLabel, setTopDemoLabel] = useState(content.topDemoLabel);
  const [businessPhone, setBusinessPhone] = useState(content.businessPhone);
  const [sections, setSections] = useState<LandingSection[]>(content.sections);
  const [selectedId, setSelectedId] = useState<string | null>(content.sections[0]?.id ?? null);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [heroUploadState, setHeroUploadState] = useState<{
    tone: "idle" | "loading" | "success" | "error";
    message: string;
    sectionId: string | null;
  }>({ tone: "idle", message: "", sectionId: null });

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? sections[0] ?? null,
    [sections, selectedId],
  );

  function moveSection(index: number, direction: -1 | 1) {
    setSections((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const clone = [...current];
      const [item] = clone.splice(index, 1);
      clone.splice(nextIndex, 0, item);
      return clone;
    });
  }

  function removeSection(index: number) {
    setSections((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  function updateSection(index: number, updater: (section: LandingSection) => LandingSection) {
    setSections((current) => current.map((section, itemIndex) => (itemIndex === index ? updater(section) : section)));
  }

  function addSection(type: SectionType) {
    setSections((current) => {
      const next = [...current, createLandingSectionTemplate(type)];
      setSelectedId(next[next.length - 1]?.id ?? null);
      return next;
    });
  }

  function duplicateSection(index: number) {
    setSections((current) => {
      const source = current[index];
      if (!source) {
        return current;
      }

      const duplicated = {
        ...source,
        id: `${source.type}-${Math.random().toString(36).slice(2, 8)}`,
      } as LandingSection;
      const next = [...current];
      next.splice(index + 1, 0, duplicated);
      setSelectedId(duplicated.id);
      return next;
    });
  }

  function updateSectionStyle(
    index: number,
    field: "paddingTop" | "paddingBottom" | "paddingX" | "radius" | "containerWidth" | "surface" | "border" | "shadow" | "textAlign",
    value: number | string,
  ) {
    updateSection(index, (current) => ({
      ...current,
      style: {
        ...current.style,
        [field]: value,
      },
    }));
  }

  function inferAltText(filename: string) {
    const base = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
    return base || "Hero görseli";
  }

  async function uploadHeroImage(file: File, index: number, sectionId: string) {
    if (!file.type.startsWith("image/")) {
      setHeroUploadState({ tone: "error", message: "Lütfen görsel dosyası bırakın.", sectionId });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setHeroUploadState({ tone: "error", message: "Dosya boyutu 10MB altında olmalı.", sectionId });
      return;
    }

    setHeroUploadState({ tone: "loading", message: "Görsel yükleniyor...", sectionId });
    const formData = new FormData();
    formData.set("file", file);
    formData.set("title", inferAltText(file.name));
    formData.set("kind", "image");
    formData.set("altText", inferAltText(file.name));

    try {
      const response = await fetch("/api/studio/media/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; fileUrl: string; altText?: string }
        | { ok: false; error?: string }
        | null;

      if (!response.ok || !payload?.ok || !payload.fileUrl) {
        throw new Error((payload && "error" in payload && payload.error) || "Görsel yüklenemedi.");
      }

      updateSection(index, (current) => ({
        ...current,
        heroVisualMode: "image",
        heroImageUrl: payload.fileUrl,
        heroImageAlt:
          (current as Extract<LandingSection, { type: "hero" }>).heroImageAlt?.trim() || payload.altText || inferAltText(file.name),
      } as LandingSection));

      setHeroUploadState({ tone: "success", message: "Görsel yüklendi ve hero alanına eklendi.", sectionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Görsel yüklenemedi.";
      setHeroUploadState({ tone: "error", message, sectionId });
    }
  }

  function renderSelectedSectionEditor(section: LandingSection) {
    const index = sections.findIndex((item) => item.id === section.id);
    if (index < 0) return null;

    const styleEditor = (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Layout</p>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberInput label="Üst boşluk" value={section.style.paddingTop} onChange={(value) => updateSectionStyle(index, "paddingTop", value)} />
            <NumberInput label="Alt boşluk" value={section.style.paddingBottom} onChange={(value) => updateSectionStyle(index, "paddingBottom", value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <NumberInput label="Yatay padding" value={section.style.paddingX} max={80} onChange={(value) => updateSectionStyle(index, "paddingX", value)} />
            <NumberInput label="Radius" value={section.style.radius} max={64} onChange={(value) => updateSectionStyle(index, "radius", value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectInput
              label="Container"
              value={section.style.containerWidth}
              options={[
                { label: "Dar", value: "narrow" },
                { label: "Standart", value: "default" },
                { label: "Geniş", value: "wide" },
              ]}
              onChange={(value) => updateSectionStyle(index, "containerWidth", value)}
            />
            <SelectInput
              label="Yüzey"
              value={section.style.surface}
              options={[
                { label: "Şeffaf", value: "transparent" },
                { label: "Beyaz", value: "white" },
                { label: "Glass", value: "glass" },
                { label: "Koyu", value: "dark" },
              ]}
              onChange={(value) => updateSectionStyle(index, "surface", value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectInput
              label="Border"
              value={section.style.border}
              options={[
                { label: "Yok", value: "none" },
                { label: "Hafif", value: "light" },
                { label: "Güçlü", value: "strong" },
              ]}
              onChange={(value) => updateSectionStyle(index, "border", value)}
            />
            <SelectInput
              label="Gölgelendirme"
              value={section.style.shadow}
              options={[
                { label: "Yok", value: "none" },
                { label: "Hafif", value: "soft" },
                { label: "Orta", value: "medium" },
                { label: "Güçlü", value: "strong" },
              ]}
              onChange={(value) => updateSectionStyle(index, "shadow", value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectInput
              label="Metin Hizası"
              value={section.style.textAlign}
              options={[
                { label: "Sol", value: "left" },
                { label: "Orta", value: "center" },
              ]}
              onChange={(value) => updateSectionStyle(index, "textAlign", value)}
            />
          </div>
        </div>
      </div>
    );

    if (section.type === "hero") {
      return (
        <div className="space-y-4">
          {styleEditor}
          <TextInput label="Badge" value={section.badge} onChange={(value) => updateSection(index, (current) => ({ ...current, badge: value } as LandingSection))} />
          <TextInput label="Başlık" value={section.title} onChange={(value) => updateSection(index, (current) => ({ ...current, title: value } as LandingSection))} />
          <TextArea label="Açıklama" value={section.body} rows={5} onChange={(value) => updateSection(index, (current) => ({ ...current, body: value } as LandingSection))} />
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Ana CTA" value={section.primaryCtaLabel} onChange={(value) => updateSection(index, (current) => ({ ...current, primaryCtaLabel: value } as LandingSection))} />
            <TextInput label="İkinci CTA" value={section.secondaryCtaLabel} onChange={(value) => updateSection(index, (current) => ({ ...current, secondaryCtaLabel: value } as LandingSection))} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Ana CTA Link" value={section.primaryCtaHref} onChange={(value) => updateSection(index, (current) => ({ ...current, primaryCtaHref: value } as LandingSection))} />
            <TextInput label="İkinci CTA Link" value={section.secondaryCtaHref} onChange={(value) => updateSection(index, (current) => ({ ...current, secondaryCtaHref: value } as LandingSection))} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Hero Görseli</p>
            <div className="mt-4 grid gap-4">
              <SelectInput
                label="Sağ alan modu"
                value={section.heroVisualMode}
                options={[
                  { label: "Taşlak görünüm", value: "mockup" },
                  { label: "Görsel kullan", value: "image" },
                ]}
                onChange={(value) =>
                  updateSection(index, (current) => ({
                    ...current,
                    heroVisualMode: value === "image" ? "image" : "mockup",
                  } as LandingSection))
                }
              />
              <TextInput
                label="Görsel URL"
                value={section.heroImageUrl}
                onChange={(value) => updateSection(index, (current) => ({ ...current, heroImageUrl: value } as LandingSection))}
              />
              <TextInput
                label="Görsel alt metni"
                value={section.heroImageAlt}
                onChange={(value) => updateSection(index, (current) => ({ ...current, heroImageAlt: value } as LandingSection))}
              />
              <SelectInput
                label="Görsel yerleştirme"
                value={section.heroImageFit}
                options={[
                  { label: "Sığdır (contain)", value: "contain" },
                  { label: "Kapla (cover)", value: "cover" },
                ]}
                onChange={(value) =>
                  updateSection(index, (current) => ({
                    ...current,
                    heroImageFit: value === "cover" ? "cover" : "contain",
                  } as LandingSection))
                }
              />
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const dropped = event.dataTransfer?.files?.[0];
                  if (dropped) {
                    void uploadHeroImage(dropped, index, section.id);
                  }
                }}
                className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600"
              >
                <p className="font-semibold text-slate-800">Drag & drop ile görsel bırak</p>
                <p className="mt-1 text-xs text-slate-500">veya dosya seçerek yükle (max 10MB).</p>
                <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  Dosya Seç
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const selected = event.currentTarget.files?.[0];
                      if (selected) {
                        void uploadHeroImage(selected, index, section.id);
                        event.currentTarget.value = "";
                      }
                    }}
                  />
                </label>
              </div>
              {heroUploadState.sectionId === section.id && heroUploadState.tone !== "idle" ? (
                <p
                  className={`text-xs ${
                    heroUploadState.tone === "success"
                      ? "text-emerald-700"
                      : heroUploadState.tone === "error"
                        ? "text-rose-700"
                        : "text-slate-600"
                  }`}
                >
                  {heroUploadState.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    if (section.type === "feature_grid") {
      return (
        <div className="space-y-4">
          {styleEditor}
          <TextInput label="Eyebrow" value={section.eyebrow} onChange={(value) => updateSection(index, (current) => ({ ...current, eyebrow: value } as LandingSection))} />
          {section.items.map((item, itemIndex) => (
            <div key={itemIndex} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <TextInput label="Başlık" value={item.title} onChange={(value) => updateSection(index, (current) => ({ ...current, items: updateArrayItem((current as Extract<LandingSection, { type: "feature_grid" }>).items, itemIndex, (entry) => ({ ...entry, title: value })) } as LandingSection))} />
              <div className="mt-3">
                <TextArea label="Açıklama" value={item.body} onChange={(value) => updateSection(index, (current) => ({ ...current, items: updateArrayItem((current as Extract<LandingSection, { type: "feature_grid" }>).items, itemIndex, (entry) => ({ ...entry, body: value })) } as LandingSection))} />
              </div>
              <div className="mt-3">
                <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, items: (current as Extract<LandingSection, { type: "feature_grid" }>).items.filter((_, i) => i !== itemIndex) } as LandingSection))} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Karti Sil
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, items: [...(current as Extract<LandingSection, { type: "feature_grid" }>).items, { title: "", body: "" }] } as LandingSection))} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Kart Ekle
          </button>
        </div>
      );
    }

    if (section.type === "process_steps") {
      return (
        <div className="space-y-4">
          {styleEditor}
          <TextInput label="Eyebrow" value={section.eyebrow} onChange={(value) => updateSection(index, (current) => ({ ...current, eyebrow: value } as LandingSection))} />
          {section.items.map((item, itemIndex) => (
            <div key={itemIndex} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <TextInput label="Başlık" value={item.title} onChange={(value) => updateSection(index, (current) => ({ ...current, items: updateArrayItem((current as Extract<LandingSection, { type: "process_steps" }>).items, itemIndex, (entry) => ({ ...entry, title: value })) } as LandingSection))} />
              <div className="mt-3">
                <TextArea label="Açıklama" value={item.body} onChange={(value) => updateSection(index, (current) => ({ ...current, items: updateArrayItem((current as Extract<LandingSection, { type: "process_steps" }>).items, itemIndex, (entry) => ({ ...entry, body: value })) } as LandingSection))} />
              </div>
              <div className="mt-3">
                <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, items: (current as Extract<LandingSection, { type: "process_steps" }>).items.filter((_, i) => i !== itemIndex) } as LandingSection))} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Adımı Sil
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, items: [...(current as Extract<LandingSection, { type: "process_steps" }>).items, { title: "", body: "" }] } as LandingSection))} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Adım Ekle
          </button>
        </div>
      );
    }

    if (section.type === "pricing_grid") {
      return (
        <div className="space-y-4">
          {styleEditor}
          <TextInput label="Eyebrow" value={section.eyebrow} onChange={(value) => updateSection(index, (current) => ({ ...current, eyebrow: value } as LandingSection))} />
          {section.items.map((item, itemIndex) => (
            <div key={itemIndex} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <TextInput label="Paket" value={item.name} onChange={(value) => updateSection(index, (current) => ({ ...current, items: updateArrayItem((current as Extract<LandingSection, { type: "pricing_grid" }>).items, itemIndex, (entry) => ({ ...entry, name: value })) } as LandingSection))} />
              <div className="mt-3">
                <TextInput label="Fiyat" value={item.price} onChange={(value) => updateSection(index, (current) => ({ ...current, items: updateArrayItem((current as Extract<LandingSection, { type: "pricing_grid" }>).items, itemIndex, (entry) => ({ ...entry, price: value })) } as LandingSection))} />
              </div>
              <div className="mt-3">
                <TextArea label="Özet" value={item.summary} onChange={(value) => updateSection(index, (current) => ({ ...current, items: updateArrayItem((current as Extract<LandingSection, { type: "pricing_grid" }>).items, itemIndex, (entry) => ({ ...entry, summary: value })) } as LandingSection))} />
              </div>
              <div className="mt-3">
                <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, items: (current as Extract<LandingSection, { type: "pricing_grid" }>).items.filter((_, i) => i !== itemIndex) } as LandingSection))} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Paketi Sil
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, items: [...(current as Extract<LandingSection, { type: "pricing_grid" }>).items, { name: "", price: "", summary: "" }] } as LandingSection))} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Paket Ekle
          </button>
        </div>
      );
    }

    if (section.type === "credibility") {
      return (
        <div className="space-y-4">
          {styleEditor}
          <TextInput label="Eyebrow" value={section.eyebrow} onChange={(value) => updateSection(index, (current) => ({ ...current, eyebrow: value } as LandingSection))} />
          <TextInput label="Başlık" value={section.title} onChange={(value) => updateSection(index, (current) => ({ ...current, title: value } as LandingSection))} />
          <TextArea label="Açıklama" value={section.body} rows={5} onChange={(value) => updateSection(index, (current) => ({ ...current, body: value } as LandingSection))} />
          {section.references.map((item, itemIndex) => (
            <div key={itemIndex} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <TextInput
                label={`Referans ${itemIndex + 1}`}
                value={item}
                onChange={(value) =>
                  updateSection(index, (current) => ({
                    ...current,
                    references: updateArrayItem((current as Extract<LandingSection, { type: "credibility" }>).references, itemIndex, () => value),
                  } as LandingSection))
                }
              />
              <div className="mt-3">
                <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, references: (current as Extract<LandingSection, { type: "credibility" }>).references.filter((_, i) => i !== itemIndex) } as LandingSection))} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Referansı Sil
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, references: [...(current as Extract<LandingSection, { type: "credibility" }>).references, ""] } as LandingSection))} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Referans Ekle
          </button>
        </div>
      );
    }

    if (section.type === "faq_grid") {
      return (
        <div className="space-y-4">
          {styleEditor}
          <TextInput label="Eyebrow" value={section.eyebrow} onChange={(value) => updateSection(index, (current) => ({ ...current, eyebrow: value } as LandingSection))} />
          {section.items.map((item, itemIndex) => (
            <div key={itemIndex} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <TextInput label="Soru" value={item.title} onChange={(value) => updateSection(index, (current) => ({ ...current, items: updateArrayItem((current as Extract<LandingSection, { type: "faq_grid" }>).items, itemIndex, (entry) => ({ ...entry, title: value })) } as LandingSection))} />
              <div className="mt-3">
                <TextArea label="Cevap" value={item.body} onChange={(value) => updateSection(index, (current) => ({ ...current, items: updateArrayItem((current as Extract<LandingSection, { type: "faq_grid" }>).items, itemIndex, (entry) => ({ ...entry, body: value })) } as LandingSection))} />
              </div>
              <div className="mt-3">
                <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, items: (current as Extract<LandingSection, { type: "faq_grid" }>).items.filter((_, i) => i !== itemIndex) } as LandingSection))} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Maddeyi Sil
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => updateSection(index, (current) => ({ ...current, items: [...(current as Extract<LandingSection, { type: "faq_grid" }>).items, { title: "", body: "" }] } as LandingSection))} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Madde Ekle
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {styleEditor}
        <TextInput label="Eyebrow" value={section.eyebrow} onChange={(value) => updateSection(index, (current) => ({ ...current, eyebrow: value } as LandingSection))} />
        <TextInput label="Başlık" value={section.title} onChange={(value) => updateSection(index, (current) => ({ ...current, title: value } as LandingSection))} />
        <TextArea label="Açıklama" value={section.body} rows={5} onChange={(value) => updateSection(index, (current) => ({ ...current, body: value } as LandingSection))} />
      </div>
    );
  }

  const previewContent: LandingContent = {
    pageTitle,
    topLoginLabel,
    topDemoLabel,
    businessPhone,
    sections,
  };

  return (
    <form
      action={action}
      className={`grid min-h-[calc(100vh-8rem)] gap-5 ${
        isPropertiesOpen ? "xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px]" : "grid-cols-1"
      }`}
    >
      <input type="hidden" name="pageTitle" value={pageTitle} />
      <input type="hidden" name="pageSlug" value={pageSlug} />
      <input type="hidden" name="topLoginLabel" value={topLoginLabel} />
      <input type="hidden" name="topDemoLabel" value={topDemoLabel} />
      <input type="hidden" name="businessPhone" value={businessPhone} />
      <input type="hidden" name="sectionsJson" value={JSON.stringify(sections)} />

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Visual Builder</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Ana sayfayı görerek düzenle</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["hero", "feature_grid", "process_steps", "pricing_grid", "credibility", "contact_cta", "faq_grid"] as SectionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addSection(type)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                + {type}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsPropertiesOpen((current) => !current)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {isPropertiesOpen ? "Properties Gizle" : "Properties Göster"}
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-auto">
          <LandingPageRenderer
            content={previewContent}
            settings={settings}
            editor={{ activeSectionId: selectedId, onSelectSection: setSelectedId, previewMode: true }}
          />
        </div>
      </section>

      {isPropertiesOpen ? (
        <aside className="sticky top-6 h-fit rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Properties</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            {selectedSection ? `${selectedSection.type} ayarları` : "Blok seç"}
          </h2>
          <p className="mt-2 text-sm leadıng-6 text-slate-600">
            Soldaki landing canvas üzerinden blok seç. Alanları değiştirdikçe sayfa anında güncellenir.
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Global</p>
            <div className="mt-4 grid gap-4">
              <TextInput label="Sayfa başlığı" value={pageTitle} onChange={setPageTitle} />
              <TextInput label="Üst login butonu" value={topLoginLabel} onChange={setTopLoginLabel} />
              <TextInput label="Üst demo butonu" value={topDemoLabel} onChange={setTopDemoLabel} />
              <TextInput label="Telefon / WhatsApp" value={businessPhone} onChange={setBusinessPhone} />
            </div>
          </div>

          {selectedSection ? (
            <div className="mt-5">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => moveSection(sections.findIndex((item) => item.id === selectedSection.id), -1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Yukarı
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(sections.findIndex((item) => item.id === selectedSection.id), 1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Aşağı
                </button>
                <button
                  type="button"
                  onClick={() => duplicateSection(sections.findIndex((item) => item.id === selectedSection.id))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Kopyala
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(sections.findIndex((item) => item.id === selectedSection.id))}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                >
                  Sil
                </button>
              </div>
              <div className="space-y-4">{renderSelectedSectionEditor(selectedSection)}</div>
            </div>
          ) : null}

          <div className="mt-6">
            <button type="submit" className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
              Değişiklikleri Kaydet
            </button>
          </div>
        </aside>
      ) : null}
    </form>
  );
}
