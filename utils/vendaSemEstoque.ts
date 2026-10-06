// ============================================================
// AURA. — Vender sem estoque (Configurações > Políticas do Caixa)
//
// 06/10/2026 — loja que não controla saldo (ou acabou de importar o cadastro
// com tudo zerado) precisa vender mesmo assim. A chave
// `allow_sale_without_stock` mora em pdv_settings e vem desligada.
//
// Desligada, nada muda: o Caixa esconde os zerados atrás do "Mostrar
// zerados" e o backend recusa a venda com "Estoque insuficiente".
// Ligada:
//   - o Caixa e a busca de produto do Financeiro mostram os zerados direto
//     (senão a loja inteira abriria vazia);
//   - quem trava por saldo no app deixa de travar.
// O saldo não fica negativo: o backend dá baixa com piso zero.
//
// Funções puras, sem import de componente nem de store — é o que permite
// testar (ver memória "testar render no aura-app": Icon e stores/auth não
// carregam no Jest).
// ============================================================

type ComAChave = { allow_sale_without_stock?: unknown } | null | undefined;

/** A loja ligou "vender sem estoque"? Só `true` literal liga. */
export function lerVendaSemEstoque(settings: ComAChave): boolean {
  return !!settings && (settings as any).allow_sale_without_stock === true;
}

function saldoDe(p: any): number {
  const v = p?.stock ?? p?.stock_qty ?? 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/** Produto com variantes sempre conta como "em estoque": o saldo está na variante. */
export function produtoTemEstoque(p: any): boolean {
  if (p?.has_variants === true) return true;
  return saldoDe(p) > 0;
}

/**
 * O produto aparece na lista de venda?
 * Aparece se tem saldo, se o operador pediu "Mostrar zerados" ou se a loja
 * vende sem estoque.
 */
export function apareceParaVender(
  p: any,
  opts: { mostrarZerados: boolean; vendeSemEstoque: boolean },
): boolean {
  return opts.mostrarZerados || opts.vendeSemEstoque || produtoTemEstoque(p);
}

/** A venda deve ser barrada por falta de saldo? */
export function faltaEstoqueParaVender(
  disponivel: number,
  quantidade: number,
  vendeSemEstoque: boolean,
): boolean {
  if (vendeSemEstoque) return false;
  const d = isFinite(disponivel) ? disponivel : 0;
  return d < quantidade;
}
