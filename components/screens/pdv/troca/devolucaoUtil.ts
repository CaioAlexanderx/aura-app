// ============================================================
// AURA. — PDV · Troca · Devolução de sobra de obra (M4, delta no wizard)
//
// Criado: 22/09/2026 (Matcon M4 — docs/matcon-faseamento-po-ux.md §3/M4 +
// docs/CONTRACT_MATCON.md §"Devolução de sobra de obra (delta no wizard de
// troca)"). Regra 5 do CLAUDE.md: TrocaModal é a DNA canônica de wizard —
// este arquivo só alimenta o Step2Returns/Step3NewItems/Step5Success
// existentes, não cria fluxo novo.
//
// Contrato (docs/CONTRACT_MATCON.md, M4):
//   returns.items[].quantity aceita numeric(12,3); item de unidade
//   fracionada com purchase_factor: só múltiplos de caixa fechada voltam
//   ao estoque — restock_qty = floor(quantity / purchase_factor) ×
//   purchase_factor; o resto é not_restocked_qty (R$ 0, registrado pra
//   auditoria). Sem fator (produto vendido inteiro, ex.: cimento em sc):
//   volta tudo. returns.items[].lot_id é opcional (volta ao lote de
//   origem). settlement ∈ store_credit | refund quando a troca fecha sem
//   itens novos ("não vai levar nada").
//
// Funções puras, sem React — mesma convenção de utils/matconUnits.ts.
// ============================================================
import { fmtQty } from "@/utils/matconUnits";
import { fmtBRL } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type RestockDevolucao = {
  /** Quantidade que efetivamente volta ao estoque (múltiplo de caixa fechada). */
  restockQty: number;
  /** Nº de caixas fechadas cobertas por restockQty. `null` sem purchase_factor (produto sem fator — tudo volta, não há "caixa"). */
  caixasFechadas: number | null;
  /** Sobra que NÃO volta ao estoque (caixa aberta) — vale R$ 0. */
  naoVolta: number;
};

// Decompõe a quantidade devolvida em (caixas fechadas que voltam) + (sobra
// de caixa aberta que não volta). Sem purchase_factor — produto vendido
// inteiro, sem embalagem fracionável — tudo volta e não existe conceito de
// "caixa": caixasFechadas é null (não 0 — 0 significaria "nenhuma caixa
// fechada devolvida", o que é diferente de "esse produto não tem caixa").
export function restockDeDevolucao(
  qty: number,
  purchaseFactor: number | null | undefined
): RestockDevolucao {
  const q = Number(qty) || 0;
  if (!purchaseFactor || purchaseFactor <= 0 || !isFinite(purchaseFactor)) {
    return { restockQty: round3(q), caixasFechadas: null, naoVolta: 0 };
  }
  // 1e-9: tolera erro de ponto flutuante perto do múltiplo exato (mesmo
  // truque de toPackages em utils/matconUnits.ts).
  const caixasFechadas = Math.floor(q / purchaseFactor + 1e-9);
  const restockQty = round3(caixasFechadas * purchaseFactor);
  const naoVolta = round3(q - restockQty);
  return { restockQty, caixasFechadas, naoVolta };
}

// Crédito do item devolvido — sobre a quantidade que REALMENTE volta ao
// estoque (restockQty), não sobre a quantidade total devolvida. A sobra de
// caixa aberta vale R$ 0 (fraseCaixaAberta explica o porquê ao vendedor).
export function creditoDaDevolucao(restockQty: number, unitPrice: number): number {
  return round2((Number(restockQty) || 0) * (Number(unitPrice) || 0));
}

// Linha verde — caixa(s) fechada(s) que voltam ao estoque + crédito.
// "✓ 2 caixas fechadas — 4,64 m² voltam ao estoque, no lote 27B.
//  Crédito de R$ 254,74." (mockup docs/mockups/matcon-m4-profundidade.html)
export function fraseCaixaFechada(args: {
  caixasFechadas: number;
  restockQty: number;
  unit: string;
  lotCode?: string | null;
  credito: number;
}): string {
  const { caixasFechadas, restockQty, unit, lotCode, credito } = args;
  const caixaTxt = caixasFechadas === 1 ? "1 caixa fechada" : `${caixasFechadas} caixas fechadas`;
  const loteTxt = lotCode ? `, no lote ${lotCode}` : "";
  return `✓ ${caixaTxt} — ${fmtQty(restockQty, unit)} voltam ao estoque${loteTxt}. Crédito de ${fmtBRL(credito)}.`;
}

// Linha âmbar — sobra de caixa aberta que NÃO volta ao estoque (vale R$ 0).
// "Caixa aberta não volta ao estoque e vale R$ 0. Peça fechada ninguém
//  compra, e o tom já não bate com o lote. A loja pode aceitar por fora,
//  mas o estoque não conta com ela." (mesmo mockup)
export function fraseCaixaAberta(args: { naoVolta: number; unit: string }): string {
  const { naoVolta, unit } = args;
  return `Caixa aberta (${fmtQty(naoVolta, unit)}) não volta ao estoque e vale R$ 0. Peça fechada ninguém compra, e o tom já não bate com o lote. A loja pode aceitar por fora, mas o estoque não conta com ela.`;
}

export type ResumoSucessoItem = {
  caixasFechadas: number | null;
  lotCode?: string | null;
  credito: number;
};

// Resumo da tela de sucesso (Step5Success): "estoque +2 cx no lote 27B ·
// vale de R$ 254,74". Soma caixas fechadas (ignora itens sem purchase_factor
// — caixasFechadas null) e o crédito total; usa o primeiro lote encontrado
// (troca de um único lote é o caso comum — vários lotes cai no "· vale de
// R$ X" sem citar lote, pra não inventar rótulo composto).
export function resumoSucesso(items: ResumoSucessoItem[]): string {
  const list = Array.isArray(items) ? items : [];
  let totalCaixas = 0;
  let totalCredito = 0;
  const lotCodes = new Set<string>();
  for (const it of list) {
    if (typeof it.caixasFechadas === "number" && it.caixasFechadas > 0) {
      totalCaixas += it.caixasFechadas;
      if (it.lotCode) lotCodes.add(it.lotCode);
    }
    totalCredito += Number(it.credito) || 0;
  }
  const parts: string[] = [];
  if (totalCaixas > 0) {
    const loteTxt = lotCodes.size === 1 ? ` no lote ${Array.from(lotCodes)[0]}` : "";
    parts.push(`estoque +${totalCaixas} cx${loteTxt}`);
  }
  if (totalCredito > 0.004) {
    parts.push(`vale de ${fmtBRL(totalCredito)}`);
  }
  return parts.join(" · ");
}
