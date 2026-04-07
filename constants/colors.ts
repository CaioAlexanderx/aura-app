import { create } from "zustand";
import { Platform } from "react-native";

const THEME_KEY = "aura_theme";

function getInitialTheme(): boolean {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return true;
  }
  return true;
}

const IS_DARK = getInitialTheme();

const Dark = {
  bg: "#060816", bg2: "#090c1a", bg3: "#0e1228", bg4: "#141830",
  ink: "#f0edff", ink2: "rgba(220,215,255,0.75)", ink3: "rgba(170,160,235,0.65)",
  border: "rgba(255,255,255,0.07)", border2: "rgba(120,100,240,0.22)",
  violet: "#7c3aed", violet2: "#8b5cf6", violet3: "#a78bfa", violet4: "#c4b5fd",
  violetD: "rgba(109,40,217,0.14)",
  green: "#34d399", greenD: "rgba(52,211,153,0.10)",
  red: "#f87171", redD: "rgba(248,113,113,0.10)",
  amber: "#fbbf24", amberD: "rgba(251,191,36,0.10)",
} as const;

const Light = {
  bg: "#f5f3ff", bg2: "#ffffff", bg3: "#ffffff", bg4: "#f0edf8",
  ink: "#1a1a2e", ink2: "#3d3660", ink3: "#6b6193",
  border: "rgba(109,40,217,0.10)", border2: "rgba(120,100,240,0.15)",
  violet: "#7c3aed", violet2: "#8b5cf6", violet3: "#6d28d9", violet4: "#5b21b6",
  violetD: "rgba(109,40,217,0.06)",
  green: "#059669", greenD: "rgba(5,150,105,0.08)",
  red: "#dc2626", redD: "rgba(220,38,38,0.06)",
  amber: "#d97706", amberD: "rgba(217,119,6,0.06)",
} as const;

export const Colors = IS_DARK ? { ...Dark } : { ...Light };

type ThemeState = {
  isDark: boolean;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: IS_DARK,
  toggle: () => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    try {
      const next = !get().isDark;
      set({ isDark: next });
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      // B5 FIX: defer reload and wrap in try/catch to prevent crash
      setTimeout(() => {
        try {
          window.location.href = window.location.pathname + window.location.search;
        } catch {
          // If href assignment fails, do nothing - theme persists on next manual reload
        }
      }, 100);
    } catch (e) {
      console.warn("Theme toggle error:", e);
      // B5 FIX: do NOT call reload in catch - it was causing infinite crash loop
    }
  },
}));

export function useColors() {
  const isDark = useThemeStore(s => s.isDark);
  return isDark ? Dark : Light;
}

export const DarkPalette = Dark;
export const LightPalette = Light;
