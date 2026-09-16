// ============================================================
// AURA. — Devolver ou trocar? (16/09/2026)
//
// Caso MHT / Karina Quadros: para trocar um Vans 42/43 por um 40/41 numa
// venda no crediário, o lojista usou "Editar lançamento → remover item".
// No crediário isso é uma DEVOLUÇÃO: o item continua listado na venda e o
// valor vira abatimento/crédito. Ele não achou o 40/41 para incluir, criou
// vendas avulsas, cancelou tudo e refez. Trocar tamanho é a Troca do PDV.
//
// Funções puras aqui (as telas importam Icon/Toast, que não carregam no Jest).
// Backend: Aura-backend#718 (cancelar devolução desfaz) e o PR do detalhe
// da venda (returned_quantity / devolucao / returns).
// ============================================================

/** Rota que abre o PDV já com a Troca aberta. */
export const ROTA_TROCA_PDV = "/pdv?troca=1";

/** O PDV abre a Troca quando a rota traz ?troca=1. */
export function querAbrirTroca(param: string | string[] | null | undefined): boolean {
  const v = Array.isArray(param) ? param[0] : param;
  return v === "1" || v === "true";
}

/** Rótulo do item que já voltou (total ou parcial); null se nada voltou. */
export function rotuloDevolvido(quantity: number, returnedQuantity?: number | null): string | null {
  const q = Number(quantity) || 0;
  const r = Number(returnedQuantity) || 0;
  if (r <= 0) return null;
  if (r >= q - 0.0005) return "Devolvido";
  const fmtQ = (n: number) => String(Math.round(n * 1000) / 1000).replace(".", ",");
  return `${fmtQ(r)} devolvido(s) · restam ${fmtQ(q - r)}`;
}

const brl = (n: number) => "R$ " + (Number(n) || 0).toFixed(2).replace(".", ",");

type CancelResult = {
  type?: string;
  items_returned?: number;
  refunded_amount?: number;
  devolucao_undo?: { credit_removed?: number; stock_removed?: { quantity?: number }[] } | null;
} | null | undefined;

/** Toast de sucesso do cancelamento, conforme o que foi cancelado. */
export function mensagemCancelamento(result: CancelResult): string {
  if (result?.type === "troca") {
    return "Troca cancelada. Estoque dos dois lados revertido e financeiro ajustado.";
  }
  if (result?.type === "devolucao") {
    const undo = result.devolucao_undo || {};
    const pecas = (undo.stock_removed || []).reduce((a, s) => a + (Number(s?.quantity) || 0), 0);
    const partes = ["Devolução desfeita."];
    if (pecas > 0) partes.push(`${pecas} ${pecas === 1 ? "peça saiu" : "peças saíram"} de novo do estoque.`);
    if ((undo.credit_removed || 0) > 0) partes.push(`${brl(undo.credit_removed || 0)} voltaram a ser dívida do cliente.`);
    return partes.join(" ");
  }
  return (
    "Venda cancelada. " + (result?.items_returned || 0) + " item(s) devolvido(s) ao estoque e " +
    brl(result?.refunded_amount || 0) + " removido(s) da receita."
  );
}

/** Texto do aviso de venda com devolução/troca ativa (cancelar exige desfazer antes). */
export function avisoRetornosAtivos(returns: { sale_number?: number | null; type?: string }[] | null | undefined): string | null {
  if (!Array.isArray(returns) || returns.length === 0) return null;
  const nomes = returns.map((r) => {
    const tipo = r.type === "troca" ? "troca" : "devolução";
    return r.sale_number ? `${tipo} #${r.sale_number}` : tipo;
  });
  return `Esta venda tem ${nomes.join(", ")}. Para cancelar a venda, cancele antes ${returns.length === 1 ? "essa operação" : "essas operações"}.`;
}
