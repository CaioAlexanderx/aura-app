// ============================================================
// StudioLoading — estado de carregamento canonico do Aura Studio.
//
// Fase 0 UX overhaul (25/05/2026).
// Use em vez de ActivityIndicator solto ou skeletons custom em cada tela.
//
// Variants:
//   "spinner"          — AuraStudioMark com ring rotativo magenta (branded)
//   "skeleton-list"    — 4-6 linhas verticais (lista de items)
//   "skeleton-cards"   — grid 2x2 de cards (galeria, produtos)
//   "skeleton-grid"    — 3 colunas (KDS, dashboard)
//
// 31/05/2026 (Fase 5): "spinner" virou branded — AuraStudioMark central
// + anel cônico animado em magenta + label opcional. Respeita reduceMotion
// (sem rotação, mark estático). Substitui ActivityIndicator genérico.
// ============================================================
import { useEffect, useRef, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Animated, Easing, ActivityIndicator,
  AccessibilityInfo, Platform,
} from "react-native";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { AuraStudioMark } from "@/components/studio/AuraStudioMark";

type Variant = "spinner" | "skeleton-list" | "skeleton-cards" | "skeleton-grid";

export function StudioLoading({
  variant = "spinner",
  rows = 4,
  label,
}: {
  variant?: Variant;
  rows?: number;
  label?: string;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  if (variant === "spinner") {
    return (
      <View
        style={s.spinnerWrap}
        accessibilityRole={Platform.OS === "web" ? ("status" as any) : undefined}
        accessibilityLabel={label || "Carregando"}
        accessibilityLiveRegion="polite"
      >
        <BrandedSpinner t={t} size={64} />
        {label ? (
          <Text style={s.spinnerLabel} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  if (variant === "skeleton-list") {
    return (
      <View style={s.listWrap}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} delay={i * 80} />
        ))}
      </View>
    );
  }

  if (variant === "skeleton-cards") {
    return (
      <View style={s.cardsWrap}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonCard key={i} delay={i * 80} />
        ))}
      </View>
    );
  }

  if (variant === "skeleton-grid") {
    return (
      <View style={s.gridWrap}>
        {Array.from({ length: 3 }).map((_, col) => (
          <View key={col} style={{ flex: 1, gap: 10 }}>
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonCard key={i} delay={(col + i) * 60} small />
            ))}
          </View>
        ))}
      </View>
    );
  }

  return null;
}

// ─── Branded spinner ────────────────────────────────
// AuraStudioMark + anel magenta rotativo + fallback ActivityIndicator
// quando reduceMotion. Respeita branding canônico.
function BrandedSpinner({ t, size = 64 }: { t: StudioPalette; size?: number }) {
  const rotate = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotate, reduceMotion]);

  // ReduceMotion: mostra mark + activity indicator simples abaixo
  if (reduceMotion) {
    return (
      <View style={{ alignItems: "center", gap: 10 }}>
        <AuraStudioMark size={Math.round(size * 0.6)} />
        <ActivityIndicator size="small" color={t.accent} />
      </View>
    );
  }

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const ringSize = size + 16;
  const markSize = Math.round(size * 0.6);

  return (
    <View
      style={{
        width: ringSize,
        height: ringSize,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Ring rotativo */}
      <Animated.View
        style={{
          position: "absolute",
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderWidth: 2.5,
          borderColor: "transparent",
          borderTopColor: "#EC4899",
          borderRightColor: "#EC4899",
          transform: [{ rotate: spin }],
        }}
      />
      <AuraStudioMark size={markSize} />
    </View>
  );
}

// ── Pieces ─────────────────────────────────────────

function SkeletonRow({ delay = 0 }: { delay?: number }) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const tm = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: false }),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(tm);
  }, [anim, delay]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
  return (
    <Animated.View style={[s.row, { opacity }]}>
      <View style={s.rowAvatar} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[s.rowBar, { width: "60%" }]} />
        <View style={[s.rowBar, { width: "30%", height: 8 }]} />
      </View>
    </Animated.View>
  );
}

function SkeletonCard({ delay = 0, small = false }: { delay?: number; small?: boolean }) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const tm = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: false }),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(tm);
  }, [anim, delay]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
  return (
    <Animated.View style={[s.card, small && s.cardSmall, { opacity }]}>
      <View style={[s.cardThumb, small && { height: 60 }]} />
      <View style={{ gap: 6, padding: 10 }}>
        <View style={[s.rowBar, { width: "70%" }]} />
        <View style={[s.rowBar, { width: "40%", height: 8 }]} />
      </View>
    </Animated.View>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
  spinnerWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  spinnerLabel: {
    fontSize: 12,
    color: t.ink3,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  listWrap: {
    gap: 10,
    paddingVertical: 4,
  },
  cardsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridWrap: {
    flexDirection: "row",
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: t.paperCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: t.ink5,
  },
  rowBar: {
    height: 10,
    backgroundColor: t.ink5,
    borderRadius: 5,
  },
  card: {
    width: 180,
    backgroundColor: t.paperCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.ink5,
    overflow: "hidden",
  },
  cardSmall: {
    width: "100%",
  },
  cardThumb: {
    height: 100,
    backgroundColor: t.ink5,
  },
  });
}

export default StudioLoading;
