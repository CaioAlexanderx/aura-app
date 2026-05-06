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
import { CollapsibleSection } from "./CollapsibleSection";
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

  // Contadores rapidos pros subtitles dos accordions
  var incomeCount = transactions.filter(function(t) { return t.type === "income"; }).length;
  var expenseCount = transactions.filter(function(t) { return t.type === "expense"; }).length;
  var pendingCount = transactions.filter(function(t) { return t.status === "pending"; }).length;

  return (
    <View>
      {/* === TOPO FIXO — visao imediata, sempre visivel === */}
      {/* Health Score Hero — donut + drivers + frase narrativa parametrizada.
          Substitui ranking arbitrario "78/100" com formula 0.35*margem + 0.35*runway
          + 0.20*crescimento + 0.10*ticket (HEALTH_TARGETS/HEALTH_WEIGHTS). */}
      <HealthScoreHero insights={insights} />

      {/* Biggest Lever — destaca acao com maior impacto no caixa.
          Em consolidated mostra legenda "Soma de todas as empresas" + dica de abrir
          empresa especifica. CTA continua valido (leva pra Lancamentos consolidado). */}
      <BiggestLever insights={insights} onCta={onGoToLancamentos} consolidated={consolidatedView} />

      {/* SmartBalance + RunwayCard lado a lado em wide, stack em mobile. */}
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

      <SparklineBar transactions={transactions} />

      {/* === SECOES RECOLHIVEIS — UI mais limpa, expandir on demand === */}
      <CollapsibleSection
        id="pendencias"
        title="Pendências"
        subtitle={pendingCount + " lancamento" + (pendingCount === 1 ? "" : "s") + " pendente" + (pendingCount === 1 ? "" : "s")}
        defaultExpanded
      >
        <PendingCards transactions={transactions} />
      </CollapsibleSection>

      <CollapsibleSection
        id="receitas-detalhe"
        title="Receitas — análise detalhada"
        subtitle={incomeCount + " lancamento" + (incomeCount === 1 ? "" : "s") + " · categorias, top 5, tendência diária"}
        defaultExpanded
      >
        <IncomeDetail transactions={transactions} previousIncome={previousSummary ? previousSummary.income : null} />
      </CollapsibleSection>

      <CollapsibleSection
        id="despesas-detalhe"
        title="Despesas — análise detalhada"
        subtitle={expenseCount + " lancamento" + (expenseCount === 1 ? "" : "s") + " · categorias, top 5, formas de pagamento"}
        defaultExpanded
      >
        <ExpenseDetail transactions={transactions} previousExpenses={previousSummary ? previousSummary.expenses : null} />
      </CollapsibleSection>

      <CollapsibleSection
        id="fluxo-caixa"
        title="Fluxo de caixa"
        subtitle="Histórico 30d + projeção 30/60/90 com banda de confiança"
      >
        <View style={[s.cashflowCard, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <CashflowChart data={insights.cashflow} consolidated={consolidatedView} />
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        id="analise-rapida"
        title="Análise rápida"
        subtitle="Insights automaticos sobre o periodo"
      >
        <QuickInsights transactions={transactions} income={summary.income} expenses={summary.expenses} />
      </CollapsibleSection>

      <CollapsibleSection
        id="conciliacao"
        title="Conciliação bancária"
        subtitle="Confronte extrato vs lançamentos"
      >
        <ReconciliationSection />
      </CollapsibleSection>

      {transactions.length > 0 && (
        <CollapsibleSection
          id="ultimos-lancamentos"
          title="Últimos lançamentos"
          subtitle={"Mostrando " + Math.min(8, transactions.length) + " de " + transactions.length}
          defaultExpanded
          rightAccessory={
            <Pressable onPress={onGoToLancamentos} hitSlop={8}>
              <Text style={s.seeAll}>Ver todos</Text>
            </Pressable>
          }
        >
          <View style={s.listCard}>
            {transactions.slice(0, 8).map(function(t) {
              return <TransactionRow key={t.id} item={t} onDelete={!isDemo ? onDelete : undefined} onEdit={!isDemo ? onEdit : undefined} />;
            })}
          </View>
        </CollapsibleSection>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  heroGrid: { flexDirection: "row", gap: 14, marginBottom: 0 },
  seeAll: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border },
  cashflowCard: { borderRadius: 16, padding: 18, borderWidth: 1 },
});
