import { create } from "zustand";
import { Platform } from "react-native";

var THEME_KEY = "aura_theme";
var COOKIE_NAME = "aura_theme";
var COOKIE_DAYS = 365;

// Read theme from cookie (more persistent than localStorage)
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    var match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[2]) : null;
  } catch { return null; }
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  try {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + "=" + encodeURIComponent(value) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
  } catch {}
}

// Read from localStorage first, then cookie, then default dark
function getInitialTheme(): boolean {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      // Try localStorage first
      if (typeof localStorage !== "undefined") {
        var saved = localStorage.getItem(THEME_KEY);
        if (saved === "light") return false;
        if (saved === "dark") return true;
      }
      // Fallback to cookie
      var cookie = getCookie(COOKIE_NAME);
      if (cookie === "light") return false;
      if (cookie === "dark") return true;
      // Default: dark — save it
      saveTheme(true);
      return true;
    }
  } catch {}
  return true;
}

// Save to BOTH localStorage and cookie for maximum persistence
function saveTheme(isDark: boolean) {
  var value = isDark ? "dark" : "light";
  try { if (typeof localStorage !== "undefined") localStorage.setItem(THEME_KEY, value); } catch {}
  setCookie(COOKIE_NAME, value, COOKIE_DAYS);
}

var IS_DARK = getInitialTheme();

var Dark = {
  bg: "#060816", bg2: "#090c1a", bg3: "#0e1228", bg4: "#141830",
  ink: "#f0edff", ink2: "rgba(220,215,255,0.75)", ink3: "rgba(170,160,235,0.65)",
  border: "rgba(255,255,255,0.07)", border2: "rgba(120,100,240,0.22)",
  violet: "#7c3aed", violet2: "#8b5cf6", violet3: "#a78bfa", violet4: "#c4b5fd",
  violetD: "rgba(109,40,217,0.14)",
  green: "#34d399", greenD: "rgba(52,211,153,0.10)",
  red: "#f87171", redD: "rgba(248,113,113,0.10)",
  amber: "#fbbf24", amberD: "rgba(251,191,36,0.10)",
} as const;

var Light = {
  bg: "#f5f3ff", bg2: "#ffffff", bg3: "#ffffff", bg4: "#f0edf8",
  ink: "#1a1a2e", ink2: "#3d3660", ink3: "#6b6193",
  border: "rgba(109,40,217,0.10)", border2: "rgba(120,100,240,0.15)",
  violet: "#7c3aed", violet2: "#8b5cf6", violet3: "#6d28d9", violet4: "#5b21b6",
  violetD: "rgba(109,40,217,0.06)",
  green: "#059669", greenD: "rgba(5,150,105,0.08)",
  red: "#dc2626", redD: "rgba(220,38,38,0.06)",
  amber: "#d97706", amberD: "rgba(217,119,6,0.06)",
} as const;

export var Colors = IS_DARK ? { ...Dark } : { ...Light };

type ThemeState = {
  isDark: boolean;
  toggle: () => void;
};

export var useThemeStore = create<ThemeState>(function(set, get) {
  return {
    isDark: IS_DARK,
    toggle: function() {
      if (Platform.OS !== "web" || typeof window === "undefined") return;
      var next = !get().isDark;
      set({ isDark: next });
      saveTheme(next);
      // Colors are frozen at import time — full reload required
      setTimeout(function() {
        try { window.location.reload(); } catch {}
      }, 200);
    },
  };
});

export function useColors() {
  var isDark = useThemeStore(function(s) { return s.isDark; });
  return isDark ? Dark : Light;
}

export var DarkPalette = Dark;
export var LightPalette = Light;
