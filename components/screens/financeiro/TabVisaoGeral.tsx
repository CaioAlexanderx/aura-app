import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { TransactionRow } from "./TransactionRow";
import { CollapsibleSection } from "./CollapsibleSection";
import type { Transaction, PeriodKey } from "./types";
// F3 (24/08/2026): hero unificado + lista de acoes, no lugar do quarteto
// HealthScoreHero / BiggestLever / SmartBalance / RunwayCard.
import { ResumoHero } from "./v2/ResumoHero";
import { AcoesCard } from "./v2/AcoesCard";
import { RunwayCard } from "./v2";
// Onda 3: cashflow chart enriquecido (history + projection com banda confianca)
import { CashflowChart } from "./v2/Onda3Cards";
// Fase A (19/05/2026): comparativos visuais (mes-vs-anterior, YoY, custom).
import { ComparativeSection } from "./v2/ComparativeSection";
import type { ComparativePeriod } from "@/hooks/useFinancialComparative";
import { useFinancialInsights } from "@/hooks/useFinancialInsights";
// Multi-CNPJ: precisa saber se esta em modo consolidado pra ajustar comportamento
// dos cards v2 (legendas, hints "abra a empresa especifica", etc).
import { useAuthStore } from "@/stores/auth";

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
  isError?: boolean;
  onRetry?: () => void;
  onNewTransaction: () => void;
  onImport?: () => void;
  onGoToLancamentos: () => void;
  onGoToDespesas?: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
};

// PeriodKey tem mais opcoes que ComparativePeriod do hook. Mapeia os comparaveis.
// "all" e "prev_year" nao tem comparativo natural — escondemos a secao.
function periodToComparative(p: PeriodKey): ComparativePeriod | null {
  switch (p) {
    case "today":
    case "week":
    case "month":
    case "year":
    case "custom":
      return p;
    default:
      return null; // all, prev_year
  }
}

export function TabVisaoGeral({ transactions, summary, previousSummary, period, customStart, customEnd, isLoading, isDemo, isError, onRetry, onNewTransaction, onImport, onGoToLancamentos, onGoToDespesas, onDelete, onEdit }: Props) {
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

  // O estado de erro vive na tela (app/(tabs)/financeiro.tsx), nao aqui: a
  // query e a mesma pras quatro abas, entao duplicar o tratamento por aba foi
  // justamente o que deixou 3 delas de fora no F0. Este guard so evita que o
  // empty state de onboarding apareca caso o componente seja montado com erro
  // por outro caminho.
  if (isError && !isLoading && !isDemo) return null;

  if (transactions.length === 0 && !isLoading && !isDemo) {
    return <EmptyState icon="dollar" iconColor={Colors.green} title="Seu termômetro financeiro" subtitle="Lance sua primeira receita ou despesa para ativar o painel inteligente." actionLabel="Novo lançamento" onAction={onNewTransaction} secondaryLabel="Importar de planilha" onSecondary={onImport} />;
  }

  // Fase A: comparativo so renderiza quando o periodo eh comparavel.
  var compPeriod = periodToComparative(period);

  return (
    <View>
      {/* === PRIMEIRA DOBRA — responde em 5 segundos ===
          F3 (24/08/2026): antes esta dobra tinha HealthScoreHero (donut de score
          + 4 drivers com meta/gap/barra cada), BiggestLever, SmartBalance e
          RunwayCard — ~28 numeros e 4 sistemas de "saude" concorrentes, com a
          resposta simples (entrou/saiu/sobrou) enterrada no 3o card.

          Agora sao dois: o resumo com a frase de status, e a lista do que
          precisa de acao. O score continua no hook alimentando a frase e a cor
          da barra; runway e fluxo de caixa viraram um colapsado so, abaixo. */}
      <ResumoHero
        transactions={transactions}
        summary={summary}
        previousSummary={previousSummary}
        insights={insights}
        period={period}
        consolidated={consolidatedView}
      />

      <AcoesCard
        transactions={transactions}
        insights={insights}
        consolidated={consolidatedView}
        onGoToLancamentos={onGoToLancamentos}
        onGoToDespesas={onGoToDespesas}
      />

      {/* === SECOES RECOLHIVEIS — UI mais limpa, expandir on demand ===
          REDESIGN 19/05/2026: removidas as secoes "Receitas - analise detalhada" e
          "Despesas - analise detalhada" daqui. Elas duplicavam quase 1:1 o conteudo
          das abas Receitas/Despesas. Quem quer detalhe clica na aba dedicada.

          F3: "Fluxo de caixa" e o RunwayCard viraram uma secao so — os dois
          respondiam a mesma pergunta ("meu caixa aguenta ate quando?") com
          vocabulario diferente. O subtitulo agora entrega a resposta sem abrir. */}
      <CollapsibleSection
        id="folego-caixa"
        title="Seu caixa daqui pra frente"
        subtitle={
          insights.runway.days >= 999
            ? "Sem despesas no período pra projetar"
            : "No ritmo atual, seu dinheiro dura cerca de " + insights.runway.days + " dias"
        }
      >
        <View style={[s.cashflowCard, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <RunwayCard insights={insights} />
          <CashflowChart data={insights.cashflow} consolidated={consolidatedView} />
        </View>
      </CollapsibleSection>

      {/* Fase A (19/05/2026): comparativo entre o periodo atual e um modo
          comparativo (anterior, YoY, custom). Renderiza apenas quando period
          tem comparativo natural — "all" e "prev_year" escondem a secao. */}
      {compPeriod != null && (
        <CollapsibleSection
          id="comparativo"
          title="Comparar com outro período"
          subtitle="Veja como este período se compara ao anterior ou ao ano passado"
        >
          <ComparativeSection period={compPeriod} customStart={customStart} customEnd={customEnd} />
        </CollapsibleSection>
      )}

      {/* F2 (24/08/2026) — saíram daqui:
          · "Análise rápida" (QuickInsights): repetia em prosa o que o hero e o
            SmartBalance já mostram em número (margem, top categoria, volume).
          · "Conciliação bancária": migrou pra aba Lançamentos, que é o contexto
            natural de conferir extrato contra lançamento.
          · SparklineBar: os últimos 7 dias já aparecem na "Tendência diária" das
            abas Receitas e Despesas e no histórico do fluxo de caixa. */}

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

      {/* F6 (24/08/2026): a Retirada deixou de ser aba e passa a ser alcançada
          por aqui. Sem este card ela ficaria sem NENHUMA porta de entrada na
          interface — só pra quem tivesse o link antigo salvo. Em consolidado
          fica de fora: o cálculo usa o regime tributário de UMA empresa. */}
      {!consolidatedView && !isDemo && (
        <Pressable
          onPress={function() { router.push("/financeiro/retirada" as any); }}
          accessibilityRole="button"
          accessibilityLabel="Simular quanto posso retirar este mês"
          style={({ hovered }: any) => [
            s.toolCard,
            { backgroundColor: Colors.bg3, borderColor: Colors.border2 },
            isWeb && hovered ? { borderColor: Colors.violet3 } : null,
            isWeb ? ({ transition: "all 0.18s ease", cursor: "pointer" } as any) : null,
          ]}
        >
          <View style={s.toolIcon}>
            <Icon name="calculator" size={16} color={Colors.violet3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.toolTitle}>Quanto posso retirar este mês?</Text>
            <Text style={s.toolSub}>Simulação com seu regime tributário e o que precisa ficar em caixa</Text>
          </View>
          <Icon name="chevron_right" size={14} color={Colors.violet3} />
        </Pressable>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  seeAll: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border },
  cashflowCard: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 14 },
  // Card-link da ferramenta de retirada (F6)
  toolCard: {
    flexDirection: "row", alignItems: "center", gap: 13,
    borderRadius: 16, borderWidth: 1, borderStyle: "dashed",
    paddingHorizontal: 18, paddingVertical: 16, marginTop: 4,
  },
  toolIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD,
    alignItems: "center", justifyContent: "center",
  },
  toolTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  toolSub: { fontSize: 11.5, marginTop: 2, lineHeight: 16, color: Colors.ink3 },
});
