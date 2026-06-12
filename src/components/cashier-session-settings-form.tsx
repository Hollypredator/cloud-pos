"use client";

import { useActionState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";

export type SessionSettingsFormActionState = {
  tone: "success" | "error" | null;
  message: string;
};

type SessionSettingsFormValues = {
  autoSessionCloseEnabled: boolean;
  autoSessionCloseTime: string;
  requireNoOpenChecksForSessionClose: boolean;
};

const initialActionState: SessionSettingsFormActionState = {
  tone: null,
  message: "",
};

export function CashierSessionSettingsForm({
  values,
  action,
}: {
  values: SessionSettingsFormValues;
  action: (
    state: SessionSettingsFormActionState,
    formData: FormData,
  ) => Promise<SessionSettingsFormActionState>;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">Otomatik Gün Sonu</p>
          <p className="text-sm text-slate-500">Belirtilen saatte gun sonunu otomatik tetikle</p>
        </div>
        <span className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" name="autoSessionCloseEnabled" defaultChecked={values.autoSessionCloseEnabled} className="peer sr-only" />
          <span className="h-8 w-14 rounded-full bg-slate-300 transition peer-checked:bg-[#ff6a3d]" />
          <span className="pointer-events-none absolute left-1 h-6 w-6 rounded-full bg-white transition peer-checked:translate-x-6" />
        </span>
      </label>
      <input type="hidden" name="autoSessionCloseEnabled_present" value="1" />

      <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <p className="text-lg font-semibold text-slate-900">Gün Sonu Saati</p>
        <input
          type="time"
          name="autoSessionCloseTime"
          defaultValue={values.autoSessionCloseTime}
          className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800"
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">Açık Adisyon Kontrolu</p>
          <p className="text-sm text-slate-500">Gün sonu oncesi açık hesaplari zorunlu kapat</p>
        </div>
        <span className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            name="requireNoOpenChecksForSessionClose"
            defaultChecked={values.requireNoOpenChecksForSessionClose}
            className="peer sr-only"
          />
          <span className="h-8 w-14 rounded-full bg-slate-300 transition peer-checked:bg-[#ff6a3d]" />
          <span className="pointer-events-none absolute left-1 h-6 w-6 rounded-full bg-white transition peer-checked:translate-x-6" />
        </span>
      </label>
      <input type="hidden" name="requireNoOpenChecksForSessionClose_present" value="1" />

      {state.tone ? (
        <p
          aria-live="polite"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            state.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <PendingSubmitButton
        idleLabel="Ayari Kaydet"
        pendingLabel="Kaydediliyor..."
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
      />
    </form>
  );
}

