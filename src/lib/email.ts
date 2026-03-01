import nodemailer from "nodemailer";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { defaultSmtpSettings, isSmtpConfigured, normalizeSmtpSettings, type SmtpSettings } from "@/lib/app-settings";

async function getStoredSmtpSettings() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return defaultSmtpSettings;
  }

  const { data } = await supabase
    .from("app_settings")
    .select("content")
    .eq("key", "smtp_settings")
    .maybeSingle();

  return normalizeSmtpSettings((data?.content as Partial<SmtpSettings> | undefined) ?? null);
}

function createTransport(settings: SmtpSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.username,
      pass: settings.password,
    },
  });
}

export async function sendMailWithStoredSettings(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const settings = await getStoredSmtpSettings();
  if (!isSmtpConfigured(settings)) {
    return { ok: false, error: "SMTP ayarlari eksik." };
  }

  const transport = createTransport(settings);
  await transport.sendMail({
    from: settings.fromName ? `"${settings.fromName}" <${settings.fromEmail}>` : settings.fromEmail,
    to: input.to,
    replyTo: settings.replyToEmail || settings.fromEmail,
    subject: input.subject,
    text: input.text,
    html: input.html ?? `<pre>${input.text}</pre>`,
  });

  return { ok: true };
}

export async function sendSmtpTestEmail(recipient: string) {
  const to = recipient.trim();
  if (!to) {
    return { ok: false, error: "Test alici e-postasi gerekli." };
  }

  return sendMailWithStoredSettings({
    to,
    subject: "Cloud POS SMTP test",
    text: "Bu bir test e-postasidir. SMTP ayarlari calisiyor.",
    html: "<p>Bu bir test e-postasidir. SMTP ayarlari calisiyor.</p>",
  });
}

export async function notifySalesLeadCreated(input: {
  companyName: string;
  contactName: string;
  phone?: string;
  email?: string;
  branchCount?: number;
  note?: string;
}) {
  const settings = await getStoredSmtpSettings();
  if (!isSmtpConfigured(settings) || !settings.notificationEmail) {
    return { ok: false, skipped: true };
  }

  const lines = [
    "Yeni landing lead kaydi olustu.",
    `Isletme: ${input.companyName}`,
    `Yetkili: ${input.contactName}`,
    `Telefon: ${input.phone || "-"}`,
    `E-posta: ${input.email || "-"}`,
    `Sube sayisi: ${input.branchCount || 1}`,
    `Not: ${input.note || "-"}`,
  ];

  return sendMailWithStoredSettings({
    to: settings.notificationEmail,
    subject: `Yeni lead: ${input.companyName}`,
    text: lines.join("\n"),
    html: `<p>Yeni landing lead kaydi olustu.</p>
<ul>
  <li><strong>Isletme:</strong> ${input.companyName}</li>
  <li><strong>Yetkili:</strong> ${input.contactName}</li>
  <li><strong>Telefon:</strong> ${input.phone || "-"}</li>
  <li><strong>E-posta:</strong> ${input.email || "-"}</li>
  <li><strong>Sube sayisi:</strong> ${input.branchCount || 1}</li>
  <li><strong>Not:</strong> ${input.note || "-"}</li>
</ul>`,
  });
}
