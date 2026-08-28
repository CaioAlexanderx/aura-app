// ============================================================
// AURA. — Periodo e paginacao da tela de Vendas.
//
// Extraido de app/(tabs)/vendas.tsx em 28/08/2026 (relato Eryca #2). Duas
// coisas moram aqui porque sao puras e precisam de teste sem montar a tela:
//
//   periodToRange  janela [from, to] em ISO, sempre calculada em horario de
//                  Sao Paulo (UTC-3 fixo, DST abolido em 2019) e nunca no fuso
//                  do navegador. A versao antiga usava new Date(y,m,d), que cria
//                  meia-noite LOCAL — com o browser em UTC, venda do dia
//                  anterior aparecia na listagem do dia seguinte
//                  (relato Maria/Encanto Presentes, 13/05/2026).
//
//   PAGE_SIZE      30 por pagina. Antes a tela pedia 100 de uma vez e parava
//                  ali: numa loja de ~20 vendas/dia as 100 linhas (ORDER BY
//                  created_at DESC) acabavam por volta do dia 15 e o comeco do
//                  mes nao existia na tela. Nao era "carregue mais" — nao havia
//                  como chegar.
// ============================================================

export type PeriodKey = "today" | "week" | "month" | "custom" | "all";

export const PAGE_SIZE = 30;

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export type MonthAnchor = { y: number; m: number };

/** Mes/ano de "hoje" em Sao Paulo, independente do fuso do navegador. */
export function spCurrentMonth(now?: number): MonthAnchor {
  const spNow = new Date((now != null ? now : Date.now()) - 3 * 60 * 60 * 1000);
  return { y: spNow.getUTCFullYear(), m: spNow.getUTCMonth() };
}

/** Anda meses; Date.UTC normaliza a virada de ano (dez -> jan do ano seguinte). */
export function addMonths(anchor: MonthAnchor, delta: number): MonthAnchor {
  const d = new Date(Date.UTC(anchor.y, anchor.m + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}

// Meia-noite SP expressa em UTC = mesmo dia SP, 03:00 UTC.
function spMidnightUTC(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day, 3, 0, 0)).toISOString();
}

export function periodToRange(
  period: PeriodKey,
  customFromIso?: string | null,
  customToIso?: string | null,
  monthAnchor?: MonthAnchor,
  now?: number
): { from?: string; to?: string } {
  if (period === "all") return {};

  const spNow = new Date((now != null ? now : Date.now()) - 3 * 60 * 60 * 1000);
  const y = spNow.getUTCFullYear();
  const m = spNow.getUTCMonth();
  const d = spNow.getUTCDate();

  if (period === "today") {
    return { from: spMidnightUTC(y, m, d) };
  }
  if (period === "week") {
    return { from: new Date(Date.UTC(y, m, d - 6, 3, 0, 0)).toISOString() };
  }
  if (period === "month") {
    // 28/08/2026: "Mes" virou mes-calendario NAVEGAVEL — o seletor manda o
    // ancoro e daqui pra tras nao ha limite. Antes era sempre o mes corrente
    // (mais um chip "Mes anterior"), entao agosto de 2025 so dava pra alcancar
    // pelo Personalizado.
    const am = monthAnchor || { y: y, m: m };
    return {
      from: spMidnightUTC(am.y, am.m, 1),
      // Fim do mes = meia-noite SP do 1o do mes seguinte, menos 1ms.
      to: new Date(Date.UTC(am.y, am.m + 1, 1, 3, 0, 0) - 1).toISOString(),
    };
  }
  if (period === "custom") {
    // customFromIso / customToIso: "YYYY-MM-DD" (data SP) vindas do DateInput.
    // `to` e inclusivo: meia-noite SP do dia seguinte menos 1ms.
    const out: { from?: string; to?: string } = {};
    if (customFromIso) {
      const pf = customFromIso.split("-");
      out.from = spMidnightUTC(parseInt(pf[0], 10), parseInt(pf[1], 10) - 1, parseInt(pf[2], 10));
    }
    if (customToIso) {
      const pt = customToIso.split("-");
      out.to = new Date(Date.UTC(parseInt(pt[0], 10), parseInt(pt[1], 10) - 1, parseInt(pt[2], 10) + 1, 3, 0, 0) - 1).toISOString();
    }
    return out;
  }
  return {};
}
