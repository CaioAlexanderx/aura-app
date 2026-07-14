// ============================================================
// Conexões — Aura Karatê (federação) · Shoji
//
// Tela com abas de nível superior (H3, mesmo padrão de
// app/karate/(federation)/dojos/index.tsx):
//   1. "Conexões" (ConexoesTab)       — como cada dojô se conecta à
//      federação. Conteúdo INALTERADO — só virou aba (era rota única).
//   2. "Solicitações" (SolicitacoesTab) — NOVA, aba PRINCIPAL: fila de
//      solicitações de praticante (criação/transferência) vindas dos
//      dojôs, pra federação conferir/numerar/aprovar.
//
// Sub-navegação por QUERY PARAM (mesmo padrão do hub de Anuidades e da
// tela de Dojôs): ?tab=solicitacoes já abre a aba nova no boot.
//
// Badge de pendentes na aba "Solicitações": busca leve (só
// getPractitionerRequestMetrics) independente do fetch completo que
// SolicitacoesTab faz pra si mesma — cada aba cuida do próprio dado,
// mesma separação de responsabilidade de DojosListTab/CadastralTab.
// Refaz no foco da tela (useFocusEffect) pra não ficar com número stale
// depois de aprovar/rejeitar uma solicitação e voltar pra cá.
// ============================================================
import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { KarateColors, ShojiPalette } from "@/constants/karateTheme";
import { ConexoesTab } from "./tabs/ConexoesTab";
import { SolicitacoesTab } from "./tabs/SolicitacoesTab";
import { karateApi } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

type Tab = "conexoes" | "solicitacoes";

const firstParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default function ConexoesScreen() {
  const { federationId } = useKarateFederation();

  // Deep-link: ?tab=solicitacoes já abre a aba nova no boot (lazy
  // useState initializer, mesmo padrão do hub de Anuidades/Dojôs) —
  // depois disso o usuário navega livremente pelas abas.
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    firstParam(params.tab) === "solicitacoes" ? "solicitacoes" : "conexoes"
  );

  const [pendentes, setPendentes] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    if (!federationId) return;
    let cancelled = false;
    karateApi.getPractitionerRequestMetrics(federationId)
      .then((m) => { if (!cancelled) setPendentes(m.pendentes); })
      .catch(() => { if (!cancelled) setPendentes(null); });
    return () => { cancelled = true; };
  }, [federationId]));

  return (
    <View style={styles.screen}>
      {/* Sub-tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "conexoes" && styles.tabItemActive]}
          onPress={() => setActiveTab("conexoes")}
          accessibilityRole="tab"
          accessibilityLabel="Conexões"
          accessibilityState={{ selected: activeTab === "conexoes" }}
        >
          <Text style={[styles.tabLabel, activeTab === "conexoes" && styles.tabLabelActive]}>
            Conexões
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "solicitacoes" && styles.tabItemActive]}
          onPress={() => setActiveTab("solicitacoes")}
          accessibilityRole="tab"
          accessibilityLabel="Solicitações"
          accessibilityState={{ selected: activeTab === "solicitacoes" }}
        >
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabLabel, activeTab === "solicitacoes" && styles.tabLabelActive]}>
              Solicitações
            </Text>
            {!!pendentes && pendentes > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{pendentes > 99 ? "99+" : pendentes}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === "conexoes" && <ConexoesTab />}
        {activeTab === "solicitacoes" && <SolicitacoesTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: KarateColors.bg,
  } as ViewStyle,
  tabBar: {
    backgroundColor: KarateColors.bg2,
    borderBottomWidth: 1,
    borderBottomColor: KarateColors.border,
    flexGrow: 0,
  } as ViewStyle,
  tabBarContent: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 4,
  } as ViewStyle,
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  } as ViewStyle,
  tabItemActive: {
    borderBottomColor: KarateColors.primary,
  } as ViewStyle,
  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  } as ViewStyle,
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: KarateColors.ink3,
    letterSpacing: 0.1,
  } as TextStyle,
  tabLabelActive: {
    color: KarateColors.primary,
    fontWeight: "800",
  } as TextStyle,
  badge: {
    backgroundColor: ShojiPalette.red,
    borderRadius: 999,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  badgeTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fdf8f2",
  } as TextStyle,
  content: {
    flex: 1,
  } as ViewStyle,
});
