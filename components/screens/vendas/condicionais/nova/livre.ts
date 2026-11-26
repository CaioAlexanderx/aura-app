// ============================================================
// AURA. — Peças livres para a condicional (C6, 26/11/2026)
//
// Livres = estoque − com clientes − reservado (notas do produto, R3). O
// estoque da prateleira não muda quando a peça sai em condicional: ela só
// passa a contar em "com clientes". Funções puras.
//
// A conta é a do C13 (utils/comClientes.ts: camposDeComClientes e
// livresDaPeca) e a reserva do Pedido (utils/reservaDoPedido.ts). Se o backend
// mandar `resolver_by_variant` / `resolver_qty` (peças para resolver), entram
// na conta. Campo ausente = 0, e nada muda.
// ============================================================

import { camposDeComClientes, livresDaPeca } from "@/utils/comClientes";
import { camposDaReserva } from "@/utils/reservaDoPedido";

export type ReservaDoProduto = {
  reservadoTotal: number;
  reservadoPorVariante: Record<string, number>;
  comClienteTotal: number;
  comClientePorVariante: Record<string, number>;
  resolverTotal: number;
  resolverPorVariante: Record<string, number>;
};

function mapa(bruto: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (bruto && typeof bruto === "object") {
    for (const k of Object.keys(bruto as Record<string, unknown>)) {
      const n = Number((bruto as Record<string, unknown>)[k]);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
  }
  return out;
}

/** Lê reserva do pedido, "com clientes" e "para resolver" do produto cru da API. */
export function reservaDoProdutoCru(p: any): ReservaDoProduto {
  const r = camposDaReserva(p);
  const c = camposDeComClientes(p);
  const n = Number(p?.resolver_qty);
  return {
    reservadoTotal: r.reservedQty || 0,
    reservadoPorVariante: r.reservedByVariant || {},
    comClienteTotal: c.outQty || 0,
    comClientePorVariante: c.outByVariant || {},
    resolverTotal: Number.isFinite(n) && n > 0 ? n : 0,
    resolverPorVariante: mapa(p?.resolver_by_variant),
  };
}

/** Livres para levar: estoque − com clientes − reservado (− para resolver), nunca negativo. */
export function livresParaLevar(estoque: number, reservado: number, comCliente: number, resolver: number = 0): number {
  return livresDaPeca(estoque, comCliente, (Number(reservado) || 0) + (Number(resolver) || 0));
}
