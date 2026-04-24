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

// IS_DARK_MODE / IS_LIGHT_MODE — module-level booleans for conditional rgba
// values inside `webOnly(...)` style helpers. Theme toggle triggers a full
// page reload (see `toggle()` below), so module-level capture is safe.
export var IS_DARK_MODE = IS_DARK;
export var IS_LIGHT_MODE = !IS_DARK;

// Glass — theme-aware tokens for translucent card backgrounds, borders and
// divider lines used by the "Claude Design" glassmorphism palette. Values are
// computed at module load (same pattern as `Colors`) and stable per session.
// Dark uses near-black rgba with white inks; Light uses near-white rgba with
// violet-tinted inks so the glass reads correctly on the pale violet page bg.
//
// heroGrad / cartHeadGrad — gradientes violeta dos cards "hero" (HeroCard do
// Painel e header do CartPanel). Em light precisam ficar DENSOS pra carregar
// texto branco; em dark ficam mais sutis pra glassmorphism casar com o bg
// quase preto.
export var Glass = IS_DARK ? {
  card:             "rgba(14,18,40,0.55)",
  cardMid:          "rgba(9,12,26,0.55)",
  cardDeep:         "rgba(5,6,15,0.6)",
  pop:              "rgba(11,15,34,0.96)",
  heroGrad:         "linear-gradient(135deg, rgba(124,58,237,0.22), rgba(79,91,213,0.05))",
  heroGradSoft:     "linear-gradient(135deg, rgba(124,58,237,0.20), rgba(79,91,213,0.06))",
  cartHeadGrad:     "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(79,91,213,0.15))",
  merchantGrad:     "linear-gradient(135deg, rgba(124,58,237,0.14), rgba(14,18,40,0.7))",
  line:             "rgba(255,255,255,0.06)",
  lineStrong:       "rgba(255,255,255,0.1)",
  lineSoft:         "rgba(255,255,255,0.05)",
  lineFaint:        "rgba(255,255,255,0.04)",
  lineWhisper:      "rgba(255,255,255,0.03)",
  lineBorderCard:   "rgba(255,255,255,0.07)",
  lineBorderStrong: "rgba(255,255,255,0.08)",
  textDim:          "rgba(255,255,255,0.5)",
  textDimmer:       "rgba(255,255,255,0.45)",
  textDimmest:      "rgba(255,255,255,0.4)",
  inkOnCard:        "#ffffff",
  inkOnCardSoft:    "rgba(255,255,255,0.9)",
  bgInput:          "rgba(5,6,15,0.6)",
  bgInputBorder:    "rgba(255,255,255,0.1)",
  shine:            "rgba(255,255,255,0.25)",
} : {
  card:             "rgba(255,255,255,0.82)",
  cardMid:          "rgba(255,255,255,0.9)",
  cardDeep:         "rgba(248,245,255,0.85)",
  pop:              "rgba(255,255,255,0.98)",
  // Light: gradientes DENSOS pra texto branco aparecer
  heroGrad:         "linear-gradient(135deg, rgba(109,40,217,0.95), rgba(79,91,213,0.78))",
  heroGradSoft:     "linear-gradient(135deg, rgba(124,58,237,0.88), rgba(139,92,246,0.70))",
  cartHeadGrad:     "linear-gradient(135deg, rgba(109,40,217,0.96), rgba(79,91,213,0.85))",
  merchantGrad:     "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(245,243,255,0.70))",
  line:             "rgba(109,40,217,0.10)",
  lineStrong:       "rgba(109,40,217,0.16)",
  lineSoft:         "rgba(109,40,217,0.07)",
  lineFaint:        "rgba(109,40,217,0.05)",
  lineWhisper:      "rgba(109,40,217,0.04)",
  lineBorderCard:   "rgba(109,40,217,0.12)",
  lineBorderStrong: "rgba(109,40,217,0.16)",
  textDim:          "rgba(26,26,46,0.65)",
  textDimmer:       "rgba(26,26,46,0.55)",
  textDimmest:      "rgba(26,26,46,0.5)",
  inkOnCard:        "#1a1a2e",
  inkOnCardSoft:    "rgba(26,26,46,0.9)",
  bgInput:          "rgba(245,243,255,0.9)",
  bgInputBorder:    "rgba(109,40,217,0.18)",
  shine:            "rgba(124,58,237,0.18)",
};

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
