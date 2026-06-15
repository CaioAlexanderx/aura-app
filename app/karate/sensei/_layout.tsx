// ============================================================
// Painel do Sensei (acesso de acompanhamento) — Aura Karatê (DESIGN-23)
// Shell "light" separado do shell da federação: só leitura, linguagem
// simples. Rota /karate/sensei (segmento próprio, fora do grupo
// (federation), então não passa pelo shell/sidebar da FPKT).
//
// Track G (acesso real): gate por vertical karatê (espera hidratar). O
// roteamento por papel (sensei/dojo_owner → aqui) é feito no layout da
// federação. SENSEI_DOJO segue mock até os dados reais do dojô chegarem.
// Track J: adicionada aba Certificados → /karate/sensei/certificados
// ============================================================
import React from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator, ViewStyle, TextStyle,
} from "react-native";
import { Slot, usePathname, useRouter, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/auth";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

const KARATE_VERTICALS = ["karate_federation", "karate_dojo"];

// Dojô do sensei logado (mock até os dados reais do dojô existirem)
export const SENSEI_DOJO = { name: "Dojô Mirim Santos", code: "FPKT-027", sensei: "Fernanda Lima", total: 63 };

const TABS = [
  { label: "Praticantes", route: "/karate/sensei" },
  { label: "Eventos",     route: "/karate/sensei/eventos" },
  { label: "Anuidade",    route: "/karate/sensei/anuidade" },
  { label: "Certificados",route: "/karate/sensei/certificados" },
] as const;

export default function SenseiLayout() {
  const router = useRouter();
  const path = usePathname();
  const { isHydrated, company } = useAuthStore();

  // Track G: espera hidratar e exige vertical karatê.
  if (!isHydrated) {
    return (
      <SafeAreaView style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </SafeAreaView>
    );
  }
  const vertical = (company as any)?.vertical ?? (company as any)?.vertical_active;
  if (!KARATE_VERTICALS.includes(vertical as string)) {
    return <Redirect href="/(tabs)" />;
  }

  const isActive = (route: string) =>
    route === "/karate/sensei"
      ? (path === "/karate/sensei" || path === "/karate/sensei/")
      : path.startsWith(route);

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
