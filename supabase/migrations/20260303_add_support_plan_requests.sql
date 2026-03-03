create table if not exists public.support_plan_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  current_plan text not null,
  requested_plan text not null,
  reason text,
  status text not null default 'open',
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_by_support_user_id uuid references public.support_access_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_plan_requests_current_plan_check check (current_plan in ('starter', 'growth', 'custom')),
  constraint support_plan_requests_requested_plan_check check (requested_plan in ('starter', 'growth', 'custom')),
  constraint support_plan_requests_status_check check (status in ('open', 'approved', 'rejected', 'cancelled'))
);

drop trigger if exists trg_support_plan_requests_updated_at on public.support_plan_requests;
create trigger trg_support_plan_requests_updated_at before update on public.support_plan_requests
for each row execute function public.set_updated_at();

create index if not exists idx_support_plan_requests_business_id on public.support_plan_requests (business_id);
create index if not exists idx_support_plan_requests_status on public.support_plan_requests (status);

alter table public.support_plan_requests enable row level security;

drop policy if exists "deny direct support plan requests reads" on public.support_plan_requests;
create policy "deny direct support plan requests reads" on public.support_plan_requests
for select to authenticated using (false);

drop policy if exists "deny direct support plan requests writes" on public.support_plan_requests;
create policy "deny direct support plan requests writes" on public.support_plan_requests
for all to authenticated using (false) with check (false);
