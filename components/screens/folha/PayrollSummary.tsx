import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import type { Employee, PayrollCalc } from "./types";
import { fmt, calcPayroll, FGTS_RATE } from "./types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

type Props = { employees: Employee[]; totals: { inss: number; irrf: number; fgts: number; liquid: number }; totalBruto: number };

export function PayrollSummary({ employees, totals, totalBruto }: Props) {
  const active = employees.filter(e => e.status === "active");
  return (
    <View>
      <View style={s.card}>
        <Text style={s.title}>Resumo da folha - {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
        <View style={s.grid}>
          <View style={s.item}><Text style={s.label}>Funcionarios ativos</Text><Text style={s.value}>{active.length}</Text></View>
          <View style={s.item}><Text style={s.label}>Total bruto</Text><Text style={s.value}>{fmt(totalBruto)}</Text></View>
          <View style={s.item}><Text style={s.label}>INSS total</Text><Text style={[s.value, { color: Colors.red }]}>-{fmt(totals.inss)}</Text></View>
          <View style={s.item}><Text style={s.label}>IRRF total</Text><Text style={[s.value, { color: totals.irrf > 0 ? Colors.red : Colors.ink3 }]}>{totals.irrf > 0 ? "-"+fmt(totals.irrf) : "Isento"}</Text></View>
          <View style={s.item}><Text style={s.label}>Total liquido</Text><Text style={[s.value, { color: Colors.green, fontSize: 18 }]}>{fmt(totals.liquid)}</Text></View>
          <View style={s.item}><Text style={s.label}>FGTS a depositar</Text><Text style={s.value}>{fmt(totals.fgts)}</Text></View>
        </View>
        <View style={s.costRow}><Text style={s.costLabel}>Custo total para a empresa</Text><Text style={s.costValue}>{fmt(totalBruto + totals.fgts)}</Text></View>
      </View>

      <Text style={s.detailTitle}>Detalhamento por funcionario</Text>
      {active.map(e => {
        const p = calcPayroll(e);
        return (
          <View key={e.id} style={s.empRow}>
            <View style={s.empInfo}><Text style={s.empName}>{e.name}</Text><Text style={s.empRole}>{e.role}</Text></View>
            <View style={s.empNums}><Text style={s.empBruto}>Bruto: {fmt(e.salary)}</Text><Text style={s.empLiquid}>Liquido: {fmt(p.liquid)}</Text></View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  title: { fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  item: { width: IS_WIDE ? "30%" : "46%", backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, gap: 4 },
  label: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  costRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border2 },
  costLabel: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  costValue: { fontSize: 18, color: Colors.violet3, fontWeight: "700" },
  detailTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 12 },
  empRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  empInfo: { gap: 2 },
  empName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  empRole: { fontSize: 11, color: Colors.ink3 },
  empNums: { alignItems: "flex-end", gap: 2 },
  empBruto: { fontSize: 12, color: Colors.ink3 },
  empLiquid: { fontSize: 13, color: Colors.green, fontWeight: "600" },
});

export default PayrollSummary;
