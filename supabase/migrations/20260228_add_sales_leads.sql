do $$
begin
  if not exists (select 1 from pg_type where typname = 'sales_lead_status') then
    create type public.sales_lead_status as enum ('new', 'contacted', 'qualified', 'won', 'lost');
  end if;
end $$;

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  phone text,
  email text,
  branch_count integer not null default 1,
  note text,
  status public.sales_lead_status not null default 'new',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sales_leads_updated_at on public.sales_leads;
create trigger trg_sales_leads_updated_at before update on public.sales_leads
for each row execute function public.set_updated_at();

create index if not exists idx_sales_leads_status on public.sales_leads (status);
create index if not exists idx_sales_leads_created_at on public.sales_leads (created_at desc);

alter table public.sales_leads enable row level security;

drop policy if exists "admin full sales leads" on public.sales_leads;
create policy "admin full sales leads" on public.sales_leads
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
