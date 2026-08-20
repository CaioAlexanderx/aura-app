// ============================================================
// AURA DOJÔ — P0 Hub de Campeonatos: CAMPEONATOS (tela do dojô)
//
// Duas abas, mesmo shell de eventos.tsx:
//   "Campeonatos"  → vitrine dos campeonatos 'open' da federação
//                    (cara de engine de eventos: card com data, local,
//                    divisões e "a partir de"), CTA → carrinho da
//                    delegação em /karate/(dojo)/campeonatos/[cid].
//   "Meus pedidos" → pedidos de delegação do dojô com status do
//                    pagamento/conferência + comprovante.
//
// Gate de conexão: a vitrine devolve { not_linked } (200, nunca 403 mudo)
// → CTA para /karate/(dojo)/conexao, mesmo padrão da aba "Da federação".
// ============================================================
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateFonts, KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { useDojoSectionLabel } from "@/components/karate/DojoShell";
import { VitrineTab } from "@/components/karate/dojoCampeonatos/VitrineTab";
import { PedidosTab } from "@/components/karate/dojoCampeonatos/PedidosTab";

type TabKey = "vitrine" | "pedidos";

const TABS: [TabKey, string][] = [
  ["vitrine", "Campeonatos"],
  ["pedidos", "Meus pedidos"],
];

export default function DojoCampeonatos() {
  const { dojoName } = useKarateDojo();
  const [tab, setTab] = useState<TabKey>("vitrine");
  useDojoSectionLabel("Campeonatos");

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>{dojoName}</Text>
        <Text style={styles.title}>Campeonatos</Text>
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
        {tab === "vitrine" ? <VitrineTab /> : <PedidosTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  head: { paddingHorizontal: 16, paddingTop: 16 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,
  title: { fontSize: 24, fontFamily: KarateFonts.heading, fontWeight: "400", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  tabs: { flexDirection: "row", gap: 6, marginTop: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderTopLeftRadius: KarateRadius.sm, borderTopRightRadius: KarateRadius.sm, borderBottomWidth: 2, borderBottomColor: "transparent" } as ViewStyle,
  tabOn: { borderBottomColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  tabTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  body: { flex: 1 } as ViewStyle,
});
