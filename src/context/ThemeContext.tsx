import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { THEME_UNLOCKS, isThemeUnlocked } from "../lib/progression";

export type Theme = "dark" | "light" | "verdant" | "sakura";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme, userLevel?: number) => void;
  toggleTheme: () => void;
  getThemeUnlocks: (level: number) => { themeId: string; label: string; desc: string; emoji: string; locked: boolean; requiredLevel: number; requiredRank: string }[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_CLASSES: Theme[] = ["dark", "light", "verdant", "sakura"];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("chugchug_theme");
    if (saved && THEME_CLASSES.includes(saved as Theme)) return saved as Theme;
    return "dark";
  });
  const [userId, setUserId] = useState<string | null>(null);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    THEME_CLASSES.forEach(c => root.classList.remove(c));
    if (t !== "light") {
      root.classList.add(t);
    }
  };

  // On mount: get current user and load their saved theme from DB
  useEffect(() => {
    const loadSavedTheme = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase
          .from("profiles")
          .select("theme_preference")
          .eq("id", user.id)
          .single();
        if (data?.theme_preference && THEME_CLASSES.includes(data.theme_preference as Theme)) {
          setThemeState(data.theme_preference as Theme);
        }
      }
    };
    loadSavedTheme();
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
    // If userLevel provided, check if theme is unlocked
    if (userLevel !== undefined && !isThemeUnlocked(t, userLevel)) {
      return; // Theme is locked — ignore
    }
    setThemeState(t);
  };

  const toggleTheme = () =>
    setThemeState(prev => {
      const idx = THEME_CLASSES.indexOf(prev);
      return THEME_CLASSES[(idx + 1) % THEME_CLASSES.length];
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
