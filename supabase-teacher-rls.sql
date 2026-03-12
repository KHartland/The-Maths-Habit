-- ═══════════════════════════════════════════════════════════
-- Teacher RLS Policies for Student Monitor
-- ═══════════════════════════════════════════════════════════
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / exception handling
--
-- After running this, promote yourself to teacher:
--   UPDATE profiles SET role = 'teacher' WHERE id = 'YOUR_USER_UUID';
--
-- Find your UUID: Supabase Dashboard → Authentication → Users
-- ═══════════════════════════════════════════════════════════


-- 1. Add role column to profiles (won't break anything if it already exists)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'student';


-- 2. Helper: check if current user is a teacher in the same school as target user
CREATE OR REPLACE FUNCTION public.is_teacher_for_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.school_members sm_teacher ON sm_teacher.user_id = auth.uid()
    JOIN public.school_members sm_student ON sm_student.user_id = target_user_id
    WHERE p.id = auth.uid()
      AND p.role = 'teacher'
      AND sm_teacher.school_id = sm_student.school_id
  );
$$;


-- 3. Drop old restrictive policies and replace with teacher-aware ones
-- (This approach replaces the SELECT policy so teachers can see student data)

-- === user_progress ===
DROP POLICY IF EXISTS "user_progress_select" ON public.user_progress;
DO $$ BEGIN
  CREATE POLICY "user_progress_select" ON public.user_progress
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_teacher_for_user(user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- === daily_activity ===
DROP POLICY IF EXISTS "daily_activity_select" ON public.daily_activity;
DO $$ BEGIN
  CREATE POLICY "daily_activity_select" ON public.daily_activity
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_teacher_for_user(user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- === user_streaks ===
DROP POLICY IF EXISTS "user_streaks_select" ON public.user_streaks;
DO $$ BEGIN
  CREATE POLICY "user_streaks_select" ON public.user_streaks
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_teacher_for_user(user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- === matches (battles) ===
-- Keep existing policy (allows all authenticated to select) — no change needed
-- If you want to restrict later, uncomment below:
-- DROP POLICY IF EXISTS "matches_select" ON public.matches;
-- CREATE POLICY "matches_select" ON public.matches
--   FOR SELECT TO authenticated
--   USING (
--     host_id = auth.uid() OR guest_id = auth.uid()
--     OR public.is_teacher_for_user(host_id)
--     OR public.is_teacher_for_user(guest_id)
--   );


-- ═══════════════════════════════════════════════════════════
-- DONE! Now promote yourself:
--
--   UPDATE profiles SET role = 'teacher'
--   WHERE id = 'paste-your-user-uuid-here';
--
-- Then open teacher-dashboard.html and sign in.
-- ═══════════════════════════════════════════════════════════
