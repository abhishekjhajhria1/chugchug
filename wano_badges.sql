-- =========================================================================
-- WANO ARC: BADGES & RANKS INITIALIZATION
-- Run this in your Supabase SQL Editor to populate the Wano Badges!
-- =========================================================================

-- 1. Create Badges Table
CREATE TABLE IF NOT EXISTS public.badges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create User Badges Junction Table
CREATE TABLE IF NOT EXISTS public.user_badges (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Policies for Badges (Anyone can read, only admin can write)
CREATE POLICY "Badges are visible to everyone" 
ON public.badges FOR SELECT USING (true);

-- Policies for User Badges
CREATE POLICY "User badges are visible to everyone" 
ON public.user_badges FOR SELECT USING (true);

CREATE POLICY "Users can insert their own badges"
ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- SEED WANO THEMED BADGES
-- =========================================================================
INSERT INTO public.badges (name, description, icon_text) VALUES 
('Ronin of the Night', 'Logged your first drink out in the open World', '⚔️'),
('Sake Brewer', 'Logged 10 distinct types of Sake', '🍶'),
('Shogun’s Banquet', 'Attended a Live Party with more than 5 members', '🍱'),
('Cherry Blossom Viewer', 'Stayed active during the spring season', '🌸'),
('Pirate King’s Thirst', 'Reached Level 50!', '👑'),
('Demon Blade', 'Appraised 50 logs with fire reactions', '👹'),
('Matcha Master', 'Logged a detox/recovery drink', '🍵'),
('Kozuki Clan Loyalist', 'Created your first Pirate Crew (Group)', '🏮')
ON CONFLICT DO NOTHING;

-- BONUS: Automatically grant the Ronin badge to all users as a welcome gift!
DO $$
DECLARE
    ronin_badge_id UUID;
    user_record RECORD;
BEGIN
    SELECT id INTO ronin_badge_id FROM public.badges WHERE name = 'Ronin of the Night' LIMIT 1;
    
    IF ronin_badge_id IS NOT NULL THEN
        FOR user_record IN SELECT id FROM public.profiles LOOP
            INSERT INTO public.user_badges (user_id, badge_id) 
            VALUES (user_record.id, ronin_badge_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
