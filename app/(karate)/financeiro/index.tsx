// ============================================================
// Financeiro — Aura Karatê
//
// Tela principal com 4 sub-tabs:
//   1. Visão Geral (DRE + fluxo de caixa)
//   2. Anuidades Dojô (tabela editável de porte + cobrança)
//   3. Anuidades CPF (praticantes individuais)
//   4. Saídas (despesas)
//
// Wired: GET /financial/overview, /financial/annuities/dojos,
//        /financial/annuities/cpf, /financial/expenses, /financial/fees
// MOCK: todos os endpoints com shapes fieis ao contrato
//       (karate-fase1-openapi.yaml) até backend responder.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ViewStyle,
  TextStyle,
} from "react-native";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { OverviewTab } from "./tabs/OverviewTab";
import { DojoAnnuitiesTab } from "./tabs/DojoAnnuitiesTab";
import { CpfAnnuitiesTab } from "./tabs/CpfAnnuitiesTab";
import { ExpensesTab } from "./tabs/ExpensesTab";

type Tab = "overview" | "dojos" | "cpf" | "saidas";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Visão Geral" },
  { key: "dojos",    label: "Anuidades Dojô" },
  { key: "cpf",      label: "Anuidades CPF" },
  { key: "saidas",   label: "Saídas" },
];

export default function FinanceiroScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { federationId } = useKarateFederation();

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
        {activeTab === "overview" && <OverviewTab federationId={federationId} />}
        {activeTab === "dojos"    && <DojoAnnuitiesTab federationId={federationId} />}
        {activeTab === "cpf"      && <CpfAnnuitiesTab federationId={federationId} />}
        {activeTab === "saidas"   && <ExpensesTab federationId={federationId} />}
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
