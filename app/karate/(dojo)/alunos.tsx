// ============================================================
// Aura Karatê (dojô) — Alunos (F2 + F11.3)
//
// Três abas internas:
//   • "Meus alunos"       — registro PRÓPRIO do dojô (CRUD + responsáveis +
//                           importação; Aura-backend PR #403 / migration 242)
//   • "Na federação"      — praticantes FEDERADOS (read-only, F1) — o
//                           conteúdo da antiga praticantes.tsx, movido para
//                           components/karate/dojoAlunos/FederadosTab
//   • "Revisão do plantel"— F11.3 (migration 276): o sensei marca quem do
//                           plantel HERDADO do registro federativo treina de
//                           fato com ele. É a MESMA lista da aba "Na
//                           federação", que hoje é só leitura — por isso a
//                           revisão mora aqui ao lado, e não numa seção nova
//                           do menu: é a mesma pergunta ("quem é meu aluno?")
//                           sobre o mesmo conjunto de pessoas.
//
// ⚠️ A revisão NÃO inativa ninguém — ela gera AVISOS para a federação
// decidir (ver RevisaoPlantelTab e ConcluirRevisaoModal). O badge da aba
// conta quem ainda está SEM MARCAÇÃO, nunca "quem será removido".
//
// A rota antiga /karate/(dojo)/praticantes virou redirect fino pra cá.
// Abre em "Meus alunos": é o dado que o dojô controla.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { MeusAlunosTab } from "@/components/karate/dojoAlunos/MeusAlunosTab";
import { FederadosTab } from "@/components/karate/dojoAlunos/FederadosTab";
import { RevisaoPlantelTab } from "@/components/karate/dojoAlunos/RevisaoPlantelTab";
import { karateDojoRosterReviewApi, RosterSummary } from "@/services/karateDojoRosterReviewApi";

type TabKey = "meus" | "federacao" | "revisao";

const TABS: [TabKey, string][] = [
  ["meus", "Meus alunos"],
  ["federacao", "Na federação"],
  ["revisao", "Revisão do plantel"],
];

export default function DojoAlunos() {
  const { dojoName } = useKarateDojo();
  const { federationId } = useKarateFederation();
  const [tab, setTab] = useState<TabKey>("meus");

  // Badge da aba: quantos praticantes herdados ainda estão SEM MARCAÇÃO.
  // Chamada leve e independente (GET de estado não cria revisão nenhuma);
  // falhar aqui só esconde o badge — nunca atrapalha as outras abas.
  const [pendentes, setPendentes] = useState<number | null>(null);

  useEffect(() => {
    if (!federationId) return;
    let cancelled = false;
    karateDojoRosterReviewApi.getState(federationId)
      .then((s) => { if (!cancelled) setPendentes(s.summary.pending); })
      .catch(() => { if (!cancelled) setPendentes(null); });
    return () => { cancelled = true; };
  }, [federationId]);

  // useCallback: a aba guarda este callback numa ref, mas manter a
  // identidade estável evita re-render em cascata a cada marcação.
  const handleSummary = useCallback((s: RosterSummary) => setPendentes(s.pending), []);

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
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>{label}</Text>
                {key === "revisao" && !!pendentes && pendentes > 0 && (
                  <View style={styles.badge} accessibilityLabel={`${pendentes} praticantes sem marcação`}>
                    <Text style={styles.badgeTxt}>{pendentes > 99 ? "99+" : pendentes}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.body}>
        {tab === "meus" && <MeusAlunosTab />}
        {tab === "federacao" && <FederadosTab />}
        {tab === "revisao" && <RevisaoPlantelTab onSummaryChange={handleSummary} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  head: { paddingHorizontal: 16, paddingTop: 16 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  tabs: { flexDirection: "row", gap: 6, marginTop: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border, flexWrap: "wrap" } as ViewStyle,
  tab: { paddingVertical: 9, paddingHorizontal: 14, borderTopLeftRadius: KarateRadius.sm, borderTopRightRadius: KarateRadius.sm, borderBottomWidth: 2, borderBottomColor: "transparent" } as ViewStyle,
  tabOn: { borderBottomColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  tabLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  tabTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  badge: { backgroundColor: KarateColors.primary, borderRadius: 999, minWidth: 17, height: 17, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" } as ViewStyle,
  badgeTxt: { fontSize: 10, fontWeight: "800", color: "#fdf8f2" } as TextStyle,
  body: { flex: 1 } as ViewStyle,
});
