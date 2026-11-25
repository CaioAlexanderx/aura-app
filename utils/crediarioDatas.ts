// ============================================================================
// AURA. — Datas digitadas na ficha do crediário (24/11/2026)
//
// Caso real (20–23/11/2026): parcela renegociada nascia vencida e aparecia
// como "a conferir" (utils/creditOverdue.ts `needsReview`) e depois como
// atraso, sem ser carnê antigo:
//   - o Renegociar sugeria a 1ª parcela no vencimento aberto mais antigo,
//     que já tinha passado (renegociação em 23/11 → 1ª parcela em 22/11);
//   - a lojista trocou o mês de 09/12/2026 para 01 e esqueceu o ano
//     → 09/01/2026 (queria 09/01/2027).
//
// Regras (aprovadas pelo Caio):
//   - Renegociar: a sugestão nunca fica no passado; data no passado não deixa
//     confirmar (o backend também recusa: 422 FIRST_DUE_DATE_PAST). Hoje pode.
//   - Mudar a data: data no passado só avisa (corrigir carnê antigo é
//     legítimo).
//   - Nos dois: "Confira o ano" quando parece o ano esquecido.
//
// "Hoje" é o dia em America/Sao_Paulo. Tudo aqui é função pura sobre
// YYYY-MM-DD para dar para testar com qualquer "hoje".
// ============================================================================
import { parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { todaySP, daysBetween } from "@/utils/creditOverdue";

/** Bloqueio do Renegociar (texto aprovado; o mesmo para o 422 do backend). */
export const TEXTO_RENEGOCIAR_DATA_PASSADA =
  "Essa data já passou. A renegociação precisa começar hoje ou depois.";

/** Aviso do Mudar a data (texto aprovado; não bloqueia). */
export const TEXTO_MUDAR_DATA_PASSADA = "Essa data já passou — a parcela fica vencida.";

/** Linha da parcela "a conferir" na ficha (texto aprovado). */
export const TEXTO_PARCELA_A_CONFERIR =
  "Cadastrada depois do vencimento. Se for carnê antigo, está certo; se a data estiver errada, altere.";

/** Código do backend para a 1ª parcela da renegociação no passado. */
export const CODIGO_PRIMEIRA_PARCELA_NO_PASSADO = "FIRST_DUE_DATE_PAST";

/** Atalho "Confira o ano" (texto aprovado). `sugestaoBr` em dd/mm/aaaa. */
export function textoConfiraOAno(sugestaoBr: string): string {
  return `Confira o ano: você quis dizer ${sugestaoBr}?`;
}

/** Quantos dias no passado a data precisa estar para perguntar do ano. */
export const DIAS_PARA_CONFERIR_O_ANO = 60;

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function partes(iso: string | null | undefined): [number, number, number] | null {
  const m = RE_ISO.exec(String(iso || "").slice(0, 10));
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/**
 * YYYY-MM-DD do dia `dia` no mês `mes` (1..12; 13 = janeiro do ano seguinte).
 * Dia que não existe no mês (29–31) encosta no último dia do mês.
 */
function diaNoMes(ano: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, 1));
  const a = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${a}-${String(m).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/**
 * Sugestão da "1ª parcela vence em" do Renegociar.
 *
 * Regra: o vencimento aberto mais antigo, se ainda for hoje ou à frente.
 * Se já passou, o MESMO DIA DO MÊS na primeira vez em que ele cai hoje ou
 * depois: neste mês se o dia ainda não passou, senão no mês seguinte. O dia
 * 29–31 que não existe no mês vira o último dia do mês. Nunca devolve data
 * no passado. Sem vencimento (ou ilegível): hoje.
 *
 *   hoje 23/11, mais antiga 22/11 → 22/12
 *   hoje 23/11, mais antiga 25/10 → 25/11
 *   hoje 30/11, mais antiga 31/10 → 30/11 (novembro não tem 31)
 *   hoje 15/12, mais antiga 10/12 → 10/01 do ano seguinte
 */
export function sugestaoDaPrimeiraParcela(maisAntigaIso: string | null | undefined, hojeIso: string = todaySP()): string {
  const p = partes(maisAntigaIso);
  const h = partes(hojeIso);
  if (!p || !h) return hojeIso;
  const antiga = String(maisAntigaIso).slice(0, 10);
  if (antiga >= hojeIso) return antiga;
  const nesteMes = diaNoMes(h[0], h[1], p[2]);
  if (nesteMes >= hojeIso) return nesteMes;
  return diaNoMes(h[0], h[1] + 1, p[2]);
}

/**
 * Conferência do ano: parece que a lojista mudou o dia/mês e esqueceu o ano?
 *
 * Devolve a mesma data com ano + 1 (YYYY-MM-DD) quando:
 *   1. a data digitada está MAIS DE 60 dias no passado; e
 *   2. a mesma data no ano seguinte é hoje ou à frente.
 * Senão, null. Ex.: hoje 24/11/2026, digitado 09/01/2026 → 2027-01-09.
 *
 * O "futuro próximo" vem de graça: se a data está mais de 60 dias atrás,
 * ano + 1 fica no máximo ~10 meses à frente. 29/02 sem ano bissexto seguinte
 * vira 28/02. Data dois anos atrás (ano + 1 ainda no passado) não pergunta.
 */
export function conferenciaDoAno(dataIso: string | null | undefined, hojeIso: string = todaySP()): string | null {
  const p = partes(dataIso);
  if (!p || !partes(hojeIso)) return null;
  const data = String(dataIso).slice(0, 10);
  if (daysBetween(data, hojeIso) <= DIAS_PARA_CONFERIR_O_ANO) return null;
  const anoSeguinte = diaNoMes(p[0] + 1, p[1], p[2]);
  return anoSeguinte >= hojeIso ? anoSeguinte : null;
}

export type ModoDaData = "renegociar" | "mudar";

export type AvisoDaData = {
  /** Texto abaixo do campo; null = nada a dizer. */
  texto: string | null;
  /** "erro" = vermelho (bloqueia); "aviso" = âmbar (deixa confirmar). */
  tom: "erro" | "aviso";
  /** true = o botão de confirmar fica desabilitado. */
  bloqueia: boolean;
  /** dd/mm/aaaa do atalho "Confira o ano", ou null. */
  sugestaoDoAno: string | null;
};

const NADA: AvisoDaData = { texto: null, tom: "aviso", bloqueia: false, sugestaoDoAno: null };

/**
 * O que mostrar abaixo do campo de data.
 *   - renegociar: data no passado → vermelho e bloqueia (+ "Confira o ano"
 *     quando couber);
 *   - mudar: "Confira o ano" quando couber; fora isso, data no passado →
 *     âmbar, sem bloquear.
 * Data incompleta ou inválida: nada (o confirmar já diz "Data inválida").
 */
export function avisoDaData(valorBr: string, modo: ModoDaData, hojeIso: string = todaySP()): AvisoDaData {
  const iso = parseBrDate((valorBr || "").trim());
  if (!iso || iso >= hojeIso) return NADA;
  const ano = conferenciaDoAno(iso, hojeIso);
  const sugestaoDoAno = ano ? formatIsoToBr(ano) : null;
  if (modo === "renegociar") {
    return { texto: TEXTO_RENEGOCIAR_DATA_PASSADA, tom: "erro", bloqueia: true, sugestaoDoAno };
  }
  if (sugestaoDoAno) return { texto: null, tom: "aviso", bloqueia: false, sugestaoDoAno };
  return { texto: TEXTO_MUDAR_DATA_PASSADA, tom: "aviso", bloqueia: false, sugestaoDoAno: null };
}

/** O erro da API é o 422 da 1ª parcela no passado? */
export function ehPrimeiraParcelaNoPassado(err: any): boolean {
  return (err?.data?.code ?? err?.code) === CODIGO_PRIMEIRA_PARCELA_NO_PASSADO;
}
