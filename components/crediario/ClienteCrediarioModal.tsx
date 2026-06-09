// ============================================================
// AURA. — Crediário · Modal de detalhe do cliente
//
// Fase 1 FE (07/06/2026):
//   - Exibe score_label + available_limit
//   - Banner âmbar (não-bloqueante) quando score_warning != null
//   - FIX multi-carnê: parcelas agrupadas por account_id DENTRO
//     de cada card de carnê (antes só apareciam sem carnê)
//   - Parcelas com account_id==null vao em grupo "Sem carnê"
//   - Bloqueio manual: toggle + campo motivo + PATCH .../block
//   - Editor de termos (máx parcelas + juros) via PUT .../terms
//     null limpa override; selo "override" quando há customização
//   - Botão "Imprimir carnê" por carnê: usa printCarne() (fetch
//     + document.write, nunca window.open direto)
//
// Fase 2 FE (08/06/2026):
//   - Breakdown de encargos em parcelas vencidas com charges_total > 0:
//     "Principal em aberto", "Multa", "Mora (N dias)" e "Total a pagar".
//   - Parcelas sem encargos (capability OFF ou em dia) mantêm layout atual.
//   - Após receivePayment: se charges_paid > 0, exibe no toast/feedback
//     "Encargos quitados: R$X + Abatido do principal: R$Y".
//   - Todos campos novos tratados como undefined → 0/ausente (defensivo).
//
// F3 (05/06/2026): reescrita multi-carnê.
// F2 (05/06/2026): parcelas e saldo continuam funcionando igual.
// 03/06/2026: modal padrão (X + backdrop).
// 05/06/2026: campo "Data do recebimento" (default hoje, SP).
// fix (08/06/2026): Entrega 4 — botão calendário em cada parcela em aberto
//   (igual ao de cliente/[id].tsx): abre editor de data inline + chama
//   editInstallmentDueDate; ao sucesso, invalida credit-profile/credit-customer.
//
// Saldo amigável (09/06/2026):
//   - Card "Resumo" substituído por hero "EM ABERTO" centralizado.
//   - realCarnes = accounts.filter(a => a && a.id != null)
//   - useCarneLayout = realCarnes.length > 0
//   - Seção carnês renderizada só quando useCarneLayout; caso contrário,
//     lista plana de parcelas (sem "Conta geral"/"Sem carnê"/duplo total).
// ============================================================
import { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView,
  TextInput, ActivityIndicator, Switch,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  creditApi, printCarne,
  type CreditAccount, type CreditInstallment, type PaymentAllocation, type CustomerTermsOverrides,
} from "@/services/creditApi";
import { toast } from "@/components/Toast";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";

type Props = {
  visible: boolean;
  companyId: string;
  customerId: string | null;
  customerName?: string | null;
  pixKey?: string | null;
  storeName?: string | null;
  onClose: () => void;
  onCobrar?: (customerId: string, customerName: string, phone: string | null) => void;
  onChanged?: () => void;
};

const PAYMENT_METHODS = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "cartao", label: "Cartão" },
];

type ReceiveMode = "fifo" | "distribute";
type Tab = "resumo" | "termos" | "bloqueio";

function fmt(n: number) {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return "";
  try { return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" }); }
  catch { return ""; }
}
function todayBrSp(): string {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return formatIsoToBr(iso);
}
function parseAmount(raw: string): number {
  const s = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(s);
  return isFinite(n) && n >= 0 ? n : 0;
}
function productsFromNotes(notes?: string | null): string {
  if (!notes) return "";
  const mt = notes.match(/\(([^)]+)\)/);
  return mt ? mt[1] : "";
}
function periodLabel(acc: CreditAccount): string {
  const { period_unit, period_count } = acc;
  if (!period_unit || period_count == null) return "";
  if (period_unit === "month" && period_count === 1) return "Mensal";
  if (period_unit === "week" && period_count === 1) return "Semanal";
  if (period_unit === "week" && period_count === 2) return "Quinzenal";
  if (period_unit === "day") return `A cada ${period_count}d`;
  return `${period_count}${period_unit === "week" ? "sem" : period_unit === "month" ? "mês" : "d"}`;
}

// Score label human-readable
function scoreColor(label?: string | null): string {
  if (!label) return Colors.ink3;
  if (label === "premium" || label === "bom") return Colors.green;
  if (label === "regular") return Colors.amber;
  return Colors.red;
}
function scoreLabelPt(label?: string | null): string {
  const map: Record<string, string> = {
    premium: "Premium", bom: "Bom", regular: "Regular",
    restrito: "Restrito", bloqueado: "Bloqueado",
  };
  return label ? (map[label] ?? label) : "";
}

export function ClienteCrediarioModal({
  visible, companyId, customerId, customerName, pixKey, storeName,
  onClose, onCobrar, onChanged,
}: Props) {
  const qc = useQueryClient();

  // Tab principal
  const [tab, setTab] = useState<Tab>("resumo");

  // Recebimento estado
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("dinheiro");
  const [dateBr, setDateBr] = useState(todayBrSp());
  const [receiveMode, setReceiveMode] = useState<ReceiveMode>("fifo");
  const [fifoAccountId, setFifoAccountId] = useState<string | null | undefined>(undefined);
  const [distributions, setDistributions] = useState<Record<string, string>>({});

  // Carnê expandido
  const [expandedAccountId, setExpandedAccountId] = useState<string | null | undefined>(undefined);

  // Novo carnê inline
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Bloqueio manual
  const [blockReason, setBlockReason] = useState("");
  const [blockingAction, setBlockingAction] = useState<"block" | "unblock" | null>(null);

  // Termos
  const [termsMaxInst, setTermsMaxInst] = useState("");
  const [termsInterest, setTermsInterest] = useState("");
  const [termsDirty, setTermsDirty] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);

  // Entrega 4: editor de vencimento inline
  const [editingDueDateInst, setEditingDueDateInst] = useState<CreditInstallment | null>(null);
  const [editDueDateInput, setEditDueDateInput] = useState("");
  const [editDueDateError, setEditDueDateError] = useState("");

  // Fase 2: feedback após recebimento
  const [lastChargesPaid, setLastChargesPaid] = useState<number | null>(null);
  const [lastTotalPaid, setLastTotalPaid] = useState<number | null>(null);

  const profileQ = useQuery({
    queryKey: ["credit-profile", companyId, customerId],
    queryFn: () => creditApi.getCustomerProfile(companyId, customerId!),
    enabled: visible && !!companyId && !!customerId,
    staleTime: 15_000,
  });

  const detailQ = useQuery({
    queryKey: ["credit-customer", companyId, customerId],
    queryFn: () => creditApi.getCustomerHistory(companyId, customerId!),
    enabled: visible && !!companyId && !!customerId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (visible) {
      setAmount("");
      setMethod("dinheiro");
      setDateBr(todayBrSp());
      setReceiveMode("fifo");
      setFifoAccountId(undefined);
      setDistributions({});
      setShowNewAccount(false);
      setNewAccountName("");
      setTab("resumo");
      setBlockReason("");
      setBlockingAction(null);
      setTermsMaxInst("");
      setTermsInterest("");
      setTermsDirty(false);
      setExpandedAccountId(undefined);
      setLastChargesPaid(null);
      setLastTotalPaid(null);
      setEditingDueDateInst(null);
      setEditDueDateInput("");
      setEditDueDateError("");
    }
  }, [visible, customerId]);

  // Hidrata termos quando perfil carrega
  useEffect(() => {
    const p = profileQ.data;
    if (!p) return;
    const ov = p.terms?.overrides;
    if (ov) {
      setTermsMaxInst(ov.max_installments != null ? String(ov.max_installments) : "");
      setTermsInterest(ov.interest_rate != null ? String(+(ov.interest_rate * 100).toFixed(4)).replace(".", ",") : "");
    }
  }, [profileQ.data]);

  const detail = detailQ.data;
  const profile = profileQ.data;
  const accounts: CreditAccount[] = detail?.accounts || [];
  const hasAccounts = accounts.length > 0;
  const balance = detail?.balance ?? 0;

  const totalBalance = hasAccounts
    ? accounts.reduce((s, a) => s + (a.balance || 0), 0)
    : balance;
  const overdueAccounts = accounts.filter(a => a.overdue);

  const openInst = useMemo(
    () => (detail?.open_installments || profile?.open_installments || []).slice()
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [detail, profile],
  );

  // Agrupa parcelas por account_id (Fase 1 FIX)
  const instByAccount = useMemo(() => {
    const map = new Map<string | null, typeof openInst>();
    for (const inst of openInst) {
      const key = inst.account_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inst);
    }
    return map;
  }, [openInst]);

  const hasOverdue = overdueAccounts.length > 0 || openInst.some(i => i.status === "overdue");
  const openSum = openInst.reduce((s, i) => s + (i.remaining ?? (i.amount_due - (i.covered_amount || 0))), 0);

  // Saldo amigável: carnês NOMEADOS (id != null) determinam o layout
  const realCarnes = accounts.filter(a => a && a.id != null);
  const useCarneLayout = realCarnes.length > 0;

  // Próximo vencimento (hero)
  const nextDueDate = openInst.length > 0
    ? openInst.reduce((best, i) => {
        const d = new Date(i.due_date).getTime();
        return (!best || d < new Date(best).getTime()) ? i.due_date : best;
      }, "" as string)
    : "";

  const distributionTotal = useMemo(
    () => Object.values(distributions).reduce((s, v) => s + parseAmount(v), 0),
    [distributions],
  );

  // Bloqueio
  const isBlocked = profile?.status === "blocked";

  const blockMut = useMutation({
    mutationFn: ({ action, reason }: { action: "block" | "unblock"; reason?: string }) =>
      creditApi.blockCustomer(companyId, customerId!, action, reason),
    onSuccess: () => {
      toast.success(isBlocked ? "Cliente desbloqueado" : "Cliente bloqueado");
      setBlockReason("");
      setBlockingAction(null);
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      onChanged?.();
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao alterar bloqueio"),
  });

  function handleBlockToggle() {
    if (isBlocked) {
      blockMut.mutate({ action: "unblock" });
    } else {
      setBlockingAction("block");
    }
  }

  function confirmBlock() {
    blockMut.mutate({ action: "block", reason: blockReason.trim() || undefined });
  }

  // Termos
  async function saveTerms() {
    setSavingTerms(true);
    try {
      const hasOverride = termsMaxInst.trim() || termsInterest.trim();
      if (!hasOverride) {
        // null limpa override
        await creditApi.updateCustomerTerms(companyId, customerId!, null as any);
      } else {
        const body: Partial<CustomerTermsOverrides> = {};
        if (termsMaxInst.trim()) body.max_installments = parseInt(termsMaxInst, 10) || null;
        if (termsInterest.trim()) {
          const v = parseFloat(termsInterest.replace(",", "."));
          body.interest_rate = isFinite(v) ? v / 100 : null;
        }
        await creditApi.updateCustomerTerms(companyId, customerId!, body);
      }
      toast.success("Termos salvos!");
      setTermsDirty(false);
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao salvar termos");
    } finally {
      setSavingTerms(false);
    }
  }

  // Mutação: receber pagamento
  const payMut = useMutation({
    mutationFn: () => {
      const paidAt = parseBrDate(dateBr) || undefined;
      if (receiveMode === "distribute" && hasAccounts) {
        const allocations: PaymentAllocation[] = Object.entries(distributions)
          .map(([key, val]) => ({ account_id: key === "general" ? null : key, amount: parseAmount(val) }))
          .filter(a => a.amount > 0);
        return creditApi.receivePayment(companyId, customerId!, {
          payment_method: method,
          paid_at: paidAt,
          allocations,
        });
      }
      const amt = parseAmount(amount);
      return creditApi.receivePayment(companyId, customerId!, {
        amount: amt,
        payment_method: method,
        paid_at: paidAt,
        account_id: fifoAccountId,
      });
    },
    onSuccess: (res) => {
      // Fase 2: capturar encargos quitados para exibir feedback
      const chargesPaid = res.charges_paid ?? 0;
      const totalPaid = amountNum;
      if (chargesPaid > 0) {
        setLastChargesPaid(chargesPaid);
        setLastTotalPaid(totalPaid);
        const principal = Math.max(0, totalPaid - chargesPaid);
        toast.success(
          `Recebimento registrado!\n` +
          `Encargos quitados: ${fmt(chargesPaid)}\n` +
          `Abatido do principal: ${fmt(principal)}`
        );
      } else {
        toast.success("Recebimento registrado! Saldo: " + fmt(res.new_balance));
        setLastChargesPaid(null);
        setLastTotalPaid(null);
      }
      setAmount("");
      setDistributions({});
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-balances", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-aging", companyId] });
      onChanged?.();
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao registrar recebimento"),
  });

  const amountNum = receiveMode === "distribute" ? distributionTotal : parseAmount(amount);
  const afterBalance = Math.max(0, Math.round((totalBalance - amountNum) * 100) / 100);
  const dateInvalid = dateBr.length === 10 && parseBrDate(dateBr) === null;

  function confirmReceive() {
    if (amountNum <= 0) { toast.error("Informe um valor maior que zero"); return; }
    if (dateInvalid) { toast.error("Data inválida — use dd/mm/aaaa"); return; }
    payMut.mutate();
  }
  function prefill(v: number) {
    setAmount(v.toFixed(2).replace(".", ","));
  }

  async function handleCreateAccount() {
    if (!newAccountName.trim()) { toast.error("Nome do carnê é obrigatório"); return; }
    setCreatingAccount(true);
    try {
      await creditApi.createAccount(companyId, customerId!, { name: newAccountName.trim() });
      toast.success("Carnê criado!");
      setShowNewAccount(false);
      setNewAccountName("");
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao criar carnê");
    } finally {
      setCreatingAccount(false);
    }
  }

  // Entrega 4: mutation para editar vencimento de parcela dentro do modal
  const editDueDateMut = useMutation({
    mutationFn: ({ id, dueDate }: { id: string; dueDate: string }) =>
      creditApi.editInstallmentDueDate(companyId, id, dueDate),
    onSuccess: () => {
      setEditingDueDateInst(null);
      setEditDueDateInput("");
      setEditDueDateError("");
      toast.success("Vencimento atualizado!");
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao alterar vencimento"),
  });

  function handleEditDueDateOpen(inst: CreditInstallment) {
    setEditingDueDateInst(inst);
    setEditDueDateInput(formatIsoToBr(inst.due_date));
    setEditDueDateError("");
  }

  function handleEditDueDateConfirm() {
    const iso = parseBrDate(editDueDateInput);
    if (!iso) { setEditDueDateError("Data inválida"); return; }
    if (!editingDueDateInst) return;
    editDueDateMut.mutate({ id: editingDueDateInst.id, dueDate: iso });
  }

  const name = detail?.customer?.name || customerName || "Cliente";
  const phone = detail?.customer?.phone || null;
  const initial = (name.trim()[0] || "?").toUpperCase();

  // Aviso de score (Fase 1 — nunca bloqueante)
  const scoreWarning = profile?.score_warning ?? null;
  const availableLimit = profile?.available_limit ?? (profile ? (profile.credit_limit - profile.credit_used) : undefined);
  const scoreLabel = profile?.score_label ?? profile?.label ?? null;

  // Termos: tem override?
  const hasTermsOverride = !!(
    profile?.terms?.overrides?.max_installments != null ||
    profile?.terms?.overrides?.interest_rate != null
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={m.backdrop} onPress={onClose}>
        <Pressable style={m.sheet} onPress={() => {}}>
          {/* Header */}
          <View style={m.head}>
            <Pressable onPress={onClose} style={m.crumb}>
              <Icon name="chevron_right" size={15} color={Colors.violet3} style={{ transform: [{ rotate: "180deg" }] } as any} />
              <Text style={m.crumbTxt}>Crediário</Text>
            </Pressable>
            <Pressable onPress={onClose} style={m.xBtn}>
              <Icon name="x" size={15} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={m.body} contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
            {/* Cliente */}
            <View style={m.cust}>
              <View style={m.custL}>
                <View style={m.avatar}><Text style={m.avatarTxt}>{initial}</Text></View>
                <View>
                  <Text style={m.custName}>{name}</Text>
                  <View style={m.custSub}>
                    <View style={[m.dot, { backgroundColor: hasOverdue ? Colors.red : Colors.green }]} />
                    <View style={[m.pill, { backgroundColor: (hasOverdue ? Colors.red : Colors.green) + "22" }]}>
                      <Text style={[m.pillTxt, { color: hasOverdue ? Colors.red : Colors.green }]}>
                        {hasOverdue ? "Em atraso" : "Em dia"}
                      </Text>
                    </View>
                    {isBlocked && (
                      <View style={[m.pill, { backgroundColor: Colors.red + "22" }]}>
                        <Text style={[m.pillTxt, { color: Colors.red }]}>Bloqueado</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              {!!phone && !!onCobrar && (
                <Pressable style={m.waBtn} onPress={() => onCobrar(customerId!, name, phone)}>
                  <Icon name="message_circle" size={14} color={Colors.green} />
                  <Text style={m.waTxt}>Cobrar</Text>
                </Pressable>
              )}
            </View>

            {/* Banner aviso score (não-bloqueante) */}
            {!!scoreWarning && (
              <View style={m.scoreBanner}>
                <Icon name="alert_triangle" size={15} color={Colors.amber} />
                <Text style={m.scoreBannerTxt}>
                  Score abaixo do mínimo de aviso ({scoreWarning.threshold} pts). Score atual:{" "}
                  <Text style={{ fontWeight: "800" }}>{scoreWarning.actual} pts</Text>.
                  {" "}Você pode lançar normalmente — isto é apenas um alerta.
                </Text>
              </View>
            )}

            {/* Tabs */}
            <View style={m.tabs}>
              {(["resumo", "termos", "bloqueio"] as Tab[]).map(t => (
                <Pressable key={t} style={[m.tab, tab === t && m.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[m.tabTxt, tab === t && m.tabTxtOn]}>
                    {t === "resumo" ? "Resumo" : t === "termos" ? `Termos${hasTermsOverride ? " •" : ""}` : "Bloqueio"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {detailQ.isLoading || profileQ.isLoading ? (
              <View style={{ paddingVertical: 36, alignItems: "center" }}>
                <ActivityIndicator color={Colors.violet3} />
              </View>
            ) : (
              <>
                {/* ===== TAB RESUMO ===== */}
                {tab === "resumo" && (
                  <>
                    {/* Painel de crédito (Fase 1) */}
                    {!!profile && (
                      <View style={m.card}>
                        <Text style={m.cardTitle}>Crédito</Text>
                        <View style={m.row}>
                          <Text style={m.rowK}>Score</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={[m.rowV, { color: scoreColor(scoreLabel), fontSize: 15 }]}>
                              {profile.credit_score}
                            </Text>
                            {!!scoreLabel && (
                              <View style={[m.scorePill, { backgroundColor: scoreColor(scoreLabel) + "22" }]}>
                                <Text style={[m.scorePillTxt, { color: scoreColor(scoreLabel) }]}>
                                  {scoreLabelPt(scoreLabel)}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={m.row}>
                          <Text style={m.rowK}>Limite total</Text>
                          <Text style={m.rowV}>{fmt(profile.credit_limit)}</Text>
                        </View>
                        {availableLimit !== undefined && (
                          <View style={m.row}>
                            <Text style={m.rowK}>Disponível</Text>
                            <Text style={[m.rowV, { color: availableLimit >= 0 ? Colors.green : Colors.red }]}>
                              {fmt(availableLimit)}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Hero: Em aberto */}
                    <View style={m.heroCard}>
                      <Text style={m.heroLabel}>EM ABERTO</Text>
                      <Text style={[m.heroValue, { color: totalBalance > 0 ? Colors.red : Colors.ink3 }]}>
                        {fmt(totalBalance)}
                      </Text>
                      <Text style={m.heroSub}>
                        {openInst.length} parcela{openInst.length !== 1 ? "s" : ""}
                        {openInst.length > 0 && fmtDate(nextDueDate)
                          ? ` · próximo venc. ${fmtDate(nextDueDate)}`
                          : ""}
                      </Text>
                    </View>

                    {/* Seção de Carnês (F3) — agrupa só quando há carnê NOMEADO */}
                    {useCarneLayout && (
                      <View style={m.card}>
                        <View style={m.cardTitleRow}>
                          <Text style={m.cardTitle}>Carnês / contas</Text>
                          <Pressable
                            style={m.newAccBtn}
                            onPress={() => { setShowNewAccount(v => !v); setNewAccountName(""); }}
                          >
                            <Icon name="plus" size={12} color={Colors.violet3} />
                            <Text style={m.newAccTxt}>Novo carnê</Text>
                          </Pressable>
                        </View>

                        {showNewAccount && (
                          <View style={m.newAccRow}>
                            <TextInput
                              style={m.newAccInput}
                              placeholder="Nome do carnê"
                              placeholderTextColor={Colors.ink3}
                              value={newAccountName}
                              onChangeText={setNewAccountName}
                              autoFocus
                            />
                            <Pressable
                              style={[m.newAccConfirm, creatingAccount && { opacity: 0.5 }]}
                              onPress={handleCreateAccount}
                              disabled={creatingAccount}
                            >
                              {creatingAccount
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={m.newAccConfirmTxt}>Criar</Text>}
                            </Pressable>
                          </View>
                        )}

                        {accounts.map((acc) => {
                          const isOverdueAcc = acc.overdue;
                          const statusColor = isOverdueAcc ? Colors.red : Colors.green;
                          const accKey = acc.id ?? "general";
                          const isExpanded = expandedAccountId === acc.id;
                          // Parcelas deste carnê
                          const accInst = instByAccount.get(acc.id) || [];
                          return (
                            <View key={accKey} style={m.accCard}>
                              <View style={m.accTop}>
                                <Pressable
                                  style={{ flex: 1 }}
                                  onPress={() => setExpandedAccountId(isExpanded ? undefined : acc.id)}
                                >
                                  <Text style={m.accName}>{acc.name}</Text>
                                  <View style={m.accMeta}>
                                    {periodLabel(acc) ? (
                                      <View style={[m.accBadge, { backgroundColor: Colors.violet3 + "22", borderColor: Colors.violet3 + "44" }]}>
                                        <Text style={[m.accBadgeTxt, { color: Colors.violet3 }]}>{periodLabel(acc)}</Text>
                                      </View>
                                    ) : null}
                                    <View style={[m.accBadge, { backgroundColor: statusColor + "18", borderColor: statusColor + "33" }]}>
                                      <Text style={[m.accBadgeTxt, { color: statusColor }]}>{isOverdueAcc ? "Em atraso" : "Em dia"}</Text>
                                    </View>
                                    {accInst.length > 0 && (
                                      <View style={[m.accBadge, { backgroundColor: Colors.amber + "18", borderColor: Colors.amber + "33" }]}>
                                        <Text style={[m.accBadgeTxt, { color: Colors.amber }]}>{accInst.length} parcela{accInst.length !== 1 ? "s" : ""}</Text>
                                      </View>
                                    )}
                                  </View>
                                </Pressable>
                                <View style={{ alignItems: "flex-end" }}>
                                  <Text style={[m.accBalance, { color: acc.balance > 0 ? Colors.red : Colors.ink3 }]}>
                                    {fmt(acc.balance)}
                                  </Text>
                                  {!!fmtDate(acc.next_due_date || "") && (
                                    <Text style={m.accNextDue}>Próx. {fmtDate(acc.next_due_date!)}</Text>
                                  )}
                                </View>
                              </View>

                              {/* Parcelas expandidas deste carnê */}
                              {isExpanded && accInst.length > 0 && (
                                <View style={m.accInstList}>
                                  {accInst.map((ins) => {
                                    const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
                                    const late = ins.status === "overdue";
                                    const chargesTotal = ins.charges_total ?? 0;
                                    const hasCharges = late && chargesTotal > 0;
                                    return (
                                      <View key={ins.id} style={m.parc}>
                                        <View style={{ flex: 1 }}>
                                          <Text style={m.parcT}>
                                            Parcela {ins.installment_number}/{ins.total_installments}
                                            {hasCharges
                                              ? " · " + fmt(ins.total_due ?? (rem + chargesTotal))
                                              : " · " + fmt(rem)}
                                          </Text>
                                          <Text style={m.parcS}>Vence {fmtDate(ins.due_date)}</Text>
                                          {/* Fase 2: breakdown encargos */}
                                          {hasCharges && (
                                            <View style={m.chargesBreakdown}>
                                              <View style={m.chargesRow}>
                                                <Text style={m.chargesLbl}>Principal em aberto</Text>
                                                <Text style={m.chargesVal}>{fmt(rem)}</Text>
                                              </View>
                                              {(ins.late_fee ?? 0) > 0 && (
                                                <View style={m.chargesRow}>
                                                  <Text style={m.chargesLbl}>Multa</Text>
                                                  <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_fee ?? 0)}</Text>
                                                </View>
                                              )}
                                              {(ins.late_interest ?? 0) > 0 && (
                                                <View style={m.chargesRow}>
                                                  <Text style={m.chargesLbl}>
                                                    Mora
                                                    {(ins.days_charged ?? 0) > 0 && (
                                                      <Text style={m.chargesDaysChip}> {ins.days_charged}d</Text>
                                                    )}
                                                  </Text>
                                                  <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_interest ?? 0)}</Text>
                                                </View>
                                              )}
                                              <View style={[m.chargesRow, m.chargesTotalRow]}>
                                                <Text style={m.chargesTotalLbl}>Total a pagar</Text>
                                                <Text style={m.chargesTotalVal}>
                                                  {fmt(ins.total_due ?? (rem + chargesTotal))}
                                                </Text>
                                              </View>
                                            </View>
                                          )}
                                        </View>
                                        <View style={{ alignItems: "flex-end", gap: 6 }}>
                                          <View style={[m.badge, { backgroundColor: (late ? Colors.red : Colors.green) + "1A", borderColor: (late ? Colors.red : Colors.green) + "44" }]}>
                                            <Text style={[m.badgeTxt, { color: late ? Colors.red : Colors.green }]}>{late ? "Atraso" : "OK"}</Text>
                                          </View>
                                          <Pressable
                                            style={m.calBtn}
                                            onPress={() => handleEditDueDateOpen(ins)}
                                          >
                                            <Icon name="Calendar" size={13} color={Colors.violet} />
                                          </Pressable>
                                          <Pressable style={m.receberBtn} onPress={() => prefill(hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem)}>
                                            <Text style={m.receberTxt}>Receber</Text>
                                          </Pressable>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                              {isExpanded && accInst.length === 0 && (
                                <Text style={[m.emptyTxt, { marginTop: 8 }]}>Sem parcelas abertas neste carnê.</Text>
                              )}

                              <View style={m.accActions}>
                                <Pressable
                                  style={m.accActionBtn}
                                  onPress={() => {
                                    setReceiveMode("fifo");
                                    setFifoAccountId(acc.id);
                                    prefill(acc.balance);
                                  }}
                                >
                                  <Text style={m.accActionTxt}>Receber</Text>
                                </Pressable>
                                <Pressable
                                  style={[m.accActionBtn, { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 }]}
                                  onPress={() => printCarne(companyId, customerId!)}
                                >
                                  <Text style={[m.accActionTxt, { color: Colors.violet3 }]}>Imprimir</Text>
                                </Pressable>
                                {!!phone && (
                                  <Pressable
                                    style={[m.accActionBtn, m.accActionWa]}
                                    onPress={() => onCobrar?.(customerId!, name, phone)}
                                  >
                                    <Text style={[m.accActionTxt, { color: Colors.green }]}>Cobrar</Text>
                                  </Pressable>
                                )}
                              </View>
                            </View>
                          );
                        })}

                        {/* Parcelas sem carnê (account_id == null) */}
                        {(() => {
                          const orphan = instByAccount.get(null) || [];
                          if (!orphan.length) return null;
                          return (
                            <View style={[m.accCard, { borderTopColor: Colors.border }]}>
                              <Text style={[m.accName, { color: Colors.ink3 }]}>Sem carnê</Text>
                              {orphan.map((ins) => {
                                const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
                                const late = ins.status === "overdue";
                                const chargesTotal = ins.charges_total ?? 0;
                                const hasCharges = late && chargesTotal > 0;
                                return (
                                  <View key={ins.id} style={m.parc}>
                                    <View style={{ flex: 1 }}>
                                      <Text style={m.parcT}>
                                        Parcela {ins.installment_number}/{ins.total_installments}
                                        {hasCharges
                                          ? " · " + fmt(ins.total_due ?? (rem + chargesTotal))
                                          : " · " + fmt(rem)}
                                      </Text>
                                      <Text style={m.parcS}>Vence {fmtDate(ins.due_date)}</Text>
                                      {/* Fase 2: breakdown encargos */}
                                      {hasCharges && (
                                        <View style={m.chargesBreakdown}>
                                          <View style={m.chargesRow}>
                                            <Text style={m.chargesLbl}>Principal em aberto</Text>
                                            <Text style={m.chargesVal}>{fmt(rem)}</Text>
                                          </View>
                                          {(ins.late_fee ?? 0) > 0 && (
                                            <View style={m.chargesRow}>
                                              <Text style={m.chargesLbl}>Multa</Text>
                                              <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_fee ?? 0)}</Text>
                                            </View>
                                          )}
                                          {(ins.late_interest ?? 0) > 0 && (
                                            <View style={m.chargesRow}>
                                              <Text style={m.chargesLbl}>
                                                Mora
                                                {(ins.days_charged ?? 0) > 0 && (
                                                  <Text style={m.chargesDaysChip}> {ins.days_charged}d</Text>
                                                )}
                                              </Text>
                                              <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_interest ?? 0)}</Text>
                                            </View>
                                          )}
                                          <View style={[m.chargesRow, m.chargesTotalRow]}>
                                            <Text style={m.chargesTotalLbl}>Total a pagar</Text>
                                            <Text style={m.chargesTotalVal}>
                                              {fmt(ins.total_due ?? (rem + chargesTotal))}
                                            </Text>
                                          </View>
                                        </View>
                                      )}
                                    </View>
                                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                                      <View style={[m.badge, { backgroundColor: (late ? Colors.red : Colors.green) + "1A", borderColor: (late ? Colors.red : Colors.green) + "44" }]}>
                                        <Text style={[m.badgeTxt, { color: late ? Colors.red : Colors.green }]}>{late ? "Atraso" : "OK"}</Text>
                                      </View>
                                      <Pressable
                                        style={m.calBtn}
                                        onPress={() => handleEditDueDateOpen(ins)}
                                      >
                                        <Icon name="Calendar" size={13} color={Colors.violet} />
                                      </Pressable>
                                      <Pressable style={m.receberBtn} onPress={() => prefill(hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem)}>
                                        <Text style={m.receberTxt}>Receber</Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}
                      </View>
                    )}

                    {/* Parcelas em aberto — lista plana quando sem carnê nomeado */}
                    {!useCarneLayout && openInst.length > 0 && (
                      <View style={m.card}>
                        <View style={m.cardTitleRow}>
                          <Text style={m.cardTitle}>Parcelas em aberto</Text>
                          <Pressable
                            style={[m.newAccBtn, { gap: 4 }]}
                            onPress={() => printCarne(companyId, customerId!)}
                          >
                            <Icon name="printer" size={12} color={Colors.violet3} />
                            <Text style={m.newAccTxt}>Imprimir carnê</Text>
                          </Pressable>
                        </View>
                        {openInst.map((ins) => {
                          const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
                          const late = ins.status === "overdue";
                          const chargesTotal = ins.charges_total ?? 0;
                          const hasCharges = late && chargesTotal > 0;
                          return (
                            <View key={ins.id} style={m.parc}>
                              <View style={{ flex: 1 }}>
                                <Text style={m.parcT}>
                                  Parcela {ins.installment_number}/{ins.total_installments}
                                  {hasCharges
                                    ? " · " + fmt(ins.total_due ?? (rem + chargesTotal))
                                    : " · " + fmt(rem)}
                                </Text>
                                <Text style={m.parcS}>Vence {fmtDate(ins.due_date)}</Text>
                                {/* Fase 2: breakdown encargos */}
                                {hasCharges && (
                                  <View style={m.chargesBreakdown}>
                                    <View style={m.chargesRow}>
                                      <Text style={m.chargesLbl}>Principal em aberto</Text>
                                      <Text style={m.chargesVal}>{fmt(rem)}</Text>
                                    </View>
                                    {(ins.late_fee ?? 0) > 0 && (
                                      <View style={m.chargesRow}>
                                        <Text style={m.chargesLbl}>Multa</Text>
                                        <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_fee ?? 0)}</Text>
                                      </View>
                                    )}
                                    {(ins.late_interest ?? 0) > 0 && (
                                      <View style={m.chargesRow}>
                                        <Text style={m.chargesLbl}>
                                          Mora
                                          {(ins.days_charged ?? 0) > 0 && (
                                            <Text style={m.chargesDaysChip}> {ins.days_charged}d</Text>
                                          )}
                                        </Text>
                                        <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_interest ?? 0)}</Text>
                                      </View>
                                    )}
                                    <View style={[m.chargesRow, m.chargesTotalRow]}>
                                      <Text style={m.chargesTotalLbl}>Total a pagar</Text>
                                      <Text style={m.chargesTotalVal}>
                                        {fmt(ins.total_due ?? (rem + chargesTotal))}
                                      </Text>
                                    </View>
                                  </View>
                                )}
                              </View>
                              <View style={{ alignItems: "flex-end", gap: 6 }}>
                                <View style={[m.badge, { backgroundColor: (late ? Colors.red : Colors.green) + "1A", borderColor: (late ? Colors.red : Colors.green) + "44" }]}>
                                  <Text style={[m.badgeTxt, { color: late ? Colors.red : Colors.green }]}>{late ? "Em atraso" : "No prazo"}</Text>
                                </View>
                                <Pressable
                                  style={m.calBtn}
                                  onPress={() => handleEditDueDateOpen(ins)}
                                >
                                  <Icon name="Calendar" size={13} color={Colors.violet} />
                                </Pressable>
                                <Pressable style={m.receberBtn} onPress={() => prefill(hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem)}>
                                  <Text style={m.receberTxt}>Receber</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Registrar recebimento */}
                    <View style={m.freeBox}>
                      <Text style={m.freeTitle}>Registrar recebimento</Text>

                      {hasAccounts && (
                        <View style={m.modeRow}>
                          {(["fifo", "distribute"] as ReceiveMode[]).map(mode => (
                            <Pressable
                              key={mode}
                              style={[m.modeChip, receiveMode === mode && m.modeChipOn]}
                              onPress={() => setReceiveMode(mode)}
                            >
                              <Text style={[m.modeChipTxt, receiveMode === mode && m.modeChipTxtOn]}>
                                {mode === "fifo" ? "Em um carnê" : "Distribuir entre carnês"}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}

                      {hasAccounts && receiveMode === "fifo" && (
                        <View style={[m.fieldBlock, { marginTop: 10 }]}>
                          <Text style={m.fieldLabel}>Carnê</Text>
                          <View style={m.chipRow}>
                            <Pressable
                              style={[m.chip, fifoAccountId === undefined && m.chipOn]}
                              onPress={() => setFifoAccountId(undefined)}
                            >
                              <Text style={[m.chipTxt, fifoAccountId === undefined && m.chipTxtOn]}>Todos os carnês</Text>
                            </Pressable>
                            {accounts.map(acc => (
                              <Pressable
                                key={acc.id ?? "general"}
                                style={[m.chip, fifoAccountId === acc.id && m.chipOn]}
                                onPress={() => setFifoAccountId(acc.id)}
                              >
                                <Text style={[m.chipTxt, fifoAccountId === acc.id && m.chipTxtOn]}>{acc.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      )}

                      {hasAccounts && receiveMode === "distribute" && (
                        <View style={m.fieldBlock}>
                          {accounts.map(acc => {
                            const key = acc.id ?? "general";
                            return (
                              <View key={key} style={m.distRow}>
                                <Text style={m.distLabel} numberOfLines={1}>{acc.name}</Text>
                                <View style={m.distInput}>
                                  <Text style={m.amountPrefix}>R$</Text>
                                  <TextInput
                                    style={m.distField}
                                    value={distributions[key] || ""}
                                    onChangeText={v => setDistributions(prev => ({ ...prev, [key]: v.replace(/[^\d,.]/g, "") }))}
                                    placeholder="0,00"
                                    placeholderTextColor={Colors.ink3}
                                    keyboardType="decimal-pad"
                                  />
                                </View>
                              </View>
                            );
                          })}
                          <View style={m.distTotal}>
                            <Text style={m.distTotalLbl}>Total</Text>
                            <Text style={m.distTotalVal}>{fmt(distributionTotal)}</Text>
                          </View>
                        </View>
                      )}

                      {(!hasAccounts || receiveMode === "fifo") && (
                        <>
                          <Text style={m.fieldLabel}>Valor recebido</Text>
                          <View style={m.amountIn}>
                            <Text style={m.amountPrefix}>R$</Text>
                            <TextInput
                              style={m.amountInput}
                              value={amount}
                              onChangeText={(v) => setAmount(v.replace(/[^\d,.]/g, ""))}
                              placeholder="0,00"
                              placeholderTextColor={Colors.ink3}
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={m.quickRow}>
                            {[50, 100, 200].map(v => (
                              <Pressable key={v} style={m.qChip} onPress={() => prefill(v)}>
                                <Text style={m.qChipTxt}>{fmt(v)}</Text>
                              </Pressable>
                            ))}
                            {totalBalance > 0 && (
                              <Pressable style={m.qChip} onPress={() => prefill(totalBalance)}>
                                <Text style={m.qChipTxt}>Quitar ({fmt(totalBalance)})</Text>
                              </Pressable>
                            )}
                          </View>
                        </>
                      )}

                      <Text style={[m.fieldLabel, { marginTop: 14 }]}>Data do recebimento</Text>
                      <DateInput
                        value={dateBr}
                        onChangeText={setDateBr}
                        placeholder="dd/mm/aaaa"
                        style={m.dateInput}
                      />
                      <Text style={m.dateHint}>Use uma data anterior para registrar um recebimento retroativo.</Text>

                      <Text style={[m.fieldLabel, { marginTop: 14 }]}>Forma</Text>
                      <View style={m.methods}>
                        {PAYMENT_METHODS.map(pm => (
                          <Pressable key={pm.key} style={[m.method, method === pm.key && m.methodActive]} onPress={() => setMethod(pm.key)}>
                            <Text style={[m.methodTxt, method === pm.key && { color: "#fff" }]}>{pm.label}</Text>
                          </Pressable>
                        ))}
                      </View>

                      {amountNum > 0 && (
                        <View style={m.after}>
                          <Text style={m.afterK}>Saldo após recebimento</Text>
                          <Text style={m.afterV}>{fmt(afterBalance)}</Text>
                        </View>
                      )}

                      {/* Fase 2: resumo de encargos quitados (exibido após recebimento) */}
                      {lastChargesPaid != null && lastChargesPaid > 0 && lastTotalPaid != null && (
                        <View style={m.chargesSummary}>
                          <View style={m.chargesSummaryRow}>
                            <Text style={m.chargesSummaryLbl}>Encargos quitados</Text>
                            <Text style={[m.chargesSummaryVal, { color: Colors.red }]}>{fmt(lastChargesPaid)}</Text>
                          </View>
                          <View style={m.chargesSummaryRow}>
                            <Text style={m.chargesSummaryLbl}>Abatido do principal</Text>
                            <Text style={m.chargesSummaryVal}>{fmt(Math.max(0, lastTotalPaid - lastChargesPaid))}</Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Histórico de pagamentos */}
                    <View style={m.card}>
                      <Text style={m.cardTitle}>Histórico de pagamentos</Text>
                      {(detail?.transactions || []).length === 0 ? (
                        <Text style={m.emptyTxt}>Sem movimentações ainda.</Text>
                      ) : (
                        (detail?.transactions || []).map((t) => {
                          const isPay = t.type === "payment";
                          const prods = productsFromNotes(t.notes);
                          return (
                            <View key={t.id} style={m.tlItem}>
                              <View style={[m.tlDot, { backgroundColor: isPay ? Colors.green : Colors.violet3 }]} />
                              <View style={{ flex: 1 }}>
                                <View style={m.tlLine}>
                                  <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                                    <Text style={m.tlMain}>{isPay ? `Recebimento${t.payment_method ? " · " + t.payment_method : ""}` : "Compra no crediário"}</Text>
                                    {t.account_name && (
                                      <View style={m.tlAccTag}>
                                        <Text style={m.tlAccTagTxt}>{t.account_name}</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={[m.tlAmt, { color: isPay ? Colors.green : Colors.ink }]}>{isPay ? "+ " : ""}{fmt(t.amount)}</Text>
                                </View>
                                <Text style={m.tlSub}>{fmtDate(t.created_at)}{prods ? ` · ${prods}` : (t.notes && !isPay ? ` · ${t.notes}` : "")}</Text>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </>
                )}

                {/* ===== TAB TERMOS ===== */}
                {tab === "termos" && (
                  <View style={m.card}>
                    <View style={m.cardTitleRow}>
                      <Text style={m.cardTitle}>Termos deste cliente</Text>
                      {hasTermsOverride && (
                        <View style={[m.pill, { backgroundColor: Colors.violet3 + "22" }]}>
                          <Text style={[m.pillTxt, { color: Colors.violet3 }]}>Override ativo</Text>
                        </View>
                      )}
                    </View>
                    <Text style={m.termsHint}>
                      Substitui as regras padrão da loja só para este cliente. Deixe os campos em branco para usar o padrão.
                      Salvar com tudo em branco remove o override.
                    </Text>

                    {!!profile?.terms?.effective && (
                      <View style={m.termsEffRow}>
                        <Text style={m.termsEffLbl}>Efetivo agora</Text>
                        <Text style={m.termsEffVal}>
                          {profile.terms.effective.max_installments}x ·{" "}
                          {(profile.terms.effective.interest_rate * 100).toFixed(2).replace(".", ",")}% a.m.
                        </Text>
                      </View>
                    )}

                    <Text style={[m.fieldLabel, { marginTop: 14 }]}>Máx. parcelas</Text>
                    <TextInput
                      style={m.termsInput}
                      value={termsMaxInst}
                      placeholder={profile?.terms?.effective?.max_installments ? String(profile.terms.effective.max_installments) + " (padrão)" : "padrão"}
                      placeholderTextColor={Colors.ink3}
                      keyboardType="numeric"
                      onChangeText={v => { setTermsMaxInst(v.replace(/\D/g, "").slice(0, 2)); setTermsDirty(true); }}
                    />

                    <Text style={[m.fieldLabel, { marginTop: 10 }]}>Juros ao mês (%)</Text>
                    <TextInput
                      style={m.termsInput}
                      value={termsInterest}
                      placeholder={profile?.terms?.effective ? (profile.terms.effective.interest_rate * 100).toFixed(2).replace(".", ",") + " (padrão)" : "padrão"}
                      placeholderTextColor={Colors.ink3}
                      keyboardType="decimal-pad"
                      onChangeText={v => { setTermsInterest(v.replace(/[^\d,.]/g, "")); setTermsDirty(true); }}
                    />

                    <Pressable
                      style={[m.cta, { marginTop: 16 }, (!termsDirty || savingTerms) && { opacity: 0.45 }]}
                      onPress={saveTerms}
                      disabled={!termsDirty || savingTerms}
                    >
                      {savingTerms
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={m.ctaTxt}>Salvar termos</Text>}
                    </Pressable>
                  </View>
                )}

                {/* ===== TAB BLOQUEIO ===== */}
                {tab === "bloqueio" && (
                  <View style={m.card}>
                    <Text style={m.cardTitle}>Bloqueio manual</Text>
                    <Text style={m.termsHint}>
                      O bloqueio manual impede novas vendas a prazo para este cliente. É diferente do score — score baixo nunca bloqueia, só exibe aviso.
                    </Text>

                    <View style={m.blockRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={m.blockLabel}>{isBlocked ? "Cliente bloqueado" : "Cliente ativo"}</Text>
                        {isBlocked && !!profile?.blocked_reason && (
                          <Text style={m.blockReason}>Motivo: {profile.blocked_reason}</Text>
                        )}
                      </View>
                      <Switch
                        value={isBlocked}
                        onValueChange={handleBlockToggle}
                        trackColor={{ false: Colors.bg4, true: Colors.red }}
                        thumbColor="#fff"
                        disabled={blockMut.isPending}
                      />
                    </View>

                    {blockingAction === "block" && !isBlocked && (
                      <>
                        <Text style={[m.fieldLabel, { marginTop: 14 }]}>Motivo (opcional)</Text>
                        <TextInput
                          style={[m.termsInput, { minHeight: 72, textAlignVertical: "top" }]}
                          value={blockReason}
                          onChangeText={setBlockReason}
                          placeholder="Ex: Inadimplência por 60+ dias"
                          placeholderTextColor={Colors.ink3}
                          multiline
                        />
                        <Pressable
                          style={[m.cta, { marginTop: 12, backgroundColor: Colors.red }, blockMut.isPending && { opacity: 0.5 }]}
                          onPress={confirmBlock}
                          disabled={blockMut.isPending}
                        >
                          {blockMut.isPending
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={m.ctaTxt}>Confirmar bloqueio</Text>}
                        </Pressable>
                        <Pressable
                          style={[m.cta, { marginTop: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
                          onPress={() => setBlockingAction(null)}
                        >
                          <Text style={[m.ctaTxt, { color: Colors.ink2 }]}>Cancelar</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Entrega 4: editor inline de vencimento de parcela */}
          {editingDueDateInst && (
            <View style={m.editDueDateSheet}>
              <View style={m.editDueDateHeader}>
                <Text style={m.editDueDateTitle}>Alterar Vencimento</Text>
                <Pressable onPress={() => { setEditingDueDateInst(null); setEditDueDateError(""); }} style={m.xBtn}>
                  <Icon name="x" size={13} color={Colors.ink3} />
                </Pressable>
              </View>
              <Text style={m.editDueDateSub}>
                Parcela {editingDueDateInst.installment_number}/{editingDueDateInst.total_installments} · parcelas seguintes serão recalculadas.
              </Text>
              <Text style={[m.fieldLabel, { marginBottom: 6, marginTop: 4 }]}>NOVA DATA (DD/MM/AAAA)</Text>
              <DateInput
                value={editDueDateInput}
                onChangeText={v => { setEditDueDateInput(v); setEditDueDateError(""); }}
                placeholder="15/07/2026"
                forceShowError={!!editDueDateError}
              />
              {!!editDueDateError && (
                <Text style={{ color: Colors.red, fontSize: 12, marginTop: 4 }}>{editDueDateError}</Text>
              )}
              <View style={{ flexDirection: "row", gap: 9, marginTop: 14 }}>
                <Pressable
                  style={[m.cta, { flex: 1, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
                  onPress={() => { setEditingDueDateInst(null); setEditDueDateError(""); }}
                >
                  <Text style={[m.ctaTxt, { color: Colors.ink3 }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[m.cta, { flex: 2 }, editDueDateMut.isPending && { opacity: 0.5 }]}
                  onPress={handleEditDueDateConfirm}
                  disabled={editDueDateMut.isPending}
                >
                  {editDueDateMut.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={m.ctaTxt}>Confirmar</Text>}
                </Pressable>
              </View>
            </View>
          )}

          {/* Footer */}
          {tab === "resumo" && (
            <View style={m.footer}>
              <Pressable
                style={[m.cta, (amountNum <= 0 || dateInvalid || payMut.isPending) && { opacity: 0.45 }]}
                disabled={amountNum <= 0 || dateInvalid || payMut.isPending}
                onPress={confirmReceive}
              >
                {payMut.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={m.ctaTxt}>{amountNum > 0 ? `Confirmar recebimento de ${fmt(amountNum)}` : "Registrar recebimento"}</Text>}
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 16 },
  sheet: { backgroundColor: Colors.bg2, borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "90%", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },

  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  crumb: { flexDirection: "row", alignItems: "center", gap: 5 },
  crumbTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  xBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },

  body: { flexGrow: 0 },

  // Tabs
  tabs: { flexDirection: "row", gap: 6, marginBottom: 14 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  tabTxt: { fontSize: 11, fontWeight: "700", color: Colors.ink2 },
  tabTxtOn: { color: "#fff" },

  // Score banner
  scoreBanner: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: Colors.amber + "18", borderWidth: 1, borderColor: Colors.amber + "44", borderRadius: 11, padding: 12, marginBottom: 13 },
  scoreBannerTxt: { flex: 1, fontSize: 12, color: Colors.amber, lineHeight: 17 },
  scorePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  scorePillTxt: { fontSize: 10, fontWeight: "700" },

  cust: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  custL: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 18, fontWeight: "700", color: Colors.violet3 },
  custName: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  custSub: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  pillTxt: { fontSize: 10, fontWeight: "700" },
  waBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.4)", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  waTxt: { fontSize: 12, fontWeight: "700", color: Colors.green },

  card: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, marginBottom: 13 },

  // Hero "Em aberto"
  heroCard: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 16, padding: 18, marginBottom: 13, alignItems: "center" },
  heroLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: Colors.violet3, textTransform: "uppercase", marginBottom: 6 },
  heroValue: { fontSize: 34, fontWeight: "800", marginBottom: 4 },
  heroSub: { fontSize: 12, color: Colors.ink3, textAlign: "center" },

  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  rowK: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  rowKsub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  rowV: { fontSize: 17, fontWeight: "800" },

  newAccBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  newAccTxt: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  newAccRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  newAccInput: { flex: 1, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, color: Colors.ink, fontSize: 13, backgroundColor: Colors.bg2 },
  newAccConfirm: { backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  newAccConfirmTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },

  accCard: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 4, paddingBottom: 4 },
  accTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  accName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  accMeta: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 5 },
  accBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  accBadgeTxt: { fontSize: 10, fontWeight: "700" },
  accBalance: { fontSize: 16, fontWeight: "800" },
  accNextDue: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  accActions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  accActionBtn: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 7 },
  accActionWa: { backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.35)" },
  accActionTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  accInstList: { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },

  parc: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: Colors.border },
  parcT: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  parcS: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  receberBtn: { backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  receberTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Fase 2: breakdown encargos
  chargesBreakdown: { marginTop: 7, backgroundColor: Colors.bg2, borderRadius: 9, padding: 9, borderWidth: 1, borderColor: Colors.border2 },
  chargesRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  chargesLbl: { fontSize: 11, color: Colors.ink3, flex: 1 },
  chargesVal: { fontSize: 11, fontWeight: "700", color: Colors.ink },
  chargesDaysChip: { fontSize: 10, color: Colors.amber, fontWeight: "700" },
  chargesTotalRow: { borderTopWidth: 1, borderTopColor: Colors.border2, paddingTop: 5, marginTop: 2, marginBottom: 0 },
  chargesTotalLbl: { fontSize: 12, fontWeight: "700", color: Colors.ink, flex: 1 },
  chargesTotalVal: { fontSize: 13, fontWeight: "800", color: Colors.red },

  // Fase 2: resumo encargos após recebimento
  chargesSummary: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: Colors.border2 },
  chargesSummaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  chargesSummaryLbl: { fontSize: 12, color: Colors.ink3 },
  chargesSummaryVal: { fontSize: 13, fontWeight: "800", color: Colors.ink },

  freeBox: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 14, marginBottom: 13 },
  freeTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.violet3, textTransform: "uppercase", marginBottom: 10 },
  modeRow: { flexDirection: "row", gap: 7, marginBottom: 10 },
  modeChip: { flex: 1, alignItems: "center", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingVertical: 8 },
  modeChipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  modeChipTxt: { fontSize: 11, fontWeight: "700", color: Colors.ink2, textAlign: "center" },
  modeChipTxtOn: { color: "#fff" },
  fieldBlock: { marginTop: 4 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: Colors.ink3, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 },
  chip: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  chipTxt: { fontSize: 11, fontWeight: "700", color: Colors.ink2 },
  chipTxtOn: { color: "#fff" },
  distRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  distLabel: { flex: 1, fontSize: 12, fontWeight: "600", color: Colors.ink },
  distInput: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  distField: { width: 80, color: Colors.ink, fontSize: 13, fontWeight: "700", paddingVertical: 0 },
  distTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border2 },
  distTotalLbl: { fontSize: 12, color: Colors.ink3 },
  distTotalVal: { fontSize: 14, fontWeight: "800", color: Colors.amber },
  amountIn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg2, borderWidth: 1.5, borderColor: Colors.violet2, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11 },
  amountPrefix: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  amountInput: { flex: 1, color: Colors.ink, fontSize: 20, fontWeight: "800", paddingVertical: 0 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  qChip: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  qChipTxt: { fontSize: 11, fontWeight: "700", color: Colors.ink2 },
  dateInput: { backgroundColor: Colors.bg2, borderColor: Colors.violet2, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: Colors.ink },
  dateHint: { fontSize: 11, color: Colors.ink3, marginTop: 6 },
  methods: { flexDirection: "row", gap: 7 },
  method: { flex: 1, alignItems: "center", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingVertical: 9 },
  methodActive: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  methodTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  after: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: Colors.border2 },
  afterK: { fontSize: 12, color: Colors.ink3 },
  afterV: { fontSize: 14, fontWeight: "800", color: Colors.amber },

  tlItem: { flexDirection: "row", gap: 11, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  tlLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  tlMain: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  tlAmt: { fontSize: 13, fontWeight: "800" },
  tlSub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  tlAccTag: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  tlAccTagTxt: { fontSize: 10, fontWeight: "700", color: Colors.violet3 },
  emptyTxt: { fontSize: 12, color: Colors.ink3, paddingVertical: 6 },

  // Termos
  termsHint: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 10 },
  termsEffRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.bg2, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: Colors.border2 },
  termsEffLbl: { fontSize: 12, color: Colors.ink3 },
  termsEffVal: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  termsInput: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg2 },

  // Bloqueio
  blockRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  blockLabel: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  blockReason: { fontSize: 12, color: Colors.ink3, marginTop: 2 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  cta: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  ctaTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Entrega 4: botão calendário em parcelas + sheet de edição
  calBtn: {
    backgroundColor: Colors.violetD, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
    minWidth: 30, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.violet + "44",
  },
  editDueDateSheet: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 16, backgroundColor: Colors.bg3,
  },
  editDueDateHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6,
  },
  editDueDateTitle: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  editDueDateSub: { fontSize: 11, color: Colors.ink3, marginBottom: 10, lineHeight: 16 },

} as any);

export default ClienteCrediarioModal;
