create table if not exists public.support_feature_flag_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, feature_key)
);

drop trigger if exists trg_support_feature_flag_overrides_updated_at on public.support_feature_flag_overrides;
create trigger trg_support_feature_flag_overrides_updated_at before update on public.support_feature_flag_overrides
for each row execute function public.set_updated_at();

create index if not exists idx_support_feature_flag_overrides_business_id on public.support_feature_flag_overrides (business_id);

alter table public.support_feature_flag_overrides enable row level security;

drop policy if exists "deny direct support feature flag reads" on public.support_feature_flag_overrides;
create policy "deny direct support feature flag reads" on public.support_feature_flag_overrides
for select to authenticated using (false);

drop policy if exists "deny direct support feature flag writes" on public.support_feature_flag_overrides;
create policy "deny direct support feature flag writes" on public.support_feature_flag_overrides
for all to authenticated using (false) with check (false);
