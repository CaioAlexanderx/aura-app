// ============================================================
// AURA. — Vendas › Fechamentos de caixa: páginas de 50 (18/11/2026)
//
// A aba carregava só as 50 sessões mais recentes de cada loja (limit 50, sem
// página), e há lojas com mais de 160. GET /companies/:id/caixa/historico já
// aceita limit + offset e devolve `total` (todas as sessões fechadas da
// loja): nada muda no backend.
//
// Uma página = as 50 sessões mais recentes depois das que já passaram, na
// ordem de abertura (mais nova primeiro), somando todas as lojas no
// consolidado. Para isso cada loja guarda o PRÓPRIO offset: a página seguinte
// pede, de cada loja, 50 a partir do offset dela, junta, ordena e fica com as
// 50 primeiras; o offset de cada loja anda o tanto de sessões dela que
// entraram na página. Com uma loja só é o offset de sempre (0, 50, 100...).
//
// Os números do topo (mês corrente) NÃO saem daqui: continuam vindo da
// primeira consulta de cada loja, como antes (components/screens/vendas/
// FechamentosTab.tsx).
// ============================================================

export const TAMANHO_DA_PAGINA = 50;

export type RespostaDaLoja<S> = {
  companyId: string;
  companyName: string;
  sessoes: S[];
  /** Total de sessões fechadas da loja (o backend conta sem a página). */
  total: number;
};

export type Pagina<S> = {
  linhas: Array<S & { company_id: string; company_name: string }>;
  /** Offset de cada loja para a página seguinte. */
  proximos: Record<string, number>;
  /** Total somado de todas as lojas. */
  total: number;
};

function tempo(iso: string | null | undefined): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return isFinite(t) ? t : 0;
}

/**
 * Junta as respostas das lojas (cada uma pedida a partir do próprio offset)
 * numa página de no máximo `tamanho` sessões.
 */
export function montarPagina<S extends { opened_at: string }>(
  respostas: Array<RespostaDaLoja<S>>,
  offsets: Record<string, number>,
  tamanho: number = TAMANHO_DA_PAGINA,
): Pagina<S> {
  const todas: Array<S & { company_id: string; company_name: string }> = [];
  let total = 0;
  respostas.forEach(function (r) {
    total += Number(r.total) || 0;
    (r.sessoes || []).forEach(function (s) {
      todas.push({ ...s, company_id: r.companyId, company_name: r.companyName });
    });
  });
  todas.sort(function (a, b) { return tempo(b.opened_at) - tempo(a.opened_at); });
  const linhas = todas.slice(0, tamanho);

  const proximos: Record<string, number> = {};
  respostas.forEach(function (r) { proximos[r.companyId] = offsets[r.companyId] || 0; });
  linhas.forEach(function (l) { proximos[l.company_id] = (proximos[l.company_id] || 0) + 1; });

  return { linhas, proximos, total };
}

/** Quantas páginas cabem no total (no mínimo 1). */
export function totalDePaginas(total: number, tamanho: number = TAMANHO_DA_PAGINA): number {
  return Math.max(1, Math.ceil((Number(total) || 0) / tamanho));
}
