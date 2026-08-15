import type { ReactNode } from "react";

/**
 * Support paneli genelinde 4 ayrı sayfada (tenants, health, plan-requests,
 * tickets) neredeyse birebir aynı arama+durum filtre formu elle kopyalanmıştı
 * — biri değişince diğerleri unutulabiliyordu. Boş-liste kutusu da 5+ yerde
 * aynı şekilde tekrar ediyordu. Tek yerden yönetmek icin buraya taşındı.
 */

export type SupportFilterSelect = {
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
};

export type SupportFilterBarProps = {
  queryName?: string;
  queryDefaultValue: string;
  queryPlaceholder: string;
  selects?: SupportFilterSelect[];
  submitLabel: string;
};

export function SupportFilterBar({
  queryName = "q",
  queryDefaultValue,
  queryPlaceholder,
  selects = [],
  submitLabel,
}: SupportFilterBarProps) {
  return (
    <form className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <input
        name={queryName}
        defaultValue={queryDefaultValue}
        placeholder={queryPlaceholder}
        className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm"
      />
      {selects.map((select) => (
        <select
          key={select.name}
          name={select.name}
          defaultValue={select.defaultValue}
          className="min-w-[150px] rounded-xl border border-slate-300 px-4 py-3 text-sm"
        >
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}
      <button type="submit" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
        {submitLabel}
      </button>
    </form>
  );
}

export function SupportEmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 ${className}`}>
      {children}
    </div>
  );
}
