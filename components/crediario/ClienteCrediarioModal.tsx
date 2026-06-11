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
    queryFn: () => creditApi.getCustomerDetail(companyId, customerId!),
    enabled: !!companyId && !!customerId && visible,
    staleTime: 30_000,
  });
  const profileQ = useQuery({
    queryKey: ["credit-profile", companyId, customerId],
    queryFn: () => creditApi.getCreditProfile(companyId, customerId!),
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
        const dists: PaymentAllocation[] = accounts
          .map(acc => ({ account_id: acc.id, amount: parseAmount(distributions[acc.id ?? "general"] || "0") }))
          .filter(d => d.amount > 0);
        return creditApi.distributePayment(companyId, customerId!, dists, method, paid_at);
      }
      return creditApi.receivePayment(companyId, customerId!, amountNum, method, fifoAccountId, paid_at);
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
    creditApi.setBlockStatus(companyId, customerId, blockingAction === "block", blockReason || undefined)
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
      await creditApi.saveTermsOverride(companyId, customerId, Object.keys(overrides).length ? overrides : null);
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
      const res = await creditApi.getHistory(companyId, customerId, cursor || undefined);
      if (cursor) {
        setHistItems(prev => [...prev, ...res.items]);
      } else {
        setHistItems(res.items);
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
        const res = await creditApi.previewFifoPayment(companyId, customerId!, n, accId ?? null);
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
      const res = await creditApi.receiveFreePayment(companyId, customerId, n, freeMethod, freeAccountId ?? null, paid_at);
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

  async function openInstallmentPix(installmentId: string) {
    if (!customerId) return;
    setPixInstId(installmentId);
    setPixData(null);
    setPixLoading(true);
    try {
      const res = await creditApi.getInstallmentPix(companyId, customerId, installmentId);
      setPixData(res);
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao gerar Pix da parcela");
      setPixInstId(null);
    } finally {
      setPixLoading(false);
    }
  }

  const name = detail?.customer?.name || customerName || "Cliente";
  const phone = detail?.customer?.phone || null;
  const initial = (name.trim()[0] || "?").toUpperCase();

  // Aviso de score (Fase 1 — nunca bloqueante)
  const scoreWarning = profile?.score_warning ?? null;
  const availableLimit = profile?.available_limit ?? (profile ? (profile.credit_limit - profile.credit_used) : undefined);
  const scoreLabel = profile?.score_label ?? profile?.label ?? null;

  // Termos: tem override?
  const hasTermsOverride = !!(    profile?.terms?.overrides?.max_installments != null ||
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

          {/* C-2: Header fixo — fora do ScrollView */}
          <View style={m.fichaHeaderFixed}>
            <View style={m.fichaHeaderTop}>
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
            {/* Score / limite / saldo em aberto */}
            <View style={m.fichaHeaderMeta}>
              {!!scoreLabel && (
                <View style={[m.fichaMetaChip, { backgroundColor: scoreColor(scoreLabel) + "22", borderColor: scoreColor(scoreLabel) + "55" }]}>
                  <Text style={[m.fichaMetaChipTxt, { color: scoreColor(scoreLabel) }]}>{scoreLabelPt(scoreLabel)}</Text>
                </View>
              )}
              {availableLimit !== undefined && (
                <View style={m.fichaMetaItem}>
                  <Text style={m.fichaMetaLbl}>Disponível</Text>
                  <Text style={[m.fichaMetaVal, { color: availableLimit >= 0 ? Colors.green : Colors.red }]}>{fmt(availableLimit)}</Text>
                </View>
              )}
              <View style={m.fichaMetaItem}>
                <Text style={m.fichaMetaLbl}>Em aberto</Text>
                <Text style={[m.fichaMetaVal, { color: totalBalance > 0 ? Colors.red : Colors.ink3 }]}>{fmt(totalBalance)}</Text>
              </View>
            </View>
            {/* Banner aviso score — fica no header fixo */}
            {!!scoreWarning && (
              <View style={[m.scoreBanner, { marginBottom: 0, marginTop: 8 }]}>
                <Icon name="alert_triangle" size={15} color={Colors.amber} />
                <Text style={m.scoreBannerTxt}>
                  Score abaixo do mínimo de aviso ({scoreWarning.threshold} pts). Score atual:{" "}
                  <Text style={{ fontWeight: "800" }}>{scoreWarning.actual} pts</Text>.
                  {" "}Você pode lançar normalmente — isto é apenas um alerta.
                </Text>
              </View>
            )}
          </View>

          <ScrollView style={[m.body, { flex: 1 }]} contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
            {/* Tabs principais: Parcelas / Histórico / Conta */}
            <View style={m.tabs}>
              {(["parcelas", "historico", "conta"] as Tab[]).map(t => (
                <Pressable key={t} style={[m.tab, tab === t && m.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[m.tabTxt, tab === t && m.tabTxtOn]}>
                    {t === "parcelas" ? "Parcelas" : t === "historico" ? "Histórico" : "Conta"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {/* Sub-abas: Termos / Bloqueio */}
            <View style={[m.tabs, { marginTop: -4, marginBottom: 8 }]}>
              {(["termos", "bloqueio"] as Tab[]).map(t => (
                <Pressable key={t} style={[m.tab, m.tabSm, tab === t && m.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[m.tabTxt, tab === t && m.tabTxtOn]}>
                    {t === "termos" ? `Termos${hasTermsOverride ? " •" : ""}` : "Bloqueio"}
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
                {/* ===== TAB PARCELAS ===== */}
                {tab === "parcelas" && (
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
                                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                            <Text style={m.parcT}>Parcela {ins.installment_number}/{ins.total_installments}</Text>
                                            <View style={[m.badge, { backgroundColor: late ? Colors.red + "22" : Colors.green + "22", borderColor: late ? Colors.red + "44" : Colors.green + "44" }]}>
                                              <Text style={[m.badgeTxt, { color: late ? Colors.red : Colors.green }]}>
                                                {late ? "Vencida" : "Em aberto"}
                                              </Text>
                                            </View>
                                          </View>
                                          <Text style={m.parcS}>Venc. {fmtDate(ins.due_date)} · {fmt(rem)}</Text>
                                          {hasCharges && (
                                            <View style={m.chargesBreakdown}>
                                              <View style={m.chargesRow}>
                                                <Text style={m.chargesLbl}>Principal em aberto</Text>
                                                <Text style={m.chargesVal}>{fmt(ins.principal_due ?? rem)}</Text>
                                              </View>
                                              {(ins.fine_amount ?? 0) > 0 && (
                                                <View style={m.chargesRow}>
                                                  <Text style={m.chargesLbl}>Multa</Text>
                                                  <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.fine_amount!)}</Text>
                                                </View>
                                              )}
                                              {(ins.interest_amount ?? 0) > 0 && (
                                                <View style={m.chargesRow}>
                                                  <Text style={m.chargesLbl}>
                                                    Mora
                                                    {ins.overdue_days != null && (
                                                      <Text style={m.chargesDaysChip}> ({ins.overdue_days}d)</Text>
                                                    )}
                                                  </Text>
                                                  <Text style={[m.chargesVal, { color: Colors.amber }]}>{fmt(ins.interest_amount!)}</Text>
                                                </View>
                                              )}
                                              <View style={[m.chargesRow, m.chargesTotalRow]}>
                                                <Text style={m.chargesTotalLbl}>Total a pagar</Text>
                                                <Text style={m.chargesTotalVal}>{fmt(ins.total_due ?? (rem + chargesTotal))}</Text>
                                              </View>
                                            </View>
                                          )}
                                        </View>
                                        <View style={{ gap: 6 }}>
                                          <Pressable style={m.calBtn} onPress={() => handleEditDueDateOpen(ins)}>
                                            <Icon name="calendar" size={14} color={Colors.violet3} />
                                          </Pressable>
                                          <Pressable style={m.pixBtn} onPress={() => openInstallmentPix(ins.id)}>
                                            <Text style={m.pixBtnTxt}>Pix</Text>
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

                              {/* Ações do carnê */}
                              <View style={m.accActions}>
                                {!!phone && !!onCobrar && (
                                  <Pressable
                                    style={[m.accActionBtn, m.accActionWa]}
                                    onPress={() => onCobrar(customerId!, name, phone)}
                                  >
                                    <Text style={[m.accActionTxt, { color: Colors.green }]}>Cobrar</Text>
                                  </Pressable>
                                )}
                                <Pressable
                                  style={m.accActionBtn}
                                  onPress={() => prefill(acc.balance > 0 ? acc.balance : 0)}
                                >
                                  <Text style={m.accActionTxt}>Receber</Text>
                                </Pressable>
                                <Pressable
                                  style={[m.accActionBtn, { backgroundColor: Colors.ink3 + "22", borderWidth: 1, borderColor: Colors.ink3 + "44" }]}
                                  onPress={() => printCarne(companyId, customerId!, acc.id)}
                                >
                                  <Text style={[m.accActionTxt, { color: Colors.ink2 }]}>Imprimir</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Parcelas planas (sem carnê nomeado) */}
                    {!useCarneLayout && openInst.length > 0 && (
                      <View style={m.card}>
                        <Text style={m.cardTitle}>Parcelas em aberto</Text>
                        {openInst.map((ins) => {
                          const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
                          const late = ins.status === "overdue";
                          const chargesTotal = ins.charges_total ?? 0;
                          const hasCharges = late && chargesTotal > 0;
                          return (
                            <View key={ins.id} style={m.parc}>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                  <Text style={m.parcT}>Parcela {ins.installment_number}/{ins.total_installments}</Text>
                                  <View style={[m.badge, { backgroundColor: late ? Colors.red + "22" : Colors.green + "22", borderColor: late ? Colors.red + "44" : Colors.green + "44" }]}>
                                    <Text style={[m.badgeTxt, { color: late ? Colors.red : Colors.green }]}>
                                      {late ? "Vencida" : "Em aberto"}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={m.parcS}>Venc. {fmtDate(ins.due_date)} · {fmt(rem)}</Text>
                                {hasCharges && (
                                  <View style={m.chargesBreakdown}>
                                    <View style={m.chargesRow}>
                                      <Text style={m.chargesLbl}>Principal em aberto</Text>
                                      <Text style={m.chargesVal}>{fmt(ins.principal_due ?? rem)}</Text>
                                    </View>
                                    {(ins.fine_amount ?? 0) > 0 && (
                                      <View style={m.chargesRow}>
                                        <Text style={m.chargesLbl}>Multa</Text>
                                        <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.fine_amount!)}</Text>
                                      </View>
                                    )}
                                    {(ins.interest_amount ?? 0) > 0 && (
                                      <View style={m.chargesRow}>
                                        <Text style={m.chargesLbl}>
                                          Mora
                                          {ins.overdue_days != null && (
                                            <Text style={m.chargesDaysChip}> ({ins.overdue_days}d)</Text>
                                          )}
                                        </Text>
                                        <Text style={[m.chargesVal, { color: Colors.amber }]}>{fmt(ins.interest_amount!)}</Text>
                                      </View>
                                    )}
                                    <View style={[m.chargesRow, m.chargesTotalRow]}>
                                      <Text style={m.chargesTotalLbl}>Total a pagar</Text>
                                      <Text style={m.chargesTotalVal}>{fmt(ins.total_due ?? (rem + chargesTotal))}</Text>
                                    </View>
                                  </View>
                                )}
                              </View>
                              <View style={{ gap: 6 }}>
                                <Pressable style={m.calBtn} onPress={() => handleEditDueDateOpen(ins)}>
                                  <Icon name="calendar" size={14} color={Colors.violet3} />
                                </Pressable>
                                <Pressable style={m.pixBtn} onPress={() => openInstallmentPix(ins.id)}>
                                  <Text style={m.pixBtnTxt}>Pix</Text>
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
                      <Text style={m.freeTitle}>Receber valor livre</Text>

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

                    {/* Recebimento Valor Livre com Preview FIFO (DESIGN-38 B3) */}
                    <View style={m.card}>
                      <Text style={m.cardTitle}>Valor Livre · Preview FIFO</Text>
                      <Text style={[m.termsHint, { marginBottom: 10 }]}>
                        Digite um valor para ver como será distribuído entre as parcelas (FIFO). Depois confirme para aplicar.
                      </Text>

                      {/* Seletor de carnê — visível quando há mais de 1 carnê nomeado */}
                      {realCarnes.length > 1 && (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={m.fieldLabel}>Carnê</Text>
                          <View style={m.chipRow}>
                            <Pressable
                              style={[m.chip, freeAccountId === undefined && m.chipOn]}
                              onPress={() => { setFreeAccountId(undefined); triggerPreview(freeAmt, undefined); }}
                            >
                              <Text style={[m.chipTxt, freeAccountId === undefined && m.chipTxtOn]}>Todos</Text>
                            </Pressable>
                            {realCarnes.map(acc => (
                              <Pressable
                                key={acc.id!}
                                style={[m.chip, freeAccountId === acc.id && m.chipOn]}
                                onPress={() => { setFreeAccountId(acc.id); triggerPreview(freeAmt, acc.id); }}
                              >
                                <Text style={[m.chipTxt, freeAccountId === acc.id && m.chipTxtOn]}>{acc.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      )}

                      <Text style={m.fieldLabel}>Valor recebido</Text>
                      <View style={m.amountIn}>
                        <Text style={m.amountPrefix}>R$</Text>
                        <TextInput
                          style={m.amountInput}
                          value={freeAmt}
                          onChangeText={(v) => {
                            const clean = v.replace(/[^\d,.]/g, "");
                            setFreeAmt(clean);
                            triggerPreview(clean, freeAccountId);
                          }}
                          placeholder="0,00"
                          placeholderTextColor={Colors.ink3}
                          keyboardType="decimal-pad"
                        />
                      </View>

                      <Text style={[m.fieldLabel, { marginTop: 12 }]}>Data do recebimento</Text>
                      <DateInput
                        value={freeDateBr}
                        onChangeText={setFreeDateBr}
                        placeholder="dd/mm/aaaa"
                        style={m.dateInput}
                      />

                      <Text style={[m.fieldLabel, { marginTop: 12 }]}>Forma</Text>
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

                      {/* Preview FIFO */}
                      {freePreviewLoading && (
                        <View style={{ alignItems: "center", marginTop: 14 }}>
                          <ActivityIndicator size="small" color={Colors.violet3} />
                          <Text style={[m.termsHint, { textAlign: "center", marginTop: 4 }]}>Calculando distribuição...</Text>
                        </View>
                      )}
                      {!freePreviewLoading && freePreview && (
                        <View style={m.previewBox}>
                          <Text style={m.previewTitle}>Distribuição FIFO</Text>
                          {freePreview.applied.map((line, i) => (
                            <View key={line.installment_id + i} style={m.previewRow}>
                              <Text style={m.previewLbl}>
                                Parcela {line.number ?? "?"}{line.account_id ? "" : ""}
                              </Text>
                              <View style={{ alignItems: "flex-end" }}>
                                {line.charges_paid > 0 && (
                                  <Text style={[m.previewVal, { fontSize: 10, color: Colors.amber }]}>
                                    Encargos: {fmt(line.charges_paid)}
                                  </Text>
                                )}
                                <Text style={m.previewVal}>Principal: {fmt(line.principal_paid)}</Text>
                                <Text style={[m.previewVal, { fontSize: 10, color: Colors.ink3 }]}>{line.status_after}</Text>
                              </View>
                            </View>
                          ))}
                          <View style={[m.previewRow, { borderTopWidth: 1, borderTopColor: Colors.border2, paddingTop: 8, marginTop: 4 }]}>
                            <Text style={[m.previewLbl, { fontWeight: "700", color: Colors.ink }]}>Novo saldo em aberto</Text>
                            <Text style={[m.previewVal, { color: freePreview.new_balance > 0 ? Colors.red : Colors.green, fontSize: 16 }]}>
                              {fmt(freePreview.new_balance)}
                            </Text>
                          </View>
                          {freePreview.credit_generated > 0 && (
                            <View style={m.previewRow}>
                              <Text style={m.previewLbl}>Crédito gerado</Text>
                              <Text style={[m.previewVal, { color: Colors.green }]}>{fmt(freePreview.credit_generated)}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      <Pressable
                        style={[m.cta, { marginTop: 14 }, (parseAmount(freeAmt) <= 0 || freeSubmitting) && { opacity: 0.45 }]}
                        disabled={parseAmount(freeAmt) <= 0 || freeSubmitting}
                        onPress={confirmFreePayment}
                      >
                        {freeSubmitting
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={m.ctaTxt}>
                              {parseAmount(freeAmt) > 0 ? `Confirmar ${fmt(parseAmount(freeAmt))}` : "Confirmar recebimento"}
                            </Text>}
                      </Pressable>
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
                                  <Text style={m.tlMain}>{isPay ? `Recebimento${t.payment_method ? " · " + t.payment_method : ""}` : "Lançamento"}</Text>
                                  <Text style={[m.tlAmt, { color: isPay ? Colors.green : Colors.violet3 }]}>
                                    {isPay ? "+" : ""}{fmt(t.amount)}
                                  </Text>
                                </View>
                                {!!prods && <Text style={m.tlSub}>{prods}</Text>}
                                <Text style={m.tlSub}>{fmtDate(t.created_at)}</Text>
                                {!!t.account_name && (
                                  <View style={m.tlAccTag}><Text style={m.tlAccTagTxt}>{t.account_name}</Text></View>
                                )}
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </>
                )}

                {/* ===== TAB HISTÓRICO ===== */}
                {tab === "historico" && (
                  <View>
                    <View style={m.card}>
                      <Text style={m.cardTitle}>Histórico de eventos</Text>
                      {histLoading && histItems.length === 0 ? (
                        <View style={{ paddingVertical: 24, alignItems: "center" }}>
                          <ActivityIndicator color={Colors.violet3} />
                        </View>
                      ) : histItems.length === 0 ? (
                        <View style={{ paddingVertical: 12 }}>
                          <Text style={m.emptyTxt}>Sem eventos ainda.</Text>
                          <Pressable
                            style={[m.cta, { marginTop: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 }]}
                            onPress={() => loadHistory(null)}
                          >
                            <Text style={[m.ctaTxt, { color: Colors.violet3 }]}>Carregar histórico</Text>
                          </Pressable>
                        </View>
                      ) : (
                        histItems.map((ev) => {
                          const typeLabels: Record<string, string> = {
                            payment: "Recebimento",
                            charge: "Lançamento",
                            block: "Bloqueio",
                            unblock: "Desbloqueio",
                            terms_override: "Termos alterados",
                            manual_debit: "Débito manual",
                            installment_edit: "Parcela editada",
                          };
                          return (
                            <View key={ev.id} style={m.tlItem}>
                              <View style={[m.tlDot, { backgroundColor: ev.event_type === "payment" ? Colors.green : Colors.ink3 }]} />
                              <View style={{ flex: 1 }}>
                                <View style={m.tlLine}>
                                  <Text style={m.tlMain}>{typeLabels[ev.event_type] ?? ev.event_type}</Text>
                                  {ev.amount != null && (
                                    <Text style={[m.tlAmt, { color: ev.event_type === "payment" ? Colors.green : Colors.ink }]}>
                                      {ev.event_type === "payment" ? "+" : ""}{fmt(ev.amount)}
                                    </Text>
                                  )}
                                </View>
                                <Text style={m.tlSub}>{fmtDate(ev.created_at)}</Text>
                                {!!ev.notes && <Text style={m.tlSub}>{ev.notes}</Text>}
                                {!!ev.account_name && (
                                  <View style={m.tlAccTag}><Text style={m.tlAccTagTxt}>{ev.account_name}</Text></View>
                                )}
                              </View>
                            </View>
                          );
                        })
                      )}
                      {histHasMore && (
                        <Pressable
                          style={[m.cta, { marginTop: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
                          onPress={() => loadHistory(histCursor)}
                          disabled={histLoading}
                        >
                          {histLoading
                            ? <ActivityIndicator size="small" color={Colors.violet3} />
                            : <Text style={[m.ctaTxt, { color: Colors.ink2 }]}>Carregar mais</Text>}
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}

                {/* ===== TAB CONTA ===== */}
                {tab === "conta" && (
                  <View>
                    <View style={m.card}>
                      <Text style={m.cardTitle}>Status do crediário</Text>
                      <View style={m.row}>
                        <Text style={m.rowK}>Status</Text>
                        <View style={[m.pill, { backgroundColor: (isBlocked ? Colors.red : Colors.green) + "22" }]}>
                          <Text style={[m.pillTxt, { color: isBlocked ? Colors.red : Colors.green }]}>
                            {isBlocked ? "Bloqueado" : "Ativo"}
                          </Text>
                        </View>
                      </View>
                      {isBlocked && !!profile?.blocked_reason && (
                        <View style={m.row}>
                          <Text style={m.rowK}>Motivo</Text>
                          <Text style={[m.rowV, { fontSize: 13 }]}>{profile.blocked_reason}</Text>
                        </View>
                      )}
                      {!!profile && (
                        <>
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
                      )}
                    </View>
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
    justifyContent: "center",
    borderRadius: 11,
    paddingVertical: 12,
  },
  fichaActionBtnPrimary: {
    backgroundColor: Colors.violet,
  },
  fichaActionBtnSecondary: {
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  fichaActionBtnTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },

} as any);

export default ClienteCrediarioModal;
