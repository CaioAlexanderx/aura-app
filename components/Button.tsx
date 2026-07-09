// ============================================================
// Button — Aura · componente unificado (F1 do redesign Crediário)
//
// Substitui os Pressable ad-hoc (opacity 0.5/0.7/0.85 inconsistentes).
// Premium feel: scale 0.98 no press + hover lift com glow (só web,
// aditivo — nada depende de hover; CLAUDE.md armadilha 7).
//
// Variantes:
//   primary   — violeta sólido, texto branco, glow violeta no hover
//   secondary — tint violetD + border2, texto violet3 (padrão header)
//   ghost     — transparente com borda sutil
//   danger    — vermelho sólido (ações destrutivas confirmadas)
//   success   — tint verde (Pix/WhatsApp/receber)
// ============================================================
import React, { useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text,
  StyleProp, ViewStyle,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Motion, Shadows, webTransition } from "@/constants/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const IS_WEB = Platform.OS === "web";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  title:      string;
  onPress?:   () => void;
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  icon?:      string;
  loading?:   boolean;
  disabled?:  boolean;
  /** flex:1 para ocupar a linha (pares Cancelar/Confirmar). */
  full?:      boolean;
  style?:     StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const VARIANTS: Record<ButtonVariant, { bg: string; border: string; text: string; glow: string; spinner: string }> = {
  primary:   { bg: Colors.violet,  border: Colors.violet,               text: "#fff",          glow: Shadows.glow,      spinner: "#fff" },
  secondary: { bg: Colors.violetD, border: Colors.border2,              text: Colors.violet3,  glow: Shadows.glow,      spinner: Colors.violet3 },
  ghost:     { bg: "transparent",  border: Colors.border,               text: Colors.ink2,     glow: Shadows.soft,      spinner: Colors.ink2 },
  danger:    { bg: Colors.red,     border: Colors.red,                  text: "#fff",          glow: "0 4px 16px rgba(248,113,113,0.3)", spinner: "#fff" },
  success:   { bg: Colors.greenD,  border: "rgba(52,211,153,0.35)",     text: Colors.green,    glow: Shadows.glowGreen, spinner: Colors.green },
};

const SIZES: Record<ButtonSize, { pv: number; ph: number; fs: number; icon: number; radius: number }> = {
  sm: { pv: 8,  ph: 12, fs: 12,   icon: 13, radius: 9 },
  md: { pv: 11, ph: 16, fs: 13,   icon: 15, radius: 11 },
  lg: { pv: 14, ph: 18, fs: 14.5, icon: 16, radius: 13 },
};

export function Button({
  title, onPress, variant = "secondary", size = "md", icon,
  loading, disabled, full, style, accessibilityLabel,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const sz = SIZES[size];
  const scale = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);
  const blocked = disabled || loading;

  const to = (val: number, dur: number) =>
    Animated.timing(scale, { toValue: val, duration: dur, useNativeDriver: false }).start();

  return (
    <AnimatedPressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      onPressIn={() => to(0.98, 90)}
      onPressOut={() => to(1, Motion.fast)}
      onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
      onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
      style={[
        s.base,
        {
          backgroundColor: v.bg, borderColor: v.border,
          paddingVertical: sz.pv, paddingHorizontal: sz.ph, borderRadius: sz.radius,
          transform: [{ scale }],
        },
        full && { flex: 1 },
        hovered && !blocked && ({
          transform: [{ translateY: -2 }, { scale: 1 }],
          ...(IS_WEB ? ({ boxShadow: v.glow } as any) : null),
        } as any),
        blocked && { opacity: 0.45 },
        IS_WEB ? (webTransition(["transform", "box-shadow", "background-color"], Motion.fast) as any) : null,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color={v.spinner} />
        : (
          <>
            {!!icon && <Icon name={icon} size={sz.icon} color={v.text} />}
            <Text style={[s.txt, { color: v.text, fontSize: sz.fs }]} numberOfLines={1}>{title}</Text>
          </>
        )}
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  base: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, borderWidth: 1,
  },
  txt: { fontWeight: "700" },
});

export default Button;
