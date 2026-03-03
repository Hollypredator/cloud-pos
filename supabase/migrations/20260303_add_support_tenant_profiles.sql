create table if not exists public.support_tenant_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  lifecycle_stage text not null default 'active',
  owner_name text,
  owner_email text,
  account_manager_name text,
  renewal_date date,
  billing_status text not null default 'healthy',
  risk_level text not null default 'low',
  account_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tenant_profiles_lifecycle_check check (lifecycle_stage in ('lead', 'demo', 'onboarding', 'active', 'at_risk', 'churned', 'archived')),
  constraint support_tenant_profiles_billing_check check (billing_status in ('healthy', 'attention', 'overdue')),
  constraint support_tenant_profiles_risk_check check (risk_level in ('low', 'medium', 'high'))
);

drop trigger if exists trg_support_tenant_profiles_updated_at on public.support_tenant_profiles;
create trigger trg_support_tenant_profiles_updated_at before update on public.support_tenant_profiles
for each row execute function public.set_updated_at();

alter table public.support_tenant_profiles enable row level security;

drop policy if exists "deny direct support tenant profile reads" on public.support_tenant_profiles;
create policy "deny direct support tenant profile reads" on public.support_tenant_profiles
for select to authenticated using (false);

drop policy if exists "deny direct support tenant profile writes" on public.support_tenant_profiles;
create policy "deny direct support tenant profile writes" on public.support_tenant_profiles
for all to authenticated using (false) with check (false);
