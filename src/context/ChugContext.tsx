import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "../types";

interface ChugContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
    /** Subscribe to XP gain events */
    onXpGain: (cb: (delta: number) => void) => () => void;
    /** Subscribe to level-up events */
    onLevelUp: (cb: () => void) => () => void;
}

const ChugContext = createContext<ChugContextType | undefined>(undefined);

export function ChugProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Event subscribers (replaces window-based event bus)
    const xpListeners = useRef<Set<(delta: number) => void>>(new Set());
    const levelUpListeners = useRef<Set<() => void>>(new Set());

    const onXpGain = useCallback((cb: (delta: number) => void) => {
        xpListeners.current.add(cb);
        return () => { xpListeners.current.delete(cb); };
    }, []);

    const onLevelUp = useCallback((cb: () => void) => {
        levelUpListeners.current.add(cb);
        return () => { levelUpListeners.current.delete(cb); };
    }, []);

    const fetchProfile = async (userId: string, retries = 3) => {
        try {
            for (let i = 0; i < retries; i++) {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("id, username, xp, level, avatar_url, bio, college, city, country, stealth_mode, privacy_settings, current_streak, longest_streak, last_activity_date, archetype, theme_preference")
                    .eq("id", userId)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116' && i < retries - 1) {
                        // Race condition on signup: wait 500ms and retry
                        await new Promise(r => setTimeout(r, 500));
                        continue;
                    }
                    console.error("Error fetching profile:", error);
                    return;
                }
                
                if (data) {
                    setProfile(data as UserProfile);
                    return;
                }
            }
        } catch (e) {
            console.error("Fatal exception in fetchProfile:", e);
        }
    };

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel> | null = null;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                    setLoading(false);

                    // Set up realtime listener for the profile
                    if (channel) supabase.removeChannel(channel);
                    channel = supabase.channel(`public:profiles:id=eq.${session.user.id}`)
                        .on(
                            'postgres_changes',
                            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
                            (payload) => {
                                const newProfile = payload.new as UserProfile;
                                setProfile(prev => {
                                    if (prev) {
                                        // Notify subscribers instead of using window globals
                                        if (newProfile.xp > prev.xp) {
                                            const delta = newProfile.xp - prev.xp;
                                            xpListeners.current.forEach(cb => cb(delta));
                                        }
                                        if (newProfile.level > prev.level) {
                                            levelUpListeners.current.forEach(cb => cb());
                                        }
                                    }
                                    return newProfile;
                                });
                            }
                        )
                        .subscribe();
                } else {
                    if (channel) supabase.removeChannel(channel);
                    channel = null;
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        // Fallback: if no auth event fires within 2s, resolve as no session
        const timeout = setTimeout(() => setLoading(false), 2000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    return (
        <ChugContext.Provider value={{ user, profile, loading, refreshProfile, onXpGain, onLevelUp }}>
            {children}
        </ChugContext.Provider>
    );
}

export function useChug() {
    const context = useContext(ChugContext);
    if (context === undefined) {
        throw new Error("useChug must be used within a ChugProvider");
    }
    return context;
}
