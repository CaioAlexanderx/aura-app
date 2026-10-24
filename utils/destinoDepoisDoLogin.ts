// ============================================================
// AURA. — Link aberto sem sessão volta para a tela pedida (tq-91, 24/10/2026)
//
// Medido em 21/10: o AuthGuard (app/_layout.tsx) trocava para /(auth)/login
// e jogava fora caminho e query; o login sempre ia para /(tabs). O link do
// e-mail ("ver o crediário em atraso") caía no Painel depois do login.
//
// Agora o AuthGuard guarda o destino aqui antes de mandar para o login, e
// quem conclui a entrada (o próprio AuthGuard, o login e o cadastro) volta
// para ele. Convite e Karatê (entrada Shoji) mantêm o caminho deles; as
// telas públicas nem passam pelo login.
//
// Contra open redirect, só entra caminho INTERNO: começa por "/", sem "//",
// sem "\", sem esquema, sem caractere de controle ou espaço (o navegador
// apaga tab e quebra de linha da URL, e "/\t/mal.com" vira "//mal.com"),
// e a URL montada sobre uma origem qualquer continua nessa origem.
//
// Guardado no sessionStorage (só esta aba, some ao fechar) com validade de
// 30 minutos: um destino esquecido não sequestra um login de outro dia.
// Fora do web (ou com o storage bloqueado) fica só em memória.
// ============================================================

const CHAVE = "aura_destino_pos_login";
export const VALIDADE_DO_DESTINO_MS = 30 * 60 * 1000;
const TAMANHO_MAXIMO = 2048;

// Telas da própria entrada: voltar para elas depois de entrar não faz sentido
// (e o login mandaria de novo para o login).
const TELAS_DE_ENTRADA = /^\/(\(auth\)|login|register|verify-email|forgot-password|reset-password)(\/|\?|$)/i;

type Guardado = { caminho: string; em: number };

let emMemoria: Guardado | null = null;
// Saída voluntária (botão Sair): a tela em que a pessoa estava não vira
// destino do próximo login. Expira sozinha (no web o logout recarrega a
// página e o módulo zera de qualquer jeito).
let saidaVoluntariaAte = 0;

function sessao(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * O caminho é interno e seguro para router.replace? Devolve o caminho
 * (caminho + query, sem o #) ou null. "/" também é null: o Painel já é o
 * destino padrão.
 */
export function destinoSeguro(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  if (bruto.length === 0 || bruto.length > TAMANHO_MAXIMO) return null;
  // Sem espaço, caractere de controle nem DEL em lugar nenhum.
  if (/[\u0000- \u007f]/.test(bruto)) return null;
  if (bruto.indexOf("\\") >= 0) return null;
  if (bruto[0] !== "/" || bruto[1] === "/") return null;

  const semHash = bruto.split("#")[0];
  const caminho = semHash.split("?")[0];

  // A mesma checagem com o caminho decodificado: "/%2F%2Fmal.com",
  // "/%5Cmal.com" e afins.
  let decodificado = caminho;
  try { decodificado = decodeURIComponent(caminho); } catch { return null; }
  if (decodificado.indexOf("\\") >= 0) return null;
  if (decodificado[0] !== "/" || decodificado[1] === "/") return null;
  if (/[\u0000- \u007f]/.test(decodificado)) return null;
  // Esquema no primeiro segmento ("/javascript:..." não é esquema, mas não
  // existe rota com ":" no app e não vale o risco).
  if (decodificado.indexOf(":") >= 0) return null;

  // A prova final: montada sobre uma origem, a URL continua nela.
  try {
    if (typeof URL !== "undefined") {
      const base = "https://app.invalid";
      const u = new URL(semHash, base);
      if (u.origin !== base) return null;
    }
  } catch {
    return null;
  }

  if (caminho === "/") return null;
  if (TELAS_DE_ENTRADA.test(semHash)) return null;
  return semHash;
}

/** Guarda o destino (se for seguro). Destino inválido não apaga o que já está guardado. */
export function guardarDestino(bruto: unknown, agora: number = Date.now()): boolean {
  if (agora < saidaVoluntariaAte) return false;
  const caminho = destinoSeguro(bruto);
  if (!caminho) return false;
  const g: Guardado = { caminho, em: agora };
  emMemoria = g;
  const ss = sessao();
  if (ss) { try { ss.setItem(CHAVE, JSON.stringify(g)); } catch { /* fica em memória */ } }
  return true;
}

/** Lê o destino sem apagar (o login lê antes de entrar; quem apaga é o AuthGuard). */
export function lerDestino(agora: number = Date.now()): string | null {
  let g: Guardado | null = null;
  const ss = sessao();
  if (ss) {
    try {
      const bruto = ss.getItem(CHAVE);
      if (bruto) g = JSON.parse(bruto);
    } catch { g = null; }
  }
  if (!g) g = emMemoria;
  if (!g || typeof g !== "object" || typeof g.em !== "number") return null;
  if (agora - g.em > VALIDADE_DO_DESTINO_MS || agora < g.em - 60_000) { limparDestino(); return null; }
  // Revalida na leitura: o sessionStorage pode ter sido mexido à mão.
  return destinoSeguro(g.caminho);
}

/** Lê e apaga. */
export function consumirDestino(agora: number = Date.now()): string | null {
  const caminho = lerDestino(agora);
  limparDestino();
  return caminho;
}

export function limparDestino(): void {
  emMemoria = null;
  const ss = sessao();
  if (ss) { try { ss.removeItem(CHAVE); } catch { /* nada */ } }
}

/** Botão Sair: apaga o destino e não guarda a tela de onde a pessoa saiu. */
export function marcarSaidaVoluntaria(agora: number = Date.now()): void {
  saidaVoluntariaAte = agora + 3000;
  limparDestino();
}

/** Só para testes. */
export function __zerarDestino(): void {
  saidaVoluntariaAte = 0;
  limparDestino();
}
