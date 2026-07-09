// ============================================================
// OverviewTab — Visão Geral Financeira · Shoji
// DRE + fluxo de caixa + recebíveis. Dados reais.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, RefreshControl, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { ShojiBackground, SectionHead, Card, KpiBand, Mono, Body } from "@/components/karate/shoji";
import { karateApi, FinancialOverview, CashflowMonth } from "@/services/karateApi";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtMonth = (m: string) => { const [y, mo] = m.split("-"); const M = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]; return `${M[parseInt(mo) - 1]}/${y.slice(2)}`; };

export function OverviewTab({ federationId }: { federationId: string }) {
  const [data, setData] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try { setData(await karateApi.getFinancialOverview(federationId)); } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  const totalRev = data?.dre.revenue.reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalExp = data?.dre.expenses.reduce((s, e) => s + e.amount, 0) ?? 0;
  const maxInflow = Math.max(...(data?.cashflow.map((c) => c.inflow) ?? [1]));

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}>
        {loading ? <><Skeleton height={100} style={{ marginBottom: 16, borderRadius: R.xl }} /><Skeleton height={180} style={{ borderRadius: R.xl }} /></> : <>
          <KpiBand items={[
            { label: "Receita", value: fmt(totalRev) },
            { label: "Despesas", value: fmt(totalExp) },
            { label: "Líquido", value: fmt(data!.dre.net), accent: data!.dre.net < 0 },
          ]} />

          <View style={styles.section}>
            <SectionHead title="Receitas" />
            <Card>
              {data?.dre.revenue.map((r) => <DRE key={r.category} label={r.category} amount={r.amount} />)}
              <View style={styles.total}><Text style={styles.totalLbl}>Total receitas</Text><Mono style={{ color: C.ok, fontSize: 15 }}>{fmt(totalRev)}</Mono></View>
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHead title="Despesas" />
            <Card>
              {data?.dre.expenses.map((e) => <DRE key={e.category} label={e.category} amount={e.amount} expense />)}
              <View style={styles.total}><Text style={styles.totalLbl}>Total saídas</Text><Mono style={{ color: P.red, fontSize: 15 }}>− {fmt(totalExp)}</Mono></View>
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHead title="Fluxo de caixa" />
            <Card>
              {(data?.cashflow ?? []).length === 0 ? (
                <KarateEmptyState icon="trending-up" title="Sem movimentações no período" style={{ paddingVertical: 24 }} />
              ) : (
                <>
                  <View style={styles.legend}>
                    <Leg c={C.ok} l="Entrada" /><Leg c={P.red} l="Saída" />
                  </View>
                  {data?.cashflow.map((m) => <CashRow key={m.month} m={m} max={maxInflow} />)}
                </>
              )}
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHead title="Recebíveis projetados" />
            <Card>
              {(data?.projected_receivables ?? []).length === 0 ? <Body muted>Sem recebíveis projetados.</Body>
                : data!.projected_receivables.map((pr, i) => (
                  <View key={pr.due_date} style={[styles.prRow, i === data!.projected_receivables.length - 1 && { borderBottomWidth: 0 }]}>
                    <Body muted>{new Date(pr.due_date).toLocaleDateString("pt-BR")}</Body>
                    <Mono style={{ color: C.ink }}>{fmt(pr.amount)}</Mono>
                  </View>
                ))}
            </Card>
          </View>
        </>}
      </ScrollView>
    </ShojiBackground>
  );
}

function DRE({ label, amount, expense }: { label: string; amount: number; expense?: boolean }) {
  return <View style={styles.dre}><Body muted style={{ flex: 1 }}>{label}</Body><Mono style={{ color: expense ? P.red : C.ink }}>{expense ? "− " : ""}{fmt(amount)}</Mono></View>;
}
function Leg({ c, l }: { c: string; l: string }) {
  return <View style={styles.legItem}><View style={[styles.legDot, { backgroundColor: c }]} /><Body muted style={{ fontSize: 11 }}>{l}</Body></View>;
}
function CashRow({ m, max }: { m: CashflowMonth; max: number }) {
  const inW = max > 0 ? (m.inflow / max) * 100 : 0;
  const outW = max > 0 ? (m.outflow / max) * 100 : 0;
  return (
    <View style={styles.cf}>
      <Mono style={{ width: 48, fontSize: 11, color: C.ink3 }}>{fmtMonth(m.month)}</Mono>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.cfTrack}><View style={[styles.cfFill, { width: `${inW}%`, backgroundColor: C.ok }]} /></View>
        <View style={styles.cfTrack}><View style={[styles.cfFill, { width: `${outW}%`, backgroundColor: P.red }]} /></View>
      </View>
      <Mono style={{ width: 84, textAlign: "right", fontSize: 11, color: C.ink }}>{fmt(m.balance)}</Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 32, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  section: { marginTop: SP[8] } as ViewStyle,
  dre: { flexDirection: "row", alignItems: "center", paddingVertical: 7 } as ViewStyle,
  total: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, marginTop: 6 } as ViewStyle,
  totalLbl: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: C.ink } as TextStyle,
  legend: { flexDirection: "row", gap: 16, marginBottom: 8 } as ViewStyle,
  legItem: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  legDot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  cf: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 } as ViewStyle,
  cfTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(43,38,32,0.06)", overflow: "hidden" } as ViewStyle,
  cfFill: { height: "100%", borderRadius: 3 } as ViewStyle,
  prRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
});
