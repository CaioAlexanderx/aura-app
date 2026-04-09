import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { usePayroll } from "@/hooks/usePayroll";
import { ListSkeleton } from "@/components/ListSkeleton";
import { EmployeeCard } from "@/components/screens/folha/EmployeeCard";
import { Payslip } from "@/components/screens/folha/Payslip";
import { PayrollSummary } from "@/components/screens/folha/PayrollSummary";
import { PayrollHistory } from "@/components/screens/folha/PayrollHistory";
import { SalesRanking } from "@/components/screens/folha/SalesRanking";
import { TABS, fmt, FGTS_RATE } from "@/components/screens/folha/types";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { FolhaToolbar } from "@/components/FolhaToolbar";
import type { Employee } from "@/components/screens/folha/types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

type FormData = { name: string; role: string; salary: string; admDate: string; cpf: string; phone: string; email: string };
const emptyForm: FormData = { name: "", role: "", salary: "", admDate: "", cpf: "", phone: "", email: "" };

export default function FolhaScreen() {
  const [tab, setTab] = useState(0);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<any>(null);

  const { employees, active, totalBruto, totalFgts, totals, isLoading, isDemo, createEmployee, updateEmployee, deleteEmployee } = usePayroll();

  const currentPeriod = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })();

  function openCreate() { setForm(emptyForm); setEditingId(null); setShowForm(true); }
  function openEdit(emp: Employee) {
    setForm({ name: emp.name || "", role: emp.role || "", salary: emp.salary ? String(emp.salary) : "", admDate: emp.admDate || "", cpf: (emp as any).cpf || "", phone: (emp as any).phone || "", email: (emp as any).email || "" });
    setEditingId(emp.id); setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nome obrigatorio"); return; }
    if (!form.salary || parseFloat(form.salary) <= 0) { toast.error("Salario obrigatorio"); return; }
    setSaving(true);
    try {
      const body: any = { name: form.name.trim(), role: form.role.trim() || "Colaborador", salary: parseFloat(form.salary), status: "active" };
      if (form.admDate) body.admission_date = form.admDate;
      if (form.cpf) body.cpf = form.cpf;
      if (form.phone) body.phone = form.phone;
      if (form.email) body.email = form.email;
      if (editingId) { await updateEmployee(editingId, body); } else { await createEmployee(body); }
      setShowForm(false); setForm(emptyForm); setEditingId(null);
    } catch {} finally { setSaving(false); }
  }

  async function handleDelete(emp: Employee) { await deleteEmployee(emp.id); }

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
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <Text style={s.pageTitle}>Folha de Pagamento</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {/* Fase 3: Export payroll */}
          {!isDemo && employees.length > 0 && <FolhaToolbar period={currentPeriod} />}
          <Pressable onPress={openCreate} style={s.addBtn}>
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.addBtnText}>Novo funcionario</Text>
          </Pressable>
        </View>
      </View>

      {!isLoading && employees.length === 0 && !showForm && (
        <View style={s.emptyCard}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
          <Text style={s.emptyTitle}>Nenhum funcionario cadastrado</Text>
          <Text style={s.emptyDesc}>Adicione seu primeiro funcionario para calcular a folha de pagamento.</Text>
          <Pressable onPress={openCreate} style={[s.addBtn, { marginTop: 12 }]}>
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.addBtnText}>Cadastrar funcionario</Text>
          </Pressable>
        </View>
      )}

      {showForm && (
        <View style={s.formCard}>
          <Text style={s.formTitle}>{editingId ? "Editar funcionario" : "Novo funcionario"}</Text>
          <View style={s.formRow}>
            <View style={s.formField}><Text style={s.formLabel}>Nome *</Text><TextInput style={s.formInput} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Nome completo" placeholderTextColor={Colors.ink3} /></View>
            <View style={s.formField}><Text style={s.formLabel}>Cargo</Text><TextInput style={s.formInput} value={form.role} onChangeText={v => setForm(f => ({ ...f, role: v }))} placeholder="Ex: Atendente" placeholderTextColor={Colors.ink3} /></View>
          </View>
          <View style={s.formRow}>
            <View style={s.formField}><Text style={s.formLabel}>Salario bruto (R$) *</Text><TextInput style={s.formInput} value={form.salary} onChangeText={v => setForm(f => ({ ...f, salary: v }))} placeholder="1800.00" placeholderTextColor={Colors.ink3} keyboardType="numeric" /></View>
            <View style={s.formField}><Text style={s.formLabel}>Data admissao</Text><TextInput style={s.formInput} value={form.admDate} onChangeText={v => setForm(f => ({ ...f, admDate: v }))} placeholder="2025-03-15" placeholderTextColor={Colors.ink3} /></View>
          </View>
          <View style={s.formRow}>
            <View style={s.formField}><Text style={s.formLabel}>CPF</Text><TextInput style={s.formInput} value={form.cpf} onChangeText={v => setForm(f => ({ ...f, cpf: v }))} placeholder="000.000.000-00" placeholderTextColor={Colors.ink3} /></View>
            <View style={s.formField}><Text style={s.formLabel}>Telefone</Text><TextInput style={s.formInput} value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} placeholder="(12) 99999-9999" placeholderTextColor={Colors.ink3} /></View>
          </View>
          <View style={s.formRow}>
            <View style={s.formField}><Text style={s.formLabel}>E-mail</Text><TextInput style={s.formInput} value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} placeholder="email@exemplo.com" placeholderTextColor={Colors.ink3} /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable onPress={() => { setShowForm(false); setEditingId(null); }} style={s.cancelBtn}><Text style={s.cancelBtnText}>Cancelar</Text></Pressable>
            <Pressable onPress={handleSave} style={[s.addBtn, { flex: 1, opacity: saving ? 0.6 : 1 }]} disabled={saving}><Text style={s.addBtnText}>{saving ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}</Text></Pressable>
          </View>
        </View>
      )}

      {employees.length > 0 && (
        <View style={s.kpis}>
          <View style={s.kpi}><Text style={s.kpiValue}>{active.length}</Text><Text style={s.kpiLabel}>Ativos</Text></View>
          <View style={s.kpi}><Text style={[s.kpiValue, { color: Colors.green }]}>{fmt(totalBruto)}</Text><Text style={s.kpiLabel}>Folha bruta</Text></View>
          <View style={s.kpi}><Text style={[s.kpiValue, { color: Colors.amber }]}>{fmt(totalFgts)}</Text><Text style={s.kpiLabel}>FGTS</Text></View>
        </View>
      )}

      {employees.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {TABS.map((t, i) => <Pressable key={t} onPress={() => { setTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }} style={[s.tab, tab === i && s.tabActive]}><Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text></Pressable>)}
        </ScrollView>
      )}

      {isLoading && <ListSkeleton rows={3} showCards />}
      {tab === 0 && employees.length > 0 && <View>{employees.map(e => <EmployeeCard key={e.id} emp={e} onCalc={() => { setSelectedEmp(e); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }} onEdit={() => openEdit(e)} onDelete={() => handleDelete(e)} />)}</View>}
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
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  addBtnText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  emptyCard: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", maxWidth: 300 },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: IS_WIDE ? 24 : 16, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  formTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 16 },
  formRow: { flexDirection: IS_WIDE ? "row" : "column", gap: 10, marginBottom: 10 },
  formField: { flex: 1 },
  formLabel: { fontSize: 11, fontWeight: "600", color: Colors.ink3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  formInput: { backgroundColor: Colors.bg, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  cancelBtn: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
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
