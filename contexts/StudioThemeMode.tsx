import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { Platform, useColorScheme } from "react-native";
import { StudioColors, StudioColorsDark, StudioPalette } from "@/constants/studio-tokens";

export type StudioThemeMode = "light" | "dark" | "auto";

type ContextValue = {
  mode: StudioThemeMode;
  isDark: boolean;
  tokens: StudioPalette;
  setMode: (m: StudioThemeMode) => void;
};

const StudioThemeContext = createContext<ContextValue>({
  mode: "light",
  isDark: false,
  tokens: StudioColors,
  setMode: () => {},
});

const STORAGE_KEY = "aura_studio_theme_mode";

export function StudioThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<StudioThemeMode>("light");

  // Carrega preferência salva
  useEffect(() => {
    if (Platform.OS !== "web") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as StudioThemeMode | null;
      if (saved === "light" || saved === "dark" || saved === "auto") {
        setModeState(saved);
      }
    } catch {}
  }, []);

  function setMode(m: StudioThemeMode) {
    setModeState(m);
    if (Platform.OS === "web") {
      try { window.localStorage.setItem(STORAGE_KEY, m); } catch {}
    }
  }

  const isDark = useMemo(() => {
    if (mode === "auto") return systemScheme === "dark";
    return mode === "dark";
  }, [mode, systemScheme]);

  const tokens = useMemo(() => (isDark ? (StudioColorsDark as any as StudioPalette) : StudioColors), [isDark]);

  return (
    <StudioThemeContext.Provider value={{ mode, isDark, tokens, setMode }}>
      {children}
    </StudioThemeContext.Provider>
  );
}

export function useStudioTokens(): StudioPalette {
  return useContext(StudioThemeContext).tokens;
}

export function useStudioTheme() {
  return useContext(StudioThemeContext);
}
