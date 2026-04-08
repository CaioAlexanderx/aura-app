import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useObligations } from "@/hooks/useObligations";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { FiscalHero } from "@/components/screens/contabilidade/FiscalHero";
import { PriorityStrip } from "@/components/screens/contabilidade/PriorityStrip";
import { CheckpointCard } from "@/components/screens/contabilidade/CheckpointCard";
import { Guide } from "@/components/screens/contabilidade/Guide";
import { GuidesList } from "@/components/screens/contabilidade/GuidesList";
import { HistoryTab } from "@/components/screens/contabilidade/HistoryTab";
import { TABS } from "@/components/screens/contabilidade/types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

export default function ContabilidadeScreen() {
  const [tab, setTab] = useState(0);
  const [guideCode, setGuideCode] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);

  const { obligations, regime, regimeLabel, total, done, pending, overdue, urgent, auraResolve, voceFaz, isLoading, isDemo, completeCheckpoint } = useObligations();

  const selectedObl = guideCode ? obligations.find(o => o.code === guideCode) : null;

  function handleTabSelect(i: number) {
    setTab(i);
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }

  function openGuide(code: string) {
    setGuideCode(code);
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }

  if (selectedObl) {
    return (
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        <Guide obligation={selectedObl} onBack={() => setGuideCode(null)} onComplete={completeCheckpoint} />
      </ScrollView>
    );
  }

  // Sort: overdue first, then by days_until_due
  const sortedPending = obligations
    .filter(o => o.status !== "done" && o.status !== "future")
    .sort((a, b) => (a.days_until_due ?? 999) - (b.days_until_due ?? 999));

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Contabilidade</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {TABS.map((t, i) => <Pressable key={t} onPress={() => handleTabSelect(i)} style={[s.tab, tab === i && s.tabActive]}><Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text></Pressable>)}
      </ScrollView>

      {isLoading && <ListSkeleton rows={4} showCards />}

      {/* Tab 0: Visao Geral */}
      {tab === 0 && (
        <View>
          <FiscalHero regime={regime} regimeLabel={regimeLabel} total={total} done={done} pending={pending} overdue={overdue} auraResolveCount={auraResolve.length} voceFazCount={voceFaz.length} />

          {urgent.length > 0 && <PriorityStrip items={urgent} onSelect={openGuide} />}

          {/* Proximas obrigacoes */}
          {sortedPending.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={s.sectionTitle}>Proximas obrigacoes</Text>
              <View style={s.grid}>
                {sortedPending.map(o => <View key={o.code} style={s.gridItem}><CheckpointCard obligation={o} onGuide={() => openGuide(o.code)} /></View>)}
              </View>
            </View>
          )}

          {/* Concluidas */}
          {done > 0 && (
            <View>
              <View style={s.sectionHeader}><Text style={s.sectionTitle}>Concluidas</Text><Text style={s.sectionCount}>{done}</Text></View>
              <View style={s.grid}>
                {obligations.filter(o => o.status === "done").map(o => <View key={o.code} style={s.gridItem}><CheckpointCard obligation={o} onGuide={() => openGuide(o.code)} /></View>)}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Tab 1: Obrigacoes (todas) */}
      {tab === 1 && (
        <View>
          <View style={s.grid}>
            {obligations.map(o => <View key={o.code} style={s.gridItem}><CheckpointCard obligation={o} onGuide={() => openGuide(o.code)} /></View>)}
          </View>
        </View>
      )}

      {/* Tab 2: Guias */}
      {tab === 2 && <GuidesList auraResolve={auraResolve} voceFaz={voceFaz} onSelect={openGuide} />}

      {/* Tab 3: Historico */}
      {tab === 3 && <HistoryTab />}

      <View style={{ alignItems: "center", paddingVertical: 12 }}><Text style={{ fontSize: 10, color: Colors.ink3, fontStyle: "italic" }}>Estimativas para apoio contabil informativo.</Text></View>

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionCount: { fontSize: 12, color: Colors.green, fontWeight: "700", backgroundColor: Colors.greenD, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: IS_WIDE ? "48.5%" : "100%", flexShrink: 0 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
