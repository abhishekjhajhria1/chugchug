import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { THEME_UNLOCKS, isThemeUnlocked } from "../lib/progression";
import type { Theme } from "../types";

// Re-export Theme type for backward compatibility
export type { Theme } from "../types";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme, userLevel?: number) => void;
  toggleTheme: () => void;
  getThemeUnlocks: (level: number) => { themeId: string; label: string; desc: string; emoji: string; locked: boolean; requiredLevel: number; requiredRank: string }[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_CLASSES: Theme[] = ["dark", "light", "midnight", "verdant", "sakura", "ember", "frost", "gold"];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("chugchug_theme");
    if (saved && THEME_CLASSES.includes(saved as Theme)) return saved as Theme;
    return "dark";
  });
  const [userId, setUserId] = useState<string | null>(null);
  const userLevelRef = useRef<number>(1);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    THEME_CLASSES.forEach(c => root.classList.remove(c));
    if (t !== "light") {
      root.classList.add(t);
    }
  };

  // On mount: listen for auth changes and load saved theme from DB
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUserId(session.user.id);
          const { data } = await supabase
            .from("profiles")
            .select("theme_preference, level")
            .eq("id", session.user.id)
            .single();
          if (data) {
            userLevelRef.current = data.level ?? 1;
            if (data.theme_preference && THEME_CLASSES.includes(data.theme_preference as Theme)) {
              // Verify saved theme is still unlocked at current level
              if (isThemeUnlocked(data.theme_preference, userLevelRef.current)) {
                setThemeState(data.theme_preference as Theme);
              } else {
                // Fallback to dark if saved theme is now locked
                setThemeState("dark");
              }
            }
          }
        } else {
          setUserId(null);
          userLevelRef.current = 1;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // When theme changes: persist to localStorage + Supabase
  useEffect(() => {
    localStorage.setItem("chugchug_theme", theme);
    applyTheme(theme);

    // Persist to DB (fire and forget — don't block UI)
    if (userId) {
      supabase
        .from("profiles")
        .update({ theme_preference: theme })
        .eq("id", userId)
        .then(); // non-blocking
    }
  }, [theme, userId]);

  const setTheme = (t: Theme, userLevel?: number) => {
    const level = userLevel ?? userLevelRef.current;
    if (!isThemeUnlocked(t, level)) {
      return; // Theme is locked — ignore
    }
    setThemeState(t);
  };

  const toggleTheme = () =>
    setThemeState(prev => {
      const level = userLevelRef.current;
      const currentIdx = THEME_CLASSES.indexOf(prev);
      // Cycle through themes, skipping locked ones
      for (let i = 1; i <= THEME_CLASSES.length; i++) {
        const nextTheme = THEME_CLASSES[(currentIdx + i) % THEME_CLASSES.length];
        if (isThemeUnlocked(nextTheme, level)) {
          return nextTheme;
        }
      }
      return prev; // No unlocked theme found (shouldn't happen — dark is always unlocked)
    });

  const getThemeUnlocks = (level: number) => {
    return THEME_UNLOCKS.map(t => ({
      themeId: t.themeId,
      label: t.label,
      desc: t.desc,
      emoji: t.emoji,
      locked: !isThemeUnlocked(t.themeId, level),
      requiredLevel: t.requiredLevel,
      requiredRank: t.requiredRank,
    }));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, getThemeUnlocks }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
