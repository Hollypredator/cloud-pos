import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  attachIngredientToProduct,
  bulkUpdateCategoryPrices,
  commitEnterpriseMarketImport,
  createCategory,
  createIngredient,
  createProduct,
  createProductModifierGroup,
  createProductModifierOption,
  deleteCategory,
  deleteIngredient,
  deleteProduct,
  deleteProductModifierGroup,
  deleteProductModifierOption,
  detachIngredientFromProduct,
  dryRunEnterpriseMarketImport,
  getApplicationSettings,
  getProductManagementData,
  reorderCategories,
  uploadMediaFile,
  updateCategoryPrepStation,
  updateApplicationSettings,
  updateIngredient,
  updateProduct,
} from "@/lib/data";
import { requireRole } from "@/lib/auth";
import { BackofficePage, ContentCard, EmptyPanel, NoticeBanner, SummaryCard, WorkspaceTabs } from "@/components/backoffice-ui";
import { CategorySortManager } from "@/components/category-sort-manager";
import { FileDropInput } from "@/components/file-drop-input";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductDepartment, ProductKind, ProductProfileScope, ProductUnit } from "@/lib/types";

function normalizePrepStation(value: FormDataEntryValue | null) {
  const station = typeof value === "string" ? value : "";
  if (station === "bar" || station === "dessert") {
    return station;
  }
  return "kitchen";
}

function normalizeProfileScope(value: FormDataEntryValue | null): ProductProfileScope {
  return value === "enterprise_market" ? "enterprise_market" : "restaurant";
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeProductKind(value: FormDataEntryValue | null): ProductKind {
  return value === "weighted" || value === "service" ? value : "standard";
}

function normalizeProductUnit(value: FormDataEntryValue | null): ProductUnit {
  if (value === "kg" || value === "gram" || value === "litre" || value === "ml" || value === "paket") {
    return value;
  }
  return "adet";
}

function normalizeProductDepartment(value: FormDataEntryValue | null): ProductDepartment {
  if (
    value === "butcher" ||
    value === "delicatessen" ||
    value === "bakery" ||
    value === "produce" ||
    value === "beverage" ||
    value === "frozen" ||
    value === "non_food"
  ) {
    return value;
  }
  return "general";
}

const restaurantDemoCatalogSeed = {
  categories: [
    { name: "Kahveler", sortOrder: 1, prepStation: "bar" as const },
    { name: "Soguk Kahveler", sortOrder: 2, prepStation: "bar" as const },
    { name: "Cay ve Bitki Caylari", sortOrder: 3, prepStation: "bar" as const },
    { name: "Refresher ve Frozen", sortOrder: 4, prepStation: "bar" as const },
    { name: "Soft Icecekler", sortOrder: 5, prepStation: "bar" as const },
    { name: "Firindan", sortOrder: 6, prepStation: "dessert" as const },
    { name: "Tatlilar", sortOrder: 7, prepStation: "dessert" as const },
    { name: "Kahvalti", sortOrder: 8, prepStation: "kitchen" as const },
    { name: "Burgerler", sortOrder: 9, prepStation: "kitchen" as const },
    { name: "Pizzalar", sortOrder: 10, prepStation: "kitchen" as const },
    { name: "Makarnalar", sortOrder: 11, prepStation: "kitchen" as const },
    { name: "Sandvic ve Wrap", sortOrder: 12, prepStation: "kitchen" as const },
    { name: "Salata ve Bowl", sortOrder: 13, prepStation: "kitchen" as const },
    { name: "Corbalar", sortOrder: 14, prepStation: "kitchen" as const },
    { name: "Atistirmalik", sortOrder: 15, prepStation: "kitchen" as const },
    { name: "El Yapimi Limonatalar", sortOrder: 16, prepStation: "bar" as const },
    { name: "Smoothie ve Milkshake", sortOrder: 17, prepStation: "bar" as const },
  ],
  products: [
    { categoryName: "Kahveler", name: "Espresso", price: 110, stockCount: 999, description: "Single shot espresso" },
    { categoryName: "Kahveler", name: "Doppio", price: 125, stockCount: 999, description: "Double shot espresso" },
    { categoryName: "Kahveler", name: "Americano", price: 130, stockCount: 999, description: "Espresso and hot water" },
    { categoryName: "Kahveler", name: "Latte", price: 150, stockCount: 999, description: "Espresso with steamed milk" },
    { categoryName: "Kahveler", name: "Cappuccino", price: 155, stockCount: 999, description: "Espresso with milk foam" },
    { categoryName: "Kahveler", name: "Flat White", price: 160, stockCount: 999, description: "Silky milk and ristretto shot" },
    { categoryName: "Kahveler", name: "Mocha", price: 170, stockCount: 999, description: "Chocolate flavored latte" },
    { categoryName: "Kahveler", name: "Caramel Macchiato", price: 180, stockCount: 999, description: "Vanilla and caramel espresso drink" },
    { categoryName: "Kahveler", name: "White Chocolate Mocha", price: 190, stockCount: 999, description: "White chocolate espresso drink" },
    { categoryName: "Kahveler", name: "Filtre Kahve", price: 120, stockCount: 999, description: "Freshly brewed filter coffee" },
    { categoryName: "Kahveler", name: "Turk Kahvesi", price: 125, stockCount: 999, description: "Traditional Turkish coffee" },
    { categoryName: "Kahveler", name: "Chai Tea Latte", price: 165, stockCount: 999, description: "Spiced tea latte" },

    { categoryName: "Soguk Kahveler", name: "Iced Americano", price: 145, stockCount: 999, description: "Espresso over ice" },
    { categoryName: "Soguk Kahveler", name: "Iced Latte", price: 165, stockCount: 999, description: "Espresso milk and ice" },
    { categoryName: "Soguk Kahveler", name: "Iced Mocha", price: 180, stockCount: 999, description: "Iced chocolate mocha" },
    { categoryName: "Soguk Kahveler", name: "Cold Brew", price: 170, stockCount: 999, description: "Slow brewed cold coffee" },
    { categoryName: "Soguk Kahveler", name: "Nitro Cold Brew", price: 190, stockCount: 999, description: "Nitrogen infused cold brew" },
    { categoryName: "Soguk Kahveler", name: "Iced Caramel Macchiato", price: 200, stockCount: 999, description: "Iced caramel espresso drink" },

    { categoryName: "Cay ve Bitki Caylari", name: "English Breakfast Tea", price: 110, stockCount: 999, description: "Classic black tea blend" },
    { categoryName: "Cay ve Bitki Caylari", name: "Earl Grey Tea", price: 115, stockCount: 999, description: "Bergamot flavored tea" },
    { categoryName: "Cay ve Bitki Caylari", name: "Yesil Cay", price: 110, stockCount: 999, description: "Fresh green tea" },
    { categoryName: "Cay ve Bitki Caylari", name: "Papatya Cayi", price: 115, stockCount: 999, description: "Calming chamomile tea" },

    { categoryName: "Refresher ve Frozen", name: "Strawberry Refresher", price: 185, stockCount: 999, description: "Strawberry fruit refresher" },
    { categoryName: "Refresher ve Frozen", name: "Mango Dragonfruit Refresher", price: 190, stockCount: 999, description: "Tropical fruit refresher" },
    { categoryName: "Refresher ve Frozen", name: "Coffee Frappuccino", price: 210, stockCount: 999, description: "Blended iced coffee" },
    { categoryName: "Refresher ve Frozen", name: "Caramel Frappuccino", price: 220, stockCount: 999, description: "Blended caramel coffee" },
    { categoryName: "Refresher ve Frozen", name: "Java Chip Frappuccino", price: 225, stockCount: 999, description: "Chocolate chip frappuccino" },
    { categoryName: "Refresher ve Frozen", name: "Matcha Frappuccino", price: 220, stockCount: 999, description: "Green tea frappuccino" },

    { categoryName: "Soft Icecekler", name: "Coca Cola", price: 110, stockCount: 999, description: "330 ml can" },
    { categoryName: "Soft Icecekler", name: "Coca Cola Zero", price: 110, stockCount: 999, description: "330 ml can sugar free" },
    { categoryName: "Soft Icecekler", name: "Fanta", price: 110, stockCount: 999, description: "330 ml can orange" },
    { categoryName: "Soft Icecekler", name: "Sprite", price: 110, stockCount: 999, description: "330 ml can lemon lime" },
    { categoryName: "Soft Icecekler", name: "Fuse Tea Seftali", price: 115, stockCount: 999, description: "330 ml iced tea" },
    { categoryName: "Soft Icecekler", name: "Limonata", price: 120, stockCount: 999, description: "Homemade lemonade" },
    { categoryName: "Soft Icecekler", name: "Ayran", price: 110, stockCount: 999, description: "300 ml ayran" },
    { categoryName: "Soft Icecekler", name: "Sade Soda", price: 105, stockCount: 999, description: "Mineral water" },

    { categoryName: "Firindan", name: "Butter Croissant", price: 115, stockCount: 999, description: "All butter croissant" },
    { categoryName: "Firindan", name: "Chocolate Croissant", price: 125, stockCount: 999, description: "Chocolate filled croissant" },
    { categoryName: "Firindan", name: "Cookie", price: 110, stockCount: 999, description: "Chunky cookie" },
    { categoryName: "Firindan", name: "Blueberry Muffin", price: 120, stockCount: 999, description: "Blueberry muffin" },
    { categoryName: "Firindan", name: "Acma", price: 110, stockCount: 999, description: "Sesame acma" },
    { categoryName: "Firindan", name: "Pogaca Beyaz Peynir", price: 115, stockCount: 999, description: "Soft pogaca with feta" },
    { categoryName: "Firindan", name: "Simit", price: 105, stockCount: 999, description: "Classic simit" },

    { categoryName: "Tatlilar", name: "San Sebastian", price: 210, stockCount: 999, description: "Burnt basque cheesecake" },
    { categoryName: "Tatlilar", name: "Tiramisu", price: 205, stockCount: 999, description: "Coffee layered tiramisu" },
    { categoryName: "Tatlilar", name: "Red Velvet Slice", price: 190, stockCount: 999, description: "Red velvet cake slice" },
    { categoryName: "Tatlilar", name: "Brownie", price: 145, stockCount: 999, description: "Chocolate brownie" },
    { categoryName: "Tatlilar", name: "Profiterol", price: 165, stockCount: 999, description: "Chocolate profiterole" },
    { categoryName: "Tatlilar", name: "Sufle", price: 185, stockCount: 999, description: "Warm chocolate souffle" },
    { categoryName: "Tatlilar", name: "Magnolia", price: 160, stockCount: 999, description: "Biscuit and fruit cream dessert" },
    { categoryName: "Tatlilar", name: "Trilece", price: 170, stockCount: 999, description: "Milk soaked sponge cake" },

    { categoryName: "Kahvalti", name: "Serpme Kahvalti", price: 420, stockCount: 999, description: "For two people mixed breakfast" },
    { categoryName: "Kahvalti", name: "Kahvalti Tabagi", price: 250, stockCount: 999, description: "Cheese olive egg and greens" },
    { categoryName: "Kahvalti", name: "Menemen", price: 190, stockCount: 999, description: "Traditional menemen" },
    { categoryName: "Kahvalti", name: "Sucuklu Yumurta", price: 210, stockCount: 999, description: "Eggs with sucuk" },
    { categoryName: "Kahvalti", name: "Avokadolu Tost", price: 195, stockCount: 999, description: "Sourdough toast with avocado" },
    { categoryName: "Kahvalti", name: "Pankek", price: 175, stockCount: 999, description: "Pancake with fruit and sauce" },

    { categoryName: "Burgerler", name: "Klasik Burger", price: 260, stockCount: 999, description: "Beef patty lettuce tomato pickle" },
    { categoryName: "Burgerler", name: "Cheeseburger", price: 275, stockCount: 999, description: "Classic burger with cheddar" },
    { categoryName: "Burgerler", name: "BBQ Burger", price: 290, stockCount: 999, description: "Beef burger with bbq sauce" },
    { categoryName: "Burgerler", name: "Mantarli Burger", price: 295, stockCount: 999, description: "Beef burger with saute mushrooms" },
    { categoryName: "Burgerler", name: "Crispy Tavuk Burger", price: 245, stockCount: 999, description: "Crispy chicken burger" },
    { categoryName: "Burgerler", name: "Vegan Burger", price: 255, stockCount: 999, description: "Plant based burger option" },

    { categoryName: "Pizzalar", name: "Margherita Pizza", price: 250, stockCount: 999, description: "Tomato mozzarella basil" },
    { categoryName: "Pizzalar", name: "Pepperoni Pizza", price: 285, stockCount: 999, description: "Pepperoni mozzarella tomato sauce" },
    { categoryName: "Pizzalar", name: "Karisik Pizza", price: 305, stockCount: 999, description: "Mixed topping house pizza" },
    { categoryName: "Pizzalar", name: "Dort Peynir Pizza", price: 295, stockCount: 999, description: "Four cheese pizza" },
    { categoryName: "Pizzalar", name: "Vejetaryen Pizza", price: 275, stockCount: 999, description: "Vegetable topping pizza" },
    { categoryName: "Pizzalar", name: "Tavuklu BBQ Pizza", price: 310, stockCount: 999, description: "Chicken bbq pizza" },

    { categoryName: "Makarnalar", name: "Spaghetti Napoli", price: 230, stockCount: 999, description: "Tomato basil spaghetti" },
    { categoryName: "Makarnalar", name: "Penne Alfredo", price: 255, stockCount: 999, description: "Creamy alfredo penne" },
    { categoryName: "Makarnalar", name: "Fettuccine Alfredo Tavuklu", price: 285, stockCount: 999, description: "Chicken fettuccine alfredo" },
    { categoryName: "Makarnalar", name: "Tagliatelle Mantarli", price: 270, stockCount: 999, description: "Mushroom cream tagliatelle" },
    { categoryName: "Makarnalar", name: "Arrabbiata", price: 245, stockCount: 999, description: "Spicy tomato pasta" },
    { categoryName: "Makarnalar", name: "Pesto Linguine", price: 260, stockCount: 999, description: "Fresh pesto linguine" },

    { categoryName: "Sandvic ve Wrap", name: "Club Sandwich", price: 225, stockCount: 999, description: "Triple layered chicken club" },
    { categoryName: "Sandvic ve Wrap", name: "Ton Balikli Sandvic", price: 185, stockCount: 999, description: "Tuna sandwich" },
    { categoryName: "Sandvic ve Wrap", name: "Bagel Sandwich", price: 195, stockCount: 999, description: "Smoked turkey bagel sandwich" },
    { categoryName: "Sandvic ve Wrap", name: "Chicken Caesar Wrap", price: 220, stockCount: 999, description: "Chicken caesar wrap" },
    { categoryName: "Sandvic ve Wrap", name: "Falafel Wrap", price: 210, stockCount: 999, description: "Falafel wrap with tahini sauce" },
    { categoryName: "Sandvic ve Wrap", name: "Izgara Tavuk Sandvic", price: 215, stockCount: 999, description: "Grilled chicken sandwich" },

    { categoryName: "Salata ve Bowl", name: "Sezar Salata", price: 210, stockCount: 999, description: "Classic caesar salad" },
    { categoryName: "Salata ve Bowl", name: "Tavuklu Sezar Salata", price: 240, stockCount: 999, description: "Caesar salad with chicken" },
    { categoryName: "Salata ve Bowl", name: "Akdeniz Salata", price: 220, stockCount: 999, description: "Mediterranean greens and cheese" },
    { categoryName: "Salata ve Bowl", name: "Kinoali Bowl", price: 245, stockCount: 999, description: "Quinoa vegetable bowl" },
    { categoryName: "Salata ve Bowl", name: "Somonlu Bowl", price: 290, stockCount: 999, description: "Salmon and avocado bowl" },

    { categoryName: "Corbalar", name: "Mercimek Corbasi", price: 145, stockCount: 999, description: "Lentil soup" },
    { categoryName: "Corbalar", name: "Domates Corbasi", price: 150, stockCount: 999, description: "Creamy tomato soup" },
    { categoryName: "Corbalar", name: "Mantar Corbasi", price: 155, stockCount: 999, description: "Mushroom soup" },

    { categoryName: "Atistirmalik", name: "Patates Kizartmasi", price: 145, stockCount: 999, description: "Crispy french fries" },
    { categoryName: "Atistirmalik", name: "Parmak Tavuk", price: 185, stockCount: 999, description: "Crispy chicken strips" },
    { categoryName: "Atistirmalik", name: "Sogan Halkasi", price: 150, stockCount: 999, description: "Onion rings" },
    { categoryName: "Atistirmalik", name: "Mozzarella Sticks", price: 190, stockCount: 999, description: "Breaded mozzarella sticks" },
    { categoryName: "Atistirmalik", name: "Protein Box", price: 220, stockCount: 999, description: "Protein snack box" },

    { categoryName: "Kahveler", name: "Cortado", price: 135, stockCount: 999, description: "Espresso with equal steamed milk" },
    { categoryName: "Kahveler", name: "Ristretto", price: 115, stockCount: 999, description: "Short and intense espresso shot" },
    { categoryName: "Kahveler", name: "V60 Pour Over", price: 170, stockCount: 999, description: "Hand brewed single origin coffee" },
    { categoryName: "Kahveler", name: "French Press", price: 165, stockCount: 999, description: "Immersion brewed coffee" },
    { categoryName: "Kahveler", name: "Spanish Latte", price: 180, stockCount: 999, description: "Condensed milk based latte" },

    { categoryName: "Soguk Kahveler", name: "Iced Flat White", price: 175, stockCount: 999, description: "Iced flat white with silky texture" },
    { categoryName: "Soguk Kahveler", name: "Iced White Mocha", price: 205, stockCount: 999, description: "Iced white mocha coffee" },
    { categoryName: "Soguk Kahveler", name: "Vanilla Sweet Cream Cold Brew", price: 210, stockCount: 999, description: "Cold brew with vanilla cream" },
    { categoryName: "Soguk Kahveler", name: "Salted Caramel Cold Brew", price: 215, stockCount: 999, description: "Cold brew with salted caramel foam" },
    { categoryName: "Soguk Kahveler", name: "Iced Shaken Espresso", price: 195, stockCount: 999, description: "Shaken espresso over ice" },

    { categoryName: "Cay ve Bitki Caylari", name: "Jasmin Tea", price: 120, stockCount: 999, description: "Floral jasmine green tea" },
    { categoryName: "Cay ve Bitki Caylari", name: "Ada Cayi", price: 115, stockCount: 999, description: "Sage herbal tea" },
    { categoryName: "Cay ve Bitki Caylari", name: "Ihlamur", price: 120, stockCount: 999, description: "Linden tea with lemon" },
    { categoryName: "Cay ve Bitki Caylari", name: "Nane Limon", price: 120, stockCount: 999, description: "Mint lemon herbal tea" },
    { categoryName: "Cay ve Bitki Caylari", name: "Hibiscus Tea", price: 125, stockCount: 999, description: "Tart hibiscus infusion" },

    { categoryName: "Refresher ve Frozen", name: "Berry Hibiscus Refresher", price: 195, stockCount: 999, description: "Berry and hibiscus refresher" },
    { categoryName: "Refresher ve Frozen", name: "Passionfruit Refresher", price: 190, stockCount: 999, description: "Passionfruit citrus refresher" },
    { categoryName: "Refresher ve Frozen", name: "Frozen Strawberry", price: 205, stockCount: 999, description: "Frozen strawberry blended drink" },
    { categoryName: "Refresher ve Frozen", name: "Frozen Mango", price: 210, stockCount: 999, description: "Frozen mango blended drink" },
    { categoryName: "Refresher ve Frozen", name: "Frozen Forest Fruit", price: 215, stockCount: 999, description: "Frozen mixed berry drink" },
    { categoryName: "Refresher ve Frozen", name: "Caramel Cream Frappuccino", price: 230, stockCount: 999, description: "Blended caramel cream drink" },
    { categoryName: "Refresher ve Frozen", name: "Double Chocolate Chip Frappuccino", price: 235, stockCount: 999, description: "Chocolate chip blended drink" },

    { categoryName: "Soft Icecekler", name: "Salgam", price: 110, stockCount: 999, description: "Spicy fermented turnip juice" },
    { categoryName: "Soft Icecekler", name: "Churchill", price: 115, stockCount: 999, description: "Soda lemon and salt" },
    { categoryName: "Soft Icecekler", name: "Ginger Ale", price: 120, stockCount: 999, description: "Refreshing ginger soft drink" },
    { categoryName: "Soft Icecekler", name: "Tonic Water", price: 115, stockCount: 999, description: "Classic tonic water" },
    { categoryName: "Soft Icecekler", name: "Meyveli Soda", price: 110, stockCount: 999, description: "Fruit flavored mineral soda" },
    { categoryName: "Soft Icecekler", name: "Portakal Suyu", price: 130, stockCount: 999, description: "Fresh orange juice" },
    { categoryName: "Soft Icecekler", name: "Nar Suyu", price: 140, stockCount: 999, description: "Fresh pomegranate juice" },

    { categoryName: "Firindan", name: "Kruvasan Peynirli", price: 135, stockCount: 999, description: "Cheese filled croissant" },
    { categoryName: "Firindan", name: "Kruvasan Hindi Fume", price: 145, stockCount: 999, description: "Smoked turkey croissant" },
    { categoryName: "Firindan", name: "Mini Pizza Dilimi", price: 120, stockCount: 999, description: "Cheese tomato mini pizza slice" },
    { categoryName: "Firindan", name: "Cinnamon Roll", price: 145, stockCount: 999, description: "Cinnamon sugar roll" },
    { categoryName: "Firindan", name: "Cheese Danish", price: 140, stockCount: 999, description: "Cream cheese pastry" },

    { categoryName: "Tatlilar", name: "Cheesecake Frambuazli", price: 210, stockCount: 999, description: "Raspberry cheesecake slice" },
    { categoryName: "Tatlilar", name: "Limonlu Tart", price: 175, stockCount: 999, description: "Lemon tart with meringue" },
    { categoryName: "Tatlilar", name: "Cookie Dough", price: 155, stockCount: 999, description: "Warm cookie dough dessert" },
    { categoryName: "Tatlilar", name: "Cilekli Pasta", price: 190, stockCount: 999, description: "Strawberry cream cake slice" },
    { categoryName: "Tatlilar", name: "Mosaic Pasta", price: 165, stockCount: 999, description: "Chocolate biscuit mosaic cake" },

    { categoryName: "Kahvalti", name: "Omlet Peynirli", price: 180, stockCount: 999, description: "Cheese omelette with greens" },
    { categoryName: "Kahvalti", name: "Omlet Mantarlı", price: 195, stockCount: 999, description: "Mushroom omelette" },
    { categoryName: "Kahvalti", name: "Granola Yogurt Bowl", price: 175, stockCount: 999, description: "Granola yogurt and fruit" },
    { categoryName: "Kahvalti", name: "French Toast", price: 190, stockCount: 999, description: "Caramelized french toast" },
    { categoryName: "Kahvalti", name: "Simit Kahvalti Tabagi", price: 165, stockCount: 999, description: "Simit and breakfast sides" },

    { categoryName: "Burgerler", name: "Double Cheeseburger", price: 335, stockCount: 999, description: "Double beef patty and cheddar" },
    { categoryName: "Burgerler", name: "Meksika Burger", price: 305, stockCount: 999, description: "Jalapeno and spicy sauce burger" },
    { categoryName: "Burgerler", name: "Truffle Burger", price: 330, stockCount: 999, description: "Mushroom and truffle mayo burger" },
    { categoryName: "Burgerler", name: "Halloumi Burger", price: 285, stockCount: 999, description: "Grilled halloumi burger option" },
    { categoryName: "Burgerler", name: "Smash Burger", price: 295, stockCount: 999, description: "Crispy edge smashed beef burger" },

    { categoryName: "Pizzalar", name: "Sucuklu Pizza", price: 295, stockCount: 999, description: "Turkish sucuk and cheese pizza" },
    { categoryName: "Pizzalar", name: "Mantarlı Pizza", price: 280, stockCount: 999, description: "Mushroom mozzarella pizza" },
    { categoryName: "Pizzalar", name: "Ton Balikli Pizza", price: 300, stockCount: 999, description: "Tuna olive onion pizza" },
    { categoryName: "Pizzalar", name: "Kaburgali Pizza", price: 330, stockCount: 999, description: "Beef rib and bbq pizza" },
    { categoryName: "Pizzalar", name: "Pesto Tavuk Pizza", price: 315, stockCount: 999, description: "Chicken pesto cream pizza" },

    { categoryName: "Makarnalar", name: "Spaghetti Bolognese", price: 290, stockCount: 999, description: "Beef ragu spaghetti" },
    { categoryName: "Makarnalar", name: "Penne Arabiata Tavuklu", price: 275, stockCount: 999, description: "Spicy penne with chicken" },
    { categoryName: "Makarnalar", name: "Kremali Mantarlı Penne", price: 265, stockCount: 999, description: "Penne with creamy mushroom sauce" },
    { categoryName: "Makarnalar", name: "Lazanya", price: 320, stockCount: 999, description: "Classic beef lasagna" },
    { categoryName: "Makarnalar", name: "Ravioli Ricotta", price: 305, stockCount: 999, description: "Ricotta stuffed ravioli" },

    { categoryName: "Sandvic ve Wrap", name: "Mozzarella Pesto Panini", price: 230, stockCount: 999, description: "Panini with mozzarella and pesto" },
    { categoryName: "Sandvic ve Wrap", name: "Roast Beef Sandvic", price: 245, stockCount: 999, description: "Roast beef and mustard sandwich" },
    { categoryName: "Sandvic ve Wrap", name: "Somonlu Bagel", price: 260, stockCount: 999, description: "Smoked salmon cream cheese bagel" },
    { categoryName: "Sandvic ve Wrap", name: "Hellim Wrap", price: 220, stockCount: 999, description: "Grilled halloumi wrap" },
    { categoryName: "Sandvic ve Wrap", name: "Ton Balikli Wrap", price: 215, stockCount: 999, description: "Tuna corn wrap" },

    { categoryName: "Salata ve Bowl", name: "Avokadolu Yesil Salata", price: 235, stockCount: 999, description: "Green salad with avocado" },
    { categoryName: "Salata ve Bowl", name: "Hellim Salata", price: 245, stockCount: 999, description: "Grilled halloumi salad" },
    { categoryName: "Salata ve Bowl", name: "Tavuklu Kinoali Bowl", price: 260, stockCount: 999, description: "Quinoa bowl with grilled chicken" },
    { categoryName: "Salata ve Bowl", name: "Ton Balikli Salata", price: 240, stockCount: 999, description: "Tuna mixed salad" },
    { categoryName: "Salata ve Bowl", name: "Falafel Bowl", price: 250, stockCount: 999, description: "Falafel hummus and vegetables bowl" },

    { categoryName: "Corbalar", name: "Ezogelin Corbasi", price: 150, stockCount: 999, description: "Traditional ezogelin soup" },
    { categoryName: "Corbalar", name: "Tavuk Suyu Corbasi", price: 165, stockCount: 999, description: "Chicken broth soup" },
    { categoryName: "Corbalar", name: "Sebzeli Corba", price: 155, stockCount: 999, description: "Mixed vegetable soup" },
    { categoryName: "Corbalar", name: "Brokoli Corbasi", price: 165, stockCount: 999, description: "Creamy broccoli soup" },

    { categoryName: "Atistirmalik", name: "Citir Tavuk Sepeti", price: 225, stockCount: 999, description: "Crispy chicken basket" },
    { categoryName: "Atistirmalik", name: "Nachos", price: 210, stockCount: 999, description: "Nachos with cheddar sauce" },
    { categoryName: "Atistirmalik", name: "Sosis Tabagi", price: 185, stockCount: 999, description: "Mini sausage platter" },
    { categoryName: "Atistirmalik", name: "Karisik Finger Plate", price: 295, stockCount: 999, description: "Mixed fried finger foods" },

    { categoryName: "El Yapimi Limonatalar", name: "Klasik Limonata", price: 145, stockCount: 999, description: "Fresh lemon and mint lemonade" },
    { categoryName: "El Yapimi Limonatalar", name: "Naneli Limonata", price: 150, stockCount: 999, description: "Mint lemonade with crushed ice" },
    { categoryName: "El Yapimi Limonatalar", name: "Cilekli Limonata", price: 160, stockCount: 999, description: "Strawberry lemonade" },
    { categoryName: "El Yapimi Limonatalar", name: "Frambuazli Limonata", price: 165, stockCount: 999, description: "Raspberry lemonade" },
    { categoryName: "El Yapimi Limonatalar", name: "Bodrum Limonata", price: 170, stockCount: 999, description: "Lemonade with basil and cucumber" },
    { categoryName: "El Yapimi Limonatalar", name: "Zencefilli Limonata", price: 165, stockCount: 999, description: "Ginger lemonade" },
    { categoryName: "El Yapimi Limonatalar", name: "Lavanta Limonata", price: 175, stockCount: 999, description: "Lavender infused lemonade" },

    { categoryName: "Smoothie ve Milkshake", name: "Strawberry Banana Smoothie", price: 185, stockCount: 999, description: "Banana and strawberry smoothie" },
    { categoryName: "Smoothie ve Milkshake", name: "Mango Smoothie", price: 190, stockCount: 999, description: "Mango yogurt smoothie" },
    { categoryName: "Smoothie ve Milkshake", name: "Forest Fruit Smoothie", price: 195, stockCount: 999, description: "Mixed berry smoothie" },
    { categoryName: "Smoothie ve Milkshake", name: "Green Detox Smoothie", price: 205, stockCount: 999, description: "Spinach apple cucumber smoothie" },
    { categoryName: "Smoothie ve Milkshake", name: "Peanut Butter Banana Smoothie", price: 210, stockCount: 999, description: "Peanut butter banana protein smoothie" },
    { categoryName: "Smoothie ve Milkshake", name: "Vanilla Milkshake", price: 175, stockCount: 999, description: "Creamy vanilla milkshake" },
    { categoryName: "Smoothie ve Milkshake", name: "Chocolate Milkshake", price: 180, stockCount: 999, description: "Classic chocolate milkshake" },
    { categoryName: "Smoothie ve Milkshake", name: "Caramel Milkshake", price: 185, stockCount: 999, description: "Salted caramel milkshake" },
    { categoryName: "Smoothie ve Milkshake", name: "Oreo Milkshake", price: 190, stockCount: 999, description: "Oreo cookie milkshake" },
    { categoryName: "Smoothie ve Milkshake", name: "Lotus Milkshake", price: 200, stockCount: 999, description: "Biscoff lotus milkshake" },
  ],
};

function normalizeCatalogName(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function isDuplicateError(message?: string | null) {
  const text = (message ?? "").toLocaleLowerCase("tr-TR");
  return text.includes("duplicate") || text.includes("already exists") || text.includes("unique");
}

type RestaurantDemoRecipeLine = {
  ingredientName: string;
  quantity: number;
};

type RestaurantDemoRecipePlan = {
  lines: RestaurantDemoRecipeLine[];
};

const restaurantDemoIngredientsSeed: Array<{ name: string; unit: string; cost: number }> = [
  { name: "Espresso Cekirdegi", unit: "gram", cost: 1.4 },
  { name: "Filtre Kahve Harmani", unit: "gram", cost: 1.2 },
  { name: "Turk Kahvesi Harmani", unit: "gram", cost: 1.5 },
  { name: "Sut", unit: "ml", cost: 0.06 },
  { name: "Kondanse Sut", unit: "ml", cost: 0.18 },
  { name: "Su", unit: "ml", cost: 0.002 },
  { name: "Buz", unit: "gram", cost: 0.01 },
  { name: "Chai Konsantre", unit: "ml", cost: 0.25 },
  { name: "Cikolata Sos", unit: "ml", cost: 0.22 },
  { name: "Karamel Sos", unit: "ml", cost: 0.2 },
  { name: "Beyaz Cikolata Sos", unit: "ml", cost: 0.24 },
  { name: "Vanilya Surubu", unit: "ml", cost: 0.18 },
  { name: "Cay Harmani", unit: "gram", cost: 0.8 },
  { name: "Yesil Cay Harmani", unit: "gram", cost: 0.95 },
  { name: "Bitki Cayi Harmani", unit: "gram", cost: 1.05 },
  { name: "Jasmin Harmani", unit: "gram", cost: 1.1 },
  { name: "Hibiscus Konsantre", unit: "ml", cost: 0.28 },
  { name: "Limon", unit: "gram", cost: 0.12 },
  { name: "Nane", unit: "gram", cost: 0.2 },
  { name: "Meyve Puresi", unit: "ml", cost: 0.45 },
  { name: "Frozen Buz Base", unit: "ml", cost: 0.36 },
  { name: "Soda Suyu", unit: "ml", cost: 0.03 },
  { name: "Gazli Icecek Kutusu", unit: "adet", cost: 55 },
  { name: "Ayran Hazir", unit: "adet", cost: 35 },
  { name: "Maden Suyu Hazir", unit: "adet", cost: 28 },
  { name: "Meyveli Soda Hazir", unit: "adet", cost: 30 },
  { name: "Portakal", unit: "gram", cost: 0.18 },
  { name: "Nar", unit: "gram", cost: 0.24 },
  { name: "Hamur Isi Taban", unit: "adet", cost: 42 },
  { name: "Tereyag", unit: "gram", cost: 0.42 },
  { name: "Cikolata Dolgu", unit: "gram", cost: 0.35 },
  { name: "Krema", unit: "ml", cost: 0.26 },
  { name: "Yumurta", unit: "adet", cost: 8 },
  { name: "Peynir", unit: "gram", cost: 0.9 },
  { name: "Zeytin", unit: "gram", cost: 0.22 },
  { name: "Sucuk", unit: "gram", cost: 1.25 },
  { name: "Avokado", unit: "gram", cost: 0.55 },
  { name: "Pankek Mix", unit: "gram", cost: 0.26 },
  { name: "Dana Kofte", unit: "gram", cost: 1.75 },
  { name: "Tavuk Fileto", unit: "gram", cost: 0.95 },
  { name: "Vegan Kofte", unit: "gram", cost: 1.35 },
  { name: "Burger Ekmek", unit: "adet", cost: 16 },
  { name: "Pizza Hamuru", unit: "adet", cost: 30 },
  { name: "Mozzarella", unit: "gram", cost: 1.15 },
  { name: "Pepperoni", unit: "gram", cost: 1.4 },
  { name: "Makarna Kuru", unit: "gram", cost: 0.32 },
  { name: "Domates Sos", unit: "ml", cost: 0.16 },
  { name: "Krema Sos", unit: "ml", cost: 0.24 },
  { name: "Parmesan", unit: "gram", cost: 1.35 },
  { name: "Pesto Sos", unit: "ml", cost: 0.38 },
  { name: "Tortilla", unit: "adet", cost: 14 },
  { name: "Sandvic Ekmegi", unit: "adet", cost: 13 },
  { name: "Ton Baligi", unit: "gram", cost: 1.2 },
  { name: "Somon Fume", unit: "gram", cost: 2.35 },
  { name: "Marul", unit: "gram", cost: 0.1 },
  { name: "Kinoa", unit: "gram", cost: 0.44 },
  { name: "Corba Baz", unit: "ml", cost: 0.14 },
  { name: "Patates", unit: "gram", cost: 0.22 },
  { name: "Kizartma Yagi", unit: "ml", cost: 0.08 },
  { name: "Mozzarella Cubuk", unit: "adet", cost: 10 },
  { name: "Sos Cesnisi", unit: "ml", cost: 0.2 },
  { name: "Dondurma", unit: "gram", cost: 0.24 },
  { name: "Yogurt", unit: "ml", cost: 0.1 },
  { name: "Muz", unit: "gram", cost: 0.2 },
  { name: "Cilek", unit: "gram", cost: 0.32 },
  { name: "Mango", unit: "gram", cost: 0.35 },
  { name: "Orman Meyvesi", unit: "gram", cost: 0.38 },
  { name: "Fistik Ezmesi", unit: "gram", cost: 0.52 },
  { name: "Oreo Parca", unit: "gram", cost: 0.34 },
  { name: "Lotus Kremasi", unit: "gram", cost: 0.48 },
  { name: "Bardak Kapak Seti", unit: "adet", cost: 6 },
  { name: "Servis Ambalaj Seti", unit: "adet", cost: 8 },
];

function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function buildRestaurantDemoRecipe(categoryName: string, productName: string): RestaurantDemoRecipePlan {
  const category = normalizeCatalogName(categoryName);
  const name = normalizeCatalogName(productName);
  const lines: RestaurantDemoRecipeLine[] = [];
  const add = (ingredientName: string, quantity: number) => {
    if (quantity > 0) {
      lines.push({ ingredientName, quantity });
    }
  };

  if (category === normalizeCatalogName("Kahveler")) {
    if (name.includes("filtre")) {
      add("Filtre Kahve Harmani", 18);
      add("Su", 250);
    } else if (name.includes("turk")) {
      add("Turk Kahvesi Harmani", 8);
      add("Su", 70);
    } else if (name.includes("chai")) {
      add("Chai Konsantre", 120);
      add("Sut", 160);
    } else {
      const shotCount = name.includes("doppio") ? 2 : 1;
      add("Espresso Cekirdegi", shotCount * 9);
      if (hasAnyKeyword(name, ["latte", "flat white", "cappuccino", "mocha", "macchiato", "spanish", "cortado"])) {
        add("Sut", name.includes("cortado") ? 60 : name.includes("cappuccino") ? 150 : name.includes("flat white") ? 140 : 220);
      }
      if (name.includes("americano")) {
        add("Su", 180);
      }
      if (name.includes("mocha")) {
        add("Cikolata Sos", 28);
      }
      if (name.includes("caramel")) {
        add("Karamel Sos", 25);
      }
      if (name.includes("white chocolate")) {
        add("Beyaz Cikolata Sos", 30);
      }
      if (name.includes("spanish")) {
        add("Kondanse Sut", 40);
      }
    }
    add("Bardak Kapak Seti", 1);
  } else if (category === normalizeCatalogName("Soguk Kahveler")) {
    add("Espresso Cekirdegi", name.includes("cold brew") ? 18 : 9);
    add("Buz", 180);
    if (hasAnyKeyword(name, ["latte", "flat white", "mocha", "macchiato", "white mocha", "sweet cream"])) {
      add("Sut", name.includes("sweet cream") ? 90 : 160);
    }
    if (name.includes("mocha")) {
      add("Cikolata Sos", 25);
    }
    if (name.includes("caramel")) {
      add("Karamel Sos", 24);
    }
    if (name.includes("white mocha")) {
      add("Beyaz Cikolata Sos", 28);
    }
    if (name.includes("cold brew")) {
      add("Su", 140);
    }
    add("Bardak Kapak Seti", 1);
  } else if (category === normalizeCatalogName("Cay ve Bitki Caylari")) {
    if (name.includes("yesil")) add("Yesil Cay Harmani", 5);
    else if (name.includes("jasmine")) add("Jasmin Harmani", 5);
    else if (hasAnyKeyword(name, ["papatya", "ada", "ihlamur", "nane", "hibiscus"])) add("Bitki Cayi Harmani", 6);
    else add("Cay Harmani", 5);
    add("Su", 220);
    if (name.includes("nane") || name.includes("limon")) add("Limon", 12);
    add("Bardak Kapak Seti", 1);
  } else if (category === normalizeCatalogName("Refresher ve Frozen")) {
    if (name.includes("frappuccino")) {
      add("Frozen Buz Base", 180);
      if (hasAnyKeyword(name, ["coffee", "caramel", "java"])) add("Espresso Cekirdegi", 9);
      if (name.includes("caramel")) add("Karamel Sos", 30);
      if (hasAnyKeyword(name, ["double chocolate", "java"])) add("Cikolata Sos", 32);
      add("Meyve Puresi", name.includes("matcha") ? 0 : 25);
    } else {
      add("Meyve Puresi", 140);
      add("Buz", 170);
      add("Soda Suyu", 100);
      if (name.includes("hibiscus")) add("Hibiscus Konsantre", 35);
    }
    add("Bardak Kapak Seti", 1);
  } else if (category === normalizeCatalogName("Soft Icecekler")) {
    if (hasAnyKeyword(name, ["coca", "fanta", "sprite", "fuse", "ginger", "tonic", "salgam"])) add("Gazli Icecek Kutusu", 1);
    else if (name.includes("ayran")) add("Ayran Hazir", 1);
    else if (name.includes("meyveli soda")) add("Meyveli Soda Hazir", 1);
    else if (name.includes("soda")) add("Maden Suyu Hazir", 1);
    else if (name.includes("limonata")) {
      add("Limon", 80);
      add("Su", 220);
      add("Nane", 4);
      if (name.includes("cilek")) add("Cilek", 35);
      if (name.includes("frambuaz")) add("Orman Meyvesi", 30);
      if (name.includes("zencefil")) add("Sos Cesnisi", 12);
    } else if (name.includes("portakal")) add("Portakal", 180);
    else if (name.includes("nar")) add("Nar", 170);
    add("Bardak Kapak Seti", 1);
  } else if (category === normalizeCatalogName("El Yapimi Limonatalar")) {
    add("Limon", 95);
    add("Su", 230);
    add("Nane", 5);
    if (name.includes("cilek")) add("Cilek", 40);
    if (name.includes("frambuaz")) add("Orman Meyvesi", 35);
    if (name.includes("lavanta")) add("Sos Cesnisi", 10);
    if (name.includes("zencefil")) add("Sos Cesnisi", 14);
    add("Bardak Kapak Seti", 1);
  } else if (category === normalizeCatalogName("Smoothie ve Milkshake")) {
    if (name.includes("milkshake")) {
      add("Dondurma", 140);
      add("Sut", 160);
      if (name.includes("chocolate")) add("Cikolata Sos", 30);
      if (name.includes("caramel")) add("Karamel Sos", 28);
      if (name.includes("oreo")) add("Oreo Parca", 28);
      if (name.includes("lotus")) add("Lotus Kremasi", 26);
    } else {
      add("Yogurt", 120);
      add("Buz", 130);
      if (name.includes("banana") || name.includes("muz")) add("Muz", 90);
      if (name.includes("strawberry") || name.includes("cilek")) add("Cilek", 75);
      if (name.includes("mango")) add("Mango", 85);
      if (hasAnyKeyword(name, ["forest", "berry", "orman"])) add("Orman Meyvesi", 80);
      if (name.includes("detox")) add("Avokado", 40);
      if (name.includes("peanut")) add("Fistik Ezmesi", 22);
    }
    add("Bardak Kapak Seti", 1);
  } else if (category === normalizeCatalogName("Firindan")) {
    add("Hamur Isi Taban", 1);
    if (name.includes("chocolate")) add("Cikolata Dolgu", 35);
    if (name.includes("peynir")) add("Peynir", 45);
    if (name.includes("hindi")) add("Tavuk Fileto", 60);
    if (name.includes("cinnamon")) add("Sos Cesnisi", 18);
    add("Tereyag", 22);
    add("Servis Ambalaj Seti", 1);
  } else if (category === normalizeCatalogName("Tatlilar")) {
    add("Krema", 90);
    add("Hamur Isi Taban", 1);
    if (hasAnyKeyword(name, ["brownie", "sufle", "mosaic", "cookie"])) add("Cikolata Dolgu", 55);
    if (name.includes("cheesecake") || name.includes("san sebastian")) add("Peynir", 70);
    if (name.includes("tiramisu")) add("Espresso Cekirdegi", 8);
    if (hasAnyKeyword(name, ["frambuaz", "cilek"])) add("Orman Meyvesi", 28);
    add("Servis Ambalaj Seti", 1);
  } else if (category === normalizeCatalogName("Kahvalti")) {
    if (name.includes("menemen")) {
      add("Yumurta", 2);
      add("Domates Sos", 70);
    } else if (name.includes("sucuk")) {
      add("Yumurta", 2);
      add("Sucuk", 65);
    } else if (name.includes("omlet")) {
      add("Yumurta", 3);
      if (name.includes("peynir")) add("Peynir", 45);
      if (name.includes("mantar")) add("Sos Cesnisi", 30);
    } else if (name.includes("avokado")) {
      add("Sandvic Ekmegi", 1);
      add("Avokado", 80);
      add("Yumurta", 1);
    } else if (name.includes("pankek") || name.includes("french toast")) {
      add("Pankek Mix", 120);
      add("Yumurta", 1);
      add("Krema", 35);
    } else {
      add("Peynir", 60);
      add("Zeytin", 40);
      add("Yumurta", 2);
    }
    add("Servis Ambalaj Seti", 1);
  } else if (category === normalizeCatalogName("Burgerler")) {
    add("Burger Ekmek", 1);
    if (name.includes("crispy tavuk")) add("Tavuk Fileto", 140);
    else if (name.includes("vegan")) add("Vegan Kofte", 130);
    else add("Dana Kofte", name.includes("double") ? 220 : 140);
    add("Marul", 25);
    if (name.includes("cheese")) add("Peynir", 30);
    if (name.includes("truffle") || name.includes("mantar")) add("Sos Cesnisi", 24);
    add("Patates", 150);
    add("Kizartma Yagi", 20);
    add("Servis Ambalaj Seti", 1);
  } else if (category === normalizeCatalogName("Pizzalar")) {
    add("Pizza Hamuru", 1);
    add("Domates Sos", 80);
    add("Mozzarella", 120);
    if (name.includes("pepperoni")) add("Pepperoni", 70);
    if (name.includes("sucuk")) add("Sucuk", 70);
    if (name.includes("ton")) add("Ton Baligi", 80);
    if (name.includes("tavuk")) add("Tavuk Fileto", 90);
    if (name.includes("dort peynir")) add("Peynir", 90);
    add("Servis Ambalaj Seti", 1);
  } else if (category === normalizeCatalogName("Makarnalar")) {
    add("Makarna Kuru", 140);
    if (hasAnyKeyword(name, ["alfredo", "kremali", "fettuccine"])) add("Krema Sos", 120);
    else add("Domates Sos", 110);
    if (name.includes("pesto")) add("Pesto Sos", 40);
    if (name.includes("bolognese")) add("Dana Kofte", 90);
    if (name.includes("tavuk")) add("Tavuk Fileto", 80);
    if (name.includes("ravioli")) add("Peynir", 55);
    add("Parmesan", 20);
    add("Servis Ambalaj Seti", 1);
  } else if (category === normalizeCatalogName("Sandvic ve Wrap")) {
    if (name.includes("wrap")) add("Tortilla", 1);
    else if (name.includes("bagel")) add("Burger Ekmek", 1);
    else add("Sandvic Ekmegi", 1);
    if (name.includes("ton")) add("Ton Baligi", 80);
    else if (name.includes("somon")) add("Somon Fume", 70);
    else if (hasAnyKeyword(name, ["tavuk", "chicken", "club"])) add("Tavuk Fileto", 95);
    else add("Peynir", 45);
    add("Marul", 30);
    add("Sos Cesnisi", 20);
    add("Servis Ambalaj Seti", 1);
  } else if (category === normalizeCatalogName("Salata ve Bowl")) {
    add("Marul", 120);
    if (name.includes("kinoa")) add("Kinoa", 75);
    if (name.includes("somon")) add("Somon Fume", 90);
    else if (hasAnyKeyword(name, ["tavuk", "sezar"])) add("Tavuk Fileto", 85);
    else if (name.includes("ton")) add("Ton Baligi", 70);
    else if (name.includes("falafel")) add("Vegan Kofte", 90);
    else if (name.includes("hellim")) add("Peynir", 65);
    add("Sos Cesnisi", 25);
    add("Servis Ambalaj Seti", 1);
  } else if (category === normalizeCatalogName("Corbalar")) {
    add("Corba Baz", 300);
    if (name.includes("mercimek")) add("Sos Cesnisi", 20);
    if (name.includes("domates")) add("Domates Sos", 40);
    if (name.includes("tavuk")) add("Tavuk Fileto", 45);
    add("Servis Ambalaj Seti", 1);
  } else if (category === normalizeCatalogName("Atistirmalik")) {
    if (name.includes("patates")) add("Patates", 220);
    if (hasAnyKeyword(name, ["tavuk", "finger"])) add("Tavuk Fileto", 120);
    if (name.includes("nachos")) add("Sos Cesnisi", 60);
    if (name.includes("sosis")) add("Sucuk", 85);
    if (name.includes("mozzarella")) add("Mozzarella Cubuk", 6);
    if (name.includes("protein")) {
      add("Yumurta", 2);
      add("Peynir", 40);
    }
    add("Kizartma Yagi", 30);
    add("Servis Ambalaj Seti", 1);
  } else {
    add("Servis Ambalaj Seti", 1);
  }

  const merged = new Map<string, number>();
  for (const line of lines) {
    const key = normalizeCatalogName(line.ingredientName);
    merged.set(key, (merged.get(key) ?? 0) + line.quantity);
  }
  return {
    lines: [...merged.entries()].map(([key, quantity]) => {
      const ingredient = restaurantDemoIngredientsSeed.find((item) => normalizeCatalogName(item.name) === key);
      return { ingredientName: ingredient?.name ?? key, quantity };
    }),
  };
}

function formatDryRunSummary(input: {
  rowCount: number;
  newCategoryCount: number;
  newProductCount: number;
  updateProductCount: number;
  conflictCount: number;
  errorCount: number;
}) {
  return `Dry-run tamam: satir ${input.rowCount}, yeni kategori ${input.newCategoryCount}, yeni urun ${input.newProductCount}, guncellenecek urun ${input.updateProductCount}, cakisma ${input.conflictCount}, hata ${input.errorCount}.`;
}

async function resolveProductsReturnPath() {
  const headerStore = await headers();
  const referer = headerStore.get("referer");
  if (!referer) {
    return "/admin/products";
  }

  try {
    const url = new URL(referer);
    if (url.pathname.startsWith("/admin/products")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return "/admin/products";
  }

  return "/admin/products";
}

async function resolveProductsFeedbackPath(tone: "success" | "error", feedback: string) {
  const basePath = await resolveProductsReturnPath();
  const url = new URL(basePath, "http://localhost");
  url.searchParams.set("tone", tone);
  url.searchParams.set("feedback", feedback);
  return `${url.pathname}${url.search}`;
}

function actionErrorMessage(result: { ok: boolean; error?: string | null }, fallback: string) {
  const message = (result.error ?? "").trim();
  return message || fallback;
}

async function resolveProductImageUrl(input: {
  formData: FormData;
  currentImageUrl?: string;
}) {
  const clearImage = input.formData.get("clearImage") === "on";
  let imageUrl = input.currentImageUrl?.trim() || undefined;
  if (clearImage) {
    imageUrl = undefined;
  }

  const imageFile = input.formData.get("imageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploadResult = await uploadMediaFile(imageFile);
    if (!uploadResult.ok) {
      return { ok: false as const, error: uploadResult.error };
    }
    imageUrl = uploadResult.fileUrl;
  }

  return { ok: true as const, imageUrl };
}

async function addCategoryAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const name = formData.get("name");
  const sortOrder = Number(formData.get("sortOrder"));
  const prepStation = normalizePrepStation(formData.get("prepStation"));
  const profileScope = normalizeProfileScope(formData.get("profileScope"));
  if (typeof name !== "string" || !Number.isFinite(sortOrder)) {
    redirect(await resolveProductsFeedbackPath("error", "Kategori bilgisi geçersiz."));
  }

  const result = await createCategory(name, sortOrder, prepStation, profileScope);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Kategori eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function updateCategoryStationAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  const prepStation = normalizePrepStation(formData.get("prepStation"));
  if (typeof categoryId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Kategori secimi geçersiz."));
  }

  const result = await updateCategoryPrepStation(categoryId, prepStation);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Istasyon güncellenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function reorderCategoriesAction(ids: string[]) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const result = await reorderCategories(ids);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Kategori sirasi güncellenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function deleteCategoryAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Kategori secimi geçersiz."));
  }

  const result = await deleteCategory(categoryId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Kategori silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function addProductAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  const name = formData.get("name");
  const price = Number(formData.get("price"));
  const stockCount = Number(formData.get("stockCount"));
  const description = formData.get("description");
  const profileScope = normalizeProfileScope(formData.get("profileScope"));
  const barcode = normalizeOptionalText(formData.get("barcode"));
  const pluCode = normalizeOptionalText(formData.get("pluCode"));
  const productKind = normalizeProductKind(formData.get("productKind"));
  const unit = normalizeProductUnit(formData.get("unit"));
  const department = normalizeProductDepartment(formData.get("department"));

  if (typeof categoryId !== "string" || typeof name !== "string" || !Number.isFinite(price) || !Number.isFinite(stockCount)) {
    redirect(await resolveProductsFeedbackPath("error", "Ürün bilgileri geçersiz."));
  }

  const imageResult = await resolveProductImageUrl({ formData });
  if (!imageResult.ok) {
    redirect(await resolveProductsFeedbackPath("error", imageResult.error || "Görsel yuklenemedi."));
  }

  const result = await createProduct({
    categoryId,
    name,
    price,
    stockCount,
    profileScope,
    description: typeof description === "string" ? description : undefined,
    imageUrl: imageResult.imageUrl,
    isAvailable: true,
    barcode,
    pluCode,
    productKind,
    unit,
    department,
    cost: Number(formData.get("cost") ?? 0),
  });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Ürün eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function updateProductAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const productId = formData.get("productId");
  const categoryId = formData.get("categoryId");
  const name = formData.get("name");
  const price = Number(formData.get("price"));
  const stockCount = Number(formData.get("stockCount"));
  const description = formData.get("description");
  const currentImageUrl = String(formData.get("currentImageUrl") ?? "");
  const isAvailable = formData.get("isAvailable") === "on";
  const profileScope = normalizeProfileScope(formData.get("profileScope"));
  const barcode = normalizeOptionalText(formData.get("barcode"));
  const pluCode = normalizeOptionalText(formData.get("pluCode"));
  const productKind = normalizeProductKind(formData.get("productKind"));
  const unit = normalizeProductUnit(formData.get("unit"));
  const department = normalizeProductDepartment(formData.get("department"));

  if (
    typeof productId !== "string" ||
    typeof categoryId !== "string" ||
    typeof name !== "string" ||
    !Number.isFinite(price) ||
    !Number.isFinite(stockCount)
  ) {
    redirect(await resolveProductsFeedbackPath("error", "Ürün guncelleme bilgileri geçersiz."));
  }

  const imageResult = await resolveProductImageUrl({ formData, currentImageUrl });
  if (!imageResult.ok) {
    redirect(await resolveProductsFeedbackPath("error", imageResult.error || "Görsel yuklenemedi."));
  }

  const result = await updateProduct({
    productId,
    categoryId,
    name,
    price,
    stockCount,
    profileScope,
    description: typeof description === "string" ? description : undefined,
    imageUrl: imageResult.imageUrl,
    isAvailable,
    barcode,
    pluCode,
    productKind,
    unit,
    department,
    cost: Number(formData.get("cost") ?? 0),
  });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Ürün güncellenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function deleteProductAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const productId = formData.get("productId");
  if (typeof productId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Ürün secimi geçersiz."));
  }

  const result = await deleteProduct(productId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Ürün silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function bulkPriceAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  const percent = Number(formData.get("percent"));
  if (typeof categoryId !== "string" || !Number.isFinite(percent)) {
    redirect(await resolveProductsFeedbackPath("error", "Toplu fiyat bilgileri geçersiz."));
  }

  const result = await bulkUpdateCategoryPrices(categoryId, percent);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Toplu fiyat guncelleme başarısız.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function marketImportDryRunAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const payload = formData.get("importPayload");
  const replaceScope = formData.get("replaceScope") === "on";
  if (typeof payload !== "string" || !payload.trim()) {
    redirect(await resolveProductsFeedbackPath("error", "Import JSON alani bos olamaz."));
  }

  const result = await dryRunEnterpriseMarketImport({
    jsonText: payload,
    replaceScope,
  });
  if (!result.ok) {
    const summary = result.summary
      ? formatDryRunSummary(result.summary)
      : result.error ?? "Dry-run tamamlanamadi.";
    redirect(await resolveProductsFeedbackPath("error", summary));
  }

  redirect(await resolveProductsFeedbackPath("success", formatDryRunSummary(result.summary)));
}

async function marketImportCommitAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const payload = formData.get("importPayload");
  const replaceScope = formData.get("replaceScope") === "on";
  if (typeof payload !== "string" || !payload.trim()) {
    redirect(await resolveProductsFeedbackPath("error", "Import JSON alani bos olamaz."));
  }

  const result = await commitEnterpriseMarketImport({
    jsonText: payload,
    replaceScope,
  });
  if (!result.ok) {
    const summary = result.summary
      ? formatDryRunSummary(result.summary)
      : result.error ?? "Import commit basarisiz.";
    redirect(await resolveProductsFeedbackPath("error", summary));
  }

  redirect(await resolveProductsFeedbackPath("success", `Import tamamlandi. ${formatDryRunSummary(result.summary)}`));
}

async function updateDemoCatalogFallbackAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const { settings: currentSettings } = await getApplicationSettings();
  const hasField =
    formData.has("embeddedDemoCatalogEnabled_present") || formData.has("embeddedDemoCatalogEnabled");
  const nextSettings = {
    ...currentSettings,
    embeddedDemoCatalogEnabled: hasField
      ? formData.get("embeddedDemoCatalogEnabled") === "on"
      : currentSettings.embeddedDemoCatalogEnabled,
  };
  await updateApplicationSettings(nextSettings);
  revalidatePath("/admin/products");
  revalidatePath("/admin/orders");
}

async function seedRestaurantDemoCatalogAction() {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const scope = await getBusinessScopeContext();
  if (scope.activeBusinessType !== "restaurant_cafe") {
    redirect(await resolveProductsFeedbackPath("error", "Bu aksiyon sadece restaurant/cafe profili icin kullanilabilir."));
  }
  if (!scope.businessId) {
    redirect(await resolveProductsFeedbackPath("error", "Aktif isletme bulunamadi."));
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    redirect(await resolveProductsFeedbackPath("error", "Servis baglantisi bulunamadi."));
  }

  let categoryRows:
    | Array<{ id: string; name: string }>
    | null = null;
  let productRows:
    | Array<{ id: string; name: string; category_id: string }>
    | null = null;

  const categoryWithScope = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", scope.businessId)
    .eq("profile_scope", "restaurant");
  if (categoryWithScope.error?.message?.toLowerCase().includes("profile_scope")) {
    const categoryFallback = await supabase
      .from("categories")
      .select("id, name")
      .eq("business_id", scope.businessId);
    if (categoryFallback.error) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: categoryFallback.error.message }, "Kategori listesi okunamadi.")));
    }
    categoryRows = (categoryFallback.data ?? []) as Array<{ id: string; name: string }>;
  } else if (categoryWithScope.error) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: categoryWithScope.error.message }, "Kategori listesi okunamadi.")));
  } else {
    categoryRows = (categoryWithScope.data ?? []) as Array<{ id: string; name: string }>;
  }

  const productWithScope = await supabase
    .from("products")
    .select("id, name, category_id")
    .eq("business_id", scope.businessId)
    .eq("profile_scope", "restaurant");
  if (productWithScope.error?.message?.toLowerCase().includes("profile_scope")) {
    const productFallback = await supabase
      .from("products")
      .select("id, name, category_id")
      .eq("business_id", scope.businessId);
    if (productFallback.error) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: productFallback.error.message }, "Urun listesi okunamadi.")));
    }
    productRows = (productFallback.data ?? []) as Array<{ id: string; name: string; category_id: string }>;
  } else if (productWithScope.error) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: productWithScope.error.message }, "Urun listesi okunamadi.")));
  } else {
    productRows = (productWithScope.data ?? []) as Array<{ id: string; name: string; category_id: string }>;
  }

  const categoryByName = new Map<string, { id: string; name: string }>(
    (categoryRows ?? []).map((row) => [normalizeCatalogName(row.name), row]),
  );

  let createdCategoryCount = 0;
  for (const category of restaurantDemoCatalogSeed.categories) {
    const key = normalizeCatalogName(category.name);
    if (categoryByName.has(key)) {
      continue;
    }
    const created = await createCategory(category.name, category.sortOrder, category.prepStation, "restaurant");
    if (!created.ok && !isDuplicateError(created.error)) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(created, "Hazir kategori yuklenemedi.")));
    }
    if (created.ok) {
      if (created.id) {
        categoryByName.set(key, { id: created.id, name: category.name });
      }
      createdCategoryCount += 1;
    }
  }

  const latestCategories = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", scope.businessId)
    .eq("profile_scope", "restaurant");
  if (!latestCategories.error) {
    for (const row of (latestCategories.data ?? []) as Array<{ id: string; name: string }>) {
      categoryByName.set(normalizeCatalogName(row.name), row);
    }
  }

  const existingProductKeys = new Set(
    (productRows ?? []).map((row) => `${row.category_id}::${normalizeCatalogName(row.name)}`),
  );

  let createdProductCount = 0;
  for (const product of restaurantDemoCatalogSeed.products) {
    const category = categoryByName.get(normalizeCatalogName(product.categoryName));
    if (!category) {
      continue;
    }
    const key = `${category.id}::${normalizeCatalogName(product.name)}`;
    if (existingProductKeys.has(key)) {
      continue;
    }
    const created = await createProduct({
      categoryId: category.id,
      name: product.name,
      price: product.price,
      stockCount: product.stockCount,
      profileScope: "restaurant",
      description: product.description,
      isAvailable: true,
    });
    if (!created.ok && !isDuplicateError(created.error)) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(created, "Hazir urunler yuklenemedi.")));
    }
    if (created.ok) {
      existingProductKeys.add(key);
      createdProductCount += 1;
    }
  }

  let ingredientRows: Array<{ id: string; name: string }> = [];
  const ingredientScoped = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("business_id", scope.businessId);
  if (ingredientScoped.error?.message?.toLowerCase().includes("business_id")) {
    const ingredientFallback = await supabase
      .from("ingredients")
      .select("id, name");
    if (ingredientFallback.error) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: ingredientFallback.error.message }, "Malzeme listesi okunamadi.")));
    }
    ingredientRows = (ingredientFallback.data ?? []) as Array<{ id: string; name: string }>;
  } else if (ingredientScoped.error) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: ingredientScoped.error.message }, "Malzeme listesi okunamadi.")));
  } else {
    ingredientRows = (ingredientScoped.data ?? []) as Array<{ id: string; name: string }>;
  }

  const ingredientByName = new Map<string, { id: string; name: string }>(
    ingredientRows.map((row) => [normalizeCatalogName(row.name), row]),
  );

  let createdIngredientCount = 0;
  for (const ingredient of restaurantDemoIngredientsSeed) {
    const key = normalizeCatalogName(ingredient.name);
    if (ingredientByName.has(key)) {
      continue;
    }
    const created = await createIngredient(ingredient.name, ingredient.unit, ingredient.cost);
    if (!created.ok && !isDuplicateError(created.error)) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(created, "Malzeme seed tamamlanamadi.")));
    }
    if (created.ok && created.id) {
      ingredientByName.set(key, { id: created.id, name: ingredient.name });
      createdIngredientCount += 1;
    }
  }

  const latestIngredientsScoped = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("business_id", scope.businessId);
  if (latestIngredientsScoped.error?.message?.toLowerCase().includes("business_id")) {
    const latestIngredientsFallback = await supabase.from("ingredients").select("id, name");
    if (!latestIngredientsFallback.error) {
      for (const row of (latestIngredientsFallback.data ?? []) as Array<{ id: string; name: string }>) {
        ingredientByName.set(normalizeCatalogName(row.name), row);
      }
    }
  } else if (!latestIngredientsScoped.error) {
    for (const row of (latestIngredientsScoped.data ?? []) as Array<{ id: string; name: string }>) {
      ingredientByName.set(normalizeCatalogName(row.name), row);
    }
  }

  let latestProductRows: Array<{ id: string; name: string; category_id: string }> = [];
  const latestProductsWithScope = await supabase
    .from("products")
    .select("id, name, category_id")
    .eq("business_id", scope.businessId)
    .eq("profile_scope", "restaurant");
  if (latestProductsWithScope.error?.message?.toLowerCase().includes("profile_scope")) {
    const latestProductsFallback = await supabase
      .from("products")
      .select("id, name, category_id")
      .eq("business_id", scope.businessId);
    if (latestProductsFallback.error) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: latestProductsFallback.error.message }, "Reçete icin urun listesi okunamadi.")));
    }
    latestProductRows = (latestProductsFallback.data ?? []) as Array<{ id: string; name: string; category_id: string }>;
  } else if (latestProductsWithScope.error) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: latestProductsWithScope.error.message }, "Reçete icin urun listesi okunamadi.")));
  } else {
    latestProductRows = (latestProductsWithScope.data ?? []) as Array<{ id: string; name: string; category_id: string }>;
  }

  const categoryNameById = new Map<string, string>();
  for (const category of categoryByName.values()) {
    categoryNameById.set(category.id, category.name);
  }
  const targetCategoryNames = new Set(restaurantDemoCatalogSeed.categories.map((item) => normalizeCatalogName(item.name)));
  const targetProducts = latestProductRows.filter((product) => {
    const categoryName = categoryNameById.get(product.category_id);
    return Boolean(categoryName && targetCategoryNames.has(normalizeCatalogName(categoryName)));
  });

  const recipeRowMap = new Map<string, { product_id: string; ingredient_id: string; quantity: number }>();
  let recipeProductCount = 0;
  for (const product of targetProducts) {
    const categoryName = categoryNameById.get(product.category_id);
    if (!categoryName) {
      continue;
    }
    const plan = buildRestaurantDemoRecipe(categoryName, product.name);
    if (plan.lines.length === 0) {
      continue;
    }
    recipeProductCount += 1;
    for (const line of plan.lines) {
      const ingredient = ingredientByName.get(normalizeCatalogName(line.ingredientName));
      if (!ingredient) {
        continue;
      }
      const key = `${product.id}::${ingredient.id}`;
      const current = recipeRowMap.get(key);
      recipeRowMap.set(key, {
        product_id: product.id,
        ingredient_id: ingredient.id,
        quantity: (current?.quantity ?? 0) + line.quantity,
      });
    }
  }

  const recipeRows = [...recipeRowMap.values()];
  let recipeLineCount = 0;
  if (recipeRows.length > 0) {
    const upsertResult = await supabase
      .from("product_ingredients")
      .upsert(recipeRows, { onConflict: "product_id,ingredient_id" });
    if (upsertResult.error) {
      for (const row of recipeRows) {
        const result = await attachIngredientToProduct({
          productId: row.product_id,
          ingredientId: row.ingredient_id,
          quantity: row.quantity,
        });
        if (!result.ok) {
          redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Recete satirlari yazilamadi.")));
        }
      }
      recipeLineCount = recipeRows.length;
    } else {
      recipeLineCount = recipeRows.length;
    }
  }

  redirect(
    await resolveProductsFeedbackPath(
      "success",
      `Hazir restoran katalogu yuklendi. Yeni kategori: ${createdCategoryCount}, yeni urun: ${createdProductCount}, yeni malzeme: ${createdIngredientCount}, recete urunu: ${recipeProductCount}, recete satiri: ${recipeLineCount}.`,
    ),
  );
}

async function addIngredientAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const name = formData.get("name");
  const unit = formData.get("unit");
  if (typeof name !== "string" || typeof unit !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme bilgileri geçersiz."));
  }
  const cost = Number(formData.get("cost") ?? 0);
  const result = await createIngredient(name, unit, cost);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function updateIngredientAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const ingredientId = formData.get("ingredientId");
  const name = formData.get("name");
  const unit = formData.get("unit");
  const cost = Number(formData.get("cost") ?? 0);
  if (typeof ingredientId !== "string" || typeof name !== "string" || typeof unit !== "string" || !Number.isFinite(cost)) {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme guncelleme bilgileri geçersiz."));
  }
  const result = await updateIngredient(ingredientId, name, unit, cost);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme güncellenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function deleteIngredientAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const ingredientId = formData.get("ingredientId");
  if (typeof ingredientId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme secimi geçersiz."));
  }
  const result = await deleteIngredient(ingredientId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function attachIngredientAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const productId = formData.get("productId");
  const ingredientId = formData.get("ingredientId");
  const quantity = Number(formData.get("quantity"));
  if (typeof productId !== "string" || typeof ingredientId !== "string" || !Number.isFinite(quantity) || quantity <= 0) {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme baglama bilgileri geçersiz."));
  }
  const result = await attachIngredientToProduct({ productId, ingredientId, quantity });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme urune baglanamadi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function detachIngredientAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const productId = formData.get("productId");
  const ingredientId = formData.get("ingredientId");
  if (typeof productId !== "string" || typeof ingredientId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme ayirma bilgileri geçersiz."));
  }
  const result = await detachIngredientFromProduct(productId, ingredientId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme urunden ayrilamadi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function copyRecipeAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const targetProductId = formData.get("targetProductId");
  const sourceProductId = formData.get("sourceProductId");
  if (typeof targetProductId !== "string" || typeof sourceProductId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Recete kopyalama bilgileri gecersiz."));
  }
  if (targetProductId === sourceProductId) {
    redirect(await resolveProductsFeedbackPath("error", "Kaynak ve hedef urun ayni olamaz."));
  }

  const data = await getProductManagementData({ tab: "catalog" });
  const sourceRows = data.productIngredients.filter((row) => row.product_id === sourceProductId);
  if (sourceRows.length === 0) {
    redirect(await resolveProductsFeedbackPath("error", "Kaynak urunde kopyalanacak recete bulunamadi."));
  }

  for (const row of sourceRows) {
    const result = await attachIngredientToProduct({
      productId: targetProductId,
      ingredientId: row.ingredient_id,
      quantity: row.quantity,
    });
    if (!result.ok) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Recete kopyalanamadi.")));
    }
  }

  redirect(await resolveProductsFeedbackPath("success", "Recete hedef urune kopyalandi."));
}

async function addModifierGroupAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const productId = formData.get("productId");
  const name = formData.get("name");
  const minSelect = Number(formData.get("minSelect"));
  const maxSelect = Number(formData.get("maxSelect"));
  const isRequired = formData.get("isRequired") === "on";
  if (typeof productId !== "string" || typeof name !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Modifier grup bilgileri geçersiz."));
  }
  const result = await createProductModifierGroup({ productId, name, minSelect, maxSelect, isRequired });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Modifier grubu eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function addModifierOptionAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const groupId = formData.get("groupId");
  const name = formData.get("name");
  const priceDelta = Number(formData.get("priceDelta"));
  const isDefault = formData.get("isDefault") === "on";
  if (typeof groupId !== "string" || typeof name !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Modifier opsiyon bilgileri geçersiz."));
  }
  const result = await createProductModifierOption({ groupId, name, priceDelta, isDefault });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Modifier opsiyonu eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function deleteModifierGroupAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const groupId = formData.get("groupId");
  if (typeof groupId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Modifier grubu secimi geçersiz."));
  }
  const result = await deleteProductModifierGroup(groupId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Modifier grubu silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

async function deleteModifierOptionAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const optionId = formData.get("optionId");
  if (typeof optionId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Modifier opsiyonu secimi geçersiz."));
  }
  const result = await deleteProductModifierOption(optionId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Modifier opsiyonu silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

function prepStationLabel(station?: string | null) {
  if (station === "bar") return "Bar";
  if (station === "dessert") return "Tatli";
  return "Mutfak";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    categoryId?: string;
    productId?: string;
    q?: string;
    feedback?: string;
    tone?: "success" | "error";
  }>;
}) {
  const locale = await getCurrentLocale();
  await requireRole(["admin"], "/admin/products");
  const businessScope = await getBusinessScopeContext();
  const isSelfServiceCoffee = businessScope.activeBusinessType === "self_service_coffee";
  const { tab: tabParam, categoryId: categoryIdParam, productId: productIdParam, q: qParam, feedback, tone } = await searchParams;
  const allowedTabs: string[] = isSelfServiceCoffee
    ? ["catalog", "menu", "categories"]
    : ["catalog", "menu", "categories", "bulk", "features", "import", "recipe", "ingredients"];
  const activeTab = (allowedTabs.includes(tabParam ?? "") ? (tabParam ?? "catalog") : "catalog") as
    | "catalog"
    | "menu"
    | "categories"
    | "bulk"
    | "features"
    | "import"
    | "recipe"
    | "ingredients";
  const { settings: applicationSettings } = await getApplicationSettings();
  const dataTab = activeTab === "ingredients" ? "recipe" : activeTab;
  const productManagementResult = await measureAsync("product_management", () => getProductManagementData({ tab: dataTab }));
  const {
    categories,
    products,
    ingredients,
    modifierGroups,
    modifierOptions,
    productIngredients,
    usingDemoData,
    activeProfileScope,
  } =
    productManagementResult.value;
  logServerPerf("/admin/products", [productManagementResult]);
  const isMarketScope = activeProfileScope === "enterprise_market";

  const orderedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const productCountMap = new Map<string, number>();
  for (const product of products) {
    productCountMap.set(product.category_id, (productCountMap.get(product.category_id) ?? 0) + 1);
  }

  const ingredientsByProduct = new Map<
    string,
    Array<{ ingredient_id: string; quantity: number; ingredientName: string; unit: string }>
  >();
  for (const row of productIngredients) {
    if (!row.ingredient) continue;
    if (!ingredientsByProduct.has(row.product_id)) {
      ingredientsByProduct.set(row.product_id, []);
    }
    ingredientsByProduct.get(row.product_id)?.push({
      ingredient_id: row.ingredient_id,
      quantity: row.quantity,
      ingredientName: row.ingredient.name,
      unit: row.ingredient.unit,
    });
  }

  const groupsByProduct = new Map<string, typeof modifierGroups>();
  for (const group of modifierGroups) {
    if (!groupsByProduct.has(group.product_id)) {
      groupsByProduct.set(group.product_id, []);
    }
    groupsByProduct.get(group.product_id)?.push(group);
  }

  const optionsByGroup = new Map<string, typeof modifierOptions>();
  for (const option of modifierOptions) {
    if (!optionsByGroup.has(option.group_id)) {
      optionsByGroup.set(option.group_id, []);
    }
    optionsByGroup.get(option.group_id)?.push(option);
  }

  const firstCategoryId = orderedCategories[0]?.id ?? "";
  const selectedCategoryId = orderedCategories.some((category) => category.id === categoryIdParam) ? categoryIdParam ?? firstCategoryId : firstCategoryId;
  const selectedCategory = orderedCategories.find((category) => category.id === selectedCategoryId) ?? orderedCategories[0];
  const visibleProducts = products.filter((product) => product.category_id === selectedCategoryId);
  const availableProducts = products.filter((product) => product.is_available).length;
  const lowStockProducts = products.filter((product) => product.stock_count <= 10).length;
  const recipeQuery = (qParam ?? "").trim();
  const normalizedRecipeQuery = recipeQuery.toLocaleLowerCase("tr-TR");
  const recipeProducts = [...products]
    .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"))
    .filter((product) =>
      normalizedRecipeQuery
        ? product.name.toLocaleLowerCase("tr-TR").includes(normalizedRecipeQuery)
        : true,
    );
  const selectedRecipeProductId = recipeProducts.some((product) => product.id === productIdParam)
    ? productIdParam ?? recipeProducts[0]?.id ?? ""
    : recipeProducts[0]?.id ?? "";
  const selectedRecipeProduct = products.find((product) => product.id === selectedRecipeProductId) ?? null;
  const selectedRecipeRows = selectedRecipeProduct
    ? (ingredientsByProduct.get(selectedRecipeProduct.id) ?? [])
    : [];
  const selectedRecipeTotalCost = selectedRecipeRows.reduce(
    (sum, item) => sum + item.quantity * (ingredients.find((ingredient) => ingredient.id === item.ingredient_id)?.cost ?? 0),
    0,
  );
  const selectedRecipeOverheadCost = Number(selectedRecipeProduct?.cost ?? 0);
  const selectedRecipeTotalUnitCost = selectedRecipeTotalCost + selectedRecipeOverheadCost;
  const selectedRecipePrice = Number(selectedRecipeProduct?.price ?? 0);
  const selectedRecipeProfit = selectedRecipePrice - selectedRecipeTotalUnitCost;
  const selectedRecipeMargin = selectedRecipePrice > 0 ? (selectedRecipeProfit / selectedRecipePrice) * 100 : 0;
  const sourceRecipeCandidates = recipeProducts.filter((product) => product.id !== selectedRecipeProductId);

  function buildRecipeHref(productId: string) {
    const params = new URLSearchParams();
    params.set("tab", "recipe");
    params.set("productId", productId);
    if (recipeQuery) {
      params.set("q", recipeQuery);
    }
    return `/admin/products?${params.toString()}`;
  }

  return (
    <BackofficePage
      title={isSelfServiceCoffee ? "Self Servis Urun Yonetimi" : translateUiText("Ürün ve Kategori Yönetimi", locale)}
      description={isSelfServiceCoffee ? "Self servis menusu ve urun fiyatlarini yonet." : translateUiText("Katalog, modifier, recete ve stok temel ayarlari", locale)}
      actions={
        <form action={addProductAction} className="flex flex-wrap items-stretch gap-3">
          <input type="hidden" name="profileScope" value={activeProfileScope} />
          <select name="categoryId" required defaultValue={selectedCategoryId} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:w-auto">
            {orderedCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input name="name" required placeholder={translateUiText("Yeni Ürün", locale)} className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-1" />
          <input name="price" type="number" min="0" step="0.01" required placeholder="Fiyat" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-28" />
          <input name="stockCount" type="number" min="0" required placeholder="Stok" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-28" />
          {isMarketScope ? (
            <>
              <input name="barcode" placeholder="Barkod" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-36" />
              <input name="pluCode" placeholder="PLU" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-32" />
              <select name="productKind" defaultValue="standard" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-36">
                <option value="standard">Standart</option>
                <option value="weighted">Tartili</option>
                <option value="service">Servis</option>
              </select>
              <select name="unit" defaultValue="adet" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-32">
                <option value="adet">Adet</option>
                <option value="kg">Kg</option>
                <option value="gram">Gram</option>
                <option value="litre">Litre</option>
                <option value="ml">Ml</option>
                <option value="paket">Paket</option>
              </select>
              <select name="department" defaultValue="general" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-40">
                <option value="general">Genel</option>
                <option value="butcher">Kasap</option>
                <option value="delicatessen">Sarkuteri</option>
                <option value="bakery">Firin</option>
                <option value="produce">Manav</option>
                <option value="beverage">Icecek</option>
                <option value="frozen">Donuk</option>
                <option value="non_food">Gida Disi</option>
              </select>
            </>
          ) : null}
          <FileDropInput
            name="imageFile"
            label="Ürün gorseli"
            helper="Masaüstünden sürükle bırak ile ekleyebilirsin."
            className="w-full sm:min-w-[280px] sm:flex-1"
          />
          <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white sm:w-auto">
            {translateUiText("Yeni Ürün", locale)}
          </button>
        </form>
      }
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
        <WorkspaceTabs
          tabs={
            isSelfServiceCoffee
              ? [
                  { label: "Self Servis Katalog", active: activeTab === "catalog", href: "/admin/products?tab=catalog" },
                  { label: "Self Servis Menu", active: activeTab === "menu", href: "/admin/products?tab=menu" },
                  { label: "Kategoriler", active: activeTab === "categories", href: "/admin/products?tab=categories" },
                ]
              : [
                  { label: translateUiText("Ürün & Kategori Yönetimi", locale), active: activeTab === "catalog", href: "/admin/products?tab=catalog" },
                  { label: translateUiText("Menü Yönetimi", locale), active: activeTab === "menu", href: "/admin/products?tab=menu" },
                  { label: "Ana Kategoriler", active: activeTab === "categories", href: "/admin/products?tab=categories" },
                  { label: "Toplu Islemler", active: activeTab === "bulk", href: "/admin/products?tab=bulk" },
                  { label: "Recipe Studio", active: activeTab === "recipe", href: "/admin/products?tab=recipe" },
                  { label: "Malzeme Kutuphanesi", active: activeTab === "ingredients", href: "/admin/products?tab=ingredients" },
                  { label: "Market Import", active: activeTab === "import", href: "/admin/products?tab=import" },
                  { label: "Ürün Ozellikleri", active: activeTab === "features", href: "/admin/products?tab=features" },
                ]
          }
        />

        <form action={updateDemoCatalogFallbackAction} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Demo menuyu otomatik kullan</p>
              <p className="mt-1 text-xs text-slate-500">
                Aciksa urun/kategori bosken gomulu demo katalog otomatik devreye girer.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                name="embeddedDemoCatalogEnabled"
                defaultChecked={applicationSettings.embeddedDemoCatalogEnabled}
                className="peer sr-only"
              />
              <span className="h-8 w-14 rounded-full bg-slate-300 transition peer-checked:bg-[#ff6a3d]" />
              <span className="absolute left-1 h-6 w-6 rounded-full bg-white shadow transition peer-checked:translate-x-6" />
            </label>
          </div>
          <input type="hidden" name="embeddedDemoCatalogEnabled_present" value="1" />
          <div className="mt-3 flex justify-end">
            <button type="submit" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
              Kaydet
            </button>
          </div>
        </form>

        {!isSelfServiceCoffee ? (
          <form action={seedRestaurantDemoCatalogAction} className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Hazir restoran katalogu yukle</p>
                <p className="mt-1 text-xs text-slate-500">
                  Kahve, soguk icecek, firindan, tatli ve atistirmalik urunleri aktif isletmeye ekler.
                </p>
              </div>
              <button type="submit" className="rounded-xl bg-[#ff6a3d] px-4 py-2 text-xs font-semibold text-white">
                Hazir katalogu yukle
              </button>
            </div>
          </form>
        ) : null}

        {usingDemoData ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {translateUiText("Demo veride kalici ürün ve kategori aksiyonlari sinirlidir.", locale)}
          </div>
        ) : null}
        {feedback ? (
          <div className="mt-4">
            <NoticeBanner
              tone={tone === "error" ? "error" : "success"}
              title={tone === "error" ? "İşlem tamamlanamadi" : "İşlem tamamlandı"}
              description={feedback}
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label={translateUiText("Kategori", locale)} value={String(orderedCategories.length)} hint={translateUiText("Toplam ana kategori", locale)} tone="accent" />
          <SummaryCard label={translateUiText("Ürün", locale)} value={String(products.length)} hint={translateUiText("Tüm kayitli ürünler", locale)} />
          <SummaryCard label={translateUiText("Satista", locale)} value={String(availableProducts)} hint={translateUiText("Aktif ve gorunen ürünler", locale)} tone="success" />
          <SummaryCard label={translateUiText("Kritik Stok", locale)} value={String(lowStockProducts)} hint={translateUiText("10 ve alti stoklu ürün", locale)} tone={lowStockProducts > 0 ? "danger" : "neutral"} />
        </div>

        {activeTab === "catalog" ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[320px_1fr]">
          <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Kategoriler</h2>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">
                {orderedCategories.length}
              </span>
            </div>

            <form action={addCategoryAction} className="mt-4 grid gap-3">
              <input type="hidden" name="profileScope" value={activeProfileScope} />
              <input name="name" required placeholder="Yeni kategori" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              {isSelfServiceCoffee ? (
                <input type="hidden" name="prepStation" value="bar" />
              ) : (
                <select name="prepStation" defaultValue="kitchen" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="kitchen">Mutfak Istasyonu</option>
                  <option value="bar">Bar Istasyonu</option>
                  <option value="dessert">Tatli Istasyonu</option>
                </select>
              )}
              <input
                name="sortOrder"
                type="number"
                defaultValue={orderedCategories.length + 1}
                required
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              <button type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
                Yeni Kategori
              </button>
            </form>

            <div className="mt-4">
              <CategorySortManager
                categories={orderedCategories.map((category) => ({
                  ...category,
                  productCount: productCountMap.get(category.id) ?? 0,
                }))}
                onReorder={reorderCategoriesAction}
                onDelete={deleteCategoryAction}
                onStationUpdate={updateCategoryStationAction}
              />
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Urunler</h2>
                  <p className="text-sm text-slate-500">Secili kategori: {selectedCategory?.name ?? "Kategori yok"}</p>
                </div>
                <form action={bulkPriceAction} className="flex w-full flex-wrap items-stretch gap-3 lg:w-auto">
                  <select name="categoryId" required defaultValue={selectedCategoryId} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm sm:w-auto">
                    {orderedCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <input name="percent" type="number" step="0.1" placeholder="Yuzde" required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm sm:w-28" />
                  <button type="submit" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 sm:w-auto">
                    Toplu Güncelle
                  </button>
                </form>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {orderedCategories.map((category) => {
                  const isActive = category.id === selectedCategoryId;
                  return (
                    <Link
                      key={category.id}
                      href={`/admin/products?tab=catalog&categoryId=${category.id}`}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] text-white shadow-[0_10px_20px_rgba(255,111,60,0.24)]"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {category.name} ({productCountMap.get(category.id) ?? 0})
                    </Link>
                  );
                })}
              </div>

              {visibleProducts.length > 0 && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(() => {
                    const stats = visibleProducts.reduce((acc, p) => {
                      const recipeCost = (ingredientsByProduct.get(p.id) ?? []).reduce(
                        (sum, item) => sum + (item.quantity * (ingredients.find(i => i.id === item.ingredient_id)?.cost ?? 0)),
                        0
                      );
                      const totalCost = Number(p.cost ?? 0) + recipeCost;
                      const profit = Number(p.price) - totalCost;
                      const margin = Number(p.price) > 0 ? (profit / Number(p.price)) * 100 : 0;
                      
                      acc.totalProfit += profit;
                      acc.totalRevenue += Number(p.price);
                      acc.avgMarginSum += margin;
                      if (profit < 0) acc.lossCount++;
                      if (margin < 15 && profit >= 0) acc.warningCount++;
                      return acc;
                    }, { totalProfit: 0, totalRevenue: 0, avgMarginSum: 0, lossCount: 0, warningCount: 0 });

                    const avgMargin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;

                    return (
                      <>
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ort. Kâr Marjı</p>
                          <p className={`mt-2 text-2xl font-bold ${avgMargin > 30 ? 'text-emerald-600' : avgMargin > 15 ? 'text-amber-600' : 'text-rose-600'}`}>
                            %{avgMargin.toFixed(1)}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Potansiyel Kâr</p>
                          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.totalProfit.toFixed(2)} TL</p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kritik Ürünler</p>
                          <p className={`mt-2 text-2xl font-bold ${stats.lossCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{stats.lossCount} Zarar</p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Düşük Marj</p>
                          <p className={`mt-2 text-2xl font-bold ${stats.warningCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{stats.warningCount} İncele</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {visibleProducts.length === 0 ? (
                <div className="mt-4">
                  <EmptyPanel title="Ürün Yok" description="Secili kategori için ürün kaydı bulunmuyor." />
                </div>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {visibleProducts.map((product) => (
                    <article key={product.id} className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4">
                      <details>
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                {orderedCategories.find((category) => category.id === product.category_id)?.name ?? "Kategori"}
                              </p>
                              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{product.name}</h3>
                              <p className="mt-2 line-clamp-1 text-sm text-slate-500">{product.description ?? "Aciklama girilmedi."}</p>
                              
                              {(() => {
                                const recipeCost = (ingredientsByProduct.get(product.id) ?? []).reduce(
                                  (sum, item) => sum + (item.quantity * (ingredients.find(i => i.id === item.ingredient_id)?.cost ?? 0)),
                                  0
                                );
                                const totalCost = Number(product.cost ?? 0) + recipeCost;
                                const totalRevenue = Number(product.price);
                                const profit = totalRevenue - totalCost;
                                const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
                                
                                const isCritical = profit < 0;
                                const isWarning = margin < 15 && profit >= 0;
                                
                                return (
                                  <div className="mt-4 space-y-3">
                                    <div className="flex items-end justify-between gap-4">
                                       <div className="flex flex-col">
                                         <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Satış Fiyatı</span>
                                         <span className="text-lg font-bold text-slate-900">{totalRevenue.toFixed(2)} TL</span>
                                       </div>
                                       <div className="flex flex-col text-right">
                                         <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tahmini Kâr</span>
                                         <span className={`text-lg font-bold ${isCritical ? 'text-rose-600' : 'text-emerald-600'}`}>
                                           {profit.toFixed(2)} TL
                                         </span>
                                       </div>
                                    </div>
                                    
                                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                      <div 
                                        className={`absolute left-0 top-0 h-full transition-all duration-500 ${isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.max(0, Math.min(100, margin))}%` }}
                                      />
                                    </div>
                                    
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                                       <span className="text-slate-500">Maliyet: %{(100 - margin).toFixed(0)}</span>
                                       <span className={isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'}>
                                         Marj: %{margin.toFixed(0)}
                                       </span>
                                    </div>

                                    {isCritical && (
                                      <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2 text-[10px] font-bold text-rose-700">
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-200">!</span>
                                        ZARAR EDİSİYOR: Fiyatı veya reçeteyi gözden geçirin.
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold sm:w-auto ${product.is_available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {product.is_available ? "Aktif" : "Pasif"}
                            </span>
                          </div>
                        </summary>

                        <div className="mt-4">
                          <form action={deleteProductAction} className="mb-4 w-full sm:w-auto">
                            <input type="hidden" name="productId" value={product.id} />
                            <button type="submit" className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 sm:w-auto">
                              Sil
                            </button>
                          </form>

                          <form action={updateProductAction} className="space-y-3">
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="profileScope" value={activeProfileScope} />
                            <input type="hidden" name="currentImageUrl" value={product.image_url ?? ""} />
                            <select name="categoryId" defaultValue={product.category_id} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                              {orderedCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                            <input name="name" defaultValue={product.name} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                            <div className="grid gap-3 md:grid-cols-2">
                              <input name="price" type="number" step="0.01" min="0" defaultValue={product.price} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                              <input name="stockCount" type="number" min="0" defaultValue={product.stock_count} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                              <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Doğrudan Ek Maliyet / Overhead</label>
                                <input name="cost" type="number" step="0.01" min="0" defaultValue={product.cost ?? 0} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                              </div>
                            </div>
                            {isMarketScope ? (
                              <div className="grid gap-3 md:grid-cols-2">
                                <input name="barcode" defaultValue={product.barcode ?? ""} placeholder="Barkod" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                                <input name="pluCode" defaultValue={product.plu_code ?? ""} placeholder="PLU" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                                <select name="productKind" defaultValue={product.product_kind ?? "standard"} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                                  <option value="standard">Standart</option>
                                  <option value="weighted">Tartili</option>
                                  <option value="service">Servis</option>
                                </select>
                                <select name="unit" defaultValue={product.unit ?? "adet"} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                                  <option value="adet">Adet</option>
                                  <option value="kg">Kg</option>
                                  <option value="gram">Gram</option>
                                  <option value="litre">Litre</option>
                                  <option value="ml">Ml</option>
                                  <option value="paket">Paket</option>
                                </select>
                                <select name="department" defaultValue={product.department ?? "general"} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm md:col-span-2">
                                  <option value="general">Genel</option>
                                  <option value="butcher">Kasap</option>
                                  <option value="delicatessen">Sarkuteri</option>
                                  <option value="bakery">Firin</option>
                                  <option value="produce">Manav</option>
                                  <option value="beverage">Icecek</option>
                                  <option value="frozen">Donuk</option>
                                  <option value="non_food">Gida Disi</option>
                                </select>
                              </div>
                            ) : null}
                            <FileDropInput
                              name="imageFile"
                              label="Ürün gorseli"
                              helper={product.image_url ? "Yeni dosya birakirsan mevcut gorselin uzerine yazilir." : "Masaüstünden sürükle bırak ile görsel ekle."}
                            />
                            {product.image_url ? (
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input name="clearImage" type="checkbox" />
                                Mevcut gorseli kaldir
                              </label>
                            ) : null}
                            <textarea name="description" rows={2} defaultValue={product.description ?? ""} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input name="isAvailable" type="checkbox" defaultChecked={product.is_available} />
                              Satisa açık
                            </label>
                            <button type="submit" className="w-full rounded-2xl bg-[#ff5a34] px-4 py-3 text-sm font-semibold text-white sm:w-auto">
                              Kaydet
                            </button>
                          </form>

                          <div className="mt-4 space-y-3 rounded-[20px] bg-slate-50 p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ürün Reçete Detayı</h4>
                            
                            <div className="mt-2 divide-y divide-slate-200">
                              {(ingredientsByProduct.get(product.id) ?? []).length === 0 ? (
                                <p className="py-4 text-center text-sm text-slate-500">Bu ürünün henüz bir reçetesi yok.</p>
                              ) : (
                                (ingredientsByProduct.get(product.id) ?? []).map((item) => {
                                  const ingredientDetail = ingredients.find(i => i.id === item.ingredient_id);
                                  const itemCost = (ingredientDetail?.cost ?? 0) * item.quantity;
                                  
                                  return (
                                    <div key={`${product.id}-${item.ingredient_id}`} className="grid grid-cols-[1fr_80px_100px_40px] items-center gap-3 py-3 text-sm">
                                      <div className="flex flex-col">
                                        <span className="font-semibold text-slate-900">{item.ingredientName}</span>
                                        <span className="text-[10px] text-slate-500">Birim: {ingredientDetail?.cost.toFixed(2)} TL/{item.unit}</span>
                                      </div>
                                      <div className="text-right text-slate-600">
                                        {item.quantity} {item.unit}
                                      </div>
                                      <div className="text-right font-bold text-slate-900">
                                        {itemCost.toFixed(2)} TL
                                      </div>
                                      <form action={detachIngredientAction} className="flex justify-end">
                                        <input type="hidden" name="productId" value={product.id} />
                                        <input type="hidden" name="ingredientId" value={item.ingredient_id} />
                                        <button type="submit" className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100">
                                          &times;
                                        </button>
                                      </form>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {(ingredientsByProduct.get(product.id) ?? []).length > 0 && (
                              <div className="mt-2 border-t border-slate-200 pt-3">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                                  <span>Toplam Reçete Maliyeti</span>
                                  <span className="text-slate-900">
                                    {(ingredientsByProduct.get(product.id) ?? []).reduce(
                                      (sum, item) => sum + (item.quantity * (ingredients.find(i => i.id === item.ingredient_id)?.cost ?? 0)),
                                      0
                                    ).toFixed(2)} TL
                                  </span>
                                </div>
                              </div>
                            )}
                            <form action={attachIngredientAction} className="grid gap-2">
                              <input type="hidden" name="productId" value={product.id} />
                              <select name="ingredientId" required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                                <option value="">Malzeme sec</option>
                                {ingredients.map((ingredient) => (
                                  <option key={ingredient.id} value={ingredient.id}>
                                    {ingredient.name} ({ingredient.unit})
                                  </option>
                                ))}
                              </select>
                              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                <input name="quantity" type="number" min="0.01" step="0.01" required placeholder="Miktar" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                                  Ekle
                                </button>
                              </div>
                            </form>
                          </div>

                          <div className="mt-4 space-y-3 rounded-[20px] bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-slate-900">Modifier Gruplari</p>
                            {(groupsByProduct.get(product.id) ?? []).map((group) => (
                              <div key={group.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900">{group.name}</p>
                                    <p className="text-xs text-slate-500">
                                      min {group.min_select} / max {group.max_select} {group.is_required ? "- zorunlu" : ""}
                                    </p>
                                  </div>
                                  <form action={deleteModifierGroupAction} className="w-full sm:w-auto">
                                    <input type="hidden" name="groupId" value={group.id} />
                                    <button type="submit" className="w-full text-left text-xs font-semibold text-rose-700 sm:w-auto sm:text-right">
                                      Sil
                                    </button>
                                  </form>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {(optionsByGroup.get(group.id) ?? []).map((option) => (
                                    <div key={option.id} className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center">
                                      <span className="min-w-0 break-words">
                                        {option.name} {Number(option.price_delta) > 0 ? `(+${Number(option.price_delta).toFixed(2)} TL)` : ""}
                                      </span>
                                      <form action={deleteModifierOptionAction} className="w-full sm:w-auto">
                                        <input type="hidden" name="optionId" value={option.id} />
                                        <button type="submit" className="w-full text-left text-xs font-semibold text-rose-700 sm:w-auto sm:text-right">
                                          Sil
                                        </button>
                                      </form>
                                    </div>
                                  ))}
                                </div>
                                <form action={addModifierOptionAction} className="mt-3 grid gap-2">
                                  <input type="hidden" name="groupId" value={group.id} />
                                  <input name="name" required placeholder="Opsiyon adi" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                    <input name="priceDelta" type="number" step="0.01" defaultValue={0} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                                      <input name="isDefault" type="checkbox" />
                                      Varsayilan
                                    </label>
                                  </div>
                                  <button type="submit" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 sm:w-auto">
                                    Opsiyon Ekle
                                  </button>
                                </form>
                              </div>
                            ))}
                            <form action={addModifierGroupAction} className="grid gap-2">
                              <input type="hidden" name="productId" value={product.id} />
                              <input name="name" required placeholder="Yeni grup" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                              <div className="grid gap-2 md:grid-cols-3">
                                <input name="minSelect" type="number" min="0" defaultValue={0} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                <input name="maxSelect" type="number" min="1" defaultValue={1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                                  <input name="isRequired" type="checkbox" />
                                  Zorunlu
                                </label>
                              </div>
                              <button type="submit" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 sm:w-auto">
                                Grup Ekle
                              </button>
                            </form>
                          </div>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-1">
              <ContentCard title="Katalog Durumu">
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Toplam kategori</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{orderedCategories.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Toplam ürün</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{products.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Modifier gruplari</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{modifierGroups.length}</p>
                  </div>
                </div>
              </ContentCard>
            </div>
          </section>
        </div>
        ) : null}

        {activeTab === "menu" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[320px_1fr]">
            <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Menü Kategorileri</h2>
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">
                  {orderedCategories.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {orderedCategories.map((category) => (
                  <div key={category.id} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-lg font-semibold text-slate-900">{category.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{productCountMap.get(category.id) ?? 0} menü urunu</p>
                    {!isSelfServiceCoffee ? (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{prepStationLabel(category.prep_station)} Istasyonu</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Menü Akışı</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {orderedCategories.map((category) => {
                  const isActive = category.id === selectedCategoryId;
                  return (
                    <Link
                      key={category.id}
                      href={`/admin/products?tab=menu&categoryId=${category.id}`}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isActive ? "bg-[#ff5a34] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {category.name}
                    </Link>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <article key={product.id} className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                          Görsel Yok
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          {orderedCategories.find((category) => category.id === product.category_id)?.name ?? "Kategori"}
                        </p>
                        <p className="mt-1 text-xl font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{product.description ?? "Aciklama girilmedi."}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col items-start justify-between gap-3 text-sm sm:flex-row sm:items-center">
                      <span className="font-semibold text-slate-900">{Number(product.price).toFixed(2)} TL</span>
                      <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold sm:w-auto ${product.is_available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {product.is_available ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                    <form action={updateProductAction} className="mt-4 grid gap-2">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="profileScope" value={activeProfileScope} />
                      <input type="hidden" name="categoryId" value={product.category_id} />
                      <input type="hidden" name="name" value={product.name} />
                      <input type="hidden" name="price" value={String(product.price)} />
                      <input type="hidden" name="stockCount" value={String(product.stock_count)} />
                      <input type="hidden" name="barcode" value={product.barcode ?? ""} />
                      <input type="hidden" name="pluCode" value={product.plu_code ?? ""} />
                      <input type="hidden" name="productKind" value={product.product_kind ?? "standard"} />
                      <input type="hidden" name="unit" value={product.unit ?? "adet"} />
                      <input type="hidden" name="department" value={product.department ?? "general"} />
                      <input type="hidden" name="description" value={product.description ?? ""} />
                      <input type="hidden" name="currentImageUrl" value={product.image_url ?? ""} />
                      <input type="hidden" name="isAvailable" value={product.is_available ? "on" : "off"} />
                      <FileDropInput name="imageFile" label="Ürün gorseli" helper="Dosyayi surukleyip bırak veya sec." />
                      {product.image_url ? (
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input name="clearImage" type="checkbox" />
                          Mevcut gorseli kaldir
                        </label>
                      ) : null}
                      <button type="submit" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                        Gorseli Kaydet
                      </button>
                    </form>
                  </article>
                ))}
              </div>
              {visibleProducts.length === 0 ? (
                <div className="mt-4">
                  <EmptyPanel title="Menü urunu yok" description="Secilen kategori altinda gosterilecek ürün bulunmuyor." />
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {activeTab === "categories" ? (
          <div className="mt-6">
            <ContentCard title="Ana Kategori Yönetimi">
              <CategorySortManager
                categories={orderedCategories.map((category) => ({
                  ...category,
                  productCount: productCountMap.get(category.id) ?? 0,
                }))}
                onReorder={reorderCategoriesAction}
                onDelete={deleteCategoryAction}
                onStationUpdate={updateCategoryStationAction}
              />
            </ContentCard>
          </div>
        ) : null}

        {activeTab === "bulk" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[420px_1fr]">
            <ContentCard title="Toplu Islemler">
              <form action={bulkPriceAction} className="grid gap-3">
                <select name="categoryId" required defaultValue={selectedCategoryId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  {orderedCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <input name="percent" type="number" step="0.1" required placeholder="Yuzde degisim" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                <button type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">Toplu Fiyat Güncelle</button>
              </form>
            </ContentCard>
            <ContentCard title="Stok ve Fiyat Listesi">
              <div className="responsive-table-shell rounded-[22px] border border-slate-200">
                <table className="responsive-table w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Ürün</th>
                      <th className="px-4 py-4 font-semibold">Kategori</th>
                      <th className="px-4 py-4 font-semibold">Stok</th>
                      <th className="px-4 py-4 font-semibold">Fiyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-t border-slate-100">
                        <td className="px-4 py-4 font-semibold text-slate-900">{product.name}</td>
                        <td className="px-4 py-4 text-slate-700">{orderedCategories.find((category) => category.id === product.category_id)?.name ?? "-"}</td>
                        <td className="px-4 py-4 text-slate-700">{product.stock_count}</td>
                        <td className="px-4 py-4 text-slate-700">{Number(product.price).toFixed(2)} TL</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContentCard>
          </div>
        ) : null}

        {activeTab === "recipe" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <ContentCard title="Urun Secimi">
              <form method="get" className="mb-4 grid gap-2">
                <input type="hidden" name="tab" value="recipe" />
                <input
                  name="q"
                  defaultValue={recipeQuery}
                  placeholder="Urun ara..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                />
                <button type="submit" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  Filtrele
                </button>
              </form>
              <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                {recipeProducts.map((product) => {
                  const recipeCost = (ingredientsByProduct.get(product.id) ?? []).reduce(
                    (sum, item) => sum + item.quantity * (ingredients.find((ingredient) => ingredient.id === item.ingredient_id)?.cost ?? 0),
                    0,
                  );
                  const totalUnitCost = Number(product.cost ?? 0) + recipeCost;
                  const margin = Number(product.price) > 0 ? ((Number(product.price) - totalUnitCost) / Number(product.price)) * 100 : 0;
                  const isActive = product.id === selectedRecipeProductId;
                  return (
                    <Link
                      key={product.id}
                      href={buildRecipeHref(product.id)}
                      className={`block rounded-2xl border px-3 py-3 transition ${
                        isActive
                          ? "border-[#ff5a34] bg-[#fff2ee]"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Fiyat: {Number(product.price).toFixed(2)} TL</span>
                        <span className={margin < 15 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
                          %{margin.toFixed(0)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </ContentCard>

            <ContentCard title="Recete Editoru">
              {!selectedRecipeProduct ? (
                <EmptyPanel title="Urun secilmedi" description="Soldaki listeden bir urun secerek recete duzenlemeye baslayin." />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-lg font-semibold text-slate-900">{selectedRecipeProduct.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {orderedCategories.find((category) => category.id === selectedRecipeProduct.category_id)?.name ?? "Kategori"}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fiyat</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedRecipePrice.toFixed(2)} TL</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recete</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedRecipeTotalCost.toFixed(2)} TL</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Toplam Maliyet</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedRecipeTotalUnitCost.toFixed(2)} TL</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Marj</p>
                        <p className={`mt-1 text-sm font-semibold ${selectedRecipeMargin < 15 ? "text-amber-700" : "text-emerald-700"}`}>
                          %{selectedRecipeMargin.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Recete Kalemleri</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedRecipeRows.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-slate-500">Bu urunun henuz recetesi yok.</p>
                      ) : (
                        selectedRecipeRows.map((item) => {
                          const ingredientDetail = ingredients.find((ingredient) => ingredient.id === item.ingredient_id);
                          const ingredientUnitCost = Number(ingredientDetail?.cost ?? 0);
                          return (
                            <form key={`${selectedRecipeProduct.id}-${item.ingredient_id}`} action={attachIngredientAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_120px_110px_auto_auto] sm:items-center">
                              <input type="hidden" name="productId" value={selectedRecipeProduct.id} />
                              <input type="hidden" name="ingredientId" value={item.ingredient_id} />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.ingredientName}</p>
                                <p className="text-xs text-slate-500">{ingredientUnitCost.toFixed(2)} TL / {item.unit}</p>
                              </div>
                              <input
                                name="quantity"
                                type="number"
                                min="0.01"
                                step="0.01"
                                defaultValue={item.quantity}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                              />
                              <p className="text-right text-sm font-semibold text-slate-900">
                                {(ingredientUnitCost * item.quantity).toFixed(2)} TL
                              </p>
                              <button type="submit" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                                Guncelle
                              </button>
                              <button formAction={detachIngredientAction} type="submit" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                                Cikar
                              </button>
                            </form>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <form action={attachIngredientAction} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_120px_auto] sm:items-center">
                    <input type="hidden" name="productId" value={selectedRecipeProduct.id} />
                    <select name="ingredientId" required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="">Malzeme sec</option>
                      {ingredients.map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name} ({ingredient.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      name="quantity"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="Miktar"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <button type="submit" className="rounded-xl bg-[#ff5a34] px-4 py-2 text-sm font-semibold text-white">
                      Kalem Ekle
                    </button>
                  </form>

                  <form action={copyRecipeAction} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <input type="hidden" name="targetProductId" value={selectedRecipeProduct.id} />
                    <select name="sourceProductId" required className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <option value="">Recete kopyalanacak urunu sec</option>
                      {sourceRecipeCandidates.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                      Receteyi Kopyala
                    </button>
                  </form>
                </div>
              )}
            </ContentCard>

            <ContentCard title="Hizli Maliyet Yonetimi">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Malzeme birim maliyetini hizli guncelleyin. Recete maliyeti aninda yansir.
                </div>
                <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                  {ingredients.map((ingredient) => (
                    <form key={ingredient.id} action={updateIngredientAction} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <input type="hidden" name="ingredientId" value={ingredient.id} />
                      <input type="hidden" name="name" value={ingredient.name} />
                      <input type="hidden" name="unit" value={ingredient.unit} />
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{ingredient.name}</p>
                          <p className="text-xs text-slate-500">{ingredient.unit}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            name="cost"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={Number(ingredient.cost ?? 0).toFixed(2)}
                            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                          <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </form>
                  ))}
                </div>
              </div>
            </ContentCard>
          </div>
        ) : null}

        {activeTab === "import" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <ContentCard title="Market Import">
              {isMarketScope ? (
                <form action={marketImportDryRunAction} className="grid gap-3">
                  <textarea
                    name="importPayload"
                    required
                    rows={14}
                    placeholder='[{"category_name":"Kasap","name":"Dana Kiyma","price":420,"stock_count":25}]'
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input name="replaceScope" type="checkbox" />
                    Sadece market scope kayitlarini temizleyip yeniden yukle
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                      Dry-run Calistir
                    </button>
                    <button formAction={marketImportCommitAction} type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
                      Commit Import
                    </button>
                  </div>
                </form>
              ) : (
                <EmptyPanel
                  title="Market profile gerekli"
                  description="Market import yalnizca enterprise_market scope aktifken kullanilabilir."
                />
              )}
            </ContentCard>

            <ContentCard title="Import Kurallari">
              <div className="space-y-3 text-sm text-slate-600">
                <p>JSON array formatinda satirlar beklenir.</p>
                <p>Zorunlu alanlar: <code>category_name</code> ve <code>name</code>.</p>
                <p>Opsiyonel alanlar: <code>price</code>, <code>stock_count</code>, <code>barcode</code>, <code>plu_code</code>, <code>product_kind</code>, <code>unit</code>, <code>department</code>, <code>image_url</code>, <code>description</code>, <code>is_available</code>.</p>
                <p>Dry-run sonucu cakisma/hata varsa commit engellenir.</p>
                <p>Commit islemi transaction ile calisir; hata durumunda rollback olur.</p>
              </div>
            </ContentCard>
          </div>
        ) : null}

        {activeTab === "features" ? (
          <div className="mt-6">
            <ContentCard title="Ürün Ozellikleri">
              <div className="space-y-3">
                {products.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-lg font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{(groupsByProduct.get(product.id) ?? []).length} modifier grubu - {(ingredientsByProduct.get(product.id) ?? []).length} malzeme</p>
                  </div>
                ))}
              </div>
            </ContentCard>
          </div>
        ) : null}
        {activeTab === "ingredients" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_340px]">
            <ContentCard title="Malzeme Kutuphanesi">
              <form action={addIngredientAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
                <input name="name" required placeholder="Yeni malzeme (orn: Mozzarella)" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input name="unit" required placeholder="Birim" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input name="cost" type="number" step="0.01" required placeholder="Maliyet" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <button type="submit" className="rounded-2xl bg-[#ff5a34] px-4 py-3 text-sm font-semibold text-white">Ekle</button>
              </form>
              <div className="mt-4 space-y-3">
                {ingredients.map((ingredient) => (
                  <div key={ingredient.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <form action={updateIngredientAction} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_140px_auto_auto] md:items-center">
                      <input type="hidden" name="ingredientId" value={ingredient.id} />
                      <input name="name" defaultValue={ingredient.name} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900" />
                      <input name="unit" defaultValue={ingredient.unit} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" />
                      <input name="cost" type="number" step="0.01" defaultValue={Number(ingredient.cost ?? 0).toFixed(2)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" />
                      <button type="submit" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Guncelle</button>
                      <button formAction={deleteIngredientAction} type="submit" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Sil</button>
                    </form>
                  </div>
                ))}
              </div>
            </ContentCard>

            <ContentCard title="Malzeme Ozeti">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-500">Toplam malzeme</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ingredients.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-500">Recetede kullanilan urun</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    {products.filter((product) => (ingredientsByProduct.get(product.id) ?? []).length > 0).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Bu sekme yalnizca malzeme kartlarini yonetmek icindir. Recete baglama ve urun bazli maliyet akisi icin Recipe Studio tabini kullanin.
                </div>
              </div>
            </ContentCard>
          </div>
        ) : null}
      </div>
    </BackofficePage>
  );
}
