import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { Platform, useColorScheme } from "react-native";

// ============================================================
// FE-06: Theme Context (toggle without reload)
// Provides theme state + toggle function via React Context
// ============================================================

type ThemeMode = "dark" | "light" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  isDark: true,
  setMode: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "aura_theme_mode";

function getStoredTheme(): ThemeMode {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "dark";
  }
  return "dark";
}

function storeTheme(mode: ThemeMode) {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, mode);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(getStoredTheme);

  const isDark = mode === "system"
    ? systemScheme !== "light"
    : mode === "dark";

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    storeTheme(newMode);
  }, []);

  const toggle = useCallback(() => {
    setMode(isDark ? "light" : "dark");
  }, [isDark, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;
