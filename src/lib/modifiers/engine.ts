/**
 * Modifier motoru — üç yüzeyin paylaştığı tek kaynak.
 *
 * Kullananlar:
 *   - Takeaway kasa      → adım adım akış (firma isteği: ürün → boy → süt → ekstralar)
 *   - QR müşteri menüsü  → adım adım akış (müşteri menüyü bilmiyor)
 *   - Restoran adisyonu  → tek ekran yoğun liste (garson hızlı, çok kalemli çalışıyor)
 *
 * Sunum üç yerde farklı, kural tek yerde. Fiyat hesabı, zorunluluk ve seçim
 * limitleri burada; ekranlar sadece gösterir.
 *
 * Akış tamamen veriden gelir, kodda sabit adım yoktur:
 *
 *   product_modifier_groups                  akıştaki karşılığı
 *   ├── sort_order ......................... adım sırası
 *   ├── name ............................... adım başlığı
 *   ├── is_required ........................ adım atlanabilir mi
 *   ├── min_select ......................... en az kaç seçenek
 *   └── max_select ......................... en fazla kaç seçenek (>1 ise çoklu)
 *
 *   product_modifier_options
 *   ├── is_default ......................... önseçili gelir
 *   ├── price_delta ........................ karttaki fiyat farkı
 *   └── sort_order ......................... seçenek sırası
 *
 * Karar (plan-design-review 10=A): sistem akışı dayatmaz, ürün tanımı belirler.
 * is_required=true grup atlanamaz; diğerleri varsayılanıyla geçilir. Modifier'ı
 * olmayan ürün hiç adım göstermez, tek dokunuşta sepete iner.
 */

import type { ProductModifierGroup, ProductModifierOption } from "@/lib/types";

/** Grup kimliği → o grupta seçili seçenekler. Çoklu seçim için dizi. */
export type ModifierSelection = Record<string, ProductModifierOption[]>;

/** Bir ürünün tek adımı: grup + o gruba ait seçenekler, sıralı. */
export type ModifierStep = {
  group: ProductModifierGroup;
  options: ProductModifierOption[];
  /** max_select > 1 → kullanıcı birden fazla seçebilir (ekstralar, soslar). */
  isMultiSelect: boolean;
};

export type ModifierValidation = {
  isValid: boolean;
  /** Zorunlu ama yeterli seçim yapılmamış grupların kimlikleri, adım sırasında. */
  missingGroupIds: string[];
};

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/**
 * Bir ürünün adımlarını kurar. Seçeneği olmayan grup adım üretmez — boş bir
 * adımda kullanıcıyı bekletmek anlamsız.
 */
export function buildSteps(
  groups: ProductModifierGroup[],
  options: ProductModifierOption[],
): ModifierStep[] {
  const optionsByGroup = new Map<string, ProductModifierOption[]>();
  for (const option of options) {
    const list = optionsByGroup.get(option.group_id);
    if (list) {
      list.push(option);
    } else {
      optionsByGroup.set(option.group_id, [option]);
    }
  }

  return [...groups]
    .sort(bySortOrder)
    .map((group) => ({
      group,
      options: (optionsByGroup.get(group.id) ?? []).sort(bySortOrder),
      isMultiSelect: group.max_select > 1,
    }))
    .filter((step) => step.options.length > 0);
}

/**
 * Ürünün akış göstermesi gerekiyor mu?
 *
 * Sadece zorunlu grup varsa akış açılır. Su, tatlı gibi modifier'ı olmayan ya da
 * hepsi opsiyonel olan ürünler tek dokunuşta sepete iner — sabah kuyruğunda
 * gereksiz adım saniye kaybettirir.
 */
export function requiresFlow(steps: ModifierStep[]): boolean {
  return steps.some((step) => step.group.is_required);
}

/**
 * Varsayılanları uygulayarak başlangıç seçimini üretir.
 *
 * is_default işaretli seçenekler seçili gelir. Zorunlu bir grupta hiç varsayılan
 * işaretlenmemişse ilk seçenek seçilir — kasiyerin zorunlu adımda takılmaması
 * için. Opsiyonel grupta varsayılan yoksa grup boş kalır.
 */
export function initialSelection(steps: ModifierStep[]): ModifierSelection {
  const selection: ModifierSelection = {};

  for (const step of steps) {
    const defaults = step.options.filter((option) => option.is_default);
    if (defaults.length > 0) {
      selection[step.group.id] = defaults.slice(0, Math.max(1, step.group.max_select));
      continue;
    }
    if (step.group.is_required && step.options.length > 0) {
      selection[step.group.id] = [step.options[0]];
    }
  }

  return selection;
}

/**
 * Bir seçeneği açar/kapatır ve grup limitlerini uygular.
 *
 * Tekli grupta (max_select === 1) seçim yer değiştirir.
 * Çoklu grupta limit dolmuşsa yeni seçim yok sayılır — hata mesajı çıkarmak
 * yerine kalan kartları soluklaştırmak doğru davranış (karar: hata değil, sınır).
 * Zorunlu grupta min_select altına düşecek kaldırma yok sayılır.
 */
export function toggleOption(
  selection: ModifierSelection,
  step: ModifierStep,
  option: ProductModifierOption,
): ModifierSelection {
  const groupId = step.group.id;
  const current = selection[groupId] ?? [];
  const isSelected = current.some((item) => item.id === option.id);

  if (!step.isMultiSelect) {
    // Tekli seçim: zaten seçiliyse ve grup zorunlu değilse kaldır, değilse değiştir.
    if (isSelected) {
      if (step.group.is_required || step.group.min_select > 0) {
        return selection;
      }
      const { [groupId]: _removed, ...rest } = selection;
      return rest;
    }
    return { ...selection, [groupId]: [option] };
  }

  if (isSelected) {
    const next = current.filter((item) => item.id !== option.id);
    if (next.length < step.group.min_select) {
      return selection;
    }
    if (next.length === 0) {
      const { [groupId]: _removed, ...rest } = selection;
      return rest;
    }
    return { ...selection, [groupId]: next };
  }

  if (current.length >= step.group.max_select) {
    return selection;
  }
  return { ...selection, [groupId]: [...current, option] };
}

/** Grupta daha fazla seçim yapılabilir mi (çoklu grupta limit kontrolü). */
export function canSelectMore(selection: ModifierSelection, step: ModifierStep): boolean {
  const count = (selection[step.group.id] ?? []).length;
  return count < step.group.max_select;
}

export function isOptionSelected(
  selection: ModifierSelection,
  groupId: string,
  optionId: string,
): boolean {
  return (selection[groupId] ?? []).some((option) => option.id === optionId);
}

/**
 * Seçim sepete eklenebilir mi?
 *
 * Zorunlu grup, min_select kadar seçim istiyor. min_select 0 verilmişse ama grup
 * zorunlu işaretlenmişse en az 1 beklenir — veri girişindeki bu tutarsızlık
 * pratikte oluyor ve kullanıcıyı kilitlememeli.
 */
export function validate(steps: ModifierStep[], selection: ModifierSelection): ModifierValidation {
  const missingGroupIds: string[] = [];

  for (const step of steps) {
    if (!step.group.is_required) continue;
    const required = Math.max(1, step.group.min_select);
    const chosen = (selection[step.group.id] ?? []).length;
    if (chosen < required) {
      missingGroupIds.push(step.group.id);
    }
  }

  return { isValid: missingGroupIds.length === 0, missingGroupIds };
}

/**
 * Birim fiyat = taban fiyat + seçili tüm seçeneklerin price_delta toplamı.
 *
 * Fiyat ARTIK etiket metninden ayrıştırılmıyor. Eski kasa ekranı
 * `mods.milk.includes("+15")` ile fiyatı görünen yazıdan çıkarıyordu; etiket
 * değişince fiyat sessizce bozuluyordu.
 */
export function unitPrice(basePrice: number, selection: ModifierSelection): number {
  let total = Number(basePrice) || 0;
  for (const options of Object.values(selection)) {
    for (const option of options) {
      total += Number(option.price_delta) || 0;
    }
  }
  // Kuruş yuvarlaması: float toplamı 84.99999999 üretebiliyor.
  return Math.round(total * 100) / 100;
}

/** Sadece modifier'lardan gelen fark. Kartta "+15,00 ₺" göstermek için. */
export function modifierDelta(selection: ModifierSelection): number {
  return unitPrice(0, selection);
}

/**
 * Sepette aynı ürünün farklı modifier'lı satırlarını ayırmak için kararlı imza.
 * Seçim sırası imzayı değiştirmemeli, bu yüzden iki kademe sıralama var.
 */
export function selectionSignature(selection: ModifierSelection): string {
  return Object.entries(selection)
    .filter(([, options]) => options.length > 0)
    .map(([groupId, options]) => `${groupId}:${options.map((o) => o.id).sort().join("+")}`)
    .sort()
    .join("|");
}

/**
 * Sepet satırının altına yazılacak insan okunur özet.
 * Örn: "Boy: Large · Süt: Yulaf · Ekstra: Shot, Vanilya"
 * Seçim yoksa boş dize döner — "—" gibi bir doldurma metnini ekran karar verir.
 */
export function describeSelection(steps: ModifierStep[], selection: ModifierSelection): string {
  return steps
    .map((step) => {
      const chosen = selection[step.group.id] ?? [];
      if (chosen.length === 0) return null;
      return `${step.group.name}: ${chosen.map((option) => option.name).join(", ")}`;
    })
    .filter((part): part is string => part !== null)
    .join(" · ");
}

/**
 * Sipariş kaydına yazılacak düz satırlar (order_item_modifiers tablosu şekli).
 * Fiyat farkı burada da taşınır: satış anındaki fiyat sonradan menü değişse bile
 * sabit kalmalı.
 */
export function toOrderItemModifiers(
  steps: ModifierStep[],
  selection: ModifierSelection,
): Array<{ modifier_group_name: string; modifier_option_name: string; price_delta: number }> {
  const rows: Array<{ modifier_group_name: string; modifier_option_name: string; price_delta: number }> = [];
  for (const step of steps) {
    for (const option of selection[step.group.id] ?? []) {
      rows.push({
        modifier_group_name: step.group.name,
        modifier_option_name: option.name,
        price_delta: Number(option.price_delta) || 0,
      });
    }
  }
  return rows;
}

/**
 * Adım akışında bir sonraki adımın indeksi. Zorunlu adım eksikse oraya döner,
 * yoksa sıradaki adıma geçer. Son adımdaysa -1 döner (akış bitti).
 */
export function nextStepIndex(
  steps: ModifierStep[],
  selection: ModifierSelection,
  currentIndex: number,
): number {
  const { missingGroupIds } = validate(steps, selection);
  if (missingGroupIds.length > 0) {
    const blockingIndex = steps.findIndex((step) => step.group.id === missingGroupIds[0]);
    if (blockingIndex !== -1 && blockingIndex !== currentIndex) {
      return blockingIndex;
    }
  }
  return currentIndex + 1 < steps.length ? currentIndex + 1 : -1;
}
