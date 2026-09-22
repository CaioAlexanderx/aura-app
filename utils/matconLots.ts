// ============================================================
// AURA. — Matcon M4: lote / tonalidade (funcoes puras)
//
// 22/09/2026 — docs/CONTRACT_MATCON.md (M4, "Lote / tonalidade") e mockup
// docs/mockups/matcon-m4-profundidade.html (#entrada, #lotes, #carrinho).
//
// Sem React, sem API: quem pergunta e o carrinho (CartPanel/LotePicker), a
// conferencia do XML (DanfeImportModal) e a lista do estoque (ProductRow /
// ProductTableWeb). Tres regras cabem aqui:
//
//   1) usaLote        — esta loja controla lote NESTE produto?
//   2) alocarLotes    — de quais lotes sai a quantidade vendida?
//   3) fraseDoAviso   — o que o vendedor le quando nao cabe em um lote so?
//
// Contrato de zero impacto: com `matcon_lots_enabled` desligado (o default),
// usaLote devolve false e nada daqui e chamado — o carrinho, o XML e o
// estoque ficam identicos aos de hoje. O aviso NUNCA bloqueia a venda: ele
// informa, e quem decide e o balcao (decisao de PO no mockup, secao 3).
// ============================================================

import type { LotAllocation } from "@/services/matconApi";
import { fmtQty } from "@/utils/matconUnits";

// So produto vendido em area/volume tem tonalidade e bitola. Cimento em
// "sc" nao entra — a linha do XML nem mostra os campos (mockup #entrada).
var LOT_UNITS = new Set(["m²", "m2", "m³", "m3"]);

/** Saldo de um lote, na unidade de VENDA do produto. E o subconjunto de
 *  ProductLot (services/matconApi) que estas contas precisam. */
export type LoteSaldo = {
  id: string;
  lot_code: string;
  qty: number;
  caliber?: string | null;
  shade?: string | null;
  received_at?: string | null;
};

/** `lots_summary` do GET /products (M4 do contrato). */
export type LotsSummary = {
  count: number;
  lots: Array<{ id: string; lot_code: string; qty: number }>;
};

export type EstadoLote = "cabe" | "dois_lotes" | "nao_cabe";

export type ResultadoAlocacao = {
  /** Vai como `items[].lot_allocations` no POST /pdv/sale. Vazio = o
   *  backend baixa FIFO, que e o comportamento default do contrato. */
  allocations: LotAllocation[];
  estado: EstadoLote;
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function num(v: unknown): number {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

/** Gate do M4: o toggle do Matcon + a frase da config ("Controlo lote e
 *  tonalidade nos produtos vendidos em m² e m³") + a unidade do produto.
 *  Qualquer um dos tres faltando -> false, e a tela fica a de hoje. */
export function usaLote(
  settings: { matcon_enabled?: boolean; matcon_lots_enabled?: boolean } | null | undefined,
  unit: string | null | undefined
): boolean {
  if (!settings || settings.matcon_enabled !== true || settings.matcon_lots_enabled !== true) return false;
  if (!unit) return false;
  return LOT_UNITS.has(String(unit).trim().toLowerCase());
}

// Lote preferido primeiro, o resto na ordem que veio (o GET devolve do mais
// antigo para o mais novo — FIFO e so nao reordenar).
function ordenar(lots: LoteSaldo[], preferidoId?: string | null): LoteSaldo[] {
  if (!preferidoId) return lots;
  var pref = lots.filter(function (l) { return l.id === preferidoId; });
  if (pref.length === 0) return lots;
  return pref.concat(lots.filter(function (l) { return l.id !== preferidoId; }));
}

/**
 * De quais lotes sai a quantidade vendida. Preferido primeiro (o vendedor
 * escolheu no "trocar lote"), depois FIFO.
 *
 *   cabe        — um lote sozinho cobre tudo (so a linha violeta no item)
 *   dois_lotes  — dois lotes cobrem (aviso ambar com as duas parcelas)
 *   nao_cabe    — precisa de 3+ lotes, ou nem somando todos da
 *
 * Sem lotes cadastrados devolve `[]` + "cabe": produto novo, ou loja que
 * ainda nao importou nota nenhuma, nao ganha aviso nenhum.
 */
export function alocarLotes(
  qty: number,
  lots: LoteSaldo[] | null | undefined,
  preferidoId?: string | null
): ResultadoAlocacao {
  var disponiveis = (lots || []).filter(function (l) { return !!l && num(l.qty) > 0; });
  var alvo = round3(num(qty));
  if (alvo <= 0 || disponiveis.length === 0) return { allocations: [], estado: "cabe" };

  var restante = alvo;
  var allocations: LotAllocation[] = [];
  var ordenados = ordenar(disponiveis, preferidoId);

  for (var i = 0; i < ordenados.length; i++) {
    if (restante <= 0) break;
    var l = ordenados[i];
    var usa = round3(Math.min(num(l.qty), restante));
    if (usa <= 0) continue;
    allocations.push({ lot_id: l.id, lot_code: l.lot_code, quantity: usa });
    restante = round3(restante - usa);
  }

  var estado: EstadoLote;
  if (restante > 0) estado = "nao_cabe";
  else if (allocations.length <= 1) estado = "cabe";
  else if (allocations.length === 2) estado = "dois_lotes";
  else estado = "nao_cabe";

  return { allocations: allocations, estado: estado };
}

/** A linha violeta do item: "lote 27B · 95,12 m² disponíveis". O saldo e o
 *  do LOTE inteiro, nao a parcela alocada — e o que o vendedor precisa pra
 *  saber se o ambiente sai de uma pilha so. */
export function fraseDoLote(lote: LoteSaldo | null | undefined, unit?: string | null): string | null {
  if (!lote) return null;
  return "lote " + lote.lot_code + " · " + fmtQty(round3(num(lote.qty)), unit || undefined) + " disponíveis";
}

/**
 * O aviso ambar do carrinho (mockup #carrinho, "Três estados do mesmo item").
 * Sempre com simbolo E frase — nunca so com a cor.
 *
 *   cabe       -> null (so a linha violeta do lote)
 *   dois_lotes -> "Precisa de 2 lotes: 27B (95,12 m²) + 28A (4,88 m²). …"
 *   nao_cabe   -> "Nenhum lote sozinho dá conta — o maior tem 95,12 m². …"
 */
export function fraseDoAviso(
  estado: EstadoLote,
  allocations: LotAllocation[] | null | undefined,
  lots: LoteSaldo[] | null | undefined,
  unit?: string | null
): string | null {
  var allocs = allocations || [];
  var u = unit || undefined;

  if (estado === "dois_lotes") {
    if (allocs.length < 2) return null;
    var partes = allocs.map(function (a) {
      return a.lot_code + " (" + fmtQty(round3(num(a.quantity)), u) + ")";
    });
    return (
      "Precisa de " + allocs.length + " lotes: " + partes.join(" + ") +
      ". Lotes diferentes podem ter tom diferente — avise o cliente ou escolha outro lote."
    );
  }

  if (estado === "nao_cabe") {
    var disponiveis = (lots || []).filter(function (l) { return !!l && num(l.qty) > 0; });
    if (disponiveis.length === 0) return null;
    var maior = disponiveis.reduce(function (a, b) { return num(b.qty) > num(a.qty) ? b : a; });
    var soma = round3(disponiveis.reduce(function (s, l) { return s + num(l.qty); }, 0));
    var pedido = round3(allocs.reduce(function (s, a) { return s + num(a.quantity); }, 0));
    // Nem somando tudo da: as alocacoes esvaziaram todos os lotes e ainda
    // ficou faltando. A saida honesta ai nao e "separe N lotes" — e dizer
    // quanto a loja tem no total.
    var esvaziouTudo = allocs.length >= disponiveis.length && pedido >= soma - 0.0005;
    var frase = "Nenhum lote sozinho dá conta — o maior tem " + fmtQty(round3(num(maior.qty)), u) + ".";
    if (!esvaziouTudo && allocs.length >= 2) {
      return frase + " Dá para separar " + allocs.length + " lotes ou pedir mais do " + maior.lot_code + ".";
    }
    return frase + " Somando todos os lotes dá " + fmtQty(soma, u) + " — dá para pedir mais do " + maior.lot_code + ".";
  }

  return null;
}

/** O saldo da lista do estoque: "148,48 m² em 2 lotes" (mockup #lotes).
 *  Sem lote controlado (ou sem lote nenhum), devolve null e a ficha fica a
 *  de hoje: um numero e pronto. */
export function resumoDeLotes(
  lotsSummary: LotsSummary | null | undefined,
  unit?: string | null
): string | null {
  if (!lotsSummary) return null;
  var lots = Array.isArray(lotsSummary.lots) ? lotsSummary.lots : [];
  if (lots.length === 0) return null;
  var soma = round3(lots.reduce(function (s, l) { return s + num(l.qty); }, 0));
  var n = lotsSummary.count > 0 ? lotsSummary.count : lots.length;
  return fmtQty(soma, unit || undefined) + " em " + n + (n === 1 ? " lote" : " lotes");
}
