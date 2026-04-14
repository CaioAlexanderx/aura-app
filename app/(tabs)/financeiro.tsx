import { useState, useRef, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useTransactionsApi } from "@/hooks/useTransactions";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImportExportBar } from "@/components/ImportExportBar";
import { SmartBalance } from "@/components/screens/financeiro/SmartBalance";
import { QuickInsights } from "@/components/screens/financeiro/QuickInsights";
import { TransactionModal } from "@/components/screens/financeiro/TransactionModal";
import { TransactionRow } from "@/components/screens/financeiro/TransactionRow";
import { TabResumo } from "@/components/screens/financeiro/TabResumo";
import { TabRetirada } from "@/components/screens/financeiro/TabRetirada";
import { TabCupons } from "@/components/screens/financeiro/TabCupons";
import { TABS, PERIODS, fmt, filterByPeriod } from "@/components/screens/financeiro/types";
import type { PeriodKey } from "@/components/screens/financeiro/types";
import { arrayToCSV, downloadCSV, pickFileAndParse, TRANSACTION_COLUMNS } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { FinanceiroToolbar } from "@/components/FinanceiroToolbar";
import { AgentBanner } from "@/components/AgentBanner";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
const isWeb = Platform.OS === "web";
const API = "https://aura-backend-production-f805.up.railway.app/api/v1";

export default function FinanceiroScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const scrollRef = useRef<any>(null);
  const { transactions: allTransactions, summary: rawSummary, dreData, withdrawalData, isLoading, isDemo, createTransaction, deleteTransaction } = useTransactionsApi(activeTab);
  const { company, token } = useAuthStore();
  const qc = useQueryClient();

  // Filter transactions by selected period
  const transactions = useMemo(() => filterByPeriod(allTransactions, period), [allTransactions, period]);

  // Recalculate summary for filtered transactions
  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  // Type-filtered list for Lancamentos tab
  const displayTransactions = useMemo(() => {
    if (typeFilter === "all") return transactions;
    return transactions.filter(t => t.type === typeFilter);
  }, [transactions, typeFilter]);

  const uncategorized = transactions.filter((t: any) => !t.category || t.category === 'outros').map((t: any) => t.description).filter(Boolean);

  function handleTabSelect(i: number) { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }
  function handleExport() {
    if (transactions.length === 0) { toast.error("Nenhum lancamento para exportar"); return; }
    downloadCSV(arrayToCSV(transactions, TRANSACTION_COLUMNS), "aura_lancamentos_" + new Date().toISOString().slice(0, 10) + ".csv");
  }

  async function handleImport() {
    if (!company?.id || !token) { toast.error("Sessao expirada"); return; }
    try {
      setImporting(true);
      const rows = await pickFileAndParse();
      if (rows.length === 0) { toast.error("Arquivo vazio"); setImporting(false); return; }
      const res = await fetch(API + "/companies/" + company.id + "/transactions/batch?partial=true", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ transactions: rows }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Erro " + res.status); setImporting(false); return; }
      qc.invalidateQueries({ queryKey: ["transactions", company.id] });
      if (data.saved > 0) {
        toast.success(data.saved + " lancamentos importados!" + (data.error_count > 0 ? " (" + data.error_count + " com erro)" : ""));
      } else {
        toast.error("0 lancamentos validos. Verifique o formato do CSV");
      }
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err?.message || "tente novamente"));
    } finally { setImporting(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <TransactionModal visible={showModal} onClose={() => setShowModal(false)} onSave={createTransaction} />
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        <ScreenHeader title="Financeiro" actionLabel="Novo lancamento" actionIcon="dollar" onAction={() => setShowModal(true)} />

        <AgentBanner context="financeiro" />

        {/* ━━━ PERIOD FILTER ━━━ */}
        <View style={s.periodBar}>
          {PERIODS.map(p => (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[
                s.periodBtn,
                period === p.key && s.periodBtnActive,
                isWeb && { transition: "all 0.2s ease" } as any
              ]}
            >
              <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ━━━ TABS ━━━ */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {TABS.map((tab, i) => (
            <Pressable key={tab} onPress={() => handleTabSelect(i)}
              style={[s.tab, activeTab === i && s.tabActive, isWeb && { transition: "all 0.15s ease" } as any]}>
              <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ━━━ TOOLBAR ━━━ */}
        {!isDemo && transactions.length > 0 && (activeTab === 0 || activeTab === 1) && <FinanceiroToolbar uncategorizedDescriptions={uncategorized} />}
        {activeTab === 1 && transactions.length > 0 && (
          <View style={s.importBar}>
            <ImportExportBar onExport={handleExport} onImport={!importing ? handleImport : undefined} itemCount={displayTransactions.length} />
            {importing && <View style={s.importingBadge}><ActivityIndicator size="small" color={Colors.violet3} /><Text style={s.importingText}>Importando...</Text></View>}
          </View>
        )}
        {isLoading && activeTab < 4 && <ListSkeleton rows={4} showCards />}

        {/* ━━━ VISAO GERAL ━━━ */}
        {activeTab === 0 && (
          <View>
            {transactions.length === 0 && !isLoading && !isDemo ? (
              <EmptyState icon="dollar" iconColor={Colors.green} title="Seu termometro financeiro" subtitle="Lance sua primeira receita ou despesa para ativar o painel inteligente." actionLabel="Novo lancamento" onAction={() => setShowModal(true)} secondaryLabel="Importar de planilha" onSecondary={!importing ? handleImport : undefined} />
            ) : (
              <View>
                <SmartBalance income={summary.income} expenses={summary.expenses} balance={summary.balance} txCount={transactions.length} period={period} />
                <QuickInsights transactions={transactions} income={summary.income} expenses={summary.expenses} />
                {transactions.length > 0 && (
                  <View>
                    <View style={s.sectionHeader}>
                      <Text style={s.sectionTitle}>Ultimos lancamentos</Text>
                      <Pressable onPress={() => handleTabSelect(1)}><Text style={s.seeAll}>Ver todos</Text></Pressable>
                    </View>
                    <View style={s.listCard}>
                      {transactions.slice(0, 8).map(t => <TransactionRow key={t.id} item={t} onDelete={!isDemo ? (id) => setDeleteTarget(id) : undefined} />)}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ━━━ LANCAMENTOS ━━━ */}
        {activeTab === 1 && (
          <View>
            {/* Type sub-filter */}
            <View style={s.typeFilterRow}>
              {(["all", "income", "expense"] as const).map(tf => (
                <Pressable key={tf} onPress={() => setTypeFilter(tf)}
                  style={[s.typeBtn, typeFilter === tf && s.typeBtnActive, isWeb && { transition: "all 0.15s ease" } as any]}>
                  <Text style={[s.typeText, typeFilter === tf && s.typeTextActive]}>
                    {tf === "all" ? "Todos" : tf === "income" ? "Entradas" : "Saidas"}
                  </Text>
                  <View style={[s.typeBadge, tf === "income" && { backgroundColor: Colors.greenD }, tf === "expense" && { backgroundColor: Colors.redD }]}>
                    <Text style={[s.typeBadgeText, tf === "income" && { color: Colors.green }, tf === "expense" && { color: Colors.red }]}>
                      {tf === "all" ? transactions.length : transactions.filter(t => t.type === tf).length}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {displayTransactions.length === 0 && !isLoading && (
              <EmptyState icon="dollar" iconColor={Colors.green} title="Nenhum lancamento" subtitle="Lance sua primeira receita ou despesa, ou importe de uma planilha CSV."
                actionLabel="Novo lancamento" onAction={() => setShowModal(true)}
                secondaryLabel={importing ? "Importando..." : "Importar CSV"}
                onSecondary={!importing ? handleImport : undefined} />
            )}
            {displayTransactions.length > 0 && (
              <View style={s.listCard}>
                {displayTransactions.map(t => <TransactionRow key={t.id} item={t} onDelete={!isDemo ? (id) => setDeleteTarget(id) : undefined} />)}
              </View>
            )}
          </View>
        )}

        {activeTab === 2 && <TabResumo transactions={transactions} dreApi={dreData} />}
        {activeTab === 3 && <TabRetirada transactions={transactions} />}
        {activeTab === 4 && <TabCupons />}

        <ConfirmDialog visible={!!deleteTarget} title="Excluir lancamento?" message="Esta acao nao pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={() => { if (deleteTarget) { deleteTransaction(deleteTarget); setDeleteTarget(null); } }} onCancel={() => setDeleteTarget(null)} />
        {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },

  // Period filter
  periodBar: {
    flexDirection: "row",
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  periodBtnActive: {
    backgroundColor: Colors.violet,
  },
  periodText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  periodTextActive: { color: "#fff", fontWeight: "700" },

  // Tabs
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },

  // Type sub-filter
  typeFilterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  typeText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  typeTextActive: { color: Colors.violet3, fontWeight: "600" },
  typeBadge: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, color: Colors.ink3, fontWeight: "700" },

  // Sections
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  seeAll: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },

  // Import
  importBar: { marginBottom: 12 },
  importingBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  importingText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  // Demo
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
