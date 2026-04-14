import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import type { Transaction, PeriodKey } from "./types";
import { fmt, fmtK, PERIODS } from "./types";

type Props = { transactions: Transaction[]; dreApi: any; period?: PeriodKey };
const isWeb = Platform.OS === "web";

// Aura palette — consistent with the rest of the app
const PAL = {
  green: Colors.green,
  red: Colors.red,
  amber: Colors.amber,
  violet: "#7c3aed",
  violet2: "#a78bfa",
  violet3: Colors.violet3,
  violetD: Colors.violetD,
  teal: "#0d9488",
};
const EMP_COLORS = [PAL.violet, PAL.teal, "#6366f1", PAL.amber, PAL.violet2];
const BAR_COLORS = [PAL.violet, "#6366f1", PAL.teal, PAL.amber, PAL.violet2, "#818cf8", "#2dd4bf"];

// ── Hover card wrapper ──
function Card({ children, style, noPad }: any) {
  const [h, sH] = useState(false);
  return (
    <Pressable
      onHoverIn={isWeb ? () => sH(true) : undefined}
      onHoverOut={isWeb ? () => sH(false) : undefined}
      style={[
        cs.card,
        noPad && { padding: 0 },
        h && { borderColor: Colors.border2, transform: [{ translateY: -1 }] },
        isWeb && { transition: "all 0.25s ease" } as any,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={cs.secTitle}>{title}</Text>
      {hint && <Text style={cs.secHint}>{hint}</Text>}
    </View>
  );
}

// ── Velocity Hero ──
function VelocityHero({ velocity, current, previous }: any) {
  const trend = velocity.tendencia_pct;
  const tColor = trend >= 0 ? PAL.green : PAL.red;
  const marginColor = current.margem_pct >= 20 ? PAL.green : current.margem_pct >= 10 ? PAL.amber : PAL.red;
  return (
    <Card style={{ marginBottom: 16, padding: 22 }}>
      <View style={cs.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={cs.heroLabel}>FATURAMENTO PERIODO</Text>
          <Text style={[cs.heroValue, { color: PAL.green }]}>{fmtK(current.receita)}</Text>
          {velocity.projecao_mes > 0 && <Text style={cs.heroSub}>Projecao: {fmtK(velocity.projecao_mes)}</Text>}
        </View>
        <View style={cs.velBox}>
          <Text style={cs.velLabel}>VELOCIDADE</Text>
          <Text style={[cs.velValue, { color: tColor }]}>{fmtK(velocity.media_dia_7d)}/dia</Text>
          <View style={[cs.trendBadge, { backgroundColor: trend >= 0 ? Colors.greenD : Colors.redD }]}>
            <Text style={[cs.trendText, { color: tColor }]}>{trend >= 0 ? "+" : ""}{trend.toFixed(0)}%</Text>
          </View>
        </View>
      </View>
      <View style={cs.heroStrip}>
        <View style={cs.stripItem}><Text style={cs.stripLabel}>Vendas/dia</Text><Text style={cs.stripVal}>{velocity.vendas_por_dia}</Text></View>
        <View style={cs.stripItem}><Text style={cs.stripLabel}>Ticket medio</Text><Text style={cs.stripVal}>{fmt(current.avg_ticket)}</Text></View>
        <View style={cs.stripItem}><Text style={cs.stripLabel}>Resultado</Text><Text style={[cs.stripVal, { color: current.resultado >= 0 ? PAL.green : PAL.red }]}>{current.resultado >= 0 ? "+" : ""}{fmtK(current.resultado)}</Text></View>
        <View style={cs.stripItem}><Text style={cs.stripLabel}>Margem</Text><Text style={[cs.stripVal, { color: marginColor }]}>{current.margem_pct}%</Text></View>
      </View>
    </Card>
  );
}

// ── Comparison Cards ──
function CompCards({ current, previous }: any) {
  function Comp({ label, cur, prev, money = true, color }: any) {
    const diff = prev > 0 ? ((cur - prev) / prev * 100) : 0;
    const up = diff >= 0;
    const [h, sH] = useState(false);
    return (
      <Pressable
        onHoverIn={isWeb ? () => sH(true) : undefined}
        onHoverOut={isWeb ? () => sH(false) : undefined}
        style={[cs.compCard, h && { borderColor: Colors.border2, transform: [{ scale: 1.02 }] }, isWeb && { transition: "all 0.2s ease" } as any]}
      >
        <Text style={cs.compLabel}>{label}</Text>
        <Text style={[cs.compValue, color && { color }]}>{money ? fmtK(cur) : cur}</Text>
        {prev > 0 && (
          <View style={[cs.badge, { backgroundColor: up ? Colors.greenD : Colors.redD }]}>
            <Text style={[cs.badgeText, { color: up ? PAL.green : PAL.red }]}>{up ? "+" : ""}{diff.toFixed(1)}%</Text>
          </View>
        )}
      </Pressable>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
      <Comp label="Receita" cur={current.receita} prev={previous.receita} color={PAL.green} />
      <Comp label="Despesas" cur={current.despesa} prev={previous.despesa} color={PAL.red} />
      <Comp label="Vendas" cur={current.vendas} prev={previous.vendas} money={false} />
      <Comp label="Ticket" cur={current.avg_ticket} prev={previous.avg_ticket} />
    </ScrollView>
  );
}

// ── Monthly Chart ──
function MonthlyChart({ data }: { data: any[] }) {
  if (!isWeb || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.receita, d.despesa)), 1);
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle title="Receita vs Despesa" hint="Comparativo mensal" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", alignItems: "flex-end", gap: 6, paddingVertical: 8, minHeight: 150 }}>
        {data.map(function(d, i) {
          return (
            <View key={i} style={{ alignItems: "center", gap: 4, width: 56 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 130 }}>
                <View style={[cs.chartBar, { height: Math.max((d.receita / maxVal) * 130, 4), backgroundColor: PAL.violet, opacity: 0.85 }, isWeb && { transition: "height 0.4s ease" } as any]} />
                <View style={[cs.chartBar, { height: Math.max((d.despesa / maxVal) * 130, 4), backgroundColor: PAL.red, opacity: 0.5 }, isWeb && { transition: "height 0.4s ease" } as any]} />
              </View>
              <Text style={cs.chartLabel}>{d.label}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={cs.legendRow}>
        <View style={cs.legendItem}><View style={[cs.legendDot, { backgroundColor: PAL.violet }]} /><Text style={cs.legendText}>Receita</Text></View>
        <View style={cs.legendItem}><View style={[cs.legendDot, { backgroundColor: PAL.red, opacity: 0.5 }]} /><Text style={cs.legendText}>Despesa</Text></View>
      </View>
    </Card>
  );
}

// ── Day of Week ──
function DayOfWeekSection({ data, insights }: { data: any[]; insights: any }) {
  if (data.length === 0) return null;
  const maxFat = Math.max(...data.map(d => d.faturamento), 1);
  var DOW_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle title="Vendas por dia da semana" hint={insights.melhor_dia_semana ? "Melhor: " + insights.melhor_dia_semana + " | Mais fraco: " + insights.pior_dia_semana : undefined} />
      <View style={{ gap: 8, marginTop: 4 }}>
        {data.map(function(d) {
          var pct = (d.faturamento / maxFat) * 100;
          var isTop = d.label === insights.melhor_dia_semana;
          return (
            <View key={d.dow} style={cs.dowRow}>
              <Text style={[cs.dowLabel, isTop && { color: PAL.violet3, fontWeight: "700" }]}>{DOW_NAMES[d.dow] || d.label}</Text>
              <View style={cs.dowBarBg}>
                <View style={[cs.dowBarFill, { width: pct + "%", backgroundColor: isTop ? PAL.violet : PAL.violet2 + "55" }, isWeb && { transition: "width 0.5s ease" } as any]} />
              </View>
              <Text style={cs.dowVal}>{d.vendas}v</Text>
              <Text style={[cs.dowVal, { color: PAL.green, minWidth: 70, textAlign: "right" }]}>{fmtK(d.faturamento)}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ── Employee Ranking ──
function EmployeeRanking({ employees }: { employees: any[] }) {
  if (employees.length === 0) return null;
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle title="Performance por vendedor(a)" />
      {employees.map(function(e, i) {
        var [h, sH] = useState(false);
        return (
          <Pressable key={e.name}
            onHoverIn={isWeb ? function() { sH(true); } : undefined}
            onHoverOut={isWeb ? function() { sH(false); } : undefined}
            style={[cs.empRow, h && { backgroundColor: Colors.bg4 }, i < employees.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }, isWeb && { transition: "background-color 0.15s ease" } as any]}
          >
            <View style={[cs.empRank, i === 0 && { backgroundColor: Colors.amberD, borderColor: Colors.amber + "33" }]}>
              <Text style={[cs.empRankText, i === 0 && { color: Colors.amber }]}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={cs.empName}>{e.name}</Text>
              <Text style={cs.empMeta}>{e.vendas} vendas | Ticket: {fmt(e.ticket_medio)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={cs.empRev}>{fmtK(e.faturamento)}</Text>
              <View style={cs.pctBar}>
                <View style={[cs.pctBarFill, { width: e.pct_total + "%", backgroundColor: EMP_COLORS[i % EMP_COLORS.length] }, isWeb && { transition: "width 0.4s ease" } as any]} />
              </View>
              <Text style={cs.empPct}>{e.pct_total}%</Text>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

// ── Ticket Distribution ──
function TicketDistribution({ data }: { data: any[] }) {
  if (data.length === 0) return null;
  var maxV = Math.max(...data.map(function(d) { return d.vendas; }), 1);
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle title="Distribuicao de ticket" hint="Faixas de valor das suas vendas" />
      <View style={{ gap: 6, marginTop: 4 }}>
        {data.map(function(d, i) {
          return (
            <View key={d.faixa} style={cs.dowRow}>
              <Text style={[cs.dowLabel, { width: 90 }]}>{d.faixa}</Text>
              <View style={cs.dowBarBg}>
                <View style={[cs.dowBarFill, { width: (d.vendas / maxV) * 100 + "%", backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }, isWeb && { transition: "width 0.5s ease" } as any]} />
              </View>
              <Text style={cs.dowVal}>{d.vendas}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ── Weekly Trend ──
function WeeklyTrend({ data }: { data: any[] }) {
  if (!isWeb || data.length < 3) return null;
  var maxF = Math.max(...data.map(function(d) { return d.faturamento; }), 1);
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle title="Tendencia semanal" hint="Ultimas 12 semanas" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", alignItems: "flex-end", gap: 4, paddingVertical: 8, minHeight: 100 }}>
        {data.map(function(w, i) {
          return (
            <View key={i} style={{ alignItems: "center", gap: 4, width: 48 }}>
              <View style={[cs.chartBar, { width: 32, height: Math.max((w.faturamento / maxF) * 80, 4), backgroundColor: PAL.violet, opacity: 0.5 + (i / data.length) * 0.5 }, isWeb && { transition: "height 0.4s ease, opacity 0.4s ease" } as any]} />
              <Text style={cs.chartLabel}>{w.semana}</Text>
            </View>
          );
        })}
      </ScrollView>
    </Card>
  );
}

// ── Top Customers ──
function TopCustomers({ data }: { data: any[] }) {
  if (data.length === 0) return null;
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle title="Clientes mais recorrentes" hint="2+ compras no periodo" />
      {data.slice(0, 10).map(function(c, i) {
        var [h, sH] = useState(false);
        return (
          <Pressable key={i}
            onHoverIn={isWeb ? function() { sH(true); } : undefined}
            onHoverOut={isWeb ? function() { sH(false); } : undefined}
            style={[cs.custRow, h && { backgroundColor: Colors.bg4 }, i < Math.min(data.length, 10) - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }, isWeb && { transition: "background-color 0.15s ease" } as any]}
          >
            <View style={{ flex: 1 }}>
              <Text style={cs.custName}>{c.cliente}</Text>
              <Text style={cs.custMeta}>{c.compras} compras | Ticket: {fmt(c.ticket_medio)}</Text>
            </View>
            <Text style={cs.custTotal}>{fmtK(c.total_gasto)}</Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

// ── Insights ──
function InsightsBlock({ insights, velocity, current, employees }: any) {
  if (!insights) return null;
  var items: string[] = [];
  if (velocity?.projecao_mes > 0) items.push("Projecao para o mes: " + fmtK(velocity.projecao_mes) + " baseado na velocidade de " + fmtK(velocity.media_dia_7d) + "/dia.");
  if (velocity?.tendencia_pct > 10) items.push("Velocidade acelerou " + velocity.tendencia_pct.toFixed(0) + "% na ultima semana vs media 30 dias.");
  if (velocity?.tendencia_pct < -10) items.push("Velocidade caiu " + Math.abs(velocity.tendencia_pct).toFixed(0) + "%. Avaliar acoes de marketing.");
  if (insights.melhor_dia_semana) items.push(insights.melhor_dia_semana + " e o melhor dia. Reforce equipe e estoque.");
  if (insights.best_month) items.push("Melhor mes: " + insights.best_month.label + " com " + fmtK(insights.best_month.receita) + ".");
  if (employees?.length >= 2) items.push(employees[0].name + " lidera com " + employees[0].pct_total + "% do faturamento (" + employees[0].vendas + " vendas).");
  if (insights.ticket_medio_geral > 0) items.push("Ticket medio geral: " + fmt(insights.ticket_medio_geral) + ".");
  if (current?.margem_pct > 0 && current.margem_pct < 15) items.push("Margem de " + current.margem_pct + "% apertada. Revisar custos.");
  if (items.length === 0) return null;
  return (
    <Card style={{ marginBottom: 16, borderColor: PAL.violet + "33" }}>
      <SectionTitle title="Insights automaticos" />
      {items.map(function(t, i) {
        return (
          <View key={i} style={cs.insightRow}>
            <View style={cs.insightDot} />
            <Text style={cs.insightText}>{t}</Text>
          </View>
        );
      })}
    </Card>
  );
}

// ── Main ──
export function TabResumo({ transactions, dreApi, period }: Props) {
  var { data, isLoading } = useFinancialAnalysis(13);
  if (isLoading) return <ListSkeleton rows={4} showCards />;
  if (!data || (data.monthly.length === 0 && transactions.length === 0)) {
    return <EmptyState icon="receipt" iconColor={PAL.violet3} title="Analise financeira" subtitle="Registre receitas e despesas para ativar a analise completa." />;
  }
  var d = data;
  return (
    <View>
      <VelocityHero velocity={d.velocity} current={d.current} previous={d.previous} />
      <CompCards current={d.current} previous={d.previous} />
      <MonthlyChart data={d.monthly} />
      <DayOfWeekSection data={d.dayOfWeek} insights={d.insights} />
      <EmployeeRanking employees={d.employees} />
      <TicketDistribution data={d.ticketDistribution} />
      <WeeklyTrend data={d.weeklyTrend} />
      <TopCustomers data={d.topCustomers} />
      <InsightsBlock insights={d.insights} velocity={d.velocity} current={d.current} employees={d.employees} />
      <View style={cs.disclaimer}><Text style={cs.disclaimerText}>Estimativas para apoio a decisao — nao substitui contabilidade oficial.</Text></View>
    </View>
  );
}

const cs = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 0,
  },
  secTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  secHint: { fontSize: 10, color: Colors.ink3, marginTop: 2 },

  // Hero
  heroRow: { flexDirection: "row", gap: 16 },
  heroLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.8, marginBottom: 4 },
  heroValue: { fontSize: 30, fontWeight: "800", letterSpacing: -1 },
  heroSub: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  velBox: { alignItems: "flex-end", justifyContent: "center" },
  velLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.8, marginBottom: 2 },
  velValue: { fontSize: 18, fontWeight: "800" },
  trendBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  trendText: { fontSize: 11, fontWeight: "700" },
  heroStrip: { flexDirection: "row", marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  stripItem: { flex: 1, alignItems: "center" },
  stripLabel: { fontSize: 9, color: Colors.ink3, letterSpacing: 0.4, marginBottom: 3 },
  stripVal: { fontSize: 14, fontWeight: "700", color: Colors.ink },

  // Comparison
  compCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, minWidth: 125, alignItems: "center", gap: 6 },
  compLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
  compValue: { fontSize: 17, fontWeight: "800", color: Colors.ink },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  // Charts
  chartBar: { width: 20, borderRadius: 4 },
  chartLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "500" },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 8, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },

  // Day of week
  dowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dowLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "500", width: 30 },
  dowBarBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.bg4, overflow: "hidden" },
  dowBarFill: { height: 10, borderRadius: 5 },
  dowVal: { fontSize: 10, color: Colors.ink3, fontWeight: "600", minWidth: 28, textAlign: "right" },

  // Employees
  empRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10 },
  empRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  empRankText: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  empName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  empMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  empRev: { fontSize: 14, color: PAL.green, fontWeight: "700" },
  empPct: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  pctBar: { width: 60, height: 5, borderRadius: 3, backgroundColor: Colors.bg4, marginTop: 3, overflow: "hidden" },
  pctBarFill: { height: 5, borderRadius: 3 },

  // Customers
  custRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, gap: 8, borderRadius: 10 },
  custName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  custMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  custTotal: { fontSize: 13, color: PAL.green, fontWeight: "700" },

  // Insights
  insightRow: { flexDirection: "row", gap: 10, marginTop: 8, alignItems: "flex-start" },
  insightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PAL.violet, marginTop: 7, flexShrink: 0 },
  insightText: { fontSize: 12, color: Colors.ink3, lineHeight: 20, flex: 1 },

  // Disclaimer
  disclaimer: { padding: 12, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  disclaimerText: { fontSize: 10, color: Colors.ink3, textAlign: "center", fontStyle: "italic" as any },
});

export default TabResumo;
