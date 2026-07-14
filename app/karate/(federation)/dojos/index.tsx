// ============================================================
// Dojôs — Aura Karatê (federação) · Shoji
//
// Tela com abas de nível superior:
//   1. "Dojôs" (DojosListTab)      — lista/gestão da rede (Ativos|Inativos,
//      busca, região, export, cadastro). Comportamento inalterado — só
//      mudou de rota-única para aba (ver tabs/DojosListTab.tsx).
//   2. "Atualização cadastral" (CadastralTab) — NOVO: acompanha o
//      andamento do pedido de atualização cadastral por dojô (KPIs +
//      tabela com ações). Substitui o antigo RosterProgressPanel que
//      vivia no header da lista — ele não pertencia mais ali.
//
// Sub-navegação por QUERY PARAM (mesmo padrão do hub de Anuidades em
// financeiro/index.tsx): ?tab=cadastral já abre a aba nova no boot.
// ============================================================
import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { KarateColors } from "@/constants/karateTheme";
import { DojosListTab } from "./tabs/DojosListTab";
import { CadastralTab } from "./tabs/CadastralTab";

type Tab = "dojos" | "cadastral";

const TABS: { key: Tab; label: string }[] = [
  { key: "dojos",     label: "Dojôs" },
  { key: "cadastral", label: "Atualização cadastral" },
];

const firstParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default function DojosScreen() {
  // Deep-link: ?tab=cadastral já abre a aba nova no boot (lazy useState
  // initializer, mesmo padrão do hub de Anuidades) — depois disso o
  // usuário navega livremente pelas abas.
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    firstParam(params.tab) === "cadastral" ? "cadastral" : "dojos"
  );

  return (
    <View style={styles.screen}>
      {/* Sub-tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === "dojos"     && <DojosListTab />}
        {activeTab === "cadastral" && <CadastralTab />}
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
  content: {
    flex: 1,
  } as ViewStyle,
});
