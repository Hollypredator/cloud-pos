"use client";

import { Check, Minus, Plus, X } from "lucide-react";
import type { Product, ProductModifierGroup, ProductModifierOption } from "@/lib/types";

/**
 * Self-servis izgarasinda urun -> boy -> ekler -> fiyat akisi, satir-ici.
 *
 * Daha once bu is `TakeawayModifierFlow` ile tam ekran modal olarak
 * yapiliyordu (bkz. o dosyanin tarihi). Ust uste kahve girerken her urun
 * icin ekrani terk edip geri donmek gerekiyordu; siparis kuyrugu birikince
 * bu gecis maliyeti hizi yiyordu. Burada urun karti kendi yerinde genisler,
 * izgaranin geri kalani gorunur kalir, kapanista aynen o noktaya doner.
 *
 * Not: bu dosya tek basina render mantigi tasir, state'i (`selected`,
 * `quantity`) ebeveynden (admin-order-entry.tsx) alir — cunku ayni state
 * zaten restoran tarafinin acik temali modaliyla da paylasiliyor.
 */

export type SelfServiceModifierInlineProps = {
  product: Product;
  groups: ProductModifierGroup[];
  optionsByGroup: Map<string, ProductModifierOption[]>;
  selected: Record<string, string[]>;
  onToggle: (group: ProductModifierGroup, optionId: string) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function currency(value: number) {
  return `₺${value.toFixed(2)}`;
}

export function SelfServiceModifierInline({
  product,
  groups,
  optionsByGroup,
  selected,
  onToggle,
  quantity,
  onQuantityChange,
  onCancel,
  onConfirm,
}: SelfServiceModifierInlineProps) {
  let delta = 0;
  const missingGroupIds: string[] = [];
  for (const group of groups) {
    const ids = selected[group.id] ?? [];
    if (group.is_required && ids.length < Math.max(1, group.min_select)) {
      missingGroupIds.push(group.id);
    }
    for (const id of ids) {
      const option = (optionsByGroup.get(group.id) ?? []).find((item) => item.id === id);
      if (option) delta += Number(option.price_delta);
    }
  }
  const blocked = missingGroupIds.length > 0;
  const total = (Number(product.price) + delta) * quantity;

  // Adim listesi: "Ürün" her zaman ilk ve tamamlanmis (buraya bir urun
  // secilerek gelindi). Sonraki adimlar veriden gelen gerçek gruplar —
  // sabit "Boy/Ekstra" degil, tenant kendi Recipe Studio'sundan ne
  // tanimlarsa o. Referans tasarimlarda 3 adim gorunuyordu (Ürün/Boyut/
  // Ekstralar) cunku o ornekte grup sayisi 2'ydi; burada grup sayisi
  // degisken oldugu icin adim sayisi da veriye gore uzar/kisalir.
  const steps = [
    { key: "__product__", label: "Ürün", done: true, missing: false },
    ...groups.map((group) => ({
      key: group.id,
      label: group.name,
      done: (selected[group.id] ?? []).length > 0,
      missing: missingGroupIds.includes(group.id),
    })),
  ];

  return (
    <article className="rounded-2xl border-2 border-rose-400/60 bg-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="border-b border-white/10 px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-lg font-black tracking-tight text-white">{product.name}</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Vazgeç"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Buyuk adim seridi: numarali daire + baglanti cizgisi + etiket.
            Kucuk, gomulu bir metin satiri degil — kasiyer uzaktan/hizlica
            "hangi asamadayim" sorusuna gozle cevap bulabilsin diye. */}
        <div className="flex items-center gap-1 overflow-x-auto py-3">
        {steps.map((step, index) => (
          <div key={step.key} className="flex shrink-0 items-center gap-1">
            {index > 0 ? (
              <span
                className={`h-[2px] w-6 shrink-0 ${
                  steps[index - 1].done && !steps[index - 1].missing ? "bg-emerald-400" : "bg-white/15"
                }`}
                aria-hidden="true"
              />
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  step.missing
                    ? "bg-red-600 text-white"
                    : step.done
                      ? "bg-emerald-500 text-white"
                      : "border-2 border-white/25 text-white/50"
                }`}
              >
                {step.done && !step.missing ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={`whitespace-nowrap text-[10px] font-bold uppercase tracking-wide ${
                  step.missing ? "text-red-400" : step.done ? "text-emerald-300" : "text-white/45"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        ))}
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {groups.map((group) => {
          const options = optionsByGroup.get(group.id) ?? [];
          const ids = selected[group.id] ?? [];
          const isMissing = missingGroupIds.includes(group.id);
          return (
            <div key={group.id}>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wide text-white/80">{group.name}</h4>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                    isMissing
                      ? "bg-red-600 text-white"
                      : group.is_required
                        ? "bg-white/10 text-white/60"
                        : "bg-white/5 text-white/40"
                  }`}
                >
                  {group.is_required ? "Zorunlu" : "İsteğe bağlı"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {options.map((option) => {
                  const checked = ids.includes(option.id);
                  const optionDelta = Number(option.price_delta);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onToggle(group, option.id)}
                      aria-pressed={checked}
                      className={`flex min-h-[44px] flex-col justify-center rounded-xl border px-2.5 py-2 text-left active:scale-[0.98] ${
                        checked ? "border-rose-400 bg-rose-500/20" : "border-white/10 bg-white/[0.04]"
                      }`}
                    >
                      <span className="flex items-center gap-1 text-xs font-bold text-white">
                        {checked ? <Check className="h-3 w-3 shrink-0 text-rose-300" /> : null}
                        <span className="truncate">{option.name}</span>
                      </span>
                      <span className="text-[10px] text-white/50">
                        {optionDelta === 0
                          ? option.is_default
                            ? "varsayılan"
                            : "—"
                          : `${optionDelta > 0 ? "+" : ""}${optionDelta.toFixed(2)} ₺`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 px-4 pb-4">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => onQuantityChange(quantity - 1)}
            aria-label="Adet azalt"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/70"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-6 text-center text-sm font-black text-white">{quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(quantity + 1)}
            aria-label="Adet artır"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/70"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          disabled={blocked}
          onClick={onConfirm}
          className="flex min-h-[48px] flex-1 items-center justify-between rounded-xl bg-rose-500 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
        >
          <span>{blocked ? "Zorunlu seçim eksik" : "Sepete Ekle"}</span>
          <span>{currency(total)}</span>
        </button>
      </div>
    </article>
  );
}
