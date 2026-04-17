import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { SmartBalance } from "./SmartBalance";
import { SparklineBar } from "./SparklineBar";
import { PendingCards } from "./PendingCards";
import { QuickInsights } from "./QuickInsights";
import { TransactionRow } from "./TransactionRow";
import type { Transaction, PeriodKey } from "./types";

var isWeb = Platform.OS === "web";

type Summary = { income: number; expenses: number; balance: number };

type Props = {
  transactions: Transaction[];
  summary: Summary;
  previousSummary?: Summary | null;
  period: PeriodKey;
  customStart?: string;
  customEnd?: string;
  isLoading: boolean;
  isDemo: boolean;
  onNewTransaction: () => void;
  onImport?: () => void;
  onGoToLancamentos: () => void;
  onDelete?: (id: string) => void;
};

export function TabVisaoGeral({ transactions, summary, previousSummary, period, customStart, customEnd, isLoading, isDemo, onNewTransaction, onImport, onGoToLancamentos, onDelete }: Props) {
  if (transactions.length === 0 && !isLoading && !isDemo) {
    return <EmptyState icon="dollar" iconColor={Colors.green} title="Seu termometro financeiro" subtitle="Lance sua primeira receita ou despesa para ativar o painel inteligente." actionLabel="Novo lancamento" onAction={onNewTransaction} secondaryLabel="Importar de planilha" onSecondary={onImport} />;
  }

  return (
    <View>
      <SmartBalance income={summary.income} expenses={summary.expenses} balance={summary.balance} txCount={transactions.length} period={period} customStart={customStart} customEnd={customEnd} previousSummary={previousSummary} />
      <SparklineBar transactions={transactions} />
      <PendingCards transactions={transactions} />
      <QuickInsights transactions={transactions} income={summary.income} expenses={summary.expenses} />
      {transactions.length > 0 && (
        <View>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Ultimos lancamentos</Text>
            <Pressable onPress={onGoToLancamentos}><Text style={s.seeAll}>Ver todos</Text></Pressable>
          </View>
          <View style={s.listCard}>
            {transactions.slice(0, 8).map(function(t) {
              return <TransactionRow key={t.id} item={t} onDelete={!isDemo ? onDelete : undefined} />;
            })}
          </View>
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  seeAll: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
});
