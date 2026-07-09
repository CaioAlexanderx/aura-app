// ============================================================
// GlassCard — Aura · card glassmorphism (F1 do redesign Crediário)
//
// Card com o "ar Aura": blur + fundo translúcido (tokens Glass de
// constants/colors.ts, mesmos do Painel/PDV) no web; fallback sólido
// bg3 no nativo (backdrop-filter não existe em RN nativo).
//
// `hover` (opcional, só web, aditivo): lift -2px + sombra suave —
// para cards clicáveis (stats, KPIs). Nunca hover-reveal.
// `gradient`: usa Glass.heroGradSoft (cards hero violeta).
// ============================================================
import React, { useState } from "react";
import { Platform, Pressable, View, StyleProp, ViewStyle } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { Motion, Shadows, webTransition } from "@/constants/motion";

const IS_WEB = Platform.OS === "web";

interface GlassCardProps {
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
  /** Ativa lift + sombra no hover (implica Pressable). */
  hover?:    boolean;
  onPress?:  () => void;
  /** Fundo: card (padrão) | mid | deep | gradient (hero violeta). */
  tone?:     "card" | "mid" | "deep" | "gradient";
  /** Intensidade do blur em px (web). Padrão 14, como o Painel. */
  blur?:     number;
}

export function GlassCard({ children, style, hover, onPress, tone = "card", blur = 14 }: GlassCardProps) {
  const [hovered, setHovered] = useState(false);

  const webBg =
    tone === "gradient" ? Glass.heroGradSoft :
    tone === "mid"      ? Glass.cardMid :
    tone === "deep"     ? Glass.cardDeep : Glass.card;

  const baseStyle: any[] = [
    {
      borderRadius: 18, borderWidth: 1,
      borderColor: tone === "gradient" ? Colors.border2 : Glass.lineBorderCard,
      // Fallback nativo: sólido, sem blur
      backgroundColor: Colors.bg3,
    },
    IS_WEB
      ? ({
          background: webBg,
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
          boxShadow: Glass.cardShadow,
        } as any)
      : null,
    hovered && ({
      transform: [{ translateY: -2 }],
      borderColor: Colors.border2,
      ...(IS_WEB ? ({ boxShadow: Shadows.soft } as any) : null),
    } as any),
    IS_WEB ? (webTransition(["transform", "box-shadow", "border-color"], Motion.base) as any) : null,
    style,
  ];

  if (hover || onPress) {
    return (
      <Pressable
        onPress={onPress}
        onHoverIn={IS_WEB && hover ? () => setHovered(true) : undefined}
        onHoverOut={IS_WEB && hover ? () => setHovered(false) : undefined}
        style={baseStyle}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={baseStyle}>{children}</View>;
}

export default GlassCard;
