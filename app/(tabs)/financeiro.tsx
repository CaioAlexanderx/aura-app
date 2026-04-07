import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, dashboardApi } from "@/services/api";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Dimensions, TextInput, Modal } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useTransactions } from "@/stores/transactions";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { AgentBanner } from "@/components/AgentBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WIDE = SCREEN_W > 768;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const INCOME_CATS = ["Vendas", "Serviços", "Outros", "Investimentos"];
const EXPENSE_CATS = ["Fornecedores", "Fixas", "Operacional", "Folha", "Impostos", "Marketing", "Outros"];

const TABS = ["Lançamentos", "A Receber", "Minha Retirada", "Resumo"];

// ── Mock Data ────────────────────────────────────────────────

// MOCK_TRANSACTIONS removed

// MOCK_RECEIVABLES removed — A Receber shows empty state until API connected


// MOCK_WITHDRAWAL removed — Retirada shows empty state until API connected


// MOCK_DRE removed — Resumo shows empty state until API connected


// ── FE-20: Transaction Entry Modal ───────────────────────────
function TransactionModal({ visible, onClose, createTxMutation }: { visible: boolean; onClose: () => void; createTxMutation?: any }) {
  const { add, addBatch } = useTransactions();
  const [mode, setMode] = useState<"unit" | "batch">("unit");
  const [txType, setTxType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("");
  const [batchText, setBatchText] = useState("");
  const isIncome = txType === "income";
  const cats = isIncome ? INCOME_CATS : EXPENSE_CATS;

  function reset() { setAmount(""); setDesc(""); setCategory(""); setBatchText(""); setMode("unit"); }

  function handleSaveUnit() {
    const val = parseFloat(amount.replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!val || val <= 0) { toast.error("Informe um valor válido"); return; }
    if (!desc.trim()) { toast.error("Informe uma descrição"); return; }
    const cat = category || cats[0];
    const today = new Date();
    const dateStr = String(today.getDate()).padStart(2,"0") + "/" + String(today.getMonth()+1).padStart(2,"0");
    if (createTxMutation) {
      createTxMutation.mutate({ type: txType, amount: val, description: desc.trim(), category: cat }, {
        onSuccess: () => { toast.success(isIncome ? "Receita lancada" : "Despesa lancada"); reset(); onClose(); },
        onError: () => { toast.error("Erro ao salvar. Tente novamente."); },
      });
      return;
    }
    add({ date: dateStr, desc: desc.trim(), type: txType, category: cat, amount: val, status: "confirmed", source: "manual" });
    if (!createTxMutation) { toast.success(isIncome ? "Receita lancada" : "Despesa lancada"); reset(); onClose(); }
  }

  function handleSaveBatch() {
    const lines = batchText.trim().split("\n").filter(l => l.trim());
    if (lines.length === 0) { toast.error("Nenhum lançamento informado"); return; }
    const today = new Date();
    const dateStr = String(today.getDate()).padStart(2,"0") + "/" + String(today.getMonth()+1).padStart(2,"0");
    const items = [];
    for (const line of lines) {
      // Format: descricao;valor;categoria (optional)
      const parts = line.split(";").map(s => s.trim());
      if (parts.length < 2) continue;
      const val = parseFloat(parts[1].replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!val || val <= 0) continue;
      items.push({ date: dateStr, desc: parts[0], type: txType, category: parts[2] || cats[0], amount: val, status: "confirmed" as const, source: "lote" as const });
    }
    if (items.length === 0) { toast.error("Formato inválido. Use: descrição;valor;categoria"); return; }
    addBatch(items);
    toast.success(items.length + " lançamentos adicionados");
    reset(); onClose();
  }

  if (!visible) return null;

  return (
    <View style={md.overlay}>
      <View style={md.modal}>
        <View style={md.header}>
          <Text style={md.title}>Novo lançamento</Text>
          <Pressable onPress={() => { reset(); onClose(); }} style={md.closeBtn}><Text style={md.closeText}>✕</Text></Pressable>
        </View>

        {/* Type toggle */}
        <View style={md.toggleRow}>
          <Pressable onPress={() => setTxType("income")} style={[md.toggleBtn, isIncome && { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
            <Text style={[md.toggleText, isIncome && { color: Colors.green }]}>Receita</Text>
          </Pressable>
          <Pressable onPress={() => setTxType("expense")} style={[md.toggleBtn, !isIncome && { backgroundColor: Colors.redD, borderColor: Colors.red }]}>
            <Text style={[md.toggleText, !isIncome && { color: Colors.red }]}>Despesa</Text>
          </Pressable>
        </View>

        {/* Mode toggle */}
        <View style={md.modeRow}>
          <Pressable onPress={() => setMode("unit")} style={[md.modeBtn, mode === "unit" && md.modeBtnActive]}>
            <Text style={[md.modeText, mode === "unit" && md.modeTextActive]}>Unitário</Text>
          </Pressable>
          <Pressable onPress={() => setMode("batch")} style={[md.modeBtn, mode === "batch" && md.modeBtnActive]}>
            <Text style={[md.modeText, mode === "batch" && md.modeTextActive]}>Lote</Text>
          </Pressable>
        </View>

        {mode === "unit" ? (
          <View style={md.form}>
            <View style={md.field}>
              <Text style={md.label}>Valor</Text>
              <TextInput style={md.input} value={amount} onChangeText={setAmount} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
            </View>
            <View style={md.field}>
              <Text style={md.label}>Descrição</Text>
              <TextInput style={md.input} value={desc} onChangeText={setDesc} placeholder="Ex: Venda cliente Maria" placeholderTextColor={Colors.ink3} />
            </View>
            <View style={md.field}>
              <Text style={md.label}>Categoria</Text>
              <View style={md.catGrid}>
                {cats.map(cat => (
                  <Pressable key={cat} onPress={() => setCategory(cat)} style={[md.catBtn, category === cat && md.catBtnActive]}>
                    <Text style={[md.catText, category === cat && md.catTextActive]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable onPress={handleSaveUnit} style={[md.saveBtn, { backgroundColor: isIncome ? Colors.green : Colors.red }]}>
              <Text style={md.saveBtnText}>{isIncome ? "Lançar receita" : "Lançar despesa"}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={md.form}>
            <View style={md.field}>
              <Text style={md.label}>Lançamentos em lote</Text>
              <Text style={md.hint}>Uma linha por lançamento. Formato: descrição;valor;categoria</Text>
              <TextInput
                style={[md.input, md.textarea]}
                value={batchText}
                onChangeText={setBatchText}
                placeholder={"Venda cliente A;150,00;Vendas\nAluguel;1200,00;Fixas\nMaterial;45,90;Operacional"}
                placeholderTextColor={Colors.ink3}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
            <Pressable onPress={handleSaveBatch} style={[md.saveBtn, { backgroundColor: isIncome ? Colors.green : Colors.red }]}>
              <Text style={md.saveBtnText}>Lançar em lote</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const md = StyleSheet.create({
  overlay: { position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  modal: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 28, maxWidth: 480, width: "90%", borderWidth: 1, borderColor: Colors.border2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  closeBtn: { padding: 8 },
  closeText: { fontSize: 18, color: Colors.ink3 },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center" },
  toggleText: { fontSize: 14, fontWeight: "600", color: Colors.ink3 },
  modeRow: { flexDirection: "row", gap: 6, marginBottom: 20 },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.bg4 },
  modeBtnActive: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet },
  modeText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  modeTextActive: { color: Colors.violet3 },
  form: { gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  hint: { fontSize: 10, color: Colors.ink3, fontStyle: "italic" },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  textarea: { minHeight: 120, textAlignVertical: "top" as any, paddingTop: 12 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  catText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  catTextActive: { color: Colors.violet3, fontWeight: "600" },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

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

function TransactionRow({ item, onDelete }: { item: typeof MOCK_TRANSACTIONS[0]; onDelete?: (id: string) => void }) {
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
          <Text style={tr.meta}>{item.date} / {item.category}{item.source && item.source !== "manual" ? " / " + (item.source === "pdv" ? "PDV" : item.source === "folha" ? "Folha" : item.source === "estoque" ? "Estoque" : item.source === "lote" ? "Lote" : "") : ""}{item.status === "pending" ? " / Pendente" : ""}</Text>
        </View>
      </View>
      <Text style={[tr.amount, { color: isIncome ? Colors.green : Colors.red }]}>
        {isIncome ? "+" : "-"}{fmt(item.amount)}
      </Text>
      {onDelete && (
        <Pressable onPress={() => onDelete(item.id)} style={tr.deleteBtn} hitSlop={8}>
          <Text style={tr.deleteText}>x</Text>
        </Pressable>
      )}
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

function TabLancamentos({ apiTx, onDeleteTx }: { apiTx?: any; onDeleteTx?: (id: string) => void }) {
  const { transactions: localTx, totals } = useTransactions();
  // Use API data if available, otherwise local store
  const transactions = apiTx?.transactions || apiTx?.rows || (localTx.length > 0 ? localTx : []);
  const income = apiTx?.summary?.income != null ? parseFloat(apiTx.summary.income) : totals().income;
  const expense = apiTx?.summary?.expenses != null ? parseFloat(apiTx.summary.expenses) : totals().expense;
  const balance = income - expense;
  return (
    <View>
      <View style={g.row}>
        <SummaryCard label="ENTRADAS" value={fmt(income)} color={Colors.green} />
        <SummaryCard label="SAÍDAS" value={fmt(expense)} color={Colors.red} />
        <SummaryCard label="SALDO" value={fmt(balance)} color={balance >= 0 ? Colors.green : Colors.red} />
      </View>
      <View style={g.listCard}>
        {transactions.map(t => <TransactionRow key={t.id} item={t} onDelete={onDeleteTx} />)}
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
  return (
    <EmptyState
      icon="wallet"
      iconColor={Colors.amber}
      title="Contas a receber"
      subtitle="As contas a receber serao listadas aqui conforme voce registrar vendas a prazo e parcelas pendentes."
    />
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

function TabRetirada({ apiWd }: { apiWd?: any }) {
  const w = apiWd;
  if (!w || !w.grossRevenue) return <EmptyState icon="trending_up" iconColor={Colors.green} title="Minha Retirada" subtitle="A analise de retirada sera calculada automaticamente com base nas suas receitas, despesas e impostos." />;
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

function TabResumo({ apiDreData }: { apiDreData?: any }) {
  const raw = apiDreData;
  if (!raw || (!raw.totalIncome && !raw.income)) {
    return <EmptyState icon="receipt" iconColor={Colors.violet3} title="Resumo financeiro (DRE)" subtitle="O resumo sera gerado automaticamente conforme voce registrar receitas e despesas." />;
  }
  const d = {
    period: raw.period || new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    income: Array.isArray(raw.income) ? raw.income : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    totalIncome: parseFloat(raw.totalIncome || raw.total_income) || 0,
    totalExpenses: parseFloat(raw.totalExpenses || raw.total_expenses) || 0,
    netProfit: parseFloat(raw.netProfit || raw.net_profit) || 0,
    marginPct: parseFloat(raw.marginPct || raw.margin_pct) || 0,
  };
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
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();

  // CONN-11: Fetch real data from backend
  const { data: apiTransactions, isLoading: isLoadingTx } = useQuery({
    queryKey: ["transactions", company?.id],
    queryFn: () => companiesApi.transactions(company!.id, "limit=50"),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
  });

  const { data: apiDre } = useQuery({
    queryKey: ["dre", company?.id],
    queryFn: () => companiesApi.dre(company!.id),
    enabled: !!company?.id && !!token && !isDemo && activeTab === 3,
    retry: 1,
  });

  const { data: apiWithdrawal } = useQuery({
    queryKey: ["withdrawal", company?.id],
    queryFn: () => dashboardApi.summary(company!.id),
    enabled: !!company?.id && !!token && !isDemo && activeTab === 2,
    retry: 1,
  });

  // Mutation for deleting transactions
  const deleteTxMutation = useMutation({
    mutationFn: (txId: string) => companiesApi.deleteTransaction(company!.id, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", company?.id] });
      qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });
      toast.success("Lancamento excluido");
    },
    onError: () => toast.error("Erro ao excluir lancamento"),
  });

  // Mutation for creating transactions
  const createTxMutation = useMutation({
    mutationFn: (body: any) => companiesApi.createTransaction(company!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", company?.id] });
      qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });
      qc.invalidateQueries({ queryKey: ["dre", company?.id] });
    },
  });

  return (
    <View style={{flex:1}}>
      <TransactionModal visible={showModal} onClose={() => setShowModal(false)} createTxMutation={!isDemo && company?.id ? createTxMutation : undefined} />
      <ScrollView style={g.screen} contentContainerStyle={g.content}>
        <ScreenHeader
          title="Financeiro"
          actionLabel="Novo lancamento"
          actionIcon="dollar"
          onAction={() => setShowModal(true)}
        />
        <TabBar active={activeTab} onSelect={setActiveTab} />

        {isLoadingTx && !isDemo && <ListSkeleton rows={4} showCards />}

        {!isLoadingTx && (!apiTransactions || !(apiTransactions.transactions || apiTransactions.rows || []).length) && !isDemo && activeTab === 0 && (
          <EmptyState
            icon="dollar"
            iconColor={Colors.green}
            title="Nenhum lancamento"
            subtitle="Lance sua primeira receita ou despesa para comecar a acompanhar suas financas."
            actionLabel="Novo lancamento"
            onAction={() => setShowModal(true)}
          />
        )}

        <ConfirmDialog
          visible={!!deleteTarget}
          title="Excluir lancamento?"
          message="Esta acao nao pode ser desfeita. O lancamento sera removido permanentemente."
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          destructive
          onConfirm={() => { if (deleteTarget) { deleteTxMutation.mutate(deleteTarget); setDeleteTarget(null); } }}
          onCancel={() => setDeleteTarget(null)}
        />

        <AgentBanner agent="Financeiro" insight={{ title: "2 cobranças em atraso", desc: "Clientes João Santos (R$ 1.240) e Carlos Lima (R$ 430) estão com pagamento atrasado. Envie lembrete via WhatsApp.", actionLabel: "Enviar cobrança", action: "cobrar", priority: "high", icon: "alert" }} onAction={() => toast.info("Enviando cobrança via WhatsApp...")} />

      {activeTab === 0 && <TabLancamentos apiTx={apiTransactions} onDeleteTx={!isDemo && company?.id ? (id: string) => setDeleteTarget(id) : undefined} />}
      {activeTab === 1 && <TabAReceber />}
      {activeTab === 2 && <TabRetirada apiWd={apiWithdrawal} />}
      {activeTab === 3 && <TabResumo apiDreData={apiDre} />}

      {isDemo && (
        <View style={g.demoBanner}>
          <Text style={g.demoText}>Modo demonstrativo - dados ilustrativos</Text>
        </View>
      )}
    </ScrollView>
    </View>
  );
}

// ── Shared Styles ────────────────────────────────────────────

const g = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
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
