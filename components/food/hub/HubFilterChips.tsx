import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from "react-native";
import { FoodTokensV2, FoodGradientsV2 } from "@/constants/food-tokens";
import type { HubChannel } from "@/hooks/useFoodHub";

interface Props {
  channels: HubChannel[];
  active: string[];
  onChange: (next: string[]) => void;
}

export function HubFilterChips({ channels, active, onChange }: Props) {
  const totalToday = channels.reduce((acc, c) => acc + (c.count_today || 0), 0);

  function toggle(key: string) {
    if (active.includes(key)) onChange(active.filter((k) => k !== key));
    else onChange([...active, key]);
  }

  const allActive = active.length === 0;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable onPress={() => onChange([])}>
        <View style={[styles.chip, allActive && styles.chipActive]}>
          <Text style={[styles.chipText, allActive && styles.chipTextActive]}>Todos · {totalToday}</Text>
        </View>
      </Pressable>
      {channels.map((ch) => {
        const isActive = active.includes(ch.key);
        return (
          <Pressable key={ch.key} onPress={() => toggle(ch.key)}>
            <View style={[styles.chip, isActive && styles.chipActive]}>
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {ch.label} · {ch.count_today}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4, alignItems: "center" },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: FoodTokensV2.surfaceFlat,
    borderWidth: 1, borderColor: FoodTokensV2.line2,
    ...(Platform.OS === "web" ? ({ transition: "all 0.15s ease" } as any) : {}),
  },
  chipActive: {
    borderColor: "transparent",
    ...(Platform.OS === "web"
      ? ({ background: FoodGradientsV2.flame } as any)
      : { backgroundColor: FoodTokensV2.primary }),
  },
  chipText: { fontSize: 12, fontWeight: "600", color: FoodTokensV2.ink2 },
  chipTextActive: { color: "#fff" },
});
