"use client";

import { useState } from "react";
import { Check, ChevronLeft, Minus, Plus, X } from "lucide-react";
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
 * Gruplar tek tek, sirayla gosterilir (hepsi ayni anda degil): kasiyer her
 * ekranda TEK bir karar veriyor, "Ileri" ile sonrakine geciyor. Bu hem
 * coklu-urunlu siparislerde her urun icin gozle taranacak alani sabit ve
 * kucuk tutuyor (hiz), hem de fiyati son adima (Onay ekrani) kadar
 * gostermeyerek erken "bitti" hissi vermiyor — ozellikle Ekstra gibi
 * istege bagli, yukselt-satis potansiyeli olan gruplar atlanmasin diye.
 *
 * Not: bu dosya tek basina render mantigi tasir, state'i (`selected`,
 * `quantity`) ebeveynden (admin-order-entry.tsx) alir — cunku ayni state
 * zaten restoran tarafinin acik temali modaliyla da paylasiliyor. Adim
 * ilerlemesi (`stepIndex`) ise sadece bu bilesenin kendi ici; ebeveyn urun
 * degistiginde bu bileseni yeniden mount ediyor (React key=product.id), o
 * yuzden her urun acilisinda otomatik olarak bastan basliyor.
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
  const [stepIndex, setStepIndex] = useState(0);

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
  const total = (Number(product.price) + delta) * quantity;

  const onReview = stepIndex >= groups.length;
  const currentGroup = onReview ? null : groups[stepIndex];
  const currentIds = currentGroup ? selected[currentGroup.id] ?? [] : [];
  const currentSatisfied =
    !currentGroup || !currentGroup.is_required || currentIds.length >= Math.max(1, currentGroup.min_select);

  const steps = [
    { key: "__product__", label: "Ürün", index: -1, done: true, missing: false },
    ...groups.map((group, index) => ({
      key: group.id,
      label: group.name,
      index,
      done: (selected[group.id] ?? []).length > 0,
      missing: missingGroupIds.includes(group.id),
    })),
    { key: "__review__", label: "Onay", index: groups.length, done: onReview, missing: false },
  ];

  return (
    <article className="rounded-2xl border-2 border-[#e8502f]/50 bg-white shadow-[0_8px_24px_rgba(36,26,23,0.12)]">
      <div className="border-b border-[#e7dcd7] px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-lg font-black tracking-tight text-[#241a17]">{product.name}</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Vazgeç"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e7dcd7] text-[#8a7a74] hover:bg-[#f5efec]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Buyuk adim seridi: numarali daire + baglanti cizgisi + etiket.
            Ziyaret edilmis adimlara (index <= stepIndex) dokunup geri
            donulebilir; ilerisi henuz acilmadigi icin tiklanamaz. */}
        <div className="flex items-center gap-1 overflow-x-auto py-3">
          {steps.map((step, position) => {
            const isCurrent = step.index === stepIndex;
            const isVisited = step.index <= stepIndex;
            const canJump = step.index >= 0 && step.index < stepIndex;
            return (
              <div key={step.key} className="flex shrink-0 items-center gap-1">
                {position > 0 ? (
                  <span
                    className={`h-[2px] w-6 shrink-0 ${
                      steps[position - 1].done && !steps[position - 1].missing ? "bg-emerald-500" : "bg-[#e7dcd7]"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
                <button
                  type="button"
                  disabled={!canJump}
                  onClick={() => canJump && setStepIndex(step.index)}
                  className="flex flex-col items-center gap-1 disabled:cursor-default"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black transition ${
                      step.missing
                        ? "bg-red-600 text-white"
                        : step.done
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                            ? "border-2 border-[#e8502f] text-[#e8502f]"
                            : "border-2 border-[#e7dcd7] text-[#b8a9a3]"
                    } ${isVisited ? "" : "opacity-60"}`}
                  >
                    {step.done && !step.missing ? <Check className="h-3.5 w-3.5" /> : position}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[10px] font-bold uppercase tracking-wide ${
                      step.missing
                        ? "text-red-600"
                        : step.done
                          ? "text-emerald-600"
                          : isCurrent
                            ? "text-[#e8502f]"
                            : "text-[#b8a9a3]"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {onReview ? (
        <div className="space-y-2 px-4 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#8a7a74]">Özet</p>
          {groups.map((group) => {
            const ids = selected[group.id] ?? [];
            if (ids.length === 0) return null;
            const names = ids
              .map((id) => optionsByGroup.get(group.id)?.find((option) => option.id === id)?.name)
              .filter(Boolean)
              .join(", ");
            return (
              <div key={group.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[#8a7a74]">{group.name}</span>
                <span className="truncate font-semibold text-[#241a17]">{names}</span>
              </div>
            );
          })}
        </div>
      ) : currentGroup ? (
        <div className="px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-black uppercase tracking-wide text-[#241a17]">{currentGroup.name}</h4>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                missingGroupIds.includes(currentGroup.id)
                  ? "bg-red-600 text-white"
                  : currentGroup.is_required
                    ? "bg-[#f5efec] text-[#8a7a74]"
                    : "bg-[#f5efec]/60 text-[#b8a9a3]"
              }`}
            >
              {currentGroup.is_required ? "Zorunlu" : "İsteğe bağlı"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(optionsByGroup.get(currentGroup.id) ?? []).map((option) => {
              const checked = currentIds.includes(option.id);
              const optionDelta = Number(option.price_delta);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onToggle(currentGroup, option.id)}
                  aria-pressed={checked}
                  className={`flex min-h-[56px] flex-col justify-center rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                    checked ? "border-[#e8502f] bg-[#ffe4dc]" : "border-[#e7dcd7] bg-white hover:border-[#e8502f]/40"
                  }`}
                >
                  <span className="flex items-center gap-1 text-sm font-bold text-[#241a17]">
                    {checked ? <Check className="h-3.5 w-3.5 shrink-0 text-[#e8502f]" /> : null}
                    <span className="truncate">{option.name}</span>
                  </span>
                  <span className="text-[11px] text-[#8a7a74]">
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
      ) : null}

      <div className="flex items-center gap-3 border-t border-[#e7dcd7] px-4 py-4">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={() => setStepIndex((index) => index - 1)}
            aria-label="Geri"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#e7dcd7] text-[#8a7a74] hover:bg-[#f5efec]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}

        {onReview ? (
          <>
            <div className="flex items-center gap-1 rounded-xl border border-[#e7dcd7] bg-[#f5efec] p-1">
              <button
                type="button"
                onClick={() => onQuantityChange(quantity - 1)}
                aria-label="Adet azalt"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#8a7a74]"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-black text-[#241a17]">{quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(quantity + 1)}
                aria-label="Adet artır"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#8a7a74]"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onConfirm}
              className="flex min-h-[48px] flex-1 items-center justify-between rounded-xl bg-[#e8502f] px-4 text-sm font-black text-white hover:bg-[#d1441f]"
            >
              <span>Sepete Ekle</span>
              <span>{currency(total)}</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!currentSatisfied}
            onClick={() => setStepIndex((index) => index + 1)}
            className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#e8502f] text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#f5efec] disabled:text-[#c8b9b3]"
          >
            {currentSatisfied ? "İleri" : "Zorunlu seçim yap"}
          </button>
        )}
      </div>
    </article>
  );
}
