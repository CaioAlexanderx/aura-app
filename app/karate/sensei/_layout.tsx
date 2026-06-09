// ============================================================
// Painel do Sensei (acesso de acompanhamento) — Aura Karatê (DESIGN-23)
// Shell "light" separado do shell da federação: só leitura, linguagem
// simples. Rota /karate/sensei (segmento próprio, fora do grupo
// (federation), então não passa pelo shell/sidebar da FPKT).
// ============================================================
import React from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ViewStyle, TextStyle,
} from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

// Dojô do sensei logado (mock até o login de sensei existir)
export const SENSEI_DOJO = { name: "Dojô Mirim Santos", code: "FPKT-027", sensei: "Fernanda Lima", total: 63 };

const TABS = [
  { label: "Praticantes", route: "/karate/sensei" },
  { label: "Eventos",     route: "/karate/sensei/eventos" },
  { label: "Anuidade",    route: "/karate/sensei/anuidade" },
] as const;

export default function SenseiLayout() {
  const router = useRouter();
  const path = usePathname();
  const isActive = (route: string) =>
    route === "/karate/sensei" ? (path === "/karate/sensei" || path === "/karate/sensei/") : path.startsWith(route);

  return (
    <SafeAreaView style={styles.root}>
      {/* Topbar light */}
      <View style={styles.topbar}>
        <View style={styles.logoMark}><Text style={styles.kanji}>空</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dojo} numberOfLines={1}>{SENSEI_DOJO.name}</Text>
          <Text style={styles.dojoSub}>{SENSEI_DOJO.code} · Sensei {SENSEI_DOJO.sensei}</Text>
        </View>
        <View style={styles.roPill}>
          <Ionicons name="eye-outline" size={12} color={KarateColors.ink3} />
          <Text style={styles.roText}>Somente leitura</Text>
        </View>
      </View>

      {/* Sub-tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
          {TABS.map((t) => {
            const active = isActive(t.route);
            return (
              <TouchableOpacity key={t.route} onPress={() => router.push(t.route as any)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab" accessibilityState={{ selected: active }}>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}><Slot /></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  logoMark: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  kanji: { fontSize: 18, color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  dojo: { fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  dojoSub: { fontSize: 11, color: KarateColors.ink3, marginTop: 1, fontFamily: "monospace" } as TextStyle,
  roPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 } as ViewStyle,
  roText: { fontSize: 11, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  tabBar: { borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.bg } as ViewStyle,
  tabContent: { flexDirection: "row", paddingHorizontal: 16, gap: 4 } as ViewStyle,
  tab: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 } as ViewStyle,
  tabActive: { borderBottomColor: KarateColors.primary } as ViewStyle,
  tabLabel: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
});
