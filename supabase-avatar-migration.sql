-- =============================================
-- AVATAR FEATURE MIGRATION
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add avatar_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Add avatar columns to matches (for 1v1 battles)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS host_avatar text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS guest_avatar text;

-- 3. Update the leaderboard RPC to return avatar_url
CREATE OR REPLACE FUNCTION get_school_leaderboard(p_school_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_correct bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sm.user_id,
    coalesce(p.display_name, 'Unknown') AS display_name,
    p.avatar_url,
    coalesce(sum(da.correct_answers), 0) AS total_correct
  FROM school_members sm
  JOIN profiles p ON p.id = sm.user_id
  LEFT JOIN daily_activity da ON da.user_id = sm.user_id
  WHERE sm.school_id = p_school_id
  GROUP BY sm.user_id, p.display_name, p.avatar_url
  ORDER BY total_correct DESC, display_name ASC
  LIMIT 50;
$$;

-- 4. Create avatars storage bucket (run in SQL or create via Dashboard → Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS policies for avatars bucket

-- Anyone can view avatars (public bucket)
CREATE POLICY "Public avatar access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update (upsert) their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. Allow users to update their own avatar_url in profiles
-- (You may already have a general profiles update policy — if so, skip this)
-- This ensures the PATCH to profiles.avatar_url works:
CREATE POLICY "Users can update own avatar_url"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
