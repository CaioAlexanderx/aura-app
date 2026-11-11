// ============================================================
// AURA. — Visual do checkout (p-104, 11/11/2026)
//
// O checkout na identidade da porta de entrada e do site novo (mock v5
// aprovado pelo Caio em 11/11). Nada de sistema de design paralelo:
//   · fundos, texto, bordas e violetas são os `Colors` do tema do app
//     (claro e escuro, o tema que a pessoa escolheu);
//   · o verde de acerto e o pêssego de aviso são os do palco da porta de
//     entrada (`Stage.okText`, `Stage.okMetal`, `Stage.peach`) no escuro e a
//     versão clara aprovada no mock no tema claro;
//   · fontes: Instrument Serif, DM Sans e DM Mono, as mesmas que o painel e
//     o login já carregam (`Fonts`, link "aura-fonts");
//   · o botão primário é o degradê do mock, com a elevação de 2 px no hover
//     só onde existe ponteiro fino — no toque nada depende de passar o dedo
//     (regra 7 do CLAUDE.md). Mesmo mecanismo do login: CSS injetado uma vez
//     e ganchos `data-*` (o RNW repassa `dataSet`, não `className`).
// ============================================================
import { Platform } from "react-native";
import { Colors, Stage, IS_DARK_MODE } from "@/constants/colors";

const isWeb = Platform.OS === "web";

/** Os quatro tons que o tema do app não tem: acerto, aviso e o brilho violeta. */
export const Ck = {
  ok: IS_DARK_MODE ? Stage.okText : "#1f6b4f",
  okD: IS_DARK_MODE ? "rgba(143,211,180,0.12)" : "rgba(31,107,79,0.10)",
  okMetal: IS_DARK_MODE ? Stage.okMetal : "#1f6b4f",
  warn: IS_DARK_MODE ? Stage.peach : "#8a4a1a",
  warnD: IS_DARK_MODE ? Stage.peachD : "rgba(138,74,26,0.08)",
  warnLine: IS_DARK_MODE ? "rgba(240,191,154,0.35)" : "rgba(138,74,26,0.30)",
  glow: IS_DARK_MODE ? "rgba(124,58,237,0.28)" : "rgba(124,58,237,0.16)",
  /** Vidro violeta do botão secundário (mock: .10 de fundo, .25 de borda). */
  vidro: "rgba(124,58,237,0.10)",
  vidroBorda: "rgba(124,58,237,0.25)",
  vidroAtivo: "rgba(124,58,237,0.45)",
} as const;

/** Gancho de CSS para o elemento (só na web; no nativo não faz nada). */
export function marca(chave: "ck-cta" | "ck-vidro" | "ck-plano" | "ck-palco" | "ck-link"): any {
  return isWeb ? { dataSet: { [chave]: "1" } } : {};
}

/** Estilo que só existe na web (sombra em CSS, cursor). */
export function soWeb(estilo: Record<string, any>): any {
  return isWeb ? estilo : {};
}

export const CHECKOUT_CSS_ID = "aura-checkout-css";

// Seletor dobrado ([x][x]) para vencer a classe atômica do RNW sem !important.
export const CHECKOUT_CSS = `
[data-ck-palco][data-ck-palco] { background-image: radial-gradient(70% 320px at 50% 0%, ${Ck.glow}, transparent 70%); background-repeat: no-repeat; }
[data-ck-cta][data-ck-cta] { background-image: linear-gradient(135deg, #7c3aed, #6d28d9); box-shadow: 0 8px 24px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.18); transition: transform .22s cubic-bezier(0.4,0,0.2,1), box-shadow .22s cubic-bezier(0.4,0,0.2,1); cursor: pointer; }
[data-ck-cta][aria-disabled="true"] { box-shadow: none; cursor: not-allowed; }
[data-ck-cta][data-ck-cta]:active { transform: translateY(0) scale(0.98); }
[data-ck-vidro][data-ck-vidro] { -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); transition: transform .22s cubic-bezier(0.4,0,0.2,1), background-color .22s, border-color .22s; cursor: pointer; }
[data-ck-plano][data-ck-plano] { transition: border-color .2s, box-shadow .2s; cursor: pointer; }
[data-ck-link][data-ck-link] { cursor: pointer; }
@media (hover: hover) and (pointer: fine) {
  [data-ck-cta][data-ck-cta]:not([aria-disabled="true"]):hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.22); background-image: linear-gradient(135deg, #8b5cf6, #7c3aed); }
  [data-ck-vidro][data-ck-vidro]:not([aria-disabled="true"]):hover { transform: translateY(-2px); border-color: ${Ck.vidroAtivo}; }
  [data-ck-plano][data-ck-plano]:hover { border-color: ${Colors.violet2}; }
  [data-ck-link][data-ck-link]:hover { text-decoration: underline; text-underline-offset: 3px; }
}
@media (prefers-reduced-motion: reduce) {
  [data-ck-cta][data-ck-cta], [data-ck-vidro][data-ck-vidro], [data-ck-plano][data-ck-plano] { transition: none; }
  [data-ck-cta][data-ck-cta]:hover, [data-ck-vidro][data-ck-vidro]:hover, [data-ck-cta][data-ck-cta]:active { transform: none; }
}
`;

/** Injeta o CSS do checkout uma vez (web). */
export function injetarCssDoCheckout(): void {
  if (!isWeb || typeof document === "undefined") return;
  try {
    if (document.getElementById(CHECKOUT_CSS_ID)) return;
    const st = document.createElement("style");
    st.id = CHECKOUT_CSS_ID;
    st.textContent = CHECKOUT_CSS;
    document.head.appendChild(st);
  } catch { /* sem CSS o checkout continua funcional, só sem o hover */ }
}
