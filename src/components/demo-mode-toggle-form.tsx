"use client";

import { useId, useRef, useState } from "react";

type DemoModeToggleFormProps = {
  defaultChecked: boolean;
  action: (formData: FormData) => void | Promise<void>;
};

export function DemoModeToggleForm({ defaultChecked, action }: DemoModeToggleFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputId = useId();
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <form action={action} ref={formRef} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
      <input type="hidden" name="demoMode_present" value="1" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-slate-900">Demo Modu</p>
          <p className="mt-1 text-sm text-slate-500">
            Acildiginda test verisi hazırlanır. Kapatıldığında yeni demo veri uretimi durur.
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#ff6a3d]">Aninda kaydolur</p>
        </div>
        <label htmlFor={inputId} className="relative inline-flex cursor-pointer items-center">
          <input
            id={inputId}
            type="checkbox"
            name="demoMode"
            checked={checked}
            className="peer sr-only"
            onChange={(event) => {
              setChecked(event.target.checked);
              formRef.current?.requestSubmit();
            }}
          />
          <span className="h-8 w-14 rounded-full bg-slate-200 transition peer-checked:bg-[#ff6a3d]" />
          <span className="absolute left-1 h-6 w-6 rounded-full bg-white shadow-sm transition peer-checked:translate-x-6" />
        </label>
      </div>
    </form>
  );
}
