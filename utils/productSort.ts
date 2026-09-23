// ============================================================
// AURA. — Ordenação "Últimos adicionados" (Estoque)
//
// 23/09/2026 (QA producao, item 10): "Últimos adicionados" ordenava em
// ordem alfabética — produto recém-criado/importado não vinha para o
// topo. Causa: GET /products já devolvia created_at, mas
// hooks/useProducts.ts (mapApiProduct) nunca mapeava esse campo pro
// Product — os dois lados do comparador liam undefined e o sort caía na
// ordem que veio do backend (ORDER BY name ASC).
//
// Função pura, sem React: desc por created_at, desempate por id (produto
// importado em lote grava no mesmo timestamp; sem desempate a ordem
// ficava instável entre re-renders).
// ============================================================

export type ProdutoComCriacao = {
  id: string;
  created_at?: string | null;
};

export function compareByRecent(a: ProdutoComCriacao, b: ProdutoComCriacao): number {
  const diff = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  if (diff !== 0) return diff;
  return String(a.id).localeCompare(String(b.id));
}
