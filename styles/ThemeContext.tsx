"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { Palette, ThemeName, legacyPalette } from "./themes";

interface ThemeContextValue {
  theme: ThemeName;
  palette: Palette;
  setTheme: (name: ThemeName) => void;
}

const STORAGE_KEY = "addex-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "legacy",
  palette: legacyPalette,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "legacy");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = (_name: ThemeName) => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <ThemeContext.Provider
      value={{ theme: "legacy", palette: legacyPalette, setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}

export function useTheme(): Palette {
  return useContext(ThemeContext).palette;
}
