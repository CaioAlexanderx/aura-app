// ============================================================
// AURA STUDIO · StudioShell — NavCircle (bolinha-pai navegação)
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Pressable circular 60×60 com glow + group dot. Wrap em FloatingBubble
// pra ganhar movimento ambient.
// ============================================================
import { useMemo } from "react";
import { View, Pressable, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { FloatingBubble } from "./FloatingBubble";
import { makeStyles } from "./styles";

export function NavCircle({
  icon, active, isGroup, idx, onPress, children, pause,
  onHoverIn, onHoverOut, accessibilityLabel, glowing,
}: {
  icon: string;
  active?: boolean;
  isGroup?: boolean;
  idx: number;
  onPress?: () => void;
  children?: React.ReactNode;
  pause: boolean;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  accessibilityLabel?: string;
  glowing?: boolean;
}) {
  const tk = useStudioTokens();
  const s = useMemo(() => makeStyles(tk), [tk]);
  const webHoverProps =
    Platform.OS === "web" && (onHoverIn || onHoverOut)
      ? { onHoverIn, onHoverOut }
      : {};

  const glowStyle =
    Platform.OS === "web"
      ? (glowing || active
          ? { boxShadow: "0 0 32px rgba(236,72,153,0.55), 0 0 18px rgba(30,58,138,0.4), 0 6px 14px rgba(15,23,42,0.18)" }
          : { boxShadow: "0 0 18px rgba(30,58,138,0.28), 0 4px 10px rgba(15,23,42,0.12)" })
      : (glowing || active
          ? { shadowColor: tk.accent, shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 10 }
          : { shadowColor: tk.primary, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 5 });

  return (
    <FloatingBubble idx={idx} pause={pause} style={{ position: "relative" }}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        {...webHoverProps}
        style={[
          s.navCircle,
          glowStyle as any,
          active && s.navCircleActive,
          Platform.OS === "web" ? ({ transition: "box-shadow 200ms ease, transform 200ms ease" } as any) : null,
          glowing && Platform.OS === "web" ? ({ transform: [{ scale: 1.04 }] as any }) : null,
        ]}
      >
        <Icon name={icon as any} size={22} color={active ? "#fff" : tk.ink2} />
        {isGroup && <View style={s.groupDot} />}
      </Pressable>
      {children}
    </FloatingBubble>
  );
}
