import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

export type Theme = "dark" | "light" | "verdant";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_CLASSES: Theme[] = ["dark", "light", "verdant"];

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

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () =>
    setThemeState(prev => {
      const idx = THEME_CLASSES.indexOf(prev);
      return THEME_CLASSES[(idx + 1) % THEME_CLASSES.length];
    });

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
