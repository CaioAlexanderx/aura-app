// ============================================================
// AURA. — A venda em andamento do Caixa sobrevive à troca de página
//
// Histórico:
//   · 23/09/2026 (QA Matcon): trocar o tema claro/escuro recarregava a página
//     e o carrinho sumia. A venda passou a ser guardada ANTES da recarga
//     (sessionStorage, 10 min, leitura única).
//   · 14/10/2026: o lojista (Matcon sofre mais) também perdia o carrinho ao
//     trocar de página e voltar. A guarda deixou de ser "só antes da recarga":
//     o useCart grava a venda a cada mudança e ao sair da tela, e o Caixa
//     restaura ao abrir com o carrinho vazio.
//
// Decisões:
//   · localStorage: sobrevive a trocar de página, recarregar e fechar a aba;
//     validade de 24 h. Nada vai para o servidor.
//   · A chave leva a EMPRESA e o USUÁRIO: multi-CNPJ guarda uma venda por
//     empresa, e outro usuário no mesmo navegador não herda o carrinho (a
//     venda tem cliente e CPF). Quem entra varre as vendas guardadas por
//     outro usuário, e o logout apaga todas (stores/auth).
//   · A leitura NÃO apaga: a guarda é contínua, o carrinho em memória a
//     regrava na sequência. Quem apaga é o fim da venda: finalizar, lançar na
//     comanda, limpar o carrinho (hooks/useCart).
//   · A troca de tema continua chamando guardarAntesDeRecarregar(): vale como
//     descarga síncrona do que ainda está no debounce, antes do reload.
//   · Tudo em try/catch: navegador sem storage (aba anônima com bloqueio,
//     nativo) só não guarda — o Caixa funciona do mesmo jeito.
// ============================================================

const PREFIXO = "aura:caixa:venda:";
export const VALIDADE_DA_VENDA_GUARDADA_MS = 24 * 60 * 60 * 1000;

/** Guarda o que precisa sobreviver à recarga. Devolve true se guardou algo
 *  (o toggle do tema usa isso para avisar e dar tempo de ler o aviso). */
type Guardiao = () => boolean | void;
const guardioes = new Set<Guardiao>();

/** Registra quem precisa guardar algo antes da recarga. Devolve o
 *  cancelamento (use no cleanup do useEffect). */
export function aoRecarregar(fn: Guardiao): () => void {
  guardioes.add(fn);
  return () => { guardioes.delete(fn); };
}

/** Chamado de forma SÍNCRONA antes de window.location.reload() (troca de
 *  tema) — e de novo imediatamente antes dele, para levar o que mudou no
 *  meio-tempo. Devolve true se algum guardião guardou algo. */
export function guardarAntesDeRecarregar(): boolean {
  let guardou = false;
  guardioes.forEach((fn) => {
    try { if (fn() === true) guardou = true; } catch {}
  });
  return guardou;
}

/** A recarga em si, num ponto só (o jsdom não deixa espionar
 *  window.location.reload; os testes espionam esta função). */
export function recarregarPagina(): void {
  try { window.location.reload(); } catch {}
}

/** Só para testes: o que uma recarga de verdade zera. */
export function __zerarParaTestes(): void {
  guardioes.clear();
}

function armazenamento(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage || null;
  } catch {
    return null;
  }
}

type Envelope<T> = { v: 2; empresa: string; usuario: string; em: number; dados: T };

function chaveDa(empresa: string, usuario: string): string {
  return PREFIXO + empresa + ":" + usuario;
}

function lerEnvelope<T>(st: Storage, chave: string): Envelope<T> | null {
  try {
    const bruto = st.getItem(chave);
    if (!bruto) return null;
    const env = JSON.parse(bruto);
    if (!env || env.v !== 2 || typeof env.em !== "number") return null;
    return env as Envelope<T>;
  } catch {
    return null;
  }
}

function dentroDaValidade(em: number, agora: number): boolean {
  return agora - em >= 0 && agora - em <= VALIDADE_DA_VENDA_GUARDADA_MS;
}

/** Apaga o que não é deste usuário (troca de usuário no navegador), o que
 *  venceu e o que não se lê mais. Deixa as outras empresas do MESMO usuário. */
function varrer(st: Storage, usuario: string, agora: number): void {
  try {
    const apagar: string[] = [];
    for (let i = 0; i < st.length; i++) {
      const k = st.key(i);
      if (!k || k.indexOf(PREFIXO) !== 0) continue;
      const env = lerEnvelope<unknown>(st, k);
      if (!env || env.usuario !== usuario || !dentroDaValidade(env.em, agora)) apagar.push(k);
    }
    apagar.forEach((k) => { try { st.removeItem(k); } catch {} });
  } catch {}
}

/** Grava a venda desta empresa + usuário. Devolve true se gravou. */
export function guardarVenda<T>(
  empresa: string | null | undefined,
  usuario: string | null | undefined,
  dados: T,
  agora: number = Date.now(),
): boolean {
  const st = armazenamento();
  if (!st || !empresa || !usuario) return false;
  try {
    varrer(st, String(usuario), agora);
    const env: Envelope<T> = { v: 2, empresa: String(empresa), usuario: String(usuario), em: agora, dados };
    st.setItem(chaveDa(String(empresa), String(usuario)), JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}

/** Lê a venda guardada desta empresa + usuário. null se não houver, se for de
 *  outra empresa/usuário ou se passou da validade (a vencida é apagada).
 *  NÃO apaga a venda válida: a guarda é contínua. */
export function recuperarVenda<T>(
  empresa: string | null | undefined,
  usuario: string | null | undefined,
  agora: number = Date.now(),
): T | null {
  const st = armazenamento();
  if (!st || !empresa || !usuario) return null;
  varrer(st, String(usuario), agora);
  const env = lerEnvelope<T>(st, chaveDa(String(empresa), String(usuario)));
  if (!env || env.empresa !== String(empresa) || env.usuario !== String(usuario)) return null;
  if (!dentroDaValidade(env.em, agora)) {
    try { st.removeItem(chaveDa(String(empresa), String(usuario))); } catch {}
    return null;
  }
  return env.dados ?? null;
}

/** Fim da venda (finalizou, lançou na comanda, limpou): apaga a guarda. */
export function apagarVendaGuardada(empresa: string | null | undefined, usuario: string | null | undefined): void {
  const st = armazenamento();
  if (!st || !empresa || !usuario) return;
  try { st.removeItem(chaveDa(String(empresa), String(usuario))); } catch {}
}

/** Login: quem entra não herda (nem deixa à vista) a venda de outro usuário
 *  que expirou a sessão neste navegador. Mantém as do próprio usuário. */
export function apagarVendasDeOutrosUsuarios(usuario: string | null | undefined, agora: number = Date.now()): void {
  const st = armazenamento();
  if (!st || !usuario) return;
  varrer(st, String(usuario), agora);
}

/** Logout: apaga TODAS as vendas guardadas neste navegador (dados pessoais
 *  de cliente e CPF não ficam para o próximo a entrar). */
export function apagarTodasAsVendasGuardadas(): void {
  const st = armazenamento();
  if (!st) return;
  try {
    const apagar: string[] = [];
    for (let i = 0; i < st.length; i++) {
      const k = st.key(i);
      if (k && k.indexOf(PREFIXO) === 0) apagar.push(k);
    }
    apagar.forEach((k) => { try { st.removeItem(k); } catch {} });
  } catch {}
}
