// ============================================================
// AURA. — Tempos da venda no Caixa, medidos no app (p-152, 17/11/2026)
//
// Três números por venda, mandados para POST /usage/pdv-timing
// (Aura-backend#1047, migration 455):
//   atendimento_ms  primeiro item no carrinho -> clique em Finalizar
//   espera_ms       Finalizar -> resposta do servidor
//   ocioso_ms       resposta -> Nova venda (a tela final parada)
// mais o número de itens, por onde eles entraram (leitor, grade, busca ou
// misto) e se a venda foi registrada. O log [pdv-sale-timing] do servidor
// (p-140) mede a espera por dentro; isto mede o que a pessoa sente.
//
// Sem dado de cliente final: só números, sim/não e o id da venda. O envio
// é de melhor esforço (fetch próprio, nunca o request(), para uma falha
// aqui não virar aviso na tela) e acontece quando a próxima venda começa.
// Uma venda recusada manda o que tem na hora, com ok=false.
// ============================================================

export type Entrada = "leitor" | "grade" | "busca";

export type TempoDaVenda = {
  id: string;
  at: string;
  sale_id: string | null;
  atendimento_ms: number | null;
  espera_ms: number | null;
  ocioso_ms: number | null;
  itens: number;
  entrada: Entrada | "misto" | null;
  ok: boolean;
};

type Envio = (lista: TempoDaVenda[]) => void;

let agora: () => number = () => Date.now();
let enviar: Envio = () => {};
let inicio: number | null = null;
let entradas = new Set<Entrada>();
let emVoo: { t1: number; atendimento: number | null; itens: number; entrada: TempoDaVenda["entrada"] } | null = null;
let aguardando: { registro: TempoDaVenda; t2: number } | null = null;

function novoId(): string {
  try {
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch { /* segue */ }
  return "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function rotuloDaEntrada(): TempoDaVenda["entrada"] {
  if (entradas.size === 0) return null;
  if (entradas.size > 1) return "misto";
  return [...entradas][0];
}

/** Quem manda (services/api.ts liga o fetch com o token). */
export function definirEnvioDosTempos(fn: Envio): void {
  enviar = fn;
}

/** Por onde o próximo item vai entrar (o Caixa marca antes de lançar). */
export function marcarEntrada(origem: Entrada): void {
  entradas.add(origem);
}

/** Um item entrou no carrinho da venda atual. */
export function aoAdicionarItem(): void {
  if (inicio === null) inicio = agora();
}

/** Clique em Finalizar (já passou pelas conferências da tela). */
export function aoFinalizar(itens: number): void {
  const t1 = agora();
  emVoo = { t1, atendimento: inicio !== null ? Math.max(0, t1 - inicio) : null, itens, entrada: rotuloDaEntrada() };
}

/** Resposta do servidor. */
export function aoResponder(ok: boolean, saleId: string | null): void {
  if (!emVoo) return;
  const t2 = agora();
  const registro: TempoDaVenda = {
    id: novoId(),
    at: new Date(Date.now()).toISOString(),
    sale_id: saleId,
    atendimento_ms: emVoo.atendimento,
    espera_ms: Math.max(0, t2 - emVoo.t1),
    ocioso_ms: null,
    itens: emVoo.itens,
    entrada: emVoo.entrada,
    ok,
  };
  emVoo = null;
  if (!ok) {
    // Recusada: o carrinho continua; o atendimento segue contando do mesmo
    // primeiro item.
    try { enviar([registro]); } catch { /* telemetria */ }
    return;
  }
  aguardando = { registro, t2 };
  inicio = null;
  entradas = new Set();
}

/** Nova venda (também Limpar). `comItens`: a venda nova já nasce com itens
 *  (os lançados durante a espera da anterior). */
export function aoNovaVenda(comItens: boolean): void {
  if (aguardando) {
    const { registro, t2 } = aguardando;
    aguardando = null;
    try { enviar([{ ...registro, ocioso_ms: Math.max(0, agora() - t2) }]); } catch { /* telemetria */ }
  }
  emVoo = null;
  entradas = new Set();
  inicio = comItens ? agora() : null;
}

export function __zerarTemposParaTestes(relogio?: () => number): void {
  agora = relogio || (() => Date.now());
  enviar = () => {};
  inicio = null;
  entradas = new Set();
  emVoo = null;
  aguardando = null;
}
