import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Dimensions, TextInput } from "react-native";
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
import type { PeriodKey, Transaction } from "@/components/screens/financeiro/types";
import { arrayToCSV, downloadCSV, pickFileAndParse, TRANSACTION_COLUMNS } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { FinanceiroToolbar } from "@/components/FinanceiroToolbar";
import { AgentBanner } from "@/components/AgentBanner";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/services/api";
import { Icon } from "@/components/Icon";

var IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
var isWeb = Platform.OS === "web";

function maskDate(v: string): string {
  var d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length >= 5) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
  return d;
}

function brToISO(br: string): string | null {
  var parts = br.split("/");
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  var d = parseInt(parts[0]); var m = parseInt(parts[1]); var y = parseInt(parts[2]);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020) return null;
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

export default function FinanceiroScreen() {
  var [activeTab, setActiveTab] = useState(0);
  var [period, setPeriod] = useState<PeriodKey>("month");
  var [showModal, setShowModal] = useState(false);
  var [editTx, setEditTx] = useState<Transaction | null>(null);
  var [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  var [importing, setImporting] = useState(false);
  var scrollRef = useRef<any>(null);

  // F-07: custom date range
  var [customStartBR, setCustomStartBR] = useState("");
  var [customEndBR, setCustomEndBR] = useState("");
  var customStart = brToISO(customStartBR) || undefined;
  var customEnd = brToISO(customEndBR) || undefined;

  var { transactions, summary, previousSummary, dreData, withdrawalData, isLoading, isDemo, createTransaction, deleteTransaction } = useTransactionsApi(activeTab, period, customStart, customEnd);
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
      var res = await fetch(BASE_URL + "/companies/" + company.id + "/transactions/batch?partial=true", {
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

  function handleEdit(tx: Transaction) { setEditTx(tx); setShowModal(true); }

  return (
    <View style={{ flex: 1 }}>
      <TransactionModal
        visible={showModal}
        onClose={function() { setShowModal(false); setEditTx(null); }}
        onSave={createTransaction}
        onSaleCreated={handleSaleCreated}
        editTransaction={editTx}
      />
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        <ScreenHeader title="Financeiro" actionLabel="Novo lancamento" actionIcon="dollar" onAction={function() { setEditTx(null); setShowModal(true); }} />
        <AgentBanner context="financeiro" />

        <View style={s.periodBar}>
          {PERIODS.map(function(p) {
            return <Pressable key={p.key} onPress={function() { setPeriod(p.key); }} style={[s.periodBtn, period === p.key && s.periodBtnActive, isWeb && { transition: "all 0.2s ease" } as any]}>
              <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
            </Pressable>;
          })}
        </View>

        {/* F-07: Custom date range picker */}
        {period === "custom" && (
          <View style={s.customRow}>
            <View style={s.customField}>
              <Text style={s.customLabel}>De</Text>
              <TextInput style={s.customInput} value={customStartBR} onChangeText={function(v) { setCustomStartBR(maskDate(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} />
            </View>
            <Icon name="arrow_right" size={14} color={Colors.ink3} />
            <View style={s.customField}>
              <Text style={s.customLabel}>Ate</Text>
              <TextInput style={s.customInput} value={customEndBR} onChangeText={function(v) { setCustomEndBR(maskDate(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} />
            </View>
            {customStart && customEnd && (
              <View style={s.customOk}>
                <Icon name="check" size={14} color={Colors.green} />
              </View>
            )}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {TABS.map(function(tab, i) {
            return <Pressable key={tab} onPress={function() { handleTabSelect(i); }} style={[s.tab, activeTab === i && s.tabActive, isWeb && { transition: "all 0.15s ease" } as any]}>
              <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{tab}</Text>
            </Pressable>;
          })}
        </ScrollView>

        {!isDemo && transactions.length > 0 && (activeTab === 0 || activeTab === 1) && <FinanceiroToolbar uncategorizedDescriptions={uncategorized} />}
        {isLoading && activeTab < 4 && <ListSkeleton rows={4} showCards />}

        {activeTab === 0 && <TabVisaoGeral transactions={transactions} summary={summary} previousSummary={previousSummary} period={period} customStart={customStart} customEnd={customEnd} isLoading={isLoading} isDemo={isDemo} onNewTransaction={function() { setEditTx(null); setShowModal(true); }} onImport={!importing ? handleImport : undefined} onGoToLancamentos={function() { handleTabSelect(1); }} onDelete={function(id) { setDeleteTarget(id); }} />}
        {activeTab === 1 && <TabLancamentos transactions={transactions} isLoading={isLoading} importing={importing} onNewTransaction={function() { setEditTx(null); setShowModal(true); }} onExport={handleExport} onImport={handleImport} onDelete={!isDemo ? function(id) { setDeleteTarget(id); } : undefined} onEdit={!isDemo ? handleEdit : undefined} />}
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
  periodBar: { flexDirection: "row", backgroundColor: Colors.bg3, borderRadius: 12, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  periodBtnActive: { backgroundColor: Colors.violet },
  periodText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  periodTextActive: { color: "#fff", fontWeight: "700" },
  // F-07: custom date picker
  customRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2 },
  customField: { flex: 1 },
  customLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  customInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, textAlign: "center" },
  customOk: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  // Tabs
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
