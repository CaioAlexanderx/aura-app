// ============================================================================
// AURA. — Vendidos na promoção: a janela que o app pergunta (p-93, 08/11/2026)
//
// O backend (Aura-backend#968) só marca o item vendido em promoção a partir
// do deploy de 09/11/2026 (sem dado retroativo). Por isso o começo da janela
// nunca é antes de 09/11 00h em Brasília.
//   no ar:     do primeiro começo da lista até agora;
//   encerrada: do primeiro começo até o último fim da lista.
// Janela de até 400 dias (limite do backend).
// ============================================================================
import type { ItemDaLista } from "@/services/promocoesApi";

/** 09/11/2026 00h00 em Brasília (-03:00 fixo): quando a contagem começou. */
export var INICIO_DA_CONTAGEM = "2026-11-09T03:00:00.000Z";
export var DIA_DO_INICIO_DA_CONTAGEM = "09/11";
var MAX_DIAS = 400;
var DIA_MS = 864e5;

/** Janela sem o "agora": estável entre renders (vai na chave da consulta). */
export type JanelaDosVendidos = {
  desde: string;
  /** null = até agora (promoção no ar). */
  ate: string | null;
  /** A promoção começou antes de 09/11: o que foi vendido antes não entra. */
  cortada: boolean;
};

function instante(v: string | null | undefined): number {
  if (!v) return NaN;
  return new Date(v).getTime();
}

/**
 * Janela da lista. null quando não há o que perguntar: lista vazia ou
 * promoção encerrada antes da contagem começar.
 */
export function janelaDosVendidos(lista: ItemDaLista[], status: "ativa" | "encerrada"): JanelaDosVendidos | null {
  if (!lista.length) return null;
  var inicioContagem = instante(INICIO_DA_CONTAGEM);
  var inicio = Infinity;
  var fim = -Infinity;
  lista.forEach(function (i) {
    var a = instante(i.starts_at);
    if (!isNaN(a) && a < inicio) inicio = a;
    var b = instante(i.ends_at);
    if (!isNaN(b) && b > fim) fim = b;
  });
  var cortada = inicio !== Infinity && inicio < inicioContagem;
  var desde = inicio === Infinity ? inicioContagem : Math.max(inicio, inicioContagem);
  if (status === "ativa") return { desde: new Date(desde).toISOString(), ate: null, cortada: cortada };
  if (fim === -Infinity) return { desde: new Date(desde).toISOString(), ate: null, cortada: cortada };
  if (fim < inicioContagem) return null;
  return { desde: new Date(desde).toISOString(), ate: new Date(fim).toISOString(), cortada: cortada };
}

/**
 * desde/ate do pedido: o fim nunca passa de agora, o começo nunca passa do
 * fim (antes do dia 09/11 a janela fica vazia e a resposta vem zerada) e a
 * janela cabe nos 400 dias do backend.
 */
export function pedidoDaJanela(j: JanelaDosVendidos, agora: Date): { desde: string; ate: string } {
  var agoraMs = agora.getTime();
  var ate = j.ate ? Math.min(instante(j.ate), agoraMs) : agoraMs;
  var desde = Math.min(instante(j.desde), ate);
  if (ate - desde > MAX_DIAS * DIA_MS) desde = ate - MAX_DIAS * DIA_MS;
  return { desde: new Date(desde).toISOString(), ate: new Date(ate).toISOString() };
}

/** A contagem já começou? (antes do dia 09/11 o texto fala no futuro) */
export function contagemComecou(agora: Date): boolean {
  return agora.getTime() >= instante(INICIO_DA_CONTAGEM);
}

/** Quantidade em pt-BR: até 3 casas (produto vendido por kg). */
export function qtdTxt(n: number): string {
  return (Math.round(n * 1000) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
