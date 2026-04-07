import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "raw_products.txt"), "utf-8");
const lines = raw.split("\n").filter(l => l.trim() && l.includes("|"));
const products = lines.map(l => {
  const [name, category, price] = l.split("|");
  return { name: name.trim(), category: category.trim(), price: price.trim() };
});
writeFileSync(join(__dirname, "gopos_products.json"), JSON.stringify(products, null, 2));
console.log(`Converted ${products.length} products to gopos_products.json`);
