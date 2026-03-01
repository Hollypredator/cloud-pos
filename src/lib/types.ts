export type TableStatus = "empty" | "occupied" | "reserved";
export type OrderStatus =
  | "pending"
  | "preparing"
  | "served"
  | "paid"
  | "cancelled"
  | "refunded";
export type OrderChannel = "dine_in" | "pickup" | "delivery";
export type FulfillmentStatus = "not_applicable" | "awaiting_dispatch" | "out_for_delivery" | "completed";
export type AppRole = "owner" | "admin" | "waiter" | "kitchen" | "cashier";
export type PaymentMethod = "cash" | "card" | "mixed";
export type PaymentType = "sale" | "refund";
export type CashSessionStatus = "open" | "closed";
export type TableRequestType = "call_waiter" | "request_bill";
export type TableRequestStatus = "open" | "resolved";
export type SalesLeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";
export type StudioRole = "owner" | "editor";
export type BusinessPlan = "starter" | "growth" | "custom";
export type StaffAccessScope = "business" | "branch";

export type Category = {
  id: string;
  business_id?: string;
  name: string;
  sort_order: number;
};

export type Branch = {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  business_id?: string;
  category_id: string;
  name: string;
  price: number;
  stock_count: number;
  image_url: string | null;
  description: string | null;
  is_available: boolean;
};

export type DiningTable = {
  id: string;
  business_id?: string;
  branch_id?: string | null;
  table_number: number;
  name?: string | null;
  status: TableStatus;
  qr_code_identifier: string;
};

export type OrderItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  modifiers?: OrderItemModifierSelection[];
};

export type OrderItemModifierSelection = {
  group_id?: string;
  group_name: string;
  option_id?: string;
  option_name: string;
  price_delta: number;
  quantity?: number;
};

export type Order = {
  id: string;
  business_id?: string;
  branch_id?: string | null;
  table_id: string | null;
  items: OrderItem[];
  total_price: number;
  discount_amount?: number;
  service_fee?: number;
  final_price?: number;
  channel?: OrderChannel;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_note?: string | null;
  courier_id?: string | null;
  courier_name?: string | null;
  courier_phone?: string | null;
  fulfillment_status?: FulfillmentStatus;
  amount_paid?: number;
  remaining_balance?: number;
  payment_count?: number;
  status: OrderStatus;
  created_at: string;
  table_number?: number;
};

export type Courier = {
  id: string;
  business_id?: string;
  branch_id?: string | null;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
};

export type ProductModifierGroup = {
  id: string;
  product_id: string;
  name: string;
  min_select: number;
  max_select: number;
  is_required: boolean;
  sort_order: number;
};

export type ProductModifierOption = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
  sort_order: number;
};

export type Profile = {
  id: string;
  full_name: string | null;
  role: AppRole;
};

export type StaffBranchAccess = {
  id: string;
  profile_id: string;
  business_id: string;
  branch_id: string | null;
  access_scope: StaffAccessScope;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type Ingredient = {
  id: string;
  name: string;
  unit: string;
};

export type ProductIngredient = {
  product_id: string;
  ingredient_id: string;
  quantity: number;
};

export type StockMovement = {
  id: string;
  product_id: string;
  change_amount: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  created_at: string;
  product_name?: string;
};

export type Payment = {
  id: string;
  order_id: string;
  branch_id?: string | null;
  payment_type: PaymentType;
  method: PaymentMethod;
  amount: number;
  note: string | null;
  created_at: string;
};

export type CashRegisterSession = {
  id: string;
  branch_id?: string | null;
  status: CashSessionStatus;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  note: string | null;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type TableRequest = {
  id: string;
  business_id?: string;
  branch_id?: string | null;
  table_id: string;
  table_number?: number;
  request_type: TableRequestType;
  status: TableRequestStatus;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type AlertDispatch = {
  id: string;
  alert_type: string;
  last_sent_at: string;
  last_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Business = {
  id: string;
  name: string;
  slug: string;
  plan: BusinessPlan;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SalesLead = {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string | null;
  email: string | null;
  branch_count: number;
  note: string | null;
  status: SalesLeadStatus;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteContent = {
  id: string;
  key: string;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MediaAsset = {
  id: string;
  title: string;
  file_url: string;
  alt_text: string | null;
  kind: "image" | "document" | "video" | "other";
  storage_bucket?: string | null;
  storage_path?: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogPostStatus = "draft" | "published";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  status: BlogPostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SalesLeadNote = {
  id: string;
  lead_id: string;
  note: string;
  created_at: string;
};

export type StudioAccessUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: StudioRole;
  is_active: boolean;
  created_at: string;
};
