"use client";

import { useMemo, useState } from "react";
import { getPublicCopy, type AppLocale } from "@/lib/i18n";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function LandingContactCard({
  businessPhone,
  leadStatus,
  supportEmail,
  eyebrow = "Demo Talebi",
  title = "İşletmeniz için uygun kurulumu birlikte planlayalim",
  body = "Bilgilerinizi birakin. Isterseniz WhatsApp veya telefon uzerinden de doğrudan bize ulasabilirsiniz.",
  previewMode = false,
  locale = "tr",
}: {
  businessPhone: string;
  leadStatus?: string;
  supportEmail?: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  previewMode?: boolean;
  locale?: AppLocale;
}) {
  const copy = getPublicCopy(locale);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [branchCount, setBranchCount] = useState("1");

  const whatsappHref = useMemo(() => {
    const phone = normalizePhone(businessPhone || "");
    const message =
      locale === "fr"
        ? [
            "Bonjour, je souhaite obtenir des informations et une demo pour Cloud POS.",
            `Entreprise: ${companyName || "-"}`,
            `Contact: ${contactName || "-"}`,
            `Nombre de succursales: ${branchCount || "-"}`,
          ].join("\n")
        : locale === "en"
          ? [
              "Hello, I would like information and a demo for Cloud POS.",
              `Business: ${companyName || "-"}`,
              `Contact: ${contactName || "-"}`,
              `Branch count: ${branchCount || "-"}`,
            ].join("\n")
          : [
              "Merhaba, Cloud POS için bilgi ve demo talep etmek istiyorum.",
              `İşletme: ${companyName || "-"}`,
              `Yetkili: ${contactName || "-"}`,
              `Şube sayısı: ${branchCount || "-"}`,
            ].join("\n");

    if (!phone) {
      return "#";
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [branchCount, businessPhone, companyName, contactName, locale]);

  const callHref = useMemo(() => {
    const phone = normalizePhone(businessPhone || "");
    return phone ? `tel:${phone}` : "#";
  }, [businessPhone]);

  const formFields = (
    <>
      <div className="sm:col-span-2">
        <label htmlFor="companyName" className="text-sm font-medium text-slate-700">
          {copy.contact.companyName}
        </label>
        <input
          id="companyName"
          name="companyName"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder={copy.contact.companyPlaceholder}
          required
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div>
        <label htmlFor="contactName" className="text-sm font-medium text-slate-700">
          {copy.contact.contactName}
        </label>
        <input
          id="contactName"
          name="contactName"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          placeholder={copy.contact.contactPlaceholder}
          required
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div>
        <label htmlFor="branchCount" className="text-sm font-medium text-slate-700">
          {copy.contact.branchCount}
        </label>
        <input
          id="branchCount"
          name="branchCount"
          value={branchCount}
          onChange={(event) => setBranchCount(event.target.value)}
          placeholder="1"
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div>
        <label htmlFor="phone" className="text-sm font-medium text-slate-700">
          {copy.contact.phone}
        </label>
        <input
          id="phone"
          name="phone"
          placeholder="+90 5xx xxx xx xx"
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          {copy.contact.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder={copy.contact.emailPlaceholder}
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="note" className="text-sm font-medium text-slate-700">
          {copy.contact.note}
        </label>
        <textarea
          id="note"
          name="note"
          rows={4}
          placeholder={copy.contact.notePlaceholder}
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type={previewMode ? "button" : "submit"}
          className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
        >
          {copy.contact.submit}
        </button>
      </div>
    </>
  );

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur sm:rounded-[2rem] sm:p-6">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h3>
      <p className="mt-3 max-w-2xl text-sm leadıng-7 text-slate-600">{body}</p>

      {leadStatus === "success" ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {copy.contact.success}
        </p>
      ) : null}
      {leadStatus === "error" ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {copy.contact.error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {previewMode ? (
          <div className="grid gap-4 sm:grid-cols-2">{formFields}</div>
        ) : (
          <form action="/contact/request" method="post" className="grid gap-4 sm:grid-cols-2">
            {formFields}
          </form>
        )}

        <div className="rounded-[1.25rem] bg-slate-950 p-4 text-white sm:rounded-[1.5rem] sm:p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{copy.contact.directEyebrow}</p>
          <p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{copy.contact.directTitle}</p>
          <p className="mt-3 text-sm leadıng-7 text-slate-300">
            {copy.contact.directBody}
          </p>
          {supportEmail ? <p className="mt-2 break-words text-sm text-slate-400">{supportEmail}</p> : null}
          <div className="mt-6 flex flex-col gap-3">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-950"
            >
              {copy.contact.whatsapp}
            </a>
            <a
              href={callHref}
              className="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              {copy.contact.call}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
