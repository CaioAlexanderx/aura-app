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

type Props = { transactions: Transaction[]; dreApi: any; period?: PeriodKey };

// F-13: Accordion section
function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  var [open, setOpen] = useState(!!defaultOpen);
  return (
    <View style={a.section}>
      <Pressable onPress={function() { setOpen(!open); }} style={[a.sectionHeader, isWeb && { cursor: "pointer" } as any]}>
        <Text style={a.sectionTitle}>{title}</Text>
        <View style={[a.chevron, open && a.chevronOpen]}>
          <Icon name="chevron_down" size={14} color={Colors.ink3} />
        </View>
      </Pressable>
      {open && <View style={a.sectionBody}>{children}</View>}
    </View>
  );
}

export function TabResumo({ transactions, dreApi, period }: Props) {
  var { data, isLoading } = useFinancialAnalysis(undefined, period);

  if (isLoading) return <ListSkeleton rows={4} showCards />;
  if (!data || (data.monthly.length === 0 && transactions.length === 0)) {
    return <EmptyState icon="receipt" iconColor={PAL.violet3} title="Analise financeira" subtitle="Registre receitas e despesas para ativar a analise completa." />;
  }

  var d = data;
  return (
    <View>
      {/* Hero + comparativo + insights: sempre visivel */}
      <VelocityHero velocity={d.velocity} current={d.current} previous={d.previous} period={period} />
      <CompCards current={d.current} previous={d.previous} />
      <InsightsBlock insights={d.insights} velocity={d.velocity} current={d.current} employees={d.employees} />

      {/* Secoes em accordion */}
      <Section title="Evolucao mensal" defaultOpen>
        <MonthlyChart data={d.monthly} />
        <RevenueTrendLine monthly={d.monthly} />
      </Section>

      <Section title="Vendas por dia da semana">
        <DayOfWeekChart data={d.dayOfWeek} insights={d.insights} />
      </Section>

      {d.employees && d.employees.length > 0 && (
        <Section title="Desempenho por vendedor">
          <EmployeeRanking employees={d.employees} />
          <EmployeeDonut employees={d.employees} />
          <EmployeeMonthlyChart data={d.employeeMonthly} employees={d.employees.map(function(e: any) { return e.name; })} />
        </Section>
      )}

      <Section title="Distribuicao de tickets">
        <TicketDistribution data={d.ticketDistribution} />
      </Section>

      <Section title="Tendencia semanal">
        <WeeklyTrend data={d.weeklyTrend} />
      </Section>

      {d.topCustomers && d.topCustomers.length > 0 && (
        <Section title="Melhores clientes">
          <TopCustomers data={d.topCustomers} />
        </Section>
      )}

      <View style={cs.disclaimer}><Text style={cs.disclaimerText}>Estimativas para apoio a decisao - nao substitui contabilidade oficial.</Text></View>
    </View>
  );
}

var a = StyleSheet.create({
  section: { marginBottom: 12, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 18 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  chevron: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  sectionBody: { paddingHorizontal: 12, paddingBottom: 16 },
});

export default TabResumo;
