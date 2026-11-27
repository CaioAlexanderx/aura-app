// ============================================================
// waCorte — "Cabem N de M": quem recebe e quem fica de fora
//
// Nenhum botão manda para mais gente do que cabe. O servidor devolve a
// prévia JÁ cortada na ordem declarada (quem mais compra primeiro; no
// Crediário, quem tem mais limite livre) e refaz o corte ao enfileirar.
// Esta função lê a prévia e confere a conta: se `cabem` não fecha com as
// novidades que sobram, a tela fica com o menor número. Dúvida bloqueia:
// número torto = null.
// ============================================================
import type { WaPublicoRaw } from "@/services/waConfigApi";
import type { WaStatus } from "@/services/waApi";
import { AUTO_KEYS, type AutoKey, type Partes } from "./waDivisao";
import { TEXTO_NUMERO_EM_ATENCAO, waNumeroEmAtencao, type SaldoInfo } from "./waSaldo";

export interface PessoaPrevia {
  nome: string;
  detalhe: string;
  /** Crediário: limite livre em R$ (limite - em aberto), quando o servidor manda. Sem dado, nada se inventa. */
  limiteLivre?: number;
  /** Venda+: a peça da última compra (`ultima_peca`), quando o servidor manda. */
  ultimaPeca?: string;
  /** Telefone da cliente (`telefone`), quando o servidor manda: o caminho grátis abre o wa.me com ele. */
  telefone?: string;
  /** Venda+: data da última compra (`ultima_compra`, ISO) ou o mês já por extenso (`mes_ultima_compra`). Só serve para o nome do mês. */
  ultimaCompra?: string;
  mesUltimaCompra?: string;
}

export interface Corte {
  /** Elegíveis (já sem quem está de fora por regra). */
  total: number;
  cabem: number;
  cabeTodos: boolean;
  /** Novidades que faltam para cobrir todos os elegíveis (0 se cabe). */
  faltam: number;
  /** Novidades que o grupo todo pediria (aniversário: por passo). */
  precisa: number;
  recebem: PessoaPrevia[];
  ficam: PessoaPrevia[];
  /** Guardados que o servidor não listou (só mandou amostra). */
  alemDaLista: number;
  /** "quem mais compra primeiro" — frase da ordem, do servidor. */
  ordem: string | null;
}

function natural(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/** limite_livre do servidor, ou limite - em_aberto quando os dois vierem. */
function limiteDe(p: any): { limiteLivre?: number } {
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
  const direto = num(p?.limite_livre);
  if (direto != null) return { limiteLivre: direto };
  const lim = num(p?.limite), ab = num(p?.em_aberto);
  return lim != null && ab != null ? { limiteLivre: Math.max(0, lim - ab) } : {};
}

function pessoas(l: WaPublicoRaw["vao"]): PessoaPrevia[] {
  return (Array.isArray(l) ? l : [])
    .filter((p) => p && typeof p.nome === "string" && p.nome)
    .map((p) => ({ nome: String(p.nome), detalhe: typeof p.detalhe === "string" ? p.detalhe : "", ...limiteDe(p), ...(typeof (p as any).ultima_peca === "string" && (p as any).ultima_peca ? { ultimaPeca: (p as any).ultima_peca } : {}), ...(typeof (p as any).telefone === "string" && (p as any).telefone ? { telefone: (p as any).telefone } : {}), ...(typeof (p as any).ultima_compra === "string" && (p as any).ultima_compra ? { ultimaCompra: (p as any).ultima_compra } : {}), ...(typeof (p as any).mes_ultima_compra === "string" && (p as any).mes_ultima_compra ? { mesUltimaCompra: (p as any).mes_ultima_compra } : {}) }));
}

/**
 * @param livres novidades que sobram para a parte (da lista de automáticas),
 *   para conferir o `cabem` do servidor. null = não conferir.
 */
export function waCorte(pub: WaPublicoRaw | null | undefined, livres?: number | null): Corte | null {
  if (!pub || typeof pub !== "object") return null;
  const total = natural(pub.elegiveis);
  let cabem = natural(pub.cabem);
  if (total == null || cabem == null) return null;
  const por = natural(pub.novidades_por_pessoa) || 1;
  // Confere com o que sobra: nunca prometer mais do que a reserva paga.
  if (typeof livres === "number" && livres >= 0) cabem = Math.min(cabem, Math.floor(livres / por));
  cabem = Math.min(cabem, total);

  const vao = pessoas(pub.vao).slice(0, cabem);
  const guardados = pessoas(pub.guardados);
  const guardadosTotal = natural(pub.ficam_guardados) ?? Math.max(0, total - cabem);
  const faltam = natural(pub.falta_para_todos) ?? Math.max(0, (total - cabem) * por);

  return {
    total,
    cabem,
    cabeTodos: cabem >= total,
    faltam: cabem >= total ? 0 : faltam,
    precisa: natural(pub.novidades_necessarias) ?? total * por,
    recebem: vao,
    ficam: guardados,
    alemDaLista: Math.max(0, guardadosTotal - guardados.length),
    ordem: typeof pub.ordem === "string" && pub.ordem ? pub.ordem : null,
  };
}

/**
 * "Trazer N do Venda+": emprestar novidades que o Venda+ ainda não usou,
 * para a automática caber todo mundo. Devolve a nova divisão, ou null se o
 * Venda+ não tem N livres (ou N inválido). Nunca mexe no que já foi usado.
 */
export function trazerDoVendaMais(div: Partes, usadas: Partes, para: AutoKey, n: number): Partes | null {
  if (para === "venda_mais") return null;
  if (!Number.isInteger(n) || n <= 0) return null;
  const livresDoVenda = div.venda_mais - usadas.venda_mais;
  if (livresDoVenda < n) return null;
  const prox = { ...div, venda_mais: div.venda_mais - n, [para]: div[para] + n } as Partes;
  return AUTO_KEYS.every((k) => prox[k] >= usadas[k]) ? prox : null;
}

/** Quantas dá para trazer do Venda+ para fechar a conta (0 = não dá ou não precisa). */
export function quantoTrazer(corte: Corte | null, div: Partes, usadas: Partes, para: AutoKey): number {
  if (!corte || corte.cabeTodos || corte.faltam <= 0) return 0;
  return trazerDoVendaMais(div, usadas, para, corte.faltam) ? corte.faltam : 0;
}

/**
 * O botão "Mandar para as N agora" pode estar ativo? Só com tudo certo:
 * status e saldo lidos, aceite dado, número fora de atenção (pelo saldo OU
 * pelo status), novidades com sobra e alguém que caiba. Qualquer dúvida
 * (inclusive saldo ou status nulos) = false + o motivo em português.
 */
export function podeMandarNovidades(args: {
  aceiteEm: string | null | undefined;
  saldo: SaldoInfo | null | undefined;
  status: WaStatus | null | undefined;
  corte: Corte | null | undefined;
}): { pode: boolean; motivo: string | null } {
  const { aceiteEm, saldo, status, corte } = args;
  if (!aceiteEm) return { pode: false, motivo: "Ligue uma automática e responda se seus clientes aceitaram receber novidades." };
  if (!status) return { pode: false, motivo: "Não consegui ler a conexão do WhatsApp agora." };
  if (!saldo) return { pode: false, motivo: "Não consegui ler o saldo agora." };
  if (saldo.numeroEmAtencao || waNumeroEmAtencao(status)) return { pode: false, motivo: TEXTO_NUMERO_EM_ATENCAO };
  if (saldo.novidades.esgotado !== false) return { pode: false, motivo: saldo.novidades.textoEsgotado || "As novidades do mês acabaram." };
  if (!corte || corte.cabem <= 0) return { pode: false, motivo: "Não sobra novidade para esta automática." };
  return { pode: true, motivo: null };
}
