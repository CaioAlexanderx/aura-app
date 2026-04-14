import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import type { Transaction } from "./types";
import { fmt } from "./types";
import { EmployeeDonut, EmployeeMonthlyChart, RevenueTrendLine } from "./FinancialCharts";

type Props = { transactions: Transaction[]; dreApi: any };
const isWeb = Platform.OS === "web";
const COLORS = { green: "#059669", red: "#ef4444", amber: "#d97706", blue: "#2563eb", violet: "#7c3aed", teal: "#0d9488", pink: "#db2777" };
const EMP_COLORS = ["#7c3aed", "#0d9488", "#2563eb", "#db2777", "#d97706"];
const EXPENSE_COLORS = ["#ef4444", "#f97316", "#eab308", "#ec4899", "#8b5cf6", "#3b82f6", "#14b8a6"];
function fmtK(n: number) { return n >= 10000 ? `R$ ${(n/1000).toFixed(1)}k` : fmt(n); }

function Card({ children, style }: any) { return <View style={[cs.card, style]}>{children}</View>; }

// -- Velocity hero --
function VelocityHero({ velocity, current, previous }: any) {
  const trend = velocity.tendencia_pct;
  const tColor = trend >= 0 ? Colors.green : Colors.red;
  return (
    <Card style={cs.hero}>
      <View style={cs.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={cs.heroLabel}>FATURAMENTO MES ATUAL</Text>
          <Text style={[cs.heroValue, { color: Colors.green }]}>{fmtK(current.receita)}</Text>
          <Text style={cs.heroSub}>Projecao: {fmtK(velocity.projecao_mes)}</Text>
        </View>
        <View style={cs.velBox}>
          <Text style={cs.velLabel}>VELOCIDADE</Text>
          <Text style={[cs.velValue, { color: tColor }]}>{fmtK(velocity.media_dia_7d)}/dia</Text>
          <Text style={[cs.velTrend, { color: tColor }]}>{trend >= 0 ? "+" : ""}{trend.toFixed(0)}% vs 30d</Text>
        </View>
      </View>
      <View style={cs.heroStrip}>
        <View style={cs.stripItem}><Text style={cs.stripLabel}>Vendas/dia</Text><Text style={cs.stripVal}>{velocity.vendas_por_dia}</Text></View>
        <View style={cs.stripItem}><Text style={cs.stripLabel}>Ticket medio</Text><Text style={cs.stripVal}>{fmt(current.avg_ticket)}</Text></View>
        <View style={cs.stripItem}><Text style={cs.stripLabel}>Resultado</Text><Text style={[cs.stripVal, { color: current.resultado >= 0 ? Colors.green : Colors.red }]}>{fmtK(current.resultado)}</Text></View>
        <View style={cs.stripItem}><Text style={cs.stripLabel}>Margem</Text><Text style={[cs.stripVal, { color: current.margem_pct >= 20 ? Colors.green : Colors.amber }]}>{current.margem_pct}%</Text></View>
      </View>
    </Card>
  );
}

// -- Comparison cards --
function CompCards({ current, previous }: any) {
  function Comp({ label, cur, prev, money = true }: any) {
    const diff = prev > 0 ? ((cur - prev) / prev * 100) : 0;
    const up = diff >= 0;
    return (
      <View style={cs.compCard}>
        <Text style={cs.compLabel}>{label}</Text>
        <Text style={cs.compValue}>{money ? fmtK(cur) : cur}</Text>
        {prev > 0 && <View style={[cs.badge, { backgroundColor: up ? Colors.greenD : Colors.redD }]}><Text style={[cs.badgeText, { color: up ? Colors.green : Colors.red }]}>{up ? "+" : ""}{diff.toFixed(1)}%</Text></View>}
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
      <Comp label="Receita" cur={current.receita} prev={previous.receita} />
      <Comp label="Despesas" cur={current.despesa} prev={previous.despesa} />
      <Comp label="Vendas" cur={current.vendas} prev={previous.vendas} money={false} />
      <Comp label="Ticket" cur={current.avg_ticket} prev={previous.avg_ticket} />
    </ScrollView>
  );
}

// -- Monthly chart --
function MonthlyChart({ data }: { data: any[] }) {
  if (!isWeb || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.receita, d.despesa)), 1);
  return (
    <Card style={{ marginBottom: 16 }}>
      <Text style={cs.secTitle}>Receita vs Despesa mensal</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", alignItems: "flex-end", gap: 6, paddingVertical: 8, minHeight: 140 }}>
        {data.map((d, i) => (
          <View key={i} style={{ alignItems: "center", gap: 4, width: 56 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 120 }}>
              <View style={{ width: 18, height: Math.max((d.receita / maxVal) * 120, 4), backgroundColor: COLORS.green, borderRadius: 4, opacity: 0.85 }} />
              <View style={{ width: 18, height: Math.max((d.despesa / maxVal) * 120, 4), backgroundColor: COLORS.red, borderRadius: 4, opacity: 0.7 }} />
            </View>
            <Text style={cs.chartLabel}>{d.label}</Text>
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}

// -- Day of week bars --
function DayOfWeekSection({ data, insights }: { data: any[]; insights: any }) {
  if (data.length === 0) return null;
  const maxFat = Math.max(...data.map(d => d.faturamento), 1);
  const DOW_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  return (
    <Card style={{ marginBottom: 16 }}>
      <Text style={cs.secTitle}>Vendas por dia da semana</Text>
      {insights.melhor_dia_semana && <Text style={cs.secHint}>Melhor dia: {insights.melhor_dia_semana} | Mais fraco: {insights.pior_dia_semana}</Text>}
      <View style={{ gap: 8, marginTop: 8 }}>
        {data.map(d => {
          const pct = (d.faturamento / maxFat) * 100;
          const isTop = d.label === insights.melhor_dia_semana;
          return (
            <View key={d.dow} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[cs.dowLabel, isTop && { color: Colors.violet3, fontWeight: "700" }]}>{DOW_NAMES[d.dow] || d.label}</Text>
              <View style={cs.dowBarBg}>
                <View style={[cs.dowBarFill, { width: `${pct}%`, backgroundColor: isTop ? Colors.violet : Colors.violet3 + "66" }]} />
              </View>
              <Text style={cs.dowValue}>{d.vendas}v</Text>
              <Text style={[cs.dowValue, { color: Colors.green, minWidth: 70, textAlign: "right" }]}>{fmtK(d.faturamento)}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// -- Employee ranking v2 --
function EmployeeRanking({ employees }: { employees: any[] }) {
  if (employees.length === 0) return null;
  return (
    <Card style={{ marginBottom: 16 }}>
      <Text style={cs.secTitle}>Performance por vendedor(a)</Text>
      {employees.map((e: any, i: number) => (
        <View key={e.name} style={[cs.empRow, i < employees.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
          <View style={[cs.empRank, i === 0 && { backgroundColor: Colors.amberD }]}>
            <Text style={[cs.empRankText, i === 0 && { color: Colors.amber }]}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={cs.empName}>{e.name}</Text>
            <Text style={cs.empMeta}>{e.vendas} vendas | Ticket: {fmt(e.ticket_medio)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={cs.empRev}>{fmtK(e.faturamento)}</Text>
            <View style={cs.pctBar}>
              <View style={[cs.pctBarFill, { width: `${e.pct_total}%`, backgroundColor: EMP_COLORS[i % EMP_COLORS.length] }]} />
            </View>
            <Text style={cs.empPct}>{e.pct_total}% do total</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

// -- Ticket distribution --
function TicketDistribution({ data }: { data: any[] }) {
  if (data.length === 0) return null;
  const maxV = Math.max(...data.map(d => d.vendas), 1);
  return (
    <Card style={{ marginBottom: 16 }}>
      <Text style={cs.secTitle}>Distribuicao de ticket</Text>
      <Text style={cs.secHint}>Em quais faixas de valor suas vendas se concentram</Text>
      <View style={{ gap: 6, marginTop: 8 }}>
        {data.map((d, i) => (
          <View key={d.faixa} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[cs.dowLabel, { width: 90 }]}>{d.faixa}</Text>
            <View style={cs.dowBarBg}>
              <View style={[cs.dowBarFill, { width: `${(d.vendas / maxV) * 100}%`, backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }]} />
            </View>
            <Text style={cs.dowValue}>{d.vendas}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// -- Top customers --
function TopCustomers({ data }: { data: any[] }) {
  if (data.length === 0) return null;
  return (
    <Card style={{ marginBottom: 16 }}>
      <Text style={cs.secTitle}>Clientes mais recorrentes</Text>
      <Text style={cs.secHint}>Clientes que compraram 2+ vezes no periodo</Text>
      {data.slice(0, 10).map((c, i) => (
        <View key={i} style={[cs.custRow, i < Math.min(data.length, 10) - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={cs.custName}>{c.cliente}</Text>
            <Text style={cs.custMeta}>{c.compras} compras | Ticket: {fmt(c.ticket_medio)}</Text>
          </View>
          <Text style={cs.custTotal}>{fmtK(c.total_gasto)}</Text>
        </View>
      ))}
    </Card>
  );
}

// -- Weekly trend mini chart --
function WeeklyTrend({ data }: { data: any[] }) {
  if (!isWeb || data.length < 3) return null;
  const maxF = Math.max(...data.map(d => d.faturamento), 1);
  return (
    <Card style={{ marginBottom: 16 }}>
      <Text style={cs.secTitle}>Tendencia semanal (12 semanas)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", alignItems: "flex-end", gap: 4, paddingVertical: 8, minHeight: 100 }}>
        {data.map((w, i) => (
          <View key={i} style={{ alignItems: "center", gap: 4, width: 48 }}>
            <View style={{ width: 32, height: Math.max((w.faturamento / maxF) * 80, 4), backgroundColor: Colors.violet, borderRadius: 4, opacity: 0.7 + (i / data.length) * 0.3 }} />
            <Text style={cs.chartLabel}>{w.semana}</Text>
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}

// -- Insights v2 --
function InsightsBlock({ insights, velocity, current, employees }: any) {
  if (!insights) return null;
  const items: string[] = [];
  if (velocity?.projecao_mes > 0) items.push(`Projecao para este mes: ${fmtK(velocity.projecao_mes)} baseado na velocidade atual de ${fmtK(velocity.media_dia_7d)}/dia.`);
  if (velocity?.tendencia_pct > 10) items.push(`Velocidade de vendas acelerou ${velocity.tendencia_pct.toFixed(0)}% na ultima semana comparado com a media de 30 dias.`);
  if (velocity?.tendencia_pct < -10) items.push(`Velocidade de vendas caiu ${Math.abs(velocity.tendencia_pct).toFixed(0)}% na ultima semana. Avaliar acoes de marketing ou promocoes.`);
  if (insights.melhor_dia_semana) items.push(`${insights.melhor_dia_semana} e o dia com mais faturamento. Considere reforcar equipe e estoque neste dia.`);
  if (insights.best_month) items.push(`Melhor mes foi ${insights.best_month.label} com ${fmtK(insights.best_month.receita)}.`);
  if (employees?.length >= 2) {
    const top = employees[0];
    items.push(`${top.name} lidera com ${top.pct_total}% do faturamento total (${top.vendas} vendas).`);
  }
  if (insights.ticket_medio_geral > 0) items.push(`Ticket medio geral do periodo: ${fmt(insights.ticket_medio_geral)}.`);
  if (current?.margem_pct > 0 && current.margem_pct < 15) items.push(`Margem de ${current.margem_pct}% esta apertada. Revisar precificacao ou custos.`);
  if (items.length === 0) return null;
  return (
    <Card style={{ marginBottom: 16, borderColor: Colors.border2 }}>
      <Text style={cs.secTitle}>Insights automaticos</Text>
      {items.map((t, i) => <View key={i} style={cs.insightRow}><Text style={cs.insightBullet}>\u2022</Text><Text style={cs.insightText}>{t}</Text></View>)}
    </Card>
  );
}

// ── Main ──
export function TabResumo({ transactions, dreApi }: Props) {
  const { data, isLoading } = useFinancialAnalysis(13);
  if (isLoading) return <ListSkeleton rows={4} showCards />;
  if (!data || (data.monthly.length === 0 && transactions.length === 0)) {
    return <EmptyState icon="receipt" iconColor={Colors.violet3} title="Analise financeira" subtitle="Registre receitas e despesas para ativar a analise completa do negocio." />;
  }
  const d = data;
  return (
    <View>
      <VelocityHero velocity={d.velocity} current={d.current} previous={d.previous} />
      <CompCards current={d.current} previous={d.previous} />
      <MonthlyChart data={d.monthly} />
      <RevenueTrendLine monthly={d.monthly} />
      <DayOfWeekSection data={d.dayOfWeek} insights={d.insights} />
      <EmployeeRanking employees={d.employees} />
      <EmployeeDonut employees={d.employees} />
      <EmployeeMonthlyChart data={d.employeeMonthly} employees={d.employees.map((e: any) => e.name)} />
      <TicketDistribution data={d.ticketDistribution} />
      <WeeklyTrend data={d.weeklyTrend} />
      <TopCustomers data={d.topCustomers} />
      <InsightsBlock insights={d.insights} velocity={d.velocity} current={d.current} employees={d.employees} />
      <View style={cs.disclaimer}><Text style={cs.disclaimerText}>Estimativas para apoio a decisao — nao substitui contabilidade oficial.</Text></View>
    </View>
  );
}

const cs = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 0 },
  hero: { marginBottom: 16, padding: 20 },
  heroRow: { flexDirection: "row", gap: 16 },
  heroLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.8, marginBottom: 4 },
  heroValue: { fontSize: 28, fontWeight: "800", letterSpacing: -1 },
  heroSub: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  velBox: { alignItems: "flex-end", justifyContent: "center" },
  velLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.8, marginBottom: 2 },
  velValue: { fontSize: 18, fontWeight: "800" },
  velTrend: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  heroStrip: { flexDirection: "row", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  stripItem: { flex: 1, alignItems: "center" },
  stripLabel: { fontSize: 9, color: Colors.ink3, letterSpacing: 0.5, marginBottom: 2 },
  stripVal: { fontSize: 14, fontWeight: "700", color: Colors.ink },

  compCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, minWidth: 120, alignItems: "center", gap: 4 },
  compLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
  compValue: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  secTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  secHint: { fontSize: 10, color: Colors.ink3, marginBottom: 4 },
  chartLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "500" },

  dowLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "500", width: 30 },
  dowBarBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.bg4, overflow: "hidden" },
  dowBarFill: { height: 10, borderRadius: 5 },
  dowValue: { fontSize: 10, color: Colors.ink3, fontWeight: "600", minWidth: 28, textAlign: "right" },

  empRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  empRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  empRankText: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  empName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  empMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  empRev: { fontSize: 14, color: Colors.green, fontWeight: "700" },
  empPct: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  pctBar: { width: 60, height: 4, borderRadius: 2, backgroundColor: Colors.bg4, marginTop: 3, overflow: "hidden" },
  pctBarFill: { height: 4, borderRadius: 2 },

  custRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  custName: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  custMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  custTotal: { fontSize: 13, color: Colors.green, fontWeight: "700" },

  insightRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  insightBullet: { fontSize: 14, color: Colors.violet3, fontWeight: "700", lineHeight: 20 },
  insightText: { fontSize: 12, color: Colors.ink3, lineHeight: 20, flex: 1 },

  disclaimer: { padding: 12, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  disclaimerText: { fontSize: 10, color: Colors.ink3, textAlign: "center", fontStyle: "italic" as any },
});

export default TabResumo;
