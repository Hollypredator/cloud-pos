"use client";

import { useMemo, useState } from "react";
import { DemoPageRenderer } from "@/components/demo-page-renderer";
import {
  defaultDemoPackages,
  defaultDemoPresentationFlow,
  defaultDemoSectionStyles,
  defaultDemoStaffAccounts,
  type DemoPageContent,
  type DemoPackage,
  type DemoPresentationItem,
  type DemoSectionStyle,
  type DemoStaffAccount,
} from "@/lib/demo";

type DemoSectionId =
  | "hero"
  | "metrics"
  | "presentation"
  | "accounts"
  | "orders"
  | "tables"
  | "stock"
  | "packages"
  | "closing";

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

export function DemoVisualEditor({
  content,
  action,
}: {
  content: DemoPageContent;
  action: (formData: FormData) => void;
}) {
  const [heroEyebrow, setHeroEyebrow] = useState(content.heroEyebrow);
  const [heroTitle, setHeroTitle] = useState(content.heroTitle);
  const [heroBody, setHeroBody] = useState(content.heroBody);
  const [previewBadge, setPreviewBadge] = useState(content.previewBadge);
  const [opsCtaLabel, setOpsCtaLabel] = useState(content.opsCtaLabel);
  const [loginCtaLabel, setLoginCtaLabel] = useState(content.loginCtaLabel);
  const [showMetrics, setShowMetrics] = useState(content.showMetrics);
  const [showPresentationFlow, setShowPresentationFlow] = useState(content.showPresentationFlow);
  const [flowEyebrow, setFlowEyebrow] = useState(content.flowEyebrow);
  const [flowTitle, setFlowTitle] = useState(content.flowTitle);
  const [showStaffAccounts, setShowStaffAccounts] = useState(content.showStaffAccounts);
  const [accountsEyebrow, setAccountsEyebrow] = useState(content.accountsEyebrow);
  const [accountsTitle, setAccountsTitle] = useState(content.accountsTitle);
  const [accountsBody, setAccountsBody] = useState(content.accountsBody);
  const [showRecentOrders, setShowRecentOrders] = useState(content.showRecentOrders);
  const [recentOrdersTitle, setRecentOrdersTitle] = useState(content.recentOrdersTitle);
  const [recentOrdersCtaLabel, setRecentOrdersCtaLabel] = useState(content.recentOrdersCtaLabel);
  const [showTableStatus, setShowTableStatus] = useState(content.showTableStatus);
  const [tableStatusTitle, setTableStatusTitle] = useState(content.tableStatusTitle);
  const [showLowStock, setShowLowStock] = useState(content.showLowStock);
  const [lowStockTitle, setLowStockTitle] = useState(content.lowStockTitle);
  const [lowStockLabel, setLowStockLabel] = useState(content.lowStockLabel);
  const [showPackages, setShowPackages] = useState(content.showPackages);
  const [showClosingCta, setShowClosingCta] = useState(content.showClosingCta);
  const [closingCtaTitle, setClosingCtaTitle] = useState(content.closingCtaTitle);
  const [closingCtaBody, setClosingCtaBody] = useState(content.closingCtaBody);
  const [closingCtaPrimaryLabel, setClosingCtaPrimaryLabel] = useState(content.closingCtaPrimaryLabel);
  const [closingCtaSecondaryLabel, setClosingCtaSecondaryLabel] = useState(content.closingCtaSecondaryLabel);
  const [sectionStyles, setSectionStyles] = useState(content.sectionStyles);
  const [packages, setPackages] = useState<DemoPackage[]>(content.packages);
  const [presentationFlow, setPresentationFlow] = useState<DemoPresentationItem[]>(content.presentationFlow);
  const [staffAccounts, setStaffAccounts] = useState<DemoStaffAccount[]>(content.staffAccounts);
  const [selectedId, setSelectedId] = useState<DemoSectionId>("hero");

  const previewContent: DemoPageContent = {
    heroEyebrow,
    heroTitle,
    heroBody,
    previewBadge,
    opsCtaLabel,
    loginCtaLabel,
    showMetrics,
    showPresentationFlow,
    flowEyebrow,
    flowTitle,
    showStaffAccounts,
    accountsEyebrow,
    accountsTitle,
    accountsBody,
    showRecentOrders,
    recentOrdersTitle,
    recentOrdersCtaLabel,
    showTableStatus,
    tableStatusTitle,
    showLowStock,
    lowStockTitle,
    lowStockLabel,
    showPackages,
    showClosingCta,
    closingCtaTitle,
    closingCtaBody,
    closingCtaPrimaryLabel,
    closingCtaSecondaryLabel,
    sectionStyles,
    packages,
    presentationFlow,
    staffAccounts,
  };

  const hiddenSections = [
    !showMetrics
      ? {
          key: "metrics" as DemoSectionId,
          label: "Metrik Kartlari",
          onAdd: () => {
            setShowMetrics(true);
            setSelectedId("metrics");
          },
        }
      : null,
    !showPresentationFlow
      ? {
          key: "presentation" as DemoSectionId,
          label: "Sunum Akisi",
          onAdd: () => {
            setShowPresentationFlow(true);
            if (presentationFlow.length === 0) setPresentationFlow(defaultDemoPresentationFlow);
            setSelectedId("presentation");
          },
        }
      : null,
    !showStaffAccounts
      ? {
          key: "accounts" as DemoSectionId,
          label: "Demo Hesaplari",
          onAdd: () => {
            setShowStaffAccounts(true);
            if (staffAccounts.length === 0) setStaffAccounts(defaultDemoStaffAccounts);
            setSelectedId("accounts");
          },
        }
      : null,
    !showRecentOrders
      ? { key: "orders" as DemoSectionId, label: "Son Siparisler", onAdd: () => { setShowRecentOrders(true); setSelectedId("orders"); } }
      : null,
    !showTableStatus
      ? { key: "tables" as DemoSectionId, label: "Masa Durumu", onAdd: () => { setShowTableStatus(true); setSelectedId("tables"); } }
      : null,
    !showLowStock
      ? { key: "stock" as DemoSectionId, label: "Kritik Stok", onAdd: () => { setShowLowStock(true); setSelectedId("stock"); } }
      : null,
    !showPackages
      ? {
          key: "packages" as DemoSectionId,
          label: "Demo Paketleri",
          onAdd: () => {
            setShowPackages(true);
            if (packages.length === 0) setPackages(defaultDemoPackages);
            setSelectedId("packages");
          },
        }
      : null,
    !showClosingCta
      ? {
          key: "closing" as DemoSectionId,
          label: "Kapanis CTA",
          onAdd: () => {
            setShowClosingCta(true);
            setSelectedId("closing");
          },
        }
      : null,
  ].filter(Boolean) as { key: DemoSectionId; label: string; onAdd: () => void }[];

  function updateSectionStyle<K extends keyof DemoSectionStyle>(sectionId: DemoSectionId, key: K, value: DemoSectionStyle[K]) {
    setSectionStyles((current) => ({
      ...current,
      [sectionId]: {
        ...(current[sectionId] ?? defaultDemoSectionStyles[sectionId]),
        [key]: value,
      },
    }));
  }

  const styleEditor = (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Style</p>
      <div className="mt-4 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberInput label="Ust bosluk" value={sectionStyles[selectedId].paddingTop} onChange={(value) => updateSectionStyle(selectedId, "paddingTop", value)} />
          <NumberInput label="Alt bosluk" value={sectionStyles[selectedId].paddingBottom} onChange={(value) => updateSectionStyle(selectedId, "paddingBottom", value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <NumberInput label="Ic padding" value={sectionStyles[selectedId].contentPadding} onChange={(value) => updateSectionStyle(selectedId, "contentPadding", value)} />
          <NumberInput label="Radius" value={sectionStyles[selectedId].radius} max={80} onChange={(value) => updateSectionStyle(selectedId, "radius", value)} />
        </div>
        <SelectInput
          label="Yuzey"
          value={sectionStyles[selectedId].surface}
          options={[
            { label: "Seffaf", value: "transparent" },
            { label: "Beyaz", value: "white" },
            { label: "Glass", value: "glass" },
            { label: "Koyu", value: "dark" },
          ]}
          onChange={(value) => updateSectionStyle(selectedId, "surface", value as DemoSectionStyle["surface"])}
        />
      </div>
    </div>
  );

  const selectedPanel = useMemo(() => {
    if (selectedId === "hero") {
      return (
        <div className="space-y-4">
          {styleEditor}
          <TextInput label="Eyebrow" value={heroEyebrow} onChange={setHeroEyebrow} />
          <TextInput label="Baslik" value={heroTitle} onChange={setHeroTitle} />
          <TextArea label="Aciklama" value={heroBody} rows={5} onChange={setHeroBody} />
          <div className="grid gap-4">
            <TextInput label="Badge" value={previewBadge} onChange={setPreviewBadge} />
            <TextInput label="Ops CTA" value={opsCtaLabel} onChange={setOpsCtaLabel} />
            <TextInput label="Login CTA" value={loginCtaLabel} onChange={setLoginCtaLabel} />
          </div>
        </div>
      );
    }

    if (selectedId === "metrics") {
      return (
        <div className="space-y-4">
          {styleEditor}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bolum</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Metrik Kartlari</h3>
            </div>
            <button type="button" onClick={() => setShowMetrics(false)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              Bolumu Kaldir
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            Metrik kartlari simdilik sabit demo veriden geliyor. Bu bolumu kaldirip sonra yeniden ekleyebilirsin.
          </div>
        </div>
      );
    }

    if (selectedId === "presentation") {
      if (!showPresentationFlow) return null;
      return (
        <div className="space-y-4">
          {styleEditor}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bolum</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Sunum Akisi</h3>
            </div>
            <button type="button" onClick={() => setShowPresentationFlow(false)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              Bolumu Kaldir
            </button>
          </div>
          <TextInput label="Eyebrow" value={flowEyebrow} onChange={setFlowEyebrow} />
          <TextInput label="Baslik" value={flowTitle} onChange={setFlowTitle} />
          {presentationFlow.map((item, index) => (
            <div key={`${index}-${item.title}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <TextInput
                label={`Adim ${index + 1} Baslik`}
                value={item.title}
                onChange={(value) => setPresentationFlow((current) => updateArrayItem(current, index, (entry) => ({ ...entry, title: value })))}
              />
              <div className="mt-3">
                <TextArea
                  label="Aciklama"
                  value={item.body}
                  onChange={(value) => setPresentationFlow((current) => updateArrayItem(current, index, (entry) => ({ ...entry, body: value })))}
                />
              </div>
              <div className="mt-3">
                <button type="button" onClick={() => setPresentationFlow((current) => current.filter((_, i) => i !== index))} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Adimi Sil
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setPresentationFlow((current) => [...current, { title: "", body: "" }])} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Adim Ekle
          </button>
        </div>
      );
    }

    if (selectedId === "accounts") {
      if (!showStaffAccounts) return null;
      return (
        <div className="space-y-4">
          {styleEditor}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bolum</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Demo Hesaplari</h3>
            </div>
            <button type="button" onClick={() => setShowStaffAccounts(false)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              Bolumu Kaldir
            </button>
          </div>
          <TextInput label="Eyebrow" value={accountsEyebrow} onChange={setAccountsEyebrow} />
          <TextInput label="Baslik" value={accountsTitle} onChange={setAccountsTitle} />
          <TextArea label="Aciklama" value={accountsBody} rows={4} onChange={setAccountsBody} />
          {staffAccounts.map((account, index) => (
            <div key={`${index}-${account.email}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4">
                <TextInput label="Ad Soyad" value={account.fullName} onChange={(value) => setStaffAccounts((current) => updateArrayItem(current, index, (entry) => ({ ...entry, fullName: value })))} />
                <TextInput label="E-posta" value={account.email} onChange={(value) => setStaffAccounts((current) => updateArrayItem(current, index, (entry) => ({ ...entry, email: value })))} />
                <TextInput label="Sifre" value={account.password} onChange={(value) => setStaffAccounts((current) => updateArrayItem(current, index, (entry) => ({ ...entry, password: value })))} />
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rol</span>
                  <select
                    value={account.role}
                    onChange={(event) =>
                      setStaffAccounts((current) =>
                        updateArrayItem(current, index, (entry) => ({ ...entry, role: event.target.value as DemoStaffAccount["role"] })),
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                  >
                    <option value="admin">admin</option>
                    <option value="cashier">cashier</option>
                    <option value="kitchen">kitchen</option>
                    <option value="waiter">waiter</option>
                  </select>
                </label>
                <TextArea label="Ozet" value={account.summary} onChange={(value) => setStaffAccounts((current) => updateArrayItem(current, index, (entry) => ({ ...entry, summary: value })))} />
                <button type="button" onClick={() => setStaffAccounts((current) => current.filter((_, i) => i !== index))} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Hesabi Sil
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setStaffAccounts((current) => [...current, { fullName: "", email: "", password: "Demo123!", role: "admin", summary: "" }])} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Hesap Ekle
          </button>
        </div>
      );
    }

    if (selectedId === "orders") {
      if (!showRecentOrders) return null;
      return (
        <div className="space-y-4">
          {styleEditor}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bolum</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Son Siparisler</h3>
            </div>
            <button type="button" onClick={() => setShowRecentOrders(false)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              Bolumu Kaldir
            </button>
          </div>
          <TextInput label="Baslik" value={recentOrdersTitle} onChange={setRecentOrdersTitle} />
          <TextInput label="CTA" value={recentOrdersCtaLabel} onChange={setRecentOrdersCtaLabel} />
        </div>
      );
    }

    if (selectedId === "tables") {
      if (!showTableStatus) return null;
      return (
        <div className="space-y-4">
          {styleEditor}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bolum</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Masa Durumu</h3>
            </div>
            <button type="button" onClick={() => setShowTableStatus(false)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              Bolumu Kaldir
            </button>
          </div>
          <TextInput label="Baslik" value={tableStatusTitle} onChange={setTableStatusTitle} />
        </div>
      );
    }

    if (selectedId === "stock") {
      if (!showLowStock) return null;
      return (
        <div className="space-y-4">
          {styleEditor}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bolum</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Kritik Stok</h3>
            </div>
            <button type="button" onClick={() => setShowLowStock(false)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              Bolumu Kaldir
            </button>
          </div>
          <TextInput label="Baslik" value={lowStockTitle} onChange={setLowStockTitle} />
          <TextInput label="Etiket" value={lowStockLabel} onChange={setLowStockLabel} />
        </div>
      );
    }

    if (selectedId === "packages") {
      if (!showPackages) return null;
      return (
        <div className="space-y-4">
          {styleEditor}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bolum</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Demo Paketleri</h3>
            </div>
            <button type="button" onClick={() => setShowPackages(false)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              Bolumu Kaldir
            </button>
          </div>
          {packages.map((item, index) => (
            <div key={`${index}-${item.name}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <TextInput label="Paket" value={item.name} onChange={(value) => setPackages((current) => updateArrayItem(current, index, (entry) => ({ ...entry, name: value })))} />
              <div className="mt-3">
                <TextInput label="Fiyat" value={item.price} onChange={(value) => setPackages((current) => updateArrayItem(current, index, (entry) => ({ ...entry, price: value })))} />
              </div>
              <div className="mt-3">
                <TextArea label="Ozet" value={item.summary} onChange={(value) => setPackages((current) => updateArrayItem(current, index, (entry) => ({ ...entry, summary: value })))} />
              </div>
              <div className="mt-3">
                <button type="button" onClick={() => setPackages((current) => current.filter((_, i) => i !== index))} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Paketi Sil
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setPackages((current) => [...current, { name: "", price: "", summary: "" }])} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Paket Ekle
          </button>
        </div>
      );
    }

    if (selectedId === "closing") {
      if (!showClosingCta) return null;
      return (
        <div className="space-y-4">
          {styleEditor}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bolum</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Kapanis CTA</h3>
            </div>
            <button type="button" onClick={() => setShowClosingCta(false)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              Bolumu Kaldir
            </button>
          </div>
          <TextInput label="Baslik" value={closingCtaTitle} onChange={setClosingCtaTitle} />
          <TextArea label="Aciklama" value={closingCtaBody} rows={5} onChange={setClosingCtaBody} />
          <div className="grid gap-4">
            <TextInput label="Ana CTA" value={closingCtaPrimaryLabel} onChange={setClosingCtaPrimaryLabel} />
            <TextInput label="Ikinci CTA" value={closingCtaSecondaryLabel} onChange={setClosingCtaSecondaryLabel} />
          </div>
        </div>
      );
    }

    return null;
  }, [
    accountsBody,
    accountsEyebrow,
    accountsTitle,
    flowEyebrow,
    flowTitle,
    heroBody,
    heroEyebrow,
    heroTitle,
    loginCtaLabel,
    closingCtaBody,
    closingCtaPrimaryLabel,
    closingCtaSecondaryLabel,
    closingCtaTitle,
    lowStockLabel,
    lowStockTitle,
    opsCtaLabel,
    packages,
    presentationFlow,
    previewBadge,
    recentOrdersCtaLabel,
    recentOrdersTitle,
    selectedId,
    sectionStyles,
    showClosingCta,
    showMetrics,
    showLowStock,
    showPackages,
    showPresentationFlow,
    showRecentOrders,
    showStaffAccounts,
    showTableStatus,
    staffAccounts,
    tableStatusTitle,
  ]);

  return (
    <form action={action} className="grid min-h-[calc(100vh-8rem)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <input type="hidden" name="heroEyebrow" value={heroEyebrow} />
      <input type="hidden" name="heroTitle" value={heroTitle} />
      <input type="hidden" name="heroBody" value={heroBody} />
      <input type="hidden" name="previewBadge" value={previewBadge} />
      <input type="hidden" name="opsCtaLabel" value={opsCtaLabel} />
      <input type="hidden" name="loginCtaLabel" value={loginCtaLabel} />
      <input type="hidden" name="showMetrics" value={String(showMetrics)} />
      <input type="hidden" name="showPresentationFlow" value={String(showPresentationFlow)} />
      <input type="hidden" name="flowEyebrow" value={flowEyebrow} />
      <input type="hidden" name="flowTitle" value={flowTitle} />
      <input type="hidden" name="showStaffAccounts" value={String(showStaffAccounts)} />
      <input type="hidden" name="accountsEyebrow" value={accountsEyebrow} />
      <input type="hidden" name="accountsTitle" value={accountsTitle} />
      <input type="hidden" name="accountsBody" value={accountsBody} />
      <input type="hidden" name="showRecentOrders" value={String(showRecentOrders)} />
      <input type="hidden" name="recentOrdersTitle" value={recentOrdersTitle} />
      <input type="hidden" name="recentOrdersCtaLabel" value={recentOrdersCtaLabel} />
      <input type="hidden" name="showTableStatus" value={String(showTableStatus)} />
      <input type="hidden" name="tableStatusTitle" value={tableStatusTitle} />
      <input type="hidden" name="showLowStock" value={String(showLowStock)} />
      <input type="hidden" name="lowStockTitle" value={lowStockTitle} />
      <input type="hidden" name="lowStockLabel" value={lowStockLabel} />
      <input type="hidden" name="showPackages" value={String(showPackages)} />
      <input type="hidden" name="showClosingCta" value={String(showClosingCta)} />
      <input type="hidden" name="closingCtaTitle" value={closingCtaTitle} />
      <input type="hidden" name="closingCtaBody" value={closingCtaBody} />
      <input type="hidden" name="closingCtaPrimaryLabel" value={closingCtaPrimaryLabel} />
      <input type="hidden" name="closingCtaSecondaryLabel" value={closingCtaSecondaryLabel} />
      <input type="hidden" name="sectionStylesJson" value={JSON.stringify(sectionStyles)} />
      <input type="hidden" name="packagesJson" value={JSON.stringify(packages)} />
      <input type="hidden" name="presentationFlowJson" value={JSON.stringify(presentationFlow)} />
      <input type="hidden" name="staffAccountsJson" value={JSON.stringify(staffAccounts)} />

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Visual Builder</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Demo sayfasini gorerek duzenle</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {hiddenSections.map((section) => (
              <button key={section.key} type="button" onClick={section.onAdd} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                + {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-auto">
          <DemoPageRenderer
            content={previewContent}
            editor={{
              activeSectionId: selectedId,
              onSelectSection: (id) => setSelectedId(id as DemoSectionId),
              previewMode: true,
            }}
          />
        </div>
      </section>

      <aside className="sticky top-6 h-fit rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Properties</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">{selectedId} ayarlari</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Soldaki demo canvas uzerinden blok sec. Alanlari degistirdikce sayfa aninda guncellenir.
        </p>

        <div className="mt-5 space-y-4">{selectedPanel}</div>

        <div className="mt-6">
          <button type="submit" className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            Demo Icerigini Kaydet
          </button>
        </div>
      </aside>
    </form>
  );
}
