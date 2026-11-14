// ============================================================
// AURA. — Falhas de conexão anotadas pelo app (14/11/2026)
//
// Quando o app fica sem resposta do servidor ("Não conseguimos falar com a
// Aura agora"), o pedido nem chega ao backend e não deixa rastro nos logs —
// o suporte não conseguia dizer se foi a internet da loja ou o nosso lado
// (caso da Dandigo, 14/11). Aqui o app anota cada falha (quando, em que
// tela, que chamada, se o navegador se achava online, quantas tentativas)
// e manda o lote para POST /usage/connection-failures assim que alguma
// chamada volta a dar certo (ou o navegador avisa que voltou a rede).
//
// Regras:
//  - nunca atrapalha o app: tudo em try/catch, envio em segundo plano;
//  - a fila vive no localStorage (sobrevive a recarregar a página), com no
//    máximo 50 falhas — as mais antigas saem primeiro;
//  - ids do caminho viram ":id" (sem dado de cliente na telemetria);
//  - envio no máximo a cada 30 s; só some da fila o que o servidor aceitou.
// ============================================================

export type CodigoDaFalha = "network" | "timeout";

export type FalhaDeConexao = {
  id: string;
  at: string;
  method: string;
  path: string;
  code: CodigoDaFalha;
  screen: string | null;
  online: boolean | null;
  attempts: number;
};

export const CHAVE_DA_FILA = "aura:falhas-de-conexao";
export const MAX_NA_FILA = 50;
export const INTERVALO_ENTRE_ENVIOS_MS = 30000;

var memoria: FalhaDeConexao[] = [];
var ultimoEnvio = 0;
var enviando = false;

function armazenamento(): Storage | null {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch { /* sem acesso */ }
  return null;
}

function lerFila(): FalhaDeConexao[] {
  var ls = armazenamento();
  if (!ls) return memoria.slice();
  try {
    var bruto = ls.getItem(CHAVE_DA_FILA);
    var lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch { return memoria.slice(); }
}

function gravarFila(lista: FalhaDeConexao[]): void {
  var cortada = lista.slice(-MAX_NA_FILA);
  memoria = cortada;
  var ls = armazenamento();
  if (!ls) return;
  try {
    if (cortada.length) ls.setItem(CHAVE_DA_FILA, JSON.stringify(cortada));
    else ls.removeItem(CHAVE_DA_FILA);
  } catch { /* cheio ou bloqueado: fica na memória */ }
}

/** "/companies/<uuid>/products/<uuid>?q=x" → "/companies/:id/products/:id". */
export function caminhoSemIds(path: string): string {
  return String(path || "")
    .split("?")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .slice(0, 200);
}

/** Rota do app no momento (web). Ids também viram ":id". */
export function telaAtual(): string | null {
  try {
    if (typeof window === "undefined" || !window.location) return null;
    var p = caminhoSemIds(window.location.pathname || "");
    return p ? p.slice(0, 64) : null;
  } catch { return null; }
}

function navegadorOnline(): boolean | null {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") return navigator.onLine;
  } catch { /* sem navigator */ }
  return null;
}

/** Anota uma falha de conexão. Nunca lança. */
export function anotarFalhaDeConexao(
  info: { method?: string; path: string; code: CodigoDaFalha; attempts?: number },
  agora: number = Date.now(),
): void {
  try {
    var falha: FalhaDeConexao = {
      id: agora.toString(36) + "-" + Math.random().toString(36).slice(2, 10),
      at: new Date(agora).toISOString(),
      method: String(info.method || "GET").toUpperCase(),
      path: caminhoSemIds(info.path),
      code: info.code,
      screen: telaAtual(),
      online: navegadorOnline(),
      attempts: typeof info.attempts === "number" ? info.attempts : 1,
    };
    gravarFila(lerFila().concat([falha]));
  } catch { /* telemetria nunca atrapalha */ }
}

export function falhasPendentes(): FalhaDeConexao[] {
  return lerFila();
}

/**
 * Manda a fila (no máximo a cada 30 s). `enviar` devolve true quando o
 * servidor aceitou; aí as falhas enviadas saem da fila. Devolve quantas
 * foram enviadas. Nunca lança.
 */
export async function enviarFalhasPendentes(
  enviar: (falhas: FalhaDeConexao[]) => Promise<boolean>,
  agora: number = Date.now(),
): Promise<number> {
  if (enviando || agora - ultimoEnvio < INTERVALO_ENTRE_ENVIOS_MS) return 0;
  var lote = lerFila();
  if (!lote.length) return 0;
  enviando = true;
  ultimoEnvio = agora;
  try {
    var ok = await enviar(lote);
    if (!ok) return 0;
    var enviados: Record<string, true> = {};
    lote.forEach(function(f) { enviados[f.id] = true; });
    // O que chegou enquanto enviava fica para a próxima.
    gravarFila(lerFila().filter(function(f) { return !enviados[f.id]; }));
    return lote.length;
  } catch {
    return 0;
  } finally {
    enviando = false;
  }
}

/** Só para testes. */
export function __reiniciarFalhasDeConexao(): void {
  memoria = [];
  ultimoEnvio = 0;
  enviando = false;
  var ls = armazenamento();
  try { if (ls) ls.removeItem(CHAVE_DA_FILA); } catch { /* ok */ }
}
