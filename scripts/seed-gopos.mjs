import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL (veya SUPABASE_URL) ve SUPABASE_SERVICE_ROLE_KEY zorunludur.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Read products data
const raw = readFileSync(join(__dirname, "gopos_products.json"), "utf-8");
const products = JSON.parse(raw);

async function main() {
  // 1. Find business_id
  const { data: biz } = await supabase.from("businesses").select("id").limit(1).single();
  const businessId = biz?.id;
  console.log("Business ID:", businessId);

  // 2. Delete existing products and categories for this business
  if (businessId) {
    console.log("Deleting existing products...");
    await supabase.from("products").delete().eq("business_id", businessId);
    console.log("Deleting existing categories...");
    await supabase.from("categories").delete().eq("business_id", businessId);
  } else {
    // Legacy schema - delete all
    console.log("Deleting all products (legacy)...");
    await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    console.log("Deleting all categories (legacy)...");
    await supabase.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  // 3. Extract unique categories
  const categoryNames = [...new Set(products.map(p => p.category))];
  console.log(`Creating ${categoryNames.length} categories:`, categoryNames);

  const catRows = categoryNames.map((name, i) => ({
    name,
    sort_order: i,
    ...(businessId ? { business_id: businessId } : {}),
  }));

  const { data: insertedCats, error: catErr } = await supabase
    .from("categories")
    .insert(catRows)
    .select("id, name");

  if (catErr) {
    console.error("Category insert error:", catErr);
    return;
  }
  console.log(`Inserted ${insertedCats.length} categories`);

  // 4. Map category name -> id
  const catMap = {};
  for (const c of insertedCats) catMap[c.name] = c.id;

  // 5. Insert products in batches of 100
  const prodRows = products.map(p => ({
    name: p.name,
    price: parseFloat(p.price),
    category_id: catMap[p.category],
    is_available: true,
    stock_count: 999,
    ...(businessId ? { business_id: businessId } : {}),
  }));

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < prodRows.length; i += BATCH) {
    const batch = prodRows.slice(i, i + BATCH);
    const { error } = await supabase.from("products").insert(batch);
    if (error) {
      console.error(`Batch ${i}-${i + BATCH} error:`, error);
    } else {
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${prodRows.length} products`);
    }
  }

  console.log("Done! Total products inserted:", inserted);
}

main().catch(console.error);
