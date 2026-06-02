// ============================================================
// AURA STUDIO · Logo
//
// 2 variantes:
//   - <AuraStudioMark size /> — símbolo quadrado (sidebar, ~54px)
//   - <AuraStudioLockup size /> — símbolo + tipografia horizontal
//                                  (headers, empty states, página
//                                   pública de aprovação de arte)
//
// Paleta canônica (memory plano_aura_studio_vertical_24mai2026):
//   - navy   #1E3A8A primário
//   - sky    #3B82F6 (gradient end)
//   - magenta #EC4899 accent (asterisco/sparkle = personalização)
//
// 30/05/2026 (Fase 1b · batch 4): Mark SVG/asterisco mantém paleta
// FIXA (logo é asset de marca, NÃO troca com tema). Fallback nativo
// e Lockup tipográfico migram pra useStudioTokens.
//
// 31/05/2026 (Fase 4): micro-gesto on-load — scale 0.92 → 1 com
// spring suave + fade 0 → 1, ~360ms, behind reduceMotion. Per
// plano Fase 4 "Micro-gesto sutil no AuraStudioMark on-load".
// Aplicado ao container; assinatura do API preservada.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Platform, AccessibilityInfo } from "react-native";
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from "react-native-reanimated";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { Fonts } from "@/constants/fonts";

// ─── On-load micro-gesto hook ───────────────────────────────
function useLogoEntrance() {
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    opacity.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withSpring(1, {
      damping: 14,
      stiffness: 180,
      mass: 0.7,
    });
  }, [scale, opacity, reduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
}

// ─── Garante Instrument Serif pro wordmark, mesmo sob o override
// global "* { font-family: DM Sans !important }" do layout do varejo.
// Seletor de atributo [data-aura-wm] + !important vence o "*"; link da
// fonte com id próprio pra não colidir com o loader de fontes do app.
function useStudioBrandFont() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (!document.getElementById("aura-studio-serif")) {
      const lk = document.createElement("link");
      lk.id = "aura-studio-serif";
      lk.rel = "stylesheet";
      lk.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";
      document.head.appendChild(lk);
    }
    if (!document.getElementById("aura-studio-wm-font")) {
      const st = document.createElement("style");
      st.id = "aura-studio-wm-font";
      st.textContent = "[data-aura-wm]{font-family:'Instrument Serif',Georgia,serif !important;}";
      document.head.appendChild(st);
    }
  }, []);
}

// ─── Mark (símbolo somente) ────────────────────────────────
// NOTA: o SVG do logo usa paleta fixa por design (logo NÃO troca cor
// com tema — mantém identidade). O fallback nativo (sem SVG) puxa
// cores do tema para não vazar branco/navy quando o usuário está
// no modo escuro.
export function AuraStudioMark({ size = 54 }: { size?: number }) {
  const t = useStudioTokens();
  const entranceStyle = useLogoEntrance();
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="aura-studio-bg-${size}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1E3A8A"/>
          <stop offset="45%" stop-color="#4338CA"/>
          <stop offset="100%" stop-color="#DB2777"/>
        </linearGradient>
      </defs>
      <!-- Tile base com gradiente da marca (navy → indigo → magenta) -->
      <rect x="0" y="0" width="54" height="54" rx="15" fill="url(#aura-studio-bg-${size})"/>
      <!-- Sparkle branco — a faísca da personalização (glifo aprovado) -->
      <g transform="translate(11 11) scale(0.32)" fill="#FFFFFF">
        <path d="M50 5 C54.5 31 69 45.5 95 50 C69 54.5 54.5 69 50 95 C45.5 69 31 54.5 5 50 C31 45.5 45.5 31 50 5 Z"/>
        <path d="M82 14 C83.4 21.6 86.4 24.6 94 26 C86.4 27.4 83.4 30.4 82 38 C80.6 30.4 77.6 27.4 70 26 C77.6 24.6 80.6 21.6 82 14 Z" opacity="0.9"/>
      </g>
    </svg>
  `.trim();

  if (Platform.OS === "web") {
    return (
      <Reanimated.View
        style={[
          {
            width: size,
            height: size,
            flexShrink: 0,
          },
          entranceStyle,
        ]}
        accessibilityLabel="Aura Studio"
      >
        <span
          style={{
            width: size,
            height: size,
            display: "inline-flex",
            flexShrink: 0,
          } as any}
          aria-label="Aura Studio"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </Reanimated.View>
    );
  }

  // Native fallback — tile primary com "S" texto + ponto accent.
  // Usa tokens pra não destoar em modo escuro.
  return (
    <Reanimated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.26,
          backgroundColor: t.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        entranceStyle,
      ]}
    >
      <Text style={{ color: "#fff", fontSize: size * 0.5, lineHeight: size * 0.56 }}>✦</Text>
    </Reanimated.View>
  );
}

// ─── Lockup (símbolo + tipografia) ─────────────────────────
export function AuraStudioLockup({
  size = 32,
  variant = "dark",
}: {
  size?: number;
  variant?: "dark" | "light";
}) {
  const t = useStudioTokens();
  useStudioBrandFont();
  const txtColor = variant === "dark" ? t.ink : "#FFFFFF";
  const subColor = variant === "dark" ? t.ink3 : "rgba(255,255,255,0.72)";
  // Instrument Serif (editorial) — wordmark da marca. dataSet=aura-wm
  // ativa a regra CSS que vence o override global de fonte no web.
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <AuraStudioMark size={size} />
      <Text
        dataSet={{ auraWm: "true" }}
        style={{
          fontFamily: Fonts.heading,
          fontSize: size * 0.64,
          letterSpacing: -0.5,
          lineHeight: size * 0.74,
        }}
      >
        <Text dataSet={{ auraWm: "true" }} style={{ color: txtColor }}>Aura</Text>
        <Text dataSet={{ auraWm: "true" }} style={{ color: subColor }}> Studio</Text>
        <Text dataSet={{ auraWm: "true" }} style={{ color: t.accent }}>.</Text>
      </Text>
    </View>
  );
}

export default AuraStudioMark;
