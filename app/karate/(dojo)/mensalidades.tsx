// ============================================================
// Aura Karatê (dojô) — Mensalidades (F3a) + Régua de cobrança (F3c)
//
// Três abas internas, mesmo padrão de app/karate/(dojo)/alunos.tsx:
//   • "Cobranças" — competência selecionada, resumo, gerar cobranças
//     do mês, lista com ações (Pix/Confirmar/Cancelar/WhatsApp vencidas)
//   • "Planos"    — CRUD de planos de mensalidade
//   • "Régua"     — lembretes automáticos por e-mail perto do vencimento
//
// Rota nova (não existe versão federada equivalente — não entra em
// FEDERATION_SHARED_SECTIONS do _layout do grupo).
// ============================================================
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { CobrancasTab } from "@/components/karate/dojoMensalidades/CobrancasTab";
import { PlanosSection } from "@/components/karate/dojoMensalidades/PlanosSection";
import { ReguaSection } from "@/components/karate/dojoMensalidades/regua/ReguaSection";

type TabKey = "cobrancas" | "planos" | "regua";

const TABS: [TabKey, string][] = [
  ["cobrancas", "Cobranças"],
  ["planos", "Planos"],
  ["regua", "Régua"],
];

export default function DojoMensalidades() {
  const { dojoName } = useKarateDojo();
  const [tab, setTab] = useState<TabKey>("cobrancas");

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>{dojoName}</Text>
        <Text style={styles.title}>Mensalidades</Text>
        <Text style={styles.lead}>Planos, assinaturas e cobranças dos alunos do seu dojô. Pagamento por Pix, direto com você.</Text>
        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabOn]}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.body}>
        {tab === "cobrancas" ? (
          <CobrancasTab onGoToPlanos={() => setTab("planos")} />
        ) : tab === "planos" ? (
          <PlanosSection />
        ) : (
          <ReguaSection />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  head: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  tabs: { flexDirection: "row", gap: 6, marginTop: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderTopLeftRadius: KarateRadius.sm, borderTopRightRadius: KarateRadius.sm, borderBottomWidth: 2, borderBottomColor: "transparent" } as ViewStyle,
  tabOn: { borderBottomColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  tabTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  body: { flex: 1 } as ViewStyle,
});
