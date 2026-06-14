import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loginUrl = process.env.GOPOS_LOGIN_URL ?? "https://pos.gopos.tr/";
const productsUrl = process.env.GOPOS_PRODUCTS_URL ?? "https://pos.gopos.tr/category-product-management";
const outProductsPath = path.join(__dirname, "gopos_products.json");
const outSummaryPath = path.join(__dirname, "..", "gopos-extracted-data.json");

function parseBoolean(input, fallback = false) {
  if (input == null) return fallback;
  const normalized = String(input).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickString(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickPrice(source) {
  const keys = ["price", "unit_price", "sale_price", "selling_price", "amount", "value"];
  for (const key of keys) {
    const parsed = parsePrice(source?.[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function normalizeProduct(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;

  const name = pickString(node, ["name", "product_name", "productName", "title"]);
  const category = pickString(node, ["category", "category_name", "categoryName", "group_name", "groupName"]) ?? "Diğer";
  const price = pickPrice(node);

  if (!name || price == null) return null;
  if (price < 0 || price > 1_000_000) return null;

  return {
    name,
    category,
    price: price.toFixed(2),
  };
}

function collectProductsFromUnknownJson(root) {
  const products = [];
  const seenObjects = new WeakSet();
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (seenObjects.has(current)) continue;
    seenObjects.add(current);

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }

    const normalized = normalizeProduct(current);
    if (normalized) products.push(normalized);

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }

  return products;
}

function dedupeProducts(products) {
  const map = new Map();
  for (const product of products) {
    const key = `${product.name}|${product.category}|${product.price}`;
    if (!map.has(key)) map.set(key, product);
  }
  return [...map.values()].sort((left, right) => {
    const byCategory = left.category.localeCompare(right.category, "tr");
    if (byCategory !== 0) return byCategory;
    return left.name.localeCompare(right.name, "tr");
  });
}

async function tryCredentialLogin(page, email, password) {
  const emailSelector = 'input[type="email"], input[name="email"], input[autocomplete="username"]';
  const passwordSelector = 'input[type="password"], input[name="password"], input[autocomplete="current-password"]';
  const submitSelector = 'button[type="submit"], button:has-text("Giris"), button:has-text("Giriş Yap"), button:has-text("Login")';

  await page.waitForSelector(emailSelector, { timeout: 20_000 });
  await page.fill(emailSelector, email);
  await page.fill(passwordSelector, password);
  await page.click(submitSelector);
  await page.waitForTimeout(5_000);
}

async function waitForManualLogin(page) {
  console.log("No credentials provided. Please login manually in the opened browser window.");
  console.log("Waiting up to 3 minutes for successful login...");
  await page.waitForURL((url) => !url.pathname.toLowerCase().includes("login"), { timeout: 180_000 });
}

async function run() {
  const headless = parseBoolean(process.env.PW_HEADLESS, false);
  const email = process.env.GOPOS_EMAIL ?? "";
  const password = process.env.GOPOS_PASSWORD ?? "";

  if (!email && !password && headless) {
    throw new Error("Manual login requires a visible browser. Set PW_HEADLESS=false or provide GOPOS_EMAIL/GOPOS_PASSWORD.");
  }

  console.log("Starting authorized GoPOS extraction...");
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allFoundProducts = [];
  const responseMatches = [];

  page.on("response", async (response) => {
    const url = response.url();
    const contentType = response.headers()["content-type"] ?? "";
    if (!contentType.includes("application/json")) return;
    if (!url.includes("/api/") && !url.includes("/v1/") && !url.includes("pos")) return;

    try {
      const payload = await response.json();
      const products = collectProductsFromUnknownJson(payload);
      if (products.length === 0) return;

      allFoundProducts.push(...products);
      responseMatches.push({
        url,
        status: response.status(),
        found: products.length,
      });
      console.log(`Matched ${products.length} product-like rows from: ${url}`);
    } catch {
      // Ignore non-JSON or unreadable payloads.
    }
  });

  console.log(`Navigating to login page: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  if (email && password) {
    console.log("Logging in with provided credentials...");
    await tryCredentialLogin(page, email, password);
  } else {
    await waitForManualLogin(page);
  }

  console.log(`Navigating to products page: ${productsUrl}`);
  await page.goto(productsUrl, { waitUntil: "domcontentloaded" });

  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(4_000);

  const products = dedupeProducts(allFoundProducts);
  await fs.writeFile(outProductsPath, `${JSON.stringify(products, null, 2)}\n`, "utf-8");

  const summary = {
    scraped_at: new Date().toISOString(),
    login_url: loginUrl,
    products_url: productsUrl,
    total_unique_products: products.length,
    unique_categories: [...new Set(products.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "tr")),
    response_matches: responseMatches.slice(0, 50),
    preview: products.slice(0, 10),
  };

  await fs.writeFile(outSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

  console.log(`Saved ${products.length} products to ${outProductsPath}`);
  console.log(`Saved extraction summary to ${outSummaryPath}`);

  if (products.length === 0) {
    console.log("No product rows were extracted. Verify product list requests are JSON in network.");
  }

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
