// ============================================================
// waCorte — "Cabem N de M": quem recebe e quem fica de fora
//
// Nenhum botão manda para mais gente do que cabe. A lista chega do
// servidor JÁ NA ORDEM declarada (quem mais compra primeiro; no Crediário,
// quem tem mais limite livre) e o corte é feito aqui antes do clique:
// os primeiros `cabem` recebem, os outros aparecem apagados. O servidor
// refaz o corte ao enfileirar — esta função é o que a tela promete.
//
// Dúvida bloqueia: reserva ausente ou mensagens por cliente fora de 1..3
// = cabem 0.
// ============================================================
import type { WaStatus } from "@/services/waApi";
import { AUTO_KEYS, type AutoKey, type Partes } from "./waDivisao";
import { waMarketingConsentOk, waMarketingQualityOk } from "./waGuards";
import { TEXTO_NUMERO_EM_ATENCAO, waNumeroEmAtencao, type SaldoInfo } from "./waSaldo";

export interface PessoaPrevia {
  nome: string;
  detalhe: string;
}

export interface Corte {
  total: number;
  cabem: number;
  cabeTodos: boolean;
  /** Mensagens que o grupo inteiro pediria (total × por cliente). */
  precisa: number;
  /** Quantas faltam na reserva para caber todo mundo (0 se cabe). */
  faltam: number;
  recebem: PessoaPrevia[];
  ficam: PessoaPrevia[];
  /** Fora da lista visível (o servidor manda no máximo uma amostra). */
  alemDaLista: number;
}

function naturalOuNull(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

export function waCorte(args: {
  pessoas: PessoaPrevia[] | null | undefined;
  total: number | null | undefined;
  reserva: number | null | undefined;
  porCliente: number | null | undefined;
}): Corte | null {
  const total = naturalOuNull(args.total);
  const reserva = naturalOuNull(args.reserva);
  const por = naturalOuNull(args.porCliente);
  if (total == null) return null;
  const pessoas = Array.isArray(args.pessoas) ? args.pessoas : [];

  // Sem reserva lida ou sem a conta por cliente, nada cabe (e nada é inventado).
  const contaOk = reserva != null && por != null && por >= 1 && por <= 3;
  const cabem = contaOk ? Math.min(total, Math.floor((reserva as number) / (por as number))) : 0;
  const precisa = total * (por && por >= 1 ? por : 1);
  const faltam = contaOk ? Math.max(0, precisa - (reserva as number)) : precisa;

  return {
    total,
    cabem,
    cabeTodos: contaOk && cabem >= total,
    precisa,
    faltam,
    recebem: pessoas.slice(0, cabem),
    ficam: pessoas.slice(cabem),
    alemDaLista: Math.max(0, total - pessoas.length),
  };
}

/**
 * "Trazer N do Venda+": emprestar novidades que o Venda+ ainda não usou,
 * para a automática caber todo mundo. Devolve a nova divisão, ou null se o
 * Venda+ não tem N livres (ou N inválido). Nunca mexe no que já foi usado.
 */
export function trazerDoVendaMais(div: Partes, usadas: Partes, para: AutoKey, n: number): Partes | null {
  if (para === "vendamais") return null;
  if (!Number.isInteger(n) || n <= 0) return null;
  const livresDoVenda = div.vendamais - usadas.vendamais;
  if (livresDoVenda < n) return null;
  const prox = { ...div, vendamais: div.vendamais - n, [para]: div[para] + n } as Partes;
  return AUTO_KEYS.every((k) => prox[k] >= usadas[k]) ? prox : null;
}

/**
 * O botão "Mandar para as N agora" pode estar ativo? Só com tudo certo:
 * número conectado, aceite dado, número fora de atenção, saldo lido e com
 * novidades, e alguém que caiba. Qualquer dúvida = false + o motivo.
 */
export function podeMandarNovidades(args: {
  status: WaStatus | null | undefined;
  saldo: SaldoInfo | null | undefined;
  corte: Corte | null | undefined;
}): { pode: boolean; motivo: string | null } {
  const { status, saldo, corte } = args;
  if (!status || !status.connected) return { pode: false, motivo: "Conecte o número da loja para mandar." };
  if (!waMarketingConsentOk(status)) return { pode: false, motivo: "Ligue uma automática e responda a pergunta dos clientes que aceitaram." };
  if (waNumeroEmAtencao(status) || !waMarketingQualityOk(status)) return { pode: false, motivo: TEXTO_NUMERO_EM_ATENCAO };
  if (!saldo) return { pode: false, motivo: "Não consegui ler o saldo agora." };
  if (saldo.novidades.esgotado) return { pode: false, motivo: saldo.novidades.textoEsgotado };
  if (!corte || corte.cabem <= 0) return { pode: false, motivo: "Não sobra novidade para esta automática." };
  return { pode: true, motivo: null };
}

/** Quantas dá para trazer do Venda+ para fechar a conta (0 = não dá ou não precisa). */
export function quantoTrazer(corte: Corte | null, div: Partes, usadas: Partes, para: AutoKey): number {
  if (!corte || corte.cabeTodos || corte.faltam <= 0) return 0;
  return trazerDoVendaMais(div, usadas, para, corte.faltam) ? corte.faltam : 0;
}
