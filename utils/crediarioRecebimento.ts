// ============================================================
// AURA. — Receber pagamento no crediário sem registrar em dobro
//
// 07/10/2026: em 90 dias, 19 pares de recebimentos iguais (mesmo cliente,
// mesmo valor) com menos de 10 minutos de intervalo, em 5 lojas — nenhum
// era retry de rede, todos foram dois "Confirmar". Mas parte deles é uso
// legítimo: a lojista recebe parcela a parcela de mesmo valor (4 × R$330
// em 40 segundos). Por isso NADA aqui bloqueia: o gate muda de texto e a
// chave de idempotência passa a valer enquanto o mesmo pedido estiver na
// tela.
//
// Mora fora do ClienteCrediarioModal porque o modal arrasta react-native-svg
// pelo Icon/Toast e o jest do repo não carrega isso — a regra precisa ser
// testável sozinha, com `now` injetado.
// ============================================================
import type { CreditTransaction } from "@/services/creditApi";

/** Janela em que um recebimento igual conta como "você acabou de registrar". */
export const JANELA_DE_REPETICAO_MS = 2 * 60 * 1000;

/** O que a ficha guarda do último recebimento confirmado nela (sobrevive ao "Concluir"). */
export type UltimoRecebimento = { amount: number; method: string | null; at: string };

export type RecebimentoRepetido = { amount: number; method: string | null; segundos: number };

const mesmoValor = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * Recebimento do MESMO valor registrado há pouco para este cliente.
 * Olha o razão já carregado (pode estar alguns segundos atrasado — a ficha
 * recarrega depois do POST) E o último recebimento feito nesta ficha, que é
 * imediato. Devolve o mais recente, ou null.
 */
export function recebimentoRecente(
  transactions: Pick<CreditTransaction, "type" | "amount" | "payment_method" | "created_at">[] | null | undefined,
  ultimo: UltimoRecebimento | null | undefined,
  amount: number,
  now: number = Date.now(),
  janelaMs: number = JANELA_DE_REPETICAO_MS,
): RecebimentoRepetido | null {
  if (!(amount > 0)) return null;
  const candidatos: RecebimentoRepetido[] = [];
  const considera = (valor: number, method: string | null, iso: string) => {
    if (!mesmoValor(valor, amount)) return;
    const ms = now - new Date(iso).getTime();
    if (!(ms >= 0 && ms <= janelaMs)) return;
    candidatos.push({ amount: valor, method, segundos: Math.round(ms / 1000) });
  };
  for (const t of transactions || []) {
    if (t.type === "payment") considera(Number(t.amount), t.payment_method, t.created_at);
  }
  if (ultimo) considera(ultimo.amount, ultimo.method, ultimo.at);
  if (!candidatos.length) return null;
  return candidatos.reduce((a, b) => (b.segundos < a.segundos ? b : a));
}

function haQuanto(segundos: number): string {
  if (segundos < 60) return `há ${segundos} segundo${segundos === 1 ? "" : "s"}`;
  const min = Math.round(segundos / 60);
  return `há ${min} minuto${min === 1 ? "" : "s"}`;
}

/** Texto do gate quando há um recebimento igual recente. */
export function mensagemDeRepeticao(
  rep: RecebimentoRepetido,
  fmt: (n: number) => string,
  metodoLabel: (key: string | null) => string,
): string {
  const anterior = rep.method ? ` em ${metodoLabel(rep.method).toLowerCase()}` : "";
  return `Você registrou ${fmt(rep.amount)}${anterior} ${haQuanto(rep.segundos)}. Registrar outro recebimento de ${fmt(rep.amount)}?`;
}

/**
 * Chave de idempotência de UM pedido de recebimento. Gerada no primeiro
 * envio e mantida até o sucesso: clique duplo no "Sim" e "deu timeout, tento
 * de novo" viram replay no backend (ON CONFLICT na key) em vez de segundo
 * pagamento. Qualquer edição no valor/forma/data descarta a chave — é outro
 * pedido. Antes, a chave era gerada a cada chamada e não deduplicava nada.
 */
export function novaChaveDeRecebimento(companyId: string, customerId: string, now: number = Date.now()): string {
  const salt = Math.random().toString(36).slice(2, 8);
  return `rfp-${companyId}-${customerId}-${now}-${salt}`;
}

// ── Pagamento repetido pelo servidor (23/11/2026, Looks Da Jenny) ─────────
//
// O mesmo recebimento entrou duas vezes na ficha: o segundo de outro
// computador, com a data voltada um dia. O aviso acima não pega isso (olha só
// esta tela e os últimos 2 minutos). O backend agora confere, antes de gravar,
// se já existe pagamento com o mesmo valor e a mesma DATA DE PAGAMENTO para a
// cliente nesta loja; se existe, responde 409 PAGAMENTO_REPETIDO sem gravar.
// A tela pergunta e, no "Lançar mesmo assim", reenvia com
// `confirmar_repetido: true` e a MESMA chave de idempotência (nada foi gravado).
// Backend antigo nunca manda esse 409: nada muda.

export const CODIGO_PAGAMENTO_REPETIDO = "PAGAMENTO_REPETIDO";

/**
 * Uma pergunta só: se a lojista já respondeu "Sim, é outro" ao aviso de
 * repetição desta tela (recebimentoRecente acusou), o envio vai com
 * confirmar_repetido: true e o servidor não pergunta de novo.
 */
export function confirmarRepetidoNoEnvio(repetidoLocal: RecebimentoRepetido | null | undefined): boolean {
  return !!repetidoLocal;
}

export type PagamentoRepetido = { data_pagamento: string; valor: number };

/** O 409 PAGAMENTO_REPETIDO do backend, ou null para qualquer outro erro. */
export function pagamentoRepetidoDoErro(err: any): PagamentoRepetido | null {
  if (!err || err.status !== 409) return null;
  const d = err.data;
  if (!d || d.code !== CODIGO_PAGAMENTO_REPETIDO) return null;
  const data = typeof d.data_pagamento === "string" ? d.data_pagamento : "";
  return { data_pagamento: data, valor: Number(d.valor) || 0 };
}

/** Hoje em Brasília, AAAA-MM-DD (o mesmo dia que o backend usa). */
export function hojeEmBrasilia(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Texto da confirmação. Hoje: texto aprovado pelo Caio. Outro dia: "em dd/mm".
 * Data ilegível (o backend sempre manda) vira "nesta data" — nunca "em undefined".
 */
export function mensagemPagamentoRepetido(dataPagamento: string, hoje: string = hojeEmBrasilia()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataPagamento || "");
  if (!m) return "Já existe um pagamento igual nesta data. Lançar mesmo assim?";
  if (dataPagamento === hoje) return "Já existe um pagamento igual hoje. Lançar mesmo assim?";
  return `Já existe um pagamento igual em ${m[3]}/${m[2]}. Lançar mesmo assim?`;
}
