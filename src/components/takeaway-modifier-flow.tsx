"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import type {
  OrderItemModifierSelection,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
} from "@/lib/types";

/**
 * Takeaway secim akisi: urun -> boy -> ekler -> fiyat.
 *
 * Bugune kadar self-servis kasada modifier hic sorulmuyordu:
 * `admin-order-entry.tsx` icinde `isSelfServiceCoffee` dalinda varsayilanlar
 * otomatik secilip urun dogrudan sepete ekleniyordu. Yani her latte Medium,
 * tam yagli, ekstrasiz gidiyordu; kasiyer boy bile secemiyordu.
 *
 * Hiz tasarimin kendisi:
 *   - Gruplar sirali ama hepsi ayni anda gorunur. Zorunlu "ileri" dugmesi yok;
 *     her ek dokunus saniye demek.
 *   - Varsayilanlar onceden secili. Hicbir sey degistirmeyecekse tek dokunus
 *     yeter: urun -> Sepete Ekle.
 *   - "Sepete Ekle" en bastan gorunur ve fiyati uzerinde yazar; zorunlu grup
 *     eksikse pasif olur ve eksik grup vurgulanir.
 *   - Dokunma hedefleri 48px. Dokunmatikte hover diye bir sey yok, bu yuzden
 *     secili durum kenarlik + isaretle gosterilir.
 */

export type TakeawayModifierFlowProps = {
  product: Product;
  groups: ProductModifierGroup[];
  optionsByGroup: Map<string, ProductModifierOption[]>;
  initialQuantity?: number;
  onCancel: () => void;
  onConfirm: (selections: OrderItemModifierSelection[], quantity: number) => void;
};

function currency(value: number) {
  return `₺${value.toFixed(2)}`;
}

export function TakeawayModifierFlow({
  product,
  groups,
  optionsByGroup,
  initialQuantity = 1,
  onCancel,
  onConfirm,
}: TakeawayModifierFlowProps) {
  const [quantity, setQuantity] = useState(Math.max(1, initialQuantity));
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const defaults: Record<string, string[]> = {};
    for (const group of groups) {
      const options = optionsByGroup.get(group.id) ?? [];
      const preselected = options.filter((option) => option.is_default).map((option) => option.id);
      const fallback = group.is_required && preselected.length === 0 && options[0] ? [options[0].id] : [];
      defaults[group.id] = (preselected.length > 0 ? preselected : fallback).slice(
        0,
        Math.max(group.max_select, 1),
      );
    }
    return defaults;
  });

  const toggle = (group: ProductModifierGroup, optionId: string) => {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      const isOn = current.includes(optionId);

      // Tek secimli grupta dokunma her zaman secer. Secili olani tekrar
      // dokunup bosaltmak, zorunlu grubu yanlislikla gecersiz kilar.
      if (group.max_select <= 1) {
        if (isOn && !group.is_required) return { ...prev, [group.id]: [] };
        return { ...prev, [group.id]: [optionId] };
      }

      if (isOn) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.max_select) {
        return prev;
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const { selections, unitPrice, missingGroupIds } = useMemo(() => {
    const picked: OrderItemModifierSelection[] = [];
    const missing: string[] = [];
    let delta = 0;

    for (const group of groups) {
      const ids = selected[group.id] ?? [];
      if (group.is_required && ids.length < Math.max(group.min_select, 1)) {
        missing.push(group.id);
      }
      for (const id of ids) {
        const option = (optionsByGroup.get(group.id) ?? []).find((item) => item.id === id);
        if (!option) continue;
        delta += Number(option.price_delta);
        picked.push({
          group_id: group.id,
          group_name: group.name,
          option_id: option.id,
          option_name: option.name,
          price_delta: Number(option.price_delta),
          quantity: 1,
        });
      }
    }

    return {
      selections: picked,
      unitPrice: Number(product.price) + delta,
      missingGroupIds: missing,
    };
  }, [groups, optionsByGroup, product.price, selected]);

  const blocked = missingGroupIds.length > 0;
  const total = unitPrice * quantity;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4">
      <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950 text-white sm:rounded-3xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black tracking-tight">{product.name}</h2>
            {/* Adim seridi: urun -> boy -> ekler sirasini gosterir. */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-wide">
              <span className="text-emerald-400">✓ Ürün</span>
              {groups.map((group) => {
                const done = (selected[group.id] ?? []).length > 0;
                const isMissing = missingGroupIds.includes(group.id);
                return (
                  <span
                    key={`step-${group.id}`}
                    className={
                      isMissing ? "text-red-400" : done ? "text-emerald-400" : "text-white/35"
                    }
                  >
                    → {done && !isMissing ? "✓ " : ""}
                    {group.name}
                    {group.is_required && !done ? " (ZORUNLU)" : ""}
                  </span>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Kapat"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/60"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {groups.map((group) => {
            const options = optionsByGroup.get(group.id) ?? [];
            const ids = selected[group.id] ?? [];
            const isMissing = missingGroupIds.includes(group.id);

            return (
              <div key={group.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-black tracking-tight">{group.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      isMissing
                        ? "bg-red-600 text-white"
                        : group.is_required
                          ? "bg-white/10 text-white/60"
                          : "bg-white/5 text-white/40"
                    }`}
                  >
                    {group.is_required ? "Zorunlu" : "İsteğe bağlı"}
                    {group.max_select > 1 ? ` · en fazla ${group.max_select}` : ""}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {options.map((option) => {
                    const checked = ids.includes(option.id);
                    const delta = Number(option.price_delta);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggle(group, option.id)}
                        aria-pressed={checked}
                        className={`flex min-h-[48px] flex-col justify-center rounded-2xl border px-3 py-2.5 text-left active:scale-[0.98] ${
                          checked
                            ? "border-red-500 bg-red-600/20"
                            : "border-white/10 bg-white/[0.04]"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-bold">
                          {checked ? <Check className="h-3.5 w-3.5 shrink-0 text-red-400" /> : null}
                          <span className="truncate">{option.name}</span>
                        </span>
                        <span className="text-[11px] text-white/50">
                          {delta === 0
                            ? option.is_default
                              ? "varsayılan"
                              : "—"
                            : `${delta > 0 ? "+" : ""}${currency(delta).replace("₺", "")} ₺`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                aria-label="Adet azalt"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white/70"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-lg font-black">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((value) => value + 1)}
                aria-label="Adet artir"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white/70"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={blocked}
              onClick={() => onConfirm(selections, quantity)}
              className="flex min-h-[56px] flex-1 items-center justify-between rounded-2xl bg-red-600 px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
            >
              <span>{blocked ? "Zorunlu seçim eksik" : "Sepete Ekle"}</span>
              <span>{currency(total)}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
