// ============================================================
// AURA. — A venda em andamento sobrevive à recarga da página
//
// QA 23/09/2026 (Matcon, produção): trocar o tema claro/escuro recarregava
// a página e o carrinho do Caixa sumia sem aviso. A recarga é necessária —
// as cores são congeladas na importação (constants/colors.ts) e centenas de
// StyleSheet.create já as leram —, então o que muda é o que acontece ANTES
// dela: quem tem estado que não pode se perder (o Caixa) se registra aqui, o
// toggle do tema chama guardarAntesDeRecarregar() e, ao voltar, o Caixa
// recupera a venda.
//
// Decisões:
//   · sessionStorage: vale só para esta aba e some ao fechá-la — recarregar
//     é o único caminho de volta. Nada vai para o servidor.
//   · A venda é da EMPRESA (multi-CNPJ): recuperar em outra empresa não
//     devolve nada.
//   · Validade curta (10 min) e leitura única: a venda guardada é apagada
//     ao ser lida, para não ressuscitar um carrinho antigo mais tarde.
//   · Tudo em try/catch: navegador sem storage (aba anônima com bloqueio,
//     nativo) só não guarda — o tema troca do mesmo jeito.
// ============================================================

const CHAVE = "aura:caixa:venda-em-andamento";
export const VALIDADE_DA_VENDA_GUARDADA_MS = 10 * 60 * 1000;

/** Guarda o que precisa sobreviver à recarga. Devolve true se guardou algo
 *  (o toggle do tema usa isso para avisar e dar tempo de ler o aviso). */
type Guardiao = () => boolean | void;
const guardioes = new Set<Guardiao>();

// Correção de 23/09/2026, 16h (produção): a venda era GUARDADA, mas um Caixa
// remontado nos 200 ms antes da recarga a LIA — e a leitura é única, apaga a
// chave —, então a página voltava com o sessionStorage vazio. O remonte vinha
// do set({ isDark }) do toggle: o layout das abas embrulha a página num
// <div key={themeKey}>. Com uma recarga marcada, esta página não recupera
// nada: quem recupera é a página que vem DEPOIS (o módulo renasce zerado).
let recargaMarcada = false;

/** Registra quem precisa guardar algo antes da recarga. Devolve o
 *  cancelamento (use no cleanup do useEffect). */
export function aoRecarregar(fn: Guardiao): () => void {
  guardioes.add(fn);
  return () => { guardioes.delete(fn); };
}

/** Chamado de forma SÍNCRONA antes de window.location.reload() (troca de
 *  tema) — e de novo imediatamente antes dele, para levar o que mudou no
 *  meio-tempo. Marca a recarga: daqui em diante esta página não lê (nem
 *  apaga) a venda guardada. Devolve true se algum guardião guardou algo. */
export function guardarAntesDeRecarregar(): boolean {
  recargaMarcada = true;
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
  recargaMarcada = false;
  guardioes.clear();
}

function armazenamento(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage || null;
  } catch {
    return null;
  }
}

type Envelope<T> = { v: 1; empresa: string; em: number; dados: T };

/** Grava a venda. Devolve true se gravou. */
export function guardarVenda<T>(empresa: string | null | undefined, dados: T, agora: number = Date.now()): boolean {
  const st = armazenamento();
  if (!st || !empresa) return false;
  try {
    const env: Envelope<T> = { v: 1, empresa: String(empresa), em: agora, dados };
    st.setItem(CHAVE, JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}

/** Lê e APAGA a venda guardada. null se não houver, se for de outra
 *  empresa (fica guardada, esperando a empresa certa), se passou da validade
 *  ou se esta página já marcou uma recarga (quem recupera é a próxima). */
export function recuperarVenda<T>(empresa: string | null | undefined, agora: number = Date.now()): T | null {
  if (recargaMarcada) return null;
  const st = armazenamento();
  if (!st || !empresa) return null;
  let bruto: string | null = null;
  try { bruto = st.getItem(CHAVE); } catch { return null; }
  if (!bruto) return null;
  let env: Envelope<T> | null = null;
  try { env = JSON.parse(bruto); } catch { env = null; }
  if (!env || env.v !== 1 || env.empresa !== String(empresa)) return null;
  try { st.removeItem(CHAVE); } catch {}
  if (!(agora - env.em >= 0 && agora - env.em <= VALIDADE_DA_VENDA_GUARDADA_MS)) return null;
  return env.dados ?? null;
}
