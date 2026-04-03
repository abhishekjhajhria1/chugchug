-- Create the persistent friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    action_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure user_1 < user_2 to prevent duplicate A->B and B->A rows
    CONSTRAINT check_user_order CHECK (user_1 < user_2),
    UNIQUE(user_1, user_2)
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own friendships"
    ON public.friendships FOR SELECT
    USING (auth.uid() = user_1 OR auth.uid() = user_2);

CREATE POLICY "Users can insert friendships where they are involved"
    ON public.friendships FOR INSERT
    WITH CHECK ((auth.uid() = user_1 OR auth.uid() = user_2) AND auth.uid() = action_user_id);

CREATE POLICY "Users can update friendships where they are involved"
    ON public.friendships FOR UPDATE
    USING (auth.uid() = user_1 OR auth.uid() = user_2);

CREATE POLICY "Users can delete their own friendships"
    ON public.friendships FOR DELETE
    USING (auth.uid() = user_1 OR auth.uid() = user_2);

-- RPC for Getting Friends
CREATE OR REPLACE FUNCTION get_friends(user_uuid UUID)
RETURNS TABLE (
    friend_id UUID,
    username TEXT,
    avatar_url TEXT,
    level INTEGER,
    xp INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS friend_id,
        p.username,
        p.avatar_url,
        p.level,
        p.xp
    FROM public.friendships f
    JOIN public.profiles p ON (p.id = f.user_1 OR p.id = f.user_2) AND p.id != user_uuid
    WHERE (f.user_1 = user_uuid OR f.user_2 = user_uuid)
      AND f.status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to get recommended friends based on session_friends history
CREATE OR REPLACE FUNCTION get_past_partiers(user_uuid UUID)
RETURNS TABLE (
    suggested_id UUID,
    username TEXT,
    avatar_url TEXT,
    interaction_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sf.other_user AS suggested_id,
        p.username,
        p.avatar_url,
        COUNT(*) as interaction_count
    FROM (
        SELECT user_b AS other_user FROM public.session_friends WHERE user_a = user_uuid
        UNION ALL
        SELECT user_a AS other_user FROM public.session_friends WHERE user_b = user_uuid
    ) sf
    JOIN public.profiles p ON p.id = sf.other_user
    LEFT JOIN public.friendships f ON 
        (f.user_1 = user_uuid AND f.user_2 = sf.other_user) OR 
        (f.user_1 = sf.other_user AND f.user_2 = user_uuid)
    -- Only suggest if they are NOT already friends or pending
    WHERE f.id IS NULL
    GROUP BY sf.other_user, p.username, p.avatar_url
    ORDER BY interaction_count DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
