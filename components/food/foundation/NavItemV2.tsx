import React, { useState } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { FoodTokensV2 } from "@/constants/food-tokens";

interface Props {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string | number;
  onPress?: () => void;
}

export function NavItemV2({ icon, label, active, badge, onPress }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      style={[styles.item, active && styles.itemActive, hovered && !active && styles.itemHover]}
    >
      {active && <View style={styles.activeBar}/>}
      <View style={[styles.icon, active && { color: FoodTokensV2.primary } as any]}>{icon}</View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {badge != null && (
        <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: FoodTokensV2.rMd, position: "relative",
  },
  itemHover: { backgroundColor: FoodTokensV2.violetSoft },
  itemActive: {
    backgroundColor: FoodTokensV2.primarySoft,
  },
  activeBar: {
    position: "absolute", left: 0, top: 8, bottom: 8, width: 3,
    backgroundColor: FoodTokensV2.primary,
    borderTopRightRadius: 3, borderBottomRightRadius: 3,
  },
  icon: { width: 16, height: 16 } as any,
  label: { fontSize: 13, color: FoodTokensV2.ink2, fontWeight: "500", flex: 1 },
  labelActive: { color: FoodTokensV2.primary, fontWeight: "600" },
  badge: {
    backgroundColor: FoodTokensV2.primary,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    shadowColor: FoodTokensV2.primary, shadowOpacity: 0.3, shadowRadius: 12,
  },
  badgeText: { color: "white", fontSize: 10, fontWeight: "700" },
});
