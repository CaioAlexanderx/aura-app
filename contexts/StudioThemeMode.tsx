import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { Platform, useColorScheme } from "react-native";
import { StudioColors, StudioColorsDark, StudioPalette } from "@/constants/studio-tokens";
import { getStudioSemantic, StudioSemanticPalette } from "@/constants/studio-semantic";

export type StudioThemeMode = "light" | "dark" | "auto";

type ContextValue = {
  mode: StudioThemeMode;
  isDark: boolean;
  tokens: StudioPalette;
  semantic: StudioSemanticPalette;
  setMode: (m: StudioThemeMode) => void;
};

// Default DARK (Fase 0 / DA-2): Studio é trabalho color-critical e
// defaulta dark como Photoshop/Lightroom/Figma. Light segue via toggle.
const StudioThemeContext = createContext<ContextValue>({
  mode: "dark",
  isDark: true,
  tokens: StudioColorsDark as any as StudioPalette,
  semantic: getStudioSemantic(true),
  setMode: () => {},
});

const STORAGE_KEY = "aura_studio_theme_mode";

export function StudioThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  // Dark-first: estado inicial = dark (DA-2). Preferência salva sobrescreve.
  const [mode, setModeState] = useState<StudioThemeMode>("dark");

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

  const tokens = useMemo(
    () => (isDark ? (StudioColorsDark as any as StudioPalette) : StudioColors),
    [isDark]
  );
  const semantic = useMemo(() => getStudioSemantic(isDark), [isDark]);

  return (
    <StudioThemeContext.Provider value={{ mode, isDark, tokens, semantic, setMode }}>
      {children}
    </StudioThemeContext.Provider>
  );
}

export function useStudioTokens(): StudioPalette {
  return useContext(StudioThemeContext).tokens;
}

export function useStudioSemantic(): StudioSemanticPalette {
  return useContext(StudioThemeContext).semantic;
}

export function useStudioTheme() {
  return useContext(StudioThemeContext);
}
