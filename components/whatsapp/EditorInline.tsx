// ============================================================
// EditorInline — o campo de texto do Editor com os campos DENTRO do texto
//
// No mockup (artboard Editor) os campos {Nome}, {Parcela}... aparecem como
// pílulas roxas no meio da frase, e o trecho de oferta fica sublinhado em
// amarelo. Um TextInput não desenha isso; no web usamos um div editável.
//
// O valor continua sendo o texto simples com {Campo} (o mesmo que o servidor
// e `validar` leem). A conversão é só de ida e volta: texto -> DOM (pílulas
// que não se editam por dentro, apagam inteiras com Backspace) e DOM -> texto.
// Só existe no web; no celular e nos testes o Editor usa o TextInput.
// ============================================================
import React, { useEffect, useRef } from "react";
import { segmentos } from "./waMensagem";
import { V } from "./waVidro";

interface Props {
  valor: string;
  /** Posição do cursor (em letras do texto simples) para onde voltar depois de remontar. */
  cursor: number;
  travado?: boolean;
  /** Trecho a sublinhar em amarelo (a oferta num aviso). */
  destaque?: string | null;
  onChange: (texto: string) => void;
  onSel: (inicio: number, fim: number) => void;
  testID?: string;
}

const ESTILO_PILULA =
  `display:inline-flex;align-items:center;height:28px;margin:0 2px;padding:0 10px;border-radius:999px;` +
  `vertical-align:baseline;font-size:14px;font-weight:600;line-height:1;user-select:none;cursor:default;`;

/** DOM -> texto simples ({Campo} para pílulas, \n para quebras). */
export function serializar(no: Node): string {
  let out = "";
  no.childNodes.forEach((n) => {
    if (n.nodeType === 3) { out += (n as Text).data; return; }
    const el = n as HTMLElement;
    if (el.nodeName === "BR") { out += "\n"; return; }
    if (el.dataset && el.dataset.campo) { out += `{${el.dataset.campo}}`; return; }
    const interno = serializar(el);
    // Enter em div editável cria blocos: cada bloco novo vira uma quebra.
    if (el.nodeName === "DIV" && out && !out.endsWith("\n")) out += "\n";
    out += interno;
  });
  return out;
}

function montar(raiz: HTMLElement, texto: string, destaque?: string | null) {
  raiz.textContent = "";
  const texto2nos = (trecho: string, bad: boolean) => {
    const partes = trecho.split("\n");
    partes.forEach((p, i) => {
      if (i > 0) raiz.appendChild(document.createElement("br"));
      if (!p) return;
      if (bad) {
        const sp = document.createElement("span");
        sp.setAttribute("style", `border-radius:6px;padding:1px 3px;background:rgba(252,211,77,.18);box-shadow:inset 0 -2px 0 ${V.warn};`);
        sp.textContent = p;
        raiz.appendChild(sp);
      } else {
        raiz.appendChild(document.createTextNode(p));
      }
    });
  };
  segmentos(texto).forEach((g) => {
    if (g.campo) {
      const sp = document.createElement("span");
      sp.setAttribute("contenteditable", "false");
      sp.setAttribute("data-campo", g.v);
      sp.setAttribute("style", ESTILO_PILULA + `color:${V.tokTxt};background:${V.tokBg};border:1px solid ${V.tokLine};`);
      sp.textContent = g.v;
      raiz.appendChild(sp);
      return;
    }
    const i = destaque ? g.v.indexOf(destaque) : -1;
    if (destaque && i >= 0) {
      texto2nos(g.v.slice(0, i), false);
      texto2nos(destaque, true);
      texto2nos(g.v.slice(i + destaque.length), false);
    } else {
      texto2nos(g.v, false);
    }
  });
}

/** Quantas letras do texto simples ficam antes do ponto (nó, deslocamento). */
function medirAte(raiz: HTMLElement, no: Node, desloc: number): number {
  try {
    const r = document.createRange();
    r.selectNodeContents(raiz);
    r.setEnd(no, desloc);
    const frag = document.createElement("div");
    frag.appendChild(r.cloneContents());
    return serializar(frag).length;
  } catch {
    return 0;
  }
}

function colocarCursor(raiz: HTMLElement, pos: number) {
  const sel = window.getSelection?.();
  if (!sel) return;
  let resto = pos;
  const r = document.createRange();
  let feito = false;
  const filhos = Array.from(raiz.childNodes);
  for (const n of filhos) {
    let len = 0;
    if (n.nodeType === 3) len = (n as Text).data.length;
    else if (n.nodeName === "BR") len = 1;
    else if ((n as HTMLElement).dataset?.campo) len = (n as HTMLElement).dataset.campo!.length + 2;
    else len = serializar(n).length;
    if (resto <= len) {
      if (n.nodeType === 3) r.setStart(n, Math.min(resto, len));
      else r.setStartAfter(n);
      feito = true;
      break;
    }
    resto -= len;
  }
  if (!feito) { r.selectNodeContents(raiz); r.collapse(false); } else { r.collapse(true); }
  sel.removeAllRanges();
  sel.addRange(r);
}

export function EditorInline({ valor, cursor, travado, destaque, onChange, onSel, testID }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const ultimoDestaque = useRef<string | null | undefined>(undefined);

  // Texto de fora mudou (inserir campo, corrigir, voltar ao da Aura): remonta e devolve o cursor.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const igual = serializar(el) === valor;
    if (igual && ultimoDestaque.current === destaque) return;
    const tinhaFoco = document.activeElement === el;
    montar(el, valor, destaque);
    ultimoDestaque.current = destaque;
    if (!igual || tinhaFoco) {
      el.focus?.();
      colocarCursor(el, Math.max(0, Math.min(cursor, valor.length)));
    }
  }, [valor, destaque]); // eslint-disable-line react-hooks/exhaustive-deps

  // O cursor da lojista, para o "+ Nome" entrar onde ela parou.
  useEffect(() => {
    const aoMudar = () => {
      const el = ref.current;
      const s = window.getSelection?.();
      if (!el || !s || s.rangeCount === 0 || !el.contains(s.anchorNode)) return;
      const a = medirAte(el, s.anchorNode!, s.anchorOffset);
      const b = medirAte(el, s.focusNode!, s.focusOffset);
      onSel(Math.min(a, b), Math.max(a, b));
    };
    document.addEventListener("selectionchange", aoMudar);
    return () => document.removeEventListener("selectionchange", aoMudar);
  }, [onSel]);

  return React.createElement("div", {
    ref: (el: HTMLElement | null) => {
      ref.current = el;
      if (el && !el.firstChild && valor) { montar(el, valor, destaque); ultimoDestaque.current = destaque; }
    },
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": "Texto da mensagem",
    "data-testid": testID,
    contentEditable: !travado,
    suppressContentEditableWarning: true,
    spellCheck: true,
    onInput: (e: any) => onChange(serializar(e.currentTarget)),
    onKeyDown: (e: any) => {
      if (e.key === "Enter") { e.preventDefault(); document.execCommand?.("insertLineBreak"); }
    },
    onPaste: (e: any) => {
      // Cola só texto: nada de HTML de fora dentro da mensagem.
      e.preventDefault();
      const txt = e.clipboardData?.getData("text/plain") || "";
      document.execCommand?.("insertText", false, txt);
    },
    style: {
      minHeight: 170, padding: "18px 20px", borderRadius: 22, fontSize: 17, lineHeight: "34px", outline: "none",
      color: V.ink, background: V.campoBg, border: `1px solid ${V.campoLine}`, whiteSpace: "pre-wrap", wordBreak: "break-word",
      fontFamily: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif', opacity: travado ? 0.6 : 1,
    },
  });
}
