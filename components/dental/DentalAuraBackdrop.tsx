// ============================================================
// DentalAuraBackdrop — orbs animadas + grid mascarado (PR16).
//
// Web-only (mesma estrategia do AuraBackdrop do shell negocio).
// Renderiza no fundo do hoje.tsx via position:fixed (cobre toda
// a viewport, atras do conteudo).
//
// Orbs cyan + cyan2 + violet usando keyframes dentalOrbFloat.
// Grid sutil cyan/violet mascarado por radial transparente nas
// bordas pra nao competir com o conteudo.
// ============================================================

import { View } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";

export function DentalAuraBackdrop() {
  if (typeof window === "undefined") return null;

  const baseOrb: any = {
    position: "fixed",
    borderRadius: 9999,
    pointerEvents: "none",
    filter: "blur(80px)",
    opacity: 0.55,
    zIndex: 0,
  };

  return (
    <>
      {/* Orb 1 — cyan canto superior esquerdo */}
      <View style={{
        ...baseOrb,
        top: "-10%", left: "-8%",
        width: 480, height: 480,
        background: "radial-gradient(circle, rgba(6,182,212,0.32) 0%, transparent 70%)",
        animation: "dentalOrbFloat 18s ease-in-out infinite",
      } as any} />

      {/* Orb 2 — cyan2 (azul) canto inferior direito */}
      <View style={{
        ...baseOrb,
        bottom: "-12%", right: "-6%",
        width: 520, height: 520,
        background: "radial-gradient(circle, rgba(14,165,233,0.26) 0%, transparent 70%)",
        animation: "dentalOrbFloat 22s ease-in-out infinite reverse",
      } as any} />

      {/* Orb 3 — violet meio direita (toque familia Aura) */}
      <View style={{
        ...baseOrb,
        top: "30%", right: "20%",
        width: 360, height: 360,
        background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
        animation: "dentalOrbFloat 26s ease-in-out infinite",
        opacity: 0.4,
      } as any} />

      {/* Grid mascarado */}
      <View
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage:
            "linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,0,0,0.5) 0%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,0,0,0.5) 0%, transparent 80%)",
        } as any}
      />
    </>
  );
}
