-- live_party_rpc.sql
-- Run this in your Supabase SQL Editor to support the XP Scaling for Party-size bonuses!

CREATE OR REPLACE FUNCTION add_party_xp(user_id_param UUID, base_xp INT, party_size INT)
RETURNS INT AS $$
DECLARE
    bonus_multiplier FLOAT;
    total_xp INT;
BEGIN
    -- Base multiplier for single player
    bonus_multiplier := 1.0;
    
    -- Bonus multipliers based on party size (rewarding larger groups)
    IF party_size = 2 THEN
        bonus_multiplier := 1.25;
    ELSIF party_size >= 3 AND party_size <= 5 THEN
        bonus_multiplier := 1.5;
    ELSIF party_size > 5 THEN
        bonus_multiplier := 2.0;
    END IF;

    -- Calculate total XP (base * size * bonus)
    total_xp := ROUND(base_xp * party_size * bonus_multiplier);

    -- Check if user profile exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_id_param) THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    -- Update the user's XP in the profiles table directly
    UPDATE profiles
    SET xp = xp + total_xp
    WHERE id = user_id_param;

    -- Return the calculated xp so the frontend can log it in activity_logs
    RETURN total_xp;
END;
$$ LANGUAGE plpgsql;
