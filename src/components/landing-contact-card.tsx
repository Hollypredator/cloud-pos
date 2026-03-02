"use client";

import { useMemo, useState } from "react";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function LandingContactCard({
  businessPhone,
  leadStatus,
  supportEmail,
  eyebrow = "Demo ve Teklif",
  title = "Musteri gorusmesini buradan kapat",
  body = "Bilgileri gir, hazir WhatsApp mesaji ile demo talebi gonder. Istersen dogrudan arama baslat.",
  previewMode = false,
}: {
  businessPhone: string;
  leadStatus?: string;
  supportEmail?: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  previewMode?: boolean;
}) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [branchCount, setBranchCount] = useState("1");

  const whatsappHref = useMemo(() => {
    const phone = normalizePhone(businessPhone || "");
    const message = [
      "Merhaba, Cloud POS icin demo ve teklif almak istiyorum.",
      `Isletme: ${companyName || "-"}`,
      `Yetkili: ${contactName || "-"}`,
      `Sube sayisi: ${branchCount || "-"}`,
    ].join("\n");

    if (!phone) {
      return "#";
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [branchCount, businessPhone, companyName, contactName]);

  const callHref = useMemo(() => {
    const phone = normalizePhone(businessPhone || "");
    return phone ? `tel:${phone}` : "#";
  }, [businessPhone]);

  const formFields = (
    <>
      <div className="sm:col-span-2">
        <label htmlFor="companyName" className="text-sm font-medium text-slate-700">
          Isletme adi
        </label>
        <input
          id="companyName"
          name="companyName"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="Ornek: Mavi Fincan Cafe"
          required
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div>
        <label htmlFor="contactName" className="text-sm font-medium text-slate-700">
          Yetkili kisi
        </label>
        <input
          id="contactName"
          name="contactName"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          placeholder="Ad Soyad"
          required
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div>
        <label htmlFor="branchCount" className="text-sm font-medium text-slate-700">
          Sube sayisi
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
          Telefon
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
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="yetkili@isletme.com"
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="note" className="text-sm font-medium text-slate-700">
          Not
        </label>
        <textarea
          id="note"
          name="note"
          rows={4}
          placeholder="QR siparis, kasa, rapor veya stok takibi gibi ihtiyaci yazin"
          disabled={previewMode}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type={previewMode ? "button" : "submit"}
          className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
        >
          Teklif Talebi Gonder
        </button>
      </div>
    </>
  );

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur sm:rounded-[2rem] sm:p-6">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{body}</p>

      {leadStatus === "success" ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Teklif talebi kaydedildi. Simdi WhatsApp veya telefonla gorusmeye devam edebilirsin.
        </p>
      ) : null}
      {leadStatus === "error" ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Talep kaydi olusturulamadi. Formu tekrar dene veya WhatsApp ile ulas.
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
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Hizli Iletisim</p>
          <p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">Demo tarihi netlestir</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Satista bekleme yaratma. Hazir mesajla iletisime gec, ayni gorusmede sonraki adimi al.
          </p>
          {supportEmail ? <p className="mt-2 break-words text-sm text-slate-400">{supportEmail}</p> : null}
          <div className="mt-6 flex flex-col gap-3">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-950"
            >
              WhatsApp ile Teklif Al
            </a>
            <a
              href={callHref}
              className="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Hemen Ara
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
