// ============================================================
// AURA STUDIO · StudioShell — nav.ts
// Fonte única de verdade de navegação do Studio.
//
// Exporta:
//   - StudioGroup: union type dos 3 grupos
//   - StudioNavItem: shape de cada item de nav
//   - STUDIO_NAV: array completo de items
//   - eyebrowForRoute(route): string no formato "GRUPO · LABEL"
//
// Consumers (Sidebar, MobileBar, MobileMenuSheet, StudioPageHeader)
// devem puxar labels e subtítulos daqui — não duplicar strings.
//
// Matching de rota: suporta subrotas (ex. /studio/vendas/caixa/novo
// → Caixa / PDV). Usa startsWith; item mais específico tem prioridade
// (sort por comprimento decrescente de route).
// ============================================================

export type StudioGroup = 'ESTÚDIO' | 'VENDAS' | 'GESTÃO';

export type StudioNavItem = {
  /** Segmento de rota raiz, ex. "/studio/estoque" */
  route: string;
  /** Rótulo de exibição (sidebar, mobile, breadcrumb) */
  label: string;
  /** Grupo a que pertence */
  group: StudioGroup;
  /** Ícone Lucide/Feather usado na sidebar */
  icon: string;
  /** Frase curta "quando usar" — exibida sob o label nas portas de venda */
  subtitle?: string;
  /** Destaque visual como porta primária de venda */
  primary?: boolean;
  /** Badge opcional herdado do legado */
  badge?: { value: string; tone?: 'accent' | 'warm' };
};

/**
 * Fonte única de todos os itens de nav do Studio.
 * Ordem: Início primeiro, depois grupos na ordem Estúdio → Vendas → Gestão.
 */
export const STUDIO_NAV: StudioNavItem[] = [
  // ── Início (sem grupo, tratado à parte)
  {
    route: '/studio',
    label: 'Início',
    group: 'ESTÚDIO',  // grupo genérico; Início é renderizado fora dos grupos
    icon: 'grid',
  },

  // ── ESTÚDIO ─────────────────────────────────────────────
  {
    route: '/studio/estoque',
    label: 'Catálogo',
    group: 'ESTÚDIO',
    icon: 'layout-grid',
  },
  {
    route: '/studio/galeria',
    label: 'Galeria',
    group: 'ESTÚDIO',
    icon: 'image',
  },
  {
    route: '/studio/producao',
    label: 'Produção',
    group: 'ESTÚDIO',
    icon: 'clock',
    badge: { value: '•', tone: 'accent' },
  },
  {
    route: '/studio/insumos',
    label: 'Insumos & estoque',
    group: 'ESTÚDIO',
    icon: 'package',
    badge: { value: '!', tone: 'warm' },
  },

  // ── VENDAS ──────────────────────────────────────────────
  {
    route: '/studio/gestao/orcamentos',
    label: 'Orçamentos',
    group: 'VENDAS',
    icon: 'file-text',
    subtitle: 'Proposta pro cliente',
  },
  {
    route: '/studio/pedidos',
    label: 'Pedidos',
    group: 'VENDAS',
    icon: 'package',
    subtitle: 'Acompanhe a produção',
  },
  {
    route: '/studio/vendas/caixa',
    label: 'Caixa / PDV',
    group: 'VENDAS',
    icon: 'credit-card',
    subtitle: 'Venda no balcão',
    primary: true,
  },
  {
    route: '/studio/vendas/loja-digital',
    label: 'Loja digital',
    group: 'VENDAS',
    icon: 'globe',
    subtitle: 'Vendas online',
  },

  // ── GESTÃO ──────────────────────────────────────────────
  {
    route: '/studio/gestao/financeiro',
    label: 'Financeiro',
    group: 'GESTÃO',
    icon: 'dollar-sign',
  },
  {
    route: '/studio/gestao/nfe',
    label: 'NF-e / NFC-e',
    group: 'GESTÃO',
    icon: 'file-text',
  },
  {
    route: '/studio/gestao/contabilidade',
    label: 'Contabilidade',
    group: 'GESTÃO',
    icon: 'check',
  },
];

/**
 * Retorna o eyebrow canônico para uma rota do Studio.
 *
 * Formato: "GRUPO · LABEL EM MAIÚSCULAS"
 * Ex.: eyebrowForRoute('/studio/vendas/caixa/nova-venda')
 *   → 'VENDAS · CAIXA / PDV'
 *
 * Matching robusto: ordena por comprimento de route decrescente
 * para que /studio/gestao/orcamentos/novo bata em Orçamentos
 * antes de um hipotético prefixo mais curto.
 *
 * Fallback: 'AURA STUDIO' se a rota não bater em nenhum item.
 */
export function eyebrowForRoute(route: string): string {
  // Ignora query string / hash
  const clean = route.split('?')[0].split('#')[0];

  // Início exact match
  if (clean === '/studio' || clean === '/studio/') {
    return 'ESTÚDIO · INÍCIO';
  }

  // Ordena por comprimento de route decrescente (mais específico primeiro)
  const sorted = [...STUDIO_NAV]
    .filter((item) => item.route !== '/studio') // exclui raiz
    .sort((a, b) => b.route.length - a.route.length);

  for (const item of sorted) {
    if (clean === item.route || clean.startsWith(item.route + '/')) {
      return `${item.group} · ${item.label.toUpperCase()}`;
    }
  }

  return 'AURA STUDIO';
}
