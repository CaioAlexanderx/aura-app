// ============================================================
// waTeclado — teclado no computador (padrão ARIA) para as telas do WhatsApp
//
// useSetas: um grupo de itens com foco "roving" (só um item entra no Tab; as
// setas, Home e End movem o foco). Serve para:
//   - tablist/tab: as setas movem E ativam (`ativarAoMover`), Enter/Espaço ativam;
//   - radiogroup/radio: as setas movem e escolhem (`ativarAoMover`);
//   - grupos de caixas (pontos da régua): as setas só movem o foco, o Espaço marca.
// No RN Web o `onKeyDown` e o `tabIndex` chegam ao DOM; no celular não fazem nada.
// ============================================================
import { useCallback, useRef, useState } from "react";

export interface OpcoesSetas {
  /** Quantos itens o grupo tem. */
  qtd: number;
  /** Índice do item selecionado (-1 = nenhum: entra no primeiro habilitado). */
  ativo: number;
  /** Chamado com o índice para onde o foco foi (e que deve ser ativado, se `ativarAoMover`). */
  aoMover?: (i: number) => void;
  /** As setas também ativam o item (tabs, radios). */
  ativarAoMover?: boolean;
  /** Itens que não recebem foco nem seleção. */
  desabilitados?: boolean[];
  /** Setas na vertical também (↑ ↓): sempre valem; false = só ← →. */
  vertical?: boolean;
  /** Enter e Espaço ativam o item focado (padrão das abas). */
  ativarComEnterEEspaco?: boolean;
}

export function useSetas({ qtd, ativo, aoMover, ativarAoMover, desabilitados, vertical = true, ativarComEnterEEspaco }: OpcoesSetas) {
  const refs = useRef<any[]>([]);
  const [foco, setFoco] = useState<number>(-1);

  const habil = (i: number) => !(desabilitados && desabilitados[i]);
  const primeiroHabil = () => { for (let i = 0; i < qtd; i++) if (habil(i)) return i; return 0; };
  const proximo = (de: number, passo: 1 | -1) => {
    for (let k = 1; k <= qtd; k++) {
      const i = (de + passo * k + qtd * k) % qtd;
      if (habil(i)) return i;
    }
    return de;
  };

  const irPara = useCallback((i: number) => {
    try { refs.current[i]?.focus?.(); } catch { /* sem foco */ }
    setFoco(i);
    if (ativarAoMover) aoMover?.(i);
  }, [aoMover, ativarAoMover]);

  const propsDoItem = (i: number) => {
    const naEntrada = ativo >= 0 && habil(ativo) ? ativo : primeiroHabil();
    const roving = foco >= 0 && habil(foco) && ativarAoMover !== true ? foco : naEntrada;
    return {
      tabIndex: i === roving ? 0 : -1,
      innerRef: (el: any) => { refs.current[i] = el; },
      onFocus: () => setFoco(i),
      onKeyDown: (e: any) => {
        const k = e?.key;
        let alvo = -1;
        if (k === "ArrowRight" || (vertical && k === "ArrowDown")) alvo = proximo(i, 1);
        else if (k === "ArrowLeft" || (vertical && k === "ArrowUp")) alvo = proximo(i, -1);
        else if (k === "Home") alvo = primeiroHabil();
        else if (k === "End") { alvo = qtd - 1; while (alvo > 0 && !habil(alvo)) alvo--; }
        else if (ativarComEnterEEspaco && (k === "Enter" || k === " " || k === "Spacebar")) {
          e.preventDefault?.();
          aoMover?.(i);
          return;
        } else return;
        e.preventDefault?.();
        irPara(alvo);
      },
    };
  };

  return { propsDoItem, irPara };
}
