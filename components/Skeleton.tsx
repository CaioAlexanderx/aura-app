import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Platform } from "react-native";
import { Colors } from "@/constants/colors";

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
};

function ShimmerWeb({ width, height = 16, borderRadius = 8, style }: SkeletonProps) {
  return (
    <div
      style={{
        width: width || "100%",
        height,
        borderRadius,
        background: `linear-gradient(90deg, ${Colors.bg4} 25%, ${Colors.bg3} 50%, ${Colors.bg4} 75%)`,
        backgroundSize: "200% 100%",
        animation: "auraShimmer 1.5s ease-in-out infinite",
        ...(style || {}),
      } as any}
    />
  );
}

function ShimmerNative({ width, height = 16, borderRadius = 8, style }: SkeletonProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[{ width: width || "100%", height, borderRadius, backgroundColor: Colors.bg4, opacity }, style]}
    />
  );
}

export function Skeleton(props: SkeletonProps) {
  if (Platform.OS === "web") return <ShimmerWeb {...props} />;
  return <ShimmerNative {...props} />;
}

// ── Preset skeleton layouts ──────────────────────────────────

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={sk.card}>
      <View style={sk.header}>
        <Skeleton width={40} height={40} borderRadius={12} />
        <View style={sk.headerText}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={10} />
        </View>
      </View>
      {[...Array(lines)].map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? "70%" : "100%"}
          height={12}
          style={{ marginTop: 10 }}
        />
      ))}
    </View>
  );
}

export function SkeletonKPI() {
  return (
    <View style={sk.kpi}>
      <Skeleton width={36} height={36} borderRadius={10} />
      <Skeleton width="50%" height={20} style={{ marginTop: 12 }} />
      <Skeleton width="70%" height={10} style={{ marginTop: 6 }} />
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View style={sk.row}>
      <View style={sk.rowLeft}>
        <Skeleton width={32} height={32} borderRadius={16} />
        <View style={sk.rowText}>
          <Skeleton width={120} height={12} />
          <Skeleton width={80} height={10} />
        </View>
      </View>
      <Skeleton width={70} height={14} />
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {[...Array(count)].map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={sk.dashboard}>
      {/* KPI row */}
      <View style={sk.kpiRow}>
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </View>
      {/* Card */}
      <SkeletonCard lines={2} />
      {/* List */}
      <Skeleton width="30%" height={14} style={{ marginTop: 24, marginBottom: 12 }} />
      <SkeletonList count={3} />
    </View>
  );
}

// ── Web shimmer keyframe (injected once) ─────────────────────
export function SkeletonStyle() {
  if (Platform.OS !== "web") return null;
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes auraShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}} />
  );
}

const sk = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  kpi: {
    flex: 1,
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "flex-start",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowText: {
    gap: 6,
  },
  dashboard: {
    padding: 0,
  },
});

export default Skeleton;
