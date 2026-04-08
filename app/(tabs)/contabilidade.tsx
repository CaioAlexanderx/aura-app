import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useObligations } from "@/hooks/useObligations";
import { ListSkeleton } from "@/components/ListSkeleton";
import { FiscalHero } from "@/components/screens/contabilidade/FiscalHero";
import { ObligationTimeline } from "@/components/screens/contabilidade/ObligationTimeline";
import { Guide } from "@/components/screens/contabilidade/Guide";
import { GuidesList } from "@/components/screens/contabilidade/GuidesList";
import { HistoryTab } from "@/components/screens/contabilidade/HistoryTab";
import { TABS } from "@/components/screens/contabilidade/types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

export default function ContabilidadeScreen() {
  const [tab, setTab] = useState(0);
  const [guideCode, setGuideCode] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);

  const { obligations, regimeLabel, total, done, pending, overdue, auraResolve, voceFaz, isLoading, isDemo, completeCheckpoint } = useObligations();

  const selectedObl = guideCode ? obligations.find(o => o.code === guideCode) : null;

  // Exclude "future" from donut count
  const actionable = obligations.filter(o => o.status !== "future");
  const actionableTotal = actionable.length;
  const actionableDone = actionable.filter(o => o.status === "done").length;
  const actionablePending = actionable.filter(o => o.status !== "done").length;

  // Sort for timeline: pending/overdue first by days, then done
  const timelinePending = obligations.filter(o => o.status !== "done" && o.status !== "future").sort((a, b) => (a.days_until_due ?? 999) - (b.days_until_due ?? 999));
  const timelineDone = obligations.filter(o => o.status === "done");
  const timelineFuture = obligations.filter(o => o.status === "future");
  const timeline = [...timelinePending, ...timelineDone, ...timelineFuture];

  function handleTabSelect(i: number) { setTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }
  function openGuide(code: string) { setGuideCode(code); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  if (selectedObl) {
    return (
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        <Guide obligation={selectedObl} onBack={() => setGuideCode(null)} onComplete={completeCheckpoint} />
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Contabilidade</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {TABS.map((t, i) => <Pressable key={t} onPress={() => handleTabSelect(i)} style={[s.tab, tab === i && s.tabActive]}><Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text></Pressable>)}
      </ScrollView>

      {isLoading && <ListSkeleton rows={4} showCards />}

      {/* Tab 0: Visao Geral — Timeline */}
      {tab === 0 && (
        <View>
          <FiscalHero regimeLabel={regimeLabel} actionable={actionableTotal} done={actionableDone} pending={actionablePending} overdue={overdue} />

          {timelinePending.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={s.sectionTitle}>Pendentes</Text>
              <ObligationTimeline items={timelinePending} onGuide={openGuide} />
            </View>
          )}

          {timelineDone.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <View style={s.sectionHeader}><Text style={s.sectionTitle}>Concluidas</Text><Text style={s.sectionCount}>{timelineDone.length}</Text></View>
              <ObligationTimeline items={timelineDone} onGuide={openGuide} />
            </View>
          )}

          {timelineFuture.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={[s.sectionTitle, { color: Colors.ink3 }]}>Futuras</Text>
              <ObligationTimeline items={timelineFuture} onGuide={openGuide} />
            </View>
          )}
        </View>
      )}

      {/* Tab 1: Obrigacoes (todas) */}
      {tab === 1 && <ObligationTimeline items={timeline} onGuide={openGuide} />}

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
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
