-- ═══════════════════════════════════════════════════════════
-- Square One Maths — 1v1 Battle: matches table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- 1. Create the table
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  host_id     uuid not null references auth.users(id),
  host_name   text not null,
  guest_id    uuid references auth.users(id),
  guest_name  text,
  question_count integer not null default 10,
  tier        text not null default 'foundation',
  topics      jsonb default '["number","algebra","ratio","geometry","probability","statistics"]'::jsonb,
  status      text not null default 'waiting',
  questions   jsonb,
  started_at  timestamptz,
  finished_at timestamptz,
  host_answers  jsonb default '[]'::jsonb,
  guest_answers jsonb default '[]'::jsonb,
  host_score    integer default 0,
  guest_score   integer default 0,
  host_finished_at  timestamptz,
  guest_finished_at timestamptz,
  winner_id     uuid references auth.users(id),
  winner_reason text,
  created_at  timestamptz default now()
);

-- 2. Enable Row Level Security
alter table public.matches enable row level security;

-- 3. RLS policies — authenticated users can do everything
--    (matches are short-lived; stale ones can be cleaned up later)
create policy "Users can create matches"
  on public.matches for insert
  to authenticated
  with check (true);

create policy "Users can view matches they are in"
  on public.matches for select
  to authenticated
  using (true);

create policy "Users can update matches they are in"
  on public.matches for update
  to authenticated
  using (host_id = auth.uid() or guest_id = auth.uid());

create policy "Host can delete their match"
  on public.matches for delete
  to authenticated
  using (host_id = auth.uid());

-- 4. Enable Realtime (needed for live score updates)
alter publication supabase_realtime add table public.matches;

-- 5. Auto-clean stale matches older than 24 hours (optional cron)
-- You can set this up in Supabase Dashboard → Database → Extensions → pg_cron
-- select cron.schedule('clean-stale-matches', '0 * * * *',
--   $$delete from public.matches where created_at < now() - interval '24 hours'$$
-- );
