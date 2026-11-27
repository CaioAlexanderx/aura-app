// ============================================================
// Conversas — teclado no PC (setas, Enter, Esc, foco).
//
// No RN Web o elemento é o do DOM: o container recebe `onKeyDown` e anda pelos
// itens com `querySelectorAll`, sem estado extra. Padrões WAI-ARIA:
//   - listbox/option (lista de conversas): ↑ ↓ andam, Home/End vão às pontas,
//     Enter ou espaço abrem; tabindex móvel (só o item ativo entra no Tab);
//   - radiogroup (filtros, convites): setas mudam a seleção (o foco anda e o
//     item é clicado), com volta ao início no fim;
//   - painéis da barra de ações: ↑ ↓ andam entre as opções, Esc fecha e devolve
//     o foco ao botão que abriu.
// Fora do navegador (jest, celular nativo) o handler não acha elementos e não faz nada.
// ============================================================

export interface OpcoesSetas {
  /** Seletor dos itens dentro do container (`e.currentTarget`). */
  selector: string;
  /** Radiogroup: foca e clica (seleciona). */
  seleciona?: boolean;
  /** No fim volta ao começo (radiogroup); na lista, para na ponta. */
  circular?: boolean;
  /** Radiogroup horizontal: ← → também valem (↑ ↓ sempre valem). */
  horizontal?: boolean;
}

type EventoTeclado = { key?: string; currentTarget?: any; preventDefault?: () => void; stopPropagation?: () => void };

/** Move o foco pelos itens. Devolve true se tratou a tecla. */
export function tratarSetas(e: EventoTeclado, o: OpcoesSetas): boolean {
  const k = e?.key;
  if (!k) return false;
  let passo = 0;
  let ponta: "ini" | "fim" | null = null;
  if (k === "ArrowDown" || (o.horizontal && k === "ArrowRight")) passo = 1;
  else if (k === "ArrowUp" || (o.horizontal && k === "ArrowLeft")) passo = -1;
  else if (k === "Home") ponta = "ini";
  else if (k === "End") ponta = "fim";
  else return false;

  const raiz = e.currentTarget;
  if (!raiz || typeof raiz.querySelectorAll !== "function") return false;
  const itens: any[] = Array.from(raiz.querySelectorAll(o.selector));
  if (!itens.length) return false;
  const ativo = typeof document !== "undefined" ? document.activeElement : null;
  const atual = itens.findIndex((el) => el === ativo || (typeof el.contains === "function" && ativo && el.contains(ativo)));

  let alvo: number;
  if (ponta === "ini") alvo = 0;
  else if (ponta === "fim") alvo = itens.length - 1;
  else if (atual < 0) alvo = passo > 0 ? 0 : itens.length - 1;
  else {
    alvo = atual + passo;
    if (alvo < 0) alvo = o.circular ? itens.length - 1 : 0;
    if (alvo >= itens.length) alvo = o.circular ? 0 : itens.length - 1;
  }
  e.preventDefault?.();
  const el = itens[alvo];
  el.focus?.();
  if (o.seleciona && alvo !== atual) el.click?.();
  return true;
}

/** Devolve o foco ao botão que abriu o painel (pelo testID). */
export function focarPorTestID(testID: string): void {
  if (typeof document === "undefined") return;
  try { (document.querySelector(`[data-testid="${testID}"]`) as any)?.focus?.(); } catch { /* sem DOM */ }
}

/** Foca o primeiro campo ou opção do painel recém-aberto. */
export function focarPrimeiro(raiz: any, selector = '[data-opcao="1"], input'): void {
  try { raiz?.querySelector?.(selector)?.focus?.(); } catch { /* sem DOM */ }
}

/** Handler de um painel flutuante: Esc fecha (e devolve o foco), ↑ ↓ andam pelas opções. */
export function aoTeclarNoPainel(e: EventoTeclado, fechar: (() => void) | undefined, gatilho: string | undefined): void {
  if (e?.key === "Escape") {
    e.preventDefault?.();
    e.stopPropagation?.();
    fechar?.();
    if (gatilho) setTimeout(() => focarPorTestID(gatilho), 0);
    return;
  }
  if (e?.key === "Home" || e?.key === "End") return; // dentro de um campo, Home/End são do texto
  tratarSetas(e, { selector: '[data-opcao="1"], input', circular: true });
}
