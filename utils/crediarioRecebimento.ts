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
