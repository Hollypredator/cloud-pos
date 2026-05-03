-- Accounting & Procurement Module
-- Migration: 20260420_accounting_module

-- 1. Suppliers Table
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  tax_number text,
  tax_office text,
  category text, -- e.g. 'Meat', 'Vegetable', 'General'
  created_at timestamptz not null default now()
);

-- 2. Purchases Table (Invoices/Receipts)
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  invoice_number text,
  purchase_date date not null default current_date,
  total_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  payment_status text not null default 'draft' check (payment_status in ('draft', 'completed', 'paid', 'unpaid')),
  payment_method text check (payment_method in ('cash', 'card', 'bank_transfer', 'credit')),
  note text,
  created_at timestamptz not null default now()
);

-- 3. Purchase Items Table
create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  quantity numeric(12,4) not null default 1,
  unit_price numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- 4. General Expenses Table
create table if not exists public.general_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  title text not null,
  category text not null, -- e.g. 'Rent', 'Electricity', 'Water', 'Salary', 'Internet', 'Other'
  amount numeric(12,2) not null default 0,
  expense_date date not null default current_date,
  payment_method text check (payment_method in ('cash', 'card', 'bank_transfer')),
  description text,
  created_at timestamptz not null default now()
);

-- RLS Policies
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.general_expenses enable row level security;

-- Basic policies for authenticated users
create policy "staff full suppliers" on public.suppliers for all using (true) with check (true);
create policy "staff full purchases" on public.purchases for all using (true) with check (true);
create policy "staff full purchase_items" on public.purchase_items for all using (true) with check (true);
create policy "staff full general_expenses" on public.general_expenses for all using (true) with check (true);

-- Indexes
create index if not exists idx_suppliers_business_id on public.suppliers (business_id);
create index if not exists idx_purchases_business_id on public.purchases (business_id);
create index if not exists idx_purchases_supplier_id on public.purchases (supplier_id);
create index if not exists idx_purchase_items_purchase_id on public.purchase_items (purchase_id);
create index if not exists idx_general_expenses_business_id on public.general_expenses (business_id);
