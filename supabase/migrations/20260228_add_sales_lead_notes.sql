create table if not exists public.sales_lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sales_lead_notes_lead_id on public.sales_lead_notes (lead_id);
create index if not exists idx_sales_lead_notes_created_at on public.sales_lead_notes (created_at desc);

alter table public.sales_lead_notes enable row level security;

drop policy if exists "admin full sales lead notes" on public.sales_lead_notes;
create policy "admin full sales lead notes" on public.sales_lead_notes
for all to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);
