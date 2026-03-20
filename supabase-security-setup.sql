-- =========================================================
-- THE MATHS HABIT — Security Setup
-- Run each section one at a time in Supabase SQL Editor
-- =========================================================

-- 1. BLOCK BOT SCHOOL JOINS
-- Only users who have answered at least 1 question correctly
-- can join a school. Bots can't do this.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_bot_school_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Must have answered at least one question correctly
  IF NOT EXISTS (
    SELECT 1 FROM daily_activity
    WHERE user_id = NEW.user_id
    AND correct_answers > 0
  ) THEN
    RAISE EXCEPTION 'Must answer at least one question before joining a school';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_school_join ON school_members;
CREATE TRIGGER check_school_join
  BEFORE INSERT ON school_members
  FOR EACH ROW
  EXECUTE FUNCTION block_bot_school_join();


-- 2. REMOVE INACTIVE MEMBERS (teacher cleanup button)
-- Uses SECURITY DEFINER to bypass RLS
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS remove_inactive_school_members(uuid);
CREATE FUNCTION public.remove_inactive_school_members(p_school_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE removed integer;
BEGIN
  DELETE FROM school_members
  WHERE school_id = p_school_id
  AND user_id NOT IN (
    SELECT DISTINCT user_id FROM daily_activity WHERE correct_answers > 0
  );
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_inactive_school_members(uuid) TO authenticated;


-- 3. LEADERBOARD FUNCTIONS (filter out 0-score users)
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS get_school_leaderboard(uuid);
CREATE FUNCTION public.get_school_leaderboard(p_school_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, total_correct bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT sm.user_id,
    COALESCE(p.first_name || ' ' || p.surname, 'Anonymous') as display_name,
    p.avatar_url,
    COALESCE(SUM(da.correct_answers), 0) as total_correct
  FROM public.school_members sm
  LEFT JOIN public.profiles p ON p.id = sm.user_id
  LEFT JOIN public.daily_activity da ON da.user_id = sm.user_id
  WHERE sm.school_id = p_school_id
  GROUP BY sm.user_id, p.first_name, p.surname, p.avatar_url
  HAVING COALESCE(SUM(da.correct_answers), 0) > 0
  ORDER BY total_correct DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_leaderboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_leaderboard(uuid) TO anon;

DROP FUNCTION IF EXISTS get_school_leaderboard_monthly(uuid);
CREATE FUNCTION public.get_school_leaderboard_monthly(p_school_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, total_correct bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT sm.user_id,
    COALESCE(p.first_name || ' ' || p.surname, 'Anonymous') as display_name,
    p.avatar_url,
    COALESCE(SUM(da.correct_answers), 0) as total_correct
  FROM public.school_members sm
  LEFT JOIN public.profiles p ON p.id = sm.user_id
  LEFT JOIN public.daily_activity da ON da.user_id = sm.user_id
    AND da.activity_date >= date_trunc('month', CURRENT_DATE)
  WHERE sm.school_id = p_school_id
  GROUP BY sm.user_id, p.first_name, p.surname, p.avatar_url
  HAVING COALESCE(SUM(da.correct_answers), 0) > 0
  ORDER BY total_correct DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_leaderboard_monthly(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_leaderboard_monthly(uuid) TO anon;


-- 4. CLEAN UP EXISTING BOT DATA
-- Remove all school_members with no correct answers
-- ---------------------------------------------------------
ALTER TABLE school_members DISABLE ROW LEVEL SECURITY;
DELETE FROM school_members
WHERE user_id NOT IN (
  SELECT DISTINCT user_id FROM daily_activity WHERE correct_answers > 0
);
ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;


-- 5. ENABLE SUPABASE AUTH RATE LIMITING
-- Go to Authentication → Rate Limits in the Supabase dashboard
-- Set: Email sign-ups = 3 per hour (prevents mass bot creation)
-- This step is done in the UI, not SQL.
