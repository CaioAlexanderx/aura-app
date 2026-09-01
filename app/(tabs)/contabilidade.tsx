import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useObligations } from "@/hooks/useObligations";
import { ListSkeleton } from "@/components/ListSkeleton";
import { FiscalHero } from "@/components/screens/contabilidade/FiscalHero";
import { DasPreviewCard } from "@/components/screens/contabilidade/DasPreviewCard";
import { UpcomingAlerts } from "@/components/screens/contabilidade/UpcomingAlerts";
import { ObligationTimeline } from "@/components/screens/contabilidade/ObligationTimeline";
import { AuraAutoSection } from "@/components/screens/contabilidade/AuraAutoSection";
import { Guide } from "@/components/screens/contabilidade/Guide";
import { GuidesList } from "@/components/screens/contabilidade/GuidesList";
import { HistoryTab } from "@/components/screens/contabilidade/HistoryTab";
import { TABS, AURA_AUTO_FEATURES } from "@/components/screens/contabilidade/types";
import { AgentBanner } from "@/components/AgentBanner";
import { ScreenHero, ScreenTabs } from "@/components/ScreenHero";
import { pluralize } from "@/utils/plural";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

// 01/09/2026 (QA onda 2) — RÓTULO NÃO É ID.
//
// TABS vem de screens/contabilidade/types.ts com o valor "Visao Geral", sem
// acento. Esse valor é comparado em código e assertado em teste: acentuá-lo
// quebra os dois. Então o valor fica como está e a tela ganha este mapa —
// só o que o usuário LÊ é acentuado. Aba nova sem entrada aqui cai no
// próprio id, que é o comportamento de antes.
const TAB_LABELS: Record<string, string> = {
  "Visao Geral": "Visão Geral",
};

// 19/08/2026 (QA — dedup de header): prop `embedded?: boolean` (default
// false, varejo não muda) suprime o <Text style={pageTitle}>Contabilidade</Text>
// quando a tela é embutida em app/studio/(estudio)/gestao/contabilidade.tsx,
// que já renderiza seu próprio título "Contabilidade do estúdio" + subtítulo.
export default function ContabilidadeScreen({ embedded }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState(0);
  const [guideCode, setGuideCode] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);

  const { obligations, regime, regimeLabel, total, done, pending, overdue, auraResolve, voceFaz, isLoading, isDemo, completeCheckpoint } = useObligations();

  const selectedObl = guideCode ? obligations.find(o => o.code === guideCode) : null;
  const autoFeatures = AURA_AUTO_FEATURES[regime === "mei" ? "mei" : "simples"] || [];
  const timelinePending = obligations.filter(o => o.status !== "done" && o.status !== "future").sort((a, b) => (a.days_until_due ?? 999) - (b.days_until_due ?? 999));
  const timelineDone = obligations.filter(o => o.status === "done");
  const timelineFuture = obligations.filter(o => o.status === "future");

  function handleTabSelect(i: number) { setTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }
  function openGuide(code: string) { setGuideCode(code); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  if (selectedObl) {
    return (
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        <Guide obligation={selectedObl} onBack={() => setGuideCode(null)} onComplete={completeCheckpoint} />
      </ScrollView>
    );
  }

  // Subtítulo do cabeçalho: quantas obrigações estão em dia, quantas faltam e
  // quantas já venceram. É a única pergunta que a tela responde, e a ordem é a
  // da leitura ("o que já está resolvido / o que falta / o que dói").
  // A concordância vem do pluralize (utils/plural.ts): o hero da tela dizia
  // "Falta 3 obrigacoes".
  const heroSub = isLoading
    ? "Carregando suas obrigações do período…"
    : (
      <>
        {done} de {total} {total === 1 ? "obrigação em dia" : "obrigações em dia"}
        {pending > 0 ? (
          <Text style={{ color: Colors.amber, fontWeight: "600" }}>
            {" · " + (pending === 1 ? "falta " : "faltam ") + pluralize(pending, "obrigação")}
          </Text>
        ) : null}
        {overdue > 0 ? (
          <Text style={{ color: Colors.red, fontWeight: "600" }}>
            {" · " + pluralize(overdue, "vencida")}
          </Text>
        ) : pending === 0 ? (
          <Text style={{ color: Colors.green, fontWeight: "600" }}>{" · tudo em dia"}</Text>
        ) : null}
      </>
    );

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      {/* 01/09/2026 (QA onda 2 — cabeçalho unificado): o título solto de 22px
          virou o mesmo ScreenHero de /estoque, /clientes e /vendas. Embutida no
          Studio o cabeçalho continua suprimido (o wrapper de lá já tem o dele). */}
      {!embedded && (
        <ScreenHero
          eyebrow="Obrigações fiscais"
          title="Contabilidade"
          live
          badge={regimeLabel}
          subtitle={heroSub}
        />
      )}

      <AgentBanner context="contabil" />

      <ScreenTabs
        tabs={TABS.map((t) => ({ key: t, label: TAB_LABELS[t] || t }))}
        active={TABS[tab]}
        onSelect={(k) => handleTabSelect(TABS.indexOf(k))}
      />

      {isLoading && <ListSkeleton rows={4} showCards />}

      {tab === 0 && (
        <View>
          <FiscalHero regimeLabel={regimeLabel} actionable={total} done={done} pending={pending} overdue={overdue} />
          <DasPreviewCard />
          <UpcomingAlerts obligations={obligations} onGuide={openGuide} />
          {timelineDone.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <View style={s.sectionHeader}><Text style={s.sectionTitle}>Concluídas</Text><Text style={s.sectionCount}>{timelineDone.length}</Text></View>
              <ObligationTimeline items={timelineDone} onGuide={openGuide} />
            </View>
          )}
          {timelineFuture.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={[s.sectionTitle, { color: Colors.ink3 }]}>Futuras</Text>
              <ObligationTimeline items={timelineFuture} onGuide={openGuide} />
            </View>
          )}
          <AuraAutoSection features={autoFeatures} />
        </View>
      )}
      {tab === 1 && <ObligationTimeline items={[...timelinePending, ...timelineDone, ...timelineFuture]} onGuide={openGuide} />}
      {tab === 2 && <GuidesList auraResolve={auraResolve} voceFaz={voceFaz} onSelect={openGuide} />}
      {tab === 3 && <HistoryTab />}

      <View style={{ alignItems: "center", paddingVertical: 12 }}><Text style={{ fontSize: 10, color: Colors.ink3, fontStyle: "italic" }}>Estimativas para apoio contábil informativo.</Text></View>
      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionCount: { fontSize: 12, color: Colors.green, fontWeight: "700", backgroundColor: Colors.greenD, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
