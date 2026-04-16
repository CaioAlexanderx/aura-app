import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { SmartBalance } from "./SmartBalance";
import { QuickInsights } from "./QuickInsights";
import { TransactionRow } from "./TransactionRow";
import { Icon } from "@/components/Icon";
import type { Transaction, PeriodKey } from "./types";
import { fmt } from "./types";

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

// F-12: Cards de contas pendentes
function PendingCards({ transactions }: { transactions: Transaction[] }) {
  var pending = transactions.filter(function(t) { return t.status === "pending"; });
  if (pending.length === 0) return null;

  var toReceive = pending.filter(function(t) { return t.type === "income"; });
  var toPay = pending.filter(function(t) { return t.type === "expense"; });
  var toReceiveTotal = toReceive.reduce(function(s, t) { return s + t.amount; }, 0);
  var toPayTotal = toPay.reduce(function(s, t) { return s + t.amount; }, 0);

  return (
    <View style={pc.container}>
      <Text style={pc.title}>Pendentes</Text>
      <View style={pc.row}>
        {toReceive.length > 0 && (
          <View style={[pc.card, { borderLeftColor: Colors.green }]}>
            <View style={pc.cardHeader}>
              <View style={[pc.iconWrap, { backgroundColor: Colors.greenD }]}>
                <Icon name="trending_up" size={12} color={Colors.green} />
              </View>
              <Text style={pc.cardLabel}>A receber</Text>
            </View>
            <Text style={[pc.cardValue, { color: Colors.green }]}>{fmt(toReceiveTotal)}</Text>
            <Text style={pc.cardCount}>{toReceive.length} lancamento{toReceive.length > 1 ? "s" : ""}</Text>
          </View>
        )}
        {toPay.length > 0 && (
          <View style={[pc.card, { borderLeftColor: Colors.red }]}>
            <View style={pc.cardHeader}>
              <View style={[pc.iconWrap, { backgroundColor: Colors.redD }]}>
                <Icon name="trending_down" size={12} color={Colors.red} />
              </View>
              <Text style={pc.cardLabel}>A pagar</Text>
            </View>
            <Text style={[pc.cardValue, { color: Colors.red }]}>{fmt(toPayTotal)}</Text>
            <Text style={pc.cardCount}>{toPay.length} lancamento{toPay.length > 1 ? "s" : ""}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

var pc = StyleSheet.create({
  container: { marginBottom: 20 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },
  card: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  cardValue: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  cardCount: { fontSize: 10, color: Colors.ink3 },
});

export function TabVisaoGeral({ transactions, summary, previousSummary, period, customStart, customEnd, isLoading, isDemo, onNewTransaction, onImport, onGoToLancamentos, onDelete }: Props) {
  if (transactions.length === 0 && !isLoading && !isDemo) {
    return <EmptyState icon="dollar" iconColor={Colors.green} title="Seu termometro financeiro" subtitle="Lance sua primeira receita ou despesa para ativar o painel inteligente." actionLabel="Novo lancamento" onAction={onNewTransaction} secondaryLabel="Importar de planilha" onSecondary={onImport} />;
  }

  return (
    <View>
      <SmartBalance income={summary.income} expenses={summary.expenses} balance={summary.balance} txCount={transactions.length} period={period} customStart={customStart} customEnd={customEnd} previousSummary={previousSummary} transactions={transactions} />
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
