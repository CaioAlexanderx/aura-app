// ============================================================
// components/studio/precisaDeVoce.ts
//
// A faixa "precisa de você", acima dos KPIs do Início.
//
// Decisão do Caio (04/09/2026): o painel de métricas fica — nem toda
// lojista enxerga a rotina do mesmo jeito. Mas às 7h40 a pergunta dela é
// "o que estou devendo?", e a resposta não pode ficar atrás do gráfico.
//
// A faixa só existe quando há o que fazer. Zero pendências, zero faixa:
// uma barra dizendo "nada a fazer" ocupa o lugar do que importa.
// ============================================================

export type Pendencias = {
  artes_aguardando_cliente?: number;
  pedidos_nao_pagos?: number;
  orcamentos_novos?: number;
} | null | undefined;

export type ItemDaFaixa = {
  /** Para onde a lojista vai ao tocar. */
  rota: string;
  texto: string;
  /** A mais urgente vem primeiro e ganha a cor forte. */
  urgente: boolean;
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
}

/**
 * Os itens da faixa, na ordem do dia dela.
 *
 * Orçamento novo vem primeiro: é dinheiro que ainda não entrou e uma
 * pessoa esperando resposta. Arte esperando a cliente é dela, não da
 * lojista — entra por último e sem urgência.
 */
export function itensDaFaixa(p: Pendencias): ItemDaFaixa[] {
  const itens: ItemDaFaixa[] = [];
  const orc = n(p?.orcamentos_novos);
  const pag = n(p?.pedidos_nao_pagos);
  const art = n(p?.artes_aguardando_cliente);

  if (orc > 0) itens.push({
    rota: "/studio/pedidos",
    texto: orc === 1 ? "1 orçamento novo esperando resposta" : `${orc} orçamentos novos esperando resposta`,
    urgente: true,
  });
  if (pag > 0) itens.push({
    rota: "/studio/pedidos",
    texto: pag === 1 ? "1 pedido aguardando pagamento" : `${pag} pedidos aguardando pagamento`,
    urgente: true,
  });
  if (art > 0) itens.push({
    rota: "/studio/producao",
    texto: art === 1 ? "1 arte esperando a cliente aprovar" : `${art} artes esperando a cliente aprovar`,
    urgente: false,
  });
  return itens;
}
