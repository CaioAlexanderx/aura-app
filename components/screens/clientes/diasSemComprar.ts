// ============================================================
// diasSemComprar — a régua única de "há quanto tempo sumiu"
//
// Antes deste arquivo o app media a mesma coisa de duas maneiras: a tag
// "Inativo" da lista de clientes acendia com MAIS DE 30 dias sem comprar,
// enquanto o motor de reativação só chamava de inativo quem estava entre
// 61 e 120. O lojista via "Inativo" na lista, entrava na reativação e não
// achava a pessoa — duas réguas para a mesma pergunta.
//
// Agora existe uma só, e é esta:
//
//   0–30    ativo
//   31–60   em risco
//   61–120  inativo
//   121+    perdido
//
// Quem classifica dias sem comprar — a tag da lista, a entrada da
// reativação, os rótulos dos segmentos — lê daqui. Trocar um limiar é
// editar LIMIARES e mais nada.
//
// O módulo é de cálculo puro: nada de rede, nada de React. O import do
// tipo de segmento é `import type`, some na compilação e não arrasta
// services/api para dentro do teste unitário.
// ============================================================
import type { ReactivationSegment } from "@/services/reactivationApi";

export type FaixaDias = "ativo" | "em_risco" | "inativo" | "perdido";

/** Início (inclusivo) de cada faixa, em dias sem comprar. */
export const LIMIARES = {
  /** 31+ dias: começou a escapar. */
  emRisco: 31,
  /** 61+ dias: é o "Inativo" do app inteiro. */
  inativo: 61,
  /** 121+ dias: perdido — ainda dá para tentar, mas é outra conversa. */
  perdido: 121,
} as const;

export interface FaixaInfo {
  key: FaixaDias;
  /** Rótulo curto, do jeito que aparece na tela. */
  label: string;
  /** Frase que explica a faixa ("sem comprar há 31 a 60 dias"). */
  desc: string;
  /** Primeiro dia da faixa (inclusivo). */
  min: number;
  /** Último dia da faixa (inclusivo). `null` = sem teto. */
  max: number | null;
  /** Como o backend de reativação chama esta mesma faixa. */
  segmento: ReactivationSegment;
}

export const FAIXAS: FaixaInfo[] = [
  {
    key: "ativo", label: "Ativo", desc: "comprou nos últimos 30 dias",
    min: 0, max: LIMIARES.emRisco - 1, segmento: "active",
  },
  {
    key: "em_risco", label: "Em risco", desc: "sem comprar há 31 a 60 dias",
    min: LIMIARES.emRisco, max: LIMIARES.inativo - 1, segmento: "at_risk",
  },
  {
    key: "inativo", label: "Inativo", desc: "sem comprar há 61 a 120 dias",
    min: LIMIARES.inativo, max: LIMIARES.perdido - 1, segmento: "dormant",
  },
  {
    key: "perdido", label: "Perdido", desc: "sem comprar há mais de 120 dias",
    min: LIMIARES.perdido, max: null, segmento: "lost",
  },
];

export function faixaInfo(key: FaixaDias): FaixaInfo {
  return FAIXAS.find((f) => f.key === key) as FaixaInfo;
}

/** Descrição da faixa a partir do nome do segmento do backend. */
export function descricaoDoSegmento(segmento: string): string {
  return FAIXAS.find((f) => f.segmento === segmento)?.desc || "";
}

/**
 * Data no formato do app ("dd/mm/aaaa") para timestamp. Devolve `null`
 * para "---", vazio ou qualquer coisa que não seja uma data de verdade —
 * quem nunca comprou não é "inativo", é outra história.
 */
export function parseDataBR(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const p = String(valor).trim().split("/");
  if (p.length !== 3) return null;
  const dia = Number(p[0]);
  const mes = Number(p[1]);
  const ano = Number(p[2]);
  if (!Number.isFinite(dia) || !Number.isFinite(mes) || !Number.isFinite(ano)) return null;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900) return null;
  const d = new Date(ano, mes - 1, dia);
  // 31/02 vira 03/03 no construtor do Date — recusa em vez de mentir.
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d.getTime();
}

/**
 * Dias inteiros desde a última compra. `null` quando não há data válida.
 * `agora` é injetável para o teste não depender do relógio.
 */
export function diasSemComprar(
  lastPurchase: string | null | undefined,
  agora: number = Date.now()
): number | null {
  const ts = parseDataBR(lastPurchase);
  if (ts == null) return null;
  const dias = Math.floor((agora - ts) / 864e5);
  return dias < 0 ? 0 : dias;
}

/** Em qual faixa cai um número de dias. `null` dias = sem faixa. */
export function classificarDias(dias: number | null | undefined): FaixaDias | null {
  if (typeof dias !== "number" || !Number.isFinite(dias)) return null;
  if (dias >= LIMIARES.perdido) return "perdido";
  if (dias >= LIMIARES.inativo) return "inativo";
  if (dias >= LIMIARES.emRisco) return "em_risco";
  return "ativo";
}

/** Faixa de um cliente da lista (que guarda a data como "dd/mm/aaaa"). */
export function faixaDoCliente(
  c: { lastPurchase?: string | null },
  agora: number = Date.now()
): FaixaDias | null {
  return classificarDias(diasSemComprar(c?.lastPurchase, agora));
}

/**
 * `true` quando o cliente já merece a tag "Inativo" — 61 dias ou mais,
 * o que inclui os perdidos. A lista tem uma tag só para os dois porque
 * "Perdido" impresso ao lado do nome é um veredito que a tela não tem
 * como sustentar; o detalhe fica na reativação.
 */
export function estaInativo(dias: number | null | undefined): boolean {
  const f = classificarDias(dias);
  return f === "inativo" || f === "perdido";
}

/**
 * Corte de dias escolhido na entrada da reativação -> alvo enviável da
 * tela de detalhe.
 *
 * A entrada filtra por "X dias OU MAIS", que é uma pergunta aberta; os
 * alvos do disparo são fatias fechadas (31–60, 61–120) porque a Meta
 * cobra por mensagem e o backend precisa de um segmento nomeado. A
 * tradução honesta é:
 *
 *   X <= 60  -> "both": "60 ou mais" pega em risco E inativo;
 *   X >= 61  -> "dormant": daí para cima não há mais ninguém em risco.
 *
 * Perdidos (121+) não são alvo de disparo em lugar nenhum, então 180
 * também cai em "dormant" — que é o maior alvo enviável.
 */
export function alvoParaDias(dias: number | null | undefined): "at_risk" | "dormant" | "both" {
  if (typeof dias !== "number" || !Number.isFinite(dias)) return "at_risk";
  return dias >= LIMIARES.inativo ? "dormant" : "both";
}

/** Os cortes que a entrada oferece em pílula, antes do "outro". */
export const CORTES_DIAS = [30, 60, 90, 120, 180];

/** Corte inicial: o cliente que reclamou pedia "60, 90 ou mais". */
export const CORTE_PADRAO = 60;
