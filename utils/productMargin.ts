// ============================================================
// AURA. — Margem de produto (Estoque)
//
// 23/09/2026 (QA producao, item 9): produto sem custo cadastrado (cost
// null ou 0) mostrava margem 100% na lista do Estoque — engana o
// lojista, que le "100% de lucro" num produto que na verdade nao tem
// custo informado nenhum. Funcao pura, sem React: null = "sem margem
// pra mostrar" (cost ausente/zero OU price ausente/zero). Quem renderiza
// decide o "—" e a dica.
// ============================================================

export function computeMargin(price: number | null | undefined, cost: number | null | undefined): number | null {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  if (c <= 0 || p <= 0) return null;
  return ((p - c) / p) * 100;
}

export const DICA_MARGEM_SEM_CUSTO = "Cadastre o custo para ver a margem";
