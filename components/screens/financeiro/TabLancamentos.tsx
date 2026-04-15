import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { ImportExportBar } from "@/components/ImportExportBar";
import { TransactionRow } from "./TransactionRow";
import type { Transaction } from "./types";

var isWeb = Platform.OS === "web";

type Props = {
  transactions: Transaction[];
  isLoading: boolean;
  importing: boolean;
  onNewTransaction: () => void;
  onExport: () => void;
  onImport: () => void;
  onDelete?: (id: string) => void;
};

export function TabLancamentos({ transactions, isLoading, importing, onNewTransaction, onExport, onImport, onDelete }: Props) {
  var [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");

  var displayTransactions = useMemo(function() {
    if (typeFilter === "all") return transactions;
    return transactions.filter(function(t) { return t.type === typeFilter; });
  }, [transactions, typeFilter]);

  return (
    <View>
      {transactions.length > 0 && (
        <View style={s.importBar}>
          <ImportExportBar onExport={onExport} onImport={!importing ? onImport : undefined} itemCount={displayTransactions.length} />
          {importing && <View style={s.importingBadge}><ActivityIndicator size="small" color={Colors.violet3} /><Text style={s.importingText}>Importando...</Text></View>}
        </View>
      )}

      <View style={s.typeFilterRow}>
        {(["all", "income", "expense"] as const).map(function(tf) {
          return (
            <Pressable key={tf} onPress={function() { setTypeFilter(tf); }}
              style={[s.typeBtn, typeFilter === tf && s.typeBtnActive, isWeb && { transition: "all 0.15s ease" } as any]}>
              <Text style={[s.typeText, typeFilter === tf && s.typeTextActive]}>
                {tf === "all" ? "Todos" : tf === "income" ? "Entradas" : "Saidas"}
              </Text>
              <View style={[s.typeBadge, tf === "income" && { backgroundColor: Colors.greenD }, tf === "expense" && { backgroundColor: Colors.redD }]}>
                <Text style={[s.typeBadgeText, tf === "income" && { color: Colors.green }, tf === "expense" && { color: Colors.red }]}>
                  {tf === "all" ? transactions.length : transactions.filter(function(t) { return t.type === tf; }).length}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {displayTransactions.length === 0 && !isLoading && (
        <EmptyState icon="dollar" iconColor={Colors.green} title="Nenhum lancamento" subtitle="Lance sua primeira receita ou despesa, ou importe de uma planilha CSV."
          actionLabel="Novo lancamento" onAction={onNewTransaction}
          secondaryLabel={importing ? "Importando..." : "Importar CSV"}
          onSecondary={!importing ? onImport : undefined} />
      )}

      {displayTransactions.length > 0 && (
        <View style={s.listCard}>
          {displayTransactions.map(function(t) { return <TransactionRow key={t.id} item={t} onDelete={onDelete} />; })}
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  typeFilterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  typeBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  typeText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  typeTextActive: { color: Colors.violet3, fontWeight: "600" },
  typeBadge: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, color: Colors.ink3, fontWeight: "700" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  importBar: { marginBottom: 12 },
  importingBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  importingText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
