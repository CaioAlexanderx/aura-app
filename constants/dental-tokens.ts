// ============================================================
// DENTAL TOKENS — Aura Odonto
//
// Aprovado em aura-identidade-verticais.html (2026-04-25).
// Estes tokens substituem o uso de Colors.violet quando a renderizacao
// e dentro do shell dental (app/dental/(clinic)/...).
//
// NAO modificar paleta sem validar contra aura-identidade-verticais.html
// (cyan-petala #06B6D4 + violeta-mae #7c3aed sao tokens de marca).
// ============================================================

export const DentalColors = {
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

export const DentalGradients = {
  // Logo-mark da identidade dental: cyan -> violet
  mark:    "linear-gradient(135deg, #06B6D4, #7c3aed)",
  // Background radial do shell (orbs cyan nos cantos)
  shellBg: "radial-gradient(ellipse at 18% 0%,  rgba(6,182,212,0.10)  0%, transparent 50%), radial-gradient(ellipse at 82% 100%, rgba(14,165,233,0.08) 0%, transparent 45%), #050d12",
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
