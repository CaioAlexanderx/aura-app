import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { DemoBanner } from "@/components/DemoBanner";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";

const TABS = ["Funcionarios", "Calcular folha", "Historico"];

type Employee = { id: string; name: string; role: string; salary: number; admDate: string; status: "active" | "vacation" | "dismissed" };

const EMPLOYEES: Employee[] = [
  { id: "1", name: "Ana Costa", role: "Atendente", salary: 1800, admDate: "15/03/2025", status: "active" },
  { id: "2", name: "Carlos Silva", role: "Barbeiro", salary: 2200, admDate: "01/06/2024", status: "active" },
  { id: "3", name: "Julia Santos", role: "Recepcionista", salary: 1600, admDate: "10/09/2025", status: "active" },
];

const INSS_FAIXAS = [
  { ate: 1412.00, aliq: 0.075 },
  { ate: 2666.68, aliq: 0.09 },
  { ate: 4000.03, aliq: 0.12 },
  { ate: 7786.02, aliq: 0.14 },
];

function calcINSS(sal: number): number {
  let inss = 0, prev = 0;
  for (const f of INSS_FAIXAS) {
    const base = Math.min(sal, f.ate) - prev;
    if (base <= 0) break;
    inss += base * f.aliq;
    prev = f.ate;
  }
  return inss;
}

function calcIRRF(sal: number, inss: number): number {
  const base = sal - inss;
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return base * 0.075 - 169.44;
  if (base <= 3751.05) return base * 0.15 - 381.44;
  if (base <= 4664.68) return base * 0.225 - 662.77;
  return base * 0.275 - 896.00;
}

const FGTS_RATE = 0.08;

function calcPayroll(emp: Employee) {
  const inss = calcINSS(emp.salary);
  const irrf = Math.max(0, calcIRRF(emp.salary, inss));
  const fgts = emp.salary * FGTS_RATE;
  const liquid = emp.salary - inss - irrf;
  return { inss, irrf, fgts, liquid };
}

const HISTORY = [
  { id: "h1", month: "Fevereiro/2026", total: 5600, liquid: 4612.40, paidAt: "05/03/2026", employees: 3 },
  { id: "h2", month: "Janeiro/2026", total: 5600, liquid: 4612.40, paidAt: "05/02/2026", employees: 3 },
  { id: "h3", month: "Dezembro/2025", total: 5600, liquid: 4612.40, paidAt: "05/01/2026", employees: 3 },
];

const statusMap = { active: { label: "Ativo", color: Colors.green }, vacation: { label: "Ferias", color: Colors.amber }, dismissed: { label: "Desligado", color: Colors.red } };

// ── Employee Card ────────────────────────────────────────────

function EmpCard({ emp, onCalc }: { emp: Employee; onCalc: () => void }) {
  const st = statusMap[emp.status];
  return (
    <HoverCard style={ec.card}>
      <View style={ec.top}>
        <View style={ec.avatar}><Text style={ec.avatarText}>{emp.name.charAt(0)}</Text></View>
        <View style={ec.info}>
          <Text style={ec.name}>{emp.name}</Text>
          <Text style={ec.role}>{emp.role}</Text>
        </View>
        <View style={[ec.statusBadge, { backgroundColor: st.color + "18" }]}><Text style={[ec.statusText, { color: st.color }]}>{st.label}</Text></View>
      </View>
      <View style={ec.details}>
        <View style={ec.detail}><Text style={ec.detailLabel}>Salario bruto</Text><Text style={ec.detailValue}>{fmt(emp.salary)}</Text></View>
        <View style={ec.detail}><Text style={ec.detailLabel}>Admissao</Text><Text style={ec.detailValue}>{emp.admDate}</Text></View>
      </View>
      <View style={ec.actions}>
        <Pressable onPress={onCalc} style={ec.calcBtn}><Icon name="receipt" size={14} color={Colors.violet3}/><Text style={ec.calcText}>Ver holerite</Text></Pressable>
      </View>
    </HoverCard>
  );
}
const ec = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  role: { fontSize: 12, color: Colors.ink3 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: "600" },
  details: { flexDirection: "row", gap: 20, marginBottom: 12 },
  detail: { gap: 2 },
  detailLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  actions: { paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  calcBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "flex-start", borderWidth: 1, borderColor: Colors.border2 },
  calcText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});

// ── Payslip View ─────────────────────────────────────────────

function Payslip({ emp, onBack }: { emp: Employee; onBack: () => void }) {
  const p = calcPayroll(emp);
  const costTotal = emp.salary + p.fgts;
  return (
    <View>
      <Pressable onPress={onBack} style={{ marginBottom: 16 }}><Text style={{ fontSize: 13, color: Colors.violet3, fontWeight: "600" }}>Voltar</Text></Pressable>
      <View style={ps.card}>
        <View style={ps.header}>
          <Text style={ps.title}>Holerite - {emp.name}</Text>
          <Text style={ps.sub}>{emp.role} / Competencia: Marco/2026</Text>
        </View>
        <View style={ps.section}>
          <Text style={ps.secTitle}>Proventos</Text>
          <View style={ps.row}><Text style={ps.rowLabel}>Salario base</Text><Text style={ps.rowValue}>{fmt(emp.salary)}</Text></View>
        </View>
        <View style={ps.section}>
          <Text style={ps.secTitle}>Descontos</Text>
          <View style={ps.row}><Text style={ps.rowLabel}>INSS ({(calcINSS(emp.salary)/emp.salary*100).toFixed(1)}%)</Text><Text style={[ps.rowValue, { color: Colors.red }]}>-{fmt(p.inss)}</Text></View>
          <View style={ps.row}><Text style={ps.rowLabel}>IRRF</Text><Text style={[ps.rowValue, { color: p.irrf > 0 ? Colors.red : Colors.ink3 }]}>{p.irrf > 0 ? "-" + fmt(p.irrf) : "Isento"}</Text></View>
        </View>
        <View style={ps.divider} />
        <View style={ps.row}><Text style={[ps.rowLabel, { fontWeight: "700", color: Colors.ink }]}>Salario liquido</Text><Text style={[ps.rowValue, { fontSize: 18, color: Colors.green }]}>{fmt(p.liquid)}</Text></View>
        <View style={ps.divider} />
        <View style={ps.section}>
          <Text style={ps.secTitle}>Encargos do empregador</Text>
          <View style={ps.row}><Text style={ps.rowLabel}>FGTS (8%)</Text><Text style={ps.rowValue}>{fmt(p.fgts)}</Text></View>
          <View style={[ps.row, { marginTop: 8 }]}><Text style={[ps.rowLabel, { fontWeight: "700", color: Colors.ink }]}>Custo total</Text><Text style={[ps.rowValue, { fontWeight: "700" }]}>{fmt(costTotal)}</Text></View>
        </View>
        <View style={ps.disclaimer}><Icon name="alert" size={14} color={Colors.amber}/><Text style={ps.disclaimerText}>Valores estimados para apoio contabil. Consulte a legislacao vigente.</Text></View>
      </View>
    </View>
  );
}
const ps = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2 },
  header: { marginBottom: 20 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  section: { marginBottom: 16 },
  secTitle: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: Colors.ink3 },
  rowValue: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  disclaimer: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginTop: 16 },
  disclaimerText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
});

// ── Calculate Tab ────────────────────────────────────────────

function CalcTab() {
  const totalBruto = EMPLOYEES.filter(e => e.status === "active").reduce((s, e) => s + e.salary, 0);
  const totals = EMPLOYEES.filter(e => e.status === "active").reduce((acc, e) => {
    const p = calcPayroll(e);
    return { inss: acc.inss + p.inss, irrf: acc.irrf + p.irrf, fgts: acc.fgts + p.fgts, liquid: acc.liquid + p.liquid };
  }, { inss: 0, irrf: 0, fgts: 0, liquid: 0 });

  return (
    <View>
      <HoverCard style={ct.summaryCard}>
        <Text style={ct.summaryTitle}>Resumo da folha - Marco/2026</Text>
        <View style={ct.summaryGrid}>
          <View style={ct.summaryItem}><Text style={ct.summaryLabel}>Funcionarios ativos</Text><Text style={ct.summaryValue}>{EMPLOYEES.filter(e => e.status === "active").length}</Text></View>
          <View style={ct.summaryItem}><Text style={ct.summaryLabel}>Total bruto</Text><Text style={ct.summaryValue}>{fmt(totalBruto)}</Text></View>
          <View style={ct.summaryItem}><Text style={ct.summaryLabel}>INSS total</Text><Text style={[ct.summaryValue, { color: Colors.red }]}>-{fmt(totals.inss)}</Text></View>
          <View style={ct.summaryItem}><Text style={ct.summaryLabel}>IRRF total</Text><Text style={[ct.summaryValue, { color: totals.irrf > 0 ? Colors.red : Colors.ink3 }]}>{totals.irrf > 0 ? "-" + fmt(totals.irrf) : "Isento"}</Text></View>
          <View style={ct.summaryItem}><Text style={ct.summaryLabel}>Total liquido</Text><Text style={[ct.summaryValue, { color: Colors.green, fontSize: 18 }]}>{fmt(totals.liquid)}</Text></View>
          <View style={ct.summaryItem}><Text style={ct.summaryLabel}>FGTS a depositar</Text><Text style={ct.summaryValue}>{fmt(totals.fgts)}</Text></View>
        </View>
        <View style={ct.costRow}>
          <Text style={ct.costLabel}>Custo total para a empresa</Text>
          <Text style={ct.costValue}>{fmt(totalBruto + totals.fgts)}</Text>
        </View>
      </HoverCard>

      <Text style={ct.breakdownTitle}>Detalhamento por funcionario</Text>
      {EMPLOYEES.filter(e => e.status === "active").map(emp => {
        const p = calcPayroll(emp);
        return (
          <HoverRow key={emp.id} style={ct.empRow}>
            <View style={ct.empInfo}>
              <Text style={ct.empName}>{emp.name}</Text>
              <Text style={ct.empRole}>{emp.role}</Text>
            </View>
            <View style={ct.empNums}>
              <Text style={ct.empBruto}>Bruto: {fmt(emp.salary)}</Text>
              <Text style={ct.empLiquid}>Liquido: {fmt(p.liquid)}</Text>
            </View>
          </HoverRow>
        );
      })}
    </View>
  );
}
const ct = StyleSheet.create({
  summaryCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  summaryTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 16 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  summaryItem: { width: IS_WIDE ? "30%" : "46%", backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, gap: 4 },
  summaryLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  costRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.violetD, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border2 },
  costLabel: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  costValue: { fontSize: 18, color: Colors.violet3, fontWeight: "700" },
  breakdownTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 12 },
  empRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  empInfo: { gap: 2 },
  empName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  empRole: { fontSize: 11, color: Colors.ink3 },
  empNums: { alignItems: "flex-end", gap: 2 },
  empBruto: { fontSize: 12, color: Colors.ink3 },
  empLiquid: { fontSize: 13, color: Colors.green, fontWeight: "600" },
});

// ── History Tab ──────────────────────────────────────────────

function HistTab() {
  return (
    <View>
      {HISTORY.map(h => (
        <HoverRow key={h.id} style={hs.row}>
          <View style={hs.left}>
            <View style={hs.check}><Icon name="check" size={12} color={Colors.green}/></View>
            <View style={hs.info}><Text style={hs.month}>{h.month}</Text><Text style={hs.meta}>{h.employees} funcionarios - pago em {h.paidAt}</Text></View>
          </View>
          <View style={hs.right}>
            <Text style={hs.total}>{fmt(h.total)}</Text>
            <Text style={hs.liquid}>Liquido: {fmt(h.liquid)}</Text>
          </View>
        </HoverRow>
      ))}
    </View>
  );
}
const hs = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  check: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  info: { gap: 2 },
  month: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  meta: { fontSize: 11, color: Colors.ink3 },
  right: { alignItems: "flex-end", gap: 2 },
  total: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  liquid: { fontSize: 11, color: Colors.green },
});

// ── Main Screen ──────────────────────────────────────────────

export default function FolhaScreen() {
  const [tab, setTab] = useState(0);
  const [payslipEmp, setPayslipEmp] = useState<Employee | null>(null);

  if (payslipEmp) {
    return (
      <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
        <Payslip emp={payslipEmp} onBack={() => setPayslipEmp(null)} />
        <DemoBanner />
      </ScrollView>
    );
  }

  const activeCount = EMPLOYEES.filter(e => e.status === "active").length;
  const totalBruto = EMPLOYEES.filter(e => e.status === "active").reduce((s, e) => s + e.salary, 0);
  const totalFGTS = EMPLOYEES.filter(e => e.status === "active").reduce((s, e) => s + e.salary * FGTS_RATE, 0);

  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="Folha de Pagamento" />

      {/* Summary KPIs */}
      <View style={z.kpis}>
        <View style={z.kpi}><Icon name="users" size={20} color={Colors.violet3}/><Text style={z.kpiVal}>{activeCount}</Text><Text style={z.kpiLbl}>Ativos</Text></View>
        <View style={z.kpi}><Icon name="dollar" size={20} color={Colors.green}/><Text style={z.kpiVal}>{fmt(totalBruto)}</Text><Text style={z.kpiLbl}>Folha bruta</Text></View>
        <View style={z.kpi}><Icon name="trending_up" size={20} color={Colors.amber}/><Text style={z.kpiVal}>{fmt(totalFGTS)}</Text><Text style={z.kpiLbl}>FGTS</Text></View>
      </View>

      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {tab === 0 && (
        <View>
          {EMPLOYEES.map(emp => <EmpCard key={emp.id} emp={emp} onCalc={() => setPayslipEmp(emp)} />)}
        </View>
      )}
      {tab === 1 && <CalcTab />}
      {tab === 2 && <HistTab />}

      <DemoBanner />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  kpis: { flexDirection: "row", gap: 10, marginBottom: 20 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kpiVal: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  kpiLbl: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
});
