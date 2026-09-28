// ============================================================
// Valor do estoque — a custo e a preço de venda (28/09/2026)
//
// O card "Valor em estoque" somava só estoque × custo. Loja que cadastrou
// sem custo (Qbonita: 54 de 55 produtos com custo zero, carga de 25/09) via
// R$ 250 num estoque que vale R$ 20.785 na etiqueta — e achava que o sistema
// não estava somando. O valor a custo continua sendo o principal (é o que a
// contabilidade usa), mas a tela passa a mostrar também o valor de venda e
// quantos produtos com peças estão sem custo, que é o que explica a diferença.
// ============================================================

type ItemDeEstoque = { stock: number; cost: number; price: number; unit?: string };

export type ResumoValorEstoque = {
  /** Σ estoque × custo — o "valor em estoque" contábil. */
  custo: number;
  /** Σ estoque × preço de venda. */
  venda: number;
  /** Produtos com peças em estoque e custo zerado (ficam fora do valor a custo). */
  semCusto: number;
};

export function resumoValorEstoque(produtos: ItemDeEstoque[]): ResumoValorEstoque {
  let custo = 0, venda = 0, semCusto = 0;
  for (const p of produtos) {
    if (p.unit === "srv") continue;
    const qtd = p.stock > 0 ? p.stock : 0;
    if (!qtd) continue;
    custo += qtd * (p.cost || 0);
    venda += qtd * (p.price || 0);
    if (!(p.cost > 0)) semCusto++;
  }
  return { custo, venda, semCusto };
}

/** Linha de apoio do card: valor de venda e, se houver, o aviso do custo. */
export function legendaValorEstoque(r: ResumoValorEstoque, fmt: (n: number) => string): string {
  const venda = fmt(r.venda) + " a preço de venda";
  if (!r.semCusto) return venda;
  return venda + " · " + r.semCusto + (r.semCusto === 1 ? " produto sem custo" : " produtos sem custo");
}
