import { Platform } from "react-native";

// Typography system for Aura.
// Web: Google Fonts (Instrument Serif + DM Sans)
// Native: system font fallbacks

const isWeb = Platform.OS === "web";

export const Fonts = {
  // Headings - Instrument Serif (elegant, editorial)
  heading: isWeb
    ? "'Instrument Serif', Georgia, serif"
    : "System",

  // Body - DM Sans (clean, modern)
  body: isWeb
    ? "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    : "System",

  // Mono - DM Mono (data, numbers)
  mono: isWeb
    ? "'DM Mono', 'SF Mono', Menlo, monospace"
    : "monospace",
} as const;

// Google Fonts CSS link (injected in web layout)
export const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800&family=Instrument+Serif:ital@0;1&display=swap";

// ── Fontes de ARTE (vitrine) ─────────────────────────────────
// O lojista escolhe entre estas ao configurar um campo de texto
// (FONTS_PRESET em customizationConfig). Elas não fazem parte da UI —
// são a letra que vai ESTAMPADA na peça, então precisam estar carregadas
// onde o cliente vê a arte, senão o preview cai num fallback silencioso
// e a caneca "Pacifico" aparece em Arial.
export const ART_FONTS = ["Pacifico", "Caveat", "Playfair Display", "Bebas Neue"] as const;

/**
 * CSS de fontes da VITRINE: marca + fontes de arte.
 *
 * Até 21/08/2026 nenhuma rota de vitrine injetava fonte nenhuma — o
 * painel e a página de orçamento carregavam, a superfície que vende não.
 * Tudo lá renderizava em fonte de sistema.
 */
export const STOREFRONT_FONTS_CSS =
  "https://fonts.googleapis.com/css2" +
  "?family=DM+Mono:wght@400;500" +
  "&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800" +
  "&family=Instrument+Serif:ital@0;1" +
  "&family=Pacifico" +
  "&family=Caveat:wght@400;700" +
  "&family=Playfair+Display:ital,wght@0,400;0,700;1,400" +
  "&family=Bebas+Neue" +
  "&display=swap";

/** Pilha de fallback para uma fonte de arte escolhida pelo lojista. */
export function artFontStack(nome?: string | null): string {
  const escolhida = String(nome || "").trim();
  // Instrument Serif como penúltimo degrau: se a fonte de arte não
  // carregar, a peça cai na serifada da marca, não no sans do sistema.
  const base = "'Instrument Serif', Georgia, serif";
  return escolhida ? `'${escolhida.replace(/'/g, "")}', ${base}` : base;
}

// Shorthand for common text styles
export const Typography = {
  h1: { fontFamily: Fonts.heading, fontSize: 28, fontWeight: "400" as const },
  h2: { fontFamily: Fonts.heading, fontSize: 22, fontWeight: "400" as const },
  h3: { fontFamily: Fonts.heading, fontSize: 18, fontWeight: "400" as const },
  body: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "400" as const },
  bodyBold: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "700" as const },
  label: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  caption: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "500" as const },
  mono: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: "500" as const },
} as const;
