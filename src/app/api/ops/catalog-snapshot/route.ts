import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getMenu } from "@/lib/domains/orders";
import { getRequestAppContext } from "@/lib/server/app-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Kasanin cevrimdisi calisabilmesi icin gereken her seyin tek anlik goruntusu.
 *
 * Neden tek uc nokta: varlik basina ayri onbellek kurmak (menu ayri, recete
 * ayri, modifier ayri) tutarsiz durum uretir — menu yeni, recete eski kalir ve
 * satista yanlis malzeme duser. Tek istek, tek surum, tek tazeleme noktasi.
 *
 * Neden recete de burada: cevrimdisi satista tuketim ISTEMCIDE cozulmeli.
 * Sunucuda cozulurse siparis saatler sonra senkron oldugunda o anki receteyle
 * dusum yapilir; oysa karar "tuketimi satis aninda dondur" idi
 * (PLAN-RECETE-MALIYET-STOK.md).
 */

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole(["owner", "admin", "cashier", "waiter", "kitchen"], "/admin/orders");

  const context = await getRequestAppContext();
  const businessSlug = context.activeSlug;

  const menu = await getMenu(businessSlug);

  // Recete ve malzeme maliyetleri: tuketim cozumu icin sart.
  let recipes: Array<{ productId: string; ingredientId: string; quantity: number; yieldFactor: number }> = [];
  let ingredients: Array<{ id: string; name: string; unit: string; cost: number }> = [];
  let modifierEffects: Array<{
    optionId: string;
    mode: string;
    ingredientId: string | null;
    targetIngredientId: string | null;
    quantity: number | null;
    multiplier: number | null;
  }> = [];
  let recipeSchemaReady = true;

  const supabase = getSupabaseServerClient();
  if (supabase && context.businessId) {
    const { data: ingredientRows, error: ingredientError } = await supabase
      .from("ingredients")
      .select("id, name, unit, cost")
      .eq("business_id", context.businessId);

    if (ingredientError) {
      recipeSchemaReady = false;
    } else {
      ingredients = (ingredientRows ?? []).map((row: { id: string; name: string; unit: string | null; cost: number | null }) => ({
        id: row.id,
        name: row.name,
        unit: row.unit ?? "adet",
        cost: Number(row.cost ?? 0),
      }));

      const productIds = menu.products.map((product) => product.id);
      if (productIds.length > 0) {
        const { data: recipeRows } = await supabase
          .from("product_ingredients")
          .select("product_id, ingredient_id, quantity, yield_factor")
          .in("product_id", productIds);

        recipes = (recipeRows ?? []).map((row: {
          product_id: string;
          ingredient_id: string;
          quantity: number | null;
          yield_factor: number | null;
        }) => ({
          productId: row.product_id,
          ingredientId: row.ingredient_id,
          quantity: Number(row.quantity ?? 0),
          yieldFactor: Number(row.yield_factor ?? 1),
        }));
      }

      const optionIds = menu.modifierOptions.map((option) => option.id);
      if (optionIds.length > 0) {
        const { data: effectRows, error: effectError } = await supabase
          .from("modifier_option_ingredients")
          .select("option_id, mode, ingredient_id, target_ingredient_id, quantity, multiplier")
          .in("option_id", optionIds);

        if (effectError) {
          // Modifier recete tablosu henuz uygulanmamis olabilir; menu yine
          // calisir, yalnizca modifier'larin stok etkisi hesaplanmaz.
          recipeSchemaReady = false;
        } else {
          modifierEffects = (effectRows ?? []).map((row: {
            option_id: string;
            mode: string;
            ingredient_id: string | null;
            target_ingredient_id: string | null;
            quantity: number | null;
            multiplier: number | null;
          }) => ({
            optionId: row.option_id,
            mode: row.mode,
            ingredientId: row.ingredient_id,
            targetIngredientId: row.target_ingredient_id,
            quantity: row.quantity == null ? null : Number(row.quantity),
            multiplier: row.multiplier == null ? null : Number(row.multiplier),
          }));
        }
      }
    }
  }

  const activeBranch = context.branches.find((branch) => branch.id === context.activeBranchId);

  return NextResponse.json({
    // Surum damgasi: istemci "elimdeki kac dakikalik" diyebilsin.
    syncedAt: new Date().toISOString(),
    business: {
      slug: businessSlug,
      name: context.activeBusiness?.name ?? businessSlug,
      branchId: context.activeBranchId ?? null,
      branchName: activeBranch?.name ?? null,
    },
    menu: {
      categories: menu.categories,
      products: menu.products,
      modifierGroups: menu.modifierGroups,
      modifierOptions: menu.modifierOptions,
      usingDemoData: menu.usingDemoData,
    },
    recipes,
    ingredients,
    modifierEffects,
    recipeSchemaReady,
  });
}
