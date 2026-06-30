// ============================================================
// Painel do Sensei (acesso de acompanhamento) — Aura Karatê (DESIGN-23)
// Shell "light" separado do shell da federação: só leitura, linguagem
// simples. Rota /karate/sensei (segmento próprio, fora do grupo
// (federation), então não passa pelo shell/sidebar da FPKT).
//
// Track G (acesso real): gate por vertical karatê (espera hidratar). O
// roteamento por papel (sensei/dojo_owner → aqui) é feito no layout da
// federação. Dados do dojô vêm de company (JWT) — dojoId via contexto.
//
// Fase 0 Dojô (17/06/2026): usa company.name como nome do dojô em vez
// do mock SENSEI_DOJO. Mantém SENSEI_DOJO apenas como fallback de display.
// Track J: adicionada aba Certificados → /karate/sensei/certificados
//
// Fontes Shoji: este shell é um mount point próprio de karatê (fora do
// KarateShell da federação), então carrega as fontes via useShojiFonts —
// no nativo registra as famílias por expo-font, no web injeta o Google Fonts.
// ============================================================
import React from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator, ViewStyle, TextStyle,
} from "react-native";
import { Slot, usePathname, useRouter, Redirect } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { KarateFederationProvider, useKarateFederation } from "@/contexts/KarateFederation";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useShojiFonts, FpktLogo } from "@/components/karate/shoji";

const KARATE_VERTICALS = ["karate_federation", "karate_dojo"];

// Fallback de display (só usado se company.name não vier).
// Exportado como SENSEI_DOJO: consumido por index.tsx, anuidade.tsx e
// certificados/index.tsx (name/code/total) como mock de eyebrow/contexto.
export const SENSEI_DOJO = { name: "Dojô", code: "—", total: 0 };
const SENSEI_DOJO_FALLBACK = SENSEI_DOJO;

const TABS = [
  { label: "Praticantes", route: "/karate/sensei" },
  { label: "Eventos",     route: "/karate/sensei/eventos" },
  { label: "Anuidade",    route: "/karate/sensei/anuidade" },
  { label: "Certificados",route: "/karate/sensei/certificados" },
] as const;

function SenseiShell() {
  useShojiFonts();   // carrega as fontes Shoji (web Google Fonts · nativo expo-font)
  const router = useRouter();
  const path = usePathname();
  const { dojoId } = useKarateFederation();
  const company = useAuthStore((s) => s.company) as any;

  const dojoName = company?.name || SENSEI_DOJO_FALLBACK.name;

  const isActive = (route: string) =>
    route === "/karate/sensei" ? (path === "/karate/sensei" || path === "/karate/sensei/") : path.startsWith(route);

  return (
    <SafeAreaView style={styles.root}>
      {/* Topbar light */}
      <View style={styles.topbar}>
        <FpktLogo size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.dojo} numberOfLines={1}>{dojoName}</Text>
          {dojoId && (
            <Text style={styles.dojoSub} numberOfLines={1}>ID: {dojoId.slice(0, 8)}…</Text>
          )}
        </View>
        <View style={styles.roPill}>
          <Icon name="eye-outline" size={12} color={KarateColors.ink3} />
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

export default function SenseiLayout() {
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

  return (
    <KarateFederationProvider>
      <SenseiShell />
    </KarateFederationProvider>
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
