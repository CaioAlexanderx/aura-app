// ============================================================
// DENTAL TOKENS — Aura Odonto
//
// Aprovado em aura-identidade-verticais.html (2026-04-25).
// Estes tokens substituem o uso de Colors.violet quando a renderizacao
// e dentro do shell dental (app/dental/(clinic)/...).
//
// PR43.4 (2026-04-29): Light mode real. Antes DentalColors era um literal
// dark fixo, ignorando o toggle de tema. Agora segue IS_DARK_MODE do
// colors.ts (que ja e exportado). Como o toggle dispara reload da pagina,
// o module-level capture e seguro e zero arquivo consumidor precisa mudar.
//
// NAO modificar paleta sem validar contra aura-identidade-verticais.html
// (cyan-petala #06B6D4 + violeta-mae #7c3aed sao tokens de marca).
// ============================================================

import { IS_DARK_MODE } from "@/constants/colors";

// ─────────────────────────────────────────────────────────────
// Paleta DARK (original)
// ─────────────────────────────────────────────────────────────
const DentalDark = {
  // Primary cyan-petala (accent dental)
  cyan:        "#06B6D4",
  cyan2:       "#0EA5E9",
  cyanSoft:    "rgba(6,182,212,0.25)",
  cyanDim:     "rgba(6,182,212,0.12)",
  cyanGhost:   "rgba(6,182,212,0.06)",
  cyanBorder:  "rgba(6,182,212,0.25)",

  // Familia Aura (cor-mae presente em todas as verticais)
  violet:      "#7c3aed",

  // Surface/background do shell dental
  bg:          "#050d12",
  bg2:         "#0a141a",
  surface:     "rgba(255,255,255,0.04)",
  surfaceStrong: "rgba(255,255,255,0.08)",
  border:      "rgba(255,255,255,0.08)",

  // Ink
  ink:         "#fafafa",
  ink2:        "rgba(250,250,250,0.65)",
  ink3:        "rgba(250,250,250,0.4)",

  // Status (mantidos do design system Aura)
  green:       "#22c55e",
  amber:       "#fbbf24",
  red:         "#ef4444",
} as const;

// ─────────────────────────────────────────────────────────────
// Paleta LIGHT — fundo branco/claro, ink escuro, mesmas cores de marca
// ─────────────────────────────────────────────────────────────
const DentalLight = {
  // Primary cyan-petala (mantida — boa em ambos os temas)
  cyan:        "#06B6D4",
  cyan2:       "#0284c7",   // mais escuro pra boa leitura em fundo claro
  cyanSoft:    "rgba(6,182,212,0.18)",
  cyanDim:     "rgba(6,182,212,0.10)",
  cyanGhost:   "rgba(6,182,212,0.05)",
  cyanBorder:  "rgba(6,182,212,0.30)",

  // Familia Aura (mantida)
  violet:      "#7c3aed",

  // Surface/background — fundo claro real
  bg:          "#f4f4f8",   // alinhado com Light.bg do colors.ts
  bg2:         "#ffffff",   // surface elevada branca
  surface:     "rgba(0,0,0,0.025)",
  surfaceStrong: "rgba(0,0,0,0.05)",
  border:      "rgba(109,40,217,0.10)", // violet sutil — alinhado com Light.border

  // Ink — texto escuro sobre fundo claro
  ink:         "#18172b",
  ink2:        "rgba(24,23,43,0.65)",
  ink3:        "rgba(24,23,43,0.45)",

  // Status (versoes mais escuras pra contraste em fundo claro)
  green:       "#059669",
  amber:       "#d97706",
  red:         "#dc2626",
} as const;

export const DentalColors = IS_DARK_MODE ? DentalDark : DentalLight;

// ─────────────────────────────────────────────────────────────
// Gradients — shellBg muda completamente entre temas
// ─────────────────────────────────────────────────────────────
export const DentalGradients = IS_DARK_MODE ? {
  // Logo-mark da identidade dental: cyan -> violet (mantido em ambos)
  mark:    "linear-gradient(135deg, #06B6D4, #7c3aed)",
  // Background radial do shell — orbs cyan sutis em fundo escuro
  shellBg: "radial-gradient(ellipse at 18% 0%,  rgba(6,182,212,0.10)  0%, transparent 50%), radial-gradient(ellipse at 82% 100%, rgba(14,165,233,0.08) 0%, transparent 45%), #050d12",
} as const : {
  mark:    "linear-gradient(135deg, #06B6D4, #7c3aed)",
  // Background radial do shell em LIGHT: hint de cyan/violet sobre branco
  shellBg: "radial-gradient(ellipse at 18% 0%,  rgba(6,182,212,0.07)  0%, transparent 50%), radial-gradient(ellipse at 82% 100%, rgba(124,58,237,0.05) 0%, transparent 45%), #f4f4f8",
} as const;

// ============================================================
// FORM TOKENS — labels, inputs e helpers de formulario dental.
//
// PR21 (2026-04-27): unificacao de labels de formulario apos UAT.
// PR43.4 (2026-04-29): variant Light (label color escura sobre fundo claro).
// ============================================================
export const DentalForm = IS_DARK_MODE ? {
  label: {
    fontSize: 12,
    color: "rgba(250,250,250,0.72)",
    fontWeight: "600" as const,
    letterSpacing: 0.2,
    marginBottom: 5,
  },
  labelStrong: {
    fontSize: 10,
    color: "rgba(250,250,250,0.85)",
    fontWeight: "700" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
} as const : {
  label: {
    fontSize: 12,
    color: "rgba(24,23,43,0.78)",
    fontWeight: "600" as const,
    letterSpacing: 0.2,
    marginBottom: 5,
  },
  labelStrong: {
    fontSize: 10,
    color: "rgba(24,23,43,0.92)",
    fontWeight: "700" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
} as const;

// ============================================================
// COPY APROVADO
// Brand, tagline e headlines vem de aura-identidade-verticais.html.
// Mudar so com aprovacao explicita.
// ============================================================
export const DentalCopy = {
  brand:    "Aura Odonto",
  tagline:  "Sua clinica em ordem, seu paciente seguro.",
  hero:     "Cada paciente, um historico vivo.",
  subhero:  "Prontuario, odontograma e agenda em uma so tela.",
} as const;

// ============================================================
// SMILE-ARC LOGO MARK
// SVG path-d do logo-mark dental. Renderizar dentro de
// <svg viewBox="0 0 32 32"> com stroke="white" stroke-width=2.
// Mesmo path usado em aura-identidade-verticais.html.
// ============================================================
export const SMILE_ARC_PATH =
  "M16 6c-4 0-7 2-9 2-1.5 0-2 1-2 2.5C5 16 7 24 9 26c1 1 2 0 2.5-2l1-4c.3-1 1-1.5 2-1.5h3c1 0 1.7.5 2 1.5l1 4c.5 2 1.5 3 2.5 2 2-2 4-10 4-15.5 0-1.5-.5-2.5-2-2.5-2 0-5-2-9-2z";

// ============================================================
// Palettes exportadas pra debug / consumo opcional
// ============================================================
export { DentalDark, DentalLight };
