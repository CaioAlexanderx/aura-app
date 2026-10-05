// ============================================================
// AURA STUDIO · StudioShell — controle do botão flutuante pela tela
//
// QA mobile de 05/10/2026. O flutuante mora no shell, mas quem sabe se
// ele cabe é a tela: com a ficha do produto aberta ele cobria o Salvar
// da barra fixa, e a ação dele repetia (com outro rótulo) o botão do
// cabeçalho. Duas alavancas, as duas opcionais:
//
//   useStudioFabHidden(cond)  — a tela esconde o flutuante enquanto
//                               `cond` for verdadeiro (ficha, modal,
//                               barra de salvar fixa).
//   useStudioFabAction(fn)    — a tela entrega a ação do flutuante (a
//                               mesma do botão do cabeçalho no desktop).
//                               Sem isso o shell navega para o `href`
//                               de fab.ts, como sempre fez.
//
// Estado em módulo + useSyncExternalStore: o shell e a tela são irmãos
// na árvore (shell → Slot → tela), e um contexto obrigaria o shell a
// re-renderizar a tela a cada mudança.
// ============================================================
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";
import { resolveFab, FAB_CLEARANCE } from "./fab";

/** Abaixo disto o shell do Studio está no modo celular. */
export const STUDIO_MOBILE_MAX = 768;

type Acao = () => void;

let escondidoPor = 0;
let acao: Acao | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

const lerEscondido = () => escondidoPor > 0;
const lerAcao = () => acao;

/** A tela esconde o flutuante do shell enquanto `cond` for verdadeiro. */
export function useStudioFabHidden(cond: boolean) {
  useEffect(() => {
    if (!cond) return;
    escondidoPor += 1;
    avisar();
    return () => {
      escondidoPor -= 1;
      avisar();
    };
  }, [cond]);
}

/** A tela entrega a ação do flutuante (sempre a versão mais recente de `fn`). */
export function useStudioFabAction(fn: Acao) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const minha: Acao = () => ref.current();
    acao = minha;
    avisar();
    return () => {
      if (acao === minha) {
        acao = null;
        avisar();
      }
    };
  }, []);
}

/** Lido pelo shell. */
export function useStudioFabState(): { hidden: boolean; action: Acao | null } {
  const hidden = useSyncExternalStore(assinar, lerEscondido, lerEscondido);
  const action = useSyncExternalStore(assinar, lerAcao, lerAcao);
  return { hidden, action };
}

/** Folga no fim da rolagem para o flutuante não cobrir a última linha.
 *  Zero fora do celular e em rota sem flutuante. */
export function useStudioFabClearance(): number {
  const { width } = useWindowDimensions();
  const pathname = usePathname() || "";
  return width < STUDIO_MOBILE_MAX && resolveFab(pathname) ? FAB_CLEARANCE : 0;
}
