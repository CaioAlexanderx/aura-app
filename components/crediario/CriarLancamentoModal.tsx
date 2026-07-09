// ============================================================
// AURA. — CriarLancamentoModal
// Modal 2 etapas: seleção de cliente + detalhes do lançamento.
//
// 05/06/2026: data retroativa + periodicidade.
// F3 (05/06/2026): seletor de carnê na etapa de detalhes.
//   - "Conta geral" (default) — sem account_id
//   - escolher carnê existente — envia account_id
//   - "Novo carnê" — campo de nome, envia new_account_name
//
// feat(unify) (13/06/2026): quando accountMode=="existing" e o carnê
// escolhido tiver parcelas abertas, aparece um toggle "Unificar parcelas".
// Quando ligado:
//   - Exibe nº de parcelas + 1ª data para o cronograma unificado.
//   - Mostra preview (previewUnify) antes de confirmar.
//   - No submit: createManualEntry com installments=1 (só débito),
//     em seguida applyUnify com o cronograma escolhido.
//   - O caminho SEM unify permanece INTACTO.
//
// Os carnês são buscados do backend após a seleção do cliente
// (via creditApi.getCustomerHistory), não dependem de prop.
// ============================================================
import { useState, useCallback, useRef, useEffect } from "react";
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
import { creditApi, type ManualEntryPayload, type PeriodUnit, type CreditAccount, type UnifyPlan } from "@/services/creditApi";
import { toast } from "@/components/Toast";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { ModalPop, Collapsible } from "@/components/anim";

// ============================================================
// F4 do redesign (08/07/2026 — spec §2.4): o passo 2 deixou de ser
// um formulário monolítico de 10+ blocos e virou 3 grupos:
//   ESSENCIAL — valor · parcelas · 1º vencimento (sempre visível)
//   CARNÊ     — disclosure; fechado mostra só o resumo ("Conta geral")
//   AVANÇADO  — disclosure; data retroativa, periodicidade, juros,
//               descrição e unificação moram aqui
// Resumo + CTA agora são FIXOS no rodapé do sheet (não rolam).
// Entrada via ModalPop. Nenhuma lógica de submit/unify mudou.
// ============================================================

type Step = "customer" | "details";
type Mode = "search" | "create";
type PeriodKind = "semanal" | "quinzenal" | "mensal" | "custom";
type AccountMode = "general" | "existing" | "new";

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

function defaultDueDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function todayBrSp(): string {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return formatIsoToBr(iso);
}

function periodToPayload(kind: PeriodKind, customDays: string): { period_unit: PeriodUnit; period_count: number } {
  if (kind === "semanal")   return { period_unit: "week", period_count: 1 };
  if (kind === "quinzenal") return { period_unit: "week", period_count: 2 };
  if (kind === "custom")    return { period_unit: "day", period_count: Math.max(1, parseInt(customDays, 10) || 1) };
  return { period_unit: "month", period_count: 1 };
}

function fmtCur(n: number) {
  return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateSafe(input: string | null | undefined): string {
  if (!input) return "—";
  try {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch { return "—"; }
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
  const [entryDate, setEntryDate]       = useState(todayBrSp());
  const [periodKind, setPeriodKind]     = useState<PeriodKind>("mensal");
  const [periodDays, setPeriodDays]     = useState("20");
  const [description, setDescription]   = useState("");

  // F3: seletor de carnê
  const [accountMode, setAccountMode]             = useState<AccountMode>("general");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [newAccountName, setNewAccountName]       = useState("");
  const [fetchedAccounts, setFetchedAccounts]     = useState<CreditAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts]     = useState(false);

  // F4: disclosures dos grupos Carnê e Avançado
  const [carneOpen, setCarneOpen] = useState(false);
  const [advOpen, setAdvOpen]     = useState(false);

  // feat(unify): toggle de unificação (só disponível em accountMode=existing com saldo)
  const [unifyEnabled, setUnifyEnabled]           = useState(false);
  const [unifyInstallments, setUnifyInstallments] = useState("2");
  const [unifyFirstDue, setUnifyFirstDue]         = useState(defaultDueDate());
  const [unifyPreview, setUnifyPreview]           = useState<UnifyPlan | null>(null);
  const [unifyPreviewLoading, setUnifyPreviewLoading] = useState(false);
  const [unifyPreviewError, setUnifyPreviewError]     = useState<string | null>(null);

  const unifyFirstDueIso = parseBrDate(unifyFirstDue);

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
    setEntryDate(todayBrSp());
    setPeriodKind("mensal");
    setPeriodDays("20");
    setDescription("");
    setAccountMode("general");
    setSelectedAccountId(null);
    setNewAccountName("");
    setFetchedAccounts([]);
    setCarneOpen(false);
    setAdvOpen(false);
    setUnifyEnabled(false);
    setUnifyInstallments("2");
    setUnifyFirstDue(defaultDueDate());
    setUnifyPreview(null);
    setUnifyPreviewError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

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

  const fetchAccountsForCustomer = useCallback(async (customerId: string) => {
    if (!company?.id) return;
    setLoadingAccounts(true);
    try {
      const data = await creditApi.getCustomerHistory(company.id, customerId);
      setFetchedAccounts(data.accounts || []);
    } catch {
      setFetchedAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, [company]);

  const handleSelectCustomer = (c: CustomerOption) => {
    setSelectedCustomer(c);
    setStep("details");
    fetchAccountsForCustomer(c.id);
  };

  const handleConfirmNewCustomer = () => {
    if (!newName.trim())  { toast.error("Nome obrigatório"); return; }
    if (!newPhone.trim()) { toast.error("Telefone obrigatório"); return; }
    setFetchedAccounts([]);
    setStep("details");
  };

  // Carnê selecionado (para unify)
  const selectableAccounts = fetchedAccounts.filter(a => a.id !== null && a.status === "open");
  const selectedAccount = selectableAccounts.find(a => a.id === selectedAccountId) || null;
  const canUnify = accountMode === "existing" && !!selectedAccount && (selectedAccount.open_count || 0) > 0;

  // Carregar preview de unify quando os parâmetros mudam
  useEffect(() => {
    if (!unifyEnabled || !canUnify || !selectedAccountId || !unifyFirstDueIso) {
      setUnifyPreview(null);
      return;
    }
    const amountNum = parseCurrencyInput(amountRaw);
    const n = parseInt(unifyInstallments, 10) || 1;
    if (amountNum <= 0 || n < 1) { setUnifyPreview(null); return; }
    if (!company?.id || !selectedCustomer?.id) return;

    let cancelled = false;
    setUnifyPreviewLoading(true);
    setUnifyPreviewError(null);
    creditApi.previewUnify(company.id, selectedCustomer.id, selectedAccountId, {
      amount: amountNum,
      installments: n,
      first_due_date: unifyFirstDueIso,
    }).then(plan => {
      if (!cancelled) { setUnifyPreview(plan); setUnifyPreviewLoading(false); }
    }).catch((err: any) => {
      if (!cancelled) {
        setUnifyPreviewError(err?.message || "Erro ao calcular unificação");
        setUnifyPreview(null);
        setUnifyPreviewLoading(false);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unifyEnabled, selectedAccountId, unifyInstallments, unifyFirstDueIso, amountRaw, company?.id, selectedCustomer?.id, canUnify]);

  // Desliga unify se trocar de modo
  useEffect(() => {
    if (accountMode !== "existing") setUnifyEnabled(false);
  }, [accountMode]);

  const handleSubmit = async () => {
    const amountNum = parseCurrencyInput(amountRaw);
    if (!amountNum || amountNum <= 0) { toast.error("Valor inválido"); return; }

    const period = periodToPayload(periodKind, periodDays);
    const firstDue = parseBrDate(firstDueDate) || undefined;
    if (firstDueDate && !firstDue) { toast.error("Data inválida — use dd/mm/aaaa"); return; }

    const entryIso = parseBrDate(entryDate) || undefined;
    if (entryDate && entryDate.length === 10 && !entryIso) {
      toast.error("Data do lançamento inválida — use dd/mm/aaaa");
      return;
    }

    if (accountMode === "new" && !newAccountName.trim()) {
      toast.error("Informe o nome do novo carnê");
      return;
    }
    if (accountMode === "existing" && !selectedAccountId) {
      toast.error("Selecione um carnê");
      return;
    }

    // Valida unify
    if (unifyEnabled) {
      if (!unifyFirstDueIso) { toast.error("Informe a data da 1ª parcela unificada"); return; }
      const uN = parseInt(unifyInstallments, 10) || 0;
      if (uN < 1) { toast.error("Número de parcelas inválido"); return; }
      if (!unifyPreview) { toast.error("Aguarde o cálculo do preview"); return; }
    }

    let rate: number | undefined;
    if (interestRate.trim()) {
      rate = parseFloat(interestRate.replace(",", ".")) / 100;
      if (isNaN(rate) || rate < 0) { toast.error("Taxa de juros inválida"); return; }
    }

    // Quando unify ativo: lança com installments=1 (débito puro)
    const nInstallments = unifyEnabled ? 1 : (parseInt(installments, 10) || 1);
    if (!unifyEnabled && (nInstallments < 1 || nInstallments > 36)) {
      toast.error("Parcelas: 1 a 36"); return;
    }

    const payload: ManualEntryPayload = {
      customer_id:   selectedCustomer?.id,
      new_customer:  !selectedCustomer
        ? { name: newName.trim(), phone: newPhone.replace(/\D/g, "") }
        : undefined,
      amount:        amountNum,
      installments:  nInstallments,
      interest_rate: rate,
      first_due_date: firstDue,
      entry_date:    entryIso,
      period_unit:   period.period_unit,
      period_count:  period.period_count,
      description:   description.trim() || undefined,
      account_id:       accountMode === "existing" ? selectedAccountId : undefined,
      new_account_name: accountMode === "new" ? newAccountName.trim() : undefined,
    };

    setLoading(true);
    try {
      const result = await creditApi.createManualEntry(company!.id, payload);

      // feat(unify): se unify ativo, aplicar o cronograma unificado
      if (unifyEnabled && selectedAccountId && unifyFirstDueIso && selectedCustomer?.id) {
        const uN = parseInt(unifyInstallments, 10) || 1;
        try {
          await creditApi.applyUnify(company!.id, selectedCustomer.id, selectedAccountId, {
            amount: amountNum,
            installments: uN,
            first_due_date: unifyFirstDueIso,
            // sale_id não disponível no lançamento manual (ManualEntryResult não exposes sale_id)
          });
          toast.success("Lançamento criado e carnê unificado!");
        } catch (unifyErr: any) {
          // O débito já foi criado — informamos o erro do unify separadamente.
          toast.error(
            "Lançamento criado, mas a unificação falhou: " +
            (unifyErr?.message || "erro desconhecido") +
            ". Unifique manualmente na ficha do cliente."
          );
        }
      } else {
        toast.success("Lançamento criado com sucesso!");
      }

      qc.invalidateQueries({ queryKey: ["credit-balances",   company!.id] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard",  company!.id] });
      qc.invalidateQueries({ queryKey: ["credit-aging",      company!.id] });
      if (selectedCustomer?.id) {
        qc.invalidateQueries({ queryKey: ["credit-customer", company!.id, selectedCustomer.id] });
      }
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar lançamento");
    } finally {
      setLoading(false);
    }
  };

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

  const customerLabel = selectedCustomer
    ? selectedCustomer.name
    : mode === "create"
    ? newName || "Novo cliente"
    : null;

  const PERIOD_CHIPS: Array<[PeriodKind, string]> = [
    ["semanal", "Semanal"], ["quinzenal", "Quinzenal"], ["mensal", "Mensal"], ["custom", "Personalizado"],
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={s.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.kvWrapper}
        >
          <ModalPop visible={visible}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
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

            {/* Steps indicator */}
            <View style={s.stepsRow}>
              <View style={[s.stepDot, step === "customer" && s.stepDotActive]} />
              <View style={s.stepLine} />
              <View style={[s.stepDot, step === "details" && s.stepDotActive]} />
            </View>

            {/* STEP 1 — Cliente busca */}
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

            {/* STEP 1 — Cliente criar */}
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

            {/* STEP 2 — Detalhes (F4: Essencial / Carnê / Avançado + footer fixo) */}
            {step === "details" && (
              <>
              <ScrollView style={[s.body, { flexGrow: 0, flexShrink: 1 }]} keyboardShouldPersistTaps="handled">
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

                {/* ── ESSENCIAL ── */}
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

                {!unifyEnabled && (
                  <View style={[s.row2, { marginTop: 2 }]}>
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
                      <DateInput
                        style={s.input}
                        value={firstDueDate}
                        onChangeText={setFirstDueDate}
                        placeholder="dd/mm/aaaa"
                      />
                    </View>
                  </View>
                )}

                {/* ── CARNÊ (disclosure — fechado mostra só o resumo) ── */}
                <Pressable
                  style={s.groupHead}
                  onPress={() => setCarneOpen(v => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={`Carnê: ${accountMode === "general" ? "Conta geral" : accountMode === "existing" ? (selectedAccount?.name || "escolher carnê") : (newAccountName || "novo carnê")}. Toque para ${carneOpen ? "recolher" : "alterar"}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.groupTitle}>Carnê / conta</Text>
                    <Text style={s.groupSummary} numberOfLines={1}>
                      {accountMode === "general"
                        ? "Conta geral (padrão)"
                        : accountMode === "existing"
                          ? (selectedAccount?.name || "escolher carnê…") + (unifyEnabled ? " · unificar parcelas" : "")
                          : (newAccountName ? `Novo: ${newAccountName}` : "novo carnê…")}
                    </Text>
                  </View>
                  <View style={carneOpen ? { transform: [{ rotate: "180deg" }] } : undefined}>
                    <Icon name="chevron-down" size={14} color={carneOpen ? Colors.violet3 : Colors.ink3} />
                  </View>
                </Pressable>
                <Collapsible open={carneOpen}>
                {loadingAccounts ? (
                  <ActivityIndicator size="small" color={Colors.violet3} style={{ marginBottom: 8 }} />
                ) : (
                  <>
                    <View style={s.accountModeRow}>
                      {([
                        ["general", "Conta geral"],
                        ["existing", "Carnê existente"],
                        ["new", "Novo carnê"],
                      ] as [AccountMode, string][]).map(([k, lbl]) => (
                        <Pressable
                          key={k}
                          onPress={() => setAccountMode(k)}
                          style={[s.accountModeChip, accountMode === k && s.accountModeChipOn]}
                        >
                          <Text style={[s.accountModeChipTxt, accountMode === k && s.accountModeChipTxtOn]}>
                            {lbl}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {accountMode === "existing" && (
                      selectableAccounts.length === 0 ? (
                        <Text style={s.accountHint}>Nenhum carnê aberto. Escolha "Novo carnê" para criar.</Text>
                      ) : (
                        <View style={s.accountList}>
                          {selectableAccounts.map(acc => (
                            <Pressable
                              key={acc.id}
                              style={[s.accountRow, selectedAccountId === acc.id && s.accountRowOn]}
                              onPress={() => setSelectedAccountId(acc.id)}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={[s.accountRowName, selectedAccountId === acc.id && { color: Colors.violet3 }]}>
                                  {acc.name}
                                </Text>
                                <Text style={s.accountRowSub}>
                                  Saldo: R$ {(acc.balance || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  {acc.overdue ? " · Em atraso" : ""}
                                </Text>
                              </View>
                              {selectedAccountId === acc.id && (
                                <Icon name="check" size={14} color={Colors.violet3} />
                              )}
                            </Pressable>
                          ))}
                        </View>
                      )
                    )}

                    {/* feat(unify): toggle Unificar parcelas */}
                    {canUnify && (
                      <View style={s.unifyCard}>
                        <View style={s.unifyToggleRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.unifyToggleTitle}>Unificar parcelas</Text>
                            <Text style={s.unifyToggleSub}>
                              Soma o saldo aberto + este lançamento e redivide em um novo cronograma
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => setUnifyEnabled(v => !v)}
                            style={[s.toggleSwitch, unifyEnabled && s.toggleSwitchOn]}
                          >
                            <View style={[s.toggleThumb, unifyEnabled && s.toggleThumbOn]} />
                          </Pressable>
                        </View>

                        {unifyEnabled && (
                          <>
                            <Text style={[s.label, { marginTop: 10 }]}>Nº de parcelas unificadas</Text>
                            <TextInput
                              style={s.input}
                              placeholder="2"
                              placeholderTextColor={Colors.ink3}
                              value={unifyInstallments}
                              onChangeText={(v) => setUnifyInstallments(v.replace(/\D/g, "").slice(0, 2))}
                              keyboardType="numeric"
                            />

                            <Text style={[s.label, { marginTop: 10 }]}>1ª parcela unificada</Text>
                            <DateInput
                              style={s.input}
                              value={unifyFirstDue}
                              onChangeText={setUnifyFirstDue}
                              placeholder="dd/mm/aaaa"
                            />

                            {/* Preview */}
                            {unifyPreviewLoading && (
                              <ActivityIndicator size="small" color={Colors.violet3} style={{ marginTop: 10 }} />
                            )}
                            {unifyPreviewError && (
                              <Text style={[s.dateHint, { color: Colors.red, marginTop: 6 }]}>
                                {unifyPreviewError}
                              </Text>
                            )}
                            {unifyPreview && !unifyPreviewLoading && (
                              <View style={s.unifyPreviewBox}>
                                <Text style={s.unifyPreviewTitle}>PRÉVIA DO CRONOGRAMA UNIFICADO</Text>
                                <View style={s.unifyPreviewRow}>
                                  <Text style={s.unifyPreviewLabel}>Saldo em aberto</Text>
                                  <Text style={s.unifyPreviewValue}>{fmtCur(unifyPreview.open_remaining)}</Text>
                                </View>
                                <View style={s.unifyPreviewRow}>
                                  <Text style={s.unifyPreviewLabel}>Novo lançamento</Text>
                                  <Text style={s.unifyPreviewValue}>{fmtCur(unifyPreview.new_amount)}</Text>
                                </View>
                                {unifyPreview.interest_added > 0 && (
                                  <View style={s.unifyPreviewRow}>
                                    <Text style={s.unifyPreviewLabel}>Juros</Text>
                                    <Text style={[s.unifyPreviewValue, { color: Colors.amber }]}>
                                      {fmtCur(unifyPreview.interest_added)}
                                    </Text>
                                  </View>
                                )}
                                <View style={[s.unifyPreviewRow, s.unifyPreviewTotal]}>
                                  <Text style={[s.unifyPreviewLabel, { fontWeight: "800" }]}>Total</Text>
                                  <Text style={[s.unifyPreviewValue, { color: Colors.green }]}>
                                    {fmtCur(unifyPreview.total)}
                                  </Text>
                                </View>
                                {unifyPreview.schedule.map(sl => (
                                  <View key={sl.number} style={s.unifyPreviewRow}>
                                    <Text style={s.unifyPreviewLabel}>{sl.number}ª parcela</Text>
                                    <Text style={s.unifyPreviewValue}>
                                      {fmtCur(sl.amount_due)} · {fmtDateSafe(sl.due_date)}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    )}

                    {accountMode === "new" && (
                      <>
                        <TextInput
                          style={[s.input, { marginTop: 8 }]}
                          placeholder="Nome do carnê (ex.: Compras de junho)"
                          placeholderTextColor={Colors.ink3}
                          value={newAccountName}
                          onChangeText={setNewAccountName}
                        />
                        <Text style={s.dateHint}>Um novo carnê será criado com este lançamento.</Text>
                      </>
                    )}
                  </>
                )}
                </Collapsible>

                {/* ── AVANÇADO (disclosure — data retroativa, periodicidade, juros, descrição) ── */}
                <Pressable
                  style={s.groupHead}
                  onPress={() => setAdvOpen(v => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={`Mais opções. Toque para ${advOpen ? "recolher" : "expandir"}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.groupTitle}>Mais opções</Text>
                    <Text style={s.groupSummary} numberOfLines={1}>
                      {[
                        entryDate !== todayBrSp() ? "retroativo" : null,
                        periodKind !== "mensal" ? PERIOD_CHIPS.find(([k]) => k === periodKind)?.[1]?.toLowerCase() : null,
                        interestRate.trim() ? `${interestRate}% a.m.` : null,
                        description.trim() ? "descrição" : null,
                      ].filter(Boolean).join(" · ") || "data, periodicidade, juros, descrição"}
                    </Text>
                  </View>
                  <View style={advOpen ? { transform: [{ rotate: "180deg" }] } : undefined}>
                    <Icon name="chevron-down" size={14} color={advOpen ? Colors.violet3 : Colors.ink3} />
                  </View>
                </Pressable>
                <Collapsible open={advOpen}>
                <Text style={s.label}>Data do lançamento</Text>
                <DateInput
                  style={s.input}
                  value={entryDate}
                  onChangeText={setEntryDate}
                  placeholder="dd/mm/aaaa"
                />
                <Text style={s.dateHint}>
                  Quando a compra foi feita. Use uma data anterior para lançar retroativo.
                </Text>

                {!unifyEnabled && (
                  <>
                    <Text style={s.label}>Periodicidade</Text>
                    <View style={s.periodChips}>
                      {PERIOD_CHIPS.map(([k, lbl]) => (
                        <Pressable
                          key={k}
                          onPress={() => setPeriodKind(k)}
                          style={[s.periodChip, periodKind === k && s.periodChipOn]}
                        >
                          <Text style={[s.periodChipTxt, periodKind === k && s.periodChipTxtOn]}>{lbl}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {periodKind === "custom" && (
                      <View style={s.customDaysRow}>
                        <Text style={s.customDaysLbl}>A cada</Text>
                        <TextInput
                          style={s.customDaysNum}
                          value={periodDays}
                          keyboardType="numeric"
                          onChangeText={(v) => setPeriodDays(v.replace(/\D/g, "").slice(0, 3))}
                        />
                        <Text style={s.customDaysLbl}>dias</Text>
                      </View>
                    )}
                  </>
                )}

                <Text style={[s.label, { marginTop: 14 }]}>
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
                  style={[s.input, { minHeight: 60, textAlignVertical: "top", marginBottom: 12 }]}
                  placeholder="Ex: Mercadoria de novembro"
                  placeholderTextColor={Colors.ink3}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />
                </Collapsible>
              </ScrollView>

              {/* ── Footer FIXO: resumo + CTA (F4 — antes rolavam junto) ── */}
              <View style={s.footerBar}>
                {amountNum > 0 && !unifyEnabled && (
                  <View style={s.footerSummary}>
                    <Text style={s.footerSummaryLbl}>
                      Total {rateNum > 0 ? "com juros " : ""}
                      <Text style={s.footerSummaryStrong}>
                        R$ {totalComJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Text>
                    </Text>
                    <Text style={[s.footerSummaryLbl, { color: Colors.violet3 }]}>
                      {nParcelas}x de{" "}
                      <Text style={[s.footerSummaryStrong, { color: Colors.violet3 }]}>
                        R$ {valorParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Text>
                    </Text>
                  </View>
                )}
                {unifyEnabled && unifyPreview && (
                  <View style={s.footerSummary}>
                    <Text style={s.footerSummaryLbl}>
                      Unificado{" "}
                      <Text style={s.footerSummaryStrong}>{fmtCur(unifyPreview.total)}</Text>
                    </Text>
                    <Text style={[s.footerSummaryLbl, { color: Colors.violet3 }]}>
                      {unifyPreview.schedule.length}x
                    </Text>
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
                      <Text style={s.submitBtnText}>
                        {unifyEnabled ? "Criar e unificar" : "Criar lançamento"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
              </>
            )}
          </Pressable>
          </ModalPop>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

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
  dateHint: { fontSize: 11, color: Colors.ink3, marginTop: 6 },
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
  periodChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  periodChipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  periodChipTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2 },
  periodChipTxtOn: { color: "#fff" },
  customDaysRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, padding: 10 },
  customDaysLbl: { fontSize: 13, color: Colors.ink2, fontWeight: "600" },
  customDaysNum: { width: 60, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingVertical: 7, textAlign: "center", color: Colors.ink, fontWeight: "800", fontSize: 14 },
  // F3: seletor de carnê
  accountModeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  accountModeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  accountModeChipOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet2 },
  accountModeChipTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  accountModeChipTxtOn: { color: Colors.violet3 },
  accountHint: { fontSize: 12, color: Colors.ink3, marginTop: 8 },
  accountList: { marginTop: 8, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, overflow: "hidden" },
  accountRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border2, backgroundColor: Colors.bg2 },
  accountRowOn: { backgroundColor: Colors.violetD },
  accountRowName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  accountRowSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  // feat(unify)
  unifyCard: { marginTop: 12, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.violet + "33", gap: 4 },
  unifyToggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  unifyToggleTitle: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  unifyToggleSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, justifyContent: "center", paddingHorizontal: 2 },
  toggleSwitchOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.ink3 },
  toggleThumbOn: { backgroundColor: "#fff", alignSelf: "flex-end" },
  unifyPreviewBox: { marginTop: 12, backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border2, gap: 6 },
  unifyPreviewTitle: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 4 },
  unifyPreviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  unifyPreviewTotal: { borderTopWidth: 1, borderTopColor: Colors.border2, paddingTop: 8, marginTop: 4 },
  unifyPreviewLabel: { fontSize: 12, color: Colors.ink2 },
  unifyPreviewValue: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  // comum
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
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.violet3,
    borderRadius: 12,
    paddingVertical: 15,
  },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  pressed:  { opacity: 0.7 },
  // ── F4: grupos com disclosure + footer fixo ──
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 10,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.ink3,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  groupSummary: { fontSize: 13, fontWeight: "600", color: Colors.ink, marginTop: 2 },
  footerBar: {
    borderTopWidth: 1,
    borderTopColor: Colors.border2,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Colors.bg3,
    gap: 10,
  },
  footerSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  footerSummaryLbl: { fontSize: 12.5, color: Colors.ink2 },
  footerSummaryStrong: { fontWeight: "800", color: Colors.ink, fontSize: 13.5 },
});
