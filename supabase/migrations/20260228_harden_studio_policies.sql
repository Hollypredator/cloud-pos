drop policy if exists "admin full site content" on public.site_content;
drop policy if exists "direct write site content denied" on public.site_content;
create policy "direct write site content denied" on public.site_content
for all to authenticated using (false) with check (false);

drop policy if exists "admin full app settings" on public.app_settings;
drop policy if exists "direct write app settings denied" on public.app_settings;
create policy "direct write app settings denied" on public.app_settings
for all to authenticated using (false) with check (false);

drop policy if exists "admin full blog posts" on public.blog_posts;
drop policy if exists "direct write blog posts denied" on public.blog_posts;
create policy "direct write blog posts denied" on public.blog_posts
for all to authenticated using (false) with check (false);

drop policy if exists "admin full media assets" on public.media_assets;
drop policy if exists "direct write media assets denied" on public.media_assets;
create policy "direct write media assets denied" on public.media_assets
for all to authenticated using (false) with check (false);

drop policy if exists "admin full sales leads" on public.sales_leads;
drop policy if exists "direct access sales leads denied" on public.sales_leads;
create policy "direct access sales leads denied" on public.sales_leads
for all to authenticated using (false) with check (false);

drop policy if exists "admin full sales lead notes" on public.sales_lead_notes;
drop policy if exists "direct access sales lead notes denied" on public.sales_lead_notes;
create policy "direct access sales lead notes denied" on public.sales_lead_notes
for all to authenticated using (false) with check (false);
