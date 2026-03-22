export type TableStatus = "empty" | "occupied" | "reserved";
export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "partially_paid"
  | "paid"
  | "partially_refunded"
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
export type PrepStation = "kitchen" | "bar" | "dessert";
export type OrderStationStatus = "pending" | "preparing" | "served";
export type SalesLeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";
export type StudioRole = "owner" | "editor";
export type SupportRole = "support_admin" | "support_agent" | "billing_agent" | "read_only";
export type PlatformRole =
  | "platform_owner"
  | "platform_admin"
  | "support_manager"
  | "support_agent"
  | "billing_manager"
  | "content_manager"
  | "content_editor"
  | "observer";
export type PlatformPermission =
  | "platform.access.manage"
  | "platform.audit.read"
  | "support.read"
  | "support.write"
  | "support.assign"
  | "support.billing"
  | "support.access.manage"
  | "studio.read"
  | "studio.write"
  | "studio.publish";
export type SupportTicketType = "support" | "plan_change" | "billing" | "onboarding" | "incident";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";
export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type SupportPlanRequestStatus = "open" | "approved" | "rejected" | "cancelled";
export type BusinessPlan = "starter" | "growth" | "custom";
export type StaffAccessScope = "business" | "branch";
export type TenantLifecycleStage = "lead" | "demo" | "onboarding" | "active" | "at_risk" | "churned" | "archived";
export type SupportBillingStatus = "healthy" | "attention" | "overdue";
export type SupportRiskLevel = "low" | "medium" | "high";
export type SupportIncidentSeverity = "minor" | "major" | "critical";
export type SupportIncidentStatus = "open" | "monitoring" | "resolved" | "closed";

export type Category = {
  id: string;
  business_id?: string;
  name: string;
  sort_order: number;
  prep_station?: PrepStation | null;
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
  zone_id?: string | null;
  zone_name?: string | null;
  table_number: number;
  name?: string | null;
  status: TableStatus;
  qr_code_identifier: string;
};

export type TableZone = {
  id: string;
  business_id?: string | null;
  branch_id?: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
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
  check_number?: string | null;
  check_sequence?: number | null;
  check_date?: string | null;
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
  station_statuses?: Partial<Record<PrepStation, OrderStationStatus>> | null;
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
  idempotency_key?: string | null;
  created_at: string;
};

export type OrderPaymentSummaryAggregate = {
  order_id: string;
  paid: number;
  refunds: number;
  net: number;
  payment_count: number;
};

export type OpsSnapshotAggregate = {
  pending_orders: number;
  preparing_orders: number;
  served_orders: number;
  delayed_kitchen_orders: number;
  critical_kitchen_orders: number;
  occupied_tables: number;
  empty_tables: number;
  open_service_requests: number;
  today_revenue: number;
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

export type PlatformAccessUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: PlatformRole;
  permissions: PlatformPermission[];
  is_active: boolean;
  created_at: string;
};

export type SupportAccessUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: SupportRole;
  is_active: boolean;
  created_at: string;
};

export type SupportTicket = {
  id: string;
  business_id: string;
  business_name?: string;
  type: SupportTicketType;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  subject: string;
  description: string;
  created_by_profile_id: string | null;
  assigned_to_support_user_id: string | null;
  assigned_support_name?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  sla_due_at?: string | null;
  sla_status?: "on_track" | "due_soon" | "breached";
};

export type SupportTicketMessage = {
  id: string;
  ticket_id: string;
  author_type: "tenant" | "support" | "system";
  author_support_user_id: string | null;
  author_profile_id: string | null;
  message: string;
  is_internal_note: boolean;
  created_at: string;
  author_name?: string | null;
};

export type SupportAuditLogEntry = {
  id: string;
  support_user_id: string | null;
  business_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
  business_name?: string | null;
};

export type SupportTenantProfile = {
  business_id: string;
  lifecycle_stage: TenantLifecycleStage;
  owner_name: string | null;
  owner_email: string | null;
  account_manager_name: string | null;
  renewal_date: string | null;
  billing_status: SupportBillingStatus;
  risk_level: SupportRiskLevel;
  account_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportIncident = {
  id: string;
  business_id: string | null;
  business_name?: string | null;
  title: string;
  summary: string;
  severity: SupportIncidentSeverity;
  status: SupportIncidentStatus;
  owner_support_user_id: string | null;
  owner_support_name?: string | null;
  started_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportIncidentUpdate = {
  id: string;
  incident_id: string;
  author_support_user_id: string | null;
  message: string;
  status: SupportIncidentStatus | null;
  created_at: string;
  author_name?: string | null;
};

export type SupportFeatureFlagOverride = {
  id: string;
  business_id: string;
  business_name?: string;
  feature_key: string;
  enabled: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportTeamMemberSummary = {
  id: string;
  email: string;
  full_name: string | null;
  role: PlatformRole;
  is_active: boolean;
  open_ticket_count: number;
  open_incident_count: number;
  created_at: string;
};

export type SupportKnowledgeArticle = {
  id: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type SupportTenantSummary = {
  business_id: string;
  business_name: string;
  business_slug: string;
  plan: BusinessPlan;
  is_active: boolean;
  branch_count: number;
  support_ticket_count: number;
};

export type SupportHealthSummary = {
  business_id: string;
  business_name: string;
  plan: BusinessPlan;
  health_status: "healthy" | "warning" | "critical";
  last_order_at: string | null;
  last_payment_at: string | null;
  open_ticket_count: number;
};

export type SupportOnboardingSummary = {
  business_id: string;
  business_name: string;
  products: number;
  tables: number;
  staff: number;
  branches: number;
  completion_score: number;
};

export type SupportPlanRequest = {
  id: string;
  business_id: string;
  business_name?: string;
  current_plan: BusinessPlan;
  requested_plan: BusinessPlan;
  reason: string | null;
  status: SupportPlanRequestStatus;
  requested_by_profile_id: string | null;
  reviewed_by_support_user_id: string | null;
  reviewed_by_support_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsCommandType =
  | "ORDER_CREATE"
  | "ORDER_STATUS_SET"
  | "ORDER_FINANCIALS_SET"
  | "ORDER_ITEM_CANCEL"
  | "PAYMENT_SALE_CASH"
  | "ORDER_CANCEL"
  | "ORDER_REFUND_CASH"
  | "DELIVERY_ASSIGN"
  | "DELIVERY_COMPLETE"
  | "TABLE_STATUS_SET"
  | "TABLE_REQUEST_RESOLVE"
  | "CASH_SESSION_OPEN"
  | "CASH_SESSION_CLOSE";

export type OpsCommand = {
  command_id: string;
  idempotency_key: string;
  type: OpsCommandType;
  business_id: string | null;
  branch_id: string | null;
  actor_id: string | null;
  device_id: string;
  created_at: string;
  payload: Record<string, unknown>;
};

export type OpsCommandResultStatus = "ACK" | "RETRY" | "REJECT" | "CONFLICT";

export type OpsCommandResult = {
  command_id: string;
  idempotency_key: string;
  status: OpsCommandResultStatus;
  message?: string;
  applied_at?: string;
  conflict_code?: string;
  retry_after_ms?: number;
  data?: Record<string, unknown>;
};

export type SyncPushRequest = {
  device_id: string;
  branch_id: string;
  business_id?: string | null;
  lock_token?: string;
  commands: OpsCommand[];
};

export type SyncPushResponse = {
  ok: boolean;
  accepted_count: number;
  rejected_count: number;
  conflict_count: number;
  retry_count: number;
  results: OpsCommandResult[];
};

export type SyncEvent = {
  sequence: number;
  business_id: string | null;
  branch_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type SyncPullResponse = {
  ok: boolean;
  next_cursor: string;
  events: SyncEvent[];
};

export type BranchLockState = {
  branch_id: string;
  business_id: string | null;
  device_id: string;
  lock_token: string;
  status: "active" | "released" | "expired";
  acquired_at: string;
  renewed_at: string;
  expires_at: string;
  actor_id: string | null;
};
