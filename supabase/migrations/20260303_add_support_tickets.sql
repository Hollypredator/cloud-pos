create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null default 'support',
  priority text not null default 'normal',
  status text not null default 'open',
  subject text not null,
  description text not null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  assigned_to_support_user_id uuid references public.support_access_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint support_tickets_type_check check (type in ('support', 'plan_change', 'billing', 'onboarding', 'incident')),
  constraint support_tickets_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint support_tickets_status_check check (status in ('open', 'in_progress', 'resolved', 'closed'))
);

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at before update on public.support_tickets
for each row execute function public.set_updated_at();

create index if not exists idx_support_tickets_business_id on public.support_tickets (business_id);
create index if not exists idx_support_tickets_status on public.support_tickets (status);
create index if not exists idx_support_tickets_assigned_user on public.support_tickets (assigned_to_support_user_id);

alter table public.support_tickets enable row level security;

drop policy if exists "deny direct support tickets reads" on public.support_tickets;
create policy "deny direct support tickets reads" on public.support_tickets
for select to authenticated using (false);

drop policy if exists "deny direct support tickets writes" on public.support_tickets;
create policy "deny direct support tickets writes" on public.support_tickets
for all to authenticated using (false) with check (false);
