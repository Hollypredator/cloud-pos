/**
 * Reçeteli Hammadde & Stok Yönetim Motoru (BOM - Bill of Materials)
 * 1 Ürün satıldığında bağlı tüm hammaddelerden otomatik stok düşümü yapar.
 */

export type IngredientUnit = "g" | "ml" | "pcs" | "kg" | "l";

export type Ingredient = {
  id: string;
  name: string;
  unit: IngredientUnit;
  currentStock: number;
  minAlertStock: number;
  unitCost: number; // TL cinsinden birim maliyet
  updatedAt: string;
};

export type RecipeItem = {
  ingredientId: string;
  quantityNeeded: number; // Örneğin Latte için 18g kahve veya 180ml süt
};

export type ProductRecipe = {
  productId: string;
  productName: string;
  ingredients: RecipeItem[];
};

export type StockMovement = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: "sale_deduction" | "manual_addition" | "waste_fire" | "inventory_correction";
  quantityChanged: number;
  reason?: string;
  timestamp: string;
};

// Demo/Default Stok Verileri
export const defaultIngredients: Ingredient[] = [
  { id: "ing_espresso_beans", name: "Espresso Kahve Çekirdeği", unit: "g", currentStock: 5000, minAlertStock: 1000, unitCost: 0.45, updatedAt: new Date().toISOString() },
  { id: "ing_milk_whole", name: "Tam Yağlı Süt", unit: "ml", currentStock: 20000, minAlertStock: 3000, unitCost: 0.03, updatedAt: new Date().toISOString() },
  { id: "ing_milk_oat", name: "Yulaf Sütü", unit: "ml", currentStock: 5000, minAlertStock: 1000, unitCost: 0.07, updatedAt: new Date().toISOString() },
  { id: "ing_paper_cup_medium", name: "Medium Karton Bardak", unit: "pcs", currentStock: 450, minAlertStock: 100, unitCost: 1.5, updatedAt: new Date().toISOString() },
  { id: "ing_syrup_vanilla", name: "Vanilya Şurubu", unit: "ml", currentStock: 2000, minAlertStock: 400, unitCost: 0.12, updatedAt: new Date().toISOString() },
  { id: "ing_tea_leaves", name: "Dökme Çay", unit: "g", currentStock: 3000, minAlertStock: 500, unitCost: 0.2, updatedAt: new Date().toISOString() },
];

export const defaultRecipes: ProductRecipe[] = [
  {
    productId: "prod_espresso",
    productName: "Espresso Single",
    ingredients: [{ ingredientId: "ing_espresso_beans", quantityNeeded: 9 }],
  },
  {
    productId: "prod_latte",
    productName: "Caffe Latte Medium",
    ingredients: [
      { ingredientId: "ing_espresso_beans", quantityNeeded: 18 },
      { ingredientId: "ing_milk_whole", quantityNeeded: 180 },
      { ingredientId: "ing_paper_cup_medium", quantityNeeded: 1 },
    ],
  },
  {
    productId: "prod_turkish_tea",
    productName: "Demleme Türk Çayı",
    ingredients: [{ ingredientId: "ing_tea_leaves", quantityNeeded: 5 }],
  },
];

/**
 * Satış yapıldığında siparişteki ürünlerin reçetelerine göre hammaddelerden stok düşer.
 */
export function deductStockForSale(
  soldItems: Array<{ productId: string; qty: number }>,
  currentStockList: Ingredient[],
  recipes: ProductRecipe[] = defaultRecipes
): { updatedStockList: Ingredient[]; movements: StockMovement[]; alertItems: Ingredient[] } {
  const stockMap = new Map<string, Ingredient>(currentStockList.map((i) => [i.id, { ...i }]));
  const movements: StockMovement[] = [];
  const alertItems: Ingredient[] = [];

  soldItems.forEach((item) => {
    const recipe = recipes.find((r) => r.productId === item.productId);
    if (!recipe) return;

    recipe.ingredients.forEach((recItem) => {
      const ing = stockMap.get(recItem.ingredientId);
      if (!ing) return;

      const totalDeduction = recItem.quantityNeeded * item.qty;
      ing.currentStock = Math.max(0, ing.currentStock - totalDeduction);
      ing.updatedAt = new Date().toISOString();

      movements.push({
        id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ingredientId: ing.id,
        ingredientName: ing.name,
        type: "sale_deduction",
        quantityChanged: -totalDeduction,
        reason: `Satış: ${item.qty}x ${recipe.productName}`,
        timestamp: new Date().toISOString(),
      });

      if (ing.currentStock <= ing.minAlertStock) {
        alertItems.push(ing);
      }
    });
  });

  return {
    updatedStockList: Array.from(stockMap.values()),
    movements,
    alertItems,
  };
}
