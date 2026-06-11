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
//
// DESIGN-38 Onda C-2 (11/06/2026):
//   - Header fixo (fichaHeaderFixed): nome/status/score/limite/saldo fora do ScrollView.
//   - Barra de ações persistente (fichaActionBar) no rodapé: Receber + Valor Livre.
//   - "Novo lançamento" omitido — sem handler na ficha (comentário C-2).
//   - ScrollView agora flex:1 entre header fixo e action bar.
//
// hotfix (11/06/2026): restaura 7 call-sites do creditApi quebrados pelo #226.
// ============================================================
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView,
  TextInput, ActivityIndicator, Switch, Clipboard, Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  creditApi, printCarne,
  type CreditAccount, type CreditInstallment, type PaymentAllocation, type CustomerTermsOverrides,
  type CreditHistoryEvent, type PaymentPlan, type CreditPix,
} from "@/services/creditApi";
import QRCode from "react-native-qrcode-svg";
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
type Tab = "parcelas" | "historico" | "conta" | "termos" | "bloqueio";

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
  const [tab, setTab] = useState<Tab>("parcelas");

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

  // DESIGN-38 B2: Pix por parcela
  const [pixInstId, setPixInstId] = useState<string | null>(null);
  const [pixData, setPixData] = useState<CreditPix | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  // DESIGN-38 B3: Receber valor livre com preview FIFO
  const [freeAmt, setFreeAmt] = useState("");
  const [freeMethod, setFreeMethod] = useState("dinheiro");
  const [freeDateBr, setFreeDateBr] = useState(todayBrSp());
  const [freeAccountId, setFreeAccountId] = useState<string | null | undefined>(undefined);
  const [freePreview, setFreePreview] = useState<PaymentPlan | null>(null);
  const [freePreviewLoading, setFreePreviewLoading] = useState(false);
  const [freeSubmitting, setFreeSubmitting] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Encargos quitados (Fase 2)
  const [lastChargesPaid, setLastChargesPaid] = useState<number | null>(null);
  const [lastTotalPaid, setLastTotalPaid] = useState<number | null>(null);

  // Histórico
  const [histCursor, setHistCursor] = useState<string | null | undefined>(undefined);
  const [histItems, setHistItems] = useState<CreditHistoryEvent[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histHasMore, setHistHasMore] = useState(false);

  const detailQ = useQuery({
    queryKey: ["credit-customer", companyId, customerId],
    queryFn: () => creditApi.getCustomerHistory(companyId, customerId!),
    enabled: !!companyId && !!customerId && visible,
    staleTime: 30_000,
  });
  const profileQ = useQuery({
    queryKey: ["credit-profile", companyId, customerId],
    queryFn: () => creditApi.getCustomerProfile(companyId, customerId!),
    enabled: !!companyId && !!customerId && visible,
    staleTime: 30_000,
  });

  const detail = detailQ.data;
  const profile = profileQ.data;

  const accounts: CreditAccount[] = useMemo(() => {
    const raw = detail?.accounts || [];
    const general = raw.find(a => a.id == null);
    const named = raw.filter(a => a.id != null);
    return general ? [...named, general] : named;
  }, [detail?.accounts]);

  // Carnês reais (com id)
  const realCarnes = useMemo(() => accounts.filter(a => a && a.id != null), [accounts]);
  const useCarneLayout = realCarnes.length > 0;
  const hasAccounts = accounts.length > 0;

  const installments: CreditInstallment[] = useMemo(() => detail?.installments || [], [detail?.installments]);

  // instByAccount: Map<account_id | null, CreditInstallment[]>
  const instByAccount = useMemo(() => {
    const map = new Map<string | null | undefined, CreditInstallment[]>();
    for (const inst of installments) {
      const key = inst.account_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inst);
    }
    return map;
  }, [installments]);

  const totalBalance = hasAccounts
    ? accounts.reduce((s, a) => s + (a.balance ?? 0), 0)
    : installments.reduce((s, i) => s + (i.remaining ?? (i.amount_due - (i.covered_amount || 0))), 0);

  const openInst = useMemo(
    () => installments.filter(i => i.status === "open" || i.status === "overdue"),
    [installments]
  );

  const overdueAccounts = useMemo(() => {
    const map = new Map<string | null, typeof openInst>();
    for (const inst of openInst) {
      if (inst.status !== "overdue") continue;
      const key = inst.account_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inst);
    }
    return [...map.entries()];
  }, [openInst]);

  const hasOverdue = overdueAccounts.length > 0 || openInst.some(i => i.status === "overdue");
  const openSum = openInst.reduce((s, i) => s + (i.remaining ?? (i.amount_due - (i.covered_amount || 0))), 0);

  // Distribuição total
  const distributionTotal = useMemo(() => {
    return Object.values(distributions).reduce((s, v) => s + parseAmount(v), 0);
  }, [distributions]);

  const nextDueDate = openInst.length > 0
    ? openInst.reduce((best, i) => {
        if (!best) return i.due_date;
        return i.due_date < best ? i.due_date : best;
      }, "" as string)
    : "";

  const amountNum = receiveMode === "distribute" ? distributionTotal : parseAmount(amount);
  const afterBalance = Math.max(0, Math.round((totalBalance - amountNum) * 100) / 100);
  const dateInvalid = !parseBrDate(dateBr);

  const isBlocked = profile?.status === "blocked";

  const payMut = useMutation({
    mutationFn: async () => {
      const paid_at = parseBrDate(dateBr)?.toISOString();
      if (receiveMode === "distribute") {
        const allocations: PaymentAllocation[] = accounts
          .map(acc => ({ account_id: acc.id, amount: parseAmount(distributions[acc.id ?? "general"] || "0") }))
          .filter(d => d.amount > 0);
        return creditApi.receivePayment(companyId, customerId!, {
          payment_method: method,
          paid_at,
          allocations,
        });
      }
      return creditApi.receivePayment(companyId, customerId!, {
        amount: amountNum,
        payment_method: method,
        paid_at,
        account_id: fifoAccountId,
      });
    },
    onSuccess: (res: any) => {
      const cp = res?.charges_paid ?? 0;
      const tp = res?.total_paid ?? 0;
      setLastChargesPaid(cp);
      setLastTotalPaid(tp);
      if (cp > 0) {
        toast.success(
          `Recebimento registrado!\n` +
          `Encargos quitados: ${fmt(cp)} · Abatido do principal: ${fmt(Math.max(0, tp - cp))}`
        );
      } else {
        toast.success("Recebimento registrado! Saldo: " + fmt(res.new_balance));
      }
      setAmount("");
      setDistributions({});
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      onChanged?.();
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao registrar recebimento"),
  });

  const editDueDateMut = useMutation({
    mutationFn: async ({ installmentId, newDate }: { installmentId: string; newDate: string }) =>
      creditApi.editInstallmentDueDate(companyId, customerId!, installmentId, newDate),
    onSuccess: () => {
      toast.success("Vencimento atualizado!");
      setEditingDueDateInst(null);
      setEditDueDateError("");
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
    },
    onError: (err: any) => {
      setEditDueDateError(err?.data?.error || "Erro ao atualizar vencimento");
    },
  });

  function handleBlockToggle() {
    if (isBlocked) {
      setBlockingAction("unblock");
    } else {
      setBlockingAction("block");
      setBlockReason("");
    }
  }

  function confirmBlock() {
    if (!blockingAction || !customerId) return;
    creditApi.blockCustomer(companyId, customerId, blockingAction, blockReason || undefined)
      .then(() => {
        toast.success(isBlocked ? "Cliente desbloqueado" : "Cliente bloqueado");
        qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
        qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
        setBlockingAction(null);
        onChanged?.();
      })
      .catch((err: any) => toast.error(err?.data?.error || "Erro ao alterar bloqueio"));
  }

  async function saveTerms() {
    if (!customerId) return;
    setSavingTerms(true);
    try {
      const overrides: CustomerTermsOverrides = {};
      const mi = parseInt(termsMaxInst);
      if (!isNaN(mi) && mi > 0) overrides.max_installments = mi;
      const ir = parseFloat(termsInterest.replace(",", "."));
      if (!isNaN(ir) && ir >= 0) overrides.interest_rate = ir;
      await creditApi.updateCustomerTerms(companyId, customerId, Object.keys(overrides).length ? overrides : null);
      toast.success("Termos salvos!");
      setTermsDirty(false);
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao salvar termos");
    } finally {
      setSavingTerms(false);
    }
  }

  useEffect(() => {
    if (!visible) {
      setTab("parcelas");
      setAmount("");
      setMethod("dinheiro");
      setDateBr(todayBrSp());
      setReceiveMode("fifo");
      setFifoAccountId(undefined);
      setDistributions({});
      setExpandedAccountId(undefined);
      setShowNewAccount(false);
      setNewAccountName("");
      setBlockReason("");
      setBlockingAction(null);
      setTermsMaxInst("");
      setTermsInterest("");
      setTermsDirty(false);
      setFreeAmt("");
      setFreeMethod("dinheiro");
      setFreeDateBr(todayBrSp());
      setFreeAccountId(undefined);
      setFreePreview(null);
      setLastChargesPaid(null);
      setLastTotalPaid(null);
      setHistCursor(undefined);
      setHistItems([]);
      setHistHasMore(false);
      setPixInstId(null);
      setPixData(null);
      setEditingDueDateInst(null);
      setEditDueDateInput("");
      setEditDueDateError("");
    }
  }, [visible]);

  useEffect(() => {
    if (profile?.terms) {
      const ov = profile.terms.overrides;
      setTermsMaxInst(ov?.max_installments != null ? String(ov.max_installments) : "");
      setTermsInterest(ov?.interest_rate != null ? String(ov.interest_rate) : "");
      setTermsDirty(false);
    }
  }, [profile?.terms]);

  function confirmReceive() {
    if (amountNum <= 0 || dateInvalid) return;
    payMut.mutate();
  }
  function prefill(v: number) { setAmount(v.toFixed(2).replace(".", ",")); }

  async function handleCreateAccount() {
    if (!newAccountName.trim() || !customerId) return;
    setCreatingAccount(true);
    try {
      await creditApi.createAccount(companyId, customerId, newAccountName.trim());
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

  function handleEditDueDateOpen(inst: CreditInstallment) {
    setEditingDueDateInst(inst);
    setEditDueDateInput(inst.due_date ? formatIsoToBr(inst.due_date) : "");
    setEditDueDateError("");
  }

  function handleEditDueDateConfirm() {
    if (!editingDueDateInst) return;
    const parsed = parseBrDate(editDueDateInput);
    if (!parsed) { setEditDueDateError("Data inválida"); return; }
    const newIso = parsed.toISOString().split("T")[0];
    editDueDateMut.mutate({ installmentId: editingDueDateInst.id, newDate: newIso });
  }

  async function loadHistory(cursor?: string | null) {
    if (!customerId || histLoading) return;
    setHistLoading(true);
    try {
      const res = await creditApi.getHistoryTimeline(companyId, customerId, {
        limit: 20,
        cursor: cursor || undefined,
      });
      if (cursor) {
        setHistItems(prev => [...prev, ...res.events]);
      } else {
        setHistItems(res.events);
      }
      setHistHasMore(!!res.next_cursor);
      setHistCursor(res.next_cursor);
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao carregar histórico");
    } finally {
      setHistLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "historico" && visible && customerId && histItems.length === 0) {
      loadHistory(null);
    }
  }, [tab, visible, customerId]);

  // Preview FIFO debounced
  const triggerPreview = useCallback((amt: string, accId: string | null | undefined) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    const n = parseAmount(amt);
    if (n <= 0) { setFreePreview(null); return; }
    previewTimerRef.current = setTimeout(async () => {
      setFreePreviewLoading(true);
      try {
        const res = await creditApi.previewPayment(companyId, customerId!, {
          amount: n,
          account_id: accId ?? null,
        });
        setFreePreview(res);
      } catch {
        setFreePreview(null);
      } finally {
        setFreePreviewLoading(false);
      }
    }, 450);
  }, [companyId, customerId]);

  async function confirmFreePayment() {
    const n = parseAmount(freeAmt);
    if (n <= 0 || !customerId) return;
    const paid_at = parseBrDate(freeDateBr)?.toISOString();
    setFreeSubmitting(true);
    try {
      const res = await creditApi.receiveFreePayment(companyId, customerId!, {
        amount: n,
        account_id: freeAccountId ?? null,
        method: freeMethod,
        paid_at,
      });
      const cp = res?.charges_paid ?? 0;
      const tp = res?.total_paid ?? res?.amount_applied ?? n;
      if (cp > 0) {
        toast.success(`Recebido! Encargos quitados: ${fmt(cp)} · Principal: ${fmt(Math.max(0, tp - cp))}`);
      } else {
        toast.success(`Recebido! Novo saldo: ${fmt(res.new_balance)}`);
      }
      setFreeAmt("");
      setFreePreview(null);
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao registrar recebimento");
    } finally {
      setFreeSubmitting(false);
    }
  }

  // DESIGN-38: Pix por parcela (B2)
  async function openInstallmentPix(installmentId: string) {
    setPixInstId(installmentId);
    setPixData(null);
    setPixLoading(true);
    try {
      const res = await creditApi.getInstallmentPix(companyId, installmentId);
      setPixData(res);
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao gerar Pix da parcela");
      setPixInstId(null);
    } finally {
      setPixLoading(false);
    }
  }

  const hasTermsOverride = !!profile?.terms?.overrides &&
    Object.values(profile.terms.overrides).some(v => v != null);

  const scoreWarning = profile?.score_warning;
  const scoreLabel = profile?.score_label;
  const availableLimit = profile?.available_limit;

  if (!customerId) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={m.backdrop} onPress={onClose}>
        <Pressable style={m.sheet} onPress={e => e.stopPropagation()}>

          {/* Header modal */}
          <View style={m.head}>
            <View style={m.crumb}>
              <Icon name="credit-card" size={14} color={Colors.violet3} />
              <Text style={m.crumbTxt}>Crediário</Text>
            </View>
            <Pressable onPress={onClose} style={m.xBtn}>
              <Icon name="x" size={13} color={Colors.ink3} />
            </Pressable>
          </View>

          {/* C-2: Header fixo da ficha */}
          <View style={m.fichaHeaderFixed}>
            {/* Score warning banner no header */}
            {!!scoreWarning && (
              <View style={[m.scoreBanner, { marginBottom: 10 }]}>
                <Icon name="alert-triangle" size={15} color={Colors.amber} />
                <Text style={m.scoreBannerTxt}>
                  Score abaixo do mínimo ({scoreWarning.actual} / mín {scoreWarning.threshold}) — aviso apenas, não bloqueia.
                </Text>
              </View>
            )}
            <View style={m.fichaHeaderTop}>
              {/* Avatar + nome */}
              <View style={m.custL}>
                <View style={m.avatar}>
                  <Text style={m.avatarTxt}>{(customerName ?? "?")[0].toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={m.custName}>{customerName ?? "Cliente"}</Text>
                  <View style={m.custSub}>
                    <View style={[m.dot, { backgroundColor: isBlocked ? Colors.red : Colors.green }]} />
                    <Text style={{ fontSize: 11, color: Colors.ink3 }}>{isBlocked ? "Bloqueado" : "Ativo"}</Text>
                    {!!scoreLabel && (
                      <View style={[m.scorePill, { backgroundColor: scoreColor(scoreLabel) + "22", borderWidth: 1, borderColor: scoreColor(scoreLabel) + "55" }]}>
                        <Text style={[m.scorePillTxt, { color: scoreColor(scoreLabel) }]}>{scoreLabelPt(scoreLabel)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              {/* WhatsApp btn */}
              {!!onCobrar && (
                <Pressable
                  style={m.waBtn}
                  onPress={() => onCobrar(customerId, customerName ?? "", null)}
                >
                  <Icon name="message-circle" size={14} color={Colors.green} />
                  <Text style={m.waTxt}>Cobrar</Text>
                </Pressable>
              )}
            </View>
            {/* Meta chips: limite / disponível / saldo */}
            <View style={m.fichaHeaderMeta}>
              {availableLimit != null && (
                <View style={m.fichaMetaItem}>
                  <Text style={m.fichaMetaLbl}>Disponível</Text>
                  <Text style={[m.fichaMetaVal, { color: availableLimit > 0 ? Colors.green : Colors.red }]}>
                    {fmt(availableLimit)}
                  </Text>
                </View>
              )}
              {profile?.credit_limit != null && (
                <View style={m.fichaMetaItem}>
                  <Text style={m.fichaMetaLbl}>Limite</Text>
                  <Text style={m.fichaMetaVal}>{fmt(profile.credit_limit)}</Text>
                </View>
              )}
              <View style={m.fichaMetaItem}>
                <Text style={m.fichaMetaLbl}>Em aberto</Text>
                <Text style={[m.fichaMetaVal, { color: totalBalance > 0 ? Colors.red : Colors.ink3 }]}>
                  {fmt(totalBalance)}
                </Text>
              </View>
            </View>
          </View>

          {/* ScrollView flex:1 entre header e action bar */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[m.body, { padding: 16 }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Tabs */}
            <View style={m.tabs}>
              {(["parcelas", "historico", "conta", "termos", "bloqueio"] as Tab[]).map(t => (
                <Pressable key={t} style={[m.tab, m.tabSm, tab === t && m.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[m.tabTxt, tab === t && m.tabTxtOn]}>
                    {t === "parcelas" ? "Parcelas" : t === "historico" ? "Histórico" : t === "conta" ? "Carnê" : t === "termos" ? "Termos" : "Bloqueio"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {detailQ.isLoading || profileQ.isLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <ActivityIndicator color={Colors.violet3} />
              </View>
            ) : (
              <>
                {/* ===== TAB PARCELAS ===== */}
                {tab === "parcelas" && (
                  <>
                    {/* Hero EM ABERTO */}
                    <View style={m.heroCard}>
                      <Text style={m.heroLabel}>Em Aberto</Text>
                      <Text style={[m.heroValue, { color: totalBalance > 0 ? Colors.red : Colors.green }]}>
                        {fmt(totalBalance)}
                      </Text>
                      {nextDueDate ? (
                        <Text style={m.heroSub}>Próximo venc: {fmtDate(nextDueDate)}</Text>
                      ) : openInst.length === 0 ? (
                        <Text style={m.heroSub}>Sem parcelas em aberto</Text>
                      ) : null}
                    </View>

                    {/* Receber (modo FIFO / distribuição) */}
                    <View style={m.freeBox}>
                      <Text style={m.freeTitle}>Receber</Text>

                      {hasAccounts && (
                        <View style={m.modeRow}>
                          <Pressable
                            style={[m.modeChip, receiveMode === "fifo" && m.modeChipOn]}
                            onPress={() => setReceiveMode("fifo")}
                          >
                            <Text style={[m.modeChipTxt, receiveMode === "fifo" && m.modeChipTxtOn]}>FIFO automático</Text>
                          </Pressable>
                          <Pressable
                            style={[m.modeChip, receiveMode === "distribute" && m.modeChipOn]}
                            onPress={() => setReceiveMode("distribute")}
                          >
                            <Text style={[m.modeChipTxt, receiveMode === "distribute" && m.modeChipTxtOn]}>Distribuir por carnê</Text>
                          </Pressable>
                        </View>
                      )}

                      {receiveMode === "fifo" ? (
                        <>
                          {/* Filtro por carnê */}
                          {hasAccounts && (
                            <View style={[m.fieldBlock, { marginBottom: 10 }]}>
                              <Text style={m.fieldLabel}>Carnê</Text>
                              <View style={m.chipRow}>
                                <Pressable
                                  style={[m.chip, fifoAccountId === undefined && m.chipOn]}
                                  onPress={() => setFifoAccountId(undefined)}
                                >
                                  <Text style={[m.chipTxt, fifoAccountId === undefined && m.chipTxtOn]}>Todos</Text>
                                </Pressable>
                                {accounts.map(acc => (
                                  <Pressable
                                    key={acc.id ?? "general"}
                                    style={[m.chip, fifoAccountId === acc.id && m.chipOn]}
                                    onPress={() => setFifoAccountId(acc.id)}
                                  >
                                    <Text style={[m.chipTxt, fifoAccountId === acc.id && m.chipTxtOn]}>
                                      {acc.name}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          )}
                          <Text style={m.fieldLabel}>Valor</Text>
                          <View style={m.amountIn}>
                            <Text style={m.amountPrefix}>R$</Text>
                            <TextInput
                              style={m.amountInput}
                              value={amount}
                              onChangeText={setAmount}
                              placeholder="0,00"
                              placeholderTextColor={Colors.ink3}
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={m.quickRow}>
                            {[50, 100, 200, 500].map(v => (
                              <Pressable key={v} style={m.qChip} onPress={() => prefill(v)}>
                                <Text style={m.qChipTxt}>R${v}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </>
                      ) : (
                        <>
                          {accounts.map(acc => (
                            <View key={acc.id ?? "general"} style={m.distRow}>
                              <Text style={m.distLabel}>{acc.name}</Text>
                              <View style={m.distInput}>
                                <Text style={m.amountPrefix}>R$</Text>
                                <TextInput
                                  style={m.distField}
                                  value={distributions[acc.id ?? "general"] || ""}
                                  onChangeText={v => setDistributions(prev => ({ ...prev, [acc.id ?? "general"]: v }))}
                                  placeholder="0,00"
                                  placeholderTextColor={Colors.ink3}
                                  keyboardType="decimal-pad"
                                />
                              </View>
                            </View>
                          ))}
                          <View style={m.distTotal}>
                            <Text style={m.distTotalLbl}>Total</Text>
                            <Text style={m.distTotalVal}>{fmt(distributionTotal)}</Text>
                          </View>
                        </>
                      )}

                      <View style={[m.fieldBlock, { marginTop: 12 }]}>
                        <Text style={m.fieldLabel}>Data</Text>
                        <DateInput
                          value={dateBr}
                          onChangeText={setDateBr}
                          placeholder="DD/MM/AAAA"
                          forceShowError={dateInvalid && amount !== ""}
                        />
                      </View>

                      <View style={[m.fieldBlock, { marginTop: 10 }]}>
                        <Text style={m.fieldLabel}>Método</Text>
                        <View style={m.methods}>
                          {PAYMENT_METHODS.map(pm => (
                            <Pressable
                              key={pm.key}
                              style={[m.method, method === pm.key && m.methodActive]}
                              onPress={() => setMethod(pm.key)}
                            >
                              <Text style={[m.methodTxt, method === pm.key && { color: "#fff" }]}>{pm.label}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View style={m.after}>
                        <Text style={m.afterK}>Saldo após</Text>
                        <Text style={m.afterV}>{fmt(afterBalance)}</Text>
                      </View>
                    </View>

                    {/* Lista de parcelas */}
                    {useCarneLayout ? (
                      // Layout carnês
                      <View style={m.card}>
                        <View style={m.cardTitleRow}>
                          <Text style={m.cardTitle}>Carnês</Text>
                          <Pressable
                            style={m.newAccBtn}
                            onPress={() => setShowNewAccount(v => !v)}
                          >
                            <Icon name="plus" size={11} color={Colors.violet3} />
                            <Text style={m.newAccTxt}>Novo carnê</Text>
                          </Pressable>
                        </View>

                        {showNewAccount && (
                          <View style={m.newAccRow}>
                            <TextInput
                              style={m.newAccInput}
                              value={newAccountName}
                              onChangeText={setNewAccountName}
                              placeholder="Nome do carnê"
                              placeholderTextColor={Colors.ink3}
                              autoFocus
                            />
                            <Pressable
                              style={[m.newAccConfirm, creatingAccount && { opacity: 0.5 }]}
                              onPress={handleCreateAccount}
                              disabled={creatingAccount}
                            >
                              {creatingAccount
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={m.newAccConfirmTxt}>OK</Text>}
                            </Pressable>
                          </View>
                        )}

                        {realCarnes.map(acc => {
                          const accInst = instByAccount.get(acc.id) ?? [];
                          const isExpanded = expandedAccountId === acc.id;
                          return (
                            <View key={acc.id} style={m.accCard}>
                              <Pressable
                                style={m.accTop}
                                onPress={() => setExpandedAccountId(isExpanded ? undefined : acc.id)}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={m.accName}>{acc.name}</Text>
                                  <View style={m.accMeta}>
                                    <View style={[m.accBadge, {
                                      backgroundColor: acc.overdue ? Colors.red + "18" : Colors.green + "18",
                                      borderColor: acc.overdue ? Colors.red + "44" : Colors.green + "44",
                                    }]}>
                                      <Text style={[m.accBadgeTxt, { color: acc.overdue ? Colors.red : Colors.green }]}>
                                        {acc.overdue ? "Em atraso" : "Em dia"}
                                      </Text>
                                    </View>
                                    <Text style={m.accBadgeTxt}>{periodLabel(acc)}</Text>
                                  </View>
                                  <Text style={m.accBalance}>{fmt(acc.balance)}</Text>
                                  {acc.next_due_date && (
                                    <Text style={m.accNextDue}>Próx: {fmtDate(acc.next_due_date)}</Text>
                                  )}
                                </View>
                                <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.ink3} />
                              </Pressable>

                              {isExpanded && (
                                <View style={m.accInstList}>
                                  {accInst.length === 0 ? (
                                    <Text style={[m.emptyTxt, { paddingTop: 10 }]}>Sem parcelas</Text>
                                  ) : accInst.map(inst => (
                                    <InstallmentRow
                                      key={inst.id}
                                      inst={inst}
                                      onEditDueDate={handleEditDueDateOpen}
                                      onOpenPix={openInstallmentPix}
                                      pixLoadingId={pixLoading ? pixInstId : null}
                                    />
                                  ))}
                                </View>
                              )}

                              <View style={m.accActions}>
                                <Pressable
                                  style={m.accActionBtn}
                                  onPress={() => { setFifoAccountId(acc.id); setReceiveMode("fifo"); }}
                                >
                                  <Text style={m.accActionTxt}>Receber</Text>
                                </Pressable>
                                {!!pixKey && (
                                  <Pressable style={[m.accActionBtn, m.accActionWa]}>
                                    <Text style={[m.accActionTxt, { color: Colors.green }]}>Pix</Text>
                                  </Pressable>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      // Layout plano (sem carnês reais)
                      <View style={m.card}>
                        <Text style={m.cardTitle}>Parcelas em aberto</Text>
                        {openInst.length === 0 ? (
                          <Text style={m.emptyTxt}>Sem parcelas em aberto.</Text>
                        ) : openInst.map(inst => (
                          <InstallmentRow
                            key={inst.id}
                            inst={inst}
                            onEditDueDate={handleEditDueDateOpen}
                            onOpenPix={openInstallmentPix}
                            pixLoadingId={pixLoading ? pixInstId : null}
                          />
                        ))}
                      </View>
                    )}

                    {/* Parcelas pagas recentes */}
                    {installments.filter(i => i.status === "paid").length > 0 && (
                      <View style={m.card}>
                        <Text style={m.cardTitle}>Parcelas pagas</Text>
                        {installments.filter(i => i.status === "paid").slice(0, 5).map(inst => (
                          <View key={inst.id} style={m.parc}>
                            <View style={{ flex: 1 }}>
                              <Text style={m.parcT}>
                                Parcela {inst.installment_number}/{inst.total_installments}
                              </Text>
                              <Text style={m.parcS}>
                                Pago {inst.paid_at ? fmtDate(inst.paid_at) : ""} · {fmt(inst.amount_due)}
                              </Text>
                            </View>
                            <View style={[m.badge, { backgroundColor: Colors.green + "18", borderColor: Colors.green + "44" }]}>
                              <Text style={[m.badgeTxt, { color: Colors.green }]}>Pago</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Encargos quitados no último recebimento */}
                    {lastChargesPaid != null && lastChargesPaid > 0 && (
                      <View style={m.chargesSummary}>
                        <View style={m.chargesSummaryRow}>
                          <Text style={m.chargesSummaryLbl}>Encargos quitados</Text>
                          <Text style={m.chargesSummaryVal}>{fmt(lastChargesPaid)}</Text>
                        </View>
                        {lastTotalPaid != null && (
                          <View style={m.chargesSummaryRow}>
                            <Text style={m.chargesSummaryLbl}>Abatido do principal</Text>
                            <Text style={m.chargesSummaryVal}>{fmt(Math.max(0, lastTotalPaid - lastChargesPaid))}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}

                {/* ===== TAB HISTÓRICO ===== */}
                {tab === "historico" && (
                  <View style={m.card}>
                    <Text style={m.cardTitle}>Histórico</Text>
                    {histLoading && histItems.length === 0 && (
                      <ActivityIndicator color={Colors.violet3} style={{ marginVertical: 12 }} />
                    )}
                    {histItems.length === 0 && !histLoading && (
                      <Text style={m.emptyTxt}>Sem eventos.</Text>
                    )}
                    {histItems.map(ev => (
                      <View key={ev.id} style={m.tlItem}>
                        <View style={[m.tlDot, {
                          backgroundColor:
                            ev.type === "payment" ? Colors.green
                            : ev.type === "refund" || ev.type === "exchange_credit" ? Colors.amber
                            : Colors.red,
                        }]} />
                        <View style={{ flex: 1 }}>
                          <View style={m.tlLine}>
                            <Text style={m.tlMain}>
                              {ev.type === "purchase" ? "Compra"
                                : ev.type === "manual_debit" ? "Débito manual"
                                : ev.type === "payment" ? "Pagamento"
                                : ev.type === "exchange_credit" ? "Crédito troca"
                                : "Devolução"}
                            </Text>
                            <Text style={[m.tlAmt, { color: ev.amount > 0 ? Colors.red : Colors.green }]}>
                              {ev.amount > 0 ? "+" : ""}{fmt(Math.abs(ev.amount))}
                            </Text>
                          </View>
                          <Text style={m.tlSub}>{fmtDate(ev.occurred_at)}</Text>
                          {ev.account_id && (
                            <View style={[m.tlAccTag, { marginTop: 3, alignSelf: "flex-start" }]}>
                              <Text style={m.tlAccTagTxt}>
                                {accounts.find(a => a.id === ev.account_id)?.name ?? "Carnê"}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                    {histHasMore && (
                      <Pressable
                        style={[m.cta, { marginTop: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
                        onPress={() => loadHistory(histCursor)}
                        disabled={histLoading}
                      >
                        {histLoading
                          ? <ActivityIndicator color={Colors.violet3} size="small" />
                          : <Text style={[m.ctaTxt, { color: Colors.ink2 }]}>Carregar mais</Text>}
                      </Pressable>
                    )}
                  </View>
                )}

                {/* ===== TAB CONTA (Valor Livre B3) ===== */}
                {tab === "conta" && (
                  <View style={m.freeBox}>
                    <Text style={m.freeTitle}>Receber Valor Livre</Text>
                    {hasAccounts && (
                      <View style={[m.fieldBlock, { marginBottom: 10 }]}>
                        <Text style={m.fieldLabel}>Carnê (opcional)</Text>
                        <View style={m.chipRow}>
                          <Pressable
                            style={[m.chip, freeAccountId === undefined && m.chipOn]}
                            onPress={() => { setFreeAccountId(undefined); triggerPreview(freeAmt, undefined); }}
                          >
                            <Text style={[m.chipTxt, freeAccountId === undefined && m.chipTxtOn]}>Todos</Text>
                          </Pressable>
                          {accounts.map(acc => (
                            <Pressable
                              key={acc.id ?? "general"}
                              style={[m.chip, freeAccountId === acc.id && m.chipOn]}
                              onPress={() => { setFreeAccountId(acc.id); triggerPreview(freeAmt, acc.id); }}
                            >
                              <Text style={[m.chipTxt, freeAccountId === acc.id && m.chipTxtOn]}>{acc.name}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}
                    <Text style={m.fieldLabel}>Valor</Text>
                    <View style={m.amountIn}>
                      <Text style={m.amountPrefix}>R$</Text>
                      <TextInput
                        style={m.amountInput}
                        value={freeAmt}
                        onChangeText={v => { setFreeAmt(v); triggerPreview(v, freeAccountId); }}
                        placeholder="0,00"
                        placeholderTextColor={Colors.ink3}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[m.fieldBlock, { marginTop: 12 }]}>
                      <Text style={m.fieldLabel}>Data</Text>
                      <DateInput
                        value={freeDateBr}
                        onChangeText={setFreeDateBr}
                        placeholder="DD/MM/AAAA"
                      />
                    </View>
                    <View style={[m.fieldBlock, { marginTop: 10 }]}>
                      <Text style={m.fieldLabel}>Método</Text>
                      <View style={m.methods}>
                        {PAYMENT_METHODS.map(pm => (
                          <Pressable
                            key={pm.key}
                            style={[m.method, freeMethod === pm.key && m.methodActive]}
                            onPress={() => setFreeMethod(pm.key)}
                          >
                            <Text style={[m.methodTxt, freeMethod === pm.key && { color: "#fff" }]}>{pm.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    {/* Preview FIFO */}
                    {freePreviewLoading && (
                      <ActivityIndicator color={Colors.violet3} style={{ marginTop: 12 }} />
                    )}
                    {!freePreviewLoading && freePreview && (
                      <View style={m.previewBox}>
                        <Text style={m.previewTitle}>Aplicação prevista</Text>
                        {freePreview.applied.map((line, idx) => (
                          <View key={idx} style={m.previewRow}>
                            <Text style={m.previewLbl}>
                              Parcela {line.number ?? "?"}
                              {line.account_id ? ` · ${accounts.find(a => a.id === line.account_id)?.name ?? "Carnê"}` : ""}
                            </Text>
                            <Text style={m.previewVal}>
                              {line.charges_paid > 0 ? `${fmt(line.principal_paid)} + enc ${fmt(line.charges_paid)}` : fmt(line.principal_paid)}
                            </Text>
                          </View>
                        ))}
                        <View style={[m.previewRow, { marginTop: 6, borderTopWidth: 1, borderTopColor: Colors.border2, paddingTop: 6 }]}>
                          <Text style={[m.previewLbl, { fontWeight: "700" }]}>Novo saldo</Text>
                          <Text style={[m.previewVal, { color: freePreview.new_balance > 0 ? Colors.red : Colors.green }]}>
                            {fmt(freePreview.new_balance)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* ===== TAB CONTA — seção resumo da conta */}
                {tab === "conta" && (
                  <View style={m.card}>
                    <Text style={m.cardTitle}>Resumo</Text>
                    {profile ? (
                      <>
                        {profile.credit_limit > 0 && (
                          <View style={m.row}>
                            <Text style={m.rowK}>Limite</Text>
                            <Text style={m.rowV}>{fmt(profile.credit_limit)}</Text>
                          </View>
                        )}
                        {availableLimit != null && (
                          <View style={m.row}>
                            <Text style={m.rowK}>Disponível</Text>
                            <Text style={[m.rowV, { color: availableLimit > 0 ? Colors.green : Colors.red }]}>
                              {fmt(availableLimit)}
                            </Text>
                          </View>
                        )}
                        {profile.credit_score > 0 && (
                          <View style={m.row}>
                            <Text style={m.rowK}>Score</Text>
                            <Text style={[m.rowV, { color: scoreColor(profile.score_label) }]}>
                              {profile.credit_score} — {scoreLabelPt(profile.score_label)}
                            </Text>
                          </View>
                        )}
                        {profile.avg_days_late > 0 && (
                          <View style={m.row}>
                            <Text style={m.rowK}>Média dias de atraso</Text>
                            <Text style={[m.rowV, { color: Colors.amber }]}>{profile.avg_days_late.toFixed(1)}d</Text>
                          </View>
                        )}
                        <View style={m.row}>
                          <View>
                            <Text style={[m.rowK, { color: Colors.ink3, fontSize: 11 }]}>Compras / Pagas no prazo</Text>
                          </View>
                          <Text style={m.rowV}>
                            {profile.total_purchases} / {profile.total_paid_on_time}
                          </Text>
                        </View>
                        <View style={m.row}>
                          <Text style={m.rowK}>Em aberto</Text>
                          <Text style={[m.rowV, { color: totalBalance > 0 ? Colors.red : Colors.ink3 }]}>
                            {fmt(totalBalance)}
                          </Text>
                        </View>
                        <View style={m.row}>
                          <Text style={m.rowK}>Parcelas abertas</Text>
                          <Text style={m.rowV}>{openInst.length}</Text>
                        </View>
                      </>
                    ) : (
                      <ActivityIndicator color={Colors.violet3} />
                    )}
                  </View>
                )}

                {/* ===== TAB TERMOS ===== */}
                {tab === "termos" && (
                  <View style={m.card}>
                    <Text style={m.cardTitle}>Termos do cliente{hasTermsOverride ? " (personalizado)" : ""}</Text>
                    <Text style={m.termsHint}>
                      Deixe em branco para usar os termos padrão da empresa. Ao salvar com valores, esses termos se aplicam só a este cliente.
                    </Text>
                    {!!profile?.terms && (
                      <View style={[m.termsEffRow, { marginBottom: 12 }]}>
                        <Text style={m.termsEffLbl}>Termos efetivos</Text>
                        <Text style={m.termsEffVal}>
                          Máx {profile.terms.effective.max_installments}x · {profile.terms.effective.interest_rate}% a.m.
                        </Text>
                      </View>
                    )}
                    <Text style={m.fieldLabel}>Máximo de parcelas</Text>
                    <TextInput
                      style={[m.termsInput, { marginBottom: 12 }]}
                      value={termsMaxInst}
                      onChangeText={v => { setTermsMaxInst(v.replace(/[^\d]/g, "")); setTermsDirty(true); }}
                      placeholder="Padrão da empresa"
                      placeholderTextColor={Colors.ink3}
                      keyboardType="number-pad"
                    />
                    <Text style={m.fieldLabel}>Juros ao mês (%)</Text>
                    <TextInput
                      style={[m.termsInput, { marginBottom: 14 }]}
                      value={termsInterest}
                      onChangeText={v => { setTermsInterest(v.replace(/[^\d,.]/g, "")); setTermsDirty(true); }}
                      placeholder="Padrão da empresa"
                      placeholderTextColor={Colors.ink3}
                      keyboardType="decimal-pad"
                    />
                    <Pressable
                      style={[m.cta, (!termsDirty || savingTerms) && { opacity: 0.45 }]}
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
                  <View>
                    <View style={m.card}>
                      <Text style={m.cardTitle}>Bloqueio manual</Text>
                      <Text style={m.termsHint}>
                        Bloquear impede novos lançamentos para este cliente. O saldo existente continua visível e pode ser recebido.
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
                          trackColor={{ false: Colors.border2, true: Colors.red + "88" }}
                          thumbColor={isBlocked ? Colors.red : Colors.ink3}
                        />
                      </View>
                    </View>

                    {!!blockingAction && (
                      <>
                        {blockingAction === "block" && (
                          <View style={m.card}>
                            <Text style={m.fieldLabel}>Motivo do bloqueio (opcional)</Text>
                            <TextInput
                              style={[m.termsInput, { marginBottom: 12 }]}
                              value={blockReason}
                              onChangeText={setBlockReason}
                              placeholder="Ex: inadimplente, limite excedido..."
                              placeholderTextColor={Colors.ink3}
                              multiline
                            />
                          </View>
                        )}
                        <Pressable
                          style={[m.cta, { marginBottom: 8 }]}
                          onPress={confirmBlock}
                        >
                          <Text style={m.ctaTxt}>{blockingAction === "block" ? "Confirmar bloqueio" : "Confirmar desbloqueio"}</Text>
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

          {/* DESIGN-38 B2: Modal Pix da parcela */}
          {!!pixInstId && (
            <View style={m.pixOverlay}>
              <View style={m.pixOverlayHeader}>
                <Text style={m.editDueDateTitle}>Pix da Parcela</Text>
                <Pressable onPress={() => { setPixInstId(null); setPixData(null); }} style={m.xBtn}>
                  <Icon name="x" size={13} color={Colors.ink3} />
                </Pressable>
              </View>
              {pixLoading && (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <ActivityIndicator color={Colors.violet3} />
                  <Text style={[m.termsHint, { marginTop: 6, textAlign: "center" }]}>Gerando código Pix...</Text>
                </View>
              )}
              {!pixLoading && pixData && (
                <>
                  <View style={{ alignItems: "center", marginVertical: 14 }}>
                    <QRCode
                      value={pixData.emv}
                      size={180}
                      color="#000"
                      backgroundColor="#fff"
                    />
                  </View>
                  <Text style={m.pixAmtLabel}>{fmt(pixData.amount)}</Text>
                  {!!pixData.installment && (
                    <Text style={m.pixInstLabel}>
                      Parcela {pixData.installment.number} · venc. {fmtDate(pixData.installment.due_date)}
                    </Text>
                  )}
                  <Text style={m.fieldLabel}>Código copia e cola</Text>
                  <View style={m.pixEmvBox}>
                    <Text style={m.pixEmvTxt} selectable numberOfLines={3}>{pixData.emv}</Text>
                  </View>
                  <Pressable
                    style={[m.cta, { marginTop: 10 }]}
                    onPress={() => {
                      Clipboard.setString(pixData.emv);
                      toast.success("Código Pix copiado!");
                    }}
                  >
                    <Text style={m.ctaTxt}>Copiar código</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

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

          {/* C-2: Barra de ações persistente — fora do ScrollView */}
          <View style={m.fichaActionBar}>
            {/* Confirmar recebimento (handler: confirmReceive — ativo na aba parcelas com valor preenchido) */}
            <Pressable
              style={[m.fichaActionBtn, m.fichaActionBtnPrimary, (amountNum <= 0 || dateInvalid || payMut.isPending) && { opacity: 0.45 }]}
              disabled={amountNum <= 0 || dateInvalid || payMut.isPending}
              onPress={confirmReceive}
            >
              {payMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={m.fichaActionBtnTxt}>{amountNum > 0 ? `Receber ${fmt(amountNum)}` : "Receber"}</Text>}
            </Pressable>
            {/* Confirmar valor livre (handler: confirmFreePayment) */}
            <Pressable
              style={[m.fichaActionBtn, m.fichaActionBtnSecondary, (parseAmount(freeAmt) <= 0 || freeSubmitting) && { opacity: 0.45 }]}
              disabled={parseAmount(freeAmt) <= 0 || freeSubmitting}
              onPress={confirmFreePayment}
            >
              {freeSubmitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={m.fichaActionBtnTxt}>Valor Livre</Text>}
            </Pressable>
            {/* C-2: Novo lançamento sem handler na ficha — fora de escopo */}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── InstallmentRow subcomponent ──────────────────────────────────────────────
function InstallmentRow({
  inst, onEditDueDate, onOpenPix, pixLoadingId,
}: {
  inst: CreditInstallment;
  onEditDueDate: (inst: CreditInstallment) => void;
  onOpenPix: (id: string) => void;
  pixLoadingId: string | null;
}) {
  const isOverdue = inst.status === "overdue";
  const hasCharges = (inst.charges_total ?? 0) > 0;
  const rem = inst.remaining ?? (inst.amount_due - (inst.covered_amount || 0));
  const toPay = Number(inst.total_due ?? rem);

  return (
    <View style={m.parc}>
      <View style={{ flex: 1 }}>
        <Text style={m.parcT}>
          Parcela {inst.installment_number}/{inst.total_installments} · {fmtDate(inst.due_date)}
        </Text>
        <Text style={m.parcS}>
          {fmt(toPay)}
          {inst.account_id ? " · carnê" : ""}
        </Text>
        {hasCharges && (
          <View style={m.chargesBreakdown}>
            <View style={m.chargesRow}>
              <Text style={m.chargesLbl}>Principal em aberto</Text>
              <Text style={m.chargesVal}>{fmt(rem)}</Text>
            </View>
            {(inst.late_fee ?? 0) > 0 && (
              <View style={m.chargesRow}>
                <Text style={m.chargesLbl}>Multa</Text>
                <Text style={m.chargesVal}>{fmt(inst.late_fee)}</Text>
              </View>
            )}
            {(inst.late_interest ?? 0) > 0 && (
              <View style={m.chargesRow}>
                <Text style={m.chargesLbl}>
                  Mora{inst.days_charged != null ? ` (${inst.days_charged}d)` : ""}
                </Text>
                <Text style={m.chargesVal}>{fmt(inst.late_interest)}</Text>
              </View>
            )}
            <View style={[m.chargesRow, m.chargesTotalRow]}>
              <Text style={m.chargesTotalLbl}>Total a pagar</Text>
              <Text style={m.chargesTotalVal}>{fmt(toPay)}</Text>
            </View>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
        <Pressable style={m.calBtn} onPress={() => onEditDueDate(inst)}>
          <Icon name="calendar" size={13} color={Colors.violet3} />
        </Pressable>
        <Pressable
          style={m.pixBtn}
          onPress={() => onOpenPix(inst.id)}
          disabled={pixLoadingId === inst.id}
        >
          {pixLoadingId === inst.id
            ? <ActivityIndicator size="small" color={Colors.green} />
            : <Text style={m.pixBtnTxt}>Pix</Text>}
        </Pressable>
        <View style={[m.badge, {
          backgroundColor: isOverdue ? Colors.red + "18" : Colors.amber + "18",
          borderColor: isOverdue ? Colors.red + "44" : Colors.amber + "44",
        }]}>
          <Text style={[m.badgeTxt, { color: isOverdue ? Colors.red : Colors.amber }]}>
            {isOverdue ? "Atraso" : "Aberto"}
          </Text>
        </View>
      </View>
    </View>
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

  // DESIGN-38: sub-tab menor
  tabSm: { paddingVertical: 5 },

  // DESIGN-38: botão Pix em parcelas
  pixBtn: { backgroundColor: Colors.green + "22", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.green + "44" },
  pixBtnTxt: { fontSize: 11, fontWeight: "700", color: Colors.green },

  // DESIGN-38: overlay Pix
  pixOverlay: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 16, backgroundColor: Colors.bg2 },
  pixOverlayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  pixAmtLabel: { fontSize: 24, fontWeight: "800", color: Colors.ink, textAlign: "center", marginBottom: 2 },
  pixInstLabel: { fontSize: 12, color: Colors.ink3, textAlign: "center", marginBottom: 12 },
  pixEmvBox: { backgroundColor: Colors.bg3, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: Colors.border2, marginTop: 4 },
  pixEmvTxt: { fontSize: 11, color: Colors.ink3, fontFamily: Platform.OS === "web" ? "monospace" : undefined },

  // DESIGN-38: preview FIFO
  previewBox: { backgroundColor: Colors.bg2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2, marginTop: 14 },
  previewTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.violet3, textTransform: "uppercase", marginBottom: 8 },
  previewRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 },
  previewLbl: { fontSize: 12, color: Colors.ink3, flex: 1 },
  previewVal: { fontSize: 12, fontWeight: "700", color: Colors.ink, textAlign: "right" },

  // C-2: Header fixo da ficha
  fichaHeaderFixed: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.bg2,
  },
  fichaHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  fichaHeaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  fichaMetaChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  fichaMetaChipTxt: {
    fontSize: 11,
    fontWeight: "700",
  },
  fichaMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fichaMetaLbl: {
    fontSize: 11,
    color: Colors.ink3,
    fontWeight: "600",
  },
  fichaMetaVal: {
    fontSize: 13,
    fontWeight: "800",
  },

  // C-2: Barra de ações persistente (rodapé)
  fichaActionBar: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg2,
  },
  fichaActionBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 12,
  },
  fichaActionBtnPrimary: {
    backgroundColor: Colors.violet,
  },
  fichaActionBtnSecondary: {
    backgroundColor: Colors.violet2,
  },
  fichaActionBtnTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
} as any);

export default ClienteCrediarioModal;
