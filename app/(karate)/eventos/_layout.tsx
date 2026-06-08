// ============================================================
// Layout do grupo eventos — Aura Karatê Track C
//
// Sub-tabs: Visão Geral / Próximos / Histórico / Resultados.
// Expo-router group dentro de (karate).
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, ViewStyle, TextStyle } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

const TABS = [
  { label: "Visão Geral", route: "/(karate)/eventos" },
  { label: "Próximos",    route: "/(karate)/eventos/proximos" },
  { label: "Histórico",   route: "/(karate)/eventos/historico" },
  { label: "Resultados",  route: "/(karate)/eventos/resultados" },
] as const;

export default function EventosLayout() {
  const router  = useRouter();
  const path    = usePathname();

  const isActive = (route: string) => {
    const normalized = route.replace("/(karate)/", "/karate/");
    if (route === "/(karate)/eventos") {
      return path === "/karate/eventos" || path === "/karate/eventos/";
    }
    return path.startsWith(normalized);
  };

  return (
    <View style={styles.container}>
      {/* Sub-tab bar */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map((tab) => {
            const active = isActive(tab.route);
            return (
              <TouchableOpacity
                key={tab.route}
                onPress={() => router.push(tab.route as any)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      {/* Screen content */}
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KarateColors.bg,
  } as ViewStyle,
  tabBarWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: KarateColors.border,
    backgroundColor: KarateColors.bg2,
  } as ViewStyle,
  tabBarContent: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 4,
  } as ViewStyle,
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  } as ViewStyle,
  tabActive: {
    borderBottomColor: KarateColors.primary,
  } as ViewStyle,
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: KarateColors.ink3,
  } as TextStyle,
  tabLabelActive: {
    color: KarateColors.primary,
    fontWeight: "700",
  } as TextStyle,
  content: {
    flex: 1,
  } as ViewStyle,
});
