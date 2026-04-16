import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useTransactionsApi } from "@/hooks/useTransactions";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TransactionModal } from "@/components/screens/financeiro/TransactionModal";
import { TabVisaoGeral } from "@/components/screens/financeiro/TabVisaoGeral";
import { TabLancamentos } from "@/components/screens/financeiro/TabLancamentos";
import { TabResumo } from "@/components/screens/financeiro/TabResumo";
import { TabRetirada } from "@/components/screens/financeiro/TabRetirada";
import { TabCupons } from "@/components/screens/financeiro/TabCupons";
import { TABS, PERIODS } from "@/components/screens/financeiro/types";
import type { PeriodKey } from "@/components/screens/financeiro/types";
import { arrayToCSV, downloadCSV, pickFileAndParse, TRANSACTION_COLUMNS } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { FinanceiroToolbar } from "@/components/FinanceiroToolbar";
import { AgentBanner } from "@/components/AgentBanner";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";

var IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
var isWeb = Platform.OS === "web";
var API = "https://aura-backend-production-f805.up.railway.app/api/v1";

export default function FinanceiroScreen() {
  var [activeTab, setActiveTab] = useState(0);
  var [period, setPeriod] = useState<PeriodKey>("month");
  var [showModal, setShowModal] = useState(false);
  var [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  var [importing, setImporting] = useState(false);
  var scrollRef = useRef<any>(null);

  var { transactions, summary, dreData, withdrawalData, isLoading, isDemo, createTransaction, deleteTransaction } = useTransactionsApi(activeTab, period);
  var { company, token } = useAuthStore();
  var qc = useQueryClient();

  var uncategorized = transactions.filter(function(t: any) { return !t.category || t.category === "outros"; }).map(function(t: any) { return t.description; }).filter(Boolean);

  function handleTabSelect(i: number) { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function handleExport() {
    if (transactions.length === 0) { toast.error("Nenhum lancamento para exportar"); return; }
    downloadCSV(arrayToCSV(transactions, TRANSACTION_COLUMNS), "aura_lancamentos_" + new Date().toISOString().slice(0, 10) + ".csv");
  }

  async function handleImport() {
    if (!company?.id || !token) { toast.error("Sessao expirada"); return; }
    try {
      setImporting(true);
      var rows = await pickFileAndParse();
      if (rows.length === 0) { toast.error("Arquivo vazio"); setImporting(false); return; }
      var res = await fetch(API + "/companies/" + company.id + "/transactions/batch?partial=true", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ transactions: rows }),
      });
      var data = await res.json();
      if (!res.ok) { toast.error(data.error || "Erro " + res.status); setImporting(false); return; }
      qc.invalidateQueries({ queryKey: ["transactions", company.id] });
      toast.success(data.saved > 0 ? data.saved + " lancamentos importados!" + (data.error_count > 0 ? " (" + data.error_count + " com erro)" : "") : "0 lancamentos validos");
    } catch (err: any) { toast.error("Erro ao importar: " + (err?.message || "tente novamente")); } finally { setImporting(false); }
  }

  function handleSaleCreated() {
    qc.invalidateQueries({ queryKey: ["transactions", company?.id] });
    qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
  }

  return (
    <View style={{ flex: 1 }}>
      <TransactionModal
        visible={showModal}
        onClose={function() { setShowModal(false); }}
        onSave={createTransaction}
        onSaleCreated={handleSaleCreated}
      />
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        <ScreenHeader title="Financeiro" actionLabel="Novo lancamento" actionIcon="dollar" onAction={function() { setShowModal(true); }} />
        <AgentBanner context="financeiro" />

        <View style={s.periodBar}>
          {PERIODS.map(function(p) {
            return <Pressable key={p.key} onPress={function() { setPeriod(p.key); }} style={[s.periodBtn, period === p.key && s.periodBtnActive, isWeb && { transition: "all 0.2s ease" } as any]}>
              <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
            </Pressable>;
          })}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {TABS.map(function(tab, i) {
            return <Pressable key={tab} onPress={function() { handleTabSelect(i); }} style={[s.tab, activeTab === i && s.tabActive, isWeb && { transition: "all 0.15s ease" } as any]}>
              <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{tab}</Text>
            </Pressable>;
          })}
        </ScrollView>

        {!isDemo && transactions.length > 0 && (activeTab === 0 || activeTab === 1) && <FinanceiroToolbar uncategorizedDescriptions={uncategorized} />}
        {isLoading && activeTab < 4 && <ListSkeleton rows={4} showCards />}

        {activeTab === 0 && <TabVisaoGeral transactions={transactions} summary={summary} period={period} isLoading={isLoading} isDemo={isDemo} onNewTransaction={function() { setShowModal(true); }} onImport={!importing ? handleImport : undefined} onGoToLancamentos={function() { handleTabSelect(1); }} onDelete={function(id) { setDeleteTarget(id); }} />}
        {activeTab === 1 && <TabLancamentos transactions={transactions} isLoading={isLoading} importing={importing} onNewTransaction={function() { setShowModal(true); }} onExport={handleExport} onImport={handleImport} onDelete={!isDemo ? function(id) { setDeleteTarget(id); } : undefined} />}
        {activeTab === 2 && <TabResumo transactions={transactions} dreApi={dreData} period={period} />}
        {activeTab === 3 && <TabRetirada transactions={transactions} />}
        {activeTab === 4 && <TabCupons />}

        <ConfirmDialog visible={!!deleteTarget} title="Excluir lancamento?" message="Esta acao nao pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={function() { if (deleteTarget) { deleteTransaction(deleteTarget); setDeleteTarget(null); } }} onCancel={function() { setDeleteTarget(null); }} />
        {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
      </ScrollView>
    </View>
  );
}

var s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  periodBar: { flexDirection: "row", backgroundColor: Colors.bg3, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  periodBtnActive: { backgroundColor: Colors.violet },
  periodText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  periodTextActive: { color: "#fff", fontWeight: "700" },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
