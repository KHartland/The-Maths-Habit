-- =============================================
-- THE MATHS HABIT - SUPABASE DATABASE SETUP
-- =============================================
-- Run this SQL in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste & Run

-- 1. USER PROFILES TABLE
-- Stores user display name, subscription status, and settings
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  tier text default 'foundation',
  subscription_status text default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for faster Stripe webhook lookups
create index if not exists idx_profiles_stripe_customer_id on public.profiles(stripe_customer_id);

-- 2. USER PROGRESS TABLE
-- Stores progress per objective (migrated from localStorage)
create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  objective_code text not null,
  quick_correct integer default 0,
  exam_passed boolean default false,
  last_practiced timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, objective_code)
);

-- 3. FSRS CARDS TABLE
-- Stores spaced repetition data per question
create table if not exists public.user_fsrs_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  question_id text not null,
  stability float default 1.0,
  difficulty float default 0.5,
  last_review timestamp with time zone,
  next_review timestamp with time zone,
  reps integer default 0,
  lapses integer default 0,
  state text default 'new',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, question_id)
);

-- 4. STREAK DATA TABLE
-- Stores streak information
create table if not exists public.user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null unique,
  current_streak integer default 0,
  longest_streak integer default 0,
  freezes_available integer default 0,
  last_activity_date date,
  streak_data jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. USER SETTINGS TABLE
-- Stores user preferences
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null unique,
  questions_per_session integer default 7,
  show_hints boolean default true,
  include_higher_tier boolean default false,
  daily_goal integer default 7,
  weekly_mastery_goal integer default 3,
  font_size text default 'normal',
  dyslexia_font boolean default false,
  high_contrast boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. DAILY ACTIVITY TABLE
-- Stores daily question counts for streak tracking
create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  questions_answered integer default 0,
  correct_answers integer default 0,
  mastery_gained integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, date)
);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================
-- These ensure users can only access their own data

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_fsrs_cards enable row level security;
alter table public.user_streaks enable row level security;
alter table public.user_settings enable row level security;
alter table public.daily_activity enable row level security;

-- Profiles policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Progress policies
create policy "Users can view own progress" on public.user_progress
  for select using (auth.uid() = user_id);
create policy "Users can update own progress" on public.user_progress
  for update using (auth.uid() = user_id);
create policy "Users can insert own progress" on public.user_progress
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own progress" on public.user_progress
  for delete using (auth.uid() = user_id);

-- FSRS cards policies
create policy "Users can view own fsrs cards" on public.user_fsrs_cards
  for select using (auth.uid() = user_id);
create policy "Users can update own fsrs cards" on public.user_fsrs_cards
  for update using (auth.uid() = user_id);
create policy "Users can insert own fsrs cards" on public.user_fsrs_cards
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own fsrs cards" on public.user_fsrs_cards
  for delete using (auth.uid() = user_id);

-- Streaks policies
create policy "Users can view own streaks" on public.user_streaks
  for select using (auth.uid() = user_id);
create policy "Users can update own streaks" on public.user_streaks
  for update using (auth.uid() = user_id);
create policy "Users can insert own streaks" on public.user_streaks
  for insert with check (auth.uid() = user_id);

-- Settings policies
create policy "Users can view own settings" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "Users can update own settings" on public.user_settings
  for update using (auth.uid() = user_id);
create policy "Users can insert own settings" on public.user_settings
  for insert with check (auth.uid() = user_id);

-- Daily activity policies
create policy "Users can view own daily activity" on public.daily_activity
  for select using (auth.uid() = user_id);
create policy "Users can update own daily activity" on public.daily_activity
  for update using (auth.uid() = user_id);
create policy "Users can insert own daily activity" on public.daily_activity
  for insert with check (auth.uid() = user_id);

-- =============================================
-- FUNCTION: Auto-create profile on signup
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');

  insert into public.user_settings (user_id)
  values (new.id);

  insert into public.user_streaks (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call function on new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- DONE! Your database is ready.
-- =============================================
