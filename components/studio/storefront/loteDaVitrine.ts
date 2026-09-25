// ============================================================
// components/studio/storefront/loteDaVitrine.ts
//
// As regras do orçamento em lote público. Sem React, sem tela.
//
// "50 canecas com o nome de cada convidado, quanto fica?" era conversa
// de WhatsApp respondida na mão, e o assistente que calcula isso morava
// no painel, atrás de login. Quem organiza o casamento não tem login.
//
// O S0 abriu as duas rotas públicas (Aura-backend#665):
//   bulk-quote  — só calcula, pode ser chamada a cada tecla
//   bulk-order  — grava o evento como RASCUNHO
//
// Rascunho e não confirmado é decisão do Caio (decisão 2): quem confirma
// um pedido em lote é a lojista, olhando. Aqui a tela precisa dizer isso
// com todas as letras, senão a pessoa acha que fechou negócio.
// ============================================================

import { dinheiro as escreverDinheiro } from "./moeda";

/** Cada linha colada vira uma peça. O servidor também corta em 200. */
export const MAXIMO_NOMES = 200;

export type FaixaDoLote = { from: number; pct: number; label: string };

export type CotacaoDoLote = {
  qty: number;
  unit_price: number;
  discount_pct: number;
  total_amount: number;
  savings: number;
  tiers: FaixaDoLote[];
  product?: { id: string; name: string; price: number };
  /**
   * Prazo declarado pela lojista para esta tiragem, em dias úteis.
   * `null` é "a loja informa" — e a tela escreve isso, não um número.
   */
  prazo_dias?: number | null;
};

/** A frase do prazo, como a cliente lê. */
export function fraseDoPrazo(prazoDias: number | null | undefined): string {
  const n = Number(prazoDias);
  if (!Number.isFinite(n) || n <= 0) return "Prazo: a loja informa junto com a resposta.";
  return n === 1 ? "Prazo estimado: 1 dia útil." : `Prazo estimado: ${Math.ceil(n)} dias úteis.`;
}

/**
 * O que separa um nome do outro: quebra de linha (a coluna da planilha
 * colada) e ponto-e-vírgula. Tabulação também — colar DUAS colunas do
 * Excel traz "Nome<TAB>Setor" e cada pedaço seria uma pessoa a mais, então
 * a tabulação fica com a primeira coluna só (ver `nomesDaLista`).
 *
 * VÍRGULA NÃO (Fase 2 · 25/09/2026): "Silva, João" é UM nome — é como
 * lista de chamada e crachá escrevem. Separar por vírgula transformava o
 * João Silva em duas canecas, "Silva" e "João" (JORNADA §4.11,
 * `loteDaVitrine.ts:57` antes desta fase).
 */
const SEPARADOR = /[\r\n;]+/;

function todosOsNomes(bruto: string): string[] {
  return String(bruto || "")
    .split(SEPARADOR)
    // Duas colunas coladas da planilha: fica a primeira.
    .map((n) => n.split("\t")[0].trim())
    .filter(Boolean);
}

/**
 * A lista colada, virada em nomes. Um por linha (ou separados por `;`),
 * como vem da coluna da planilha.
 */
export function nomesDaLista(bruto: string): string[] {
  return todosOsNomes(bruto).slice(0, MAXIMO_NOMES);
}

/** Quantos nomes passaram do teto, para a tela avisar em vez de cortar calado. */
export function nomesIgnorados(bruto: string): number {
  return Math.max(0, todosOsNomes(bruto).length - MAXIMO_NOMES);
}

/**
 * Quanto falta para a próxima faixa, e quanto ela economizaria.
 *
 * É o empurrão do desenho ("Faltam 38 nomes para R$ 39,90 cada"). Só
 * existe quando há faixa acima da atual — na última, o silêncio é a
 * resposta certa.
 */
export function proximoDegrau(
  cot: CotacaoDoLote | null,
): { faltam: number; pct: number; precoUn: number } | null {
  if (!cot || !cot.tiers?.length || !cot.unit_price) return null;
  const acima = cot.tiers.filter((t) => t.from > cot.qty).sort((a, b) => a.from - b.from);
  const alvo = acima[0];
  if (!alvo) return null;
  return {
    faltam: alvo.from - cot.qty,
    pct: alvo.pct,
    precoUn: +(cot.unit_price * (1 - alvo.pct / 100)).toFixed(2),
  };
}

/** O WhatsApp digitado só serve se der para responder nele. */
export function telefoneValido(bruto: string): boolean {
  return String(bruto || "").replace(/\D/g, "").length >= 10;
}

export type PendenciaDoLote = string | null;

/**
 * O que ainda falta para pedir o orçamento.
 *
 * A ordem é a da tela: primeiro o que a pessoa preenche primeiro. Devolve
 * `null` quando está tudo pronto — e é isso que libera o botão.
 */
export function pendenciaDoLote(d: {
  evento: string; produtoId: string | null; nomes: string[];
  contato: string; telefone: string;
}): PendenciaDoLote {
  if (!d.evento || d.evento.trim().length < 2) return "Diga de qual evento se trata.";
  if (!d.produtoId) return "Escolha a peça que vai ser personalizada.";
  if (!d.nomes.length) return "Cole a lista de nomes, um por linha.";
  if (!d.contato || d.contato.trim().length < 2) return "Diga seu nome.";
  if (!telefoneValido(d.telefone)) return "Informe um WhatsApp com DDD.";
  return null;
}

/**
 * A data mínima do "Para quando?": hoje mais o prazo da faixa, em dias
 * úteis (sábado e domingo não contam). Sem prazo declarado, amanhã. Em
 * "AAAA-MM-DD", que é o que o seletor de data do navegador entende e o
 * que o servidor aceita (services/dataDoLote.js).
 *
 * Feriado nacional fica de fora de propósito: a lojista confirma o prazo
 * olhando a lista, e uma data mínima um dia antes do possível é
 * corrigida na resposta dela — um calendário de feriados aqui seria a
 * terceira cópia de uma tabela que muda todo ano.
 */
export function dataMinimaDoLote(prazoDias: number | null | undefined, hoje: Date = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let faltam = Number(prazoDias);
  if (!Number.isFinite(faltam) || faltam <= 0) {
    d.setDate(d.getDate() + 1);
  } else {
    faltam = Math.ceil(faltam);
    while (faltam > 0) {
      d.setDate(d.getDate() + 1);
      const dia = d.getDay();
      if (dia !== 0 && dia !== 6) faltam--;
    }
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2026-10-12" → "12/10/2026" (a data como a cliente lê). */
export function dataDoLoteLegivel(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * O número do orçamento para mostrar ("L-0042"), ou `null`.
 *
 * Vem do servidor (`codigo`, B6 do contrato da Fase 2). Sem ele a tela
 * NÃO inventa número: um "#" que a lojista não reconhece no WhatsApp é
 * pior que nenhum (antes a tela mostrava o nome do evento no lugar).
 */
export function codigoDoOrcamento(resposta: any): string | null {
  const c = resposta && typeof resposta === "object" ? resposta.codigo : null;
  const s = typeof c === "string" ? c.trim() : typeof c === "number" ? String(c) : "";
  return s ? s : null;
}

/**
 * A mensagem que o Marcos manda para a loja depois do orçamento: o
 * número, o evento e a conta — a lojista acha o rascunho sem perguntar.
 */
export function mensagemDoOrcamento(args: {
  codigo: string | null;
  evento: string;
  pecas: number;
  produto?: string | null;
  total?: number | null;
  nomeDaLoja?: string | null;
}): string {
  const loja = String(args.nomeDaLoja || "").trim();
  const partes: string[] = [];
  partes.push(args.codigo
    ? `Olá! Mandei pela loja${loja ? " " + loja : ""} o orçamento #${args.codigo}.`
    : `Olá! Mandei pela loja${loja ? " " + loja : ""} um orçamento em lote.`);
  partes.push(`Evento: ${String(args.evento || "").trim()}`);
  const peca = String(args.produto || "").trim();
  partes.push(`${args.pecas} ${args.pecas === 1 ? "peça" : "peças"}${peca ? " · " + peca : ""}`);
  if (Number(args.total) > 0) partes.push(`Estimativa: ${dinheiro(Number(args.total))}`);
  return partes.join("\n");
}

/** Reais em pt-BR, sem depender de Intl no react-native-web. */
export function dinheiro(n: number): string {
  // Uma conta so para a vitrine inteira (ver moeda.ts).
  return escreverDinheiro(n || 0);
}
