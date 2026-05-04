import { View, Text, Pressable, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { SmartBalance } from "./SmartBalance";
import { SparklineBar } from "./SparklineBar";
import { PendingCards } from "./PendingCards";
import { IncomeDetail } from "./IncomeDetail";
import { ExpenseDetail } from "./ExpenseDetail";
import { ReconciliationSection } from "./ReconciliationSection";
import { QuickInsights } from "./QuickInsights";
import { TransactionRow } from "./TransactionRow";
import type { Transaction, PeriodKey } from "./types";
// v2: hero cards (redesign Onda 1)
import { HealthScoreHero, RunwayCard, BiggestLever } from "./v2";
// Onda 3: cashflow chart enriquecido (history + projection com banda confianca)
import { CashflowChart } from "./v2/Onda3Cards";
import { useFinancialInsights } from "@/hooks/useFinancialInsights";
// Multi-CNPJ: precisa saber se esta em modo consolidado pra ajustar comportamento
// dos cards v2 (legendas, hints "abra a empresa especifica", etc).
import { useAuthStore } from "@/stores/auth";

var W = Dimensions.get("window").width;
var IS_WIDE = W > 768;
var isWeb = Platform.OS === "web";

type Summary = { income: number; expenses: number; balance: number; pendingIncome?: number; pendingExpenses?: number };

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
  onEdit?: (tx: Transaction) => void;
};

export function TabVisaoGeral({ transactions, summary, previousSummary, period, customStart, customEnd, isLoading, isDemo, onNewTransaction, onImport, onGoToLancamentos, onDelete, onEdit }: Props) {
  // Multi-CNPJ: detecta modo consolidado pra ajustar UI dos cards v2.
  // Em consolidated, BiggestLever mostra "Soma de todas as empresas" + dica
  // pra abrir empresa especifica antes de cobrar.
  var consolidatedView = useAuthStore(function(state) { return state.consolidatedView; });

  // Calcula insights v2 (health score, runway, biggest lever) client-side.
  // Em consolidated, transactions e summary ja vem agregados de useTransactionsApi
  // (que chama /me/transactions em vez de /companies/:id/transactions).
  // Quando endpoint /financeiro/insights estiver pronto, hook mescla com dados do server
  // — em consolidated chamara /me/financeiro/insights, em per-company /companies/:id/financeiro/insights.
  var insights = useFinancialInsights({
    transactions: transactions,
    summary: summary,
    previousSummary: previousSummary,
    period: period,
  });

  if (transactions.length === 0 && !isLoading && !isDemo) {
    return <EmptyState icon="dollar" iconColor={Colors.green} title="Seu termometro financeiro" subtitle="Lance sua primeira receita ou despesa para ativar o painel inteligente." actionLabel="Novo lancamento" onAction={onNewTransaction} secondaryLabel="Importar de planilha" onSecondary={onImport} />;
  }

  return (
    <View>
      {/* === V2: Hero cards (redesign Onda 1, 04/05/2026) === */}
      {/* Health Score Hero — donut + drivers + frase narrativa parametrizada.
          Substitui ranking arbitrario "78/100" com formula 0.35*margem + 0.35*runway
          + 0.20*crescimento + 0.10*ticket (HEALTH_TARGETS/HEALTH_WEIGHTS). */}
      <HealthScoreHero insights={insights} />

      {/* Biggest Lever — destaca acao com maior impacto no caixa.
          Em consolidated mostra legenda "Soma de todas as empresas" + dica de abrir
          empresa especifica. CTA continua valido (leva pra Lancamentos consolidado). */}
      <BiggestLever insights={insights} onCta={onGoToLancamentos} consolidated={consolidatedView} />

      {/* SmartBalance + RunwayCard lado a lado em wide, stack em mobile.
          SmartBalance ja tinha "Saudavel/Atencao/Critico" propria — agora coabita
          com Health Score (visoes complementares: saldo do periodo vs saude geral). */}
      {IS_WIDE ? (
        <View style={s.heroGrid}>
          <View style={{ flex: 1 }}>
            <SmartBalance
              income={summary.income}
              expenses={summary.expenses}
              balance={summary.balance}
              pendingIncome={summary.pendingIncome}
              pendingExpenses={summary.pendingExpenses}
              txCount={transactions.length}
              period={period}
              customStart={customStart}
              customEnd={customEnd}
              previousSummary={previousSummary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <RunwayCard insights={insights} />
          </View>
        </View>
      ) : (
        <>
          <SmartBalance
            income={summary.income}
            expenses={summary.expenses}
            balance={summary.balance}
            pendingIncome={summary.pendingIncome}
            pendingExpenses={summary.pendingExpenses}
            txCount={transactions.length}
            period={period}
            customStart={customStart}
            customEnd={customEnd}
            previousSummary={previousSummary}
          />
          <RunwayCard insights={insights} />
        </>
      )}

      {/* === Componentes existentes (preservados) === */}
      <SparklineBar transactions={transactions} />
      <PendingCards transactions={transactions} />
      <IncomeDetail transactions={transactions} previousIncome={previousSummary ? previousSummary.income : null} />
      <ExpenseDetail transactions={transactions} previousExpenses={previousSummary ? previousSummary.expenses : null} />
      {/* V2 Onda 3: CashflowChart substitui CashFlowCard antigo. Consome
          insights.cashflow do server (history 30d + projection 30/60/90 com
          banda confianca ±15%). Funciona em consolidated e per-company. */}
      <View style={[s.cashflowCard, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <Text style={s.cashflowKicker}>FLUXO DE CAIXA · HISTORICO + PROJECAO</Text>
        <Text style={s.cashflowTitle}>Pra onde o caixa esta indo</Text>
        <CashflowChart data={insights.cashflow} consolidated={consolidatedView} />
      </View>
      {/* AIFinancialInsights removido na Onda 1 do redesign — volta no plano Expansao
          com cache 24h + regen on-demand pra nao queimar quota Haiku. */}
      <QuickInsights transactions={transactions} income={summary.income} expenses={summary.expenses} />
      <ReconciliationSection />
      {transactions.length > 0 && (
        <View>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Ultimos lancamentos</Text>
            <Pressable onPress={onGoToLancamentos}><Text style={s.seeAll}>Ver todos</Text></Pressable>
          </View>
          <View style={s.listCard}>
            {transactions.slice(0, 8).map(function(t) {
              return <TransactionRow key={t.id} item={t} onDelete={!isDemo ? onDelete : undefined} onEdit={!isDemo ? onEdit : undefined} />;
            })}
          </View>
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  heroGrid: { flexDirection: "row", gap: 14, marginBottom: 0 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  seeAll: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  cashflowCard: { borderRadius: 16, padding: 18, borderWidth: 1, marginBottom: 20 },
  cashflowKicker: { fontSize: 9.5, color: Colors.ink3, letterSpacing: 1.2, fontWeight: "600", textTransform: "uppercase" },
  cashflowTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700", marginTop: 4, marginBottom: 14, letterSpacing: -0.3 },
});
