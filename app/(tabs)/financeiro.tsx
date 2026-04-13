import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
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
import { TABS, fmt } from "@/components/screens/financeiro/types";
import { arrayToCSV, downloadCSV, pickFileAndParse, TRANSACTION_COLUMNS, mapImportedTransaction } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { FinanceiroToolbar } from "@/components/FinanceiroToolbar";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

export default function FinanceiroScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);

  const { transactions, summary, dreData, withdrawalData, isLoading, isDemo, createTransaction, deleteTransaction } = useTransactionsApi(activeTab);

  const periodLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const uncategorized = transactions.filter((t: any) => !t.category || t.category === 'outros').map((t: any) => t.description).filter(Boolean);

  function handleTabSelect(i: number) { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function handleExport() {
    if (transactions.length === 0) { toast.error("Nenhum lancamento para exportar"); return; }
    const csv = arrayToCSV(transactions, TRANSACTION_COLUMNS);
    downloadCSV(csv, `aura_lancamentos_${new Date().toISOString().slice(0,10)}.csv`);
  }

  async function handleImport() {
    try {
      const rows = await pickFileAndParse();
      let imported = 0, skipped = 0;
      for (const row of rows) {
        const mapped = mapImportedTransaction(row);
        if (mapped) { createTransaction(mapped); imported++; }
        else { skipped++; }
      }
      toast.success(`${imported} lancamentos importados${skipped > 0 ? ` (${skipped} ignorados)` : ""}`);
    } catch {}
  }

  return (
    <View style={{ flex: 1 }}>
      <TransactionModal visible={showModal} onClose={() => setShowModal(false)} onSave={createTransaction} />
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        <ScreenHeader title="Financeiro" actionLabel="Novo lancamento" actionIcon="dollar" onAction={() => setShowModal(true)} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {TABS.map((tab, i) => <Pressable key={tab} onPress={() => handleTabSelect(i)} style={[s.tab, activeTab === i && s.tabActive]}><Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{tab}</Text></Pressable>)}
        </ScrollView>

        {!isDemo && transactions.length > 0 && (activeTab === 0 || activeTab === 1) && (
          <FinanceiroToolbar uncategorizedDescriptions={uncategorized} />
        )}

        {activeTab === 1 && transactions.length > 0 && <ImportExportBar onExport={handleExport} onImport={handleImport} itemCount={transactions.length} />}

        {isLoading && activeTab < 4 && <ListSkeleton rows={4} showCards />}

        {activeTab === 0 && (
          <View>
            {transactions.length === 0 && !isLoading && !isDemo ? (
              <EmptyState icon="dollar" iconColor={Colors.green} title="Seu termometro financeiro" subtitle="Lance sua primeira receita ou despesa para ativar o painel inteligente." actionLabel="Novo lancamento" onAction={() => setShowModal(true)} secondaryLabel="Importar de planilha" onSecondary={handleImport} />
            ) : (
              <View>
                <SmartBalance income={summary.income} expenses={summary.expenses} balance={summary.balance} txCount={transactions.length} period={periodLabel} />
                <QuickInsights transactions={transactions} income={summary.income} expenses={summary.expenses} />
                {transactions.length > 0 && (
                  <View>
                    <View style={s.sectionHeader}><Text style={s.sectionTitle}>Ultimos lancamentos</Text><Pressable onPress={() => handleTabSelect(1)}><Text style={s.seeAll}>Ver todos</Text></Pressable></View>
                    <View style={s.listCard}>{transactions.slice(0, 8).map(t => <TransactionRow key={t.id} item={t} onDelete={!isDemo ? (id) => setDeleteTarget(id) : undefined} />)}</View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {activeTab === 1 && (
          <View>
            {transactions.length === 0 && !isLoading && <EmptyState icon="dollar" iconColor={Colors.green} title="Nenhum lancamento" subtitle="Lance sua primeira receita ou despesa, ou importe de uma planilha." actionLabel="Novo lancamento" onAction={() => setShowModal(true)} secondaryLabel="Importar CSV" onSecondary={handleImport} />}
            {transactions.length > 0 && <View style={s.listCard}>{transactions.map(t => <TransactionRow key={t.id} item={t} onDelete={!isDemo ? (id) => setDeleteTarget(id) : undefined} />)}</View>}
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
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  seeAll: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
