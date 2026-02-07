-- 1v1 Match System for The Maths Habit
-- Run this in your Supabase SQL Editor

-- Matches table - stores game sessions
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,

  -- Players
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  host_name VARCHAR(100),
  guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name VARCHAR(100),

  -- Game settings
  question_count INT DEFAULT 10,
  tier VARCHAR(20) DEFAULT 'foundation', -- 'foundation' or 'higher'
  topics TEXT[] DEFAULT ARRAY['number', 'algebra', 'ratio', 'geometry', 'probability', 'statistics'],

  -- Questions (stored as JSON array of question objects)
  questions JSONB,

  -- Game state
  status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'ready', 'playing', 'finished'
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,

  -- Scores
  host_score INT DEFAULT 0,
  host_answers JSONB DEFAULT '[]'::jsonb,
  host_finished_at TIMESTAMPTZ,

  guest_score INT DEFAULT 0,
  guest_answers JSONB DEFAULT '[]'::jsonb,
  guest_finished_at TIMESTAMPTZ,

  -- Winner
  winner_id UUID REFERENCES auth.users(id),
  winner_reason VARCHAR(20), -- 'score' or 'time'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding matches by code
CREATE INDEX IF NOT EXISTS idx_matches_code ON matches(code);

-- Index for finding user's matches
CREATE INDEX IF NOT EXISTS idx_matches_host ON matches(host_id);
CREATE INDEX IF NOT EXISTS idx_matches_guest ON matches(guest_id);

-- Enable Row Level Security
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Policies: Users can read matches they're part of
CREATE POLICY "Users can view their matches" ON matches
  FOR SELECT USING (
    auth.uid() = host_id OR
    auth.uid() = guest_id OR
    status = 'waiting' -- Allow seeing waiting matches to join
  );

-- Policies: Host can create matches
CREATE POLICY "Users can create matches" ON matches
  FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Policies: Players can update their own data in matches
CREATE POLICY "Players can update match" ON matches
  FOR UPDATE USING (
    auth.uid() = host_id OR auth.uid() = guest_id
  );

-- Enable realtime for matches table
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- Function to generate unique 6-digit code
CREATE OR REPLACE FUNCTION generate_match_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  new_code VARCHAR(6);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 6-character alphanumeric code (uppercase)
    new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM matches WHERE code = new_code AND status != 'finished') INTO code_exists;

    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
