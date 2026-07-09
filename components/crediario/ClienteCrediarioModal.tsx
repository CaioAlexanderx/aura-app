// ============================================================
// AURA. — Crediário · Modal de detalhe do cliente
//
// (decomposto em ficha/* em 11/06; este é o shell que mantém estado/queries
//  e compõe TabParcelas/TabHistorico/TabConta.)
//
// F3 do redesign (08/07/2026 — spec docs/crediario-redesign-spec.md §2.3):
//  - 5 abas → 3: Termos e Bloqueio viraram "Ajustes deste cliente"
//    (colapsado) dentro da aba Conta; some a 2ª linha de tabs.
//  - Header: EM ABERTO vira o HERÓI (22/800 colorido); Score e
//    Disponível viram suporte compacto ao lado.
//  - Entrada do sheet via ModalPop (scale 0.96→1 + fade).
//  - "Receber valor livre" saiu da TabParcelas: agora é o sheet
//    "Receber pagamento", aberto pelo CTA fixo no rodapé da ficha ou
//    por qualquer botão "Receber" (prefill). Gate 2-step âmbar migrou
//    para <ConfirmGate> (padrão único).
// Histórico anterior: C-2 (12/06) header fixo; A2-FE paid_at no preview;
// B3 valor livre + Pix EMV; Item 2 (16/06) renegociação; Item 4 ícone WhatsApp.
// ============================================================
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView,
  TextInput, ActivityIndicator, Clipboard,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  creditApi,
  type CreditAccount, type CreditInstallment, type CustomerTermsOverrides,
  type CreditHistoryEvent, type PaymentPlan, type CreditPix,
} from "@/services/creditApi";
import { rescheduleApi } from "@/services/creditReschedule";
import QRCode from "react-native-qrcode-svg";
import { toast } from "@/components/Toast";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { ModalPop } from "@/components/anim";
import { ConfirmGate } from "@/components/ConfirmGate";
import {
  fmt, fmtDate, todayBrSp, parseAmount, scoreColor,
  PAYMENT_METHODS, type Tab,
} from "./ficha/fichaHelpers";
import { m } from "./ficha/fichaStyles";
import { TabParcelas } from "./ficha/TabParcelas";
import { TabHistorico } from "./ficha/TabHistorico";
import { TabConta } from "./ficha/TabConta";

function translateStatus(status: string | null | undefined): string {
  if (!status) return "";
  if (status === "paid") return "Quitada";
  if (status === "partial") return "Parcial";
  if (status === "overdue") return "Em atraso";
  if (status === "pending") return "Em aberto";
  if (status === "cancelled") return "Cancelada";
  return status;
}

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

export function ClienteCrediarioModal({
  visible, companyId, customerId, customerName, pixKey, storeName,
  onClose, onCobrar, onChanged,
}: Props) {
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("parcelas");

  const [expandedAccountId, setExpandedAccountId] = useState<string | null | undefined>(undefined);

  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [blockReason, setBlockReason] = useState("");
  const [blockingAction, setBlockingAction] = useState<"block" | "unblock" | null>(null);

  const [termsMaxInst, setTermsMaxInst] = useState("");
  const [termsInterest, setTermsInterest] = useState("");
  const [termsDirty, setTermsDirty] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);

  const [editingDueDateInst, setEditingDueDateInst] = useState<CreditInstallment | null>(null);
  const [editDueDateInput, setEditDueDateInput] = useState("");
  const [editDueDateError, setEditDueDateError] = useState("");

  // ── Item 2 (16/06): renegociacao de parcelas ─────────────────────────
  const [renegScope, setRenegScope] = useState<{ accountId: string | null | undefined; label: string; openRemaining: number } | null>(null);
  const [renegTotal, setRenegTotal] = useState("");
  const [renegCount, setRenegCount] = useState(1);
  const [renegPerParcel, setRenegPerParcel] = useState("");
  const [renegFirstDue, setRenegFirstDue] = useState("");
  const [renegSubmitting, setRenegSubmitting] = useState(false);

  const [histEvents, setHistEvents] = useState<CreditHistoryEvent[]>([]);
  const [histCursor, setHistCursor] = useState<string | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histLoaded, setHistLoaded] = useState(false);

  // ── B3 → F3: sheet "Receber pagamento" (antes card fixo na TabParcelas) ──
  const [receberOpen, setReceberOpen] = useState(false);
  const [receberGate, setReceberGate] = useState(false);
  const [freeAmt, setFreeAmt] = useState("");
  const [freeMethod, setFreeMethod] = useState("dinheiro");
  const [freeDateBr, setFreeDateBr] = useState(todayBrSp());
  const [freeAccountId, setFreeAccountId] = useState<string | null | undefined>(undefined);
  const [freePreview, setFreePreview] = useState<PaymentPlan | null>(null);
  const [freePreviewLoading, setFreePreviewLoading] = useState(false);
  const [freeSubmitting, setFreeSubmitting] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Qualquer mudança em valor/método/data reseta o gate (mesma regra do 2-step antigo).
  useEffect(() => { setReceberGate(false); }, [freeAmt, freeMethod, freeDateBr, freeAccountId]);

  // ── B2: Pix overlay — compartilhado entre parcela e valor livre ────────
  const [pixInstId, setPixInstId] = useState<string | null>(null);
  const [pixData, setPixData] = useState<CreditPix | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const pixOverlayTitle = pixInstId === "free" ? "Pix · Valor Livre" : "Pix da Parcela";

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
      setShowNewAccount(false);
      setNewAccountName("");
      setTab("parcelas");
      setBlockReason("");
      setBlockingAction(null);
      setTermsMaxInst("");
      setTermsInterest("");
      setTermsDirty(false);
      setExpandedAccountId(undefined);
      setEditingDueDateInst(null);
      setEditDueDateInput("");
      setEditDueDateError("");
      setRenegScope(null);
      setRenegSubmitting(false);
      setHistEvents([]);
      setHistCursor(null);
      setHistLoaded(false);
      setReceberOpen(false);
      setReceberGate(false);
      setFreeAmt("");
      setFreeMethod("dinheiro");
      setFreeDateBr(todayBrSp());
      setFreeAccountId(undefined);
      setFreePreview(null);
      setPixInstId(null);
      setPixData(null);
    }
  }, [visible, customerId]);

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

  const realCarnes = accounts.filter(a => a && a.id != null);
  const useCarneLayout = realCarnes.length > 0;

  const nextDueDate = openInst.length > 0
    ? openInst.reduce((best, i) => {
        const d = new Date(i.due_date).getTime();
        return (!best || d < new Date(best).getTime()) ? i.due_date : best;
      }, "" as string)
    : "";

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

  async function saveTerms() {
    setSavingTerms(true);
    try {
      const hasOverride = termsMaxInst.trim() || termsInterest.trim();
      if (!hasOverride) {
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

  // prefill: abre o sheet "Receber pagamento" com o valor e dispara preview (F3)
  function prefill(v: number) {
    const str = v.toFixed(2).replace(".", ",");
    setFreeAmt(str);
    setReceberOpen(true);
    triggerPreview(str, freeAccountId);
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

  // ── Item 2 (16/06): renegociacao de parcelas ─────────────────────────
  function openRenegociar(accountId: string | null | undefined, label: string, openRemaining: number) {
    const scopeInst = (accountId === null || accountId === undefined)
      ? (useCarneLayout ? (instByAccount.get(null) || []) : openInst)
      : (instByAccount.get(accountId) || []);
    const count = Math.max(1, Math.min(36, scopeInst.length || 1));
    setRenegScope({ accountId, label, openRemaining });
    setRenegTotal(openRemaining > 0 ? openRemaining.toFixed(2).replace(".", ",") : "");
    setRenegCount(count);
    setRenegPerParcel((openRemaining / count).toFixed(2).replace(".", ","));
    const firstIso = scopeInst.length
      ? scopeInst.reduce((best, i) => (!best || new Date(i.due_date) < new Date(best) ? i.due_date : best), "" as string)
      : "";
    setRenegFirstDue(firstIso ? formatIsoToBr(firstIso) : todayBrSp());
  }

  function setRenegCountSafe(n: number) {
    const c = Math.max(1, Math.min(36, n));
    setRenegCount(c);
    const total = parseAmount(renegTotal);
    setRenegPerParcel((total / c).toFixed(2).replace(".", ","));
  }
  function onRenegTotalChange(v: string) {
    const clean = v.replace(/[^\d,.]/g, "");
    setRenegTotal(clean);
    const total = parseAmount(clean);
    setRenegPerParcel((total / Math.max(1, renegCount)).toFixed(2).replace(".", ","));
  }
  function onRenegPerParcelChange(v: string) {
    const clean = v.replace(/[^\d,.]/g, "");
    setRenegPerParcel(clean);
    const per = parseAmount(clean);
    const total = parseAmount(renegTotal);
    if (per > 0 && total > 0) {
      setRenegCount(Math.max(1, Math.min(36, Math.round(total / per))));
    }
  }

  async function confirmRenegociar() {
    if (!renegScope || !customerId) return;
    const total = parseAmount(renegTotal);
    if (total <= 0) { toast.error("Informe um total maior que zero"); return; }
    if (renegCount < 1) { toast.error("Número de parcelas inválido"); return; }
    const iso = parseBrDate(renegFirstDue);
    if (!iso) { toast.error("Data da 1ª parcela inválida"); return; }
    setRenegSubmitting(true);
    try {
      const res = await rescheduleApi.apply(companyId, customerId, renegScope.accountId, {
        total,
        installments: renegCount,
        first_due_date: iso,
      });
      const adj = res.adjustment;
      toast.success(
        adj?.type === "discount"
          ? `Renegociado! Desconto de ${fmt(adj.amount)} no saldo.`
          : adj?.type === "surcharge"
            ? `Renegociado! Acréscimo de ${fmt(adj.amount)} no saldo.`
            : `Parcelas renegociadas em ${res.installments_count}x.`
      );
      setRenegScope(null);
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-balances", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-aging", companyId] });
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.data?.error || "Não foi possível renegociar. Tente novamente.");
    } finally {
      setRenegSubmitting(false);
    }
  }

  async function loadHistory(cursor?: string | null) {
    if (!companyId || !customerId) return;
    setHistLoading(true);
    try {
      const res = await creditApi.getHistoryTimeline(companyId, customerId, {
        limit: 20,
        cursor: cursor ?? undefined,
      });
      if (cursor) {
        setHistEvents(prev => [...prev, ...res.events]);
      } else {
        setHistEvents(res.events);
      }
      setHistCursor(res.next_cursor ?? null);
      setHistLoaded(true);
    } catch {
    } finally {
      setHistLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "historico" && !histLoaded && visible && !!customerId) {
      loadHistory();
    }
  }, [tab, histLoaded, visible, customerId]);

  const triggerPreview = useCallback((amtStr: string, accountId?: string | null) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    const amt = parseAmount(amtStr);
    if (amt <= 0) { setFreePreview(null); return; }
    previewTimerRef.current = setTimeout(async () => {
      setFreePreviewLoading(true);
      try {
        const plan = await creditApi.previewPayment(companyId, customerId!, {
          amount: amt,
          account_id: accountId,
          paid_at: parseBrDate(freeDateBr) || undefined,
        });
        setFreePreview(plan);
      } catch {
        setFreePreview(null);
      } finally {
        setFreePreviewLoading(false);
      }
    }, 500);
  }, [companyId, customerId, freeDateBr]);

  useEffect(() => {
    if (parseAmount(freeAmt) > 0) triggerPreview(freeAmt, freeAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeDateBr]);

  async function confirmFreePayment() {
    const amt = parseAmount(freeAmt);
    if (amt <= 0) { toast.error("Informe um valor maior que zero"); return; }
    const paidAt = parseBrDate(freeDateBr) || undefined;
    setFreeSubmitting(true);
    try {
      const res = await creditApi.receiveFreePayment(companyId, customerId!, {
        amount: amt,
        account_id: freeAccountId,
        method: freeMethod,
        paid_at: paidAt,
      });
      toast.success(
        res.credit_generated > 0
          ? `Recebido! Crédito gerado: ${fmt(res.credit_generated)}`
          : `Recebido! Novo saldo: ${fmt(res.new_balance)}`
      );
      setFreeAmt("");
      setFreePreview(null);
      setFreeDateBr(todayBrSp());
      setReceberOpen(false);
      setReceberGate(false);
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-balances", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-aging", companyId] });
      onChanged?.();
    } catch (err: any) {
      console.error("[crediário] confirmFreePayment error:", err);
      toast.error("Não foi possível registrar o recebimento. Confira os dados e tente de novo.");
    } finally {
      setFreeSubmitting(false);
    }
  }

  // ── Helper: detecta chave Pix ausente (422 PIX_KEY_MISSING) ───────────
  function isPixKeyMissing(err: any): boolean {
    return (
      err?.status === 422 ||
      err?.data?.code === "PIX_KEY_MISSING" ||
      String(err?.data?.error || "").includes("PIX_KEY_MISSING")
    );
  }

  async function openInstallmentPix(installmentId: string) {
    setPixInstId(installmentId);
    setPixData(null);
    setPixLoading(true);
    try {
      const res = await creditApi.getInstallmentPix(companyId, installmentId);
      setPixData(res);
    } catch (err: any) {
      setPixInstId(null);
      if (isPixKeyMissing(err)) {
        toast.error("Cadastre sua chave Pix em Configurações → PDV para gerar cobranças por Pix.");
      } else {
        console.error("[crediário] openInstallmentPix error:", err);
        toast.error("Não foi possível gerar o Pix. Verifique sua conexão e tente novamente.");
      }
    } finally {
      setPixLoading(false);
    }
  }

  // ── B3: Pix para recebimento de valor livre ───────────────────────────
  async function openFreePix(amount: number) {
    if (!customerId) return;
    setPixInstId("free");
    setPixData(null);
    setPixLoading(true);
    try {
      const res = await creditApi.getFreePix(companyId, customerId, amount);
      setPixData(res);
    } catch (err: any) {
      setPixInstId(null);
      if (isPixKeyMissing(err)) {
        toast.error("Cadastre sua chave Pix em Configurações → PDV para gerar cobranças por Pix.");
      } else {
        console.error("[crediário] openFreePix error:", err);
        toast.error("Não foi possível gerar o Pix. Verifique sua conexão e tente novamente.");
      }
    } finally {
      setPixLoading(false);
    }
  }

  // ── Callback de refresh compartilhado com a TabHistorico (pós-devolução) ──
  function handleHistoricRefresh() {
    qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
    qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
    qc.invalidateQueries({ queryKey: ["credit-balances", companyId] });
    qc.invalidateQueries({ queryKey: ["credit-dashboard", companyId] });
    qc.invalidateQueries({ queryKey: ["credit-aging", companyId] });
    onChanged?.();
  }

  const name = detail?.customer?.name || customerName || "Cliente";
  const phone = detail?.customer?.phone || null;
  const initial = (name.trim()[0] || "?").toUpperCase();

  const scoreWarning = profile?.score_warning ?? null;
  const availableLimit = profile?.available_limit ?? (profile ? (profile.credit_limit - profile.credit_used) : undefined);
  const scoreLabel = profile?.score_label ?? profile?.label ?? null;

  const hasTermsOverride = !!(
    profile?.terms?.overrides?.max_installments != null ||
    profile?.terms?.overrides?.interest_rate != null
  );

  // Derivados do sheet de renegociacao (distribuicao identica ao backend).
  const renegTotalVal = parseAmount(renegTotal);
  const renegBase = renegCount > 0 ? Math.floor((renegTotalVal / renegCount) * 100) / 100 : 0;
  const renegLast = +(renegTotalVal - renegBase * (renegCount - 1)).toFixed(2);
  const renegDelta = +(renegTotalVal - (renegScope?.openRemaining || 0)).toFixed(2);

  const freeAmtValue = parseAmount(freeAmt);
  const anyOverlayOpen = !!pixInstId || !!renegScope || !!editingDueDateInst || receberOpen;
  const methodLabel = PAYMENT_METHODS.find(p => p.key === freeMethod)?.label || freeMethod;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={m.backdrop} onPress={onClose}>
        <ModalPop visible={visible} style={{ width: "100%", maxWidth: 700, alignItems: "center" } as any}>
        <Pressable style={[m.sheet, { width: "100%" }]} onPress={() => {}}>
          <View style={m.head}>
            <Pressable onPress={onClose} style={m.crumb}>
              <View style={{ transform: [{ rotate: "180deg" }] }}>
                <Icon name="chevron_right" size={15} color={Colors.violet3} />
              </View>
              <Text style={m.crumbTxt}>Crediário</Text>
            </Pressable>
            <Pressable onPress={onClose} style={m.xBtn}>
              <Icon name="x" size={15} color={Colors.ink3} />
            </Pressable>
          </View>

          <View style={m.fixedHeader}>
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
                  <Icon name="whatsapp" size={14} color={Colors.green} />
                  <Text style={m.waTxt}>Cobrar</Text>
                </Pressable>
              )}
            </View>

            {/* F3: EM ABERTO é o herói; score e disponível são suporte */}
            {!!profile && (
              <View style={f.metaRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={m.fixedMetaLbl}>{totalBalance < 0 ? "CRÉDITO A FAVOR" : "EM ABERTO"}</Text>
                  <Text
                    style={[f.metaHero, { color: totalBalance < 0 ? Colors.green : totalBalance > 0 ? Colors.red : Colors.ink3 }]}
                    numberOfLines={1}
                  >
                    {fmt(Math.abs(totalBalance))}
                  </Text>
                </View>
                <View style={f.metaSm}>
                  <Text style={m.fixedMetaLbl}>SCORE</Text>
                  <Text style={[f.metaSmVal, { color: scoreColor(scoreLabel) }]}>{profile.credit_score}</Text>
                </View>
                {availableLimit !== undefined && (
                  <View style={f.metaSm}>
                    <Text style={m.fixedMetaLbl}>DISPONÍVEL</Text>
                    <Text style={[f.metaSmVal, { color: availableLimit >= 0 ? Colors.green : Colors.red }]}>{fmt(availableLimit)}</Text>
                  </View>
                )}
              </View>
            )}

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

            {/* F3: 5 abas → 3 (Termos/Bloqueio viraram Ajustes na aba Conta) */}
            <View style={[m.tabs, { marginBottom: 12 }]}>
              {(["parcelas", "historico", "conta"] as Tab[]).map(t => (
                <Pressable key={t} style={[m.tab, tab === t && m.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[m.tabTxt, tab === t && m.tabTxtOn]}>
                    {t === "parcelas" ? "Parcelas" : t === "historico" ? "Histórico" : `Conta${(hasTermsOverride || isBlocked) ? " •" : ""}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <ScrollView style={m.body} contentContainerStyle={{ padding: 18, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
            {detailQ.isLoading || profileQ.isLoading ? (
              <View style={{ paddingVertical: 36, alignItems: "center" }}>
                <ActivityIndicator color={Colors.violet3} />
              </View>
            ) : (
              <>
                {tab === "parcelas" && (
                  <TabParcelas
                    accounts={accounts} openInst={openInst}
                    instByAccount={instByAccount} useCarneLayout={useCarneLayout}
                    handleCreateAccount={handleCreateAccount} showNewAccount={showNewAccount}
                    setShowNewAccount={setShowNewAccount} newAccountName={newAccountName}
                    setNewAccountName={setNewAccountName} creatingAccount={creatingAccount}
                    expandedAccountId={expandedAccountId} setExpandedAccountId={setExpandedAccountId}
                    handleEditDueDateOpen={handleEditDueDateOpen} onRenegociar={openRenegociar}
                    openInstallmentPix={openInstallmentPix}
                    prefill={prefill}
                    companyId={companyId} customerId={customerId!} phone={phone} onCobrar={onCobrar} name={name}
                  />
                )}

                {tab === "historico" && (
                  <TabHistorico
                    histEvents={histEvents} histCursor={histCursor} histLoading={histLoading}
                    histLoaded={histLoaded} loadHistory={loadHistory} setHistLoaded={setHistLoaded}
                    companyId={companyId}
                    customerId={customerId!}
                    onRefresh={handleHistoricRefresh}
                  />
                )}

                {tab === "conta" && (
                  <TabConta
                    profile={profile} isBlocked={isBlocked} scoreLabel={scoreLabel}
                    availableLimit={availableLimit} totalBalance={totalBalance} openInst={openInst}
                    nextDueDate={nextDueDate} hasTermsOverride={hasTermsOverride} realCarnes={realCarnes}
                    ajustes={{
                      termsMaxInst, setTermsMaxInst, termsInterest, setTermsInterest,
                      termsDirty, setTermsDirty, savingTerms, saveTerms,
                      blockReason, setBlockReason, blockingAction, setBlockingAction,
                      handleBlockToggle, confirmBlock, blockPending: blockMut.isPending,
                    }}
                  />
                )}
              </>
            )}
          </ScrollView>

          {/* F3: CTA fixo — abre o sheet "Receber pagamento" */}
          {!anyOverlayOpen && tab === "parcelas" && !detailQ.isLoading && (
            <View style={m.footer}>
              <Pressable style={m.cta} onPress={() => setReceberOpen(true)}>
                <Text style={m.ctaTxt}>Receber pagamento</Text>
              </Pressable>
            </View>
          )}

          {/* ── Sheet "Receber pagamento" (ex-card "valor livre" da TabParcelas) ── */}
          {receberOpen && (
            <View style={m.editDueDateSheet}>
              <View style={m.editDueDateHeader}>
                <Text style={m.editDueDateTitle}>Receber pagamento</Text>
                <Pressable onPress={() => { setReceberOpen(false); setReceberGate(false); }} style={m.xBtn}>
                  <Icon name="x" size={13} color={Colors.ink3} />
                </Pressable>
              </View>
              <Text style={m.editDueDateSub}>
                Digite um valor e veja como ele é aplicado nas parcelas antes de confirmar.
              </Text>

              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
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

                <Text style={[m.fieldLabel, { marginTop: 12 }]}>Data do recebimento</Text>
                <DateInput
                  value={freeDateBr}
                  onChangeText={setFreeDateBr}
                  placeholder="dd/mm/aaaa"
                  style={m.dateInput}
                />
                <Text style={m.dateHint}>Use uma data anterior para registrar um recebimento retroativo.</Text>

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

                {freePreviewLoading && (
                  <View style={{ alignItems: "center", marginTop: 14 }}>
                    <ActivityIndicator size="small" color={Colors.violet3} />
                    <Text style={[m.termsHint, { textAlign: "center", marginTop: 4 }]}>Calculando distribuição...</Text>
                  </View>
                )}
                {!freePreviewLoading && freePreview && (
                  <View style={m.previewBox}>
                    <Text style={m.previewTitle}>Como o valor vai ser aplicado</Text>
                    {freePreview.applied.map((line, i) => (
                      <View key={line.installment_id + i} style={m.previewRow}>
                        <Text style={m.previewLbl}>
                          Parcela {line.number ?? "?"}
                        </Text>
                        <View style={{ alignItems: "flex-end" }}>
                          {line.charges_paid > 0 && (
                            <Text style={[m.previewVal, { fontSize: 10, color: Colors.amber }]}>
                              Encargos: {fmt(line.charges_paid)}
                            </Text>
                          )}
                          <Text style={m.previewVal}>Principal: {fmt(line.principal_paid)}</Text>
                          <Text style={[m.previewVal, { fontSize: 10, color: Colors.ink3 }]}>
                            {translateStatus(line.status_after)}
                          </Text>
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
              </ScrollView>

              {/* ConfirmGate — padrão único (substitui o 2-step manual) */}
              <ConfirmGate
                visible={receberGate}
                message={`Confirmar recebimento de ${fmt(freeAmtValue)} em ${methodLabel.toLowerCase()}?`}
                onConfirm={() => { setReceberGate(false); confirmFreePayment(); }}
                onCancel={() => setReceberGate(false)}
                loading={freeSubmitting}
              />
              {!receberGate && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <Pressable
                    style={[
                      m.pixBtn,
                      { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 12 },
                      freeAmtValue <= 0 && { opacity: 0.4 },
                    ]}
                    disabled={freeAmtValue <= 0}
                    onPress={() => openFreePix(freeAmtValue)}
                  >
                    <Text style={m.pixBtnTxt}>Gerar Pix</Text>
                  </Pressable>
                  <Pressable
                    style={[m.cta, { flex: 2 }, freeAmtValue <= 0 && { opacity: 0.45 }]}
                    disabled={freeAmtValue <= 0}
                    onPress={() => setReceberGate(true)}
                  >
                    <Text style={m.ctaTxt} numberOfLines={1} adjustsFontSizeToFit>
                      {freeAmtValue > 0 ? `Confirmar ${fmt(freeAmtValue)}` : "Confirmar recebimento"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {!!pixInstId && (
            <View style={m.pixOverlay}>
              <View style={m.pixOverlayHeader}>
                <Text style={m.editDueDateTitle}>{pixOverlayTitle}</Text>
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
                    <QRCode value={pixData.emv} size={180} color="#000" backgroundColor="#fff" />
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

          {renegScope && (
            <View style={m.editDueDateSheet}>
              <View style={m.editDueDateHeader}>
                <Text style={m.editDueDateTitle}>Renegociar parcelas</Text>
                <Pressable onPress={() => setRenegScope(null)} style={m.xBtn}>
                  <Icon name="x" size={13} color={Colors.ink3} />
                </Pressable>
              </View>
              <Text style={m.editDueDateSub}>
                {renegScope.label} · saldo em aberto {fmt(renegScope.openRemaining)}. As parcelas abertas serão substituídas por este novo cronograma.
              </Text>

              <Text style={[m.fieldLabel, { marginTop: 4 }]}>Novo total</Text>
              <View style={m.amountIn}>
                <Text style={m.amountPrefix}>R$</Text>
                <TextInput
                  style={m.amountInput}
                  value={renegTotal}
                  onChangeText={onRenegTotalChange}
                  placeholder="0,00"
                  placeholderTextColor={Colors.ink3}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>Nº de parcelas</Text>
                  <View style={m.renegStepRow}>
                    <Pressable
                      style={[m.renegStepBtn, renegCount <= 1 && m.renegStepBtnDisabled]}
                      disabled={renegCount <= 1}
                      onPress={() => setRenegCountSafe(renegCount - 1)}
                    >
                      <Icon name="minus" size={16} color={Colors.violet3} />
                    </Pressable>
                    <Text style={m.renegStepVal}>{renegCount}</Text>
                    <Pressable
                      style={[m.renegStepBtn, renegCount >= 36 && m.renegStepBtnDisabled]}
                      disabled={renegCount >= 36}
                      onPress={() => setRenegCountSafe(renegCount + 1)}
                    >
                      <Icon name="plus" size={16} color={Colors.violet3} />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>Valor por parcela</Text>
                  <View style={m.amountIn}>
                    <Text style={m.amountPrefix}>R$</Text>
                    <TextInput
                      style={[m.amountInput, { fontSize: 16 }]}
                      value={renegPerParcel}
                      onChangeText={onRenegPerParcelChange}
                      placeholder="0,00"
                      placeholderTextColor={Colors.ink3}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>
              <Text style={m.renegHint}>
                Mexa no número de parcelas ou no valor — o outro se ajusta sozinho.{" "}
                {renegCount}× de {fmt(renegBase)}{Math.abs(renegLast - renegBase) > 0.005 ? ` (última ${fmt(renegLast)})` : ""}.
              </Text>

              <Text style={[m.fieldLabel, { marginTop: 12 }]}>1ª parcela vence em</Text>
              <DateInput
                value={renegFirstDue}
                onChangeText={setRenegFirstDue}
                placeholder="dd/mm/aaaa"
                style={m.dateInput}
              />

              {Math.abs(renegDelta) > 0.005 && (
                <View style={m.renegDeltaRow}>
                  <Text style={m.renegDeltaLbl}>{renegDelta < 0 ? "Desconto no saldo" : "Acréscimo no saldo"}</Text>
                  <Text style={[m.renegDeltaVal, { color: renegDelta < 0 ? Colors.green : Colors.red }]}>
                    {renegDelta < 0 ? "−" : "+"}{fmt(Math.abs(renegDelta))}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 9, marginTop: 14 }}>
                <Pressable
                  style={[m.cta, { flex: 1, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
                  onPress={() => setRenegScope(null)}
                >
                  <Text style={[m.ctaTxt, { color: Colors.ink3 }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[m.cta, { flex: 2 }, (renegTotalVal <= 0 || renegSubmitting) && { opacity: 0.5 }]}
                  onPress={confirmRenegociar}
                  disabled={renegTotalVal <= 0 || renegSubmitting}
                >
                  {renegSubmitting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={m.ctaTxt}>Confirmar renegociação</Text>}
                </Pressable>
              </View>
            </View>
          )}

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

        </Pressable>
        </ModalPop>
      </Pressable>
    </Modal>
  );
}

// Estilos locais da F3 (herói do header)
const f = StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "flex-end", gap: 16, marginBottom: 12 },
  metaHero: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, marginTop: 2 },
  metaSm: { alignItems: "flex-end" },
  metaSmVal: { fontSize: 13, fontWeight: "700", marginTop: 3 },
});

export default ClienteCrediarioModal;
