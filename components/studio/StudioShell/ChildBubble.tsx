// ============================================================
// AURA STUDIO · StudioShell — ChildBubble + ChildHoverBubble
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Bolinhas filhas (click expand + hover popup horizontal).
// ChildHoverBubble usa Reanimated pra animação suave de entrada.
// ============================================================
import { useEffect, useMemo } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay,
} from "react-native-reanimated";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { FloatingBubble } from "./FloatingBubble";
import { makeStyles } from "./styles";
import { makeTones, NavChild, ToneKey } from "./types";

export function ChildBubble({
  child, onPress, idx, tone, pause,
}: {
  child: NavChild;
  onPress: () => void;
  idx: number;
  tone: ToneKey;
  pause: boolean;
}) {
  const tk = useStudioTokens();
  const s = useMemo(() => makeStyles(tk), [tk]);
  const t = makeTones(tk)[tone];
  return (
    <FloatingBubble idx={idx + 1} pause={pause} style={{}}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={child.label}
        accessibilityRole="button"
        style={[s.navChild, { backgroundColor: t.bg }]}
      >
        <Icon name={child.icon as any} size={16} color="#fff" />
        {child.badge && (
          <View
            style={[
              s.childBadge,
              { backgroundColor: child.badge.tone === "warm" ? "#F59E0B" : tk.accent },
            ]}
          >
            <Text style={s.childBadgeTxt}>{child.badge.value}</Text>
          </View>
        )}
      </Pressable>
      <Text style={s.childLabel} numberOfLines={1}>{child.label}</Text>
    </FloatingBubble>
  );
}

export function ChildHoverBubble({
  child, tone, delay, onPress,
}: {
  child: NavChild;
  tone: ToneKey;
  delay: number;
  onPress: () => void;
}) {
  const tk = useStudioTokens();
  const s = useMemo(() => makeStyles(tk), [tk]);
  const t = makeTones(tk)[tone];
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-8);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 180 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 180 }));
    translateX.value = withDelay(delay, withTiming(0, { duration: 220 }));
    return () => {
      opacity.value = withTiming(0, { duration: 120 });
    };
  }, [delay, scale, opacity, translateX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
    opacity: opacity.value,
    transformOrigin: "left center" as any,
  }));

  const webTitleProp: any = Platform.OS === "web" ? { title: child.label } : {};

  return (
    <Reanimated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={child.label}
        accessibilityRole="button"
        {...webTitleProp}
        style={s.hoverChildRow}
      >
        <View style={[s.hoverChildBubble, { backgroundColor: t.bg }]}>
          <Icon name={child.icon as any} size={14} color="#fff" />
          {child.badge && (
            <View
              style={[
                s.hoverChildBadge,
                { backgroundColor: child.badge.tone === "warm" ? "#F59E0B" : tk.accent },
              ]}
            />
          )}
        </View>
        <Text style={s.hoverChildLabel} numberOfLines={1}>{child.label}</Text>
      </Pressable>
    </Reanimated.View>
  );
}
