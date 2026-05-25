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
// ============================================================
import { View, Text, Platform } from "react-native";
import { StudioColors } from "@/constants/studio-tokens";

// ─── Mark (símbolo somente) ────────────────────────────────
export function AuraStudioMark({ size = 54 }: { size?: number }) {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="aura-studio-bg-${size}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1E3A8A"/>
          <stop offset="100%" stop-color="#3B82F6"/>
        </linearGradient>
      </defs>
      <!-- Tile base com gradient navy -->
      <rect x="0" y="0" width="54" height="54" rx="14" fill="url(#aura-studio-bg-${size})"/>
      <!-- "S" estilizado em branco -->
      <path
        d="M37 18 Q37 14 32 14 L22 14 Q17 14 17 19 L17 22 Q17 26 22 26 L32 26 Q37 26 37 30 L37 35 Q37 39 32 39 L22 39 Q17 39 17 35"
        stroke="#FFFFFF"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <!-- Asterisco/sparkle magenta — referência a "personalizado/arte custom" -->
      <g transform="translate(43 11)">
        <circle cx="0" cy="0" r="5" fill="#EC4899"/>
        <path d="M0 -2.5 L0 2.5 M-2.5 0 L2.5 0 M-1.8 -1.8 L1.8 1.8 M-1.8 1.8 L1.8 -1.8"
              stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round"/>
      </g>
    </svg>
  `.trim();

  if (Platform.OS === "web") {
    return (
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
    );
  }

  // Native fallback — tile navy com "S" texto + ponto magenta
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        backgroundColor: StudioColors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: size * 0.42, fontWeight: "900" }}>S</Text>
      <View
        style={{
          position: "absolute",
          top: size * 0.1,
          right: size * 0.1,
          width: size * 0.18,
          height: size * 0.18,
          borderRadius: size * 0.09,
          backgroundColor: StudioColors.accent,
        }}
      />
    </View>
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
  const txtColor = variant === "dark" ? StudioColors.ink : "#FFFFFF";
  const subColor = variant === "dark" ? StudioColors.ink3 : "rgba(255,255,255,0.7)";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <AuraStudioMark size={size} />
      <View style={{ flexDirection: "column" }}>
        <Text
          style={{
            color: txtColor,
            fontSize: size * 0.5,
            fontWeight: "900",
            letterSpacing: -0.4,
            lineHeight: size * 0.6,
          }}
        >
          Aura
        </Text>
        <Text
          style={{
            color: subColor,
            fontSize: size * 0.28,
            fontWeight: "700",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginTop: -2,
          }}
        >
          Studio
        </Text>
      </View>
    </View>
  );
}

export default AuraStudioMark;
