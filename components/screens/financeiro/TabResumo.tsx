import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
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
import { RevenueTrendLine, EmployeeDonut, EmployeeMonthlyChart } from "./FinancialCharts";

var isWeb = Platform.OS === "web";

// F-13: Accordion section — renders children only when expanded
function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  var [open, setOpen] = useState(!!defaultOpen);
  return (
    <View style={sec.container}>
      <Pressable onPress={function() { setOpen(!open); }} style={[sec.header, isWeb && { cursor: "pointer" } as any]}>
        <Text style={sec.title}>{title}</Text>
        <View style={[sec.arrow, open && { transform: [{ rotate: "180deg" }] }]}>
          <Icon name="chevron_down" size={14} color={Colors.ink3} />
        </View>
      </Pressable>
      {open && <View style={sec.body}>{children}</View>}
    </View>
  );
}

var sec = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  arrow: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 12, paddingBottom: 16 },
});

type Props = { transactions: Transaction[]; dreApi: any; period?: PeriodKey };

export function TabResumo({ transactions, dreApi, period }: Props) {
  var { data, isLoading } = useFinancialAnalysis(undefined, period);

  if (isLoading) return <ListSkeleton rows={4} showCards />;
  if (!data || (data.monthly.length === 0 && transactions.length === 0)) {
    return <EmptyState icon="receipt" iconColor={PAL.violet3} title="Analise financeira" subtitle="Registre receitas e despesas para ativar a analise completa." />;
  }

  var d = data;
  return <View>
    {/* Sempre visivel */}
    <VelocityHero velocity={d.velocity} current={d.current} previous={d.previous} period={period} />
    <CompCards current={d.current} previous={d.previous} />

    <Section title="Insights inteligentes" defaultOpen>
      <InsightsBlock insights={d.insights} velocity={d.velocity} current={d.current} employees={d.employees} />
    </Section>

    <Section title="Evolucao mensal" defaultOpen>
      <MonthlyChart data={d.monthly} />
      <RevenueTrendLine monthly={d.monthly} />
    </Section>

    <Section title="Vendas por dia da semana">
      <DayOfWeekChart data={d.dayOfWeek} insights={d.insights} />
    </Section>

    <Section title="Ranking de vendedores">
      <EmployeeRanking employees={d.employees} />
      <EmployeeDonut employees={d.employees} />
      <EmployeeMonthlyChart data={d.employeeMonthly} employees={d.employees.map((e: any) => e.name)} />
    </Section>

    <Section title="Distribuicao de ticket">
      <TicketDistribution data={d.ticketDistribution} />
    </Section>

    <Section title="Tendencia semanal">
      <WeeklyTrend data={d.weeklyTrend} />
    </Section>

    <Section title="Top clientes">
      <TopCustomers data={d.topCustomers} />
    </Section>

    <View style={cs.disclaimer}><Text style={cs.disclaimerText}>Estimativas para apoio a decisao - nao substitui contabilidade oficial.</Text></View>
  </View>;
}

export default TabResumo;
