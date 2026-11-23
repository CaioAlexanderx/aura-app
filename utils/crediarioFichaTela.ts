// ============================================================
// Ficha do crediário em tela cheia — regras puras (F3, 23/11/2026)
//
// Mockup aprovado pelo Caio (ficha-crediario/mockup-publicado.html, seção a
// e d): na tela larga a ficha deixa de ser janela por cima da lista e ocupa
// a área de conteúdo, como o Caixa. Aqui ficam as decisões que não dependem
// de React — testadas em __tests__/crediarioFichaTela.test.ts:
//  - qual casca usar pela largura ÚTIL (a área ao lado do menu do app, não a
//    janela: 1366 px com o menu aberto deixam ~1086 px);
//  - quem é a cliente de cima e a de baixo na lista (↑ ↓ e ‹ ›);
//  - o que cada tecla faz (Esc fecha o painel antes da ficha; setas só fora
//    de campo de texto e sem outra janela aberta por cima).
// ============================================================

/** Abaixo disto (largura da janela) o app está no layout de celular. */
export const JANELA_DO_CELULAR = 768;
/** Largura útil mínima para três colunas (lista 224 + centro ~520 + direita 340). */
export const LARGURA_UTIL_LARGA = 1080;
/** Largura útil mínima para duas colunas (centro ~380 + direita 320). */
export const LARGURA_UTIL_MEDIA = 700;

export type LayoutDaFicha = "janela" | "media" | "larga";

/**
 * Casca da ficha. `janela` = o modal de sempre (celular e telas estreitas até
 * a F5); `media` = duas colunas, sem a lista; `larga` = três colunas.
 * O app troca para o layout de celular em 768 px ou menos (_layout.tsx), por
 * isso o corte da janela é "maior que 768".
 */
export function layoutDaFicha(larguraUtil: number, larguraDaJanela: number): LayoutDaFicha {
  if (!(larguraDaJanela > JANELA_DO_CELULAR)) return "janela";
  if (larguraUtil >= LARGURA_UTIL_LARGA) return "larga";
  if (larguraUtil >= LARGURA_UTIL_MEDIA) return "media";
  return "janela";
}

/**
 * A cliente ao lado na lista. `delta` 1 = a de baixo, -1 = a de cima. Nas
 * pontas não dá a volta (null). Se a atual não está na lista (filtro mudou,
 * ficha aberta pelo endereço), qualquer seta leva à primeira.
 */
export function vizinhaNaLista(ids: string[], atual: string | null, delta: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const i = atual ? ids.indexOf(atual) : -1;
  if (i < 0) return ids[0];
  const j = i + delta;
  return j >= 0 && j < ids.length ? ids[j] : null;
}

/** "3 de 38". posicao 0 = a cliente não está na lista. */
export function posicaoNaLista(ids: string[], atual: string | null): { posicao: number; total: number } {
  const i = atual ? ids.indexOf(atual) : -1;
  return { posicao: i + 1, total: ids.length };
}

export type AcaoDaTecla = "fechar-painel" | "fechar-ficha" | "anterior" | "proxima" | null;

export type TeclaDaFicha = {
  key: string;
  /** Foco num campo de texto (input, textarea, contenteditable). */
  alvoEditavel: boolean;
  /** Outra janela (Modal) aberta por cima: ela cuida das próprias teclas. */
  dialogoAberto: boolean;
  /** Receber, Mudar as parcelas, Limite e regras… aberto na coluna da direita. */
  painelAberto: boolean;
  /** Ctrl, Alt ou Cmd: atalho de outra coisa (navegador, Caixa). */
  comModificador: boolean;
  /** Tecla segurada (auto-repetição): as setas não disparam em rajada. */
  repetida?: boolean;
};

export function acaoDaTecla(t: TeclaDaFicha): AcaoDaTecla {
  if (t.dialogoAberto || t.comModificador) return null;
  // Dentro de campo de texto nada fecha nem troca: o Esc é do campo, e as
  // setas andam no texto.
  if (t.alvoEditavel) return null;
  if (t.key === "Escape") return t.painelAberto ? "fechar-painel" : "fechar-ficha";
  // Setas: nunca com painel aberto (trocar de cliente levaria o valor que ela
  // está digitando) nem segurando a tecla.
  if (t.painelAberto || t.repetida) return null;
  if (t.key === "ArrowUp") return "anterior";
  if (t.key === "ArrowDown") return "proxima";
  return null;
}

/** O elemento com foco é um campo de texto? (aceita objeto simples nos testes) */
export function ehCampoEditavel(el: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = String(el.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
