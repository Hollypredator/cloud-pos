"use client";

/**
 * Adım adım modifier seçimi — firma isteği: ürün → boy → süt → ekstralar.
 *
 * Tüm kural `@/lib/modifiers/engine` içinde. Bu dosya sadece gösterir.
 *
 * Tasarım kararları (plan-design-review):
 *   10=A  Sistem akışı dayatmaz, ürün tanımı belirler. "Sepete ekle" her adımda
 *         görünür; zorunlu grup eksikse pasif olur ve eksik adım vurgulanır.
 *   4=A   Operasyon terminali düz yüzey — cam yok, hover transform yok,
 *         basılı durumu (active) var. Dokunmatikte hover diye bir şey yok.
 *   6=A   Dokunma hedefi en az 44px; tablet kasada 48px'e çıkar.
 *
 *   ┌─ adım şeridi ───────────────────────────────────────┐
 *   │ ✓ Iced Americano → [2 Boy ZORUNLU] → 3 Süt → 4 Ekstra│
 *   └─────────────────────────────────────────────────────┘
 *   ┌─ seçenek ızgarası ──────────────────────────────────┐
 *   │  Single      │  Medium ✓   │  Large               │
 *   │  −10,00 ₺    │  VARSAYILAN │  +15,00 ₺            │
 *   └─────────────────────────────────────────────────────┘
 *   ┌─ eylemler ──────────────────────────────────────────┐
 *   │ ← Geri │ Sonraki adım → │ Sepete ekle · 75,00 ₺    │
 *   └─────────────────────────────────────────────────────┘
 */

import { useMemo, useState } from "react";
import type { ProductModifierGroup, ProductModifierOption } from "@/lib/types";
import {
  buildSteps,
  initialSelection,
  toggleOption,
  isOptionSelected,
  canSelectMore,
  validate,
  unitPrice,
  describeSelection,
  nextStepIndex,
  type ModifierSelection,
  type ModifierStep,
} from "@/lib/modifiers/engine";

export type ModifierStepFlowProps = {
  productName: string;
  basePrice: number;
  groups: ProductModifierGroup[];
  options: ProductModifierOption[];
  onConfirm: (result: {
    selection: ModifierSelection;
    steps: ModifierStep[];
    unitPrice: number;
    summary: string;
  }) => void;
  onCancel: () => void;
};

const money = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

/** Fiyat farkı etiketi. Ücretsizde "Ücretsiz" yazmak "0,00 ₺"den net. */
function deltaLabel(delta: number) {
  const value = Number(delta) || 0;
  if (value === 0) return "Ücretsiz";
  return `${value > 0 ? "+" : "−"}${money(Math.abs(value))} ₺`;
}

export function ModifierStepFlow({
  productName,
  basePrice,
  groups,
  options,
  onConfirm,
  onCancel,
}: ModifierStepFlowProps) {
  const steps = useMemo(() => buildSteps(groups, options), [groups, options]);
  const [selection, setSelection] = useState<ModifierSelection>(() => initialSelection(steps));
  const [activeIndex, setActiveIndex] = useState(0);
  // Zorunlu adım eksikken "Sepete ekle"ye basılırsa hangi adımın vurgulanacağı.
  const [highlightGroupId, setHighlightGroupId] = useState<string | null>(null);

  const { isValid, missingGroupIds } = validate(steps, selection);
  const price = unitPrice(basePrice, selection);
  const activeStep = steps[activeIndex];

  const handleToggle = (step: ModifierStep, option: ProductModifierOption) => {
    setSelection((prev) => toggleOption(prev, step, option));
    setHighlightGroupId(null);
  };

  const handleNext = () => {
    const next = nextStepIndex(steps, selection, activeIndex);
    if (next !== -1) setActiveIndex(next);
  };

  const handleConfirm = () => {
    if (!isValid) {
      // Kilitlemek yerine eksik adıma götür — kasiyer ne yapacağını görsün.
      const blocking = steps.findIndex((step) => step.group.id === missingGroupIds[0]);
      if (blocking !== -1) setActiveIndex(blocking);
      setHighlightGroupId(missingGroupIds[0]);
      return;
    }
    onConfirm({ selection, steps, unitPrice: price, summary: describeSelection(steps, selection) });
  };

  if (steps.length === 0 || !activeStep) return null;

  const isLastStep = activeIndex === steps.length - 1;

  return (
    <div className="surface-flat flex h-full flex-col gap-4" data-testid="modifier-step-flow">
      {/* Adım şeridi — nerede olduğunu ve ne kaldığını gösterir (wayfinding). */}
      <ol className="flex flex-wrap items-center gap-2" aria-label="Sipariş adımları">
        <li className="flex items-center gap-2 rounded-xl border border-emerald-900 bg-emerald-950/60 px-3.5 py-2 text-[13px] font-semibold text-emerald-300">
          <span aria-hidden="true">✓</span>
          {productName}
        </li>
        {steps.map((step, index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          const missing = missingGroupIds.includes(step.group.id);
          return (
            <li key={step.group.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-current={current ? "step" : undefined}
                className={[
                  "flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-colors active:scale-[0.98]",
                  current
                    ? "border-[color:var(--brand-2)] bg-[color:var(--brand-1)] text-white"
                    : done
                      ? "border-emerald-900 bg-emerald-950/60 text-emerald-300"
                      : missing
                        ? "border-[color:var(--brand-2)] text-[color:var(--brand-text)]"
                        : "border-[color:var(--panel-border)] text-[color:var(--m-muted)]",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/20 text-[11px] font-extrabold"
                >
                  {done ? "✓" : index + 2}
                </span>
                {step.group.name}
                {step.group.is_required ? (
                  <span className="text-[10px] font-extrabold tracking-wider text-amber-300">ZORUNLU</span>
                ) : step.isMultiSelect ? (
                  <span className="text-[10px] font-extrabold tracking-wider text-zinc-500">
                    EN FAZLA {step.group.max_select}
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold tracking-wider text-zinc-600">OPSİYONEL</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Seçenek ızgarası. Fiyat farkı her kartta yazılı — kasiyer toplamı
          zihinden hesaplamaz. */}
      <div
        className={[
          "grid grid-cols-2 gap-2.5 sm:grid-cols-3",
          highlightGroupId === activeStep.group.id ? "rounded-2xl ring-2 ring-[color:var(--brand-2)]" : "",
        ].join(" ")}
        role={activeStep.isMultiSelect ? "group" : "radiogroup"}
        aria-label={activeStep.group.name}
      >
        {activeStep.options.map((option) => {
          const selected = isOptionSelected(selection, activeStep.group.id, option.id);
          // Limit dolduğunda kalan kartlar soluklaşır — hata mesajı çıkmaz.
          const blocked = !selected && activeStep.isMultiSelect && !canSelectMore(selection, activeStep);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleToggle(activeStep, option)}
              disabled={blocked}
              role={activeStep.isMultiSelect ? "checkbox" : "radio"}
              aria-checked={selected}
              className={[
                "flex min-h-[78px] flex-col justify-between rounded-xl border p-4 text-left transition-colors active:scale-[0.98]",
                selected
                  ? "border-[color:var(--brand-1)] bg-[#1a0f10]"
                  : "border-[color:var(--panel-border)] bg-[color:var(--panel)]",
                blocked ? "opacity-40" : "",
              ].join(" ")}
            >
              <span className="text-[15px] font-bold text-white">
                {option.name}
                {option.is_default ? (
                  <span className="ml-2 text-[10px] font-extrabold tracking-wide text-emerald-400">VARSAYILAN</span>
                ) : null}
              </span>
              <span
                className={[
                  "mt-2 font-numeric text-[13px] font-bold",
                  selected ? "text-[color:var(--brand-text)]" : "text-[color:var(--m-muted)]",
                ].join(" ")}
              >
                {deltaLabel(option.price_delta)}
              </span>
            </button>
          );
        })}
      </div>

      {activeStep.isMultiSelect ? (
        <p className="text-xs text-zinc-500">
          {(selection[activeStep.group.id] ?? []).length}/{activeStep.group.max_select} seçildi
        </p>
      ) : null}

      {/* Eylemler. "Sepete ekle" her adımda görünür (karar 10=A) — kalan
          opsiyonel gruplar varsayılanıyla geçilir. */}
      <div className="mt-auto flex flex-wrap gap-2.5 border-t border-[color:var(--panel-border)] pt-3.5">
        <button
          type="button"
          onClick={() => (activeIndex === 0 ? onCancel() : setActiveIndex(activeIndex - 1))}
          className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
        >
          {activeIndex === 0 ? "Vazgeç" : "← Geri"}
        </button>
        {!isLastStep ? (
          <button
            type="button"
            onClick={handleNext}
            className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            Sonraki adım →
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleConfirm}
          aria-disabled={!isValid}
          className={[
            "min-h-11 flex-1 rounded-xl px-4 py-3 text-sm font-bold active:scale-[0.98]",
            isValid
              ? "border border-[color:var(--brand-2)] bg-[color:var(--brand-1)] text-white"
              : "border border-zinc-800 bg-zinc-900 text-zinc-600",
          ].join(" ")}
        >
          Sepete ekle · <span className="font-numeric">{money(price)} ₺</span>
        </button>
      </div>

      {!isValid ? (
        <p className="text-xs font-semibold text-[color:var(--brand-text)]">
          {steps.find((step) => step.group.id === missingGroupIds[0])?.group.name} seçilmeden sepete eklenemez.
        </p>
      ) : null}
    </div>
  );
}
