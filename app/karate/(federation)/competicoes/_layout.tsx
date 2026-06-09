// ============================================================
// Layout do grupo competições — Aura Karatê Track E
// Sub-tabs: Visão Geral / Ranking. Espelha eventos/_layout.tsx.
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ViewStyle, TextStyle } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { KarateColors } from "@/constants/karateTheme";

const TABS = [
  { label: "Visão Geral", route: "/karate/competicoes" },
  { label: "Ranking",     route: "/karate/competicoes/ranking" },
] as const;

export default function CompeticoesLayout() {
  const router = useRouter();
  const path = usePathname();

  const isActive = (route: string) => {
    if (route === "/karate/competicoes") {
      return path === "/karate/competicoes" || path === "/karate/competicoes/";
    }
    return path.startsWith(route);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map((tab) => {
            const active = isActive(tab.route);
            return (
              <TouchableOpacity key={tab.route} onPress={() => router.push(tab.route as any)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab" accessibilityState={{ selected: active }}>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.content}><Slot /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  tabBarWrapper: { borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  tabBarContent: { flexDirection: "row", paddingHorizontal: 16, gap: 4 } as ViewStyle,
  tab: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 } as ViewStyle,
  tabActive: { borderBottomColor: KarateColors.primary } as ViewStyle,
  tabLabel: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  content: { flex: 1 } as ViewStyle,
});
