-- ═══════════════════════════════════════════════════════════
-- MONTHLY SCHOOL LEADERBOARD RPC FUNCTION
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: uses CREATE OR REPLACE
--
-- Sums correct_answers from daily_activity for a specific month.
-- Used as the default leaderboard view so newcomers can compete
-- each month on a level playing field.
-- ═══════════════════════════════════════════════════════════

create or replace function public.get_school_leaderboard_monthly(
  p_school_id uuid,
  p_year integer,
  p_month integer
)
returns table (
  user_id       uuid,
  display_name  text,
  avatar_url    text,
  total_correct bigint
)
language sql
security definer
stable
as $$
  select
    sm.user_id,
    coalesce(p.display_name, split_part(u.email, '@', 1)) as display_name,
    p.avatar_url,
    coalesce(sum(da.correct_answers), 0) as total_correct
  from public.school_members sm
  join auth.users u on u.id = sm.user_id
  left join public.profiles p on p.id = sm.user_id
  left join public.daily_activity da
    on da.user_id = sm.user_id
    and extract(year from da.date) = p_year
    and extract(month from da.date) = p_month
  where sm.school_id = p_school_id
  group by sm.user_id, p.display_name, u.email, p.avatar_url
  order by total_correct desc, display_name asc;
$$;
