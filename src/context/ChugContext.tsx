import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
    id: string;
    username: string;
    xp: number;
    level: number;
    avatar_url: string | null;
    bio: string | null;
    college: string | null;
    city: string | null;
    country: string | null;
    stealth_mode?: boolean;
    privacy_settings?: any;
}

interface ChugContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
}

const ChugContext = createContext<ChugContextType | undefined>(undefined);

export function ChugProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (error) {
                console.error("Error fetching profile:", error);
                // Return gracefully instead of crashing
                return;
            }
            if (data) setProfile(data);
        } catch (e) {
            console.error("Fatal exception in fetchProfile:", e);
        }
    };

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchProfile(session.user.id);
                setLoading(false);
            } else {
                setLoading(false);
            }
        });

        let channel: any

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                    setLoading(false);

                    // Set up realtime listener for the profile
                    if (channel) supabase.removeChannel(channel)
                    channel = supabase.channel(`public:profiles:id=eq.${session.user.id}`)
                        .on(
                            'postgres_changes',
                            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
                            (payload) => {
                                const newProfile = payload.new as UserProfile
                                setProfile(prev => {
                                    if (prev) {
                                        if (newProfile.xp > prev.xp && (window as any).triggerXpAnimation) {
                                            (window as any).triggerXpAnimation(newProfile.xp - prev.xp)
                                        }
                                        if (newProfile.level > prev.level && (window as any).triggerLevelUpAnimation) {
                                            (window as any).triggerLevelUpAnimation()
                                        }
                                    }
                                    return newProfile
                                })
                            }
                        )
                        .subscribe()
                } else {
                    if (channel) supabase.removeChannel(channel)
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
            if (channel) supabase.removeChannel(channel)
        };
    }, []);

    return (
        <ChugContext.Provider value={{ user, profile, loading, refreshProfile }}>
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
