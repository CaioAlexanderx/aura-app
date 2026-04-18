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
import { TabMetas } from "@/components/screens/folha/TabMetas";
import { TabComissoes } from "@/components/screens/folha/TabComissoes";
import { TABS, fmt, FGTS_RATE } from "@/components/screens/folha/types";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { FolhaToolbar } from "@/components/FolhaToolbar";
import type { Employee } from "@/components/screens/folha/types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

type FormData = { name: string; role: string; salary: string; admDate: string; cpf: string; phone: string; email: string };
const emptyForm: FormData = { name: "", role: "", salary: "", admDate: "", cpf: "", phone: "", email: "" };

function maskCPF(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function maskDate(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function maskCurrency(v: string): string {
  const clean = v.replace(/[^0-9,\.]/g, "");
  return clean;
}

function normalizeDate(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return trimmed;
}

function FormField({ label, required, children, hint, error }: { label: string; required?: boolean; children: React.ReactNode; hint?: string; error?: string | null }) {
  return (
    <View style={s.formField}>
      <Text style={s.formLabel}>{label}{required && <Text style={{ color: Colors.red }}> *</Text>}</Text>
      {children}
      {error && <Text style={s.fieldError}>{error}</Text>}
      {hint && !error && <Text style={s.fieldHint}>{hint}</Text>}
    </View>
  );
}

export default function FolhaScreen() {
  const [tab, setTab] = useState(0);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const scrollRef = useRef<any>(null);

  const { employees, active, totalBruto, totalFgts, totals, isLoading, isDemo, createEmployee, updateEmployee, deleteEmployee } = usePayroll();

  const currentPeriod = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })();

  function openCreate() { setForm(emptyForm); setEditingId(null); setErrors({}); setShowForm(true); }
  function openEdit(emp: Employee) {
    setForm({
      name: emp.name || "",
      role: emp.role || "",
      salary: emp.salary ? String(emp.salary) : "",
      admDate: emp.admDate || "",
      cpf: emp.cpf ? maskCPF(emp.cpf) : "",
      phone: emp.phone ? maskPhone(emp.phone) : "",
      email: emp.email || "",
    });
    setEditingId(emp.id); setErrors({}); setShowForm(true);
  }

  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = "Nome obrigatorio";
    if (!form.salary || parseFloat(form.salary.replace(",", ".")) <= 0) e.salary = "Salario obrigatorio";
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (!cpfDigits || cpfDigits.length !== 11) e.cpf = "CPF deve ter 11 digitos";
    const dateNorm = normalizeDate(form.admDate);
    if (!form.admDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateNorm)) e.admDate = "Data obrigatoria (dd/mm/aaaa)";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const body: any = {
        name: form.name.trim(),
        role: form.role.trim() || "Colaborador",
        salary: parseFloat(form.salary.replace(",", ".")),
        admission_date: normalizeDate(form.admDate),
        cpf: form.cpf.replace(/\D/g, ""),
        status: "active",
      };
      if (form.phone) body.phone = form.phone;
      if (form.email) body.email = form.email;
      if (editingId) { await updateEmployee(editingId, body); }
      else { await createEmployee(body); }
      setShowForm(false); setForm(emptyForm); setEditingId(null); setErrors({});
    } catch { /* toast shown by hook */ }
    finally { setSaving(false); }
  }

  async function handleDelete(emp: Employee) {
    try { await deleteEmployee(emp.id); } catch {}
  }

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
          {!isDemo && employees.length > 0 && <FolhaToolbar period={currentPeriod} />}
          <Pressable onPress={openCreate} style={s.addBtn}>
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.addBtnText}>Novo funcionario</Text>
          </Pressable>
        </View>
      </View>

      {!isLoading && employees.length === 0 && !showForm && (
        <View style={s.emptyCard}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>&#128101;</Text>
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
            <FormField label="Nome completo" required error={errors.name}>
              <TextInput style={[s.formInput, errors.name && s.formInputError]} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Nome completo" placeholderTextColor={Colors.ink3} />
            </FormField>
            <FormField label="Cargo">
              <TextInput style={s.formInput} value={form.role} onChangeText={v => setForm(f => ({ ...f, role: v }))} placeholder="Ex: Atendente" placeholderTextColor={Colors.ink3} />
            </FormField>
          </View>
          <View style={s.formRow}>
            <FormField label="Salario bruto (R$)" required error={errors.salary} hint="Valor mensal bruto">
              <TextInput style={[s.formInput, errors.salary && s.formInputError]} value={form.salary} onChangeText={v => setForm(f => ({ ...f, salary: maskCurrency(v) }))} placeholder="1800,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
            </FormField>
            <FormField label="Data de admissao" required error={errors.admDate} hint="Formato: dd/mm/aaaa">
              <TextInput style={[s.formInput, errors.admDate && s.formInputError]} value={form.admDate} onChangeText={v => setForm(f => ({ ...f, admDate: maskDate(v) }))} placeholder="01/04/2026" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} />
            </FormField>
          </View>
          <View style={s.formRow}>
            <FormField label="CPF" required error={errors.cpf}>
              <TextInput style={[s.formInput, errors.cpf && s.formInputError]} value={form.cpf} onChangeText={v => setForm(f => ({ ...f, cpf: maskCPF(v) }))} placeholder="000.000.000-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={14} />
            </FormField>
            <FormField label="Telefone" hint="Opcional">
              <TextInput style={s.formInput} value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: maskPhone(v) }))} placeholder="(12) 99999-9999" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" maxLength={15} />
            </FormField>
          </View>
          <View style={s.formRow}>
            <FormField label="E-mail" hint="Opcional">
              <TextInput style={s.formInput} value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} placeholder="email@exemplo.com" placeholderTextColor={Colors.ink3} autoCapitalize="none" keyboardType="email-address" />
            </FormField>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <Pressable onPress={() => { setShowForm(false); setEditingId(null); setErrors({}); }} style={s.cancelBtn}><Text style={s.cancelBtnText}>Cancelar</Text></Pressable>
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
      {tab === 4 && <TabMetas />}
      {tab === 5 && <TabComissoes />}

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
  formRow: { flexDirection: IS_WIDE ? "row" : "column", gap: 10, marginBottom: 4 },
  formField: { flex: 1, marginBottom: 8 },
  formLabel: { fontSize: 11, fontWeight: "600", color: Colors.ink3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  formInput: { backgroundColor: Colors.bg, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  formInputError: { borderColor: Colors.red, borderWidth: 1.5 },
  fieldError: { fontSize: 11, color: Colors.red, marginTop: 4, fontWeight: "500" },
  fieldHint: { fontSize: 10, color: Colors.ink3, marginTop: 3 },
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
