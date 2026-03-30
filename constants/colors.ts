import { create } from "zustand";
import { Platform } from "react-native";

// ── Dark palette (default) ───────────────────────────────────
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

// ── Light palette ────────────────────────────────────────────
const Light = {
  bg: "#f8f7fc", bg2: "#ffffff", bg3: "#ffffff", bg4: "#f0eef6",
  ink: "#1a1a2e", ink2: "rgba(30,25,60,0.72)", ink3: "rgba(80,70,130,0.6)",
  border: "rgba(0,0,0,0.08)", border2: "rgba(120,100,240,0.18)",
  violet: "#7c3aed", violet2: "#8b5cf6", violet3: "#6d28d9", violet4: "#5b21b6",
  violetD: "rgba(109,40,217,0.08)",
  green: "#059669", greenD: "rgba(5,150,105,0.08)",
  red: "#dc2626", redD: "rgba(220,38,38,0.08)",
  amber: "#d97706", amberD: "rgba(217,119,6,0.08)",
} as const;

// ── Theme store ──────────────────────────────────────────────
const THEME_KEY = "aura_theme";

type ThemeState = {
  isDark: boolean;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: Platform.OS === "web"
    ? (typeof localStorage !== "undefined" ? localStorage.getItem(THEME_KEY) !== "light" : true)
    : true,
  toggle: () => {
    const next = !get().isDark;
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    }
    set({ isDark: next });
  },
}));

// ── Hook to get current colors ───────────────────────────────
export function useColors() {
  const isDark = useThemeStore(s => s.isDark);
  return isDark ? Dark : Light;
}

// ── Static export (backward compat - always dark) ────────────
// Screens that don't need dynamic theming can still use this
export const Colors = Dark;

// ── Palette exports for layout ───────────────────────────────
export const DarkPalette = Dark;
export const LightPalette = Light;
