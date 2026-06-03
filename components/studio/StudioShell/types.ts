// ============================================================
// AURA STUDIO · StudioShell — types + GROUPS + makeTones
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Tipos compartilhados + definição estática de grupos de navegação +
// helper de tons theme-aware.
//
// Shell clareza (02/06/2026):
//   - Labels renomeados: "Estoque" → "Catálogo", "Insumos" → "Insumos & estoque"
//   - Subtítulos adicionados nas portas de venda (Orçamentos, Pedidos,
//     Caixa / PDV, Loja digital)
//   - Labels e subtítulos derivados de STUDIO_NAV (nav.ts) — fonte única.
//   - NavChild ganha campo opcional `subtitle` e `primary`
// ============================================================
import { StudioColors } from "@/constants/studio-tokens";
import { STUDIO_NAV } from "./nav";

export type Tok = typeof StudioColors;

export type NavChild = {
  label: string;
  icon: string;
  href: string;
  subtitle?: string;
  primary?: boolean;
  badge?: { value: string; tone?: "accent" | "warm" };
};

export type ToneKey = "navy" | "pink" | "warm" | "mint" | "sky" | "violet";

export type NavGroup = {
  id: string;
  label: string;
  icon: string;
  toneKey: ToneKey;
  children: NavChild[];
};

// makeTones: tons de navegação theme-aware (Fase 0). bg/bg2 do hue.
export const makeTones = (c: Tok) =>
  ({
    navy:   { bg: c.primary, bg2: c.primary2 },
    pink:   { bg: c.accent,  bg2: c.accent2 },
    warm:   { bg: c.warning, bg2: c.warm },
    mint:   { bg: c.success, bg2: c.mint },
    sky:    { bg: c.sky,     bg2: c.sky },
    violet: { bg: c.violet,  bg2: c.violet },
  }) as Record<ToneKey, { bg: string; bg2: string }>;

// Helper: mapeia STUDIO_NAV items de um grupo para NavChild[]
function navItemsForGroup(groupLabel: 'ESTÚDIO' | 'VENDAS' | 'GESTÃO'): NavChild[] {
  return STUDIO_NAV
    .filter((item) => item.group === groupLabel && item.route !== '/studio')
    .map((item) => ({
      label: item.label,
      icon: item.icon,
      href: item.route,
      subtitle: item.subtitle,
      primary: item.primary,
      badge: item.badge,
    }));
}

export const GROUPS: NavGroup[] = [
  {
    id: "estudio",
    label: "Estúdio",
    icon: "star",
    toneKey: "navy",
    children: navItemsForGroup('ESTÚDIO'),
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: "shopping-cart",
    toneKey: "pink",
    children: navItemsForGroup('VENDAS'),
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: "briefcase",
    toneKey: "mint",
    children: navItemsForGroup('GESTÃO'),
  },
];
