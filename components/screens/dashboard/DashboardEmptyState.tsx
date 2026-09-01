// ============================================================
// AURA. — DashboardEmptyState (01/09/2026)
//
// Bifurcação do estado vazio do Painel. Antes existia um estado só, e o
// critério dele era "mês atual sem movimento" — mas o texto era de
// onboarding de conta nova. Resultado: todo dia 1º, toda lojista com
// histórico lia "Bem-vindo! Seu painel vai ganhar vida..." e achava que
// os dados tinham sumido (QA 01/09, conta com R$ 15.364,83 acumulados e
// 602 clientes; GET /companies/:id/dashboard devolvia revenue: 0 porque
// setembro tinha acabado de começar).
//
// Agora:
//   conta nova  -> EmptyDashboard (o onboarding de sempre, que está bom)
//   mês novo    -> NewMonthCard (fechamento do mês anterior + CTA do dia)
//
// DE ONDE VEM O NÚMERO DO MÊS ANTERIOR. O /dashboard não devolve
// histórico — só o mês corrente, os deltas e as sparklines. O fechamento
// de agosto vem de /financeiro/comparative via useFinancialComparative,
// o mesmo hook/endpoint que a Visão geral do Financeiro já usa: não é
// chamada inventada e o hook já ramifica sozinho entre per-company e
// /me/* (multi-CNPJ) conforme consolidatedView.
//
// A consulta só é montada quando o Painel está vazio — este componente
// não renderiza em nenhum outro caminho, então o Painel normal continua
// com o mesmo número de requisições de antes.
// ============================================================
import { useFinancialComparative } from "@/hooks/useFinancialComparative";
import { EmptyDashboard } from "./EmptyDashboard";
import { NewMonthCard } from "./NewMonthCard";
import {
  brToday, previousMonthOf, monthNameBR,
  classifyEmptyDashboard, hasMovementInSpark,
} from "./types";

type Props = {
  /** Primeiro nome, pro onboarding de conta nova. */
  name: string;
  /** Payload do dashboard (usamos só as sparklines como sinal barato). */
  data: any;
  onPress: (path: string) => void;
};

/** A partir de que dia do mês o texto deixa de ser "mês começando". */
const EARLY_MONTH_DAYS = 5;

export function DashboardEmptyState({ name, data, onPress }: Props) {
  // Fuso do Brasil: em UTC a virada acontece às 21h do dia anterior.
  const today = brToday();
  const prev = previousMonthOf(today);

  const q = useFinancialComparative({ period: "month", compareWith: "previous_period" });
  const prevTotals = q.data && q.data.previous ? q.data.previous.totals : null;

  const kind = classifyEmptyDashboard({
    hasSpark: hasMovementInSpark(data?.sparkRevenue, data?.sparkExpenses, data?.sparkNet),
    previousTotals: prevTotals,
    loadingHistory: q.isLoading,
  });

  // Enquanto o histórico não chega, não mostramos nada: piscar o texto
  // errado (seja o onboarding, seja o card de mês novo) é justamente o
  // problema que este componente existe pra resolver.
  if (kind === "carregando") return null;

  if (kind === "conta-nova") return <EmptyDashboard name={name} onPress={onPress} />;

  return (
    <NewMonthCard
      monthLabel={monthNameBR(today.month)}
      prevMonthLabel={monthNameBR(prev.month, false)}
      prevTotals={prevTotals}
      early={today.day <= EARLY_MONTH_DAYS}
      onPress={onPress}
    />
  );
}

export default DashboardEmptyState;
