import { useEffect, useState } from "react";
import { Platform, View, Text, Pressable } from "react-native";
import { DentalColors, SMILE_ARC_PATH } from "@/constants/dental-tokens";

// ============================================================
// PortalTransition — Animacao 3s de entrada no shell Aura Odonto.
//
// Sequencia (validada em mockup-portal-aura-odonto.html, aprovada
// pelo cliente em 2026-04-25):
//
//   t=0      Estado inicial: orbs violeta visiveis (heranca do
//            shell PDV), background violeta.
//   t=50ms   phase=transition: orbs violeta atenuam, background
//            cross-fade para tom intermediario.
//   t=850ms  phase=dental: background vira ciano-petala, orbs
//            dentais nascem nas bordas, smile-arc surge no centro
//            (scale 0.78 -> 1 com bounce), brand "Aura Odonto"
//            entra com letter-spacing animado, tagline + headline
//            + subhero aparecem em cascata.
//   t=3.2s   Overlay fade-out revelando o shell por baixo.
//   t=3.4s   onComplete dispara, store marca shown=true.
//
// Skip: clique ou qualquer tecla pula direto pro shell.
// prefers-reduced-motion: pula tudo em 200ms.
//
// Visual e timings espelham EXATAMENTE o mockup. Mudar timing
// aqui sem revalidar com o mockup = quebrar consistencia.
// ============================================================

type Phase = "login" | "transition" | "dental";

interface Props { onComplete: () => void; }

export function PortalTransition({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("login");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // prefers-reduced-motion: pula direto.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches) {
        const t = setTimeout(() => { setHidden(true); onComplete(); }, 200);
        return () => clearTimeout(t);
      }
    }

    const t1 = setTimeout(() => setPhase("transition"),  50);
    const t2 = setTimeout(() => setPhase("dental"),      850);
    const t3 = setTimeout(() => setHidden(true),        3200);
    const t4 = setTimeout(() => onComplete(),           3400);

    // Skip por tecla. Clique e tratado pelo Pressable do overlay.
    const onKey = () => { setHidden(true); onComplete(); };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("keydown", onKey);
    }

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("keydown", onKey);
      }
    };
  }, [onComplete]);

  if (hidden) return null;

  const skip = () => { setHidden(true); onComplete(); };

  // ============================================================
  // WEB — implementacao completa com CSS transitions inline.
  // ============================================================
  if (Platform.OS === "web") {
    const bg =
      phase === "login"      ? "#0a0a0f" :
      phase === "transition" ? "#060912" :
      DentalColors.bg;

    return (
      <div
        onClick={skip}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: bg,
          transition: "background 1.0s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease",
          overflow: "hidden",
          opacity: hidden ? 0 : 1,
          cursor: "pointer",
        } as any}
      >
        {/* Orb violeta A (canto superior esquerdo) */}
        <div style={{
          position: "absolute", width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
          filter: "blur(70px)", top: -200, left: -200,
          opacity: phase === "login" ? 1 : phase === "transition" ? 0.3 : 0,
          transform: phase === "login" ? "scale(1)" : "scale(1.2)",
          transition: "opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1), transform 1.6s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
        } as any} />

        {/* Orb violeta B (canto inferior direito) */}
        <div style={{
          position: "absolute", width: 800, height: 800, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
          filter: "blur(80px)", bottom: -250, right: -250,
          opacity: phase === "login" ? 1 : phase === "transition" ? 0.3 : 0,
          transform: phase === "login" ? "scale(1)" : "scale(1.2)",
          transition: "opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1), transform 1.6s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
        } as any} />

        {/* Orb ciano A */}
        <div style={{
          position: "absolute", width: 520, height: 520, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)",
          filter: "blur(70px)", top: -180, left: -180,
          opacity: phase === "dental" ? 1 : 0,
          transform: phase === "dental" ? "scale(1)" : "scale(0.6)",
          transition: "opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1), transform 1.6s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
        } as any} />

        {/* Orb ciano B */}
        <div style={{
          position: "absolute", width: 720, height: 720, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,165,233,0.22) 0%, transparent 70%)",
          filter: "blur(80px)", bottom: -220, right: -220,
          opacity: phase === "dental" ? 1 : 0,
          transform: phase === "dental" ? "scale(1)" : "scale(0.6)",
          transition: "opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1), transform 1.6s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
        } as any} />

        {/* Conteudo central */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 24, pointerEvents: "none", padding: 24,
        } as any}>
          {/* Smile-arc mark */}
          <div
            style={{
              width: 88, height: 88, borderRadius: 22,
              background: "linear-gradient(135deg, #06B6D4, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 16px 48px rgba(6,182,212,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
              opacity: phase === "dental" ? 1 : 0,
              transform: phase === "dental" ? "scale(1)" : "scale(0.78)",
              transition: "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
            } as any}
            dangerouslySetInnerHTML={{ __html:
              `<svg width="48" height="48" viewBox="0 0 32 32" fill="none"><path d="${SMILE_ARC_PATH}" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`
            }}
          />

          {/* Brand — "Aura Odonto" com letter-spacing animado */}
          <div style={{
            fontSize: 38, fontWeight: 800,
            letterSpacing: phase === "dental" ? "-0.05em" : "-0.04em",
            color: "#fafafa",
            opacity: phase === "dental" ? 1 : 0,
            transform: phase === "dental" ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1) 0.25s, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.25s, letter-spacing 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.25s",
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            textAlign: "center",
          } as any}>
            Aura <span style={{ color: DentalColors.cyan } as any}>Odonto</span>
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: 14, fontStyle: "italic", color: DentalColors.ink2,
            opacity: phase === "dental" ? 1 : 0,
            transform: phase === "dental" ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.5s ease 0.5s, transform 0.5s ease 0.5s",
            marginTop: -14,
            textAlign: "center",
          } as any}>
            Sua clínica em ordem, seu paciente seguro.
          </div>

          {/* Headline com gradient text */}
          <div style={{
            marginTop: 18,
            fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em",
            textAlign: "center", maxWidth: 460, lineHeight: 1.25,
            background: "linear-gradient(135deg, #fff 0%, #a5f3fc 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            opacity: phase === "dental" ? 1 : 0,
            transform: phase === "dental" ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.55s ease 1.1s, transform 0.55s ease 1.1s",
          } as any}>
            <div>Cada paciente,</div>
            <div>um histórico vivo.</div>
          </div>

          {/* Sub */}
          <div style={{
            marginTop: 8, fontSize: 13, color: DentalColors.ink3,
            opacity: phase === "dental" ? 1 : 0,
            transition: "opacity 0.5s ease 1.4s",
            textAlign: "center",
          } as any}>
            Prontuário, odontograma e agenda em uma só tela.
          </div>

          {/* Skip hint */}
          <div style={{
            position: "absolute", bottom: 24, fontSize: 11, color: DentalColors.ink3,
            fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.05em",
            opacity: phase === "dental" ? 0.5 : 0,
            transition: "opacity 0.4s ease 2s",
          } as any}>
            clique ou pressione qualquer tecla para entrar
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // NATIVE — fallback minimalista. Animacao web-first; native
  // ganha versao animada quando o app sair do web-first.
  // ============================================================
  return (
    <Pressable
      onPress={skip}
      style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: DentalColors.bg, alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
    >
      <View style={{ width: 88, height: 88, borderRadius: 22, backgroundColor: DentalColors.cyan, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 32 }}>D</Text>
      </View>
      <Text style={{ color: DentalColors.ink, fontSize: 28, fontWeight: "800", letterSpacing: -1 }}>
        Aura <Text style={{ color: DentalColors.cyan }}>Odonto</Text>
      </Text>
      <Text style={{ color: DentalColors.ink2, fontSize: 13, fontStyle: "italic", marginTop: 8 }}>
        Sua clínica em ordem, seu paciente seguro.
      </Text>
    </Pressable>
  );
}

export default PortalTransition;
