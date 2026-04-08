import { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import type { Transaction } from "./types";
import { fmt } from "./types";

type Props = { transactions: Transaction[]; dreApi: any };

// P-01: Higher contrast donut palette
const INCOME_COLORS = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];
const EXPENSE_COLORS = ["#ef4444", "#f87171", "#fb923c", "#fbbf24", "#f472b6", "#a78bfa", "#60a5fa"];

function DonutChart({ items, total, colorFn }: { items: { category: string; amount: number }[]; total: number; colorFn: (i: number) => string }) {
  if (Platform.OS !== "web" || total <= 0) return null;
  const size = 160, cx = 80, cy = 80, r = 60, sw = 24;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = items.map((item, i) => {
    const pct = item.amount / total;
    const dash = circ * pct;
    const gap = circ - dash;
    const o = offset;
    offset += dash;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colorFn(i)}" stroke-width="${sw}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-o}" style="transition:stroke-dashoffset 0.6s ease" />`;
  }).join("");
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${Colors.bg4}" stroke-width="${sw}" />${slices}</svg>`;
  return <div style={{ width: size, height: size, position: "relative" } as any} dangerouslySetInnerHTML={{ __html: svg + `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center"><div style="font-size:18px;font-weight:800;color:${Colors.ink}">${fmt(total)}</div><div style="font-size:10px;color:${Colors.ink3}">total</div></div>` }} />;
}

// P-04: Reusable donut export for ABC estoque
export { DonutChart, INCOME_COLORS, EXPENSE_COLORS };

function HealthHero({ income, expenses, balance, marginPct }: { income: number; expenses: number; balance: number; marginPct: number }) {
  const status = balance > 0 && marginPct >= 20 ? "Saudavel" : balance > 0 ? "Atencao" : "Critico";
  const statusColor = status === "Saudavel" ? Colors.green : status === "Atencao" ? Colors.amber : Colors.red;
  const statusBg = status === "Saudavel" ? Colors.greenD : status === "Atencao" ? Colors.amberD : Colors.redD;
  const message = balance <= 0
    ? `Suas despesas superaram receitas em ${fmt(Math.abs(balance))}. Para empatar, faltam ${fmt(Math.abs(balance))} em receita ou reducao equivalente em custos.`
    : marginPct < 15 ? `Margem apertada de ${marginPct}%. Caixa positivo, mas qualquer despesa extra pode inverter o resultado.`
    : `Resultado positivo com margem de ${marginPct}%. Continue monitorando para manter a saude do negocio.`;
  return (
    <View style={s.hero}>
      <View style={s.heroTop}><Text style={s.heroLabel}>Saude financeira do periodo</Text><View style={[s.statusBadge, { backgroundColor: statusBg }]}><View style={[s.statusDot, { backgroundColor: statusColor }]} /><Text style={[s.statusText, { color: statusColor }]}>{status}</Text></View></View>
      <View style={s.heroKpis}>
        <View style={s.heroKpi}><Text style={s.heroKpiLabel}>Receita</Text><Text style={[s.heroKpiValue, { color: Colors.green }]}>{fmt(income)}</Text></View>
        <View style={[s.heroKpi, s.heroKpiBorder]}><Text style={s.heroKpiLabel}>Despesas</Text><Text style={[s.heroKpiValue, { color: Colors.red }]}>{fmt(expenses)}</Text></View>
        <View style={s.heroKpi}><Text style={s.heroKpiLabel}>Resultado</Text><Text style={[s.heroKpiValue, { color: balance >= 0 ? Colors.green : Colors.red }]}>{fmt(balance)}</Text></View>
      </View>
      <Text style={s.heroMessage}>{message}</Text>
      <View style={s.heroBar}><View style={[s.heroBarFill, { width: `${Math.min(expenses > 0 && income > 0 ? (expenses/income)*100 : 0, 100)}%`, backgroundColor: statusColor }]} /></View>
    </View>
  );
}

function AlertStrip({ alerts }: { alerts: { text: string; color: string; icon: string }[] }) {
  if (alerts.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
      {alerts.map((a, i) => <View key={i} style={[s.alertCard, { borderLeftColor: a.color }]}><Text style={[s.alertIcon, { color: a.color }]}>{a.icon}</Text><Text style={s.alertText}>{a.text}</Text></View>)}
    </ScrollView>
  );
}

function NarrativeBlock({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;
  return (
    <View style={s.narrativeCard}>
      <Text style={s.narrativeTitle}>Por que esse resultado?</Text>
      {insights.map((ins, i) => <View key={i} style={s.narrativeRow}><Text style={s.narrativeBullet}>{"\u2022"}</Text><Text style={s.narrativeText}>{ins}</Text></View>)}
    </View>
  );
}

function CategoryDonut({ title, items, total, colors }: { title: string; items: { category: string; amount: number }[]; total: number; colors: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={s.donutSection}>
      <Text style={s.donutTitle}>{title}</Text>
      <View style={s.donutCard}>
        <View style={s.donutRow}>
          <DonutChart items={items} total={total} colorFn={(i) => colors[i % colors.length]} />
          <View style={s.donutLegend}>
            {items.map((item, i) => {
              const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
              return (
                <View key={item.category} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: colors[i % colors.length] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.legendLabel}>{item.category}</Text>
                    <Text style={s.legendValue}>{fmt(item.amount)} ({pct}%)</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function KpiStrip({ kpis }: { kpis: { label: string; value: string; color?: string; sub?: string }[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
      {kpis.map(k => <View key={k.label} style={s.kpiCard}><Text style={s.kpiLabel}>{k.label}</Text><Text style={[s.kpiValue, k.color ? { color: k.color } : {}]}>{k.value}</Text>{k.sub && <Text style={s.kpiSub}>{k.sub}</Text>}</View>)}
    </ScrollView>
  );
}

export function TabResumo({ transactions, dreApi }: Props) {
  const computed = useMemo(() => {
    if (transactions.length === 0) return null;
    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};
    let totalIncome = 0, totalExpenses = 0;
    transactions.forEach(t => {
      if (t.type === "income") { incomeMap[t.category] = (incomeMap[t.category] || 0) + t.amount; totalIncome += t.amount; }
      else { expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount; totalExpenses += t.amount; }
    });
    const incomeItems = Object.entries(incomeMap).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));
    const expenseItems = Object.entries(expenseMap).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));
    const balance = totalIncome - totalExpenses;
    const marginPct = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0;
    const incomeCount = transactions.filter(t => t.type === "income").length;
    const expenseCount = transactions.filter(t => t.type === "expense").length;
    const avgTicket = incomeCount > 0 ? totalIncome / incomeCount : 0;

    const alerts: { text: string; color: string; icon: string }[] = [];
    if (balance < 0) alerts.push({ text: `Resultado negativo: ${fmt(Math.abs(balance))}`, color: Colors.red, icon: "!" });
    if (expenseItems[0] && totalExpenses > 0 && expenseItems[0].amount / totalExpenses > 0.5) alerts.push({ text: `${expenseItems[0].category}: ${Math.round(expenseItems[0].amount/totalExpenses*100)}% das despesas`, color: Colors.amber, icon: "$" });
    if (marginPct > 0 && marginPct < 15) alerts.push({ text: `Margem de ${marginPct}% - muito apertada`, color: Colors.amber, icon: "!" });
    if (incomeCount <= 3 && avgTicket > 500) alerts.push({ text: `Apenas ${incomeCount} vendas - risco de concentracao`, color: Colors.amber, icon: "#" });

    const insights: string[] = [];
    if (expenseItems.length > 0) insights.push(`${expenseItems[0].category} representou ${Math.round(expenseItems[0].amount/totalExpenses*100)}% das suas despesas totais.`);
    if (incomeItems.length > 1) insights.push(`"${incomeItems[0].category}" foi sua principal fonte de receita com ${Math.round(incomeItems[0].amount/totalIncome*100)}% do total.`);
    else if (incomeItems.length === 1) insights.push(`Toda receita veio de "${incomeItems[0].category}". Diversificar fontes reduz risco.`);
    if (incomeCount > 0) {
      if (incomeCount <= 3) insights.push(`Com apenas ${incomeCount} vendas, seu modelo depende de poucas transacoes com ticket alto (${fmt(avgTicket)}).`);
      else insights.push(`${incomeCount} vendas com ticket medio de ${fmt(avgTicket)}.`);
    }
    if (balance < 0 && incomeCount > 0 && avgTicket > 0) { const extra = Math.ceil(Math.abs(balance) / avgTicket); insights.push(`Se aumentar em ${extra} vendas o volume atual, o resultado tende a virar positivo.`); }
    if (balance < 0 && totalExpenses > 0) { const cut = Math.round((Math.abs(balance) / totalExpenses) * 100); insights.push(`Uma reducao de ${cut}% nas despesas eliminaria o prejuizo.`); }

    const kpis = [
      { label: "Margem", value: `${marginPct}%`, color: marginPct >= 20 ? Colors.green : marginPct >= 0 ? Colors.amber : Colors.red, sub: marginPct >= 20 ? "Saudavel" : marginPct >= 0 ? "Atencao" : "Critico" },
      { label: "Ticket medio", value: fmt(avgTicket), sub: `${incomeCount} vendas` },
      { label: "Ponto equilibrio", value: totalExpenses > 0 && marginPct > 0 ? fmt(totalExpenses / (marginPct/100)) : "---", sub: "receita necessaria" },
      { label: "Lancamentos", value: String(transactions.length), sub: `${incomeCount} entradas / ${expenseCount} saidas` },
    ];

    return { totalIncome, totalExpenses, balance, marginPct, incomeItems, expenseItems, alerts, insights, kpis, txCount: transactions.length };
  }, [transactions]);

  if (!computed) return <EmptyState icon="receipt" iconColor={Colors.violet3} title="Analise financeira" subtitle="Registre receitas e despesas para ativar a analise com indicadores, categorias e insights automaticos." />;

  return (
    <View>
      <HealthHero income={computed.totalIncome} expenses={computed.totalExpenses} balance={computed.balance} marginPct={computed.marginPct} />
      <AlertStrip alerts={computed.alerts} />
      <KpiStrip kpis={computed.kpis} />
      <NarrativeBlock insights={computed.insights} />
      <CategoryDonut title="Receitas por categoria" items={computed.incomeItems} total={computed.totalIncome} colors={INCOME_COLORS} />
      <CategoryDonut title="Despesas por categoria" items={computed.expenseItems} total={computed.totalExpenses} colors={EXPENSE_COLORS} />
      <View style={s.disclaimer}><Text style={s.disclaimerText}>Valores calculados dos lancamentos registrados. Estimativas para apoio a decisao.</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
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
  heroMessage: { fontSize: 13, color: Colors.ink3, lineHeight: 20, marginBottom: 16 },
  heroBar: { height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  heroBarFill: { height: 8, borderRadius: 4 },
  alertCard: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, flexDirection: "row", gap: 8, alignItems: "center", minWidth: 200 },
  alertIcon: { fontSize: 14, fontWeight: "800" },
  alertText: { fontSize: 11, color: Colors.ink3, flex: 1 },
  narrativeCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20, gap: 10 },
  narrativeTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  narrativeRow: { flexDirection: "row", gap: 8 },
  narrativeBullet: { fontSize: 14, color: Colors.violet3, fontWeight: "700", lineHeight: 20 },
  narrativeText: { fontSize: 12, color: Colors.ink3, lineHeight: 20, flex: 1 },
  donutSection: { marginBottom: 20 },
  donutTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  donutCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  donutLegend: { flex: 1, gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  legendValue: { fontSize: 11, color: Colors.ink3 },
  kpiCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, minWidth: 130, alignItems: "center" },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  kpiSub: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  disclaimer: { padding: 12, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  disclaimerText: { fontSize: 10, color: Colors.ink3, textAlign: "center", fontStyle: "italic" },
});

export default TabResumo;
