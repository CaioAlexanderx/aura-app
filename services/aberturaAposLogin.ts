// ============================================================
// AURA. — Marca "acabei de entrar" (17/10/2026, card t2-14)
//
// A medição de telas visitadas (services/registroDeTelas) contava a primeira
// tela aberta logo depois do login (quase sempre o Painel) como uma visita
// igual a um retorno. Quem entra e sai inflava o "uso" do Painel.
//
// Aqui vive só a marca, sem nenhum import: o store de auth (que sabe quando
// houve login/cadastro de verdade) marca; o registro de telas consome na
// primeira tela aberta e a marca some. Restaurar sessão salva (recarregar a
// página, voltar ao app) NUNCA marca — isso é retorno, não login.
//
// A marca vale por alguns minutos: se o login não levar a tela nenhuma (ficou
// parado numa tela de autenticação), uma tela aberta bem depois não é "do
// login".
// ============================================================

export const JANELA_DO_LOGIN_MS = 3 * 60_000;

let marcadoEm: number | null = null;

/** O usuário acabou de entrar (login ou cadastro concluído). */
export function marcarLogin(agora: number = Date.now()): void {
  marcadoEm = agora;
}

/**
 * Consome a marca: true uma única vez por login, e só se ainda estiver dentro
 * da janela. Depois disso (ou sem login) devolve false.
 */
export function consumirMarcaDeLogin(agora: number = Date.now()): boolean {
  const em = marcadoEm;
  marcadoEm = null;
  return em !== null && agora - em >= 0 && agora - em <= JANELA_DO_LOGIN_MS;
}

/** Logout / troca de sessão: nada de marca velha para o próximo usuário. */
export function limparMarcaDeLogin(): void {
  marcadoEm = null;
}
