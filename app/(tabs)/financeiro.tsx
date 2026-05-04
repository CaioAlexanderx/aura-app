import { useState, useMemo, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Dimensions, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { useTransactionsApi } from "@/hooks/useTransactions";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TransactionModal } from "@/components/screens/financeiro/TransactionModal";
import { TabVisaoGeral } from "@/components/screens/financeiro/TabVisaoGeral";
import { TabLancamentos } from "@/components/screens/financeiro/TabLancamentos";
import { TabResumo } from "@/components/screens/financeiro/TabResumo";
import { TabRetirada } from "@/components/screens/financeiro/TabRetirada";
import { TabCupons } from "@/components/screens/financeiro/TabCupons";
import { MonthExpensesBanner } from "@/components/screens/financeiro/MonthExpensesBanner";
import { TABS, TAB_INDEX } from "@/components/screens/financeiro/types";
import type { PeriodKey, Transaction } from "@/components/screens/financeiro/types";
import { arrayToCSV, downloadCSV, pickFileAndParse, TRANSACTION_COLUMNS } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { FinanceiroToolbar } from "@/components/FinanceiroToolbar";
import { AgentBanner } from "@/components/AgentBanner";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/services/api";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { ConsolidatedBreakdownCard } from "@/components/screens/dashboard/ConsolidatedBreakdownCard";
// V2 redesign (04/05/2026): Topbar nova + 2 abas novas (Receitas, Despesas).
import { FinanceiroTopbar, TabReceitas, TabDespesas } from "@/components/screens/financeiro/v2";

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
  // V2: 6 abas (Visao Geral, Receitas, Despesas, Lancamentos, Retirada, Cupons).
  // TAB_INDEX exporta indices semanticos; nao escrever numeros literais.
  var [activeTab, setActiveTab] = useState(TAB_INDEX.visao);
  var [period, setPeriod] = useState<PeriodKey>("today");
  var [showModal, setShowModal] = useState(false);
  var [editTx, setEditTx] = useState<Transaction | null>(null);
  var [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  var [importing, setImporting] = useState(false);
  // Estado pra abrir/fechar o seletor de periodo customizado quando usuario clica
  // no botao "Periodo" do topbar.
  var [showCustomPeriod, setShowCustomPeriod] = useState(false);
  var scrollRef = useRef<any>(null);

  var [customStartBR, setCustomStartBR] = useState("");
  var [customEndBR, setCustomEndBR] = useState("");
  var customStart = brToISO(customStartBR) || undefined;
  var customEnd = brToISO(customEndBR) || undefined;

  var {
    transactions, summary, previousSummary, currentMonthExpenses,
    dreData, withdrawalData, isLoading, isDemo,
    createTransaction, deleteTransaction,
    consolidatedView, consolidatedBreakdown,
  } = useTransactionsApi(activeTab, period, customStart, customEnd);
  var { company, token, companyCount } = useAuthStore();
  var qc = useQueryClient();

  var uncategorized = transactions.filter(function(t: any) { return !t.category || t.category === "outros"; }).map(function(t: any) { return t.description; }).filter(Boolean);

  var showMonthBanner = period !== "month" && period !== "all" && currentMonthExpenses && currentMonthExpenses.count > 0;

  // MULTICNPJ Onda 2.2: adapta TransactionsBreakdown -> DashboardBreakdown shape
  // (income -> revenue) pra reusar o mesmo ConsolidatedBreakdownCard do Painel.
  var breakdownForCard = useMemo(function() {
    if (!consolidatedBreakdown || !consolidatedBreakdown.length) return [];
    return consolidatedBreakdown.map(function(b: any) {
      return {
        company_id: b.company_id,
        company_name: b.company_name,
        is_primary: b.is_primary,
        revenue: b.income || 0,
        expenses: b.expenses || 0,
        net: b.net || 0,
        pending_income: b.pending_income || 0,
        pending_expenses: b.pending_expenses || 0,
        sales_count_month: 0,
        sales_today: 0,
      };
    });
  }, [consolidatedBreakdown]);

  function handleTabSelect(i: number) { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function handlePeriodChange(p: PeriodKey) {
    setPeriod(p);
    // Quando usuario clica em "Periodo", abre seletor de datas custom inline
    if (p === "custom") setShowCustomPeriod(true);
    else setShowCustomPeriod(false);
  }

  function handleExport() {
    if (transactions.length === 0) { toast.error("Nenhum lancamento para exportar"); return; }
    downloadCSV(arrayToCSV(transactions, TRANSACTION_COLUMNS), "aura_lancamentos_" + new Date().toISOString().slice(0, 10) + ".csv");
  }

  async function handleImport() {
    if (consolidatedView) {
      toast.error("Selecione uma empresa especifica para importar lancamentos");
      return;
    }
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

  function handleEdit(tx: Transaction) {
    if (consolidatedView) {
      toast.error("Selecione a empresa especifica para editar (toque no badge da loja)");
      return;
    }
    setEditTx(tx); setShowModal(true);
  }

  function handleNewTransaction() {
    if (consolidatedView) {
      toast.error("Selecione uma empresa especifica para criar lancamentos");
      return;
    }
    setEditTx(null); setShowModal(true);
  }

  return (
    <View style={{ flex: 1 }}>
      <WebPortal active={showModal}>
        <TransactionModal
          visible={showModal}
          onClose={function() { setShowModal(false); setEditTx(null); }}
          onSave={createTransaction}
          onSaleCreated={handleSaleCreated}
          editTransaction={editTx}
        />
      </WebPortal>
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        {/* V2: Topbar nova substitui ScreenHeader + periodBar antigo. Em consolidated,
            mostra "Consolidado · N empresas" e esconde "Novo lancamento". */}
        <FinanceiroTopbar
          companyName={company?.name || ""}
          consolidated={!!consolidatedView}
          companyCount={companyCount || 0}
          period={period}
          onPeriodChange={handlePeriodChange}
          onExport={handleExport}
          onNew={consolidatedView ? undefined : handleNewTransaction}
        />

        {/* MULTICNPJ Onda 2.2: banner de modo consolidado — preservado abaixo do topbar */}
        {consolidatedView && (
          <View style={s.consolidatedBanner}>
            <Icon name="globe" size={14} color="#a78bfa" />
            <View style={{ flex: 1 }}>
              <Text style={s.consolidatedTitle}>
                Visao consolidada · {companyCount} empresa{companyCount !== 1 ? "s" : ""}
              </Text>
              <Text style={s.consolidatedSub}>
                Lancamentos somados de todas as empresas. Para criar/editar, selecione uma empresa especifica.
              </Text>
            </View>
          </View>
        )}

        {!consolidatedView && <AgentBanner context="financeiro" />}

        {/* Selector de periodo custom — aparece quando usuario clica "Periodo" no topbar.
            Em produção, futuro: substituir por DatePicker bonito. */}
        {(period === "custom" || showCustomPeriod) && (
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

        {showMonthBanner && (
          <MonthExpensesBanner
            count={currentMonthExpenses.count}
            total={currentMonthExpenses.total}
            onSwitchToMonth={function() { setPeriod("month"); }}
          />
        )}

        {/* MULTICNPJ Onda 2.2: breakdown card so na Tab Visao Geral e em consolidated */}
        {consolidatedView && activeTab === TAB_INDEX.visao && breakdownForCard.length > 0 && (
          <ConsolidatedBreakdownCard breakdown={breakdownForCard as any} />
        )}

        {/* Tabs (6 abas — V2). Scroll horizontal em mobile pra caber todas. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {TABS.map(function(tab, i) {
            return <Pressable key={tab} onPress={function() { handleTabSelect(i); }} style={[s.tab, activeTab === i && s.tabActive, isWeb && { transition: "all 0.15s ease" } as any]}>
              <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{tab}</Text>
            </Pressable>;
          })}
        </ScrollView>

        {!isDemo && transactions.length > 0 && (activeTab === TAB_INDEX.visao || activeTab === TAB_INDEX.lancamentos) && !consolidatedView && <FinanceiroToolbar uncategorizedDescriptions={uncategorized} />}
        {isLoading && activeTab !== TAB_INDEX.cupons && <ListSkeleton rows={4} showCards />}

        {/* Tab content — switch por activeTab semantico */}
        {activeTab === TAB_INDEX.visao && (
          <TabVisaoGeral
            transactions={transactions}
            summary={summary}
            previousSummary={previousSummary}
            period={period}
            customStart={customStart}
            customEnd={customEnd}
            isLoading={isLoading}
            isDemo={isDemo}
            onNewTransaction={handleNewTransaction}
            onImport={!importing && !consolidatedView ? handleImport : undefined}
            onGoToLancamentos={function() { handleTabSelect(TAB_INDEX.lancamentos); }}
            onDelete={consolidatedView ? undefined : function(id) { setDeleteTarget(id); }}
            onEdit={!isDemo && !consolidatedView ? handleEdit : undefined}
          />
        )}

        {/* V2: Receitas + Despesas — abas novas (multi-CNPJ aware).
            Onda 2: passa period pro hook useFinancialInsights buscar dados ricos
            do server (top5, methods, timeline, DOW, anomalias, gauge). */}
        {activeTab === TAB_INDEX.receitas && (
          <TabReceitas
            transactions={transactions}
            summary={summary}
            previousSummary={previousSummary}
            period={period}
            consolidated={!!consolidatedView}
          />
        )}
        {activeTab === TAB_INDEX.despesas && (
          <TabDespesas
            transactions={transactions}
            summary={summary}
            previousSummary={previousSummary}
            period={period}
            consolidated={!!consolidatedView}
          />
        )}

        {activeTab === TAB_INDEX.lancamentos && (
          <TabLancamentos
            transactions={transactions}
            isLoading={isLoading}
            importing={importing}
            onNewTransaction={handleNewTransaction}
            onExport={handleExport}
            onImport={handleImport}
            onDelete={!isDemo && !consolidatedView ? function(id) { setDeleteTarget(id); } : undefined}
            onEdit={!isDemo && !consolidatedView ? handleEdit : undefined}
          />
        )}

        {/* Retirada e Cupons — preservadas como abas extras (Onda 1 do redesign).
            Em consolidated, ambas mostram o ConsolidatedBlocked existente. */}
        {activeTab === TAB_INDEX.retirada && consolidatedView && <ConsolidatedBlocked label="Retirada / Pro-labore" description="O calculo de retirada usa regime tributario e Fator R da empresa. Selecione uma empresa no switcher." />}
        {activeTab === TAB_INDEX.retirada && !consolidatedView && <TabRetirada transactions={transactions} />}
        {activeTab === TAB_INDEX.cupons && consolidatedView && <ConsolidatedBlocked label="Cupons" description="Cupons sao gerenciados por empresa. Selecione uma para ver e criar cupons." />}
        {activeTab === TAB_INDEX.cupons && !consolidatedView && <TabCupons />}

        <ConfirmDialog visible={!!deleteTarget} title="Excluir lancamento?" message="Esta acao nao pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={function() { if (deleteTarget) { deleteTransaction(deleteTarget); setDeleteTarget(null); } }} onCancel={function() { setDeleteTarget(null); }} />
        {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
      </ScrollView>
    </View>
  );
}

// MULTICNPJ Onda 2.2: placeholder pras tabs que precisam de empresa especifica
function ConsolidatedBlocked({ label, description }: { label: string; description: string }) {
  return (
    <View style={s.blocked}>
      <View style={s.blockedIconWrap}>
        <Icon name="lock" size={20} color="#a78bfa" />
      </View>
      <Text style={s.blockedTitle}>{label} indisponível em modo consolidado</Text>
      <Text style={s.blockedDesc}>{description}</Text>
      <Text style={s.blockedHint}>Use o seletor de empresa no menu lateral para escolher uma.</Text>
    </View>
  );
}

var s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2 },
  customField: { flex: 1 },
  customLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  customInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, textAlign: "center" },
  customOk: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },

  // MULTICNPJ Onda 2.2
  consolidatedBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  consolidatedTitle: { fontSize: 12.5, fontWeight: "700", color: "#c4b5fd", letterSpacing: 0.2 },
  consolidatedSub: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 14 },
  blocked: {
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: "center",
    marginTop: 8,
  },
  blockedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(124,58,237,0.14)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  blockedTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  blockedDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, textAlign: "center", marginBottom: 8, maxWidth: 420 },
  blockedHint: { fontSize: 11, color: Colors.violet3, fontStyle: "italic" },
});
