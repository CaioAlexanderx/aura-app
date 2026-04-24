// ============================================================
// AURA. -- PDV/Caixa · Fixed backdrop (orbs + grid)
// Web only — native renders nothing (plain bg from Colors is enough).
// ============================================================
import { IS_WEB } from "./types";

export function CaixaBackdrop() {
  if (!IS_WEB) return null;
  const wrap = {
    position: "fixed" as any,
    inset: 0 as any,
    zIndex: 0,
    pointerEvents: "none" as any,
    overflow: "hidden",
  };
  const orb = {
    position: "absolute" as any,
    borderRadius: "50%",
    filter: "blur(80px)",
    opacity: 0.45,
    animation: "caixaOrbFloat 18s ease-in-out infinite",
  };
  const grid = {
    position: "absolute" as any,
    inset: 0 as any,
    backgroundImage:
      "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)",
    backgroundSize: "56px 56px",
    maskImage: "radial-gradient(ellipse at center, #000 0%, transparent 75%)",
    WebkitMaskImage: "radial-gradient(ellipse at center, #000 0%, transparent 75%)",
  };
  return (
    <div style={wrap as any}>
      <div style={grid as any} />
      <div
        style={{
          ...orb,
          width: 520,
          height: 520,
          top: -120,
          left: -80,
          background: "radial-gradient(circle, #6d28d9, transparent 70%)",
        } as any}
      />
      <div
        style={{
          ...orb,
          width: 460,
          height: 460,
          bottom: -80,
          right: -60,
          background: "radial-gradient(circle, #4f5bd5, transparent 70%)",
          animationDelay: "-6s",
          animationDuration: "22s",
        } as any}
      />
      <div
        style={{
          ...orb,
          width: 380,
          height: 380,
          top: "40%",
          left: "50%",
          background: "radial-gradient(circle, #8b5cf6, transparent 70%)",
          opacity: 0.3,
          animationDelay: "-12s",
          animationDuration: "26s",
        } as any}
      />
    </div>
  );
}

export default CaixaBackdrop;
