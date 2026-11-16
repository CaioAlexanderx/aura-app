// ============================================================
// Caixa — card "Produtos" do carrinho: quantas peças.
// 16/11/2026 (pedido do Caio): quem vende moda quer ver o total de peças
// (3 unidades da mesma blusa = 3), não o número de linhas.
// Regra: item sem unidade, ou em unidade "de peça" (un, und, unid, pc, pç,
// peca, peça), com quantidade inteira, soma a quantidade. Qualquer outro
// caso (m², m³, kg, milheiro, saco, caixa, quantidade fracionária) conta 1
// por linha, para não misturar unidades (QA 23/09/2026: 10 m² de piso +
// 500 tijolos = "510").
// ============================================================

const UNIDADES_DE_PECA = new Set(["un", "und", "unid", "pc", "pç", "peca", "peça"]);

export interface ItemContavel {
  qty: number;
  unit?: string | null;
}

export function contarProdutosDoCarrinho(items: ItemContavel[]): number {
  let total = 0;
  for (const it of items) {
    const unit = (it.unit ?? "").trim().toLowerCase();
    const ehPeca = unit === "" || UNIDADES_DE_PECA.has(unit);
    total += ehPeca && Number.isInteger(it.qty) && it.qty > 0 ? it.qty : 1;
  }
  return total;
}
