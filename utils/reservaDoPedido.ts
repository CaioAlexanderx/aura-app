// ============================================================
// AURA. — Reserva do Pedido no Caixa e no Estoque (A4, p-63d, 17/11/2026)
//
// O pedido guardado no Caixa não baixa o estoque: só RESERVA. O backend
// calcula a reserva (Aura-backend#1072, B2) e devolve `reserved_qty` (e
// `reserved_by_variant`) em GET /products, e `reserved_qty` /
// `variant_reserved_qty` no bipe. Esses campos só vêm com a trava
// PEDIDO_LIBERADO ligada no backend (ou para a equipe Aura).
//
// Regras do mockup aprovado (parte 1):
//   - a quantidade continua a da prateleira; "livres" = estoque − reservado;
//   - selo "N reservado" no cartão do Caixa e na linha do Estoque;
//   - vender peça reservada (quando o carrinho passa do que está livre) pede
//     "Não vender / Vender mesmo assim". NUNCA trava a venda.
//
// Sem os campos (trava desligada, backend antigo) ou com a trava do app
// desligada (utils/pedidoLiberado.ts, quem chama passa `liberado`): reserva 0
// e nada muda na tela.
// ============================================================

type ComReserva = {
  reservedQty?: number | null;
  reservedByVariant?: Record<string, number> | null;
} | null | undefined;

/** Peças reservadas do produto (ou só da variante). 0 = nada a mostrar. */
export function reservadoDoProduto(p: ComReserva, liberado: boolean, variantId?: string | null): number {
  if (liberado !== true || !p) return 0;
  if (variantId) {
    const v = p.reservedByVariant ? Number(p.reservedByVariant[variantId]) : 0;
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  const n = Number(p.reservedQty);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Livres para vender: o que a prateleira tem menos o que está separado. */
export function livresParaVender(estoque: number, reservado: number): number {
  return Math.max(0, (Number(estoque) || 0) - (Number(reservado) || 0));
}

/**
 * Lançar mais `adicionar` no carrinho invade a reserva? Só pergunta quando
 * há reserva e o carrinho passa do que está livre.
 */
export function vendaInvadeReserva(args: { estoque: number; reservado: number; noCarrinho: number; adicionar?: number }): boolean {
  const { estoque, reservado, noCarrinho, adicionar = 1 } = args;
  if (!(reservado > 0)) return false;
  return (Number(noCarrinho) || 0) + adicionar > livresParaVender(estoque, reservado);
}

/** Lê os campos do GET /products. Ausentes = objeto vazio (nada muda). */
export function camposDaReserva(p: any): { reservedQty?: number; reservedByVariant?: Record<string, number> } {
  if (!p || p.reserved_qty === undefined) return {};
  const porVariante: Record<string, number> = {};
  const bruto = p.reserved_by_variant;
  if (bruto && typeof bruto === "object") {
    for (const k of Object.keys(bruto)) {
      const n = Number(bruto[k]);
      if (Number.isFinite(n) && n > 0) porVariante[k] = n;
    }
  }
  return { reservedQty: Number(p.reserved_qty) || 0, reservedByVariant: porVariante };
}

export const TEXTOS_DA_RESERVA = {
  // Mockup: "1 reservado". FORA DO MOCKUP: o plural "2 reservados".
  selo: (n: number) => `${n} ${n === 1 ? "reservado" : "reservados"}`,
  // Mockup: "3 livres para vender". FORA DO MOCKUP: o singular.
  livres: (n: number) => `${n} ${n === 1 ? "livre para vender" : "livres para vender"}`,
  avisoTitulo: "Esta peça está reservada",
  // FORA DO MOCKUP: o mockup diz "no pedido P-0012 da Marina Duarte, que vem
  // buscar sexta, 20/11". O GET /products e o bipe não trazem o pedido.
  avisoTexto: (estoque: number) => ` em pedido guardado. Só tem ${estoque} no estoque. Vender mesmo assim?`,
  naoVender: "Não vender",
  venderMesmoAssim: "Vender mesmo assim",
} as const;
