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
        console.log("Fetching profile for:", userId)
        const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        console.log("Fetched profile data:", data)
        if (data) setProfile(data);
    };

    const refreshProfile = async () => {
        console.log("refreshProfile triggered, user is:", user?.id)
        if (user) await fetchProfile(user.id);
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
                if (session?.user) {
                    fetchProfile(session.user.id).finally(() => setLoading(false));
                } else {
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
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
