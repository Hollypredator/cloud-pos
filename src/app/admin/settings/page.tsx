import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getCurrentUserWithRole, requireExactRole } from "@/lib/auth";
import {
  clearDemoOperationsData,
  clearBusinessOperationalData,
  createSupportTicket,
  createSupportPlanRequest,
  ensureDemoOperationsData,
  getApplicationSettings,
  getGeneralSettings,
  updateApplicationSettings,
  updateGeneralSettings,
} from "@/lib/data";
import { BackofficePage, ContentCard, SidebarPanel } from "@/components/backoffice-ui";
import { DemoModeToggleForm } from "@/components/demo-mode-toggle-form";
import { SidebarCustomizer } from "@/components/sidebar-customizer";
import { FEATURE_META, getPlanLabel, hasFeature } from "@/lib/features";
import { getActiveBusinessPlanContext } from "@/lib/plan-access";
import { sidebarThemeOptions } from "@/lib/app-settings";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function createSupportTicketAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/settings");

  const subject = readString(formData, "subject");
  const description = readString(formData, "description");
  await createSupportTicket({
    type: "support",
    priority: "normal",
    subject,
    description,
  });
  revalidatePath("/admin/settings");
  revalidatePath("/support/tickets");
  revalidatePath("/support/audit");
}

async function createPlanRequestAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/settings");

  const requestedPlan = readString(formData, "requestedPlan") as "starter" | "growth" | "custom";
  const reason = readString(formData, "planReason");
  await createSupportPlanRequest({
    requestedPlan,
    reason,
  });
  revalidatePath("/admin/settings");
  revalidatePath("/support/plan-requests");
  revalidatePath("/support/tickets");
  revalidatePath("/support/audit");
}

async function updateGeneralSettingsAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/settings");
  const { settings: currentSettings } = await getGeneralSettings({ scope: "active-business" });

  await updateGeneralSettings({
    siteName: readString(formData, "siteName"),
    siteTagline: currentSettings.siteTagline,
    contactPhone: readString(formData, "contactPhone"),
    whatsappPhone: readString(formData, "whatsappPhone"),
    supportEmail: readString(formData, "supportEmail"),
    address: readString(formData, "address"),
    logoUrl: readString(formData, "logoUrl"),
    footerNote: currentSettings.footerNote,
  }, { scope: "active-business" });

  revalidatePath("/");
  revalidatePath("/admin/settings");
}

async function updateApplicationSettingsAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/settings");

  const { settings: currentSettings } = await getApplicationSettings();

  const hasDemoMode = formData.has("demoMode_present") || formData.has("demoMode");
  const hasAppPrintingEnabled = formData.has("appPrintingEnabled_present") || formData.has("appPrintingEnabled");
  const sidebarTheme = readString(formData, "sidebarTheme");
  const sidebarAccentColor = readString(formData, "sidebarAccentColor");
  const ownerSidebarOrderRaw = readString(formData, "ownerSidebarOrder");
  const adminSidebarOrderRaw = readString(formData, "adminSidebarOrder");

  let ownerSidebarOrder = currentSettings.ownerSidebarOrder;
  let adminSidebarOrder = currentSettings.adminSidebarOrder;

  if (ownerSidebarOrderRaw) {
    try {
      ownerSidebarOrder = JSON.parse(ownerSidebarOrderRaw);
    } catch {}
  }

  if (adminSidebarOrderRaw) {
    try {
      adminSidebarOrder = JSON.parse(adminSidebarOrderRaw);
    } catch {}
  }

  const nextSidebarTheme =
    sidebarTheme === "ocean" || sidebarTheme === "night" || sidebarTheme === "ember"
      ? sidebarTheme
      : currentSettings.sidebarTheme;

  const nextSettings = {
    ...currentSettings,
    demoMode: hasDemoMode ? formData.get("demoMode") === "on" : currentSettings.demoMode,
    appPrintingEnabled: hasAppPrintingEnabled ? formData.get("appPrintingEnabled") === "on" : currentSettings.appPrintingEnabled,
    sidebarTheme: nextSidebarTheme,
    sidebarOrder: currentSettings.sidebarOrder,
    sidebarAccentColor: sidebarAccentColor || currentSettings.sidebarAccentColor,
    ownerSidebarOrder,
    adminSidebarOrder,
  };

  await updateApplicationSettings(nextSettings);

  if (nextSettings.demoMode) {
    await ensureDemoOperationsData();
  }

  revalidatePath("/admin/settings");
  revalidatePath("/ops");
  revalidatePath("/kitchen");
  revalidatePath("/cashier");
  revalidatePath("/cashier/session");
  revalidatePath("/delivery");
  revalidatePath("/tables");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/finance");
}

async function clearDemoOperationsAction() {
  "use server";
  await requireExactRole(["owner"], "/admin/settings");
  const { settings: applicationSettings } = await getApplicationSettings();
  await updateApplicationSettings({
    ...applicationSettings,
    demoMode: false,
  });
  await clearDemoOperationsData();
  revalidatePath("/admin/settings");
  revalidatePath("/ops");
  revalidatePath("/kitchen");
  revalidatePath("/cashier");
  revalidatePath("/cashier/session");
  revalidatePath("/delivery");
  revalidatePath("/tables");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/finance");
}

async function resetBusinessOperationalDataAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/settings");
  const deleteTables = formData.get("deleteTables") === "on";
  const result = await clearBusinessOperationalData({ deleteTables });
  if (!result.ok) {
    return;
  }

  revalidatePath("/admin/settings");
  revalidatePath("/ops");
  revalidatePath("/kitchen");
  revalidatePath("/cashier");
  revalidatePath("/cashier/session");
  revalidatePath("/delivery");
  revalidatePath("/tables");
  revalidatePath("/admin/tables");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/finance");
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
      />
    </label>
  );
}

function ToggleField({
  title,
  description,
  name,
  defaultChecked,
}: {
  title: string;
  description: string;
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
      <div>
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <span className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-8 w-14 rounded-full bg-slate-200 transition peer-checked:bg-[#ff6a3d]" />
        <span className="absolute left-1 h-6 w-6 rounded-full bg-white shadow-sm transition peer-checked:translate-x-6" />
      </span>
    </label>
  );
}

export default async function AdminSettingsPage() {
  const auth = await getCurrentUserWithRole();
  if (!auth.usingDemoData && auth.role !== "owner") {
    return (
      <BackofficePage
        title="Isletme Ayarlari"
        description="Bu alan yalnizca patron hesabi tarafindan yonetilir."
      >
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Paket, demo modu, sidebar duzeni ve isletme marka ayarlari yalnizca patron tarafindan degistirilebilir.
        </div>
      </BackofficePage>
    );
  }
  const [{ settings: generalSettings, usingDemoData }, { settings: applicationSettings }, planContext] = await Promise.all([
    getGeneralSettings({ scope: "active-business" }),
    getApplicationSettings(),
    getActiveBusinessPlanContext(),
  ]);
  const activeFeatureCount = Object.keys(FEATURE_META).filter((feature) =>
    hasFeature(planContext.plan, feature as keyof typeof FEATURE_META),
  ).length;

  return (
    <BackofficePage
      title="Isletme Ayarlari"
      description="Isletmeye teslim edilecek operasyon, marka ve uygulama ayarlari"
      sidebar={
        <SidebarPanel title="Ayarlar">
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#ff8b73] bg-[#fff8ee] px-4 py-4">
              <p className="text-lg font-semibold text-slate-900">Isletme</p>
              <p className="mt-1 text-sm text-slate-500">Marka kimligi, iletisim ve destek bilgileri</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-lg font-semibold text-slate-900">Uygulama</p>
              <p className="mt-1 text-sm text-slate-500">Yazdirma, demo ve sidebar tercihi</p>
              <Link href="/admin/print-center" className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                Yazdirma Merkezi
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-lg font-semibold text-slate-900">Calisma Modu</p>
              <p className="mt-1 text-sm text-slate-500">{applicationSettings.demoMode ? "Demo modu acik" : "Canli mod"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-lg font-semibold text-slate-900">Paket</p>
              <p className="mt-1 text-sm text-slate-500">{getPlanLabel(planContext.plan)} paketi aktif</p>
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">{activeFeatureCount} modul acik</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-lg font-semibold text-slate-900">Marka Durumu</p>
              <p className="mt-1 text-sm text-slate-500">{generalSettings.siteName}</p>
            </div>
          </div>
        </SidebarPanel>
      }
    >
      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Ayarlar tablosu okunamadi. Varsayilan ayarlar gosteriliyor.
        </div>
      ) : null}

      <div className="space-y-4">
        <ContentCard title="Paket ve Moduller">
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Aktif Paket</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{getPlanLabel(planContext.plan)}</p>
              <p className="mt-2 text-sm text-slate-500">{activeFeatureCount} modul acik</p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                Paket degisikligi isletme panelinden yapilamaz. Upgrade veya downgrade islemleri merkez ekip tarafindan yonetilir.
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(FEATURE_META).map(([featureKey, meta]) => (
                <div key={featureKey} className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{meta.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        hasFeature(planContext.plan, featureKey as keyof typeof FEATURE_META)
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {hasFeature(planContext.plan, featureKey as keyof typeof FEATURE_META) ? "Acik" : getPlanLabel(meta.requiredPlan)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ContentCard>

        <form action={createPlanRequestAction}>
          <ContentCard title="Paket Degisikligi Talebi">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                Upgrade veya downgrade talepleri merkez ekip tarafindan incelenir ve onaylanir.
              </div>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Talep edilen paket</span>
                <select name="requestedPlan" defaultValue={planContext.plan} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Gerekce</span>
                <textarea
                  name="planReason"
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                  placeholder="Paket degisikligi gerekcesini yazin"
                />
              </label>
              <div className="flex justify-end">
                <button type="submit" className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white sm:w-auto">
                  Paket Talebi Gonder
                </button>
              </div>
            </div>
          </ContentCard>
        </form>

        <ContentCard title="Uygulama Ayarlari">
          <div className="space-y-4">
            <DemoModeToggleForm action={updateApplicationSettingsAction} defaultChecked={applicationSettings.demoMode} />
            <form action={updateApplicationSettingsAction} className="space-y-4">
              <ToggleField
                title="Yazdirma Yontemi"
                description="Uygulama tarafindan yazdirma yapilsin."
                name="appPrintingEnabled"
                defaultChecked={applicationSettings.appPrintingEnabled}
              />
              <input type="hidden" name="appPrintingEnabled_present" value="1" />
              <div className="grid gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Sidebar renk temasi</span>
                  <select
                    name="sidebarTheme"
                    defaultValue={applicationSettings.sidebarTheme}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                  >
                    {sidebarThemeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <SidebarCustomizer
                  initialAccentColor={applicationSettings.sidebarAccentColor}
                  initialOwnerOrder={applicationSettings.ownerSidebarOrder}
                  initialAdminOrder={applicationSettings.adminSidebarOrder}
                />
              </div>
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
                Demo mod mevcut isletmede ornek kasa oturumu, mutfak siparisleri, odeme bekleyen adisyon ve paket servis kaydi olusturur.
                Kapatmak yeni veri uretimini durdurur; mevcut demo kayitlarini otomatik silmez.
              </div>
              <div className="mt-6 flex justify-end">
                <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white sm:w-auto">
                  Uygulama Ayarlarini Kaydet
                </button>
              </div>
            </form>
          </div>
        </ContentCard>

        <form action={createSupportTicketAction}>
          <ContentCard title="Destek Talebi">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                Paket degisikligi, entegrasyon veya teknik destek ihtiyaciniz icin merkez ekibe talep iletebilirsiniz.
              </div>
              <Field label="Konu" name="subject" defaultValue="" />
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Aciklama</span>
                <textarea
                  name="description"
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                  placeholder="Destek ekibine iletmek istediginiz talebi yazin"
                />
              </label>
              <div className="flex justify-end">
                <button type="submit" className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white sm:w-auto">
                  Talep Olustur
                </button>
              </div>
            </div>
          </ContentCard>
        </form>

        <form action={clearDemoOperationsAction} className="flex justify-end">
          <button type="submit" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800 sm:w-auto">
            Demo Verisini Temizle
          </button>
        </form>

        <form action={resetBusinessOperationalDataAction}>
          <ContentCard title="Operasyon Verisini Sifirla">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
                Bu islem aktif isletmedeki adisyonlari, odemeleri, masa taleplerini, kurye ve kasa oturumlarini temizler.
                Urunler, kategoriler, personel ve ayarlar korunur.
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <input type="checkbox" name="deleteTables" className="h-4 w-4 rounded border-slate-300" />
                Masalari da tamamen sil
              </label>
              <div className="flex justify-end">
                <button type="submit" className="w-full rounded-2xl border border-rose-300 bg-white px-5 py-3 text-sm font-semibold text-rose-700 sm:w-auto">
                  Isletme Operasyonunu Temizle
                </button>
              </div>
            </div>
          </ContentCard>
        </form>
      </div>

      <section>
        <form action={updateGeneralSettingsAction}>
          <ContentCard title="Isletme Bilgileri">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Isletme adi" name="siteName" defaultValue={generalSettings.siteName} />
              <Field label="Telefon" name="contactPhone" defaultValue={generalSettings.contactPhone} />
              <Field label="WhatsApp" name="whatsappPhone" defaultValue={generalSettings.whatsappPhone} />
              <Field label="Destek e-postasi" name="supportEmail" defaultValue={generalSettings.supportEmail} type="email" />
              <Field label="Logo URL" name="logoUrl" defaultValue={generalSettings.logoUrl} />
              <div className="md:col-span-2">
                <Field label="Adres" name="address" defaultValue={generalSettings.address} />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white sm:w-auto">
                Isletme Bilgilerini Kaydet
              </button>
            </div>
          </ContentCard>
        </form>
      </section>
    </BackofficePage>
  );
}
