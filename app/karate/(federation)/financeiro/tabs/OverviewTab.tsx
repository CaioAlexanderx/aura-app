// ============================================================
// OverviewTab — Visão Geral Financeira
//
// DRE (receitas, despesas, lucro líquido) + fluxo de caixa mensal
// + recebíveis projetados.
//
// Wired: GET /federation/{id}/financial/overview
// MOCK: dados gerados com shape fiel ao contrato.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { KPIStrip, KPIData } from "@/components/karate/KPIStrip";
import { Skeleton } from "@/components/karate/Skeleton";
import { karateApi, FinancialOverview, CashflowMonth } from "@/services/karateApi";

// ── MOCK ───────────────────────────────────────────────────
const MOCK_OVERVIEW: FinancialOverview = {
  period: { from: "2026-01-01", to: "2026-06-30" },
  dre: {
    revenue: [
      { category: "Anuidades Dojô", amount: 145200 },
      { category: "Anuidades CPF",  amount: 38400 },
      { category: "Outros",          amount: 4800 },
    ],
    expenses: [
      { category: "Repasses",         amount: 18000 },
      { category: "Certificados",     amount: 6400 },
      { category: "Prêmios/Trofeus",  amount: 3200 },
      { category: "Custos gerais",    amount: 12000 },
    ],
    net: 148800,
  },
  cashflow: [
    { month: "2026-01", inflow: 28000, outflow: 6000,  balance: 22000 },
    { month: "2026-02", inflow: 32000, outflow: 7500,  balance: 46500 },
    { month: "2026-03", inflow: 35000, outflow: 9200,  balance: 72300 },
    { month: "2026-04", inflow: 29800, outflow: 6400,  balance: 95700 },
    { month: "2026-05", inflow: 31200, outflow: 7800,  balance: 119100 },
    { month: "2026-06", inflow: 27400, outflow: 5700,  balance: 140800 },
  ],
  projected_receivables: [
    { due_date: "2026-07-10", amount: 18400 },
    { due_date: "2026-07-31", amount: 12000 },
    { due_date: "2026-08-15", amount: 9800 },
  ],
};

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(mo) - 1]}/${y.slice(2)}`;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={st.sectionTitle}>{children}</Text>;
}

function DRERow({ label, amount, isExpense }: { label: string; amount: number; isExpense?: boolean }) {
  return (
    <View style={st.dreRow} accessibilityLabel={`${label}: ${formatCurrency(amount)}`}>
      <Text style={st.dreLabel}>{label}</Text>
      <Text style={[st.dreAmount, isExpense && { color: KarateColors.danger }]}>
        {isExpense ? `- ${formatCurrency(amount)}` : formatCurrency(amount)}
      </Text>
    </View>
  );
}

function CashflowBar({ item, maxInflow }: { item: CashflowMonth; maxInflow: number }) {
  const barWidth = maxInflow > 0 ? (item.inflow / maxInflow) * 100 : 0;
  const outWidth = maxInflow > 0 ? (item.outflow / maxInflow) * 100 : 0;
  return (
    <View
      style={st.cfRow}
      accessibilityLabel={`${formatMonth(item.month)}: entrada ${formatCurrency(item.inflow)}, saída ${formatCurrency(item.outflow)}`}
    >
      <Text style={st.cfMonth}>{formatMonth(item.month)}</Text>
      <View style={st.cfBars}>
        <View style={[st.cfBar, st.cfBarIn,  { width: `${barWidth}%` as any }]} />
        <View style={[st.cfBar, st.cfBarOut, { width: `${outWidth}%` as any }]} />
      </View>
      <Text style={st.cfBalance}>{formatCurrency(item.balance)}</Text>
    </View>
  );
}

interface Props { federationId: string; }

export function OverviewTab({ federationId }: Props) {
  const [data, setData] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      // TODO: remover fallback MOCK quando backend responder
      const result = await karateApi.getFinancialOverview(federationId).catch(() => MOCK_OVERVIEW);
      setData(result);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue  = data?.dre.revenue.reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalExpenses = data?.dre.expenses.reduce((s, e) => s + e.amount, 0) ?? 0;
  const maxInflow = Math.max(...(data?.cashflow.map((c) => c.inflow) ?? [1]));

  const kpis: KPIData[] = data ? [
    { label: "Receita",   value: formatCurrency(totalRevenue),       accent: "ok" },
    { label: "Despesas",  value: formatCurrency(totalExpenses),      accent: "warn" },
    { label: "Líquido",   value: formatCurrency(data.dre.net),       accent: data.dre.net >= 0 ? "ok" : "danger" },
  ] : [];

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />
      }
    >
      {loading ? (
        <>
          <Skeleton height={80} style={{ marginBottom: 8 }} />
          <Skeleton height={160} style={{ marginBottom: 8 }} />
        </>
      ) : (
        <>
          {/* KPIs DRE */}
          <SectionTitle>Resultado do Período</SectionTitle>
          <KPIStrip kpis={kpis} />

          {/* DRE Receitas */}
          <SectionTitle>Receitas</SectionTitle>
          <View style={st.card}>
            {data?.dre.revenue.map((r) => <DRERow key={r.category} label={r.category} amount={r.amount} />)}
            <View style={st.totalRow}>
              <Text style={st.totalLabel}>Total Receitas</Text>
              <Text style={[st.totalAmount, { color: ShojiPalette.ok }]}>{formatCurrency(totalRevenue)}</Text>
            </View>
          </View>

          {/* DRE Despesas */}
          <SectionTitle>Despesas</SectionTitle>
          <View style={st.card}>
            {data?.dre.expenses.map((e) => <DRERow key={e.category} label={e.category} amount={e.amount} isExpense />)}
            <View style={st.totalRow}>
              <Text style={st.totalLabel}>Total Despesas</Text>
              <Text style={[st.totalAmount, { color: KarateColors.danger }]}>{formatCurrency(totalExpenses)}</Text>
            </View>
          </View>

          {/* Fluxo de Caixa */}
          <SectionTitle>Fluxo de Caixa</SectionTitle>
          <View style={st.card}>
            <View style={st.cfLegend}>
              <View style={st.cfLegendItem}>
                <View style={[st.cfLegendDot, { backgroundColor: ShojiPalette.ok }]} />
                <Text style={st.cfLegendLabel}>Entrada</Text>
              </View>
              <View style={st.cfLegendItem}>
                <View style={[st.cfLegendDot, { backgroundColor: KarateColors.danger }]} />
                <Text style={st.cfLegendLabel}>Saída</Text>
              </View>
            </View>
            {data?.cashflow.map((item) => (
              <CashflowBar key={item.month} item={item} maxInflow={maxInflow} />
            ))}
          </View>

          {/* Recebíveis projetados */}
          <SectionTitle>Recebíveis Projetados</SectionTitle>
          <View style={st.card}>
            {data?.projected_receivables.map((pr) => (
              <View key={pr.due_date} style={st.prRow} accessibilityLabel={`Vencimento ${pr.due_date}: ${formatCurrency(pr.amount)}`}>
                <Text style={st.prDate}>{new Date(pr.due_date).toLocaleDateString("pt-BR")}</Text>
                <Text style={st.prAmount}>{formatCurrency(pr.amount)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:       { padding: 16, gap: 8, paddingBottom: 40 } as ViewStyle,
  sectionTitle:  { fontSize: 11, fontWeight: "800", color: KarateColors.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 16, marginBottom: 6 } as TextStyle,
  card:          { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8 } as ViewStyle,
  dreRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } as ViewStyle,
  dreLabel:      { fontSize: 13, color: KarateColors.ink2 } as TextStyle,
  dreAmount:     { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  totalRow:      { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: KarateColors.border, paddingTop: 8, marginTop: 4 } as ViewStyle,
  totalLabel:    { fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  totalAmount:   { fontSize: 15, fontWeight: "900" } as TextStyle,
  cfRow:         { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 } as ViewStyle,
  cfMonth:       { width: 44, fontSize: 11, color: KarateColors.ink3, fontWeight: "600" } as TextStyle,
  cfBars:        { flex: 1, gap: 2 } as ViewStyle,
  cfBar:         { height: 6, borderRadius: 3 } as ViewStyle,
  cfBarIn:       { backgroundColor: ShojiPalette.ok } as ViewStyle,
  cfBarOut:      { backgroundColor: KarateColors.dangerSoft, borderWidth: 1, borderColor: KarateColors.danger } as ViewStyle,
  cfBalance:     { width: 82, fontSize: 11, fontWeight: "700", color: KarateColors.ink, textAlign: "right" } as TextStyle,
  cfLegend:      { flexDirection: "row", gap: 16, marginBottom: 4 } as ViewStyle,
  cfLegendItem:  { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  cfLegendDot:   { width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  cfLegendLabel: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  prRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } as ViewStyle,
  prDate:        { fontSize: 13, color: KarateColors.ink3 } as TextStyle,
  prAmount:      { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
});
