-- ═══════════════════════════════════════════════════════════
-- Square One Maths — Full Supabase Setup
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS throughout
-- ═══════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════
-- 1. MATCHES (1v1 Battle)
-- ═══════════════════════════════════════════════════════════
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

alter table public.matches enable row level security;

do $$ begin
  create policy "matches_insert" on public.matches for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "matches_select" on public.matches for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "matches_update" on public.matches for update to authenticated
    using (host_id = auth.uid() or guest_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "matches_delete" on public.matches for delete to authenticated
    using (host_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- Enable Realtime for live score updates
alter publication supabase_realtime add table public.matches;


-- ═══════════════════════════════════════════════════════════
-- 2. SCHOOLS
-- ═══════════════════════════════════════════════════════════
create table if not exists public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  town        text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

alter table public.schools enable row level security;

-- Anyone can search schools (including if auth token briefly expires)
do $$ begin
  create policy "schools_select" on public.schools for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "schools_select_anon" on public.schools for select to anon using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "schools_insert" on public.schools for insert to authenticated with check (true);
exception when duplicate_object then null;
end $$;


-- ═══════════════════════════════════════════════════════════
-- 3. SCHOOL MEMBERS (join table)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.school_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  joined_at   timestamptz default now(),
  unique(user_id)  -- each user can only be in one school
);

alter table public.school_members enable row level security;

do $$ begin
  create policy "school_members_select" on public.school_members for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "school_members_insert" on public.school_members for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "school_members_delete" on public.school_members for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;


-- ═══════════════════════════════════════════════════════════
-- 4. USER PROGRESS (if not already created)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.user_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  objective_code  text not null,
  quick_correct   integer default 0,
  exam_passed     boolean default false,
  last_practiced  timestamptz,
  updated_at      timestamptz default now(),
  unique(user_id, objective_code)
);

alter table public.user_progress enable row level security;

do $$ begin
  create policy "user_progress_select" on public.user_progress for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "user_progress_insert" on public.user_progress for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "user_progress_update" on public.user_progress for update to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;


-- ═══════════════════════════════════════════════════════════
-- 5. DAILY ACTIVITY (if not already created)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.daily_activity (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  date               date not null,
  questions_answered integer default 0,
  correct_answers    integer default 0,
  mastery_gained     integer default 0,
  updated_at         timestamptz default now(),
  unique(user_id, date)
);

alter table public.daily_activity enable row level security;

do $$ begin
  create policy "daily_activity_select" on public.daily_activity for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "daily_activity_insert" on public.daily_activity for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "daily_activity_update" on public.daily_activity for update to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;


-- ═══════════════════════════════════════════════════════════
-- 6. PROFILES (if not already created)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text,
  first_name          text,
  surname             text,
  subscription_status text default 'free',
  subscription_type   text,
  promo_code_used     text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Add first_name/surname to existing profiles table (safe to re-run)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS surname text;

alter table public.profiles enable row level security;

do $$ begin
  create policy "profiles_select" on public.profiles for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "profiles_insert" on public.profiles for insert to authenticated
    with check (id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "profiles_update" on public.profiles for update to authenticated
    using (id = auth.uid());
exception when duplicate_object then null;
end $$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ═══════════════════════════════════════════════════════════
-- 7. USER STREAKS (if not already created)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.user_streaks (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  current_streak     integer default 0,
  longest_streak     integer default 0,
  freezes_available  integer default 0,
  last_activity_date text,
  streak_data        jsonb default '{}'::jsonb,
  updated_at         timestamptz default now()
);

alter table public.user_streaks enable row level security;

do $$ begin
  create policy "user_streaks_select" on public.user_streaks for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "user_streaks_insert" on public.user_streaks for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "user_streaks_update" on public.user_streaks for update to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;


-- ═══════════════════════════════════════════════════════════
-- 8. USER SETTINGS (if not already created)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.user_settings (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  questions_per_session  integer default 7,
  show_hints            boolean default true,
  include_higher_tier   boolean default false,
  daily_goal            integer default 7,
  weekly_mastery_goal   integer default 3,
  font_size             text default 'normal',
  dyslexia_font         boolean default false,
  high_contrast         boolean default false,
  updated_at            timestamptz default now()
);

alter table public.user_settings enable row level security;

do $$ begin
  create policy "user_settings_select" on public.user_settings for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "user_settings_insert" on public.user_settings for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "user_settings_update" on public.user_settings for update to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;


-- ═══════════════════════════════════════════════════════════
-- 9. USER FSRS CARDS (spaced repetition — if not already created)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.user_fsrs_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  stability   float default 1.0,
  difficulty  float default 0.5,
  last_review timestamptz,
  next_review timestamptz,
  reps        integer default 0,
  lapses      integer default 0,
  state       text default 'new',
  updated_at  timestamptz default now(),
  unique(user_id, question_id)
);

alter table public.user_fsrs_cards enable row level security;

do $$ begin
  create policy "user_fsrs_cards_select" on public.user_fsrs_cards for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "user_fsrs_cards_insert" on public.user_fsrs_cards for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "user_fsrs_cards_update" on public.user_fsrs_cards for update to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;


-- ═══════════════════════════════════════════════════════════
-- 10. SCHOOL LEADERBOARD RPC FUNCTION
-- Sums quick_correct from user_progress for each school member
-- ═══════════════════════════════════════════════════════════
-- Drop first because return type changed (added first_name, surname)
drop function if exists public.get_school_leaderboard(uuid);

create or replace function public.get_school_leaderboard(p_school_id uuid)
returns table (
  user_id       uuid,
  display_name  text,
  first_name    text,
  surname       text,
  total_correct bigint
)
language sql
security definer
stable
as $$
  select
    sm.user_id,
    coalesce(p.display_name, split_part(u.email, '@', 1)) as display_name,
    p.first_name,
    p.surname,
    coalesce(sum(up.quick_correct), 0) as total_correct
  from public.school_members sm
  join auth.users u on u.id = sm.user_id
  left join public.profiles p on p.id = sm.user_id
  left join public.user_progress up on up.user_id = sm.user_id
  where sm.school_id = p_school_id
  group by sm.user_id, p.display_name, u.email, p.first_name, p.surname
  order by total_correct desc, display_name asc;
$$;


-- ═══════════════════════════════════════════════════════════
-- 11. TEACHER ROLE & READ-ACCESS POLICIES
-- Lets a teacher see student data within their school.
-- Safe to re-run. Does NOT affect students — they still
-- only see their own data.
-- After running, promote yourself:
--   UPDATE profiles SET role = 'teacher' WHERE id = 'YOUR-UUID';
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'student';

CREATE OR REPLACE FUNCTION public.is_teacher_for_user(target_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.school_members sm_teacher ON sm_teacher.user_id = auth.uid()
    JOIN public.school_members sm_student ON sm_student.user_id = target_user_id
    WHERE p.id = auth.uid() AND p.role = 'teacher'
      AND sm_teacher.school_id = sm_student.school_id
  );
$$;

-- Replace the 3 restrictive SELECT policies with teacher-aware ones
DROP POLICY IF EXISTS "user_progress_select" ON public.user_progress;
CREATE POLICY "user_progress_select" ON public.user_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_teacher_for_user(user_id));

DROP POLICY IF EXISTS "daily_activity_select" ON public.daily_activity;
CREATE POLICY "daily_activity_select" ON public.daily_activity FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_teacher_for_user(user_id));

DROP POLICY IF EXISTS "user_streaks_select" ON public.user_streaks;
CREATE POLICY "user_streaks_select" ON public.user_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_teacher_for_user(user_id));


-- ═══════════════════════════════════════════════════════════
-- DONE! All tables, policies, and functions are set up.
-- ═══════════════════════════════════════════════════════════
