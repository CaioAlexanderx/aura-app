import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Dimensions } from "react-native";
import { router } from "expo-router";
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
import { RequireCompanyScope } from "@/components/RequireCompanyScope";

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

// PLAN-02 (12/05/2026): UpgradeCard local pras secoes Negocio+ (Folha,
// Comissoes, Ranking, Metas, Historico). Mesma estrategia que clientes.tsx:
// mostra o conteudo da secao como teaser dentro do card + CTA pra planos.
function UpgradeCard({ title, description, features }: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <View style={u.wrap}>
      <View style={u.iconWrap}>
        <Icon name="star" size={20} color={Colors.violet3} />
      </View>
      <Text style={u.title}>{title}</Text>
      <Text style={u.desc}>{description}</Text>
      <View style={u.featuresList}>
        {features.map(f => (
          <View key={f} style={u.featureRow}>
            <Icon name="check" size={12} color={Colors.green} />
            <Text style={u.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/planos")}
        style={u.cta}
      >
        <Text style={u.ctaText}>Conhecer o plano Negocio</Text>
      </Pressable>
      <Text style={u.hint}>A partir de R$ 169/mes -- ative quando quiser</Text>
    </View>
  );
}

const u = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: Colors.violetD,
    borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 6, textAlign: "center" },
  desc: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 20, lineHeight: 18, maxWidth: 380 },
  featuresList: { gap: 10, marginBottom: 20, alignSelf: "stretch", maxWidth: 380, marginHorizontal: "auto" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 13, color: Colors.ink, flex: 1 },
  cta: {
    backgroundColor: Colors.violet,
    borderRadius: 12,
    paddingHorizontal: 22, paddingVertical: 12,
    marginBottom: 10,
  },
  ctaText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  hint: { fontSize: 11, color: Colors.ink3, textAlign: "center" },
});

// MULTICNPJ Sessao 1: Folha exige CNPJ especifico (vinculo trabalhista por CNPJ).
// No modo consolidado, RequireCompanyScope abre picker antes de renderizar.
function FolhaScreenInner() {
  const [tab, setTab] = useState(0);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const scrollRef = useRef<any>(null);

  const { employees, active, totalBruto, totalFgts, totals, isLoading, isDemo, createEmployee, updateEmployee, deleteEmployee, plan, planLimit } = usePayroll();

  // PLAN-02: Essencial ve form simples (so nome+cargo+contato) e nao tem
  // acesso ao calculo de folha. Tabs avancadas (Resumo, Historico, Ranking,
  // Metas, Comissoes) mostram UpgradeCard.
  const isEssencial = plan === "essencial";
  // PLAN-02: contagem near-limit (>=85%)
  const nearLimit = planLimit && planLimit < 999999 && active.length / planLimit >= 0.85;

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

  // PLAN-02: validacao adaptativa por plano.
  // Essencial: so nome obrigatorio.
  // Negocio+: nome + salario + CPF (11 digitos) + data admissao (dd/mm/aaaa).
  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = "Nome obrigatorio";

    if (!isEssencial) {
      // Validacoes de folha real (Negocio+)
      if (!form.salary || parseFloat(form.salary.replace(",", ".")) <= 0) e.salary = "Salario obrigatorio";
      const cpfDigits = form.cpf.replace(/\D/g, "");
      if (!cpfDigits || cpfDigits.length !== 11) e.cpf = "CPF deve ter 11 digitos";
      const dateNorm = normalizeDate(form.admDate);
      if (!form.admDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateNorm)) e.admDate = "Data obrigatoria (dd/mm/aaaa)";
    } else {
      // Essencial: se CPF foi preenchido, valida formato; senao, permite vazio.
      const cpfDigits = form.cpf.replace(/\D/g, "");
      if (cpfDigits.length > 0 && cpfDigits.length !== 11) e.cpf = "CPF deve ter 11 digitos quando preenchido";
      // Data admissao opcional; se preenchida, valida formato.
      if (form.admDate.trim()) {
        const dateNorm = normalizeDate(form.admDate);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateNorm)) e.admDate = "Use formato dd/mm/aaaa";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      // PLAN-02: body adaptativo por plano. Campos vazios pro Essencial
      // vao como undefined (omitidos) -- BE aceita null em cpf/admission_date/salary.
      const body: any = {
        name: form.name.trim(),
        role: form.role.trim() || "Colaborador",
        status: "active",
      };
      if (form.salary) body.salary = parseFloat(form.salary.replace(",", "."));
      if (form.admDate.trim()) body.admission_date = normalizeDate(form.admDate);
      if (form.cpf.replace(/\D/g, "")) body.cpf = form.cpf.replace(/\D/g, "");
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

  // PLAN-02: contagem de Essencial mostra X/3 ativos
  const countLabel = isEssencial && planLimit && planLimit < 999999
    ? `${active.length} / ${planLimit}`
    : String(active.length);

  // PLAN-02: titulo + subtitulo adaptados por plano.
  // Essencial: foca em "Equipe" (cadastro de vendedores).
  // Negocio+: foca em "Folha" completa (calculo + holerite).
  const pageTitle = isEssencial ? "Equipe" : "Equipe e Folha";
  const pageSubtitle = isEssencial
    ? "Cadastre quem vende. Atribua vendas no caixa."
    : null;

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: pageSubtitle ? 4 : 20, flexWrap: "wrap", gap: 10 }}>
        <Text style={s.pageTitle}>{pageTitle}</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {/* FolhaToolbar (envia holerite por email) so Negocio+ */}
          {!isDemo && employees.length > 0 && !isEssencial && <FolhaToolbar period={currentPeriod} />}
          <Pressable onPress={openCreate} style={s.addBtn}>
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.addBtnText}>{isEssencial ? "Novo membro" : "Novo funcionario"}</Text>
          </Pressable>
        </View>
      </View>
      {pageSubtitle && <Text style={s.pageSub}>{pageSubtitle}</Text>}

      {/* PLAN-02: banner near-limit pro Essencial */}
      {nearLimit && (
        <Pressable onPress={() => router.push("/(tabs)/planos")} style={s.nearLimitBanner}>
          <Icon name="alert" size={14} color={Colors.amber} />
          <View style={{ flex: 1 }}>
            <Text style={s.nearLimitTitle}>
              {active.length >= (planLimit || 0)
                ? `Limite do plano atingido (${planLimit} funcionarios ativos)`
                : `Voce esta perto do limite (${active.length} / ${planLimit})`}
            </Text>
            <Text style={s.nearLimitSub}>Toque para ver opcoes de upgrade</Text>
          </View>
          <Icon name="chevron_right" size={16} color={Colors.amber} />
        </Pressable>
      )}

      {!isLoading && employees.length === 0 && !showForm && (
        <View style={s.emptyCard}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>&#128101;</Text>
          <Text style={s.emptyTitle}>
            {isEssencial ? "Nenhum membro cadastrado" : "Nenhum funcionario cadastrado"}
          </Text>
          <Text style={s.emptyDesc}>
            {isEssencial
              ? "Cadastre vendedores ou colaboradores. Eles aparecem no caixa pra atribuir vendas."
              : "Adicione seu primeiro funcionario para calcular a folha de pagamento."}
          </Text>
          <Pressable onPress={openCreate} style={[s.addBtn, { marginTop: 12 }]}>
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.addBtnText}>{isEssencial ? "Cadastrar membro" : "Cadastrar funcionario"}</Text>
          </Pressable>
        </View>
      )}

      {showForm && (
        <View style={s.formCard}>
          <Text style={s.formTitle}>
            {editingId
              ? (isEssencial ? "Editar membro" : "Editar funcionario")
              : (isEssencial ? "Novo membro" : "Novo funcionario")}
          </Text>

          {/* PLAN-02: form ENXUTO pro Essencial (so nome+cargo+contato).
              Folha real (CPF, admissao, salario, PIS) so no Negocio+. */}
          {isEssencial ? (
            <>
              <View style={s.formRow}>
                <FormField label="Nome" required error={errors.name}>
                  <TextInput style={[s.formInput, errors.name && s.formInputError]} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Nome completo" placeholderTextColor={Colors.ink3} />
                </FormField>
                <FormField label="Funcao" hint="Ex: Vendedor, Atendente, Caixa">
                  <TextInput style={s.formInput} value={form.role} onChangeText={v => setForm(f => ({ ...f, role: v }))} placeholder="Ex: Vendedor" placeholderTextColor={Colors.ink3} />
                </FormField>
              </View>
              <View style={s.formRow}>
                <FormField label="Telefone" hint="Opcional">
                  <TextInput style={s.formInput} value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: maskPhone(v) }))} placeholder="(12) 99999-9999" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" maxLength={15} />
                </FormField>
                <FormField label="E-mail" hint="Opcional">
                  <TextInput style={s.formInput} value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} placeholder="email@exemplo.com" placeholderTextColor={Colors.ink3} autoCapitalize="none" keyboardType="email-address" />
                </FormField>
              </View>
              <View style={s.essencialHint}>
                <Icon name="info" size={12} color={Colors.ink3} />
                <Text style={s.essencialHintText}>
                  Folha de pagamento (CPF, salario, comissao, holerite) esta disponivel no plano Negocio.
                </Text>
              </View>
            </>
          ) : (
            <>
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
            </>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <Pressable onPress={() => { setShowForm(false); setEditingId(null); setErrors({}); }} style={s.cancelBtn}><Text style={s.cancelBtnText}>Cancelar</Text></Pressable>
            <Pressable onPress={handleSave} style={[s.addBtn, { flex: 1, opacity: saving ? 0.6 : 1 }]} disabled={saving}><Text style={s.addBtnText}>{saving ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}</Text></Pressable>
          </View>
        </View>
      )}

      {/* KPIs: pro Essencial mostra so contagem; Negocio+ mostra folha bruta + FGTS */}
      {employees.length > 0 && (
        <View style={s.kpis}>
          <View style={s.kpi}>
            <Text style={s.kpiValue}>{countLabel}</Text>
            <Text style={s.kpiLabel}>{isEssencial ? "Ativos" : "Ativos"}</Text>
          </View>
          {!isEssencial && (
            <>
              <View style={s.kpi}><Text style={[s.kpiValue, { color: Colors.green }]}>{fmt(totalBruto)}</Text><Text style={s.kpiLabel}>Folha bruta</Text></View>
              <View style={s.kpi}><Text style={[s.kpiValue, { color: Colors.amber }]}>{fmt(totalFgts)}</Text><Text style={s.kpiLabel}>FGTS</Text></View>
            </>
          )}
        </View>
      )}

      {/* Tabs: Essencial so mostra a primeira (Funcionarios). Negocio+ tem todas.
          Cadeado nas tabs avancadas pro Essencial. */}
      {employees.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {TABS.map((t, i) => (
            <Pressable key={t} onPress={() => { setTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }} style={[s.tab, tab === i && s.tabActive]}>
              <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
              {isEssencial && i > 0 && (
                <Icon name="lock" size={10} color={tab === i ? "#fff" : Colors.ink3} />
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}

      {isLoading && <ListSkeleton rows={3} showCards />}

      {/* Tab 0: lista de funcionarios -- sempre disponivel.
          EmployeeCard hoje mostra salario+admDate. Pro Essencial, valores
          vem 0/vazio (salvos como null no BE), card lida bem com isso. */}
      {tab === 0 && employees.length > 0 && (
        <View>
          {employees.map(e => (
            <EmployeeCard
              key={e.id}
              emp={e}
              onCalc={isEssencial ? undefined : () => { setSelectedEmp(e); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }}
              onEdit={() => openEdit(e)}
              onDelete={() => handleDelete(e)}
            />
          ))}
        </View>
      )}

      {/* Tabs avancadas: Essencial ve UpgradeCard. Negocio+ ve conteudo real. */}
      {tab === 1 && (isEssencial ? (
        <UpgradeCard
          title="Resumo da folha"
          description="Veja todos os encargos da folha em um painel consolidado."
          features={[
            "Total bruto, INSS, IRRF e FGTS por mes",
            "Liquido a pagar por funcionario",
            "Comparativo mensal",
          ]}
        />
      ) : <PayrollSummary employees={employees} totals={totals} totalBruto={totalBruto} />)}

      {tab === 2 && (isEssencial ? (
        <UpgradeCard
          title="Historico de folha"
          description="Acompanhe todos os pagamentos passados, com holerites individuais."
          features={[
            "Holerites mensais por funcionario",
            "Envio automatico por e-mail",
            "Exportacao para contador (PDF/XLSX)",
          ]}
        />
      ) : <PayrollHistory />)}

      {tab === 3 && (isEssencial ? (
        <UpgradeCard
          title="Ranking de vendas"
          description="Saiba quem vendeu mais e calcule comissoes automaticamente."
          features={[
            "Top vendedores por receita e ticket medio",
            "Histograma por dia/semana/mes",
            "Base pra calcular comissoes",
          ]}
        />
      ) : <SalesRanking />)}

      {tab === 4 && (isEssencial ? (
        <UpgradeCard
          title="Metas por vendedor"
          description="Defina metas individuais e acompanhe o progresso em tempo real."
          features={[
            "Meta de receita ou unidades vendidas",
            "Acompanhamento diario/semanal",
            "Alerta quando bate a meta",
          ]}
        />
      ) : <TabMetas />)}

      {tab === 5 && (isEssencial ? (
        <UpgradeCard
          title="Comissoes automaticas"
          description="Configure regras de comissao por vendedor ou produto."
          features={[
            "Comissao em % sobre venda",
            "Calculo automatico ao fechar a venda",
            "Relatorio mensal para fechamento",
          ]}
        />
      ) : <TabComissoes />)}

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

export default function FolhaScreen() {
  return (
    <RequireCompanyScope context="folha" actionLabel="gerenciar equipe">
      <FolhaScreenInner />
    </RequireCompanyScope>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  pageSub: { fontSize: 13, color: Colors.ink3, marginBottom: 20 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  addBtnText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  emptyCard: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", maxWidth: 320 },
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
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
  // PLAN-02
  essencialHint: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  essencialHintText: { fontSize: 11, color: Colors.ink3, flex: 1, lineHeight: 15 },
  nearLimitBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: Colors.amberD,
    borderWidth: 1,
    borderColor: Colors.amber + "44",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  nearLimitTitle: { fontSize: 13, color: Colors.amber, fontWeight: "700" },
  nearLimitSub: { fontSize: 11, color: Colors.amber, opacity: 0.85, marginTop: 1 },
});
