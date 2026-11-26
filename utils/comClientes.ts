// ============================================================
// AURA. — Peças "com clientes" da Venda condicional (C13, 26/11/2026)
//
// A cliente leva peças para experimentar: cada uma fica "com cliente"
// (fora da loja, ainda no estoque). O backend devolve `out_qty` e
// `out_by_variant` ({variant_id: qtd}) em GET /products e, no bipe
// (/pdv/scan, /pdv/scan/batch), `out_qty` no produto e `variant_out_qty` na
// variante bipada. Só vêm com a trava CONDICIONAL_LIBERADA ligada no backend
// (ou para a equipe Aura): sem eles, "com clientes" é 0 e nada aparece.
//
// Regra R3: livres = estoque − com clientes − reservado, nunca negativo.
// Mesmo desenho de utils/reservaDoPedido.ts, que continua cuidando da reserva.
// ============================================================

type ComClientes = {
  outQty?: number | null;
  outByVariant?: Record<string, number> | null;
} | null | undefined;

/** Peças com clientes do produto (ou só da variante). Ausente ou 0 = nada a mostrar. */
export function comClientesDoProduto(p: ComClientes, liberado: boolean, variantId?: string | null): number {
  if (liberado !== true || !p) return 0;
  if (variantId) {
    const v = p.outByVariant ? Number(p.outByVariant[variantId]) : 0;
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  const n = Number(p.outQty);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Livres para vender: estoque menos o que está com clientes e o que está reservado. Nunca negativo. */
export function livresDaPeca(estoque: number, comClientes: number, reservado: number = 0): number {
  return Math.max(0, (Number(estoque) || 0) - (Number(comClientes) || 0) - (Number(reservado) || 0));
}

/**
 * Lançar mais `adicionar` no carrinho passa do que está livre, havendo peça
 * com cliente? É o caso do bipe de uma peça que já saiu em condicional.
 */
export function vendaInvadeComClientes(args: { estoque: number; comClientes: number; reservado?: number; noCarrinho: number; adicionar?: number }): boolean {
  const { estoque, comClientes, reservado = 0, noCarrinho, adicionar = 1 } = args;
  if (!(comClientes > 0)) return false;
  return (Number(noCarrinho) || 0) + adicionar > livresDaPeca(estoque, comClientes, reservado);
}

/** Lê os campos do GET /products. Ausentes = objeto vazio (o produto não ganha chave). */
export function camposDeComClientes(p: any): { outQty?: number; outByVariant?: Record<string, number> } {
  if (!p || p.out_qty === undefined) return {};
  const porVariante: Record<string, number> = {};
  const bruto = p.out_by_variant;
  if (bruto && typeof bruto === "object") {
    for (const k of Object.keys(bruto)) {
      const n = Number(bruto[k]);
      if (Number.isFinite(n) && n > 0) porVariante[k] = n;
    }
  }
  return { outQty: Number(p.out_qty) || 0, outByVariant: porVariante };
}

export const TEXTOS_COM_CLIENTES = {
  // Mockup: "1 com cliente" / "2 com clientes".
  selo: (n: number) => `${n} com ${n === 1 ? "cliente" : "clientes"}`,
  avisoTitulo: "Esta peça consta com uma cliente",
  // FORA DO MOCKUP: ele diz "Está na condicional C-0029 da Tainá Moraes e não
  // há outra livre no estoque." O GET /products e o bipe não trazem o número
  // da condicional nem a cliente, então a frase fica só com o que se sabe.
  avisoTexto: "Não há outra livre no estoque. Se a peça está na sua mão, ela já devolveu: registre a devolução para o estoque ficar certo.",
  naoVender: "Não vender",
  venderMesmoAssim: "Vender mesmo assim",
  verACondicional: "Ver a condicional",
} as const;

/** Destino do "Ver a condicional" por ora: a aba Condicionais em Vendas. */
export const ROTA_DAS_CONDICIONAIS = "/vendas?tab=condicionais";
