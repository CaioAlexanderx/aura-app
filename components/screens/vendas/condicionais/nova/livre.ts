// ============================================================
// AURA. — Peças livres para a condicional (C6, 26/11/2026)
//
// Livres = estoque − com clientes − reservado (notas do produto, R3). O
// estoque da prateleira não muda quando a peça sai em condicional: ela só
// passa a contar em "com clientes". Funções puras.
//
// O app ainda não tem `utils/comClientes.ts` (C13, aura-app#1378): o cálculo
// mora aqui, lendo os campos que o backend manda em GET /products
// (`reserved_by_variant`, `out_by_variant`, e os totais `reserved_qty` e
// `out_qty`). Quando o C13 entrar, esta leitura pode virar um import.
// Campo ausente (trava desligada, backend antigo) = 0, e nada muda.
// ============================================================

export type ReservaDoProduto = {
  reservadoTotal: number;
  reservadoPorVariante: Record<string, number>;
  comClienteTotal: number;
  comClientePorVariante: Record<string, number>;
};

function positivo(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function mapa(bruto: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (bruto && typeof bruto === "object") {
    for (const k of Object.keys(bruto as Record<string, unknown>)) {
      const n = positivo((bruto as Record<string, unknown>)[k]);
      if (n > 0) out[k] = n;
    }
  }
  return out;
}

/** Lê a reserva do pedido e o "com clientes" do produto cru da API. */
export function reservaDoProdutoCru(p: any): ReservaDoProduto {
  return {
    reservadoTotal: positivo(p?.reserved_qty),
    reservadoPorVariante: mapa(p?.reserved_by_variant),
    comClienteTotal: positivo(p?.out_qty),
    comClientePorVariante: mapa(p?.out_by_variant),
  };
}

/** Livres para levar: nunca negativo. */
export function livresParaLevar(estoque: number, reservado: number, comCliente: number): number {
  return Math.max(0, (Number(estoque) || 0) - (Number(reservado) || 0) - (Number(comCliente) || 0));
}
