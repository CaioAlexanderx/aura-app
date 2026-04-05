import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { HoverCard } from "@/components/HoverCard";

// ============================================================
// MKT-01: ReconciliacaoBancaria — Bank Reconciliation Dashboard
// Import statements, auto-match, manual reconcile
// ============================================================

export interface BankAccount {
  id: string; bank_name: string; bank_code?: string; agency?: string;
  account_number?: string; nickname?: string; current_balance: number;
  is_primary: boolean; last_import?: string;
}

export interface StatementEntry {
  id: string; date: string; description: string; amount: number;
  balance?: number; match_status: "pendente" | "automatico" | "manual" | "ignorado" | "divergente";
  matched_transaction_id?: string; category?: string; bank_name?: string;
}

export interface UnmatchedTransaction {
  id: string; date: string; description: string; amount: number;
  type: string; category?: string;
}

export interface ReconciliationSummary {
  pending: number; auto_matched: number; manual_matched: number;
  ignored: number; divergent: number; total: number;
  total_credits: number; total_debits: number;
}

interface Props {
  accounts: BankAccount[];
  summary: ReconciliationSummary;
  conciliationRate: number;
  pendingEntries: StatementEntry[];
  unmatchedTransactions: UnmatchedTransaction[];
  onImportStatement?: (accountId: string) => void;
  onAutoMatch?: (accountId: string) => void;
  onManualMatch?: (entryId: string, transactionId: string) => void;
  onIgnoreEntry?: (entryId: string) => void;
  onAddAccount?: () => void;
  onCreateRule?: () => void;
}

function fmt(v: number) { return "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); }

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pendente:    { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Pendente" },
  automatico:  { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Auto" },
  manual:      { bg: "rgba(6,182,212,0.12)",  color: "#06B6D4", label: "Manual" },
  ignorado:    { bg: "rgba(156,163,175,0.12)", color: "#9CA3AF", label: "Ignorado" },
  divergente:  { bg: "rgba(239,68,68,0.12)",  color: "#EF4444", label: "Divergente" },
};

export function ReconciliacaoBancaria({
  accounts, summary, conciliationRate, pendingEntries, unmatchedTransactions,
  onImportStatement, onAutoMatch, onManualMatch, onIgnoreEntry, onAddAccount, onCreateRule,
}: Props) {
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(accounts[0]?.id || null);

  const matched = summary.auto_matched + summary.manual_matched;

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <HoverCard style={s.kpi}>
          <Text style={s.kpiLabel}>Taxa de conciliacao</Text>
          <Text style={[s.kpiValue, { color: conciliationRate >= 80 ? "#10B981" : conciliationRate >= 50 ? "#F59E0B" : "#EF4444" }]}>{conciliationRate}%</Text>
          <View style={s.rateBar}><View style={[s.rateFill, { width: conciliationRate + "%", backgroundColor: conciliationRate >= 80 ? "#10B981" : "#F59E0B" }]} /></View>
        </HoverCard>
        <HoverCard style={s.kpi}>
          <Text style={s.kpiLabel}>Conciliados</Text>
          <Text style={[s.kpiValue, { color: "#10B981" }]}>{matched}</Text>
          <Text style={s.kpiSub}>{summary.auto_matched} auto + {summary.manual_matched} manual</Text>
        </HoverCard>
        <HoverCard style={s.kpi}>
          <Text style={s.kpiLabel}>Pendentes</Text>
          <Text style={[s.kpiValue, { color: "#F59E0B" }]}>{summary.pending}</Text>
          <Text style={s.kpiSub}>de {summary.total} lancamentos</Text>
        </HoverCard>
        <HoverCard style={s.kpi}>
          <Text style={s.kpiLabel}>Movimentacao</Text>
          <Text style={[s.kpiValue, { color: "#06B6D4", fontSize: 16 }]}>
            <Text style={{ color: "#10B981" }}>+{fmt(summary.total_credits)}</Text>
            {" / "}
            <Text style={{ color: "#EF4444" }}>{fmt(summary.total_debits)}</Text>
          </Text>
        </HoverCard>
      </View>

      {/* Accounts bar */}
      <View style={s.accountsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {accounts.map(acc => (
            <Pressable key={acc.id} onPress={() => setSelectedAccount(acc.id)} style={[s.accountChip, selectedAccount === acc.id && s.accountChipActive]}>
              <Text style={[s.accountName, selectedAccount === acc.id && s.accountNameActive]}>{acc.nickname || acc.bank_name}</Text>
              <Text style={s.accountBal}>{fmt(acc.current_balance)}</Text>
              {acc.is_primary && <View style={s.primaryDot} />}
            </Pressable>
          ))}
          {onAddAccount && (
            <Pressable onPress={onAddAccount} style={s.addAccountBtn}>
              <Text style={s.addAccountText}>+ Conta</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* Actions */}
      <View style={s.actionsRow}>
        {selectedAccount && onImportStatement && (
          <Pressable onPress={() => onImportStatement(selectedAccount)} style={s.btnPrimary}>
            <Text style={s.btnPrimaryText}>Importar extrato</Text>
          </Pressable>
        )}
        {selectedAccount && onAutoMatch && (
          <Pressable onPress={() => onAutoMatch(selectedAccount)} style={s.btnOutline}>
            <Text style={s.btnOutlineText}>Conciliar automatico</Text>
          </Pressable>
        )}
        {onCreateRule && (
          <Pressable onPress={onCreateRule} style={s.btnOutline}>
            <Text style={s.btnOutlineText}>Criar regra</Text>
          </Pressable>
        )}
      </View>

      {/* Two-panel reconciliation */}
      <View style={s.panels}>
        {/* Left: Bank statement entries */}
        <View style={s.panel}>
          <Text style={s.panelTitle}>Extrato bancario ({pendingEntries.length} pendentes)</Text>
          {pendingEntries.map(entry => {
            const isCredit = entry.amount > 0;
            const isSelected = selectedEntry === entry.id;
            return (
              <Pressable key={entry.id} onPress={() => setSelectedEntry(isSelected ? null : entry.id)} style={[s.entryRow, isSelected && s.entryRowSelected]}>
                <Text style={s.entryDate}>{new Date(entry.date).toLocaleDateString("pt-BR")}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.entryDesc} numberOfLines={1}>{entry.description}</Text>
                  {entry.category && <Text style={s.entryCat}>{entry.category}</Text>}
                </View>
                <Text style={[s.entryAmount, { color: isCredit ? "#10B981" : "#EF4444" }]}>
                  {isCredit ? "+" : ""}{fmt(entry.amount)}
                </Text>
                {isSelected && onIgnoreEntry && (
                  <Pressable onPress={() => onIgnoreEntry(entry.id)} style={s.ignoreBtn}>
                    <Text style={s.ignoreBtnText}>Ignorar</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
          {pendingEntries.length === 0 && <Text style={s.emptyText}>Todos os lancamentos foram conciliados!</Text>}
        </View>

        {/* Right: Aura transactions (potential matches) */}
        <View style={s.panel}>
          <Text style={s.panelTitle}>Lancamentos Aura ({unmatchedTransactions.length} sem match)</Text>
          {unmatchedTransactions.map(tx => {
            const isExpense = tx.type === "expense";
            const amount = isExpense ? -Math.abs(Number(tx.amount)) : Math.abs(Number(tx.amount));
            return (
              <Pressable
                key={tx.id}
                onPress={() => {
                  if (selectedEntry && onManualMatch) {
                    onManualMatch(selectedEntry, tx.id);
                    setSelectedEntry(null);
                  }
                }}
                style={[s.txRow, selectedEntry && s.txRowMatchable]}
              >
                <Text style={s.txDate}>{new Date(tx.date).toLocaleDateString("pt-BR")}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                  {tx.category && <Text style={s.txCat}>{tx.category}</Text>}
                </View>
                <Text style={[s.txAmount, { color: isExpense ? "#EF4444" : "#10B981" }]}>
                  {amount > 0 ? "+" : ""}{fmt(amount)}
                </Text>
                {selectedEntry && (
                  <View style={s.matchIcon}><Text style={s.matchIconText}>\u2192</Text></View>
                )}
              </Pressable>
            );
          })}
          {unmatchedTransactions.length === 0 && <Text style={s.emptyText}>Todos os lancamentos tem correspondencia.</Text>}
        </View>
      </View>

      {/* Instructions */}
      {selectedEntry && (
        <View style={s.helpBox}>
          <Text style={s.helpText}>Selecione um lancamento Aura ao lado para conciliar manualmente, ou clique "Ignorar" para pular.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 16 },
  kpiRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  kpi: { flex: 1, minWidth: IS_WIDE ? 140 : "45%", backgroundColor: Colors.bg3, borderRadius: 14, padding: IS_WIDE ? 18 : 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 24, fontWeight: "800", color: Colors.ink },
  kpiSub: { fontSize: 10, color: Colors.ink3 },
  rateBar: { width: "100%", height: 4, borderRadius: 2, backgroundColor: Colors.bg4, marginTop: 4 },
  rateFill: { height: 4, borderRadius: 2 },

  accountsBar: { flexDirection: "row" },
  accountChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 2 },
  accountChipActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  accountName: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  accountNameActive: { color: Colors.violet3 },
  accountBal: { fontSize: 11, color: Colors.ink3 },
  primaryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green, marginTop: 2 },
  addAccountBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed", justifyContent: "center" },
  addAccountText: { fontSize: 12, color: Colors.ink3 },

  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  btnPrimary: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  btnOutline: { borderWidth: 1, borderColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  btnOutlineText: { color: Colors.violet3, fontSize: 12, fontWeight: "500" },

  panels: { flexDirection: IS_WIDE ? "row" : "column", gap: 12 },
  panel: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 4, maxHeight: 500 },
  panelTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 8 },

  entryRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  entryRowSelected: { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 8, borderBottomWidth: 0 },
  entryDate: { fontSize: 10, color: Colors.ink3, width: 55 },
  entryDesc: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  entryCat: { fontSize: 10, color: Colors.ink3 },
  entryAmount: { fontSize: 13, fontWeight: "600", minWidth: 80, textAlign: "right" },
  ignoreBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 0.5, borderColor: Colors.ink3 },
  ignoreBtnText: { fontSize: 9, color: Colors.ink3 },

  txRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  txRowMatchable: { backgroundColor: "rgba(16,185,129,0.04)", borderRadius: 8, paddingHorizontal: 8 },
  txDate: { fontSize: 10, color: Colors.ink3, width: 55 },
  txDesc: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  txCat: { fontSize: 10, color: Colors.ink3 },
  txAmount: { fontSize: 13, fontWeight: "600", minWidth: 80, textAlign: "right" },
  matchIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.12)", alignItems: "center", justifyContent: "center" },
  matchIconText: { fontSize: 12, color: "#10B981" },

  helpBox: { padding: 12, borderRadius: 10, backgroundColor: "rgba(124,58,237,0.06)", borderWidth: 0.5, borderColor: "rgba(124,58,237,0.2)" },
  helpText: { fontSize: 12, color: Colors.violet3, textAlign: "center" },

  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 20 },
});

export default ReconciliacaoBancaria;
