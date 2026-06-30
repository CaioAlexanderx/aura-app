// ============================================================
// ExpensesTab — Saídas (Despesas)
//
// Lista de despesas + formulário de lançamento.
//
// Wired: GET /financial/expenses
//        POST /financial/expenses (dados reais).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ViewStyle,
  TextStyle,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, ShojiPalette, KarateFonts } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { karateApi, Expense, ExpenseInput, ExpenseCategory } from "@/services/karateApi";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  expense_cost:        "Custo geral",
  expense_repasse:     "Repasse",
  expense_certificate: "Certificados",
  expense_award:       "Prêmios/Trofeus",
  expense_other:       "Outros",
};

const CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "expense_cost",        label: "Custo geral" },
  { key: "expense_repasse",     label: "Repasse" },
  { key: "expense_certificate", label: "Certificados" },
  { key: "expense_award",       label: "Prêmios/Trofeus" },
  { key: "expense_other",       label: "Outros" },
];

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

interface NewExpenseForm {
  amount: string;
  category: ExpenseCategory;
  description: string;
  due_date: string;
}

const EMPTY_FORM: NewExpenseForm = {
  amount: "",
  category: "expense_cost",
  description: "",
  due_date: "",
};

interface Props { federationId: string; }

export function ExpensesTab({ federationId }: Props) {
  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState<NewExpenseForm>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState("");

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listExpenses(federationId);
      setExpenses(res.data);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <KarateErrorState onRetry={() => load()} />;

  const handleSave = async () => {
    const amt = parseFloat(form.amount.replace(",", "."));
    if (!amt || amt <= 0) { setFormError("Informe um valor válido."); return; }
    if (!form.description.trim()) { setFormError("Descrição obrigatória."); return; }
    setFormError("");
    setSaving(true);
    try {
      const body: ExpenseInput = {
        amount: amt,
        category: form.category,
        description: form.description.trim(),
        due_date: form.due_date || undefined,
      };
      const saved = await karateApi.createExpense(federationId, body);
      setExpenses((prev) => [saved, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setFormError(e?.message ?? "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />
      }
    >
      {/* Header + botão */}
      <View style={st.headerRow}>
        <View>
          <Text style={st.totalLabel}>Total saídas</Text>
          {!loading && <Text style={st.totalValue}>{formatCurrency(total)}</Text>}
        </View>
        <KarateButton
          label="+ Lançar saída"
          variant="primary"
          size="sm"
          onPress={() => setShowForm(true)}
        />
      </View>

      {/* Lista */}
      {loading ? (
        [1,2,3].map((k) => <Skeleton key={k} height={68} style={{ marginBottom: 8 }} />)
      ) : expenses.length === 0 ? (
        <KarateEmptyState icon="cash-outline" title="Nenhuma saída lançada" />
      ) : (
        expenses.map((exp) => (
          <View key={exp.id} style={st.card}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={st.expDesc}>{exp.description}</Text>
              <Text style={st.expMeta}>
                {CATEGORY_LABELS[exp.category as ExpenseCategory] ?? exp.category}
                {exp.due_date ? ` · vence ${formatDate(exp.due_date)}` : ""}
              </Text>
            </View>
            <Text style={st.expAmount}>- {formatCurrency(exp.amount)}</Text>
          </View>
        ))
      )}

      {/* Modal de lançamento */}
      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
        accessibilityViewIsModal
      >
        <View style={st.overlay}>
          <View style={st.sheet}>
            <View style={st.sheetHeader}>
              <Text style={st.sheetTitle}>Lançar Saída</Text>
              <TouchableOpacity onPress={() => setShowForm(false)} accessibilityLabel="Fechar" accessibilityRole="button">
                <Icon name="close" size={22} color={KarateColors.ink3} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={st.formBody}>
              {/* Valor */}
              <Text style={st.fieldLabel}>Valor (R$)</Text>
              <TextInput
                style={st.fieldInput}
                value={form.amount}
                onChangeText={(v) => setForm((p) => ({ ...p, amount: v }))}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={KarateColors.ink4}
                accessibilityLabel="Valor"
              />
              {/* Categoria */}
              <Text style={[st.fieldLabel, { marginTop: 12 }]}>Categoria</Text>
              <View style={st.catRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[st.catChip, form.category === c.key && st.catChipActive]}
                    onPress={() => setForm((p) => ({ ...p, category: c.key }))}
                    accessibilityRole="radio"
                    accessibilityLabel={c.label}
                    accessibilityState={{ checked: form.category === c.key }}
                  >
                    <Text style={[st.catLabel, form.category === c.key && st.catLabelActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Descrição */}
              <Text style={[st.fieldLabel, { marginTop: 12 }]}>Descrição</Text>
              <TextInput
                style={[st.fieldInput, { height: 72, textAlignVertical: "top" }]}
                value={form.description}
                onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                multiline
                placeholder="Ex.: Trofeus campeonato…"
                placeholderTextColor={KarateColors.ink4}
                accessibilityLabel="Descrição"
              />
              {/* Vencimento */}
              <Text style={[st.fieldLabel, { marginTop: 12 }]}>Vencimento (opcional)</Text>
              <TextInput
                style={st.fieldInput}
                value={form.due_date}
                onChangeText={(v) => setForm((p) => ({ ...p, due_date: v }))}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={KarateColors.ink4}
                accessibilityLabel="Data de vencimento"
              />
              {formError ? <Text style={st.formError}>{formError}</Text> : null}
              <KarateButton
                label="Salvar saída"
                variant="primary"
                onPress={handleSave}
                loading={saving}
                style={{ marginTop: 16 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:      { padding: 16, gap: 8, paddingBottom: 40 } as ViewStyle,
  headerRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } as ViewStyle,
  totalLabel:   { fontSize: 11, fontWeight: "600", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  totalValue:   { fontFamily: KarateFonts.mono, fontSize: 22, fontWeight: "700", color: KarateColors.danger } as TextStyle,
  card:         { flexDirection: "row", backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8, alignItems: "center" } as ViewStyle,
  expDesc:      { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  expMeta:      { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  expAmount:    { fontFamily: KarateFonts.mono, fontSize: 15, fontWeight: "700", color: KarateColors.danger } as TextStyle,
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" } as ViewStyle,
  sheet:        { backgroundColor: KarateColors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%" as any } as ViewStyle,
  sheetHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  sheetTitle:   { fontSize: 17, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  formBody:     { padding: 20, gap: 4, paddingBottom: 40 } as ViewStyle,
  fieldLabel:   { fontSize: 12, fontWeight: "700", color: KarateColors.ink3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 } as TextStyle,
  fieldInput:   { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: KarateColors.ink, backgroundColor: "#fff" } as TextStyle,
  catRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  catChip:      { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  catChipActive:{ backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  catLabel:     { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  catLabelActive:{ color: KarateColors.primary, fontWeight: "800" } as TextStyle,
  formError:    { fontSize: 12, color: KarateColors.danger, marginTop: 8 } as TextStyle,
});
