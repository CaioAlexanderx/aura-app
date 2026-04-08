import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { usePayroll } from "@/hooks/usePayroll";
import { ListSkeleton } from "@/components/ListSkeleton";
import { EmployeeCard } from "@/components/screens/folha/EmployeeCard";
import { Payslip } from "@/components/screens/folha/Payslip";
import { PayrollSummary } from "@/components/screens/folha/PayrollSummary";
import { PayrollHistory } from "@/components/screens/folha/PayrollHistory";
import { SalesRanking } from "@/components/screens/folha/SalesRanking";
import { TABS, fmt, FGTS_RATE } from "@/components/screens/folha/types";
import type { Employee } from "@/components/screens/folha/types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

export default function FolhaScreen() {
  const [tab, setTab] = useState(0);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const scrollRef = useRef<any>(null);

  const { employees, active, totalBruto, totalFgts, totals, isLoading, isDemo } = usePayroll();

  if (selectedEmp) {
    return (
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        <Payslip emp={selectedEmp} onBack={() => setSelectedEmp(null)} />
        {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Folha de Pagamento</Text>

      {/* KPIs */}
      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.kpiValue}>{active.length}</Text><Text style={s.kpiLabel}>Ativos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiValue, { color: Colors.green }]}>{fmt(totalBruto)}</Text><Text style={s.kpiLabel}>Folha bruta</Text></View>
        <View style={s.kpi}><Text style={[s.kpiValue, { color: Colors.amber }]}>{fmt(totalFgts)}</Text><Text style={s.kpiLabel}>FGTS</Text></View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {TABS.map((t, i) => <Pressable key={t} onPress={() => { setTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }} style={[s.tab, tab === i && s.tabActive]}><Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text></Pressable>)}
      </ScrollView>

      {isLoading && <ListSkeleton rows={3} showCards />}

      {tab === 0 && <View>{employees.map(e => <EmployeeCard key={e.id} emp={e} onCalc={() => { setSelectedEmp(e); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }} />)}</View>}
      {tab === 1 && <PayrollSummary employees={employees} totals={totals} totalBruto={totalBruto} />}
      {tab === 2 && <PayrollHistory />}
      {tab === 3 && <SalesRanking />}

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  kpi: { flex: 1, minWidth: IS_WIDE ? 120 : "30%", backgroundColor: Colors.bg3, borderRadius: 14, padding: IS_WIDE ? 16 : 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kpiValue: { fontSize: IS_WIDE ? 18 : 14, fontWeight: "700", color: Colors.ink },
  kpiLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
