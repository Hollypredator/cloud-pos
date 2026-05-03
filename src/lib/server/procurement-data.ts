import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Supplier, Purchase, PurchaseItem, GeneralExpense } from "@/lib/types";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { revalidatePath } from "next/cache";

async function getActiveBusinessId() {
  const { businessId } = await getBusinessScopeContext();
  if (!businessId) throw new Error("No active business context found");
  return businessId;
}

function getServer() {
  const client = getSupabaseServerClient();
  if (!client) throw new Error("Supabase client not initialized");
  return client;
}

// --- Suppliers ---

export async function listSuppliers() {
  const supabase = getServer();
  const businessId = await getActiveBusinessId();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Supplier[];
}

export async function createSupplier(input: Partial<Supplier>) {
  const supabase = getServer();
  const businessId = await getActiveBusinessId();
  const { data, error } = await supabase
    .from("suppliers")
    .insert([{ ...input, business_id: businessId }])
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/admin/accounting");
  return data as Supplier;
}

export async function updateSupplier(id: string, input: Partial<Supplier>) {
  const supabase = getServer();
  const { data, error } = await supabase
    .from("suppliers")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/admin/accounting");
  return data as Supplier;
}

// --- Purchases ---

export async function listPurchases() {
  const supabase = getServer();
  const businessId = await getActiveBusinessId();
  const { data, error } = await supabase
    .from("purchases")
    .select("*, suppliers(name)")
    .eq("business_id", businessId)
    .order("purchase_date", { ascending: false });
  if (error) throw error;
  return data as (Purchase & { suppliers: { name: string } | null })[];
}

export async function getPurchaseDetails(id: string) {
  const supabase = getServer();
  const { data: purchase, error: pError } = await supabase
    .from("purchases")
    .select("*, suppliers(name)")
    .eq("id", id)
    .single();
  if (pError) throw pError;

  const { data: items, error: iError } = await supabase
    .from("purchase_items")
    .select("*, ingredients(name, unit), products(name)")
    .eq("purchase_id", id);
  if (iError) throw iError;

  return { 
    purchase: purchase as (Purchase & { suppliers: { name: string } | null }), 
    items: items as (PurchaseItem & { ingredients: { name: string, unit: string } | null, products: { name: string } | null })[] 
  };
}

export async function createPurchase(input: Partial<Purchase>) {
  const supabase = getServer();
  const businessId = await getActiveBusinessId();
  const { data, error } = await supabase
    .from("purchases")
    .insert([{ ...input, business_id: businessId }])
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/admin/accounting");
  return data as Purchase;
}

/**
 * Finalizes a purchase: 
 * 1. Mark as completed/paid
 * 2. Update ingredient/product costs to the LATEST purchase price (per user 1-B choice)
 * 3. Future: Update stock counts
 */
export async function finalizePurchase(id: string) {
  const supabase = getServer();
  const { purchase, items } = await getPurchaseDetails(id);
  
  if (purchase.payment_status === "completed" || purchase.payment_status === "paid") {
    return purchase;
  }

  // Update product/ingredient costs based on this purchase
  for (const item of items) {
    if (item.ingredient_id) {
      await supabase
        .from("ingredients")
        .update({ cost: item.unit_price })
        .eq("id", item.ingredient_id);
    } else if (item.product_id) {
       await supabase
        .from("products")
        .update({ cost: item.unit_price })
        .eq("id", item.product_id);
    }
  }

  const { data, error } = await supabase
    .from("purchases")
    .update({ payment_status: "completed" })
    .eq("id", id)
    .select()
    .single();
    
  if (error) throw error;
  revalidatePath("/admin/accounting");
  revalidatePath("/admin/products");
  return data as Purchase;
}

export async function addPurchaseItem(input: Partial<PurchaseItem>) {
  const supabase = getServer();
  const { data, error } = await supabase
    .from("purchase_items")
    .insert([input])
    .select()
    .single();
  if (error) throw error;
  
  // Update purchase total amount
  const { data: items } = await supabase.from("purchase_items").select("total").eq("purchase_id", input.purchase_id!);
  const newTotal = (items ?? []).reduce((sum, i) => sum + Number(i.total), 0);
  await supabase.from("purchases").update({ total_amount: newTotal }).eq("id", input.purchase_id!);

  revalidatePath("/admin/accounting");
  return data as PurchaseItem;
}

// --- Expenses ---

export async function listExpenses() {
  const supabase = getServer();
  const businessId = await getActiveBusinessId();
  const { data, error } = await supabase
    .from("general_expenses")
    .select("*")
    .eq("business_id", businessId)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return data as GeneralExpense[];
}

export async function createExpense(input: Partial<GeneralExpense>) {
  const supabase = getServer();
  const businessId = await getActiveBusinessId();
  const { data, error } = await supabase
    .from("general_expenses")
    .insert([{ ...input, business_id: businessId }])
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/admin/accounting");
  revalidatePath("/admin/finance");
  return data as GeneralExpense;
}

// --- Helpers for UI selectors ---

export async function listIngredients() {
  const supabase = getServer();
  const businessId = await getActiveBusinessId();
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, unit, cost")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data as { id: string, name: string, unit: string, cost: number | null }[];
}

export async function listProducts() {
  const supabase = getServer();
  const businessId = await getActiveBusinessId();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, cost")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data as { id: string, name: string, cost: number | null }[];
}
