create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_type text not null default 'support',
  author_support_user_id uuid references public.support_access_users(id) on delete set null,
  author_profile_id uuid references public.profiles(id) on delete set null,
  message text not null,
  is_internal_note boolean not null default true,
  created_at timestamptz not null default now(),
  constraint support_ticket_messages_author_type_check check (author_type in ('tenant', 'support', 'system'))
);

create index if not exists idx_support_ticket_messages_ticket_id on public.support_ticket_messages (ticket_id);
create index if not exists idx_support_ticket_messages_created_at on public.support_ticket_messages (created_at desc);

alter table public.support_ticket_messages enable row level security;

drop policy if exists "deny direct support ticket messages reads" on public.support_ticket_messages;
create policy "deny direct support ticket messages reads" on public.support_ticket_messages
for select to authenticated using (false);

drop policy if exists "deny direct support ticket messages writes" on public.support_ticket_messages;
create policy "deny direct support ticket messages writes" on public.support_ticket_messages
for all to authenticated using (false) with check (false);
