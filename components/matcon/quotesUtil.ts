// ============================================================
// AURA. — Matcon (materiais de construção): datas do orçamento (M1)
//
// 22/09/2026. Funções puras, sem React: a esteira de /matcon/orcamentos
// só formata o que sai daqui. Estão separadas da tela porque vencimento é
// a regra que o dono lê de manhã ("quantos vencem hoje e quanto dinheiro
// tem parado ali", docs/matcon-faseamento-po-ux.md §3/M1) e porque data é
// onde erro de fuso mora — o teste
// (__tests__/matconQuotesUtil.test.ts) roda em America/Sao_Paulo, o mesmo
// fuso do jest.config.
//
// Duas decisões que valem para as duas esteiras (Entregas reaproveita):
//   1. `valid_until` é data pura (YYYY-MM-DD). Nunca passa por
//      `new Date(iso)` direto — em UTC-3 isso vira a véspera. Quebramos a
//      string em partes, como services/oticaApi.ts:fmtIsoDate já faz.
//   2. Vencendo é marcado por FORMA + TEXTO, nunca só por cor (regra de
//      acessibilidade da esteira da Ótica): quem chama usa o "▲" junto do
//      rótulo que estas funções devolvem.
// ============================================================

/** Meia-noite local da data pura "YYYY-MM-DD". null se a string não presta. */
function meiaNoiteLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  var partes = String(iso).slice(0, 10).split("-");
  var y = Number(partes[0]), m = Number(partes[1]), d = Number(partes[2]);
  if (!y || !m || !d) return null;
  var dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Dias inteiros até o orçamento vencer, contando de meia-noite a
 * meia-noite: 0 = vence hoje, 1 = amanhã, negativo = já venceu.
 * `agora` existe para o teste; em produção ninguém passa.
 */
export function diasAteVencer(validUntil: string | null | undefined, agora?: Date): number | null {
  var alvo = meiaNoiteLocal(validUntil);
  if (!alvo) return null;
  var hoje = agora ? new Date(agora.getTime()) : new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

/** "2026-09-23" -> "23/09". Data pura: sem new Date(iso) para não virar a véspera. */
export function fmtDiaMes(iso: string | null | undefined): string {
  if (!iso) return "";
  var p = String(iso).slice(0, 10).split("-");
  return p[0] && p[1] && p[2] ? p[2] + "/" + p[1] : "";
}

/** Timestamp do servidor ("2026-09-22T11:03:00Z") -> "22/09" no fuso da loja. */
export function fmtDiaMesDeTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

/** Está na janela de aviso: ainda não venceu e falta no máximo `warnDays`. */
export function estaVencendo(validUntil: string | null | undefined, warnDays: number, agora?: Date): boolean {
  var d = diasAteVencer(validUntil, agora);
  if (d === null) return false;
  return d >= 0 && d <= warnDays;
}

/** Já passou da validade. */
export function estaVencido(validUntil: string | null | undefined, agora?: Date): boolean {
  var d = diasAteVencer(validUntil, agora);
  return d !== null && d < 0;
}

/**
 * A linha de vencimento do card, em português de balcão:
 *   "vence hoje, 22/09" · "vence amanhã, 23/09" · "vence em 3 dias, 25/09"
 *   "venceu em 14/09" · "vale até 29/09" (fora da janela de aviso)
 * Sem `warnDays`, qualquer prazo futuro vira "vence em N dias".
 */
export function rotuloVencimento(
  validUntil: string | null | undefined,
  opts?: { agora?: Date; warnDays?: number },
): string {
  var d = diasAteVencer(validUntil, opts && opts.agora);
  if (d === null) return "";
  var dia = fmtDiaMes(validUntil);
  if (d < 0) return "venceu em " + dia;
  if (d === 0) return "vence hoje, " + dia;
  if (d === 1) return "vence amanhã, " + dia;
  var warn = opts && typeof opts.warnDays === "number" ? opts.warnDays : null;
  if (warn !== null && d > warn) return "vale até " + dia;
  return "vence em " + d + " dias, " + dia;
}

/** O selo curto do canto do card: "Vence em 2 dias", "Venceu", "Vence hoje". */
export function seloVencimento(validUntil: string | null | undefined, agora?: Date): string {
  var d = diasAteVencer(validUntil, agora);
  if (d === null) return "";
  if (d < 0) return "Venceu";
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence em 1 dia";
  return "Vence em " + d + " dias";
}

/** "feito por Davi em 22/09" — some o "por Davi" quando não há vendedor. */
export function rotuloAutoria(sellerName: string | null | undefined, createdAt: string | null | undefined): string {
  var quem = (sellerName || "").trim();
  var quando = fmtDiaMesDeTimestamp(createdAt);
  if (quem && quando) return "feito por " + quem.split(/\s+/)[0] + " em " + quando;
  if (quem) return "feito por " + quem.split(/\s+/)[0];
  if (quando) return "feito em " + quando;
  return "";
}
