// ============================================================
// guiaVisual — o visual dos guias do WhatsApp (artboards GuiaAnuncio,
// GuiaCentral, GuiaPassos e GuiaExecucao)
//
// Os balões, o menu e o spotlight são DOM puro (web), com classes `wag-*`
// injetadas aqui: o artboard usa :hover, :active e :focus-visible, que estilo
// em linha não alcança. Só transform e opacity animam. Quedas: movimento
// reduzido (a media query e o atributo data-lite do modo leve) tira toda
// animação e transição; o balão continua legível, só aparece de uma vez.
// O balão é sempre escuro, como nos artboards (que só existem no escuro): é
// um popover sobre o escurecimento, igual nos dois temas.
// ============================================================
import { useEffect } from "react";
import { Platform } from "react-native";
import { MONO, SANS } from "../waVisual";

export const WEB = Platform.OS === "web";
export { MONO, SANS };

export const G = {
  ink: "#f3efff",
  ink2: "rgba(226,219,255,.82)",
  ink3: "rgba(184,172,223,.86)",
  acc: "#c4b5fd",
  acc2: "#9a6cf7",
  ok: "#6ee7b7",
  warn: "#fcd34d",
  bad: "#fca5a5",
  dim: "rgba(4,2,15,.72)",
  dimMenu: "rgba(4,2,15,.6)",
  // fundo SÓLIDO (alfa 1): nada do que está atrás aparece por dentro do balão, nem no modo leve nem com blur desligado
  bolha: "linear-gradient(160deg,rgb(40,28,88),rgb(22,14,52))",
  bolhaMenu: "linear-gradient(160deg,rgb(40,28,88),rgb(22,14,52))",
  seta: "rgb(36,25,80)",
  borda: "rgba(255,255,255,.18)",
  sombra: "0 30px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.32)",
  btn: "linear-gradient(135deg,#8b5cf6,#7c3aed 45%,#6d28d9)",
  btnSombra: "0 0 0 1.5px rgba(236,228,255,.8), inset 0 1px 0 rgba(255,255,255,.45), 0 12px 28px rgba(60,20,140,.5)",
  furo: "0 0 0 2px #c4b5fd, 0 0 24px 4px rgba(167,139,250,.55)",
} as const;

export const Z = { guia: 10050 } as const;

export const CSS_GUIAS = `
.wag-root{font-family:${SANS};font-size:15px;line-height:1.5;color:${G.ink};-webkit-font-smoothing:antialiased}
.wag-root *,.wag-root *::before,.wag-root *::after{box-sizing:border-box}
.wag-root button{font:inherit;color:inherit}
.wag-meta{font-family:${MONO};font-weight:500;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${G.ink3}}
.wag-meta.acc{color:${G.acc}}
.wag-h{margin:0;font-weight:800;letter-spacing:-.03em;line-height:1.1;color:${G.ink}}
.wag-h em{font-style:normal;color:${G.acc2}}
.wag-p{margin:0;font-size:14px;line-height:1.5;color:${G.ink2}}
.wag-tip{position:fixed;border-radius:26px;padding:20px 22px 14px;background:${G.bolha};border:1px solid ${G.borda};box-shadow:${G.sombra};display:flex;flex-direction:column;gap:10px;outline:none;animation:wag-abre-b .38s .15s cubic-bezier(.2,.8,.2,1) backwards}
.wag-tip[data-pos="right"]{transform-origin:left center;animation-name:wag-abre-r}
.wag-tip[data-pos="left"]{transform-origin:right center;animation-name:wag-abre-l}
.wag-tip[data-pos="top"]{transform-origin:center bottom;animation-name:wag-abre-t}
.wag-tip[data-pos="bottom"]{transform-origin:center top;animation-name:wag-abre-b}
.wag-tip[data-pos="centro"],.wag-tip[data-pos="dentro"]{animation-name:wag-abre-c}
.wag-tip::after{content:"";position:absolute;left:12%;right:12%;top:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent);opacity:.6;pointer-events:none;animation:wag-fio .4s .55s cubic-bezier(.2,.8,.2,1) backwards}
.wag-seta{position:absolute;width:16px;height:16px;transform:rotate(45deg);background:${G.seta};pointer-events:none}
.wag-tip[data-pos="right"] .wag-seta{left:-8px;border-left:1px solid ${G.borda};border-bottom:1px solid ${G.borda}}
.wag-tip[data-pos="left"] .wag-seta{right:-8px;border-right:1px solid ${G.borda};border-top:1px solid ${G.borda}}
.wag-tip[data-pos="bottom"] .wag-seta{top:-8px;border-left:1px solid ${G.borda};border-top:1px solid ${G.borda}}
.wag-tip[data-pos="top"] .wag-seta{bottom:-8px;border-right:1px solid ${G.borda};border-bottom:1px solid ${G.borda}}
.wag-furo{position:fixed;pointer-events:none;box-shadow:0 0 0 9999px ${G.dim}, ${G.furo};animation:wag-acha .55s .1s cubic-bezier(.2,.8,.2,1) backwards}
.wag-furo-d{position:fixed;left:0;top:0;pointer-events:none;box-sizing:border-box;border-style:solid;border-color:#c4b5fd;transform-origin:0 0;box-shadow:0 0 0 6000px ${G.dim};transition:transform .45s cubic-bezier(.2,.8,.2,1);animation:wag-pousa .3s linear backwards}
.wag-halo{position:fixed;pointer-events:none;box-shadow:0 0 24px 4px rgba(167,139,250,.55);animation:wag-pousa .5s .25s ease-out backwards}
.wag-onda{position:fixed;pointer-events:none;border:2px solid rgba(196,181,253,.7);animation:wag-onda 1.2s .7s cubic-bezier(.2,.8,.2,1) 2 backwards}
.wag-dim{position:fixed;inset:0;background:${G.dim};animation:wag-pousa .2s linear backwards}
.wag-btn1{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:46px;padding:0 20px;border:0;border-radius:999px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;background:${G.btn};box-shadow:${G.btnSombra};transition:transform .08s ease-out}
.wag-btn1.seta{padding:0 8px 0 20px}
.wag-btn1:active{transform:scale(.98)}
.wag-btn1[disabled]{opacity:.4;cursor:not-allowed}
.wag-btn1.wa{background:linear-gradient(135deg,#34d399,#059669);box-shadow:0 0 0 1.5px rgba(220,255,240,.8), inset 0 1px 0 rgba(255,255,255,.45), 0 12px 28px rgba(5,80,60,.5)}
.wag-btn1 .ic{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:rgba(9,9,11,.28)}
.wag-lnk{display:inline-flex;align-items:center;min-height:44px;padding:0 8px;color:${G.acc};font-weight:600;font-size:14px;background:none;border:0;cursor:pointer;text-decoration:none;border-radius:10px}
.wag-lnk:hover{color:#e9e3ff}
.wag-lnk[disabled]{opacity:.4;cursor:not-allowed}
.wag-lnk.sutil{color:${G.ink3};font-weight:500}
.wag-pill{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:${G.ink};font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:transform .08s ease-out}
.wag-pill.on{background:rgba(167,139,250,.2);border-color:rgba(196,181,253,.62);color:#fff}
.wag-pill:active{transform:scale(.98)}
.wag-pill[disabled]{opacity:.5;cursor:not-allowed}
.wag-chk{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:${G.ink2};cursor:pointer;background:none;border:0;text-align:left;padding:4px 0;min-height:32px}
.wag-box{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:7px;border:1.5px solid rgba(255,255,255,.4);margin-top:1px;font-size:14px;font-weight:800;color:#1b1338}
.wag-box.on{background:#a78bfa;border-color:#e9e3ff}
.wag-spin{flex:none;width:20px;height:20px;border-radius:50%;border:2.5px solid rgba(255,255,255,.2);border-top-color:${G.acc};animation:wag-gira .9s linear infinite}
.wag-okc{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:rgba(110,231,183,.16);color:${G.ok};font-size:20px;font-weight:800;animation:wag-pop .4s cubic-bezier(.2,.8,.2,1) backwards}
.wag-dots{display:flex;gap:5px}
.wag-dots i{display:block;width:18px;height:5px;border-radius:999px;background:rgba(255,255,255,.18)}
.wag-dots i.on{background:${G.acc}}
.wag-pop{position:fixed;width:440px;border-radius:26px;padding:18px;background:${G.bolhaMenu};border:1px solid ${G.borda};box-shadow:${G.sombra};transform-origin:top right;animation:wag-abre-m .38s .15s cubic-bezier(.2,.8,.2,1) backwards;display:flex;flex-direction:column;gap:8px;outline:none}
.wag-g{display:flex;gap:14px;align-items:center;width:100%;padding:14px;border-radius:20px;border:1px solid transparent;background:none;text-align:left;cursor:pointer;color:inherit;animation:wag-sobe .4s cubic-bezier(.2,.8,.2,1) backwards;transition:transform .08s ease-out}
.wag-g:hover{border-color:rgba(196,181,253,.4)}
.wag-g:active{transform:scale(.99)}
.wag-g.first{background:rgba(167,139,250,.16);border-color:rgba(196,181,253,.5)}
.wag-n{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;font-weight:800;color:transparent;-webkit-text-stroke:1.3px ${G.acc};font-size:20px;border:1px solid rgba(196,181,253,.35)}
.wag-n.done{color:#1b1338;-webkit-text-stroke:0;background:${G.ok};border-color:${G.ok};font-size:16px}
.wag-root :focus-visible{outline:2px solid ${G.acc};outline-offset:2px}
@keyframes wag-pousa{from{opacity:0}to{opacity:1}}
@keyframes wag-acha{from{opacity:0;transform:scale(1.12)}to{opacity:1;transform:none}}
@keyframes wag-onda{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.18)}}
@keyframes wag-abre-r{from{opacity:0;transform:translateX(-10px) scale(.94)}to{opacity:1;transform:none}}
@keyframes wag-abre-l{from{opacity:0;transform:translateX(10px) scale(.94)}to{opacity:1;transform:none}}
@keyframes wag-abre-b{from{opacity:0;transform:translateY(-10px) scale(.94)}to{opacity:1;transform:none}}
@keyframes wag-abre-t{from{opacity:0;transform:translateY(10px) scale(.94)}to{opacity:1;transform:none}}
@keyframes wag-abre-c{from{opacity:0;transform:translateY(8px) scale(.95)}to{opacity:1;transform:none}}
@keyframes wag-abre-m{from{opacity:0;transform:translateY(-8px) scale(.94)}to{opacity:1;transform:none}}
@keyframes wag-fio{0%{opacity:0;transform:scaleX(.2)}60%{opacity:1;transform:none}100%{opacity:.6;transform:none}}
@keyframes wag-sobe{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes wag-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes wag-gira{to{transform:rotate(360deg)}}
@keyframes wag-seta-anda{0%,100%{transform:none}50%{transform:translateX(4px)}}
.wag-btn1 .ic svg{animation:wag-seta-anda .5s 1.1s ease-in-out backwards}
@media (prefers-reduced-motion:reduce){.wag-root *,.wag-root *::before,.wag-root *::after{animation:none!important;transition:none!important}.wag-spin{border-top-color:${G.acc}}}
html[data-lite] .wag-root *,html[data-lite] .wag-root *::before,html[data-lite] .wag-root *::after{animation:none!important;transition:none!important}
@media (max-width:600px){.wag-pop{width:calc(100vw - 32px)}.wag-tip{padding:18px 18px 12px}}
`;

/** Injeta o CSS dos guias enquanto algum guia está na tela. */
export function useGuiaCss(ativo: boolean = true): void {
  useEffect(() => {
    if (!ativo || !WEB || typeof document === "undefined") return;
    let el: HTMLStyleElement | null = null;
    try {
      if (!document.getElementById("wa-guias-css")) {
        el = document.createElement("style");
        el.id = "wa-guias-css";
        el.textContent = CSS_GUIAS;
        document.head.appendChild(el);
      }
    } catch { /* sem estilo: os balões ficam sem vidro, mas funcionam */ }
    return () => { try { el?.parentNode?.removeChild(el); } catch { /* ok */ } };
  }, [ativo]);
}

/** Quem pediu menos movimento recebe o salto direto até o alvo. */
export function movimentoReduzido(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch { return false; }
}

export interface Retangulo { x: number; y: number; w: number; h: number }

/** Onde o balão cai em relação ao alvo (o artboard põe à direita do menu; no celular, abaixo ou acima). */
export type LadoBalao = "right" | "left" | "bottom" | "top" | "centro" | "dentro";

export interface PosicaoBalao {
  lado: LadoBalao;
  left: number;
  top: number;
  largura: number;
  /** Posição da seta dentro do balão (px a partir do canto de referência). */
  seta: number;
}

const FOLGA = 16;
const DIST = 18;

function limita(v: number, a: number, b: number): number { return Math.max(a, Math.min(b, v)); }

/**
 * Calcula onde o balão fica. `furo` já inclui o respiro do spotlight.
 * Prefere a direita (artboard do anúncio) quando cabe, depois esquerda; no
 * celular (ou quando não cabe ao lado) vai abaixo ou acima, o lado com mais
 * espaço. Se o alvo é enorme e nada cabe, o balão fica dentro, no canto de baixo.
 */
export function posicionaBalao(furo: Retangulo | null, vw: number, vh: number, altura: number, larguraBase: number, opcoes?: { minLeft?: number }): PosicaoBalao {
  const largura = Math.min(larguraBase, vw - FOLGA * 2);
  if (!furo) {
    return { lado: "centro", left: Math.round((vw - largura) / 2), top: Math.round(Math.max(FOLGA, (vh - altura) / 2)), largura, seta: 0 };
  }
  const cx = furo.x + furo.w / 2;
  const cy = furo.y + furo.h / 2;
  const espacoD = vw - (furo.x + furo.w) - FOLGA;
  const espacoE = furo.x - FOLGA;
  const espacoB = vh - (furo.y + furo.h) - FOLGA;
  const espacoT = furo.y - FOLGA;
  const larguraLado = largura + DIST;
  const estreito = vw <= 600;

  const vertical = (lado: "bottom" | "top"): PosicaoBalao => {
    const left = limita(cx - largura / 2, FOLGA, vw - largura - FOLGA);
    const top = lado === "bottom" ? furo.y + furo.h + DIST : furo.y - DIST - altura;
    return { lado, left: Math.round(left), top: Math.round(top), largura, seta: Math.round(limita(cx - left - 8, 24, largura - 40)) };
  };
  const minLeft = opcoes?.minLeft;
  const horizontal = (lado: "right" | "left", larg: number = largura): PosicaoBalao => {
    const largura = larg;
    const left = lado === "right" ? furo.x + furo.w + DIST : furo.x - DIST - largura;
    const top = limita(cy - 42, FOLGA, Math.max(FOLGA, vh - altura - FOLGA));
    return { lado, left: Math.round(left), top: Math.round(top), largura, seta: Math.round(limita(cy - top - 8, 22, Math.max(22, altura - 38))) };
  };

  if (!estreito) {
    if (espacoD >= larguraLado) return horizontal("right");
    if (espacoE >= larguraLado && (minLeft == null || furo.x - DIST - largura >= minLeft)) return horizontal("left");
    // com `minLeft` (não cobrir o menu lateral) o balão encolhe para caber ao lado, até 280 px
    if (minLeft != null) {
      const cabe = furo.x - DIST - minLeft;
      if (cabe >= 280) return horizontal("left", Math.min(largura, Math.floor(cabe)));
    }
  }
  if (espacoB >= altura + DIST) return vertical("bottom");
  if (espacoT >= altura + DIST) return vertical("top");
  if (estreito) {
    if (espacoD >= larguraLado) return horizontal("right");
    if (espacoE >= larguraLado) return horizontal("left");
  }
  return { lado: "dentro", left: Math.round(vw - largura - FOLGA), top: Math.round(Math.max(FOLGA, vh - altura - FOLGA)), largura, seta: 0 };
}
