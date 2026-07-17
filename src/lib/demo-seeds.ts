import { DEFAULT_BUSINESS_SLUG } from "./business";
import type {
  Product,
  Category,
  DiningTable,
  Order,
  Ingredient,
  ProductIngredient,
  ProductModifierGroup,
  ProductModifierOption,
  Business,
  Branch,
  Courier,
  BusinessType,
} from "./types";

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function helperEnrichCalories(p: Product): Product;
export function helperEnrichCalories(p: Product[]): Product[];
export function helperEnrichCalories(p: Product | Product[]): Product | Product[] {
  if (Array.isArray(p)) {
    return p.map((x) => helperEnrichCalories(x));
  }
  let calories = null;
  const name = p.name.toLowerCase();
  if (name.includes("americano")) calories = 15;
  else if (name.includes("latte")) calories = 135;
  else if (name.includes("cappuccino")) calories = 120;
  else if (name.includes("mocha")) calories = 290;
  else if (name.includes("espresso") || name.includes("doppio") || name.includes("shot")) calories = 5;
  else if (name.includes("filter") || name.includes("filtre")) calories = 10;
  else if (name.includes("turk") || name.includes("türk")) calories = 15;
  else if (name.includes("cold brew")) calories = 5;
  else if (name.includes("croissant") || name.includes("kruvasan")) calories = 310;
  else if (name.includes("cake") || name.includes("cheesecake") || name.includes("san sebastian")) calories = 460;
  else if (name.includes("tiramisu")) calories = 380;
  else if (name.includes("muffin")) calories = 280;
  else if (name.includes("cookie")) calories = 220;
  else if (name.includes("wrap") || name.includes("sandvic") || name.includes("sandwich")) calories = 410;
  else if (name.includes("protein")) calories = 320;
  else if (name.includes("shake") || name.includes("smoothie")) calories = 340;
  else if (name.includes("cola") || name.includes("fanta") || name.includes("sprite")) calories = 140;
  else if (name.includes("soda") || name.includes("water") || name.includes("su")) calories = 0;
  else if (name.includes("syrup") || name.includes("sauce")) calories = 80;
  else if (name.includes("foam")) calories = 45;
  return { ...p, calories };
}

export const demoCategories: Category[] = [
  { id: "demo-cat-1", name: "Kahveler", sort_order: 1, prep_station: "bar" },
  { id: "demo-cat-2", name: "Soguk Icecekler", sort_order: 2, prep_station: "bar" },
  { id: "demo-cat-3", name: "Tatli ve Firin", sort_order: 3, prep_station: "dessert" },
];

export const rawDemoProducts: Product[] = [
  {
    id: "demo-prod-1",
    category_id: "demo-cat-1",
    name: "Latte",
    price: 120,
    stock_count: 999,
    image_url: null,
    description: "Double shot espresso + milk",
    is_available: true,
  },
  {
    id: "demo-prod-2",
    category_id: "demo-cat-1",
    name: "Americano",
    price: 95,
    stock_count: 999,
    image_url: null,
    description: "Yogun ama yumusak icim",
    is_available: true,
  },
  {
    id: "demo-prod-3",
    category_id: "demo-cat-3",
    name: "San Sebastian",
    price: 170,
    stock_count: 4,
    image_url: null,
    description: "Ev yapimi cheesecake",
    is_available: true,
  },
  {
    id: "demo-prod-4",
    category_id: "demo-cat-2",
    name: "Cold Brew",
    price: 135,
    stock_count: 5,
    image_url: null,
    description: "Uzun demleme soguk kahve",
    is_available: true,
  },
  {
    id: "demo-prod-5",
    category_id: "demo-cat-3",
    name: "Butter Croissant",
    price: 90,
    stock_count: 3,
    image_url: null,
    description: "Tereyagli sabah servisi",
    is_available: true,
  },
  {
    id: "demo-prod-6",
    category_id: "demo-cat-1",
    name: "Flat White",
    price: 125,
    stock_count: 14,
    image_url: null,
    description: "Kisa sut dokusu, yogun espresso",
    is_available: true,
  },
];
export const demoProducts: Product[] = rawDemoProducts.map((p) => helperEnrichCalories(p));

export const demoSelfServiceCategories: Category[] = [
  { id: "ss-cat-1", name: "Sicak", sort_order: 1, prep_station: "bar" },
  { id: "ss-cat-2", name: "Soguk", sort_order: 2, prep_station: "bar" },
  { id: "ss-cat-3", name: "Yiyecek", sort_order: 3, prep_station: "dessert" },
  { id: "ss-cat-4", name: "Ekstra", sort_order: 4, prep_station: "bar" },
];

export const rawDemoSelfServiceProducts: Product[] = [
  { id: "ss-prod-1", category_id: "ss-cat-1", name: "Espresso", price: 110, stock_count: 999, image_url: null, description: "Single shot espresso", is_available: true },
  { id: "ss-prod-2", category_id: "ss-cat-1", name: "Doppio", price: 125, stock_count: 999, image_url: null, description: "Double shot espresso", is_available: true },
  { id: "ss-prod-3", category_id: "ss-cat-1", name: "Americano", price: 135, stock_count: 999, image_url: null, description: "Hot water + espresso", is_available: true },
  { id: "ss-prod-4", category_id: "ss-cat-1", name: "Latte", price: 155, stock_count: 999, image_url: null, description: "Espresso, steamed milk", is_available: true },
  { id: "ss-prod-5", category_id: "ss-cat-1", name: "Cappuccino", price: 160, stock_count: 999, image_url: null, description: "Espresso, milk foam", is_available: true },
  { id: "ss-prod-6", category_id: "ss-cat-1", name: "Flat White", price: 165, stock_count: 999, image_url: null, description: "Ristretto based silky milk", is_available: true },
  { id: "ss-prod-7", category_id: "ss-cat-1", name: "Mocha", price: 175, stock_count: 999, image_url: null, description: "Chocolate flavored latte", is_available: true },
  { id: "ss-prod-8", category_id: "ss-cat-1", name: "Caramel Macchiato", price: 185, stock_count: 999, image_url: null, description: "Vanilla, milk, espresso, caramel", is_available: true },
  { id: "ss-prod-9", category_id: "ss-cat-1", name: "White Chocolate Mocha", price: 190, stock_count: 999, image_url: null, description: "White mocha sauce + espresso", is_available: true },
  { id: "ss-prod-10", category_id: "ss-cat-1", name: "Filtre Kahve", price: 120, stock_count: 999, image_url: null, description: "Freshly brewed daily coffee", is_available: true },
  { id: "ss-prod-11", category_id: "ss-cat-1", name: "Turk Kahvesi", price: 130, stock_count: 999, image_url: null, description: "Tradıtional cezve brew", is_available: true },
  { id: "ss-prod-12", category_id: "ss-cat-1", name: "Chai Tea Latte", price: 170, stock_count: 999, image_url: null, description: "Spiced tea latte", is_available: true },

  { id: "ss-prod-13", category_id: "ss-cat-2", name: "Iced Americano", price: 145, stock_count: 999, image_url: null, description: "Espresso over ice", is_available: true },
  { id: "ss-prod-14", category_id: "ss-cat-2", name: "Iced Latte", price: 165, stock_count: 999, image_url: null, description: "Milk + espresso over ice", is_available: true },
  { id: "ss-prod-15", category_id: "ss-cat-2", name: "Iced Mocha", price: 180, stock_count: 999, image_url: null, description: "Iced chocolate mocha", is_available: true },
  { id: "ss-prod-16", category_id: "ss-cat-2", name: "Cold Brew", price: 170, stock_count: 999, image_url: null, description: "Long-steeped cold coffee", is_available: true },
  { id: "ss-prod-17", category_id: "ss-cat-2", name: "Nitro Cold Brew", price: 195, stock_count: 999, image_url: null, description: "Nitrogen infused cold brew", is_available: true },
  { id: "ss-prod-18", category_id: "ss-cat-2", name: "Vanilla Sweet Cream Cold Brew", price: 205, stock_count: 999, image_url: null, description: "Cold brew + vanilla cream", is_available: true },
  { id: "ss-prod-19", category_id: "ss-cat-2", name: "Iced Caramel Macchiato", price: 205, stock_count: 999, image_url: null, description: "Iced caramel espresso drink", is_available: true },
  { id: "ss-prod-20", category_id: "ss-cat-2", name: "Iced White Mocha", price: 210, stock_count: 999, image_url: null, description: "Iced white mocha", is_available: true },
  { id: "ss-prod-21", category_id: "ss-cat-2", name: "Strawberry Acai Refresher", price: 190, stock_count: 999, image_url: null, description: "Fruity refresher", is_available: true },
  { id: "ss-prod-22", category_id: "ss-cat-2", name: "Mango Dragonfruit Refresher", price: 195, stock_count: 999, image_url: null, description: "Tropical refresher", is_available: true },
  { id: "ss-prod-23", category_id: "ss-cat-2", name: "Coffee Frappuccino", price: 210, stock_count: 999, image_url: null, description: "Blended coffee classic", is_available: true },
  { id: "ss-prod-24", category_id: "ss-cat-2", name: "Caramel Frappuccino", price: 220, stock_count: 999, image_url: null, description: "Blended caramel coffee", is_available: true },
  { id: "ss-prod-25", category_id: "ss-cat-2", name: "Mocha Cookie Crumble Frappuccino", price: 235, stock_count: 999, image_url: null, description: "Mocha + cookie crumble", is_available: true },
  { id: "ss-prod-26", category_id: "ss-cat-2", name: "Java Chip Frappuccino", price: 230, stock_count: 999, image_url: null, description: "Chocolate chip blended coffee", is_available: true },
  { id: "ss-prod-27", category_id: "ss-cat-2", name: "White Chocolate Frappuccino", price: 225, stock_count: 999, image_url: null, description: "White chocolate blended drink", is_available: true },
  { id: "ss-prod-28", category_id: "ss-cat-2", name: "Matcha Frappuccino", price: 220, stock_count: 999, image_url: null, description: "Green tea blended drink", is_available: true },

  { id: "ss-prod-29", category_id: "ss-cat-3", name: "Butter Croissant", price: 115, stock_count: 999, image_url: null, description: "All-butter daily bake", is_available: true },
  { id: "ss-prod-30", category_id: "ss-cat-3", name: "Chocolate Croissant", price: 125, stock_count: 999, image_url: null, description: "Cocoa filled croissant", is_available: true },
  { id: "ss-prod-31", category_id: "ss-cat-3", name: "San Sebastian", price: 210, stock_count: 999, image_url: null, description: "Burnt basque cheesecake", is_available: true },
  { id: "ss-prod-32", category_id: "ss-cat-3", name: "Tiramisu", price: 205, stock_count: 999, image_url: null, description: "Espresso layered dessert", is_available: true },
  { id: "ss-prod-33", category_id: "ss-cat-3", name: "Red Velvet Slice", price: 195, stock_count: 999, image_url: null, description: "Cream cheese frosting cake", is_available: true },
  { id: "ss-prod-34", category_id: "ss-cat-3", name: "Bagel Sandwich", price: 185, stock_count: 999, image_url: null, description: "Bagel with smoked turkey", is_available: true },
  { id: "ss-prod-35", category_id: "ss-cat-3", name: "Chicken Caesar Wrap", price: 210, stock_count: 999, image_url: null, description: "Chicken caesar style wrap", is_available: true },
  { id: "ss-prod-36", category_id: "ss-cat-3", name: "Protein Box", price: 225, stock_count: 999, image_url: null, description: "Egg, cheese, fruit set", is_available: true },

  { id: "ss-prod-37", category_id: "ss-cat-4", name: "Extra Espresso Shot", price: 110, stock_count: 999, image_url: null, description: "Add one more espresso shot", is_available: true },
  { id: "ss-prod-38", category_id: "ss-cat-4", name: "Vanilla Syrup Add-on", price: 110, stock_count: 999, image_url: null, description: "Vanilla flavored syrup", is_available: true },
  { id: "ss-prod-39", category_id: "ss-cat-4", name: "Caramel Sauce Add-on", price: 110, stock_count: 999, image_url: null, description: "Sweet caramel topping", is_available: true },
  { id: "ss-prod-40", category_id: "ss-cat-4", name: "Cold Foam Add-on", price: 115, stock_count: 999, image_url: null, description: "Silky cold foam layer", is_available: true },
];
export const demoSelfServiceProducts: Product[] = rawDemoSelfServiceProducts.map((p) => helperEnrichCalories(p));

export function getDemoMenuSeed(businessType?: BusinessType | null) {
  const isSelfService = businessType === "self_service_coffee";
  return {
    categories: isSelfService ? demoSelfServiceCategories : demoCategories,
    products: isSelfService ? demoSelfServiceProducts : demoProducts,
    modifierGroups: isSelfService ? ([] as ProductModifierGroup[]) : demoModifierGroups,
    modifierOptions: isSelfService ? ([] as ProductModifierOption[]) : demoModifierOptions,
  };
}

export const demoTables: DiningTable[] = [
  {
    id: "demo-table-1",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_number: 1,
    name: "Bahce 1",
    status: "occupied",
    qr_code_identifier: "table-1",
  },
  {
    id: "demo-table-2",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_number: 2,
    name: "Bahce 2",
    status: "occupied",
    qr_code_identifier: "table-2",
  },
  {
    id: "demo-table-3",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_number: 3,
    name: "Cam Kenari",
    status: "occupied",
    qr_code_identifier: "table-3",
  },
  {
    id: "demo-table-4",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_number: 4,
    name: "Salon 4",
    status: "empty",
    qr_code_identifier: "table-4",
  },
  {
    id: "demo-table-5",
    business_id: "demo-business-1",
    branch_id: "demo-branch-2",
    table_number: 5,
    name: "VIP 1",
    status: "reserved",
    qr_code_identifier: "table-5",
  },
];

export const demoOrders: Order[] = [
  {
    id: "demo-order-1",
    check_number: "0001",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_id: "demo-table-1",
    table_number: 1,
    channel: "dine_in",
    fulfillment_status: "not_applicable",
    status: "pending",
    total_price: 215,
    discount_amount: 0,
    service_fee: 0,
    final_price: 215,
    created_at: minutesAgo(8),
    items: [
      {
        product_id: "demo-prod-1",
        name: "Latte",
        quantity: 1,
        unit_price: 120,
        line_total: 165,
        modifiers: [
          { group_name: "Boy", option_name: "Buyuk", price_delta: 25, quantity: 1 },
          { group_name: "Ekstra", option_name: "Ekstra shot", price_delta: 20, quantity: 1 },
        ],
      },
      {
        product_id: "demo-prod-2",
        name: "Americano",
        quantity: 1,
        unit_price: 95,
        line_total: 95,
      },
    ],
  },
  {
    id: "demo-order-2",
    check_number: "0002",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_id: null,
    channel: "delivery",
    customer_name: "Ayse Demir",
    customer_phone: "+90 555 111 22 33",
    delivery_address: "Ataturk Mah. Sedir Sok. No:12 Kadıkoy",
    delivery_note: "Zile basmadan arayin",
    courier_id: "demo-courier-1",
    courier_name: "Kurye Mehmet",
    courier_phone: "+90 555 777 88 99",
    fulfillment_status: "awaiting_dispatch",
    status: "preparing",
    total_price: 305,
    discount_amount: 0,
    service_fee: 0,
    final_price: 305,
    created_at: minutesAgo(14),
    items: [
      {
        product_id: "demo-prod-4",
        name: "Cold Brew",
        quantity: 1,
        unit_price: 135,
        line_total: 135,
      },
      {
        product_id: "demo-prod-5",
        name: "Butter Croissant",
        quantity: 1,
        unit_price: 90,
        line_total: 90,
      },
      {
        product_id: "demo-prod-6",
        name: "Flat White",
        quantity: 1,
        unit_price: 80,
        line_total: 80,
      },
    ],
  },
  {
    id: "demo-order-3",
    check_number: "0003",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_id: null,
    channel: "pickup",
    customer_name: "Mert Kaya",
    customer_phone: "+90 555 444 55 66",
    fulfillment_status: "completed",
    status: "served",
    total_price: 420,
    discount_amount: 20,
    service_fee: 0,
    final_price: 400,
    created_at: minutesAgo(21),
    items: [
      {
        product_id: "demo-prod-1",
        name: "Latte",
        quantity: 2,
        unit_price: 120,
        line_total: 240,
      },
      {
        product_id: "demo-prod-3",
        name: "San Sebastian",
        quantity: 1,
        unit_price: 170,
        line_total: 170,
      },
    ],
  },
  {
    id: "demo-order-4",
    check_number: "0004",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_id: "demo-table-4",
    table_number: 4,
    channel: "dine_in",
    fulfillment_status: "not_applicable",
    status: "paid",
    total_price: 260,
    discount_amount: 0,
    service_fee: 15,
    final_price: 275,
    created_at: minutesAgo(46),
    items: [
      {
        product_id: "demo-prod-2",
        name: "Americano",
        quantity: 1,
        unit_price: 95,
        line_total: 95,
      },
      {
        product_id: "demo-prod-5",
        name: "Butter Croissant",
        quantity: 1,
        unit_price: 90,
        line_total: 90,
      },
      {
        product_id: "demo-prod-4",
        name: "Cold Brew",
        quantity: 1,
        unit_price: 75,
        line_total: 75,
      },
    ],
  },
];

export const demoIngredients: Ingredient[] = [
  { id: "demo-ing-1", name: "Espresso", unit: "shot", cost: 6.5 },
  { id: "demo-ing-2", name: "Sut", unit: "ml", cost: 0.08 },
  { id: "demo-ing-3", name: "Cheeseçake Base", unit: "gram", cost: 0.22 },
  { id: "demo-ing-4", name: "Cold Brew Concentrate", unit: "ml", cost: 0.12 },
  { id: "demo-ing-5", name: "Butter Dough", unit: "gram", cost: 0.18 },
];

export const demoProductIngredients: ProductIngredient[] = [
  { product_id: "demo-prod-1", ingredient_id: "demo-ing-1", quantity: 2 },
  { product_id: "demo-prod-1", ingredient_id: "demo-ing-2", quantity: 180 },
  { product_id: "demo-prod-3", ingredient_id: "demo-ing-3", quantity: 150 },
  { product_id: "demo-prod-4", ingredient_id: "demo-ing-4", quantity: 250 },
  { product_id: "demo-prod-5", ingredient_id: "demo-ing-5", quantity: 120 },
];

export const demoModifierGroups: ProductModifierGroup[] = [
  {
    id: "demo-mod-group-1",
    product_id: "demo-prod-1",
    name: "Boy",
    min_select: 1,
    max_select: 1,
    is_required: true,
    sort_order: 1,
  },
  {
    id: "demo-mod-group-2",
    product_id: "demo-prod-1",
    name: "Ekstra",
    min_select: 0,
    max_select: 2,
    is_required: false,
    sort_order: 2,
  },
];

export const demoModifierOptions: ProductModifierOption[] = [
  {
    id: "demo-mod-opt-1",
    group_id: "demo-mod-group-1",
    name: "Kucuk",
    price_delta: 0,
    is_default: true,
    sort_order: 1,
  },
  {
    id: "demo-mod-opt-2",
    group_id: "demo-mod-group-1",
    name: "Buyuk",
    price_delta: 25,
    is_default: false,
    sort_order: 2,
  },
  {
    id: "demo-mod-opt-3",
    group_id: "demo-mod-group-2",
    name: "Ekstra shot",
    price_delta: 20,
    is_default: false,
    sort_order: 1,
  },
  {
    id: "demo-mod-opt-4",
    group_id: "demo-mod-group-2",
    name: "Yulaf sut",
    price_delta: 18,
    is_default: false,
    sort_order: 2,
  },
];

export const demoBusiness: Business = {
  id: "demo-business-1",
  name: "Demo Business",
  slug: DEFAULT_BUSINESS_SLUG,
  plan: "growth",
  business_type: "restaurant_cafe",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const demoBranches: Branch[] = [
  {
    id: "demo-branch-1",
    business_id: "demo-business-1",
    name: "Merkez Şube",
    slug: "merkez",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-branch-2",
    business_id: "demo-business-1",
    name: "Bahce Şube",
    slug: "bahce",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const demoCouriers: Courier[] = [
  {
    id: "demo-courier-1",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    full_name: "Kurye Mehmet",
    phone: "+90 555 777 88 99",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-courier-2",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    full_name: "Kurye Elif",
    phone: "+90 555 666 55 44",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
