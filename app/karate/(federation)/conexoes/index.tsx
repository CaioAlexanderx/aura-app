// ============================================================
// Conexões — Aura Karatê (federação) · Shoji
//
// Container de 2 abas de nível superior (H3 + convergência 27/07/2026):
//   1. "Filiações" (FiliacoesTab)    — inbox self-serve de pedidos de
//      filiação (karate_affiliation_requests). A federação NUNCA abre
//      filiação pelo dojô — é SEMPRE o dojô que se filia. É a PÁGINA
//      PRINCIPAL — sem aprovação aqui o dojô não existe pra federação.
//   2. "Praticantes" (SolicitacoesTab) — fila de solicitações de praticante
//      (criação/transferência) vindas dos dojôs, pra federação
//      conferir/numerar/aprovar. Nome interno do componente ("Solicitações")
//      preservado — é o rótulo do domínio de praticante, não da aba.
//
// A aba "Sincronização" (ConexoesTab — native/manual/reconnect) SAIU do
// container (27/07/2026): expunha uma feature parqueada e vazia. O
// componente ConexoesTab.tsx NÃO foi apagado (pode voltar), só não é mais
// importado/renderizado aqui.
//
// CONVERGÊNCIA (27/07/2026): a extinta rota /karate/filiacao (F6) virou
// a aba "Filiações" aqui — era uma tela IRMÃ que a investigação
// confirmou ser o único inbox real de filiação (karate_dojo_connections/
// "Conectar dojô" é config de sincronia pós-vínculo, sempre esteve
// parqueada e vazia). /karate/filiacao segue viva como redirect fino
// para /karate/conexoes?tab=filiacoes (não quebra bookmarks/links).
//
// Sub-navegação por QUERY PARAM (mesmo padrão do hub de Anuidades e da
// tela de Dojôs): ?tab=filiacoes | ?tab=solicitacoes abre a aba certa no
// boot. O antigo ?tab=conexoes (apontava pra "Sincronização", agora fora
// do container) cai graciosamente na aba default (Filiações) — não
// quebra, não dá erro.
//
// Badges de pendentes nas abas "Filiações" e "Praticantes": busca leve
// (getMetrics/getPractitionerRequestMetrics) independente do fetch
// completo que cada aba faz pra si mesma — cada aba cuida do próprio
// dado, mesma separação de responsabilidade de DojosListTab/CadastralTab.
// Refaz no foco da tela (useFocusEffect) pra não ficar com número stale
// depois de aprovar/rejeitar e voltar pra cá.
// ============================================================
import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { KarateColors, ShojiPalette } from "@/constants/karateTheme";
import { SolicitacoesTab } from "./tabs/SolicitacoesTab";
import { FiliacoesTab } from "./tabs/FiliacoesTab";
import { karateApi } from "@/services/karateApi";
import { karateAffiliationApi } from "@/services/karateAffiliationApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

type Tab = "filiacoes" | "solicitacoes";

const firstParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default function ConexoesScreen() {
  const { federationId } = useKarateFederation();

  // Deep-link: ?tab=<...> abre a aba certa no boot (lazy useState
  // initializer, mesmo padrão do hub de Anuidades/Dojôs) — depois disso o
  // usuário navega livremente pelas abas. Default = Filiações: é o novo
  // inbox principal (sem filiação aprovada, o dojô nem existe pra
  // federação) — mais urgente que a fila de praticantes de um dojô que
  // já está dentro.
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const raw = firstParam(params.tab);
    // ?tab=conexoes é o nome antigo (apontava pra "Sincronização", que
    // saiu do container) — cai graciosamente no default (Filiações).
    if (raw === "solicitacoes") return "solicitacoes";
    return "filiacoes";
  });

  const [pendentesPraticantes, setPendentesPraticantes] = useState<number | null>(null);
  const [pendentesFiliacoes, setPendentesFiliacoes] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    if (!federationId) return;
    let cancelled = false;
    karateApi.getPractitionerRequestMetrics(federationId)
      .then((m) => { if (!cancelled) setPendentesPraticantes(m.pendentes); })
      .catch(() => { if (!cancelled) setPendentesPraticantes(null); });
    karateAffiliationApi.getMetrics(federationId)
      .then((m) => { if (!cancelled) setPendentesFiliacoes(m.pending); })
      .catch(() => { if (!cancelled) setPendentesFiliacoes(null); });
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
          style={[styles.tabItem, activeTab === "filiacoes" && styles.tabItemActive]}
          onPress={() => setActiveTab("filiacoes")}
          accessibilityRole="tab"
          accessibilityLabel="Filiações"
          accessibilityState={{ selected: activeTab === "filiacoes" }}
        >
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabLabel, activeTab === "filiacoes" && styles.tabLabelActive]}>
              Filiações
            </Text>
            {!!pendentesFiliacoes && pendentesFiliacoes > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{pendentesFiliacoes > 99 ? "99+" : pendentesFiliacoes}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "solicitacoes" && styles.tabItemActive]}
          onPress={() => setActiveTab("solicitacoes")}
          accessibilityRole="tab"
          accessibilityLabel="Praticantes"
          accessibilityState={{ selected: activeTab === "solicitacoes" }}
        >
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabLabel, activeTab === "solicitacoes" && styles.tabLabelActive]}>
              Praticantes
            </Text>
            {!!pendentesPraticantes && pendentesPraticantes > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{pendentesPraticantes > 99 ? "99+" : pendentesPraticantes}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === "filiacoes" && <FiliacoesTab />}
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
