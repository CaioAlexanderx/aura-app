// ============================================================
// AURA. — Página Black Friday · "Crediário para janeiro" (p-91, 09/11/2026)
//
// Contas puras da seção (sem React, sem rede).
// Mockup aprovado pelo Caio (09/11/2026):
//   https://claude.ai/artifact/Ki6PMsQx9eywuchDrcKMnX
//
//   - fase: novembro e dezembro = atalho + resumo; janeiro = só o resumo
//     (o atalho "Janeiro" do lançamento deixa de fazer sentido); fora disso
//     a seção não existe;
//   - o período do resumo: o janeiro que vem (ou o de agora, em janeiro), o
//     mesmo ano que o atalho "Janeiro" do lançamento usa (janeiroDoProximoAno);
//   - o 1º vencimento do atalho: dia 5, 10, 15, 20 ou 25 desse janeiro.
// ============================================================
import { janeiroDoProximoAno } from "@/components/crediario/lancamento/calculos";
import type { PeriodoDoResumo, SemanaDoResumo } from "@/services/resumoVencimentoApi";

export type FaseCrediarioJaneiro = "atalho" | "janeiro" | "fora";

/** Os dias que a lojista pode escolher para a 1ª parcela. */
export var DIAS_DE_VENCIMENTO = [5, 10, 15, 20, 25];
export var DIA_PADRAO = 10;

function mesDe(hojeIso: string): number {
  return parseInt(hojeIso.slice(5, 7), 10);
}

/** Nov/dez: atalho e resumo. Janeiro: só o resumo. Resto do ano: some. */
export function faseCrediarioJaneiro(hojeIso: string): FaseCrediarioJaneiro {
  var m = mesDe(hojeIso);
  if (m === 11 || m === 12) return "atalho";
  if (m === 1) return "janeiro";
  return "fora";
}

/** O ano do janeiro da seção: o que vem (fev–dez) ou o de agora (janeiro). */
export function anoDoJaneiro(hojeIso: string): number {
  var y = parseInt(hojeIso.slice(0, 4), 10);
  return mesDe(hojeIso) >= 2 ? y + 1 : y;
}

/** De 01 a 31 do janeiro da seção, como o backend pede (AAAA-MM-DD). */
export function periodoDoJaneiro(hojeIso: string): PeriodoDoResumo {
  var ano = anoDoJaneiro(hojeIso);
  return { de: ano + "-01-01", ate: ano + "-01-31" };
}

/** 1º vencimento do atalho, dd/mm/aaaa (o formato do campo do lançamento). */
export function primeiraParcelaNoDia(hojeIso: string, dia: number): string {
  return janeiroDoProximoAno(hojeIso, dia);
}

export function brl(n: number): string {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "2027-01-04" → "04/01". */
export function diaMesIso(iso: string): string {
  var p = String(iso || "").slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] : "";
}

export type Barra = { rotulo: string; altura: number; parcelas: number; valor: number };

/**
 * Barras por semana (o backend agrupa por semana, começando na segunda).
 * A semana que começa em dezembro (31/12, segunda) aparece como "01/01".
 * Altura em % do maior valor, no mínimo 4 para a barra não sumir.
 */
export function barrasDasSemanas(semanas: SemanaDoResumo[], periodo: PeriodoDoResumo): Barra[] {
  var lista = (semanas || []).filter(function (s) { return s && s.semana_inicio; });
  var maior = lista.reduce(function (m, s) { return Math.max(m, s.valor); }, 0);
  return lista.map(function (s) {
    var inicio = s.semana_inicio < periodo.de ? periodo.de : s.semana_inicio;
    return {
      rotulo: diaMesIso(inicio),
      altura: maior > 0 ? Math.max(4, Math.round((s.valor / maior) * 100)) : 4,
      parcelas: s.parcelas,
      valor: s.valor,
    };
  });
}

export function plural(n: number, um: string, varios: string): string {
  return n.toLocaleString("pt-BR") + " " + (n === 1 ? um : varios);
}
