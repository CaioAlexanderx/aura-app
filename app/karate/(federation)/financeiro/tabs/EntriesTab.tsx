// ============================================================
// EntriesTab — Lançamentos (entradas + saídas)
//
// Extrato unificado da federação: receitas (verde, +) e despesas
// (vermelho, −) num só lugar. Substitui a antiga aba "Saídas".
//
// Wired: GET    /financial/expenses?kind&category&q&from&to
//        POST   /financial/expenses   { kind, amount, category, description, due_date }
//        PATCH  /financial/expenses/:id
//        DELETE /financial/expenses/:id
//
// Padrões: Icon.tsx (SVG inline, nunca @expo/vector-icons), DateInput/
//   parseBrDate, maskCurrency/unmaskNumber, modal centrado, window.confirm
//   para confirmação (Alert.alert é no-op no web), toast inline, tokens Shoji.
//   Busca/filtros client-side sobre a lista carregada + repassados ao GET.
//   Export CSV client-side via Blob/anchor (nunca window.open de rota auth).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { SearchField } from "@/components/karate/shoji";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import {
  karateApi,
  FinancialEntry,
  FinancialEntryInput,
  EntryKind,
  EntryCategory,
  ExpenseCategory,
  IncomeCategory,
} from "@/services/karateApi";
import { confirmAsync } from "@/components/karate/ConfirmDialog";

// ── Rótulos amigáveis de categoria, por kind ────────────────────
const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "expense_cost",        label: "Custo geral" },
  { key: "expense_repasse",     label: "Repasse" },
  { key: "expense_certificate", label: "Certificados" },
  { key: "expense_award",       label: "Prêmios/Troféus" },
  { key: "expense_other",       label: "Outros" },
];

const INCOME_CATEGORIES: { key: IncomeCategory; label: string }[] = [
  { key: "income_event",       label: "Eventos" },
  { key: "income_sponsorship", label: "Patrocínio" },
  { key: "income_donation",    label: "Doação" },
  { key: "income_sale",        label: "Vendas" },
  { key: "income_other",       label: "Outros" },
];

const CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.key, c.label])),
  ...Object.fromEntries(INCOME_CATEGORIES.map((c) => [c.key, c.label])),
};

function catLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

function categoriesFor(kind: EntryKind) {
  return kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d?: string | null) {
  if (!d) return "";
  // d vem como ISO (YYYY-MM-DD ou completo) — usa só a parte da data.
  const iso = String(d).slice(0, 10);
  const br = formatIsoToBr(iso);
  return br || new Date(d).toLocaleDateString("pt-BR");
}

const KIND_FILTER: { key: EntryKind | "all"; label: string }[] = [
  { key: "all",     label: "Todos" },
  { key: "income",  label: "Entradas" },
  { key: "expense", label: "Saídas" },
];

// ── Form do modal ───────────────────────────────────────────────
interface EntryForm {
  kind: EntryKind;
  amount: string;       // mascarado "1.234,56"
  category: EntryCategory;
  description: string;
  dateBr: string;       // dd/mm/aaaa
}

function emptyForm(): EntryForm {
  return { kind: "expense", amount: "", category: "expense_cost", description: "", dateBr: "" };
}

interface Props { federationId: string; }

export function EntriesTab({ federationId }: Props) {
  const [entries, setEntries]       = useState<FinancialEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [kindFilter, setKindFilter] = useState<EntryKind | "all">("all");
  const [q, setQ]                   = useState("");
  const [fromBr, setFromBr]         = useState("");
  const [toBr, setToBr]             = useState("");

  // Modal (criar/editar)
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<FinancialEntry | null>(null);
  const [form, setForm]             = useState<EntryForm>(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState("");

  // Toast inline
  const [toast, setToast]           = useState<string | null>(null);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listEntries(federationId, {
        kind: kindFilter === "all" ? undefined : kindFilter,
        from: parseBrDate(fromBr) || undefined,
        to: parseBrDate(toBr) || undefined,
        pageSize: 500,
      });
      setEntries(res.data);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, kindFilter, fromBr, toBr]);

  useEffect(() => { load(); }, [load]);

  // Handler estável da busca — campo persistente, fora de lista remontável.
  const handleSearch = useCallback((t: string) => setQ(t), []);

  // Filtro de texto client-side (descrição + categoria).
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((e) =>
      (e.description ?? "").toLowerCase().includes(needle) ||
      catLabel(e.category).toLowerCase().includes(needle)
    );
  }, [entries, q]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of filtered) {
      if (e.kind === "income") income += e.amount;
      else expense += e.amount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  // ── Abrir modal ───────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (e: FinancialEntry) => {
    setEditing(e);
    setForm({
      kind: e.kind,
      amount: maskCurrency(String(Math.round(e.amount * 100))),
      category: e.category,
      description: e.description,
      dateBr: formatIsoToBr(e.due_date ? String(e.due_date).slice(0, 10) : ""),
    });
    setFormError("");
    setShowForm(true);
  };

  // Trocar o kind reseta a categoria pro primeiro válido do novo kind.
  const setKind = (kind: EntryKind) => {
    setForm((p) => ({ ...p, kind, category: categoriesFor(kind)[0].key }));
  };

  const handleSave = async () => {
    const cents = parseInt(unmaskNumber(form.amount) || "0", 10);
    const amt = cents / 100;
    if (!amt || amt <= 0) { setFormError("Informe um valor válido."); return; }
    if (!form.description.trim()) { setFormError("Descrição obrigatória."); return; }
    const dueIso = form.dateBr ? parseBrDate(form.dateBr) : null;
    if (form.dateBr && !dueIso) { setFormError("Data inválida. Use dd/mm/aaaa."); return; }
    setFormError("");
    setSaving(true);
    try {
      if (editing) {
        const updated = await karateApi.updateEntry(federationId, editing.id, {
          amount: amt,
          category: form.category,
          description: form.description.trim(),
          due_date: dueIso || undefined,
        });
        setEntries((prev) => prev.map((e) => (e.id === editing.id ? { ...e, ...updated } : e)));
        flash("Lançamento atualizado.");
      } else {
        const body: FinancialEntryInput = {
          kind: form.kind,
          amount: amt,
          category: form.category,
          description: form.description.trim(),
          due_date: dueIso || undefined,
        };
        const created = await karateApi.createEntry(federationId, body);
        setEntries((prev) => [created, ...prev]);
        flash("Lançamento adicionado.");
      }
      setShowForm(false);
      setForm(emptyForm());
      setEditing(null);
    } catch (e: any) {
      setFormError(e?.message ?? "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: FinancialEntry) => {
    const label = e.kind === "income" ? "esta entrada" : "esta saída";
    if (!(await confirmAsync({
      title: "Excluir lançamento?",
      message: `Excluir ${label}?\n\n${e.description} — ${formatCurrency(e.amount)}\nEsta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      destructive: true,
    }))) return;
    karateApi
      .deleteEntry(federationId, e.id)
      .then(() => {
        setEntries((prev) => prev.filter((x) => x.id !== e.id));
        flash("Lançamento excluído.");
      })
      .catch((err: any) => flash(err?.message ?? "Não foi possível excluir."));
  };

  // ── Export CSV (client-side) ──────────────────────────────────
  const handleExport = () => {
    if (filtered.length === 0) { flash("Nada para exportar."); return; }
    const header = ["Tipo", "Categoria", "Descrição", "Data", "Valor"];
    const rows = filtered.map((e) => [
      e.kind === "income" ? "Entrada" : "Saída",
      catLabel(e.category),
      e.description ?? "",
      formatDate(e.due_date),
      (e.kind === "income" ? e.amount : -e.amount).toFixed(2).replace(".", ","),
    ]);
    downloadCsv("lancamentos", header, rows);
    flash("CSV exportado.");
  };

  if (error) return <KarateErrorState onRetry={() => load()} />;

  const cats = categoriesFor(form.kind);

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />
      }
    >
      {/* Resumo */}
      <View style={st.summaryRow}>
        <View style={st.summaryCell}>
          <Text style={st.summaryLabel}>Entradas</Text>
          {!loading && <Text style={[st.summaryValue, { color: KarateColors.ok }]}>+ {formatCurrency(totals.income)}</Text>}
        </View>
        <View style={st.summaryCell}>
          <Text style={st.summaryLabel}>Saídas</Text>
          {!loading && <Text style={[st.summaryValue, { color: KarateColors.danger }]}>− {formatCurrency(totals.expense)}</Text>}
        </View>
        <View style={st.summaryCell}>
          <Text style={st.summaryLabel}>Saldo</Text>
          {!loading && (
            <Text style={[st.summaryValue, { color: totals.net >= 0 ? KarateColors.ok : KarateColors.danger }]}>
              {formatCurrency(totals.net)}
            </Text>
          )}
        </View>
      </View>

      {/* Ações */}
      <View style={st.actionsRow}>
        <KarateButton label="+ Novo lançamento" variant="primary" size="sm" onPress={openCreate} />
        <TouchableOpacity
          style={st.exportBtn}
          onPress={handleExport}
          accessibilityRole="button"
          accessibilityLabel="Exportar CSV"
        >
          <Icon name="download" size={14} color={KarateColors.ink2} />
          <Text style={st.exportLabel}>Exportar</Text>
        </TouchableOpacity>
      </View>

      {/* Busca — bloco persistente (não perde foco). */}
      <SearchField
        value={q}
        onChangeText={handleSearch}
        placeholder="Buscar por descrição ou categoria..."
        style={{ marginTop: 4, marginBottom: 4 }}
      />

      {/* Filtro de tipo */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
      >
        {KIND_FILTER.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[st.filterChip, kindFilter === f.key && st.filterChipActive]}
            onPress={() => setKindFilter(f.key)}
            accessibilityRole="radio"
            accessibilityLabel={f.label}
            accessibilityState={{ checked: kindFilter === f.key }}
          >
            <Text style={[st.filterLabel, kindFilter === f.key && st.filterLabelActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Período */}
      <View style={st.periodRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.periodLabel}>De</Text>
          <DateInput value={fromBr} onChangeText={setFromBr} style={st.periodInput} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.periodLabel}>Até</Text>
          <DateInput value={toBr} onChangeText={setToBr} style={st.periodInput} />
        </View>
        {(fromBr || toBr) ? (
          <TouchableOpacity
            style={st.clearPeriod}
            onPress={() => { setFromBr(""); setToBr(""); }}
            accessibilityRole="button"
            accessibilityLabel="Limpar período"
          >
            <Icon name="x" size={14} color={KarateColors.ink3} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Lista */}
      {loading ? (
        [1, 2, 3].map((k) => <Skeleton key={k} height={68} style={{ marginBottom: 8 }} />)
      ) : filtered.length === 0 ? (
        <KarateEmptyState icon="wallet" title="Nenhum lançamento" />
      ) : (
        filtered.map((e) => {
          const isIncome = e.kind === "income";
          const color = isIncome ? KarateColors.ok : KarateColors.danger;
          const sign = isIncome ? "+" : "−";
          return (
            <View key={e.id} style={st.card}>
              <View style={[st.kindDot, { backgroundColor: color }]} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={st.desc}>{e.description}</Text>
                <Text style={st.meta}>
                  {isIncome ? "Entrada" : "Saída"} · {catLabel(e.category)}
                  {e.due_date ? ` · ${formatDate(e.due_date)}` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={[st.amount, { color }]}>{sign} {formatCurrency(e.amount)}</Text>
                <View style={st.rowActions}>
                  <TouchableOpacity
                    style={st.iconBtn}
                    onPress={() => openEdit(e)}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${e.description}`}
                  >
                    <Icon name="edit" size={15} color={KarateColors.ink2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={st.iconBtn}
                    onPress={() => handleDelete(e)}
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir ${e.description}`}
                  >
                    <Icon name="trash" size={15} color={KarateColors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* Toast inline */}
      {toast ? (
        <View style={st.toast} accessibilityLiveRegion="polite">
          <Text style={st.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* Modal criar/editar — centrado */}
      <Modal
        visible={showForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForm(false)}
        accessibilityViewIsModal
      >
        <View style={st.overlay}>
          <View style={st.sheet}>
            <View style={st.sheetHeader}>
              <Text style={st.sheetTitle}>{editing ? "Editar lançamento" : "Novo lançamento"}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)} accessibilityLabel="Fechar" accessibilityRole="button">
                <Icon name="x" size={20} color={KarateColors.ink3} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={st.formBody} keyboardShouldPersistTaps="handled">
              {/* Tipo (kind) — bloqueado na edição (kind não muda) */}
              <Text style={st.fieldLabel}>Tipo</Text>
              <View style={st.kindRow}>
                {(["expense", "income"] as EntryKind[]).map((k) => {
                  const active = form.kind === k;
                  const isInc = k === "income";
                  return (
                    <TouchableOpacity
                      key={k}
                      disabled={!!editing}
                      style={[
                        st.kindChip,
                        active && (isInc ? st.kindChipIncome : st.kindChipExpense),
                        !!editing && !active && { opacity: 0.4 },
                      ]}
                      onPress={() => setKind(k)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active, disabled: !!editing }}
                      accessibilityLabel={isInc ? "Entrada" : "Saída"}
                    >
                      <Icon
                        name={isInc ? "trending_up" : "trending_down"}
                        size={15}
                        color={active ? (isInc ? KarateColors.ok : KarateColors.danger) : KarateColors.ink3}
                      />
                      <Text
                        style={[
                          st.kindChipLabel,
                          active && { color: isInc ? KarateColors.ok : KarateColors.danger, fontWeight: "800" },
                        ]}
                      >
                        {isInc ? "Entrada" : "Saída"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Valor */}
              <Text style={[st.fieldLabel, { marginTop: 12 }]}>Valor (R$)</Text>
              <TextInput
                style={st.fieldInput}
                value={form.amount}
                onChangeText={(v) => setForm((p) => ({ ...p, amount: maskCurrency(v) }))}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={KarateColors.ink4}
                accessibilityLabel="Valor"
              />

              {/* Categoria */}
              <Text style={[st.fieldLabel, { marginTop: 12 }]}>Categoria</Text>
              <View style={st.catRow}>
                {cats.map((c) => (
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
                placeholder={form.kind === "income" ? "Ex.: Patrocínio campeonato..." : "Ex.: Troféus campeonato..."}
                placeholderTextColor={KarateColors.ink4}
                accessibilityLabel="Descrição"
              />

              {/* Data */}
              <Text style={[st.fieldLabel, { marginTop: 12 }]}>Data (opcional)</Text>
              <DateInput
                value={form.dateBr}
                onChangeText={(v) => setForm((p) => ({ ...p, dateBr: v }))}
                style={st.fieldInput}
              />

              {formError ? <Text style={st.formError}>{formError}</Text> : null}
              <KarateButton
                label={editing ? "Salvar alterações" : "Adicionar lançamento"}
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

// ── CSV helper (Blob/anchor, web) ───────────────────────────────
function csvCell(v: string): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(baseName: string, header: string[], rows: string[][]) {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(";"));
  const csv = "﻿" + lines.join("\r\n"); // BOM p/ Excel PT-BR
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${baseName}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const st = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:      { padding: 16, gap: 8, paddingBottom: 40 } as ViewStyle,

  summaryRow:   { flexDirection: "row", gap: 8, marginBottom: 4 } as ViewStyle,
  summaryCell:  { flex: 1, backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 10, gap: 4 } as ViewStyle,
  summaryLabel: { fontSize: 10, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.6 } as TextStyle,
  summaryValue: { fontFamily: KarateFonts.mono, fontSize: 15, fontWeight: "800" } as TextStyle,

  actionsRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 4 } as ViewStyle,
  exportBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  exportLabel:  { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,

  filterChip:        { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  filterChipActive:  { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  filterLabel:       { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  filterLabelActive: { color: KarateColors.primary, fontWeight: "800" } as TextStyle,

  periodRow:    { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 2, marginBottom: 6 } as ViewStyle,
  periodLabel:  { fontSize: 11, fontWeight: "700", color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  periodInput:  { backgroundColor: "#fff", borderColor: KarateColors.border } as TextStyle,
  clearPeriod:  { padding: 10 } as ViewStyle,

  card:         { flexDirection: "row", backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 10, alignItems: "center" } as ViewStyle,
  kindDot:      { width: 6, alignSelf: "stretch", borderRadius: 3 } as ViewStyle,
  desc:         { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta:         { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  amount:       { fontFamily: KarateFonts.mono, fontSize: 15, fontWeight: "800" } as TextStyle,
  rowActions:   { flexDirection: "row", gap: 4 } as ViewStyle,
  iconBtn:      { padding: 4 } as ViewStyle,

  toast:        { backgroundColor: KarateColors.ink, borderRadius: KarateRadius.md, paddingVertical: 10, paddingHorizontal: 14, marginTop: 8 } as ViewStyle,
  toastText:    { color: "#fdf8f2", fontSize: 13, fontWeight: "600", textAlign: "center" } as TextStyle,

  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 20 } as ViewStyle,
  sheet:        { backgroundColor: KarateColors.bg, borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "90%" as any } as ViewStyle,
  sheetHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  sheetTitle:   { fontSize: 17, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  formBody:     { padding: 20, gap: 4, paddingBottom: 40 } as ViewStyle,
  fieldLabel:   { fontSize: 12, fontWeight: "700", color: KarateColors.ink3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 } as TextStyle,
  fieldInput:   { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: KarateColors.ink, backgroundColor: "#fff" } as TextStyle,

  kindRow:      { flexDirection: "row", gap: 8 } as ViewStyle,
  kindChip:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: KarateRadius.md, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  kindChipExpense: { backgroundColor: KarateColors.dangerSoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  kindChipIncome:  { backgroundColor: KarateColors.okSoft, borderColor: KarateColors.okLine } as ViewStyle,
  kindChipLabel:   { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,

  catRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  catChip:      { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  catChipActive:{ backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  catLabel:     { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  catLabelActive:{ color: KarateColors.primary, fontWeight: "800" } as TextStyle,
  formError:    { fontSize: 12, color: KarateColors.danger, marginTop: 8 } as TextStyle,
});
