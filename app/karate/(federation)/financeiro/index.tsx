// ============================================================
// Financeiro — Aura Karatê
//
// Tela principal com sub-tabs:
//   1. Visão Geral (DRE + fluxo de caixa)
//   2. Anuidades (hub Fase F2 — Dojô + Praticantes unificados, KPIs
//      agregados no banco, tabela paginada, valores e planos)
//   3. Lançamentos (entradas + saídas — ex "Saídas")
//   4. Em aberto
//
// Fase F2 (hub de anuidades): as antigas abas "Anuidades Dojô" e
// "Anuidades Praticantes" (DojoAnnuitiesTab/CpfAnnuitiesTab, cada uma um
// .map() dentro de um ScrollView) foram substituídas por UM hub único
// (AnnuitiesHub), com sub-navegação por QUERY PARAM na própria rota
// /karate/financeiro — não um grupo novo do expo-router:
//   ?area=cobrancas|planos&seg=dojo|cpf&year=YYYY
// Deep-link: se a rota chega com `area` ou `seg` na URL (ex.: link vindo
// de outra tela apontando direto pra Anuidades), o boot já seleciona essa
// aba em vez de "Visão Geral" — ver bootstrapping abaixo.
//
// Wired against karate-fase1-openapi.yaml.
// ============================================================
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { OverviewTab }       from "./tabs/OverviewTab";
import { AnnuitiesHub }      from "./tabs/AnnuitiesHub";
import { EntriesTab }        from "./tabs/EntriesTab";
import { OpenItemsTab }      from "./tabs/OpenItemsTab";

type Tab = "overview" | "annuities" | "entries" | "open_items";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview",   label: "Visão Geral" },
  { key: "annuities",  label: "Anuidades" },
  { key: "entries",    label: "Lançamentos" },
  { key: "open_items", label: "Em aberto" },
];

const firstParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default function FinanceiroScreen() {
  const { federationId } = useKarateFederation();
  // Deep-link (Fase F2): ?area= ou ?seg= na URL já abrem o hub de
  // Anuidades no boot, sem precisar clicar na aba. Só decide o TAB inicial
  // (lazy useState initializer) — depois disso o usuário navega livremente
  // pelas abas e o hub some/reaparece de acordo com `activeTab`, não com a
  // URL (a URL continua sendo lida DENTRO do hub pra year/seg/area).
  const params = useLocalSearchParams<{ area?: string | string[]; seg?: string | string[] }>();
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    (firstParam(params.area) || firstParam(params.seg)) ? "annuities" : "overview"
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
            style={[
              styles.tabItem,
              activeTab === tab.key && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === "overview"   && <OverviewTab      federationId={federationId} />}
        {activeTab === "annuities"  && <AnnuitiesHub      federationId={federationId} />}
        {activeTab === "entries"    && <EntriesTab       federationId={federationId} />}
        {activeTab === "open_items" && <OpenItemsTab     federationId={federationId} />}
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
