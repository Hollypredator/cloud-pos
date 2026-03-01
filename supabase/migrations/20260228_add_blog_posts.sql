do $$
begin
  if not exists (select 1 from pg_type where typname = 'blog_post_status') then
    create type public.blog_post_status as enum ('draft', 'published');
  end if;
end $$;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  body text not null default '',
  cover_image_url text,
  status public.blog_post_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at before update on public.blog_posts
for each row execute function public.set_updated_at();

create index if not exists idx_blog_posts_status on public.blog_posts (status);
create index if not exists idx_blog_posts_published_at on public.blog_posts (published_at desc);

alter table public.blog_posts enable row level security;

drop policy if exists "public read published blog posts" on public.blog_posts;
create policy "public read published blog posts" on public.blog_posts
for select to anon, authenticated using (status = 'published');

drop policy if exists "admin full blog posts" on public.blog_posts;
create policy "admin full blog posts" on public.blog_posts
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
