import { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Platform, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import type { Transaction } from "./types";
import { fmt } from "./types";

type Props = { transactions: Transaction[]; dreApi: any };

const COLORS = { green: "#059669", red: "#ef4444", amber: "#d97706", blue: "#2563eb", violet: "#7c3aed", teal: "#0d9488", pink: "#db2777" };
const EXPENSE_COLORS = ["#ef4444", "#f97316", "#eab308", "#ec4899", "#8b5cf6", "#3b82f6", "#14b8a6"];
const isWeb = Platform.OS === "web";

function fmtK(n: number) { return n >= 10000 ? `R$ ${(n/1000).toFixed(1)}k` : fmt(n); }

// ── Bar chart (HTML only, SVG inline) ──
function MonthlyChart({ data }: { data: { label: string; receita: number; despesa: number; resultado: number }[] }) {
  if (!isWeb || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.receita, d.despesa)), 1);
  const barH = 120;
  return (
    <View style={cs.chartCard}>
      <Text style={cs.chartTitle}>Receita vs Despesa mensal</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", alignItems: "flex-end", gap: 6, paddingVertical: 8, minHeight: barH + 30 }}>
        {data.map((d, i) => {
          const rH = Math.max((d.receita / maxVal) * barH, 4);
          const eH = Math.max((d.despesa / maxVal) * barH, 4);
          return (
            <View key={i} style={{ alignItems: "center", gap: 4, width: 56 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: barH }}>
                <View style={{ width: 18, height: rH, backgroundColor: COLORS.green, borderRadius: 4, opacity: 0.85 }} />
                <View style={{ width: 18, height: eH, backgroundColor: COLORS.red, borderRadius: 4, opacity: 0.7 }} />
              </View>
              <Text style={cs.chartLabel}>{d.label}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={cs.chartLegend}>
        <View style={cs.legendItem}><View style={[cs.legendDot, { backgroundColor: COLORS.green }]} /><Text style={cs.legendText}>Receita</Text></View>
        <View style={cs.legendItem}><View style={[cs.legendDot, { backgroundColor: COLORS.red }]} /><Text style={cs.legendText}>Despesa</Text></View>
      </View>
    </View>
  );
}

// ── Comparison card ──
function ComparisonCard({ label, current, previous, isMoney = true }: { label: string; current: number; previous: number; isMoney?: boolean }) {
  const diff = previous > 0 ? ((current - previous) / previous * 100) : 0;
  const up = diff >= 0;
  return (
    <View style={cs.compCard}>
      <Text style={cs.compLabel}>{label}</Text>
      <Text style={cs.compValue}>{isMoney ? fmtK(current) : current}</Text>
      {previous > 0 && (
        <View style={[cs.compBadge, { backgroundColor: up ? Colors.greenD : Colors.redD }]}>
          <Text style={[cs.compBadgeText, { color: up ? Colors.green : Colors.red }]}>{up ? "+" : ""}{diff.toFixed(1)}%</Text>
        </View>
      )}
      <Text style={cs.compPrev}>Anterior: {isMoney ? fmtK(previous) : previous}</Text>
    </View>
  );
}

// ── Employee ranking ──
function EmployeeRanking({ employees, prevEmployees }: { employees: any[]; prevEmployees: any[] }) {
  if (employees.length === 0) return null;
  const totalRev = employees.reduce((s: number, e: any) => s + e.total_revenue, 0);
  return (
    <View style={cs.section}>
      <Text style={cs.sectionTitle}>Ranking por vendedor(a)</Text>
      <View style={cs.card}>
        {employees.map((e: any, i: number) => {
          const pct = totalRev > 0 ? Math.round(e.total_revenue / totalRev * 100) : 0;
          const prev = prevEmployees.find((p: any) => p.name === e.name);
          const growth = prev && prev.total_revenue > 0 ? ((e.total_revenue - prev.total_revenue) / prev.total_revenue * 100) : null;
          return (
            <View key={e.name} style={[cs.empRow, i < employees.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
              <View style={[cs.empRank, i === 0 && { backgroundColor: Colors.amberD }]}>
                <Text style={[cs.empRankText, i === 0 && { color: Colors.amber }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cs.empName}>{e.name}</Text>
                <Text style={cs.empMeta}>{e.total_sales} vendas | Ticket: {fmt(e.avg_ticket)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={cs.empRev}>{fmtK(e.total_revenue)}</Text>
                <Text style={cs.empPct}>{pct}%</Text>
                {growth !== null && <Text style={[cs.empGrowth, { color: growth >= 0 ? Colors.green : Colors.red }]}>{growth >= 0 ? "+" : ""}{growth.toFixed(0)}%</Text>}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Donut chart ──
function DonutChart({ items, total, title }: { items: { category: string; total: number }[]; total: number; title: string }) {
  if (!isWeb || items.length === 0) return null;
  const size = 140, cx = 70, cy = 70, r = 52, sw = 22;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = items.map((item, i) => {
    const pct = item.total / total;
    const dash = circ * pct;
    const gap = circ - dash;
    const o = offset; offset += dash;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${EXPENSE_COLORS[i % EXPENSE_COLORS.length]}" stroke-width="${sw}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-o}" />`;
  }).join("");
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${Colors.bg4}" stroke-width="${sw}" />${slices}</svg>`;
  const center = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center"><div style="font-size:15px;font-weight:800;color:${Colors.ink}">${fmtK(total)}</div></div>`;
  return (
    <View style={cs.section}>
      <Text style={cs.sectionTitle}>{title}</Text>
      <View style={cs.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
          <div style={{ width: size, height: size, position: "relative" } as any} dangerouslySetInnerHTML={{ __html: svg + center }} />
          <View style={{ flex: 1, gap: 8 }}>
            {items.slice(0, 5).map((item, i) => {
              const pct = total > 0 ? Math.round(item.total / total * 100) : 0;
              return (
                <View key={item.category} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 12, color: Colors.ink, fontWeight: "500" }}>{item.category}</Text></View>
                  <Text style={{ fontSize: 11, color: Colors.ink3 }}>{pct}%</Text>
                  <Text style={{ fontSize: 11, color: Colors.ink, fontWeight: "600", minWidth: 65, textAlign: "right" }}>{fmtK(item.total)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Insights block ──
function InsightsBlock({ insights, current }: { insights: any; current: any }) {
  if (!insights) return null;
  const items: string[] = [];
  if (insights.best_month) items.push(`Melhor mes: ${insights.best_month.label} com ${fmtK(insights.best_month.receita)} de receita.`);
  if (insights.worst_month && insights.best_month && insights.worst_month.month !== insights.best_month.month) items.push(`Mes mais fraco: ${insights.worst_month.label} com ${fmtK(insights.worst_month.receita)}.`);
  if (insights.avg_monthly_receita > 0) items.push(`Media mensal: ${fmtK(insights.avg_monthly_receita)} de receita e ${fmtK(insights.avg_monthly_despesa)} de despesa.`);
  if (insights.avg_monthly_resultado > 0) items.push(`Resultado medio mensal: ${fmtK(insights.avg_monthly_resultado)} positivo.`);
  else if (insights.avg_monthly_resultado < 0) items.push(`Resultado medio mensal: ${fmtK(Math.abs(insights.avg_monthly_resultado))} negativo — atencao!`);
  if (current.margem_pct > 0 && current.margem_pct < 15) items.push(`Margem atual de ${current.margem_pct}% esta apertada. Ideal acima de 20%.`);
  if (current.resultado < 0) items.push(`Mes atual com resultado negativo de ${fmtK(Math.abs(current.resultado))}. Faturamento precisa crescer ou despesas reduzir.`);
  if (items.length === 0) return null;
  return (
    <View style={cs.insightsCard}>
      <Text style={cs.insightsTitle}>Insights automaticos</Text>
      {items.map((t, i) => <View key={i} style={cs.insightRow}><Text style={cs.insightBullet}>{"\u2022"}</Text><Text style={cs.insightText}>{t}</Text></View>)}
    </View>
  );
}

// ── Main component ──
export function TabResumo({ transactions, dreApi }: Props) {
  const { data, isLoading } = useFinancialAnalysis(7);

  if (isLoading) return <ListSkeleton rows={4} showCards />;
  if (!data || (data.monthly.length === 0 && transactions.length === 0)) {
    return <EmptyState icon="receipt" iconColor={Colors.violet3} title="Analise financeira" subtitle="Registre receitas e despesas para ativar a analise com indicadores, comparativos e graficos." />;
  }

  const d = data;

  // Health status
  const status = d.current.resultado > 0 && d.current.margem_pct >= 20 ? "Saudavel" : d.current.resultado > 0 ? "Atencao" : "Critico";
  const statusColor = status === "Saudavel" ? Colors.green : status === "Atencao" ? Colors.amber : Colors.red;
  const statusBg = status === "Saudavel" ? Colors.greenD : status === "Atencao" ? Colors.amberD : Colors.redD;

  return (
    <View>
      {/* Health hero */}
      <View style={cs.hero}>
        <View style={cs.heroTop}>
          <Text style={cs.heroLabel}>Saude financeira — mes atual</Text>
          <View style={[cs.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[cs.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[cs.statusText, { color: statusColor }]}>{status}</Text>
          </View>
        </View>
        <View style={cs.heroKpis}>
          <View style={cs.heroKpi}>
            <Text style={cs.heroKpiLabel}>Receita</Text>
            <Text style={[cs.heroKpiValue, { color: Colors.green }]}>{fmtK(d.current.receita)}</Text>
          </View>
          <View style={[cs.heroKpi, cs.heroKpiBorder]}>
            <Text style={cs.heroKpiLabel}>Despesas</Text>
            <Text style={[cs.heroKpiValue, { color: Colors.red }]}>{fmtK(d.current.despesa)}</Text>
          </View>
          <View style={cs.heroKpi}>
            <Text style={cs.heroKpiLabel}>Resultado</Text>
            <Text style={[cs.heroKpiValue, { color: d.current.resultado >= 0 ? Colors.green : Colors.red }]}>{fmtK(d.current.resultado)}</Text>
          </View>
        </View>
        {/* Expense bar */}
        <View style={cs.heroBar}>
          <View style={[cs.heroBarFill, { width: `${Math.min(d.current.despesa > 0 && d.current.receita > 0 ? (d.current.despesa / d.current.receita) * 100 : 0, 100)}%`, backgroundColor: statusColor }]} />
        </View>
      </View>

      {/* Period comparison cards */}
      <Text style={[cs.sectionTitle, { marginBottom: 10 }]}>Comparativo com mes anterior</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
        <ComparisonCard label="Receita" current={d.current.receita} previous={d.previous.receita} />
        <ComparisonCard label="Despesas" current={d.current.despesa} previous={d.previous.despesa} />
        <ComparisonCard label="Resultado" current={d.current.resultado} previous={d.previous.resultado} />
        <ComparisonCard label="Vendas" current={d.current.vendas} previous={d.previous.vendas} isMoney={false} />
        <ComparisonCard label="Ticket medio" current={d.current.avg_ticket} previous={d.previous.avg_ticket} />
      </ScrollView>

      {/* Monthly bar chart */}
      <MonthlyChart data={d.monthly} />

      {/* KPI strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20, marginTop: 4 }} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
        <View style={cs.kpiCard}><Text style={cs.kpiLabel}>Margem</Text><Text style={[cs.kpiValue, { color: d.current.margem_pct >= 20 ? Colors.green : d.current.margem_pct >= 0 ? Colors.amber : Colors.red }]}>{d.current.margem_pct}%</Text></View>
        <View style={cs.kpiCard}><Text style={cs.kpiLabel}>Ticket medio</Text><Text style={cs.kpiValue}>{fmt(d.current.avg_ticket)}</Text></View>
        <View style={cs.kpiCard}><Text style={cs.kpiLabel}>Lancamentos</Text><Text style={cs.kpiValue}>{d.current.lancamentos}</Text></View>
        <View style={cs.kpiCard}><Text style={cs.kpiLabel}>Media mensal</Text><Text style={[cs.kpiValue, { color: Colors.green }]}>{fmtK(d.insights.avg_monthly_receita)}</Text></View>
        {d.insights.meses_analisados > 0 && <View style={cs.kpiCard}><Text style={cs.kpiLabel}>Meses</Text><Text style={cs.kpiValue}>{d.insights.meses_analisados}</Text></View>}
      </ScrollView>

      {/* Employee ranking */}
      <EmployeeRanking employees={d.employees} prevEmployees={d.employeesPrev} />

      {/* Category donuts */}
      <DonutChart items={d.categoriesAll.expense} total={d.categoriesAll.expense.reduce((s, c) => s + c.total, 0)} title="Despesas por categoria (periodo)" />
      <DonutChart items={d.categoriesAll.income} total={d.categoriesAll.income.reduce((s, c) => s + c.total, 0)} title="Receitas por categoria (periodo)" />

      {/* Insights */}
      <InsightsBlock insights={d.insights} current={d.current} />

      <View style={cs.disclaimer}><Text style={cs.disclaimerText}>Valores calculados dos lancamentos registrados. Estimativas para apoio a decisao — nao substitui contabilidade oficial.</Text></View>
    </View>
  );
}

const cs = StyleSheet.create({
  hero: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  heroLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  heroKpis: { flexDirection: "row", marginBottom: 16 },
  heroKpi: { flex: 1, alignItems: "center", paddingVertical: 8 },
  heroKpiBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  heroKpiLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  heroKpiValue: { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  heroBar: { height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  heroBarFill: { height: 8, borderRadius: 4 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },

  compCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, minWidth: 140, alignItems: "center", gap: 4 },
  compLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
  compValue: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  compBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  compBadgeText: { fontSize: 11, fontWeight: "700" },
  compPrev: { fontSize: 9, color: Colors.ink3 },

  chartCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  chartTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700", marginBottom: 8 },
  chartLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "500" },
  chartLegend: { flexDirection: "row", gap: 16, marginTop: 8, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.ink3 },

  kpiCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, minWidth: 120, alignItems: "center" },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: "800", color: Colors.ink },

  empRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  empRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  empRankText: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  empName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  empMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  empRev: { fontSize: 14, color: Colors.green, fontWeight: "700" },
  empPct: { fontSize: 10, color: Colors.ink3 },
  empGrowth: { fontSize: 10, fontWeight: "600" },

  insightsCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20, gap: 10 },
  insightsTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  insightRow: { flexDirection: "row", gap: 8 },
  insightBullet: { fontSize: 14, color: Colors.violet3, fontWeight: "700", lineHeight: 20 },
  insightText: { fontSize: 12, color: Colors.ink3, lineHeight: 20, flex: 1 },

  disclaimer: { padding: 12, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  disclaimerText: { fontSize: 10, color: Colors.ink3, textAlign: "center", fontStyle: "italic" as any },
});

export { DonutChart, EXPENSE_COLORS };
export default TabResumo;
