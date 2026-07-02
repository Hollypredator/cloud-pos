-- Migration: Add calories to products table
alter table public.products add column if not exists calories integer;
