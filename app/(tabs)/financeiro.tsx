import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WIDE = SCREEN_W > 768;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const TABS = ["Lancamentos", "A Receber", "Minha Retirada", "Resumo"];

// ── Mock Data ────────────────────────────────────────────────

const MOCK_TRANSACTIONS = [
  { id: "1", date: "29/03", desc: "Venda PDV #0047", type: "income" as const, category: "Vendas", amount: 156.80, status: "confirmed" },
  { id: "2", date: "29/03", desc: "Fornecedor - Distribuidora ABC", type: "expense" as const, category: "Fornecedores", amount: 420.00, status: "confirmed" },
  { id: "3", date: "28/03", desc: "Venda PDV #0046", type: "income" as const, category: "Vendas", amount: 89.90, status: "confirmed" },
  { id: "4", date: "28/03", desc: "Aluguel sala comercial", type: "expense" as const, category: "Fixas", amount: 1200.00, status: "confirmed" },
  { id: "5", date: "27/03", desc: "Venda PDV #0045", type: "income" as const, category: "Vendas", amount: 234.50, status: "confirmed" },
  { id: "6", date: "27/03", desc: "Energia CPFL", type: "expense" as const, category: "Fixas", amount: 187.30, status: "pending" },
  { id: "7", date: "26/03", desc: "Venda PDV #0044", type: "income" as const, category: "Vendas", amount: 67.00, status: "confirmed" },
  { id: "8", date: "26/03", desc: "Material de limpeza", type: "expense" as const, category: "Operacional", amount: 45.90, status: "confirmed" },
];

const MOCK_RECEIVABLES = [
  { id: "1", customer: "Maria Silva", amount: 320.00, due: "05/04/2026", days: 7, status: "pending" },
  { id: "2", customer: "Pedro Costa", amount: 890.00, due: "10/04/2026", days: 12, status: "pending" },
  { id: "3", customer: "Ana Oliveira", amount: 156.50, due: "15/04/2026", days: 17, status: "pending" },
  { id: "4", customer: "Joao Santos", amount: 1240.00, due: "01/04/2026", days: 3, status: "overdue" },
  { id: "5", customer: "Carlos Lima", amount: 430.00, due: "25/03/2026", days: -4, status: "overdue" },
];

const MOCK_WITHDRAWAL = {
  grossRevenue: 18420.00,
  taxes: 1105.20,
  fixedCosts: 3200.00,
  variableCosts: 4640.00,
  operationalProfit: 9474.80,
  proLabore: 2800.00,
  netProfit: 6674.80,
  fatorR: 15.2,
  suggestedWithdrawal: 4500.00,
};

const MOCK_DRE = {
  period: "Marco 2026",
  income: [
    { category: "Vendas PDV", amount: 14200.00 },
    { category: "Servicos", amount: 3800.00 },
    { category: "Outros", amount: 420.00 },
  ],
  expenses: [
    { category: "Fornecedores", amount: 4640.00 },
    { category: "Custos Fixos", amount: 3200.00 },
    { category: "Impostos (DAS)", amount: 1105.20 },
    { category: "Operacional", amount: 894.80 },
  ],
  totalIncome: 18420.00,
  totalExpenses: 9840.00,
  netProfit: 8580.00,
  marginPct: 46.6,
};

// ── Tab Bar ──────────────────────────────────────────────────

function TabBar({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tb.scroll} contentContainerStyle={tb.row}>
      {TABS.map((tab, i) => {
        const isActive = active === i;
        return (
          <Pressable key={tab} onPress={() => onSelect(i)} style={[tb.tab, isActive && tb.tabActive]}>
            <Text style={[tb.label, isActive && tb.labelActive]}>{tab}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const tb = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 20 },
  row: { flexDirection: "row", gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  label: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  labelActive: { color: "#fff", fontWeight: "600" },
});

// ── Summary Cards Row ────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        sc.card,
        hovered && { transform: [{ translateY: -2 }], borderColor: Colors.border2 },
        isWeb && { transition: "all 0.2s ease" } as any,
      ]}
    >
      <Text style={sc.label}>{label}</Text>
      <Text style={[sc.value, color ? { color } : {}]}>{value}</Text>
    </Pressable>
  );
}
const sc = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  label: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  value: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
});

// ── Tab 1: Lancamentos ───────────────────────────────────────

function TransactionRow({ item }: { item: typeof MOCK_TRANSACTIONS[0] }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const isIncome = item.type === "income";
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        tr.row,
        hovered && { backgroundColor: Colors.bg4 },
        isWeb && { transition: "background-color 0.15s ease" } as any,
      ]}
    >
      <View style={tr.left}>
        <View style={[tr.dot, { backgroundColor: isIncome ? Colors.green : Colors.red }]} />
        <View>
          <Text style={tr.desc}>{item.desc}</Text>
          <Text style={tr.meta}>{item.date} / {item.category}{item.status === "pending" ? " / Pendente" : ""}</Text>
        </View>
      </View>
      <Text style={[tr.amount, { color: isIncome ? Colors.green : Colors.red }]}>
        {isIncome ? "+" : "-"}{fmt(item.amount)}
      </Text>
    </Pressable>
  );
}
const tr = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  desc: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "600" },
});

function TabLancamentos() {
  const income = MOCK_TRANSACTIONS.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = MOCK_TRANSACTIONS.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return (
    <View>
      <View style={g.row}>
        <SummaryCard label="ENTRADAS" value={fmt(income)} color={Colors.green} />
        <SummaryCard label="SAIDAS" value={fmt(expense)} color={Colors.red} />
        <SummaryCard label="SALDO" value={fmt(income - expense)} color={income - expense >= 0 ? Colors.green : Colors.red} />
      </View>
      <View style={g.listCard}>
        {MOCK_TRANSACTIONS.map(t => <TransactionRow key={t.id} item={t} />)}
      </View>
    </View>
  );
}

// ── Tab 2: A Receber ─────────────────────────────────────────

function ReceivableRow({ item }: { item: typeof MOCK_RECEIVABLES[0] }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const isOverdue = item.status === "overdue";
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        rv.row,
        hovered && { backgroundColor: Colors.bg4 },
        isWeb && { transition: "background-color 0.15s ease" } as any,
      ]}
    >
      <View style={rv.left}>
        <View style={rv.avatar}><Text style={rv.avatarText}>{item.customer.charAt(0)}</Text></View>
        <View>
          <Text style={rv.name}>{item.customer}</Text>
          <Text style={rv.due}>Vence: {item.due}</Text>
        </View>
      </View>
      <View style={rv.right}>
        <Text style={rv.amount}>{fmt(item.amount)}</Text>
        <View style={[rv.badge, { backgroundColor: isOverdue ? Colors.redD : Colors.amberD }]}>
          <Text style={[rv.badgeText, { color: isOverdue ? Colors.red : Colors.amber }]}>
            {isOverdue ? "Atrasado" : `${item.days}d`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
const rv = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "600", color: Colors.violet3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  due: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  right: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: "600" },
});

function TabAReceber() {
  const total = MOCK_RECEIVABLES.reduce((s, r) => s + r.amount, 0);
  const overdue = MOCK_RECEIVABLES.filter(r => r.status === "overdue").reduce((s, r) => s + r.amount, 0);
  return (
    <View>
      <View style={g.row}>
        <SummaryCard label="TOTAL A RECEBER" value={fmt(total)} />
        <SummaryCard label="EM ATRASO" value={fmt(overdue)} color={Colors.red} />
        <SummaryCard label="CLIENTES" value={String(MOCK_RECEIVABLES.length)} />
      </View>
      <View style={g.listCard}>
        {MOCK_RECEIVABLES.map(r => <ReceivableRow key={r.id} item={r} />)}
      </View>
    </View>
  );
}

// ── Tab 3: Minha Retirada ────────────────────────────────────

function WaterfallRow({ label, value, isTotal, isHighlight, color }: {
  label: string; value: number; isTotal?: boolean; isHighlight?: boolean; color?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        wf.row,
        isTotal && wf.totalRow,
        isHighlight && wf.highlightRow,
        hovered && { backgroundColor: Colors.bg4 },
        isWeb && { transition: "background-color 0.15s ease" } as any,
      ]}
    >
      <Text style={[wf.label, isTotal && wf.totalLabel, isHighlight && wf.highlightLabel]}>{label}</Text>
      <Text style={[wf.value, isTotal && wf.totalValue, color ? { color } : {}]}>
        {fmt(value)}
      </Text>
    </Pressable>
  );
}
const wf = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, borderRadius: 6 },
  totalRow: { backgroundColor: Colors.bg4, borderBottomWidth: 0, borderRadius: 10, marginTop: 4 },
  highlightRow: { backgroundColor: Colors.violetD, borderBottomWidth: 0, borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: Colors.border2 },
  label: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  totalLabel: { color: Colors.ink, fontWeight: "600" },
  highlightLabel: { color: Colors.ink, fontWeight: "700" },
  value: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  totalValue: { fontSize: 16, fontWeight: "800" },
});

function TabRetirada() {
  const w = MOCK_WITHDRAWAL;
  return (
    <View>
      <View style={g.row}>
        <SummaryCard label="RETIRADA SUGERIDA" value={fmt(w.suggestedWithdrawal)} color={Colors.green} />
        <SummaryCard label="PRO-LABORE" value={fmt(w.proLabore)} />
        <SummaryCard label="FATOR R" value={`${w.fatorR}%`} />
      </View>
      <View style={g.listCard}>
        <WaterfallRow label="(+) Receita bruta" value={w.grossRevenue} color={Colors.green} />
        <WaterfallRow label="(-) Impostos (DAS)" value={w.taxes} color={Colors.red} />
        <WaterfallRow label="(-) Custos fixos" value={w.fixedCosts} color={Colors.red} />
        <WaterfallRow label="(-) Custos variaveis" value={w.variableCosts} color={Colors.red} />
        <WaterfallRow label="= Lucro operacional" value={w.operationalProfit} isTotal />
        <WaterfallRow label="(-) Pro-labore" value={w.proLabore} color={Colors.amber} />
        <WaterfallRow label="= Lucro liquido" value={w.netProfit} isTotal />
        <WaterfallRow label="Retirada sugerida" value={w.suggestedWithdrawal} isHighlight color={Colors.green} />
      </View>
      <View style={g.infoCard}>
        <Text style={g.infoIcon}>!</Text>
        <Text style={g.infoText}>
          A retirada sugerida considera o Fator R ({w.fatorR}%) para manter o enquadramento no Anexo III do Simples Nacional. Valores estimativos.
        </Text>
      </View>
    </View>
  );
}

// ── Tab 4: Resumo (DRE) ─────────────────────────────────────

function DreSection({ title, items, color, total, totalLabel }: {
  title: string; items: { category: string; amount: number }[]; color: string; total: number; totalLabel: string;
}) {
  return (
    <View style={dre.section}>
      <Text style={dre.sectionTitle}>{title}</Text>
      {items.map(item => (
        <View key={item.category} style={dre.row}>
          <Text style={dre.cat}>{item.category}</Text>
          <Text style={[dre.amt, { color }]}>{fmt(item.amount)}</Text>
        </View>
      ))}
      <View style={dre.totalRow}>
        <Text style={dre.totalLabel}>{totalLabel}</Text>
        <Text style={[dre.totalAmt, { color }]}>{fmt(total)}</Text>
      </View>
    </View>
  );
}
const dre = StyleSheet.create({
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, paddingHorizontal: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cat: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  amt: { fontSize: 13, fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 10, backgroundColor: Colors.bg4, borderRadius: 8, marginTop: 4 },
  totalLabel: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  totalAmt: { fontSize: 14, fontWeight: "800" },
});

function TabResumo() {
  const d = MOCK_DRE;
  return (
    <View>
      <View style={g.row}>
        <SummaryCard label="RECEITA" value={fmt(d.totalIncome)} color={Colors.green} />
        <SummaryCard label="DESPESAS" value={fmt(d.totalExpenses)} color={Colors.red} />
        <SummaryCard label="LUCRO" value={fmt(d.netProfit)} color={Colors.green} />
        <SummaryCard label="MARGEM" value={`${d.marginPct}%`} />
      </View>
      <View style={g.listCard}>
        <Text style={g.periodLabel}>{d.period}</Text>
        <DreSection title="Receitas" items={d.income} color={Colors.green} total={d.totalIncome} totalLabel="Total receitas" />
        <DreSection title="Despesas" items={d.expenses} color={Colors.red} total={d.totalExpenses} totalLabel="Total despesas" />
        <View style={g.profitRow}>
          <Text style={g.profitLabel}>Resultado liquido</Text>
          <Text style={[g.profitValue, { color: d.netProfit >= 0 ? Colors.green : Colors.red }]}>{fmt(d.netProfit)}</Text>
        </View>
        <View style={g.marginRow}>
          <Text style={g.marginLabel}>Margem</Text>
          <Text style={g.marginValue}>{d.marginPct}%</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────

export default function FinanceiroScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const { isDemo } = useAuthStore();

  return (
    <ScrollView style={g.screen} contentContainerStyle={g.content}>
      <Text style={g.pageTitle}>Financeiro</Text>
      <TabBar active={activeTab} onSelect={setActiveTab} />

      {activeTab === 0 && <TabLancamentos />}
      {activeTab === 1 && <TabAReceber />}
      {activeTab === 2 && <TabRetirada />}
      {activeTab === 3 && <TabResumo />}

      {isDemo && (
        <View style={g.demoBanner}>
          <Text style={g.demoText}>Modo demonstrativo - dados ilustrativos</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Shared Styles ────────────────────────────────────────────

const g = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },
  row: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  periodLabel: { fontSize: 11, color: Colors.violet3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, paddingHorizontal: 10 },
  profitRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 14, backgroundColor: Colors.violetD, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  profitLabel: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  profitValue: { fontSize: 18, fontWeight: "800" },
  marginRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 14, marginTop: 4 },
  marginLabel: { fontSize: 12, color: Colors.ink3 },
  marginValue: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginBottom: 20 },
  infoIcon: { fontSize: 14, color: Colors.amber, fontWeight: "700" },
  infoText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
