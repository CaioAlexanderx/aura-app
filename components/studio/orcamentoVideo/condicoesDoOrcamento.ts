// ============================================================
// components/studio/orcamentoVideo/condicoesDoOrcamento.ts
//
// As condições de pagamento do orçamento em vídeo 3D (28/09/2026).
//
// ESPELHO de aura-backend `src/services/orcamentoEmVideo.js`
// (valoresDasCondicoes). O servidor devolve os mesmos valores ao salvar;
// esta conta é a prévia instantânea enquanto a lojista digita.
//
// Decisão do PO (28/09): desconto é SEMPRE da lojista, no orçamento. Sem
// definição = sem desconto. Nada vem da configuração da loja (o desconto do
// Pix do canal digital NÃO entra) e nada é empilhado por conta própria.
// O Pix usa a regra canônica em centavos (precoDaSacola / descontoDoPix):
//   precoPixCentavos = Math.round(totalCentavos * (100 - pct) / 100)
// ============================================================

export type CondicoesDoOrcamento = {
  pix_desconto_pct: number | null;
  parcelas: number | null;
  prazo_dias_uteis: number | null;
  observacao: string | null;
};

export const CONDICOES_VAZIAS: CondicoesDoOrcamento = {
  pix_desconto_pct: null,
  parcelas: null,
  prazo_dias_uteis: null,
  observacao: null,
};

export type ValoresDasCondicoes = {
  pix?: { pct: number; valor: number };
  cartao?: { parcelas: number; valor: number };
  sinal?: { pct: number | null; valor: number };
  prazo?: { dias_uteis: number };
  observacao?: string;
};

type OrcamentoComCondicoes = {
  total: number | string;
  deposit_pct?: number | string | null;
  deposit_amount?: number | string | null;
  condicoes?: Partial<CondicoesDoOrcamento> | null;
};

/** Preço no Pix, em reais, pela regra canônica em centavos. */
export function precoNoPixDoOrcamento(total: number, pct: number): number {
  const centavos = Math.round((Number(total) || 0) * 100);
  if (!(pct > 0)) return centavos / 100;
  return Math.round(centavos * (100 - pct) / 100) / 100;
}

export function valoresDasCondicoes(q: OrcamentoComCondicoes): ValoresDasCondicoes {
  const c = q.condicoes || {};
  const total = Number(q.total) || 0;
  const out: ValoresDasCondicoes = {};
  const pix = Number(c.pix_desconto_pct);
  if (pix > 0) out.pix = { pct: pix, valor: precoNoPixDoOrcamento(total, pix) };
  const n = Number(c.parcelas);
  if (n >= 2) out.cartao = { parcelas: n, valor: Math.round((total / n) * 100) / 100 };
  const sinal = Number(q.deposit_amount);
  if (sinal > 0) out.sinal = { pct: q.deposit_pct != null && q.deposit_pct !== "" ? Number(q.deposit_pct) : null, valor: sinal };
  const prazo = Number(c.prazo_dias_uteis);
  if (prazo > 0) out.prazo = { dias_uteis: prazo };
  if (c.observacao && String(c.observacao).trim()) out.observacao = String(c.observacao).trim();
  return out;
}

/** "R$ 1.234,56" */
export function reais(v: number): string {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "5" / "2,5" — percentual sem casas inúteis. */
export function pct(v: number): string {
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

/** Número digitado ("5", "5,5", "") → número ou null. */
export function lerNumero(txt: string): number | null {
  const s = String(txt ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Mesmas regras de validação do servidor (lerCondicoes). Null = tudo certo. */
export function erroDasCondicoes(c: CondicoesDoOrcamento): string | null {
  if (c.pix_desconto_pct !== null && (c.pix_desconto_pct <= 0 || c.pix_desconto_pct > 50)) {
    return "Desconto no Pix deve ficar entre 0,1% e 50%";
  }
  if (c.parcelas !== null && (!Number.isInteger(c.parcelas) || c.parcelas < 2 || c.parcelas > 12)) {
    return "Parcelas: um número inteiro de 2 a 12";
  }
  if (c.prazo_dias_uteis !== null && (!Number.isInteger(c.prazo_dias_uteis) || c.prazo_dias_uteis < 1 || c.prazo_dias_uteis > 120)) {
    return "Prazo: um número inteiro de 1 a 120 dias úteis";
  }
  if (c.observacao && c.observacao.length > 280) return "Observação com até 280 caracteres";
  return null;
}
