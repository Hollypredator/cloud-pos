import type {
  ProductDepartment,
  ProductKind,
  ProductProfileScope,
  ProductUnit,
} from "@/lib/types";
import type { RestaurantDemoRecipeLine, RestaurantDemoRecipePlan } from "./actions";

// Data Normalization Helpers
export function normalizePrepStation(value: FormDataEntryValue | null) {
  const station = typeof value === "string" ? value : "";
  if (station === "bar" || station === "dessert") {
    return station;
  }
  return "kitchen";
}

export function normalizeProfileScope(value: FormDataEntryValue | null): ProductProfileScope {
  return value === "enterprise_market" ? "enterprise_market" : "restaurant";
}

export function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export function normalizeProductKind(value: FormDataEntryValue | null): ProductKind {
  return value === "weighted" || value === "service" ? value : "standard";
}

export function normalizeProductUnit(value: FormDataEntryValue | null): ProductUnit {
  if (value === "kg" || value === "gram" || value === "litre" || value === "ml" || value === "paket") {
    return value;
  }
  return "adet";
}

export function normalizeProductDepartment(value: FormDataEntryValue | null): ProductDepartment {
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

export function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeCatalogName(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

export function isDuplicateError(message?: string | null) {
  const text = (message ?? "").toLocaleLowerCase("tr-TR");
  return text.includes("duplicate") || text.includes("already exists") || text.includes("unique");
}

// Demo Seeds Configurations and Helpers
export const restaurantDemoCatalogSeed = {
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
    { categoryName: "Pizzalar", name: "Karışık Pizza", price: 305, stockCount: 999, description: "Mixed topping house pizza" },
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
    { categoryName: "Refresher ve Frozen", name: "Double Chocolate Chip Frappuccino", price: 235, stockCount: 999, description: "Double chocolate chip blended drink" },

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
    { categoryName: "Burgerler", name: "Truffle Burger", price: 330, stockCount: 999, description: "Mushroom and truffle mayonaise" },
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
    { categoryName: "Atistirmalik", name: "Karışık Finger Plate", price: 295, stockCount: 999, description: "Mixed fried finger foods" },

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

export const restaurantDemoIngredientsSeed: Array<{ name: string; unit: string; cost: number }> = [
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
  { name: "Ayran Hazır", unit: "adet", cost: 35 },
  { name: "Maden Suyu Hazır", unit: "adet", cost: 28 },
  { name: "Meyveli Soda Hazır", unit: "adet", cost: 30 },
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

export function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function buildRestaurantDemoRecipe(categoryName: string, productName: string): RestaurantDemoRecipePlan {
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
    else if (name.includes("ayran")) add("Ayran Hazır", 1);
    else if (name.includes("meyveli soda")) add("Meyveli Soda Hazır", 1);
    else if (name.includes("soda")) add("Maden Suyu Hazır", 1);
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

export function formatDryRunSummary(input: {
  rowCount: number;
  newCategoryCount: number;
  newProductCount: number;
  updateProductCount: number;
  conflictCount: number;
  errorCount: number;
}) {
  return `Dry-run tamam: satir ${input.rowCount}, yeni kategori ${input.newCategoryCount}, yeni Ürün ${input.newProductCount}, güncellenecek Ürün ${input.updateProductCount}, cakışma ${input.conflictCount}, hata ${input.errorCount}.`;
}

export function actionErrorMessage(result: { ok: boolean; error?: string | null }, fallback: string) {
  const message = (result.error ?? "").trim();
  return message || fallback;
}

export function prepStationLabel(station?: string | null) {
  if (station === "bar") return "Bar";
  if (station === "dessert") return "Tatli";
  return "Mutfak";
}
