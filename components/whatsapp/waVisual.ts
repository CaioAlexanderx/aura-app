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
import { useEffect } from "react";
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
function calcLite(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    const n: any = navigator;
    const css: any = (window as any).CSS;
    const semBlur = !(css?.supports?.("backdrop-filter", "blur(1px)") || css?.supports?.("-webkit-backdrop-filter", "blur(1px)"));
    const pedido = !!n?.connection?.saveData || consulta("(prefers-reduced-transparency: reduce)");
    const fraco = typeof n?.deviceMemory === "number" && n.deviceMemory <= 4;
    let guardado: string | null = null;
    try { guardado = sessionStorage.getItem("aura-lite"); } catch { /* sem storage */ }
    return semBlur || pedido || guardado === "1" || (guardado !== "0" && fraco);
  } catch { return false; }
}
export const LITE = calcLite();
export const SEM_MOVIMENTO = Platform.OS === "web" && consulta("(prefers-reduced-motion: reduce)");

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
      spot: "rgba(139,92,246,.42)",
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
      spot: "rgba(139,92,246,.22)",
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
@keyframes wa-brilho{from{opacity:.4}to{opacity:1}}
@media (prefers-reduced-motion:reduce){[data-wa-anim]{animation:none!important}[data-wa-anim] *{animation:none!important;transition:none!important}}
`;
const ANIMAR = WEB && !SEM_MOVIMENTO;
export const ANIM_RISE: any = ANIMAR ? { animation: "wa-rise .5s cubic-bezier(.2,.7,.2,1) backwards" } : {};
export const ANIM_POP: any = ANIMAR ? { animation: "wa-pop .38s cubic-bezier(.2,.8,.2,1) backwards" } : {};
export const ANIM_FIO: any = ANIMAR && !LITE ? { animation: "wa-fio .4s .8s cubic-bezier(.2,.8,.2,1) backwards" } : {};
export const ANIM_BRILHO: any = ANIMAR && !LITE ? { animation: "wa-brilho .6s .45s cubic-bezier(.4,0,.2,1) backwards" } : {};

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
  if (v === "glass" && LITE) {
    // queda: a placa vira a superfície sólida equivalente (sem desfoque)
    return { ...base, borderColor: V.gb, backgroundColor: V.solid, ...(WEB ? { boxShadow: `0 30px 80px ${V.sombra}, inset 0 1px 0 ${V.hi}` } : {}) };
  }
  if (v === "glass") {
    return {
      ...base, borderColor: V.gb, backgroundColor: ESCURO ? "rgba(34,24,72,.78)" : "rgba(255,255,255,.82)",
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
