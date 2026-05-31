// ============================================================
// AURA STUDIO · StudioShell — types + GROUPS + makeTones
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Tipos compartilhados + definição estática de grupos de navegação +
// helper de tons theme-aware.
// ============================================================
import { StudioColors } from "@/constants/studio-tokens";

export type Tok = typeof StudioColors;

export type NavChild = {
  label: string;
  icon: string;
  href: string;
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

export const GROUPS: NavGroup[] = [
  {
    id: "estudio",
    label: "Estúdio",
    icon: "star",
    toneKey: "navy",
    children: [
      { label: "Estoque",   icon: "box",          href: "/studio/estoque" },
      { label: "Galeria",   icon: "image",         href: "/studio/galeria" },
      { label: "Produção",  icon: "clock",         href: "/studio/producao", badge: { value: "•", tone: "accent" } },
      { label: "Insumos",   icon: "package",       href: "/studio/insumos",  badge: { value: "!", tone: "warm" } },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: "shopping-cart",
    toneKey: "pink",
    children: [
      // Camada 1 (30/05): Orçamentos + Pedidos adicionados ao funil de vendas
      { label: "Orçamentos",   icon: "file-text",   href: "/studio/gestao/orcamentos" },
      { label: "Pedidos",      icon: "package",      href: "/studio/pedidos" },
      { label: "Caixa / PDV",  icon: "credit-card",  href: "/studio/vendas/caixa" },
      { label: "Loja digital", icon: "globe",        href: "/studio/vendas/loja-digital" },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: "briefcase",
    toneKey: "mint",
    children: [
      { label: "Financeiro",    icon: "dollar-sign", href: "/studio/gestao/financeiro" },
      { label: "NF-e / NFC-e",  icon: "file-text",   href: "/studio/gestao/nfe" },
      { label: "Contabilidade", icon: "check",       href: "/studio/gestao/contabilidade" },
    ],
  },
];
