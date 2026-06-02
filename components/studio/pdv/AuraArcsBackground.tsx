// ============================================================
// AURA STUDIO · PDV — fundo animado com os arcos da Aura (Fase 6.1)
// Ripple/radar concêntrico (eco do "aura radar" da marca) emanando do
// canto, cores do tema ativo (useStudioTokens), bem sutil, atrás do
// conteúdo. Animação web-only + reduceMotion. pointerEvents none.
// ============================================================
import { useEffect, useState } from "react";
import { View, Platform, AccessibilityInfo } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";

function useReduceMotion() {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    let m = true;
    AccessibilityInfo.isReduceMotionEnabled().then((e) => { if (m) setRm(!!e); });
    return () => { m = false; };
  }, []);
  return rm;
}

function injectArcsMotion() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("aura-arcs-motion")) return;
  const st = document.createElement("style");
  st.id = "aura-arcs-motion";
  // pulso radar: cada arco respira (opacidade + leve escala) em loop lento
  st.textContent =
    "@keyframes auraArcPulse{0%,100%{opacity:.10;transform:scale(.97)}50%{opacity:.34;transform:scale(1.03)}}";
  document.head.appendChild(st);
}

export function AuraArcsBackground({ t }: { t: StudioPalette }) {
  const reduced = useReduceMotion();
  useEffect(() => { injectArcsMotion(); }, []);

  if (Platform.OS !== "web") {
    return null; // textura de fundo é web-only (alvo do export)
  }

  const accent = t.accent;
  const primary = t.primary;
  // arcos concêntricos no canto inferior-direito (raio crescente)
  const radii = [120, 200, 280, 360, 440];
  const arcs = radii
    .map((r, i) => {
      const col = i % 2 === 0 ? accent : primary;
      const delay = (i * 0.7).toFixed(2);
      const anim = reduced ? "" : `;animation:auraArcPulse ${6 + i}s ease-in-out ${delay}s infinite;transform-origin:600px 360px`;
      // arco de ~quarto de círculo abrindo do canto
      return `<path d="M ${600 - r} 360 A ${r} ${r} 0 0 1 600 ${360 - r}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" style="opacity:${reduced ? 0.16 : 0.2}${anim}"/>`;
    })
    .join("");
  const core = `<circle cx="600" cy="360" r="10" fill="${accent}" style="opacity:${reduced ? 0.25 : 0.3}${reduced ? "" : ";animation:auraArcPulse 5s ease-in-out infinite;transform-origin:600px 360px"}"/>`;
  const svg = `<svg width="100%" height="100%" viewBox="0 0 600 360" preserveAspectRatio="xMaxYMax slice" xmlns="http://www.w3.org/2000/svg">${arcs}${core}</svg>`;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" } as any}
    >
      <span
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, display: "block" } as any}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </View>
  );
}
