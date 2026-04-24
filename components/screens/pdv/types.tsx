// ============================================================
// AURA. -- PDV/Caixa · Claude Design tokens
// ============================================================
import { Colors } from "@/constants/colors";
import { Dimensions, Platform } from "react-native";

export const IS_WEB = Platform.OS === "web";
export const IS_WIDE =
  typeof window !== "undefined"
    ? window.innerWidth > 860
    : Dimensions.get("window").width > 860;

export const fmt = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtCurrency = (n: number) => "R$ " + fmt(n);
export const fmtInt = (n: number) => (n || 0).toLocaleString("pt-BR");

// Returns web-only style object, empty object on native so RN doesn't choke.
export const webOnly = (s: any): any => (IS_WEB ? s : {});

// Claude Design gradient tokens.
export const GRAD = {
  violet1: "#4f5bd5",
  violet2: "#8b5cf6",
  violet3: "#a78bfa",
  pink: "#d62976",
  violetDeep: "#6d28d9",
  violet: "#7c3aed",
  green: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
} as const;

// Accent colors used for product glyph/backgrounds (cycled by hash).
const ACCENT_ROTATION = [GRAD.amber, GRAD.violet3, GRAD.violetDeep, GRAD.green, GRAD.red, GRAD.violet1] as const;

export function accentForProduct(id: string): string {
  if (!id) return GRAD.violet;
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) >>> 0;
  return ACCENT_ROTATION[sum % ACCENT_ROTATION.length];
}

export function productLetter(name: string): string {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).replace(/^./, c => c.toUpperCase());
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Injects all keyframes used by PDV · Caixa into the web document. No-op on native.
export function CaixaDesignStyle() {
  if (!IS_WEB) return null;
  const css = `
    @keyframes caixaOrbFloat {
      0%,100% { transform: translate(0,0) scale(1); }
      33%     { transform: translate(60px,-40px) scale(1.1); }
      66%     { transform: translate(-40px,60px) scale(0.95); }
    }
    @keyframes caixaSpin { to { transform: rotate(360deg); } }
    @keyframes caixaPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
    @keyframes caixaHeroShift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px,30px); } }
    @keyframes caixaFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes caixaBadgePop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes caixaShine { 0%,60% { left: -100%; } 100% { left: 100%; } }
    @keyframes caixaScanLine { 0%,100% { top: 25%; } 50% { top: 75%; } }
    @keyframes caixaFlyToCart {
      0%   { transform: translate(var(--from-x), var(--from-y)) scale(1); opacity: 1; }
      60%  { opacity: 1; }
      100% { transform: translate(var(--to-x), var(--to-y)) scale(0.2); opacity: 0; }
    }
    .caixa-scrollable::-webkit-scrollbar { width: 8px; height: 8px; }
    .caixa-scrollable::-webkit-scrollbar-track { background: transparent; }
    .caixa-scrollable::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 4px; }
    .caixa-scrollable::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); }
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

// Violet-forward glass tokens shared across components.
export const glassCard = webOnly({
  background: "rgba(14,18,40,0.55)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.07)",
});

export const glassCardDark = webOnly({
  background: "rgba(9,12,26,0.55)",
  backdropFilter: "blur(20px) saturate(150%)",
  WebkitBackdropFilter: "blur(20px) saturate(150%)",
});

export { Colors };
