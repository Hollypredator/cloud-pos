import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSmtpConfigured } from "@/lib/app-settings";
import { requireStudioAccess } from "@/lib/auth";
import { getGeneralSettings, getSmtpSettings, updateGeneralSettings, updateSmtpSettings } from "@/lib/data";
import { sendSmtpTestEmail } from "@/lib/email";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function updateGeneralSettingsAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/settings");

  await updateGeneralSettings({
    siteName: readString(formData, "siteName"),
    siteTagline: readString(formData, "siteTagline"),
    contactPhone: readString(formData, "contactPhone"),
    whatsappPhone: readString(formData, "whatsappPhone"),
    supportEmail: readString(formData, "supportEmail"),
    address: readString(formData, "address"),
    logoUrl: readString(formData, "logoUrl"),
    footerNote: readString(formData, "footerNote"),
  });

  revalidatePath("/");
  revalidatePath("/studio/settings");
}

async function updateSmtpSettingsAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/settings");

  await updateSmtpSettings({
    host: readString(formData, "host"),
    port: Number(readString(formData, "port")) || 587,
    secure: formData.get("secure") === "on",
    username: readString(formData, "username"),
    password: readString(formData, "password"),
    fromEmail: readString(formData, "fromEmail"),
    fromName: readString(formData, "fromName"),
    replyToEmail: readString(formData, "replyToEmail"),
    notificationEmail: readString(formData, "notificationEmail"),
  });

  revalidatePath("/studio/settings");
}

async function sendSmtpTestAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/settings");

  const recipient = readString(formData, "testRecipient");
  const result = await sendSmtpTestEmail(recipient);
  if (!result.ok) {
    redirect(`/studio/settings?mail=error&detail=${encodeURIComponent(result.error ?? "Mail gönderimi başarısız.")}`);
  }
  redirect("/studio/settings?mail=success");
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
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
      />
    </label>
  );
}

function Area({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
      />
    </label>
  );
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ mail?: string; detail?: string }>;
}) {
  await requireStudioAccess("/studio/settings");
  const params = (await searchParams) ?? {};
  const mailStatus = params.mail;
  const mailDetail = params.detail;
  const [{ settings: generalSettings }, { settings: smtpSettings, usingDemoData }] = await Promise.all([
    getGeneralSettings(),
    getSmtpSettings(),
  ]);
  const smtpReady = isSmtpConfigured(smtpSettings);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 md:px-10">
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Studio Ayarlar</p>
            <h1 className="text-3xl font-semibold text-slate-900">Genel ve SMTP Ayarlari</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
              Siteyi Ac
            </Link>
          </div>
        </header>

        {usingDemoData ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            Ayarlar tablosu okunamadı. Varsayilan ayarlar gosteriliyor.
          </p>
        ) : null}

        {mailStatus === "success" ? (
          <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-900">
            Test maili basariyla gönderildi. Gelen kutusu ve spam klasorunu kontrol et.
          </p>
        ) : null}
        {mailStatus === "error" ? (
          <p className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-900">
            Test maili gönderilemedi: {mailDetail || "Bilinmeyen hata."}
          </p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">WordPress Benzeri Yapı</p>
            <h2 className="mt-3 text-3xl font-semibold">Marka ve iletişim ayarlarini koddan ayir</h2>
            <p className="mt-3 text-sm leadıng-7 text-slate-300">
              Bu ekran logo, telefon, e-posta, footer notu ve SMTP gönderici ayarlarini panelden yönetmek için var.
            </p>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">SMTP Durumu</p>
            <div className="mt-4 flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                  smtpReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                }`}
              >
                {smtpReady ? "Hazır" : "Eksik"}
              </span>
              <p className="text-sm text-slate-600">
                {smtpReady ? "Lead bildirimleri ve test e-postasi gönderilebilir." : "Host, kullanıcı veya sifre eksik."}
              </p>
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <form action={updateGeneralSettingsAction} className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Genel Ayarlar</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Site adı" name="siteName" defaultValue={generalSettings.siteName} />
              <Field label="Site slogani" name="siteTagline" defaultValue={generalSettings.siteTagline} />
              <Field label="Telefon" name="contactPhone" defaultValue={generalSettings.contactPhone} />
              <Field label="WhatsApp numarasi" name="whatsappPhone" defaultValue={generalSettings.whatsappPhone} />
              <Field label="Destek e-postasi" name="supportEmail" defaultValue={generalSettings.supportEmail} type="email" />
              <Field label="Logo URL" name="logoUrl" defaultValue={generalSettings.logoUrl} />
              <div className="md:col-span-2">
                <Field label="Adres" name="address" defaultValue={generalSettings.address} />
              </div>
              <div className="md:col-span-2">
                <Area label="Footer notu" name="footerNote" defaultValue={generalSettings.footerNote} />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                Genel Ayarlari Kaydet
              </button>
            </div>
          </form>

          <div className="space-y-6">
            <form action={updateSmtpSettingsAction} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">SMTP Ayarlari</h2>
              <div className="mt-5 grid gap-4">
                <Field label="SMTP host" name="host" defaultValue={smtpSettings.host} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Port" name="port" defaultValue={smtpSettings.port} type="number" />
                  <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" name="secure" defaultChecked={smtpSettings.secure} />
                    TLS/SSL secure bağlantı
                  </label>
                </div>
                <Field label="Kullanıcı adı" name="username" defaultValue={smtpSettings.username} />
                <Field label="Şifre" name="password" defaultValue={smtpSettings.password} type="password" />
                <Field label="From e-posta" name="fromEmail" defaultValue={smtpSettings.fromEmail} type="email" />
                <Field label="From ad" name="fromName" defaultValue={smtpSettings.fromName} />
                <Field label="Reply-to e-posta" name="replyToEmail" defaultValue={smtpSettings.replyToEmail} type="email" />
                <Field
                  label="Lead bildirim e-postasi"
                  name="notificationEmail"
                  defaultValue={smtpSettings.notificationEmail}
                  type="email"
                />
              </div>
              <div className="mt-6 flex justify-end">
                <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                  SMTP Ayarlarini Kaydet
                </button>
              </div>
            </form>

            <form action={sendSmtpTestAction} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Test E-postasi</h2>
              <p className="mt-3 text-sm leadıng-7 text-slate-600">
                Ayarlari kaydettikten sonra test mesajini doğrudan bu panelden gönder.
              </p>
              <div className="mt-5 grid gap-4">
                <Field
                  label="Test alici e-postasi"
                  name="testRecipient"
                  defaultValue={smtpSettings.notificationEmail || generalSettings.supportEmail}
                  type="email"
                />
              </div>
              <div className="mt-6 flex justify-end">
                <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                  Test Maili Gonder
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
