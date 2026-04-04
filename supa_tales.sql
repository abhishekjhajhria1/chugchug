-- Navigate to your Supabase Project -> SQL Editor
-- Paste this script and run it to enable Tales from the Void Features

-- 1. Create Reactions Table
CREATE TABLE IF NOT EXISTS public.world_experience_reactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    experience_id UUID NOT NULL REFERENCES public.world_experiences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure a user can only leave a specific emoji once per experience
ALTER TABLE public.world_experience_reactions ADD CONSTRAINT unique_user_emoji_exp UNIQUE (experience_id, user_id, emoji);

-- 2. Create Comments Table
CREATE TABLE IF NOT EXISTS public.world_experience_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    experience_id UUID NOT NULL REFERENCES public.world_experiences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Row Level Security for Reactions
ALTER TABLE public.world_experience_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions are viewable by everyone" ON public.world_experience_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reactions" ON public.world_experience_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reactions" ON public.world_experience_reactions FOR DELETE USING (auth.uid() = user_id);

-- 4. Row Level Security for Comments
ALTER TABLE public.world_experience_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone" ON public.world_experience_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON public.world_experience_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.world_experience_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.world_experience_comments FOR DELETE USING (auth.uid() = user_id);

-- 5. Helper Function to Add Profile Info to Comments
-- Done! The backend is now ready.
