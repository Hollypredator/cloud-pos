import { describe, it, expect } from "vitest";
import type { ProductModifierGroup, ProductModifierOption } from "@/lib/types";
import {
  buildSteps,
  requiresFlow,
  initialSelection,
  toggleOption,
  canSelectMore,
  isOptionSelected,
  validate,
  unitPrice,
  modifierDelta,
  selectionSignature,
  describeSelection,
  toOrderItemModifiers,
  nextStepIndex,
} from "./engine";

/*
 * Test senaryosu firmanın anlattığı akış:
 *   Iced Americano → Boy (zorunlu, tekli) → Süt (opsiyonel, tekli)
 *                  → Ekstralar (opsiyonel, en fazla 3)
 */

const group = (over: Partial<ProductModifierGroup> & { id: string }): ProductModifierGroup => ({
  product_id: "p1",
  name: "Grup",
  min_select: 0,
  max_select: 1,
  is_required: false,
  sort_order: 0,
  ...over,
});

const option = (
  over: Partial<ProductModifierOption> & { id: string; group_id: string },
): ProductModifierOption => ({
  name: "Seçenek",
  price_delta: 0,
  is_default: false,
  sort_order: 0,
  ...over,
});

const boy = group({ id: "g-boy", name: "Boy", is_required: true, min_select: 1, max_select: 1, sort_order: 1 });
const sut = group({ id: "g-sut", name: "Süt", sort_order: 2 });
const ekstra = group({ id: "g-ekstra", name: "Ekstralar", max_select: 3, sort_order: 3 });

const opts: ProductModifierOption[] = [
  option({ id: "o-single", group_id: "g-boy", name: "Single", price_delta: -10, sort_order: 1 }),
  option({ id: "o-medium", group_id: "g-boy", name: "Medium", price_delta: 0, is_default: true, sort_order: 2 }),
  option({ id: "o-large", group_id: "g-boy", name: "Large", price_delta: 15, sort_order: 3 }),
  option({ id: "o-tam", group_id: "g-sut", name: "Tam yağlı", price_delta: 0, is_default: true, sort_order: 1 }),
  option({ id: "o-yulaf", group_id: "g-sut", name: "Yulaf", price_delta: 15, sort_order: 2 }),
  option({ id: "o-shot", group_id: "g-ekstra", name: "Ekstra shot", price_delta: 20, sort_order: 1 }),
  option({ id: "o-vanilya", group_id: "g-ekstra", name: "Vanilya", price_delta: 10, sort_order: 2 }),
  option({ id: "o-karamel", group_id: "g-ekstra", name: "Karamel", price_delta: 10, sort_order: 3 }),
  option({ id: "o-tarcin", group_id: "g-ekstra", name: "Tarçın", price_delta: 0, sort_order: 4 }),
];

const steps = buildSteps([ekstra, boy, sut], opts); // kasten karışık sırada verildi
const stepOf = (id: string) => steps.find((s) => s.group.id === id)!;

describe("buildSteps", () => {
  it("adımları sort_order'a göre sıralar, giriş sırasını dikkate almaz", () => {
    expect(steps.map((s) => s.group.id)).toEqual(["g-boy", "g-sut", "g-ekstra"]);
  });

  it("seçenekleri kendi içinde sıralar", () => {
    expect(stepOf("g-boy").options.map((o) => o.name)).toEqual(["Single", "Medium", "Large"]);
  });

  it("max_select > 1 olan grubu çoklu seçim olarak işaretler", () => {
    expect(stepOf("g-ekstra").isMultiSelect).toBe(true);
    expect(stepOf("g-boy").isMultiSelect).toBe(false);
  });

  it("seçeneği olmayan grup adım üretmez — boş adımda kullanıcı bekletilmez", () => {
    const bos = group({ id: "g-bos", name: "Boş grup", sort_order: 9 });
    expect(buildSteps([boy, bos], opts).map((s) => s.group.id)).toEqual(["g-boy"]);
  });

  it("hiç grup yoksa boş dizi döner", () => {
    expect(buildSteps([], [])).toEqual([]);
  });
});

describe("requiresFlow", () => {
  it("zorunlu grup varsa akış açılır", () => {
    expect(requiresFlow(steps)).toBe(true);
  });

  it("hepsi opsiyonelse akış açılmaz — tek dokunuşta sepete iner", () => {
    expect(requiresFlow(buildSteps([sut, ekstra], opts))).toBe(false);
  });

  it("modifier'ı olmayan üründe akış açılmaz (su, tatlı)", () => {
    expect(requiresFlow(buildSteps([], []))).toBe(false);
  });
});

describe("initialSelection", () => {
  it("is_default işaretli seçenekleri önseçili getirir", () => {
    const sel = initialSelection(steps);
    expect(sel["g-boy"].map((o) => o.id)).toEqual(["o-medium"]);
    expect(sel["g-sut"].map((o) => o.id)).toEqual(["o-tam"]);
  });

  it("varsayılanı olmayan opsiyonel grubu boş bırakır", () => {
    expect(initialSelection(steps)["g-ekstra"]).toBeUndefined();
  });

  it("zorunlu grupta varsayılan yoksa ilk seçeneği seçer — kasiyer takılmasın", () => {
    const varsayilansiz = buildSteps(
      [group({ id: "g-x", name: "Boy", is_required: true, min_select: 1, sort_order: 1 })],
      [
        option({ id: "o-a", group_id: "g-x", name: "A", sort_order: 1 }),
        option({ id: "o-b", group_id: "g-x", name: "B", sort_order: 2 }),
      ],
    );
    expect(initialSelection(varsayilansiz)["g-x"].map((o) => o.id)).toEqual(["o-a"]);
  });

  it("başlangıç seçimi doğrudan sepete eklenebilir durumda olur", () => {
    expect(validate(steps, initialSelection(steps)).isValid).toBe(true);
  });
});

describe("toggleOption — tekli grup", () => {
  it("seçimi değiştirir, biriktirmez", () => {
    const sel = toggleOption(initialSelection(steps), stepOf("g-boy"), opts[2]); // Large
    expect(sel["g-boy"].map((o) => o.id)).toEqual(["o-large"]);
  });

  it("zorunlu grupta seçili seçeneğe tekrar dokunmak onu kaldırmaz", () => {
    const sel = initialSelection(steps);
    expect(toggleOption(sel, stepOf("g-boy"), opts[1])).toBe(sel);
  });

  it("opsiyonel grupta seçili seçeneğe tekrar dokunmak seçimi kaldırır", () => {
    const sel = toggleOption(initialSelection(steps), stepOf("g-sut"), opts[3]); // Tam yağlı
    expect(sel["g-sut"]).toBeUndefined();
  });
});

describe("toggleOption — çoklu grup", () => {
  it("birden fazla seçeneği biriktirir", () => {
    let sel = initialSelection(steps);
    sel = toggleOption(sel, stepOf("g-ekstra"), opts[5]); // shot
    sel = toggleOption(sel, stepOf("g-ekstra"), opts[6]); // vanilya
    expect(sel["g-ekstra"].map((o) => o.name)).toEqual(["Ekstra shot", "Vanilya"]);
  });

  it("max_select limitine ulaşınca yeni seçimi yok sayar, hata üretmez", () => {
    let sel = initialSelection(steps);
    for (const o of [opts[5], opts[6], opts[7]]) {
      sel = toggleOption(sel, stepOf("g-ekstra"), o);
    }
    expect(sel["g-ekstra"]).toHaveLength(3);

    const dorduncu = toggleOption(sel, stepOf("g-ekstra"), opts[8]); // Tarçın
    expect(dorduncu).toBe(sel);
    expect(canSelectMore(sel, stepOf("g-ekstra"))).toBe(false);
  });

  it("seçiliye tekrar dokunmak kaldırır ve yer açar", () => {
    let sel = initialSelection(steps);
    sel = toggleOption(sel, stepOf("g-ekstra"), opts[5]);
    sel = toggleOption(sel, stepOf("g-ekstra"), opts[5]);
    expect(sel["g-ekstra"]).toBeUndefined();
    expect(canSelectMore(sel, stepOf("g-ekstra"))).toBe(true);
  });

  it("min_select altına düşecek kaldırmayı reddeder", () => {
    const zorunluCoklu = buildSteps(
      [group({ id: "g-sos", name: "Sos", is_required: true, min_select: 2, max_select: 3, sort_order: 1 })],
      [
        option({ id: "s1", group_id: "g-sos", name: "S1", is_default: true, sort_order: 1 }),
        option({ id: "s2", group_id: "g-sos", name: "S2", is_default: true, sort_order: 2 }),
        option({ id: "s3", group_id: "g-sos", name: "S3", sort_order: 3 }),
      ],
    );
    const sel = initialSelection(zorunluCoklu);
    expect(sel["g-sos"]).toHaveLength(2);
    expect(toggleOption(sel, zorunluCoklu[0], sel["g-sos"][0])).toBe(sel);
  });
});

describe("validate", () => {
  it("zorunlu grup seçilmemişse sepete eklemeyi engeller", () => {
    const eksik = { "g-sut": [opts[3]] };
    const sonuc = validate(steps, eksik);
    expect(sonuc.isValid).toBe(false);
    expect(sonuc.missingGroupIds).toEqual(["g-boy"]);
  });

  it("opsiyonel grup boşken geçerli sayar", () => {
    expect(validate(steps, { "g-boy": [opts[1]] }).isValid).toBe(true);
  });

  it("is_required=true ama min_select=0 tutarsızlığında en az 1 bekler", () => {
    const tutarsiz = buildSteps(
      [group({ id: "g-t", name: "T", is_required: true, min_select: 0, sort_order: 1 })],
      [option({ id: "t1", group_id: "g-t", name: "T1", sort_order: 1 })],
    );
    expect(validate(tutarsiz, {}).missingGroupIds).toEqual(["g-t"]);
  });

  it("eksik grupları adım sırasında döner", () => {
    const ikiZorunlu = buildSteps(
      [
        group({ id: "g-2", name: "İkinci", is_required: true, min_select: 1, sort_order: 2 }),
        group({ id: "g-1", name: "Birinci", is_required: true, min_select: 1, sort_order: 1 }),
      ],
      [
        option({ id: "a", group_id: "g-1", name: "A", sort_order: 1 }),
        option({ id: "b", group_id: "g-2", name: "B", sort_order: 1 }),
      ],
    );
    expect(validate(ikiZorunlu, {}).missingGroupIds).toEqual(["g-1", "g-2"]);
  });
});

describe("unitPrice", () => {
  it("taban fiyata seçili farkları ekler", () => {
    // 75 + Large(15) + Yulaf(15) + Shot(20) + Vanilya(10) = 135
    const sel = {
      "g-boy": [opts[2]],
      "g-sut": [opts[4]],
      "g-ekstra": [opts[5], opts[6]],
    };
    expect(unitPrice(75, sel)).toBe(135);
  });

  it("negatif farkı düşer", () => {
    expect(unitPrice(75, { "g-boy": [opts[0]] })).toBe(65); // Single -10
  });

  it("seçim yoksa taban fiyatı döner", () => {
    expect(unitPrice(75, {})).toBe(75);
  });

  it("kuruş yuvarlar — float toplamı sızdırmaz", () => {
    const kurus = buildSteps(
      [group({ id: "g-k", name: "K", sort_order: 1 })],
      [option({ id: "k1", group_id: "g-k", name: "K1", price_delta: 0.2, is_default: true, sort_order: 1 })],
    );
    expect(unitPrice(0.1, initialSelection(kurus))).toBe(0.3);
  });

  it("price_delta metin olarak gelirse sayıya çevirir (Supabase numeric)", () => {
    const metin = { "g-boy": [{ ...opts[2], price_delta: "15" as unknown as number }] };
    expect(unitPrice(75, metin)).toBe(90);
  });

  it("modifierDelta sadece farkı verir", () => {
    expect(modifierDelta({ "g-boy": [opts[2]], "g-ekstra": [opts[5]] })).toBe(35);
  });
});

describe("selectionSignature", () => {
  it("aynı seçim için seçim sırasından bağımsız aynı imzayı üretir", () => {
    const a = { "g-ekstra": [opts[5], opts[6]], "g-boy": [opts[2]] };
    const b = { "g-boy": [opts[2]], "g-ekstra": [opts[6], opts[5]] };
    expect(selectionSignature(a)).toBe(selectionSignature(b));
  });

  it("farklı seçim farklı imza üretir — sepette ayrı satır olur", () => {
    expect(selectionSignature({ "g-boy": [opts[1]] })).not.toBe(selectionSignature({ "g-boy": [opts[2]] }));
  });

  it("boş grupları yok sayar", () => {
    expect(selectionSignature({ "g-boy": [opts[1]], "g-sut": [] })).toBe(
      selectionSignature({ "g-boy": [opts[1]] }),
    );
  });
});

describe("describeSelection", () => {
  it("sepet satırı için okunur özet üretir", () => {
    const sel = { "g-boy": [opts[2]], "g-sut": [opts[4]], "g-ekstra": [opts[5], opts[6]] };
    expect(describeSelection(steps, sel)).toBe("Boy: Large · Süt: Yulaf · Ekstralar: Ekstra shot, Vanilya");
  });

  it("seçim yoksa boş dize döner — doldurma metnini ekran seçer", () => {
    expect(describeSelection(steps, {})).toBe("");
  });
});

describe("toOrderItemModifiers", () => {
  it("sipariş kaydı satırlarını fiyat farkıyla birlikte üretir", () => {
    const sel = { "g-boy": [opts[2]], "g-ekstra": [opts[5]] };
    expect(toOrderItemModifiers(steps, sel)).toEqual([
      { modifier_group_name: "Boy", modifier_option_name: "Large", price_delta: 15 },
      { modifier_group_name: "Ekstralar", modifier_option_name: "Ekstra shot", price_delta: 20 },
    ]);
  });
});

describe("nextStepIndex", () => {
  it("eksik zorunlu adım varsa oraya döner", () => {
    expect(nextStepIndex(steps, {}, 2)).toBe(0);
  });

  it("her şey tamamsa sıradaki adıma geçer", () => {
    expect(nextStepIndex(steps, initialSelection(steps), 0)).toBe(1);
  });

  it("son adımda -1 döner — akış bitti", () => {
    expect(nextStepIndex(steps, initialSelection(steps), 2)).toBe(-1);
  });
});
