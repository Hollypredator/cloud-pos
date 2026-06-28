"use client";

import { useState, type ReactNode } from "react";
import {
  defaultDemoPackages,
  defaultDemoPresentationFlow,
  defaultDemoStaffAccounts,
  type DemoPageContent,
  type DemoPackage,
  type DemoPresentationItem,
  type DemoStaffAccount,
} from "@/lib/demo";

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
      />
    </label>
  );
}

function updateArrayItem<T>(items: T[], index: number, updater: (item: T) => T) {
  return items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

function SectionShell({
  eyebrow,
  title,
  description,
  onRemove,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onRemove: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
        >
          Bolumu Kaldır
        </button>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function StudioDemoEditor({
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
  const [packages, setPackages] = useState<DemoPackage[]>(content.packages);
  const [presentationFlow, setPresentationFlow] = useState<DemoPresentationItem[]>(content.presentationFlow);
  const [staffAccounts, setStaffAccounts] = useState<DemoStaffAccount[]>(content.staffAccounts);
  const hiddenSections = [
    !showPresentationFlow
      ? {
          key: "presentation",
          label: "Sunum Akışı",
          onAdd: () => {
            setShowPresentationFlow(true);
            if (presentationFlow.length === 0) {
              setPresentationFlow(defaultDemoPresentationFlow);
            }
          },
        }
      : null,
    !showStaffAccounts
      ? {
          key: "accounts",
          label: "Demo Hesaplari",
          onAdd: () => {
            setShowStaffAccounts(true);
            if (staffAccounts.length === 0) {
              setStaffAccounts(defaultDemoStaffAccounts);
            }
          },
        }
      : null,
    !showRecentOrders
      ? {
          key: "orders",
          label: "Son Siparişler",
          onAdd: () => setShowRecentOrders(true),
        }
      : null,
    !showTableStatus
      ? {
          key: "tables",
          label: "Masa Durumu",
          onAdd: () => setShowTableStatus(true),
        }
      : null,
    !showLowStock
      ? {
          key: "stock",
          label: "Kritik Stok",
          onAdd: () => setShowLowStock(true),
        }
      : null,
    !showPackages
      ? {
          key: "packages",
          label: "Demo Paketleri",
          onAdd: () => {
            setShowPackages(true);
            if (packages.length === 0) {
              setPackages(defaultDemoPackages);
            }
          },
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; onAdd: () => void }[];

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="heroEyebrow" value={heroEyebrow} />
      <input type="hidden" name="heroTitle" value={heroTitle} />
      <input type="hidden" name="heroBody" value={heroBody} />
      <input type="hidden" name="previewBadge" value={previewBadge} />
      <input type="hidden" name="opsCtaLabel" value={opsCtaLabel} />
      <input type="hidden" name="loginCtaLabel" value={loginCtaLabel} />
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
      <input type="hidden" name="packagesJson" value={JSON.stringify(packages)} />
      <input type="hidden" name="presentationFlowJson" value={JSON.stringify(presentationFlow)} />
      <input type="hidden" name="staffAccountsJson" value={JSON.stringify(staffAccounts)} />

      {hiddenSections.length > 0 ? (
        <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Bolum Ekle</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Gizlenen bolumleri geri getir</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                Kaldırdigin demo bolumlerini buradan yeniden ekleyebilirsin.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {hiddenSections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={section.onAdd}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {section.label} Ekle
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Hero</p>
        <div className="mt-4 grid gap-4">
          <TextInput label="Eyebrow" value={heroEyebrow} onChange={setHeroEyebrow} />
          <TextInput label="Başlık" value={heroTitle} onChange={setHeroTitle} />
          <TextArea label="Açıklama" value={heroBody} rows={4} onChange={setHeroBody} />
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput label="Badge" value={previewBadge} onChange={setPreviewBadge} />
            <TextInput label="Ops CTA" value={opsCtaLabel} onChange={setOpsCtaLabel} />
            <TextInput label="Login CTA" value={loginCtaLabel} onChange={setLoginCtaLabel} />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Bolum Başlıklari</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextInput label="Flow eyebrow" value={flowEyebrow} onChange={setFlowEyebrow} />
          <TextInput label="Flow title" value={flowTitle} onChange={setFlowTitle} />
          <TextInput label="Accounts eyebrow" value={accountsEyebrow} onChange={setAccountsEyebrow} />
          <TextInput label="Accounts title" value={accountsTitle} onChange={setAccountsTitle} />
          <div className="md:col-span-2">
            <TextArea label="Accounts body" value={accountsBody} rows={3} onChange={setAccountsBody} />
          </div>
          <TextInput label="Recent orders title" value={recentOrdersTitle} onChange={setRecentOrdersTitle} />
          <TextInput label="Recent orders CTA" value={recentOrdersCtaLabel} onChange={setRecentOrdersCtaLabel} />
          <TextInput label="Table status title" value={tableStatusTitle} onChange={setTableStatusTitle} />
          <TextInput label="Low stock title" value={lowStockTitle} onChange={setLowStockTitle} />
          <div className="md:col-span-2">
            <TextInput label="Low stock label" value={lowStockLabel} onChange={setLowStockLabel} />
          </div>
        </div>
      </section>

      {showPresentationFlow ? (
        <SectionShell
          eyebrow="Sunum Akışı"
          title="Adimlari yönet"
          description="Bu bolumu tamamen kaldirip daha sonra tekrar ekleyebilirsin."
          onRemove={() => setShowPresentationFlow(false)}
        >
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setPresentationFlow((current) => [...current, { title: "", body: "" }])}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Adim Ekle
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {presentationFlow.map((item, index) => (
            <div key={`${index}-${item.title}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4">
                <TextInput
                  label={`Adim ${index + 1} Başlık`}
                  value={item.title}
                  onChange={(value) =>
                    setPresentationFlow((current) =>
                      updateArrayItem(current, index, (entry) => ({ ...entry, title: value })),
                    )
                  }
                />
                <TextArea
                  label="Açıklama"
                  value={item.body}
                  onChange={(value) =>
                    setPresentationFlow((current) =>
                      updateArrayItem(current, index, (entry) => ({ ...entry, body: value })),
                    )
                  }
                />
                <div>
                  <button
                    type="button"
                    onClick={() => setPresentationFlow((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                  >
                    Adimi Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        </SectionShell>
      ) : null}

      {showStaffAccounts ? (
        <SectionShell
          eyebrow="Demo Hesaplari"
          title="Kartlari yönet"
          description="Rol bazli hesap kartlarini tamamen kaldirabilir veya geri ekleyebilirsin."
          onRemove={() => setShowStaffAccounts(false)}
        >
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() =>
              setStaffAccounts((current) => [
                ...current,
                { fullName: "", email: "", password: "Demo123!", role: "admin", summary: "" },
              ])
            }
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Hesap Ekle
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {staffAccounts.map((account, index) => (
            <div key={`${index}-${account.email}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Ad Soyad"
                  value={account.fullName}
                  onChange={(value) =>
                    setStaffAccounts((current) =>
                      updateArrayItem(current, index, (entry) => ({ ...entry, fullName: value })),
                    )
                  }
                />
                <TextInput
                  label="E-posta"
                  value={account.email}
                  onChange={(value) =>
                    setStaffAccounts((current) =>
                      updateArrayItem(current, index, (entry) => ({ ...entry, email: value })),
                    )
                  }
                />
                <TextInput
                  label="Şifre"
                  value={account.password}
                  onChange={(value) =>
                    setStaffAccounts((current) =>
                      updateArrayItem(current, index, (entry) => ({ ...entry, password: value })),
                    )
                  }
                />
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rol</span>
                  <select
                    value={account.role}
                    onChange={(event) =>
                      setStaffAccounts((current) =>
                        updateArrayItem(current, index, (entry) => ({
                          ...entry,
                          role: event.target.value as DemoStaffAccount["role"],
                        })),
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
                <div className="md:col-span-2">
                  <TextArea
                    label="Özet"
                    value={account.summary}
                    onChange={(value) =>
                      setStaffAccounts((current) =>
                        updateArrayItem(current, index, (entry) => ({ ...entry, summary: value })),
                      )
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => setStaffAccounts((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                  >
                    Hesabi Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        </SectionShell>
      ) : null}

      {showRecentOrders ? (
        <SectionShell
          eyebrow="Sipariş Tablosu"
          title="Son siparişler bolumu"
          description="Sipariş tablosunu gizleyip tekrar aktif edebilirsin."
          onRemove={() => setShowRecentOrders(false)}
        >
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Bolum basligi" value={recentOrdersTitle} onChange={setRecentOrdersTitle} />
          <TextInput label="CTA etiketi" value={recentOrdersCtaLabel} onChange={setRecentOrdersCtaLabel} />
        </div>
        </SectionShell>
      ) : null}

      {showTableStatus ? (
        <SectionShell
          eyebrow="Masa Durumu"
          title="Masa özeti bolumu"
          description="Dolu ve boş masa kutularini tamamen kaldirip yeniden ekleyebilirsin."
          onRemove={() => setShowTableStatus(false)}
        >
        <TextInput label="Bolum basligi" value={tableStatusTitle} onChange={setTableStatusTitle} />
        </SectionShell>
      ) : null}

      {showLowStock ? (
        <SectionShell
          eyebrow="Kritik Stok"
          title="Stok uyarisi bolumu"
          description="Kritik stok alanini gizleyebilir ve sonra tekrar ekleyebilirsin."
          onRemove={() => setShowLowStock(false)}
        >
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Bolum basligi" value={lowStockTitle} onChange={setLowStockTitle} />
          <TextInput label="Sag üst etiket" value={lowStockLabel} onChange={setLowStockLabel} />
        </div>
        </SectionShell>
      ) : null}

      {showPackages ? (
        <SectionShell
          eyebrow="Demo Paketleri"
          title="Kartlari yönet"
          description="Paket kartlarini kaldirip daha sonra tekrar ekleyebilirsin."
          onRemove={() => setShowPackages(false)}
        >
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setPackages((current) => [...current, { name: "", price: "", summary: "" }])}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Paket Ekle
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {packages.map((item, index) => (
            <div key={`${index}-${item.name}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4">
                <TextInput
                  label="Paket"
                  value={item.name}
                  onChange={(value) =>
                    setPackages((current) =>
                      updateArrayItem(current, index, (entry) => ({ ...entry, name: value })),
                    )
                  }
                />
                <TextInput
                  label="Fiyat"
                  value={item.price}
                  onChange={(value) =>
                    setPackages((current) =>
                      updateArrayItem(current, index, (entry) => ({ ...entry, price: value })),
                    )
                  }
                />
                <TextArea
                  label="Özet"
                  value={item.summary}
                  onChange={(value) =>
                    setPackages((current) =>
                      updateArrayItem(current, index, (entry) => ({ ...entry, summary: value })),
                    )
                  }
                />
                <div>
                  <button
                    type="button"
                    onClick={() => setPackages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                  >
                    Paketi Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        </SectionShell>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
          Demo Icerigini Kaydet
        </button>
      </div>
    </form>
  );
}
