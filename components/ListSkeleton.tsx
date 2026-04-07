import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  rows?: number;
  showCards?: boolean;
};

function ShimmerBar({ width, height = 12, delay = 0 }: { width: string | number; height?: number; delay?: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 800, delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[s.bar, { width: width as any, height, opacity: anim }]} />
  );
}

function SkeletonRow({ delay }: { delay: number }) {
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <ShimmerBar width={36} height={36} delay={delay} />
        <View style={s.rowText}>
          <ShimmerBar width="70%" height={13} delay={delay + 50} />
          <ShimmerBar width="40%" height={10} delay={delay + 100} />
        </View>
      </View>
      <ShimmerBar width={80} height={16} delay={delay + 150} />
    </View>
  );
}

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <View style={s.card}>
      <ShimmerBar width="60%" height={10} delay={delay} />
      <ShimmerBar width="80%" height={22} delay={delay + 100} />
    </View>
  );
}

export function ListSkeleton({ rows = 4, showCards = true }: Props) {
  return (
    <View>
      {showCards && (
        <View style={s.cardsRow}>
          <SkeletonCard delay={0} />
          <SkeletonCard delay={100} />
          <SkeletonCard delay={200} />
        </View>
      )}
      <View style={s.listWrap}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} delay={i * 100} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: Colors.bg4,
    borderRadius: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 20,
  },
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
    minWidth: 140,
    margin: 4,
    gap: 10,
  },
  listWrap: {
    backgroundColor: Colors.bg3,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
});

export default ListSkeleton;
