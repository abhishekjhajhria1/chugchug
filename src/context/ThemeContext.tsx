import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { THEMES, THEME_IDS, type ThemeMeta } from "../lib/progression";
import type { Theme } from "../types";

// Re-export Theme type for backward compatibility
export type { Theme } from "../types";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  /** Full catalog of selectable themes (for the picker). */
  themes: ThemeMeta[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DEFAULT_THEME: Theme = "minimal";
const isTheme = (v: unknown): v is Theme =>
  typeof v === "string" && THEME_IDS.includes(v);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("chugchug_theme");
    return isTheme(saved) ? saved : DEFAULT_THEME;
  });
  const [userId, setUserId] = useState<string | null>(null);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    THEME_IDS.forEach(c => root.classList.remove(c));
    // `light` is the bare :root baseline — every other theme is an explicit class.
    if (t !== "light") root.classList.add(t);
    root.dataset.theme = t;
    root.style.colorScheme = THEMES.find(x => x.themeId === t)?.mode ?? "dark";
  };

  // On mount: listen for auth changes and load the saved theme from the DB.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUserId(session.user.id);
          const { data } = await supabase
            .from("profiles")
            .select("theme_preference")
            .eq("id", session.user.id)
            .single();
          if (data && isTheme(data.theme_preference)) {
            setThemeState(data.theme_preference);
          }
        } else {
          setUserId(null);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // When theme changes: persist to localStorage + Supabase, apply to <html>.
  useEffect(() => {
    localStorage.setItem("chugchug_theme", theme);
    applyTheme(theme);
    if (userId) {
      supabase.from("profiles").update({ theme_preference: theme }).eq("id", userId).then();
    }
  }, [theme, userId]);

  const setTheme = (t: Theme) => {
    if (isTheme(t)) setThemeState(t);
  };

  const toggleTheme = () =>
    setThemeState(prev => {
      const idx = THEME_IDS.indexOf(prev);
      return THEME_IDS[(idx + 1) % THEME_IDS.length] as Theme;
    });

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
