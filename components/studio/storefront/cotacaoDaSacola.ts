// ============================================================
// components/studio/storefront/cotacaoDaSacola.ts
//
// A sacola cotada no servidor (Fase 2, contrato B3:
// POST /storefront/:slug/studio/cotacao).
//
// O preço da sacola era calculado no app com regras copiadas do backend
// à mão (JORNADA D12). Toda regra nova de preço nascia duas vezes, e
// quando as cópias divergiam a cliente via um total e levava 400/409 no
// pagamento. Com a chave `vitrine_v2`, a sacola e o checkout mostram o
// que o servidor responde — com as MESMAS funções que ele usa para cobrar
// — e a conta local (precoDaSacola.ts) fica só como estimativa
// instantânea enquanto a resposta não chega.
//
// Os `items` são exatamente os do pedido: `itensDoPedido` é a única
// montagem, usada pelos dois POSTs.
// ============================================================
import type { CartLine } from "./types";
import { sideOf } from "@/components/studio/customizationConfig";
import { versoAtivo } from "./versoDoPedido";
import { meioEfetivo } from "./precoDaSacola";

/**
 * Os itens como o servidor espera, no pedido e na cotação.
 *
 * - O verso só vai quando a cliente o escolheu E preencheu (decisão do
 *   Caio, 04/09/2026, versoDoPedido.ts); lado inativo sai sem os campos.
 * - `has_middle_selected` é ESPELHO do has_back_selected: o backend
 *   confia nele para cobrar o meio.
 */
export function itensDoPedido(cart: CartLine[]) {
  return (cart || []).map((l) => {
    const cfg = l.product.customization_config;
    const backActive = versoAtivo(cfg, l.hasBackSelected, l.values);
    const middleActive = meioEfetivo(cfg, l.values?.has_middle_selected);
    let valuesOut: Record<string, any> = l.values;
    if (cfg?.has_back === true && !backActive && cfg.fields) {
      const cleaned: Record<string, any> = { ...l.values };
      for (const f of cfg.fields) if (sideOf(f) === "back") delete cleaned[f.id];
      valuesOut = cleaned;
    }
    if (cfg?.has_middle === true && !middleActive && cfg.fields) {
      const cleaned: Record<string, any> = { ...valuesOut };
      for (const f of cfg.fields) if (sideOf(f) === "middle") delete cleaned[f.id];
      valuesOut = cleaned;
    }
    return {
      product_id: l.product.id,
      quantity: l.qty,
      customization: {
        ...valuesOut,
        has_back_selected: backActive,
        has_middle_selected: middleActive,
      },
    };
  });
}

export type CotacaoDaSacola = {
  itens: Array<{
    indice: number;
    preco_unitario: number;
    total: number;
    detalhe: {
      base: number; opcoes: number; verso: number; meio: number; arte: number;
      faixa: { min_qty: number; pct: number } | null;
    } | null;
  }>;
  subtotal: number;
  desconto_pix: number;
  total: number;
  total_pix: number;
  prazo_dias_uteis: number | null;
};

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

/** A resposta do servidor, validada. Qualquer coisa estranha vira null (fica a estimativa). */
export function lerCotacao(j: any, linhas: number): CotacaoDaSacola | null {
  if (!j || typeof j !== "object" || j.error) return null;
  const subtotal = n(j.subtotal);
  const total = n(j.total);
  if (!Number.isFinite(subtotal) || !Number.isFinite(total)) return null;
  const itens = Array.isArray(j.itens) ? j.itens : [];
  if (itens.length !== linhas) return null;
  const desconto = Number.isFinite(n(j.desconto_pix)) ? n(j.desconto_pix) : 0;
  return {
    itens: itens.map((i: any, k: number) => ({
      indice: Number.isFinite(n(i?.indice)) ? n(i.indice) : k,
      preco_unitario: Number.isFinite(n(i?.preco_unitario)) ? n(i.preco_unitario) : 0,
      total: Number.isFinite(n(i?.total)) ? n(i.total) : 0,
      detalhe: i?.detalhe && typeof i.detalhe === "object"
        ? {
            base: n(i.detalhe.base) || 0, opcoes: n(i.detalhe.opcoes) || 0,
            verso: n(i.detalhe.verso) || 0, meio: n(i.detalhe.meio) || 0,
            arte: n(i.detalhe.arte) || 0,
            faixa: i.detalhe.faixa && Number.isFinite(n(i.detalhe.faixa.min_qty))
              ? { min_qty: n(i.detalhe.faixa.min_qty), pct: n(i.detalhe.faixa.pct) || 0 }
              : null,
          }
        : null,
    })),
    subtotal,
    desconto_pix: desconto,
    total,
    total_pix: Number.isFinite(n(j.total_pix)) ? n(j.total_pix) : total - desconto,
    prazo_dias_uteis: Number.isFinite(n(j.prazo_dias_uteis)) && n(j.prazo_dias_uteis) > 0 ? Math.round(n(j.prazo_dias_uteis)) : null,
  };
}

/** A assinatura do que se cota: mudou, a cotação velha não vale mais. */
export function assinaturaDaCotacao(cart: CartLine[], extra?: Record<string, unknown>): string {
  return JSON.stringify({ i: itensDoPedido(cart), ...(extra || {}) });
}

/** Tempo de respiro antes de cotar: a cliente digita "10" em duas teclas. */
export const RESPIRO_DA_COTACAO_MS = 450;
