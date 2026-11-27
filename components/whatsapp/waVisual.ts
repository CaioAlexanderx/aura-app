// ============================================================
// waVisual — tokens compartilhados da linguagem de vidro do WhatsApp
//
// Cores (escuro e claro), fontes, gradientes, vidro (gradiente translúcido +
// borda clara + brilho interno no topo + blur com saturação, com fundo sólido
// de reserva), bolha "Como chega" e as keyframes do artboard (fio, pop,
// rise, brilho), só transform/opacity e com queda para prefers-reduced-motion.
// As Conversas importam daqui; os componentes de Configurações, de waVidro.
//
// No web, backdropFilter, gradientes e sombras vão por estilo web (`as any`),
// com fundo sólido de reserva. Fora do web (celular, jest) só vale o que o RN
// entende. Tema: o app troca de tema recarregando a página, então a escolha
// por IS_DARK_MODE no carregamento do módulo é segura.
// ============================================================
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { IS_DARK_MODE } from "@/constants/colors";

export const WEB = Platform.OS === "web";
export const ESCURO = IS_DARK_MODE;
// ── As quatro quedas (seção 10 da linguagem de vidro) ────────────────
// 1. sem backdrop-filter  2. transparência reduzida (ou economia de dados)
// 3. movimento reduzido   4. modo leve (guardado em sessionStorage "aura-lite"
//    ou aparelho fraco). Em todas: superfície sólida equivalente (mesma borda,
//    mesmo fio de luz, mesmo raio), sem desfoque e com texto legível.
function consulta(q: string): boolean {
  try { return !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia(q).matches); } catch { return false; }
}
let motivoLite: "pedido" | "guardado" | "aparelho" | "semblur" | "" = "";
function calcLite(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    const n: any = navigator;
    const css: any = (window as any).CSS;
    const semBlur = !(css?.supports?.("backdrop-filter", "blur(1px)") || css?.supports?.("-webkit-backdrop-filter", "blur(1px)"));
    const pedido = !!n?.connection?.saveData || consulta("(prefers-reduced-transparency: reduce)");
    const fraco = (typeof n?.deviceMemory === "number" && n.deviceMemory <= 4) || (typeof n?.hardwareConcurrency === "number" && n.hardwareConcurrency <= 4);
    let guardado: string | null = null;
    try { guardado = sessionStorage.getItem("aura-lite"); } catch { /* sem storage */ }
    motivoLite = pedido ? "pedido" : semBlur ? "semblur" : guardado ? "guardado" : fraco ? "aparelho" : "";
    return semBlur || pedido || guardado === "1" || (guardado !== "0" && fraco);
  } catch { return false; }
}
let liteAgora = calcLite();
const ouvintesLite = new Set<() => void>();
/** O modo leve de agora (pode mudar depois da medição). */
export function modoLeve(): boolean { return liteAgora; }
function guardaLite(v: string) { try { sessionStorage.setItem("aura-lite", v); } catch { /* ok */ } }
function mudaLite(on: boolean, salva: boolean) {
  if (salva) guardaLite(on ? "1" : "0");
  if (on === liteAgora) return;
  liteAgora = on;
  try {
    if (on) document.documentElement.setAttribute("data-lite", "1"); else document.documentElement.removeAttribute("data-lite");
  } catch { /* ok */ }
  ouvintesLite.forEach((f) => f());
}
try { if (typeof document !== "undefined" && liteAgora) document.documentElement.setAttribute("data-lite", "1"); } catch { /* ok */ }

/** Intervalo entre quadros que 75% dos quadros cumprem; null se não deu para medir (aba oculta). */
function amostra(cb: (q: number | null) => void) {
  let n = 0, last = 0, fim = false;
  const ds: number[] = [];
  const t0 = performance.now();
  const acaba = () => {
    if (fim) return;
    fim = true;
    if (ds.length < 40) return cb(null);
    ds.sort((a, b) => a - b);
    cb(ds[Math.floor(ds.length * 0.75)]);
  };
  const f = (t: number) => {
    if (fim) return;
    if (last) ds.push(t - last);
    last = t;
    if (++n < 90 && t - t0 < 2500 && !document.hidden) requestAnimationFrame(f); else acaba();
  };
  requestAnimationFrame(f);
  setTimeout(acaba, 3200);
}
/** Depois do carregamento a tela mede e corrige: aparelho que começou leve e mede bem sobe para o completo. */
function mede() {
  if (motivoLite === "pedido" || motivoLite === "guardado" || motivoLite === "semblur") return;
  amostra((q) => {
    if (q == null) return;
    if (liteAgora) {
      if (q > 25) return guardaLite("1");
      mudaLite(false, false);
      setTimeout(() => amostra((q2) => { if (q2 != null) mudaLite(q2 > 25, true); }), 400);
    } else if (q > 25) {
      setTimeout(() => amostra((q2) => { if (q2 != null && q2 > 25) mudaLite(true, true); }), 600);
    }
  });
}

/** As quedas na tela: assina o modo leve (a tela repinta se ele mudar) e mede o aparelho uma vez. */
export function useWaQuedas(): void {
  const [, forca] = useState(0);
  useEffect(() => {
    if (!WEB || typeof window === "undefined") return;
    const f = () => forca((x) => x + 1);
    ouvintesLite.add(f);
    const t = setTimeout(mede, 700);
    return () => { ouvintesLite.delete(f); clearTimeout(t); };
  }, []);
}export const SEM_MOVIMENTO = Platform.OS === "web" && consulta("(prefers-reduced-motion: reduce)");

/** Editor com os campos dentro do texto (div editável): só no navegador de verdade, não no jest (jsdom). */
export const EDITOR_INLINE = WEB && typeof process !== "undefined" && !(process as any).env?.JEST_WORKER_ID;

// ── Tokens ───────────────────────────────────────────────────────────
export const V = ESCURO
  ? {
      ink: "#f3efff", ink2: "rgba(226,219,255,.82)", ink3: "rgba(184,172,223,.86)",
      acc: "#c4b5fd", acc2: "#9a6cf7", gb: "rgba(255,255,255,.17)", hi: "rgba(255,255,255,.32)",
      solid: "rgba(22,14,52,.94)", ok: "#6ee7b7", warn: "#fcd34d", bad: "#fca5a5",
      rule: "rgba(255,255,255,.1)", fill: "rgba(255,255,255,.05)", fill2: "rgba(255,255,255,.08)",
      line: "rgba(255,255,255,.14)", lineOn: "rgba(196,181,253,.62)", on: "rgba(167,139,250,.2)", onTxt: "#ffffff",
      track: "rgba(255,255,255,.12)", capFree: "rgba(255,255,255,.06)", capFreeLine: "rgba(255,255,255,.28)",
      okBg: "rgba(110,231,183,.14)", warnBg: "rgba(252,211,77,.12)", badBg: "rgba(248,113,113,.14)",
      bolhaA: "rgba(139,92,246,.42)", bolhaB: "rgba(109,40,217,.3)", bolhaLine: "rgba(196,181,253,.32)",
      campoBg: "rgba(0,0,0,.22)", campoLine: "rgba(255,255,255,.14)",
      tokBg: "rgba(167,139,250,.28)", tokLine: "rgba(196,181,253,.55)", tokTxt: "#ffffff",
      glassA: "rgba(255,255,255,.13)", glassB: "rgba(255,255,255,.04)", dryA: "rgba(255,255,255,.08)", dryB: "rgba(255,255,255,.025)",
      dryLine: "rgba(255,255,255,.12)", avTxt: "#1b1338", chkLine: "rgba(255,255,255,.35)", numLine: "#c4b5fd",
      swOff: "rgba(255,255,255,.08)", swLine: "rgba(255,255,255,.22)", knob: "#e9e3ff", sombra: "rgba(3,0,20,.6)",
      spot: "rgba(139,92,246,.42)", bgTela: "#04020f",
    }
  : {
      ink: "#18172b", ink2: "#3b3461", ink3: "#3f3760",
      acc: "#4c1d95", acc2: "#6d28d9", gb: "rgba(109,40,217,.2)", hi: "#ffffff",
      solid: "rgba(250,249,255,.96)", ok: "#047857", warn: "#b45309", bad: "#b91c1c",
      rule: "rgba(24,23,43,.16)", fill: "rgba(109,40,217,.05)", fill2: "rgba(109,40,217,.08)",
      line: "rgba(109,40,217,.22)", lineOn: "rgba(109,40,217,.6)", on: "rgba(124,58,237,.14)", onTxt: "#3b1a8a",
      track: "rgba(24,23,43,.1)", capFree: "rgba(109,40,217,.05)", capFreeLine: "rgba(109,40,217,.35)",
      okBg: "rgba(5,150,105,.12)", warnBg: "rgba(217,119,6,.13)", badBg: "rgba(220,38,38,.1)",
      bolhaA: "rgba(167,139,250,.38)", bolhaB: "rgba(196,181,253,.28)", bolhaLine: "rgba(109,40,217,.26)",
      campoBg: "rgba(255,255,255,.7)", campoLine: "rgba(109,40,217,.22)",
      tokBg: "rgba(124,58,237,.16)", tokLine: "rgba(109,40,217,.45)", tokTxt: "#3b1a8a",
      glassA: "rgba(255,255,255,.9)", glassB: "rgba(255,255,255,.5)", dryA: "rgba(255,255,255,.6)", dryB: "rgba(255,255,255,.35)",
      dryLine: "rgba(109,40,217,.14)", avTxt: "#1b1338", chkLine: "rgba(109,40,217,.45)", numLine: "#6d28d9",
      swOff: "rgba(24,23,43,.1)", swLine: "rgba(109,40,217,.3)", knob: "#ffffff", sombra: "rgba(76,29,149,.22)",
      spot: "rgba(139,92,246,.22)", bgTela: "#e6e4f0",
    };

export const SANS: any = WEB ? '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif' : undefined;
export const MONO: any = WEB ? '"DM Mono", ui-monospace, monospace' : undefined;
export const SERIF: any = WEB ? '"Instrument Serif", Georgia, serif' : undefined;

export const GRAD_BTN = "linear-gradient(135deg,#8b5cf6,#7c3aed 45%,#6d28d9)";
export const GRAD_TITULO = ESCURO
  ? "linear-gradient(172deg,#fff 0%,#f3efff 24%,#cbc1ea 46%,#efeafc 56%,#a898d3 72%,#f3efff 88%,#c4b5fd 100%)"
  : "linear-gradient(172deg,#18172b 0%,#3b3461 58%,#6d28d9 100%)";

// ── Fontes: só enquanto a tela está aberta ───────────────────────────
const FONTES_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Instrument+Serif&display=swap";

export function useWaFontes(): void {
  useEffect(() => {
    if (!WEB || typeof document === "undefined") return;
    let el: HTMLLinkElement | null = null;
    try {
      if (!document.getElementById("wa-fontes-dm")) {
        el = document.createElement("link");
        el.id = "wa-fontes-dm";
        el.rel = "stylesheet";
        el.href = FONTES_HREF;
        document.head.appendChild(el);
      }
    } catch { /* sem fonte, cai na do sistema */ }
    return () => { try { el?.parentNode?.removeChild(el); } catch { /* ok */ } };
  }, []);
}

// ── Keyframes do artboard (só transform e opacity) ───────────────────
const KEYFRAMES = `
@keyframes wa-fio{0%{opacity:0;transform:scaleX(.2)}60%{opacity:1;transform:none}100%{opacity:.6;transform:none}}
@keyframes wa-pop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
@keyframes wa-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes wa-brilho{from{background-position:0 100%}to{background-position:0 0}}
@keyframes wa-cai{from{opacity:0;transform:translateY(-14px) scaleY(.6)}to{opacity:1;transform:none}}
@keyframes wa-pousa{from{opacity:0}to{opacity:1}}
@keyframes wa-traca{from{transform:scaleX(0)}to{transform:none}}
@keyframes wa-vai{0%{opacity:1;transform:none}100%{opacity:.25;transform:translateY(-6px)}}
html[data-lite] [data-wa-anim]{animation:none!important}
[data-wa-root] :focus{outline:none}
[data-wa-root] :focus-visible{outline:2px solid #c4b5fd!important;outline-offset:2px}
@media (prefers-reduced-motion:reduce){[data-wa-anim]{animation:none!important}[data-wa-anim] *{animation:none!important;transition:none!important}}
`;
const ANIMAR = WEB && !SEM_MOVIMENTO;
export const ANIM_RISE: any = ANIMAR ? { animation: "wa-rise .5s cubic-bezier(.2,.7,.2,1) backwards" } : {};
export const ANIM_POP: any = ANIMAR ? { animation: "wa-pop .38s cubic-bezier(.2,.8,.2,1) backwards" } : {};
export const ANIM_FIO: any = ANIMAR && !liteAgora ? { animation: "wa-fio .4s .8s cubic-bezier(.2,.8,.2,1) backwards" } : {};
export const ANIM_BRILHO: any = ANIMAR && !liteAgora ? { animation: "wa-brilho .6s .45s cubic-bezier(.4,0,.2,1) backwards" } : {};

/** Cápsula que cai (medidor das novidades), com atraso por posição. */
export function animCai(i: number): any { return ANIMAR ? { animation: `wa-cai .42s cubic-bezier(.2,.8,.2,1) backwards`, animationDelay: `${(0.3 + i * 0.04).toFixed(2)}s` } : {}; }
/** A luz que pousa no botão principal (halo). */
export const ANIM_POUSA: any = ANIMAR ? { animation: "wa-pousa .4s .9s ease-out backwards" } : {};
/** A linha do Crediário se traçando da esquerda. */
export const ANIM_TRACA: any = ANIMAR ? { transformOrigin: "left", animation: "wa-traca .7s .5s cubic-bezier(.2,.8,.2,1) backwards" } : {};
/** Cápsula do Venda+ que sai com o envio. */
export function animVai(i: number): any { return ANIMAR ? { animation: "wa-vai .6s cubic-bezier(.2,.8,.2,1) forwards", animationDelay: `${(i * 0.08).toFixed(2)}s` } : { opacity: 0.25 }; }

export function useWaKeyframes(): void {
  useEffect(() => {
    if (!WEB || typeof document === "undefined") return;
    let el: HTMLStyleElement | null = null;
    try {
      if (!document.getElementById("wa-keyframes")) {
        el = document.createElement("style");
        el.id = "wa-keyframes";
        el.textContent = KEYFRAMES;
        document.head.appendChild(el);
      }
    } catch { /* sem animação */ }
    return () => { try { el?.parentNode?.removeChild(el); } catch { /* ok */ } };
  }, []);
}

// ── Superfícies ──────────────────────────────────────────────────────
export type VarianteSuperficie = "glass" | "dry" | "solid";

/** Os quatro ingredientes do vidro: gradiente translúcido, borda clara, brilho interno no topo e blur com saturação. */
export function estiloSuperficie(v: VarianteSuperficie, raio: number): any {
  const base: any = { borderRadius: raio, borderWidth: 1 };
  if (v === "glass" && liteAgora) {
    // queda: a placa vira a superfície sólida equivalente (sem desfoque)
    return { ...base, borderColor: V.gb, backgroundColor: V.solid, ...(WEB ? { boxShadow: `0 30px 80px ${V.sombra}, inset 0 1px 0 ${V.hi}` } : {}) };
  }
  if (v === "glass") {
    return {
      ...base, borderColor: V.gb, backgroundColor: ESCURO ? "rgba(10,6,28,.35)" : "rgba(255,255,255,.82)",
      ...(WEB ? {
        backgroundImage: `linear-gradient(160deg,${V.glassA},${V.glassB})`,
        backdropFilter: "blur(24px) saturate(165%)", WebkitBackdropFilter: "blur(24px) saturate(165%)",
        boxShadow: `0 30px 80px ${V.sombra}, inset 0 1px 0 ${V.hi}`,
      } : {}),
    };
  }
  if (v === "dry") {
    return {
      ...base, borderColor: V.dryLine, backgroundColor: ESCURO ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.55)",
      ...(WEB ? {
        backgroundImage: `linear-gradient(160deg,${V.dryA},${V.dryB})`,
        boxShadow: `inset 0 1px 0 ${ESCURO ? "rgba(255,255,255,.16)" : "#fff"}`,
      } : {}),
    };
  }
  return {
    ...base, borderColor: V.gb, backgroundColor: V.solid,
    ...(WEB ? { boxShadow: `0 30px 80px ${ESCURO ? "rgba(3,0,20,.5)" : V.sombra}, inset 0 1px 0 ${V.hi}` } : {}),
  };
}

export function estiloBolha(): any {
  return {
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderRadius: 20, borderBottomRightRadius: 6,
    borderWidth: 1, borderColor: V.bolhaLine, backgroundColor: V.bolhaA, alignSelf: "flex-end", maxWidth: "94%",
    ...(WEB ? { backgroundImage: `linear-gradient(160deg,${V.bolhaA},${V.bolhaB})`, ...ANIM_POP } : {}),
  };
}
