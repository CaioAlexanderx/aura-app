// ============================================================
// AURA. — Promoção "primeiro mês pelo calendário" (13/10/2026)
//
// Quem assina até 31/10 não paga novembro; a 1ª cobrança é em 01/12. O backend
// (services/promocoes.js, backend#808) decide prazo, data e elegibilidade; o app
// só mostra. Nada de data fixa aqui: tudo sai do GET /billing/promocao-ativa,
// então trocar a campanha não exige novo build.
//
// Funções puras, para testar sem renderizar.
// ============================================================
import type { PromocaoAtivaResponse } from "@/services/billingApi";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-12-01" (ou ISO completo) → "01/12". */
export function diaMes(iso?: string | null): string {
  const p = String(iso || "").slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] : "";
}

/** "2026-12-01" → "01/12/2026". */
export function dataBR(iso?: string | null): string {
  const p = String(iso || "").slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
}

/**
 * Último dia da promoção (dd/mm) no calendário de Brasília. `termina_em` vem em
 * UTC (31/10 23:59 -03:00 = 01/11 02:59Z): ler o dia direto do ISO daria 01/11.
 */
export function prazoDiaMes(terminaEm?: string | null): string {
  const t = Date.parse(String(terminaEm || ""));
  if (isNaN(t)) return "";
  return diaMes(new Date(t - 3 * 60 * 60 * 1000).toISOString());
}

/** Mês que não é cobrado: o anterior à 1ª cobrança ("2026-12-01" → "novembro"). */
export function mesSemPagar(primeiraCobrancaEm?: string | null): string {
  const m = parseInt(String(primeiraCobrancaEm || "").slice(5, 7), 10);
  if (!(m >= 1 && m <= 12)) return "";
  return MESES[(m + 10) % 12];
}

/** A promoção vale agora? Considera o `elegivel` do backend e o prazo (cache velho). */
export function promocaoVale(p: PromocaoAtivaResponse | null | undefined, agora: number = Date.now()): boolean {
  if (!p || p.elegivel !== true) return false;
  const fim = Date.parse(p.termina_em);
  return isNaN(fim) || agora <= fim;
}

/** Frase curta para a faixa do Caixa: "Assine até 31/10 sem pagar novembro: a 1ª cobrança é só em 01/12." */
export function fraseDaFaixa(p: PromocaoAtivaResponse): string {
  const prazo = prazoDiaMes(p.termina_em);
  const mes = mesSemPagar(p.primeira_cobranca_em);
  const cobranca = diaMes(p.primeira_cobranca_em);
  if (!prazo || !mes) return p.titulo;
  return "Assine até " + prazo + " sem pagar " + mes + (cobranca ? ": a 1ª cobrança é só em " + cobranca + "." : ".");
}
