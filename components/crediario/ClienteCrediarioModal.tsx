// ============================================================
// AURA. — Crediário · Modal de detalhe do cliente
//
// (decomposto em ficha/* em 11/06; este é o shell que mantém estado/queries
//  e compõe TabParcelas/TabHistorico/TabConta.)
//
// C-2 (12/06): header do cliente + banner + abas ficam FIXOS (fora do
//   ScrollView); só o conteúdo da aba rola. Footer "Confirmar recebimento"
//   removido em consolidação (13/06): CTA vive dentro do card B3 com preview.
// A2-FE (12/06): triggerPreview envia paid_at (alinha preview↔aplicação no
//   recebimento retroativo com encargos).
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
import {
  fmt, fmtDate, todayBrSp, parseAmount, periodLabel, scoreColor, scoreLabelPt,
  PAYMENT_METHODS, type ReceiveMode, type Tab,
} from "./ficha/fichaHelpers";
import { m } from "./ficha/fichaStyles";
import { TabParcelas } from "./ficha/TabParcelas";
import { TabHistorico } from "./ficha/TabHistorico";
import { TabConta } from "./ficha/TabConta";

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

  const [histEvents, setHistEvents] = useState<CreditHistoryEvent[]>([]);
  const [histCursor, setHistCursor] = useState<string | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histLoaded, setHistLoaded] = useState(false);

  // ── B3: único fluxo de recebimento de valor livre ─────────────────────
  const [freeAmt, setFreeAmt] = useState("");
  const [freeMethod, setFreeMethod] = useState("dinheiro");
  const [freeDateBr, setFreeDateBr] = useState(todayBrSp());
  const [freeAccountId, setFreeAccountId] = useState<string | null | undefined>(undefined);
  const [freePreview, setFreePreview] = useState<PaymentPlan | null>(null);
  const [freePreviewLoading, setFreePreviewLoading] = useState(false);
  const [freeSubmitting, setFreeSubmitting] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pixInstId, setPixInstId] = useState<string | null>(null);
  const [pixData, setPixData] = useState<CreditPix | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

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
      setHistEvents([]);
      setHistCursor(null);
      setHistLoaded(false);
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
  const openSum = openInst.reduce((s, i) => s + (i.remaining ?? (i.amount_due - (i.covered_amount || 0))), 0);

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

  // prefill: alimenta o fluxo B3 (único) e dispara preview
  function prefill(v: number) {
    const str = v.toFixed(2).replace(".", ",");
    setFreeAmt(str);
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={m.backdrop} onPress={onClose}>
        <Pressable style={m.sheet} onPress={() => {}}>
          <View style={m.head}>
            <Pressable onPress={onClose} style={m.crumb}>
              <Icon name="chevron_right" size={15} color={Colors.violet3} style={{ transform: [{ rotate: "180deg" }] } as any} />
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
                  <Icon name="message_circle" size={14} color={Colors.green} />
                  <Text style={m.waTxt}>Cobrar</Text>
                </Pressable>
              )}
            </View>

            {!!profile && (
              <View style={m.fixedMeta}>
                <View style={m.fixedMetaItem}>
                  <Text style={m.fixedMetaLbl}>SCORE</Text>
                  <Text style={[m.fixedMetaVal, { color: scoreColor(scoreLabel) }]}>{profile.credit_score}</Text>
                </View>
                {availableLimit !== undefined && (
                  <View style={m.fixedMetaItem}>
                    <Text style={m.fixedMetaLbl}>DISPONÍVEL</Text>
                    <Text style={[m.fixedMetaVal, { color: availableLimit >= 0 ? Colors.green : Colors.red }]}>{fmt(availableLimit)}</Text>
                  </View>
                )}
                <View style={m.fixedMetaItem}>
                  <Text style={m.fixedMetaLbl}>{totalBalance < 0 ? "CRÉDITO A FAVOR" : "EM ABERTO"}</Text>
                  <Text style={[m.fixedMetaVal, { color: totalBalance < 0 ? Colors.green : totalBalance > 0 ? Colors.red : Colors.ink3 }]}>
                    {fmt(Math.abs(totalBalance))}
                  </Text>
                </View>
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

            <View style={m.tabs}>
              {(["parcelas", "historico", "conta"] as Tab[]).map(t => (
                <Pressable key={t} style={[m.tab, tab === t && m.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[m.tabTxt, tab === t && m.tabTxtOn]}>
                    {t === "parcelas" ? "Parcelas" : t === "historico" ? "Histórico" : "Conta"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[m.tabs, { marginTop: -4, marginBottom: 8 }]}>
              {(["termos", "bloqueio"] as Tab[]).map(t => (
                <Pressable key={t} style={[m.tab, m.tabSm, tab === t && m.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[m.tabTxt, tab === t && m.tabTxtOn]}>
                    {t === "termos" ? `Termos${hasTermsOverride ? " •" : ""}` : "Bloqueio"}
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
                    profile={profile} detail={detail} accounts={accounts} openInst={openInst}
                    instByAccount={instByAccount} useCarneLayout={useCarneLayout} realCarnes={realCarnes}
                    totalBalance={totalBalance} nextDueDate={nextDueDate} scoreLabel={scoreLabel}
                    availableLimit={availableLimit} isBlocked={isBlocked} hasOverdue={hasOverdue}
                    handleCreateAccount={handleCreateAccount} showNewAccount={showNewAccount}
                    setShowNewAccount={setShowNewAccount} newAccountName={newAccountName}
                    setNewAccountName={setNewAccountName} creatingAccount={creatingAccount}
                    expandedAccountId={expandedAccountId} setExpandedAccountId={setExpandedAccountId}
                    handleEditDueDateOpen={handleEditDueDateOpen} openInstallmentPix={openInstallmentPix}
                    freeAmt={freeAmt} setFreeAmt={setFreeAmt} freeMethod={freeMethod} setFreeMethod={setFreeMethod}
                    freeDateBr={freeDateBr} setFreeDateBr={setFreeDateBr}
                    freeAccountId={freeAccountId} setFreeAccountId={setFreeAccountId}
                    freePreview={freePreview} freePreviewLoading={freePreviewLoading}
                    confirmFreePayment={confirmFreePayment} freeSubmitting={freeSubmitting}
                    prefill={prefill} triggerPreview={triggerPreview}
                    companyId={companyId} customerId={customerId!} phone={phone} onCobrar={onCobrar} name={name}
                  />
                )}

                {tab === "historico" && (
                  <TabHistorico
                    histEvents={histEvents} histCursor={histCursor} histLoading={histLoading}
                    histLoaded={histLoaded} loadHistory={loadHistory} setHistLoaded={setHistLoaded}
                  />
                )}

                {tab === "conta" && (
                  <TabConta
                    profile={profile} isBlocked={isBlocked} scoreLabel={scoreLabel}
                    availableLimit={availableLimit} totalBalance={totalBalance} openInst={openInst}
                    nextDueDate={nextDueDate} hasTermsOverride={hasTermsOverride} realCarnes={realCarnes}
                  />
                )}

                {tab === "termos" && (
                  <View style={m.card}>
                    <View style={m.cardTitleRow}>
                      <Text style={m.cardTitle}>Termos deste cliente</Text>
                      {hasTermsOverride && (
                        <View style={[m.pill, { backgroundColor: Colors.violet3 + "22" }]}>
                          <Text style={[m.pillTxt, { color: Colors.violet3 }]}>Condições personalizadas</Text>
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
      </Pressable>
    </Modal>
  );
}

export default ClienteCrediarioModal;
