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

function getResendConfig(settings: SmtpSettings) {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || settings.fromEmail;
  const replyToEmail = process.env.RESEND_REPLY_TO_EMAIL?.trim() || settings.replyToEmail || settings.fromEmail;
  return {
    apiKey,
    fromEmail,
    replyToEmail,
    enabled: Boolean(apiKey && fromEmail),
  };
}

async function sendMailWithResend(
  input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  },
  settings: SmtpSettings,
) {
  const config = getResendConfig(settings);
  if (!config.enabled) {
    return { ok: false as const, error: "Resend ayarlari eksik." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<pre>${input.text}</pre>`,
      reply_to: config.replyToEmail || undefined,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      detail = payload.message ?? payload.error ?? "";
    } catch {
      detail = "";
    }
    return { ok: false as const, error: `Resend gonderimi başarısız (${response.status})${detail ? `: ${detail}` : ""}` };
  }

  return { ok: true as const };
}

export async function sendMailWithStoredSettings(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const settings = await getStoredSmtpSettings();
  const resendConfig = getResendConfig(settings);
  if (resendConfig.enabled) {
    return sendMailWithResend(input, settings);
  }

  if (!isSmtpConfigured(settings)) {
    return { ok: false, error: "Mail ayarlari eksik (Resend veya SMTP)." };
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
    subject: "Cloud POS mail test",
    text: "Bu bir test e-postasidir. Mail ayarlari calisiyor.",
    html: "<p>Bu bir test e-postasidir. Mail ayarlari calisiyor.</p>",
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
    "Yeni landing lead kaydı oluştu.",
    `İşletme: ${input.companyName}`,
    `Yetkili: ${input.contactName}`,
    `Telefon: ${input.phone || "-"}`,
    `E-posta: ${input.email || "-"}`,
    `Şube sayısı: ${input.branchCount || 1}`,
    `Not: ${input.note || "-"}`,
  ];

  return sendMailWithStoredSettings({
    to: settings.notificationEmail,
    subject: `Yeni lead: ${input.companyName}`,
    text: lines.join("\n"),
    html: `<p>Yeni landing lead kaydı oluştu.</p>
<ul>
  <li><strong>İşletme:</strong> ${input.companyName}</li>
  <li><strong>Yetkili:</strong> ${input.contactName}</li>
  <li><strong>Telefon:</strong> ${input.phone || "-"}</li>
  <li><strong>E-posta:</strong> ${input.email || "-"}</li>
  <li><strong>Şube sayısı:</strong> ${input.branchCount || 1}</li>
  <li><strong>Not:</strong> ${input.note || "-"}</li>
</ul>`,
  });
}
