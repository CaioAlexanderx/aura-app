// ============================================================
// useEstoquePremiumStyles — Estoque Premium v2 (08/05/2026)
// Injeta CSS uma vez (idempotente). Animações: aurora pulses,
// shimmer, riseIn, hover lift, table row hover.
// Padrão idêntico ao usado na Sidebar Premium v2 — vive fora do
// React render pra não re-injetar a cada mount e pra play bem com
// CSS keyframes.
//
// 12/05/2026: ações inline (edit/link/delete) ficavam invisíveis
// em touch screens porque dependiam de :hover. @media (hover: none)
// força opacity:1 + pointer-events:auto !important pra tablets e
// notebooks com tela touch. Bug reportado pela Eryca ("não consigo
// deletar"). Desktop com mouse mantém UX limpa de hover-reveal.
// ============================================================
import { useEffect } from "react";
import { Platform } from "react-native";

export function useEstoquePremiumStyles() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("aura-est-premium-css")) return;
    const st = document.createElement("style");
    st.id = "aura-est-premium-css";
    st.textContent =
      "@keyframes auraEstPulse { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.7; } 50% { transform: translate(20px,30px) scale(1.15); opacity: 1; } }\n" +
      "@keyframes auraEstPulse2 { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.6; } 50% { transform: translate(-30px,-20px) scale(1.2); opacity: 0.9; } }\n" +
      "@keyframes auraEstShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }\n" +
      "@keyframes auraEstSparkle { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }\n" +
      "@keyframes auraEstRiseIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }\n" +
      "@keyframes auraEstSlideRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }\n" +
      "@keyframes auraEstRingExpand { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(2); opacity: 0; } }\n" +
      "@keyframes auraEstPillSweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }\n" +
      ".aura-est-lift { transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s, border-color 0.25s; }\n" +
      ".aura-est-lift:hover { transform: translateY(-2px); }\n" +
      ".aura-est-pressable { transition: transform 0.18s cubic-bezier(0.4,0,0.2,1), background 0.2s, border-color 0.2s; cursor: pointer; }\n" +
      ".aura-est-pressable:active { transform: scale(0.98); }\n" +
      ".aura-est-row:hover { background: var(--aura-est-row-hover, rgba(124,58,237,0.06)) !important; }\n" +
      ".aura-est-row:hover .aura-est-row-actions { opacity: 1 !important; }\n" +
      ".aura-est-rise { animation: auraEstRiseIn 0.55s cubic-bezier(0.4,0,0.2,1) both; }\n" +
      ".aura-est-search-shimmer { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(100deg, transparent 30%, rgba(124,58,237,0.06) 50%, transparent 70%); animation: auraEstPillSweep 5s ease-in-out infinite; }\n" +
      ".aura-est-card-actions { opacity: 0; transition: opacity 0.2s cubic-bezier(0.4,0,0.2,1); pointer-events: none; }\n" +
      ".aura-est-card:hover .aura-est-card-actions { opacity: 1; pointer-events: auto; }\n" +
      // 12/05/2026: touch devices (tablet, notebook com tela touch) nao tem :hover.
      // Sem isso, edit/link/delete ficam permanentemente invisiveis (Eryca 12/05).
      // !important beats inline opacity:0 do ProductTableWeb.
      "@media (hover: none) {\n" +
      "  .aura-est-row-actions { opacity: 1 !important; }\n" +
      "  .aura-est-card-actions { opacity: 1 !important; pointer-events: auto !important; }\n" +
      "}\n";
    document.head.appendChild(st);
  }, []);
}
