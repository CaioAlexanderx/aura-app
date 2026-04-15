import { View, Text } from "react-native";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import type { Transaction, PeriodKey } from "./types";

import { PAL, cs } from "./analysis/shared";
import { VelocityHero } from "./analysis/VelocityHero";
import { CompCards } from "./analysis/CompCards";
import { MonthlyChart } from "./analysis/MonthlyChart";
import { DayOfWeekChart } from "./analysis/DayOfWeekChart";
import { EmployeeRanking } from "./analysis/EmployeeRanking";
import { TicketDistribution } from "./analysis/TicketDistribution";
import { WeeklyTrend } from "./analysis/WeeklyTrend";
import { TopCustomers } from "./analysis/TopCustomers";
import { InsightsBlock } from "./analysis/InsightsBlock";

type Props = { transactions: Transaction[]; dreApi: any; period?: PeriodKey };

export function TabResumo({ transactions, dreApi, period }: Props) {
  var { data, isLoading } = useFinancialAnalysis(undefined, period);

  if (isLoading) return <ListSkeleton rows={4} showCards />;
  if (!data || (data.monthly.length === 0 && transactions.length === 0)) {
    return <EmptyState icon="receipt" iconColor={PAL.violet3} title="Analise financeira" subtitle="Registre receitas e despesas para ativar a analise completa." />;
  }

  var d = data;
  return <View>
    <VelocityHero velocity={d.velocity} current={d.current} previous={d.previous} />
    <CompCards current={d.current} previous={d.previous} />
    <MonthlyChart data={d.monthly} />
    <DayOfWeekChart data={d.dayOfWeek} insights={d.insights} />
    <EmployeeRanking employees={d.employees} />
    <TicketDistribution data={d.ticketDistribution} />
    <WeeklyTrend data={d.weeklyTrend} />
    <TopCustomers data={d.topCustomers} />
    <InsightsBlock insights={d.insights} velocity={d.velocity} current={d.current} employees={d.employees} />
    <View style={cs.disclaimer}><Text style={cs.disclaimerText}>Estimativas para apoio a decisao - nao substitui contabilidade oficial.</Text></View>
  </View>;
}

export default TabResumo;
