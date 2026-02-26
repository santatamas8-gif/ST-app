"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getThemeById, THEMES, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";

function applyTheme(themeId: string | null) {
  const theme = getThemeById(themeId);
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--page-bg", theme.pageBg);
  document.documentElement.style.setProperty("--card-bg", theme.cardBg);
  document.documentElement.style.setProperty("--card-border", theme.cardBorder);
}

type ThemeContextValue = { themeId: ThemeId | null; setThemeId: (id: ThemeId) => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { themeId: "black" as ThemeId, setThemeId: () => {} };
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    const id = THEMES.some((t) => t.id === stored) ? stored : "black";
    setThemeIdState(id);
    applyTheme(id);
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    applyTheme(id);
  }, []);

  return (
    <ThemeContext.Provider value={{ themeId: themeId ?? "black", setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}
