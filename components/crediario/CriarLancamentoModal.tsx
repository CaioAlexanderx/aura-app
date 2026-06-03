// ============================================================
// AURA. — CriarLancamentoModal
// Modal 2 etapas: seleção de cliente + detalhes do lançamento.
// Usado na tela de Crediário para criar débitos manuais sem venda.
// ============================================================
import { useState, useCallback, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditApi, type ManualEntryPayload } from "@/services/creditApi";
import { toast } from "@/components/Toast";

type Step = "customer" | "details";
type Mode = "search" | "create";

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

function fmtCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInput(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

function fmtPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function fmtDate(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function parseDateInput(v: string): string | undefined {
  const d = v.replace(/\D/g, "");
  if (d.length < 8) return undefined;
  return `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function CriarLancamentoModal({ visible, onClose }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  const [step, setStep]               = useState<Step>("customer");
  const [mode, setMode]               = useState<Mode>("search");
  const [loading, setLoading]         = useState(false);

  // Customer search
  const [searchQ, setSearchQ]               = useState("");
  const [searching, setSearching]           = useState(false);
  const [searchResults, setSearchResults]   = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New customer fields
  const [newName, setNewName]   = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Entry details
  const [amountRaw, setAmountRaw]     = useState("");
  const [installments, setInstallments] = useState("1");
  const [interestRate, setInterestRate] = useState("");
  const [firstDueDate, setFirstDueDate] = useState(defaultDueDate());
  const [description, setDescription]   = useState("");

  const reset = useCallback(() => {
    setStep("customer");
    setMode("search");
    setSearchQ("");
    setSearchResults([]);
    setSelectedCustomer(null);
    setNewName("");
    setNewPhone("");
    setAmountRaw("");
    setInstallments("1");
    setInterestRate("");
    setFirstDueDate(defaultDueDate());
    setDescription("");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ── Customer search ──────────────────────────────────────────────
  const handleSearch = useCallback(
    (q: string) => {
      setSearchQ(q);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (q.length < 2) {
        setSearchResults([]);
        return;
      }
      searchTimer.current = setTimeout(async () => {
        setSearching(true);
        try {
          const data = await creditApi.searchCustomers(company!.id, q);
          setSearchResults(data.customers || []);
        } catch {
          /* silent */
        } finally {
          setSearching(false);
        }
      }, 350);
    },
    [company]
  );

  const handleSelectCustomer = (c: CustomerOption) => {
    setSelectedCustomer(c);
    setStep("details");
  };

  const handleConfirmNewCustomer = () => {
    if (!newName.trim())  { toast.error("Nome obrigatório"); return; }
    if (!newPhone.trim()) { toast.error("Telefone obrigatório"); return; }
    setStep("details");
  };

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const amountNum = parseCurrencyInput(amountRaw);
    if (!amountNum || amountNum <= 0) { toast.error("Valor inválido"); return; }

    const n = parseInt(installments, 10) || 1;
    if (n < 1 || n > 36) { toast.error("Parcelas: 1 a 36"); return; }

    const firstDue = parseDateInput(firstDueDate);
    if (firstDueDate && !firstDue) { toast.error("Data inválida — use DD/MM/AAAA"); return; }

    let rate: number | undefined;
    if (interestRate.trim()) {
      rate = parseFloat(interestRate.replace(",", ".")) / 100;
      if (isNaN(rate) || rate < 0) { toast.error("Taxa de juros inválida"); return; }
    }

    const payload: ManualEntryPayload = {
      customer_id:   selectedCustomer?.id,
      new_customer:  !selectedCustomer
        ? { name: newName.trim(), phone: newPhone.replace(/\D/g, "") }
        : undefined,
      amount:        amountNum,
      installments:  n,
      interest_rate: rate,
      first_due_date: firstDue,
      description:   description.trim() || undefined,
    };

    setLoading(true);
    try {
      await creditApi.createManualEntry(company!.id, payload);
      toast.success("Lançamento criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["credit-balances",   company!.id] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard",  company!.id] });
      qc.invalidateQueries({ queryKey: ["credit-aging",      company!.id] });
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar lançamento");
    } finally {
      setLoading(false);
    }
  };

  // ── Preview de parcelas ──────────────────────────────────────────
  const amountNum  = parseCurrencyInput(amountRaw);
  const nParcelas  = Math.max(1, parseInt(installments, 10) || 1);
  const rateNum    = interestRate.trim()
    ? parseFloat(interestRate.replace(",", ".")) / 100
    : 0;
  const totalComJuros =
    rateNum > 0
      ? parseFloat((amountNum * (1 + rateNum * nParcelas)).toFixed(2))
      : amountNum;
  const valorParcela = amountNum > 0 ? totalComJuros / nParcelas : 0;

  // ── Render ───────────────────────────────────────────────────────
  const customerLabel = selectedCustomer
    ? selectedCustomer.name
    : mode === "create"
    ? newName || "Novo cliente"
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={s.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.kvWrapper}
        >
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            {/* ── Header ── */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.headerIcon}>
                  <Icon name="percent" size={16} color={Colors.violet3} />
                </View>
                <View>
                  <Text style={s.headerTitle}>Novo lançamento</Text>
                  <Text style={s.headerSub}>
                    {step === "customer" ? "Selecione o cliente" : "Informe os valores"}
                  </Text>
                </View>
              </View>
              <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={8}>
                <Icon name="x" size={18} color={Colors.ink3} />
              </Pressable>
            </View>

            {/* ── Steps indicator ── */}
            <View style={s.stepsRow}>
              <View style={[s.stepDot, step === "customer" && s.stepDotActive]} />
              <View style={s.stepLine} />
              <View style={[s.stepDot, step === "details" && s.stepDotActive]} />
            </View>

            {/* ══════════════════════════════════════════════════════ */}
            {/* STEP 1 — Cliente                                       */}
            {/* ══════════════════════════════════════════════════════ */}
            {step === "customer" && mode === "search" && (
              <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
                <Text style={s.label}>Buscar cliente</Text>
                <View style={s.searchRow}>
                  <Icon name="search" size={15} color={Colors.ink3} />
                  <TextInput
                    style={s.searchInput}
                    placeholder="Nome ou telefone..."
                    placeholderTextColor={Colors.ink3}
                    value={searchQ}
                    onChangeText={handleSearch}
                    autoFocus
                  />
                  {searching && (
                    <ActivityIndicator size="small" color={Colors.violet3} />
                  )}
                </View>

                {searchResults.map((c) => (
                  <Pressable
                    key={c.id}
                    style={({ pressed }) => [s.resultRow, pressed && s.pressed]}
                    onPress={() => handleSelectCustomer(c)}
                  >
                    <View style={s.resultAvatar}>
                      <Text style={s.resultAvatarText}>
                        {c.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultName}>{c.name}</Text>
                      {c.phone ? (
                        <Text style={s.resultPhone}>{c.phone}</Text>
                      ) : null}
                    </View>
                    <Icon name="chevron-right" size={14} color={Colors.ink3} />
                  </Pressable>
                ))}

                {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
                  <Text style={s.emptySearch}>Nenhum cliente encontrado</Text>
                )}

                <Pressable
                  style={({ pressed }) => [s.newCustBtn, pressed && s.pressed]}
                  onPress={() => setMode("create")}
                >
                  <Icon name="user-plus" size={15} color={Colors.violet3} />
                  <Text style={s.newCustText}>Cadastrar novo cliente</Text>
                </Pressable>
              </ScrollView>
            )}

            {step === "customer" && mode === "create" && (
              <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
                <Pressable
                  style={s.backLink}
                  onPress={() => setMode("search")}
                >
                  <Icon name="arrow-left" size={14} color={Colors.violet3} />
                  <Text style={s.backLinkText}>Voltar para busca</Text>
                </Pressable>

                <Text style={s.label}>Nome *</Text>
                <TextInput
                  style={s.input}
                  placeholder="Nome completo"
                  placeholderTextColor={Colors.ink3}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />

                <Text style={[s.label, { marginTop: 14 }]}>Telefone *</Text>
                <TextInput
                  style={s.input}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor={Colors.ink3}
                  value={newPhone}
                  onChangeText={(v) => setNewPhone(fmtPhone(v))}
                  keyboardType="phone-pad"
                />

                <Pressable
                  style={({ pressed }) => [s.nextBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleConfirmNewCustomer}
                >
                  <Text style={s.nextBtnText}>Continuar</Text>
                  <Icon name="arrow-right" size={15} color="#fff" />
                </Pressable>
              </ScrollView>
            )}

            {/* ══════════════════════════════════════════════════════ */}
            {/* STEP 2 — Detalhes                                      */}
            {/* ══════════════════════════════════════════════════════ */}
            {step === "details" && (
              <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
                {/* Cliente selecionado */}
                {customerLabel && (
                  <View style={s.customerChip}>
                    <Icon name="user" size={13} color={Colors.violet3} />
                    <Text style={s.customerChipText} numberOfLines={1}>
                      {customerLabel}
                    </Text>
                    <Pressable
                      onPress={() => { setSelectedCustomer(null); setStep("customer"); }}
                      hitSlop={8}
                    >
                      <Icon name="x" size={12} color={Colors.ink3} />
                    </Pressable>
                  </View>
                )}

                <Text style={s.label}>Valor total *</Text>
                <View style={s.amountRow}>
                  <Text style={s.amountPrefix}>R$</Text>
                  <TextInput
                    style={s.amountInput}
                    placeholder="0,00"
                    placeholderTextColor={Colors.ink3}
                    value={amountRaw}
                    onChangeText={(v) => {
                      const digits = v.replace(/\D/g, "");
                      setAmountRaw(digits ? fmtCurrency(digits) : "");
                    }}
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Parcelas</Text>
                    <TextInput
                      style={s.input}
                      placeholder="1"
                      placeholderTextColor={Colors.ink3}
                      value={installments}
                      onChangeText={(v) => {
                        const n = v.replace(/\D/g, "").slice(0, 2);
                        setInstallments(n);
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>1º vencimento</Text>
                    <TextInput
                      style={s.input}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor={Colors.ink3}
                      value={firstDueDate}
                      onChangeText={(v) => setFirstDueDate(fmtDate(v))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={s.label}>
                  Juros ao mês %{" "}
                  <Text style={s.labelOptional}>(opcional)</Text>
                </Text>
                <TextInput
                  style={s.input}
                  placeholder="Ex: 2,5"
                  placeholderTextColor={Colors.ink3}
                  value={interestRate}
                  onChangeText={setInterestRate}
                  keyboardType="decimal-pad"
                />

                <Text style={[s.label, { marginTop: 14 }]}>
                  Descrição{" "}
                  <Text style={s.labelOptional}>(opcional)</Text>
                </Text>
                <TextInput
                  style={[s.input, { minHeight: 60, textAlignVertical: "top" }]}
                  placeholder="Ex: Mercadoria de novembro"
                  placeholderTextColor={Colors.ink3}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />

                {/* Preview de parcelas */}
                {amountNum > 0 && (
                  <View style={s.previewBox}>
                    <Text style={s.previewTitle}>Resumo</Text>
                    <View style={s.previewRow}>
                      <Text style={s.previewLabel}>Total com juros</Text>
                      <Text style={s.previewValue}>
                        R${" "}
                        {totalComJuros.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                    <View style={s.previewRow}>
                      <Text style={s.previewLabel}>Valor por parcela</Text>
                      <Text style={[s.previewValue, { color: Colors.violet3 }]}>
                        R${" "}
                        {valorParcela.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        × {nParcelas}x
                      </Text>
                    </View>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    s.submitBtn,
                    pressed && { opacity: 0.85 },
                    loading && { opacity: 0.6 },
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="check" size={16} color="#fff" />
                      <Text style={s.submitBtnText}>Criar lançamento</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  kvWrapper: {
    width: "100%",
    maxWidth: 480,
  },
  sheet: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    overflow: "hidden",
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: Colors.border2,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border2,
    backgroundColor: Colors.bg3,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.violetD,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  headerSub:   { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.bg2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 0,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border2,
  },
  stepDotActive: { backgroundColor: Colors.violet3 },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border2, marginHorizontal: 6 },
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 6, marginTop: 14 },
  labelOptional: { fontWeight: "400", color: Colors.ink3 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.ink,
    backgroundColor: Colors.bg2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    backgroundColor: Colors.bg2,
    marginTop: 6,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border2,
    gap: 12,
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.violetD,
    alignItems: "center",
    justifyContent: "center",
  },
  resultAvatarText: { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  resultName:       { fontSize: 14, fontWeight: "600", color: Colors.ink },
  resultPhone:      { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  emptySearch:      { fontSize: 13, color: Colors.ink3, textAlign: "center", marginVertical: 16 },
  newCustBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.violet3,
    borderStyle: "dashed",
  },
  newCustText:  { fontSize: 14, fontWeight: "600", color: Colors.violet3 },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    marginBottom: 4,
  },
  backLinkText: { fontSize: 13, color: Colors.violet3 },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    backgroundColor: Colors.violet3,
    borderRadius: 12,
    paddingVertical: 14,
  },
  nextBtnText:    { fontSize: 15, fontWeight: "700", color: "#fff" },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.bg2,
    gap: 8,
  },
  amountPrefix: { fontSize: 15, fontWeight: "600", color: Colors.ink3 },
  amountInput:  { flex: 1, paddingVertical: 11, fontSize: 18, fontWeight: "700", color: Colors.ink },
  row2: { flexDirection: "row", gap: 12 },
  customerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.violetD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  customerChipText: { fontSize: 13, fontWeight: "600", color: Colors.violet3, flex: 1 },
  previewBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: Colors.bg3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border2,
    gap: 8,
  },
  previewTitle: { fontSize: 11, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  previewRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewLabel: { fontSize: 13, color: Colors.ink2 },
  previewValue: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: Colors.violet3,
    borderRadius: 12,
    paddingVertical: 15,
  },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  pressed:  { opacity: 0.7 },
});
