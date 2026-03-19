-- ═══════════════════════════════════════════════════════════
-- ChugChug — Live Social Features Migration
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Beer Counts — daily per-user beer tracking
CREATE TABLE IF NOT EXISTS beer_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  count integer DEFAULT 0 NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  shared_to_group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  shared_publicly boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, date)
);

ALTER TABLE beer_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own beer counts" ON beer_counts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own beer counts" ON beer_counts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own beer counts" ON beer_counts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Public beer counts are readable" ON beer_counts
  FOR SELECT USING (shared_publicly = true);

-- 2. Photo Verifications — friends vouch for photo authenticity
CREATE TABLE IF NOT EXISTS photo_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid REFERENCES activity_logs(id) ON DELETE CASCADE NOT NULL,
  verifier_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(log_id, verifier_id)
);

ALTER TABLE photo_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read verifications" ON photo_verifications
  FOR SELECT USING (true);
CREATE POLICY "Users can insert verifications" ON photo_verifications
  FOR INSERT WITH CHECK (auth.uid() = verifier_id);

-- 3. Session Friends — temporary QR-based pairing
CREATE TABLE IF NOT EXISTS session_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_b uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '24 hours') NOT NULL,
  CHECK (user_a <> user_b)
);

ALTER TABLE session_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions" ON session_friends
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Users can insert sessions" ON session_friends
  FOR INSERT WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Users can update own sessions" ON session_friends
  FOR UPDATE USING (auth.uid() = user_a OR auth.uid() = user_b);

-- 4. Add group_id to parties (group-started parties)
ALTER TABLE parties ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES groups(id) ON DELETE SET NULL;

-- 5. Add privacy_settings jsonb to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_settings jsonb DEFAULT '{
  "beer_counter": "group",
  "location_sharing": "off",
  "photo_metadata": "show",
  "session_requests": "prompt",
  "default_visibility": "group"
}'::jsonb;

-- 6. Index for beer_counts lookups
CREATE INDEX IF NOT EXISTS idx_beer_counts_user_date ON beer_counts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_beer_counts_group ON beer_counts(shared_to_group_id) WHERE shared_to_group_id IS NOT NULL;
-- 7. Storage Bucket and Policies
-- Ensure 'photos' bucket exists (can also be created in Supabase Dashboard)
INSERT INTO storage.buckets (id, name, public)
SELECT 'photos', 'photos', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'photos');

-- Storage Policies for 'photos' bucket
-- Allow public to view photos
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'photos' AND (auth.uid())::text = (storage.foldername(name))[1]);
