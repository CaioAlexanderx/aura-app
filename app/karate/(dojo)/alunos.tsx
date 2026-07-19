// ============================================================
// Aura Karatê (dojô) — Alunos (F2)
//
// Duas abas internas:
//   • "Meus alunos"  — registro PRÓPRIO do dojô (CRUD + responsáveis +
//                      importação; Aura-backend PR #403 / migration 242)
//   • "Na federação" — praticantes FEDERADOS (read-only, F1) — o
//                      conteúdo da antiga praticantes.tsx, movido para
//                      components/karate/dojoAlunos/FederadosTab
//
// A rota antiga /karate/(dojo)/praticantes virou redirect fino pra cá.
// Abre em "Meus alunos": é o dado que o dojô controla.
// ============================================================
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { MeusAlunosTab } from "@/components/karate/dojoAlunos/MeusAlunosTab";
import { FederadosTab } from "@/components/karate/dojoAlunos/FederadosTab";

type TabKey = "meus" | "federacao";

const TABS: [TabKey, string][] = [
  ["meus", "Meus alunos"],
  ["federacao", "Na federação"],
];

export default function DojoAlunos() {
  const { dojoName } = useKarateDojo();
  const [tab, setTab] = useState<TabKey>("meus");

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>{dojoName}</Text>
        <Text style={styles.title}>Alunos</Text>
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
        {tab === "meus" ? <MeusAlunosTab /> : <FederadosTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  head: { paddingHorizontal: 16, paddingTop: 16 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  tabs: { flexDirection: "row", gap: 6, marginTop: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderTopLeftRadius: KarateRadius.sm, borderTopRightRadius: KarateRadius.sm, borderBottomWidth: 2, borderBottomColor: "transparent" } as ViewStyle,
  tabOn: { borderBottomColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  tabTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  body: { flex: 1 } as ViewStyle,
});
