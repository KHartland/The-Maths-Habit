-- ============================================================
-- Security Hardening Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Webhook idempotency table
-- Prevents duplicate processing of Stripe webhook events
-- ============================================================
create table if not exists public.processed_webhook_events (
  id bigint generated always as identity primary key,
  stripe_event_id text unique not null,
  event_type text not null,
  processed_at timestamptz default now()
);

-- No RLS needed — only the service role key writes to this table
-- (called from the Vercel serverless function, not the client)
alter table public.processed_webhook_events enable row level security;

-- No policies = no client access (service role bypasses RLS)

-- Auto-clean events older than 30 days to keep the table small
-- (Stripe won't retry after 3 days, so 30 days is very safe)
create or replace function clean_old_webhook_events()
returns void as $$
begin
  delete from public.processed_webhook_events
  where processed_at < now() - interval '30 days';
end;
$$ language plpgsql security definer;


-- 2. Tighten matches table RLS
-- Replace overly permissive SELECT and INSERT policies
-- ============================================================

-- Drop the old permissive policies
drop policy if exists "matches_insert" on public.matches;
drop policy if exists "matches_select" on public.matches;

-- SELECT: users can see matches they're part of, or waiting matches (for matchmaking)
create policy "matches_select_own_or_waiting" on public.matches
  for select to authenticated
  using (
    host_id = auth.uid()
    or guest_id = auth.uid()
    or status = 'waiting'
  );

-- INSERT: users can only create matches where they are the host
create policy "matches_insert_as_host" on public.matches
  for insert to authenticated
  with check (host_id = auth.uid());


-- 3. Promo codes tables (if missing)
-- ============================================================
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  is_active boolean default true,
  max_uses integer,
  times_used integer default 0,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  promo_code_id uuid not null references public.promo_codes(id),
  redeemed_at timestamptz default now()
);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- Anyone can look up a promo code (needed to validate before redeeming)
create policy "promo_codes_select" on public.promo_codes
  for select to authenticated
  using (true);

-- Only service role can insert/update promo codes (admin only)
-- No INSERT/UPDATE policies = clients cannot create or modify codes

-- Users can insert their own redemptions
create policy "promo_redemptions_insert_own" on public.promo_redemptions
  for insert to authenticated
  with check (user_id = auth.uid());

-- Users can view their own redemptions
create policy "promo_redemptions_select_own" on public.promo_redemptions
  for select to authenticated
  using (user_id = auth.uid());
