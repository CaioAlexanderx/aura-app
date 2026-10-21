// ============================================================
// CSS do palco da porta de entrada (tq-67) — injetado uma vez, só na web.
//
// Substitui os cinco blocos "aura-login-v2-css" que login, cadastro,
// esqueci/redefinir senha e confirmação de e-mail injetavam cada um (com
// grade, partículas e anéis). Fonte visual: mockup "Porta de entrada v4".
//
// Ganchos em componentes React Native vão por `dataSet` (vira data-* no
// DOM): o react-native-web 0.19 NÃO repassa `className` para View/Text/
// TextInput, então `[data-as-*]` é o único seletor que chega neles. O
// atributo vai repetido ([data-x][data-x]) para a especificidade (0,2,0)
// vencer a classe atômica do RNW sem depender da ordem das folhas.
//
// Orçamento de desempenho: `.as-static` (reduzir movimento, até 4 núcleos
// ou até 2 GB) tira TODA animação do palco; `.as-paused` (aba oculta ou
// janela fora de foco) congela as animações onde estão. As regras miram só
// os elementos do palco — o ActivityIndicator do botão continua girando.
// ============================================================
import { Stage } from "@/constants/colors";

export const AUTH_STAGE_CSS_ID = "aura-auth-stage-css";

// Em loop (pausam com a aba oculta). A entrada do cartão (as-cardIn) fica
// de fora da pausa: pausada no primeiro quadro, o cartão nasceria invisível
// numa aba aberta em segundo plano.
const EM_LOOP = [".as-blob", ".as-card::before", ".as-orb", ".as-orb .as-arc", ".as-orb .as-core"];
const TODOS = [...EM_LOOP, ".as-card"];
const sob = (raiz: string, lista: string[]) => lista.map((s) => raiz + " " + s).join(", ");

export const AUTH_STAGE_CSS = `
@property --as-rim { syntax: '<angle>'; inherits: false; initial-value: 0deg; }

.aura-stage { position: relative; width: 100%; height: 100vh; height: 100dvh; overflow: hidden; isolation: isolate;
  color: ${Stage.ink}; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(ellipse 40% 34% at 50% 48%, rgba(139,92,246,0.26) 0%, rgba(124,58,237,0.10) 45%, transparent 72%),
    radial-gradient(ellipse 60% 54% at 0% 100%, #010005 0%, rgba(1,0,5,0.9) 32%, transparent 66%),
    radial-gradient(ellipse 60% 54% at 100% 0%, #010005 0%, rgba(1,0,5,0.9) 32%, transparent 66%),
    radial-gradient(ellipse 60% 50% at 14% 10%, rgba(196,181,253,0.06) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 88% 92%, rgba(91,33,182,0.16) 0%, transparent 60%),
    radial-gradient(ellipse 90% 70% at 50% 50%, #0b0724 0%, ${Stage.bg} 72%);
  background-color: ${Stage.bg}; }

/* luz: duas massas de violeta */
.as-aura { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.as-blob { position: absolute; border-radius: 50%; filter: blur(100px); mix-blend-mode: screen; will-change: transform; }
.as-b1 { width: 720px; height: 720px; left: -12%; top: -28%; background: radial-gradient(circle, rgba(139,92,246,0.42), rgba(124,58,237,0) 70%); animation: as-drift1 24s ease-in-out infinite alternate; }
.as-b2 { width: 640px; height: 640px; right: -16%; bottom: -30%; background: radial-gradient(circle, rgba(91,33,182,0.48), rgba(59,7,100,0) 70%); animation: as-drift2 28s ease-in-out infinite alternate; }
@keyframes as-drift1 { to { translate: 80px 50px; } }
@keyframes as-drift2 { to { translate: -70px -40px; } }

/* espiral + ondas (canvas) e grão: nunca capturam clique */
.as-waves { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; display: block; }
.as-grain { position: absolute; inset: 0; pointer-events: none; z-index: 2; opacity: 0.05; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }

/* rolagem: o palco fica parado e só o conteúdo rola */
.as-scroll { position: absolute; inset: 0; z-index: 3; overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.as-center { min-height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 24px 0; }

/* cartão de vidro com aro de prata e violeta */
.as-scene { position: relative; width: min(448px, calc(100% - 32px)); padding-top: 46px; box-sizing: border-box; }
/* coluna flex como uma View do RN: sem isso o <Text> do RNW, fora de uma View,
   fica display:inline (título e subtítulo na mesma linha, sem text-align) */
.as-card { position: relative; display: flex; flex-direction: column; align-items: stretch; border-radius: 24px; padding: 54px 26px 24px; box-sizing: border-box; animation: as-cardIn 800ms cubic-bezier(0.16, 1, 0.3, 1) both;
  background: linear-gradient(168deg, rgba(196,181,253,0.15) 0%, rgba(124,58,237,0.10) 22%, rgba(16,10,40,0.70) 48%, rgba(7,4,22,0.84) 100%);
  backdrop-filter: blur(22px) saturate(140%); -webkit-backdrop-filter: blur(22px) saturate(140%);
  box-shadow: 0 34px 90px rgba(3,0,20,0.70), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.35); }
.as-card::before { content: ""; position: absolute; inset: -2.5px; border-radius: 26.5px; padding: 2.5px; pointer-events: none;
  background: conic-gradient(from var(--as-rim), rgba(230,226,244,0.85), rgba(167,139,250,0.55) 12%, rgba(255,255,255,0.10) 26%, rgba(124,58,237,0.75) 40%, rgba(230,226,244,0.70) 52%, rgba(255,255,255,0.08) 66%, rgba(196,181,253,0.55) 80%, rgba(255,255,255,0.12) 90%, rgba(230,226,244,0.85));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
  animation: as-rim 16s linear infinite; }
.as-card.as-solid { backdrop-filter: none; -webkit-backdrop-filter: none; }
@keyframes as-rim { to { --as-rim: 360deg; } }
@keyframes as-cardIn { from { opacity: 0; transform: translateY(18px) scale(0.985); } to { opacity: 1; transform: none; } }

/* o orbe: a logo viva */
.as-orb { position: absolute; left: 50%; top: -46px; translate: -50% 0; width: 92px; height: 92px; z-index: 5; pointer-events: none;
  filter: drop-shadow(0 18px 30px rgba(124,58,237,0.45)); animation: as-breathe 5s ease-in-out infinite; }
.as-orb svg { width: 100%; height: 100%; overflow: visible; display: block; }
.as-orb .as-arc { transform-origin: 60px 60px; animation: as-sway var(--d) ease-in-out infinite alternate; }
.as-orb .as-a1 { --d: 7s; } .as-orb .as-a2 { --d: 5.6s; animation-delay: -1.3s; } .as-orb .as-a3 { --d: 4.6s; animation-delay: -2.1s; } .as-orb .as-a4 { --d: 3.8s; animation-delay: -0.7s; }
.as-orb .as-core { transform-origin: 60px 60px; animation: as-core 3.2s ease-in-out infinite; }
.as-orb.as-listen .as-arc { animation: as-ripple 700ms cubic-bezier(0.4, 0, 0.2, 1) 1; }
.as-orb.as-listen .as-a2 { animation-delay: 60ms; } .as-orb.as-listen .as-a3 { animation-delay: 120ms; } .as-orb.as-listen .as-a4 { animation-delay: 180ms; }
.as-orb.as-listen .as-core { animation-duration: 0.8s; }
.as-orb.as-happy { animation: as-happy 900ms cubic-bezier(0.16, 1, 0.3, 1) 1; }
.as-orb.as-hmm { animation: as-hmm 500ms cubic-bezier(0.4, 0, 0.2, 1) 1; }
@keyframes as-breathe { 0%, 100% { translate: -50% 0; } 50% { translate: -50% -4px; } }
@keyframes as-sway { from { rotate: -5deg; } to { rotate: 5deg; } }
@keyframes as-ripple { 0% { scale: 1; opacity: 1; } 40% { scale: 1.06; opacity: 0.75; } 100% { scale: 1; opacity: 1; } }
@keyframes as-core { 0%, 100% { scale: 1; opacity: 0.9; } 50% { scale: 1.18; opacity: 1; } }
@keyframes as-happy { 0% { translate: -50% 0; scale: 1; } 35% { translate: -50% -14px; scale: 1.12; } 70% { translate: -50% 2px; scale: 0.97; } 100% { translate: -50% 0; scale: 1; } }
@keyframes as-hmm { 0%, 100% { rotate: 0deg; } 25% { rotate: -7deg; } 75% { rotate: 6deg; } }

/* campos e botões do login (RN Views com dataSet) */
[data-as-inp][data-as-inp] { transition: border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms cubic-bezier(0.4, 0, 0.2, 1); }
[data-as-inp][data-as-inp]:focus-within { border-color: rgba(196,181,253,0.85); background-color: rgba(124,58,237,0.10); box-shadow: 0 0 0 3px rgba(167,139,250,0.16), inset 0 0 18px rgba(167,139,250,0.08); }
[data-as-inp] input::placeholder { color: rgba(184,172,223,0.55); }
[data-as-btn][data-as-btn] { position: relative; overflow: hidden; background-image: linear-gradient(135deg, #9d6cff, #7c3aed 55%, #5b21b6);
  box-shadow: 0 12px 28px rgba(124,58,237,0.38), inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.25);
  transition: transform 120ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 120ms cubic-bezier(0.4, 0, 0.2, 1); }
[data-as-divider][data-as-divider] { background-image: linear-gradient(90deg, transparent, rgba(230,226,244,0.16), transparent); background-color: transparent; }
/* hover só onde existe ponteiro fino: no toque, nada depende de passar o dedo */
@media (hover: hover) and (pointer: fine) {
  [data-as-btn][data-as-btn]:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.32); }
  [data-as-link][data-as-link]:hover { color: ${Stage.violet4}; text-decoration: underline; text-underline-offset: 3px; }
  [data-as-ghost][data-as-ghost]:hover { background-color: rgba(167,139,250,0.10); }
}

/* orçamento de desempenho */
${sob(".as-static", TODOS)} { animation: none !important; }
${sob(".as-paused", EM_LOOP)} { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  ${sob(".aura-stage", TODOS)} { animation: none !important; }
  [data-as-btn][data-as-btn], [data-as-inp][data-as-inp] { transition: none !important; }
}

/* celular: regras .stage-wrap.mobile e @media (max-width:480px) do mockup */
@media (max-width: 480px) {
  .as-blob { filter: blur(70px); } .as-b2 { display: none; }
  .as-scene { width: calc(100% - 28px); padding-top: 36px; }
  .as-orb { width: 72px; height: 72px; top: -36px; }
  .as-card { padding: 44px 18px 20px; backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%); }
  .as-center { padding: 16px 0; }
}
`;
