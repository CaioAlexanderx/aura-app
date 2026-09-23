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

type Guardiao = () => void;
const guardioes = new Set<Guardiao>();

/** Registra quem precisa guardar algo antes da recarga. Devolve o
 *  cancelamento (use no cleanup do useEffect). */
export function aoRecarregar(fn: Guardiao): () => void {
  guardioes.add(fn);
  return () => { guardioes.delete(fn); };
}

/** Chamado logo antes de window.location.reload() (troca de tema). */
export function guardarAntesDeRecarregar(): void {
  guardioes.forEach((fn) => {
    try { fn(); } catch {}
  });
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

export function guardarVenda<T>(empresa: string | null | undefined, dados: T, agora: number = Date.now()): void {
  const st = armazenamento();
  if (!st || !empresa) return;
  try {
    const env: Envelope<T> = { v: 1, empresa: String(empresa), em: agora, dados };
    st.setItem(CHAVE, JSON.stringify(env));
  } catch {}
}

/** Lê e APAGA a venda guardada. null se não houver, se for de outra
 *  empresa ou se passou da validade. */
export function recuperarVenda<T>(empresa: string | null | undefined, agora: number = Date.now()): T | null {
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
