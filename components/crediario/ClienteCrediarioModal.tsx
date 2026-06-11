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
// fix (11/06/2026) auditoria ALTOS:
//   - A1-FE: fmtDate usa split string para datas YYYY-MM-DD (evita UTC off-by-one)
//   - A2-FE: triggerPreview passa paid_at; renomeado previewFifoPayment→previewPayment
//   - A5-FE: parseAmount distingue vírgula-decimal (BR) de ponto-decimal
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
  // A1-FE: date-only strings (YYYY-MM-DD) parsed as UTC midnight by new Date(),
  // causing off-by-one in UTC-3 (Brazil). For date-only inputs use string split.
  if (!iso) return "";
  try {
    const s = String(iso);
    if (s.length === 10) {
      // date-only — split to avoid UTC off-by-one
      const [y, m, d] = s.split("-");
      return d + "/" + m + "/" + y.slice(2);
    }
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch { return ""; }
}
function todayBrSp(): string {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return formatIsoToBr(iso);
}
function parseAmount(raw: string): number {
  // A5-FE: distinguish BR decimal (comma) from dot decimal.
  // "1.234,56" → 1234.56  "12,34" → 12.34  "12.34" → 12.34  "1234" → 1234
  // Previous impl removed ALL dots first, so "12.34" became "1234" (R$1.234,00).
  const s = String(raw || "").trim();
  if (!s) return 0;
  let normalized: string;
  if (s.includes(",")) {
    // BR format: dots are thousands separators, comma is decimal
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // Exactly one dot with 1-2 decimal digits → treat as decimal separator
    normalized = s;
  } else {
    // Only digits (possibly with dots as thousands) — strip dots
    normalized = s.replace(/\./g, "");
  }
  normalized = normalized.replace(/[^\d.]/g, "");
  const n = parseFloat(normalized);
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
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      onChanged?.();
    },
    onError: (err: any) => {
      toast.error(err?.data?.error || "Erro ao registrar recebimento");
    },
  });

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setTab("parcelas");
      setAmount("");
      setFreeAmt("");
      setFreePreview(null);
      setPixInstId(null);
      setPixData(null);
      setHistItems([]);
      setHistCursor(undefined);
      setHistHasMore(false);
    }
  }, [visible]);

  // Reset freeDateBr when modal opens
  useEffect(() => {
    if (visible) {
      setDateBr(todayBrSp());
      setFreeDateBr(todayBrSp());
    }
  }, [visible]);

  // Editar vencimento
  function openEditDueDate(inst: CreditInstallment) {
    setEditingDueDateInst(inst);
    setEditDueDateInput(formatIsoToBr(inst.due_date.slice(0, 10)));
    setEditDueDateError("");
  }

  async function confirmEditDueDate() {
    if (!editingDueDateInst || !customerId) return;
    const parsed = parseBrDate(editDueDateInput);
    if (!parsed) { setEditDueDateError("Data inválida"); return; }
    const iso = parsed.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    try {
      await Promise.all([
        creditApi.editInstallmentDueDate(companyId, customerId!, editingDueDateInst.id, iso),
      ]);
      toast.success("Vencimento atualizado!");
      setEditingDueDateInst(null);
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
    } catch (err: any) {
      setEditDueDateError(err?.data?.error || "Erro ao editar vencimento");
    }
  }

  // Bloqueio
  async function toggleBlock() {
    if (!customerId) return;
    const action = isBlocked ? "unblock" : "block";
    setBlockingAction(action);
    try {
      await creditApi.setBlockStatus(companyId, customerId, blockingAction === "block", blockReason || undefined);
      toast.success(action === "block" ? "Cliente bloqueado." : "Cliente desbloqueado.");
      setBlockReason("");
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao alterar bloqueio");
    } finally {
      setBlockingAction(null);
    }
  }

  // Salvar termos
  async function saveTerms() {
    if (!customerId) return;
    setSavingTerms(true);
    try {
      const overrides: Partial<CustomerTermsOverrides> = {};
      if (termsMaxInst) overrides.max_installments = parseInt(termsMaxInst) || null as any;
      if (termsInterest) overrides.interest_rate = parseFloat(termsInterest.replace(",", ".")) / 100 || null as any;
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

  // Criar novo carnê inline
  async function createAccount() {
    if (!customerId || !newAccountName.trim()) return;
    setCreatingAccount(true);
    try {
      await creditApi.createAccount(companyId, customerId, newAccountName.trim());
      toast.success("Carnê criado!");
      setNewAccountName("");
      setShowNewAccount(false);
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao criar carnê");
    } finally {
      setCreatingAccount(false);
    }
  }

  // Histórico
  async function loadHistory(cursor: string | null | undefined) {
    if (!customerId) return;
    setHistLoading(true);
    try {
      const res = await creditApi.getHistory(companyId, customerId, cursor || undefined);
      if (cursor) {
        setHistItems(prev => [...prev, ...(res.events || [])]);
      } else {
        setHistItems(res.events || []);
      }
      setHistCursor(res.next_cursor);
      setHistHasMore(!!res.next_cursor);
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
  // A2-FE: preview must use same paid_at as the apply, so freeDateBr is in deps
  //        and passed to previewPayment. Renamed previewFifoPayment→previewPayment.
  const triggerPreview = useCallback((amt: string, accId: string | null | undefined) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    const n = parseAmount(amt);
    if (n <= 0) { setFreePreview(null); return; }
    previewTimerRef.current = setTimeout(async () => {
      setFreePreviewLoading(true);
      try {
        const paidAt = parseBrDate(freeDateBr)?.toISOString();
        const res = await creditApi.previewPayment(companyId, customerId!, {
          amount: n,
          account_id: accId ?? null,
          paid_at: paidAt,
        });
        setFreePreview(res);
      } catch {
        setFreePreview(null);
      } finally {
        setFreePreviewLoading(false);
      }
    }, 450);
  }, [companyId, customerId, freeDateBr]);

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

  // Pix por parcela
  async function loadPix(installmentId: string) {
    if (pixInstId === installmentId) { setPixInstId(null); setPixData(null); return; }
    setPixInstId(installmentId);
    setPixLoading(true);
    try {
      const res = await creditApi.getInstallmentPix(companyId, customerId, installmentId);
      setPixData(res);
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao gerar Pix");
      setPixInstId(null);
    } finally {
      setPixLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!visible || !customerId) return null;

  const loading = detailQ.isLoading || profileQ.isLoading;
  const score = profile?.credit_score ?? 0;
  const scoreLabel = profile?.score_label ?? profile?.label;
  const availLimit = profile?.available_limit ?? Math.max(0, (profile?.credit_limit ?? 0) - (profile?.credit_used ?? 0));
  const scoreWarn = profile?.score_warning;

  const name = detail?.customer?.name || customerName || "";
  const phone = detail?.customer?.phone || "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={m.backdrop} onPress={onClose} />
      <View style={m.sheet}>

        {/* ── Header fixo: nome + score + saldo ── */}
        <View style={m.fichaHeaderFixed}>
          <View style={m.fichaHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={m.fichaName} numberOfLines={1}>{name || "..."}</Text>
              {phone ? <Text style={m.fichaPhone}>{phone}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={Colors.ink2} />
            </Pressable>
          </View>

          {/* Score + limite */}
          {profile && (
            <View style={m.fichaScoreRow}>
              {scoreLabel && (
                <View style={[m.scoreBadge, { borderColor: scoreColor(scoreLabel) + "55", backgroundColor: scoreColor(scoreLabel) + "18" }]}>
                  <Text style={[m.scoreBadgeTxt, { color: scoreColor(scoreLabel) }]}>{scoreLabelPt(scoreLabel)}</Text>
                </View>
              )}
              <Text style={m.fichaLimitTxt}>Limite: {fmt(profile.credit_limit ?? 0)} · Disponível: {fmt(availLimit)}</Text>
            </View>
          )}

          {/* Saldo em aberto hero */}
          <View style={m.fichaHero}>
            <Text style={m.fichaHeroLabel}>EM ABERTO</Text>
            <Text style={[m.fichaHeroValue, hasOverdue && { color: Colors.red }]}>{fmt(totalBalance)}</Text>
            {nextDueDate
              ? <Text style={m.fichaHeroMeta}>{openInst.length > 0 && fmtDate(nextDueDate)
                  ? ` · próximo venc. ${fmtDate(nextDueDate)}`
                  : ""}</Text>
              : null}
          </View>

          {/* Banner âmbar score_warning */}
          {scoreWarn && (
            <View style={m.warnBanner}>
              <Icon name="alert" size={13} color={Colors.amber} />
              <Text style={m.warnText}>
                Score {scoreWarn.actual} abaixo do mínimo ({scoreWarn.threshold}) — venda sob aprovação
              </Text>
            </View>
          )}

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={m.tabBar} contentContainerStyle={{ gap: 4 }}>
            {(["parcelas", "historico", "conta", "termos", "bloqueio"] as Tab[]).map(t => (
              <Pressable key={t} style={[m.tabBtn, tab === t && m.tabBtnActive]} onPress={() => setTab(t)}>
                <Text style={[m.tabTxt, tab === t && m.tabTxtActive]}>
                  {t === "parcelas" ? "Parcelas" : t === "historico" ? "Histórico" : t === "conta" ? "Conta" : t === "termos" ? "Termos" : "Bloqueio"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ── Body scrollável ── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 32 }}>

          {loading ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <ActivityIndicator color={Colors.violet3} />
              <Text style={{ marginTop: 12, color: Colors.ink3 }}>Carregando...</Text>
            </View>
          ) : tab === "parcelas" ? (
            <View>
              {useCarneLayout ? (
                /* Layout carnês */
                realCarnes.map(acc => {
                  const accInst = instByAccount.get(acc.id) || [];
                  const openAccInst = accInst.filter(i => i.status === "open" || i.status === "overdue");
                  const isExpanded = expandedAccountId === acc.id;
                  const accBalance = acc.balance ?? 0;
                  const accOverdue = acc.overdue;

                  return (
                    <View key={acc.id || "general"} style={m.accCard}>
                      <Pressable style={m.accHead} onPress={() => setExpandedAccountId(isExpanded ? undefined : acc.id)}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={m.accName}>{acc.name}</Text>
                            <View style={[m.accBadge, accOverdue && { backgroundColor: Colors.red + "22", borderColor: Colors.red + "44" }]}>
                              <Text style={[m.accBadgeTxt, accOverdue && { color: Colors.red }]}>
                                {accOverdue ? "Atrasado" : "Em dia"}
                              </Text>
                            </View>
                            <Text style={m.accPeriod}>{periodLabel(acc)}</Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
                            <Text style={[m.accBalance, accOverdue && { color: Colors.red }]}>{fmt(accBalance)}</Text>
                            {!!fmtDate(acc.next_due_date || "") && (
                              <Text style={m.accNextDue}>Próx. {fmtDate(acc.next_due_date!)}</Text>
                            )}
                          </View>
                        </View>
                        <Icon name={isExpanded ? "chevron_up" : "chevron_down"} size={16} color={Colors.ink3} />
                      </Pressable>

                      {isExpanded && (
                        <View style={m.accBody}>
                          {openAccInst.length === 0 ? (
                            <Text style={m.emptyInstText}>Nenhuma parcela em aberto neste carnê.</Text>
                          ) : (
                            openAccInst.map(ins => {
                              const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
                              const hasCharges = (ins.charges_total ?? 0) > 0;
                              const isEditingThis = editingDueDateInst?.id === ins.id;

                              return (
                                <View key={ins.id} style={m.parcRow}>
                                  <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                      <Text style={[m.parcNum, ins.status === "overdue" && { color: Colors.red }]}>
                                        Parcela {ins.installment_number}/{ins.total_installments}
                                      </Text>
                                      {ins.status === "overdue" && <Text style={m.overduePill}>Atrasada</Text>}
                                    </View>
                                    <Text style={m.parcS}>Venc. {fmtDate(ins.due_date)} · {fmt(rem)}</Text>

                                    {hasCharges && (
                                      <View style={m.chargesBox}>
                                        <Text style={m.chargesRow}>Principal: {fmt(rem - (ins.charges_total ?? 0))}</Text>
                                        <Text style={m.chargesRow}>Multa: {fmt(ins.late_fee ?? 0)}</Text>
                                        <Text style={m.chargesRow}>Mora ({ins.days_charged ?? 0}d): {fmt(ins.late_interest ?? 0)}</Text>
                                        <Text style={[m.chargesRow, { fontWeight: "700" }]}>Total: {fmt(ins.total_due ?? rem)}</Text>
                                      </View>
                                    )}

                                    {isEditingThis && (
                                      <View style={m.dueDateEditor}>
                                        <DateInput
                                          value={editDueDateInput}
                                          onChangeText={v => { setEditDueDateInput(v); setEditDueDateError(""); }}
                                          placeholder="dd/mm/aaaa"
                                          style={m.dueDateInput}
                                        />
                                        {editDueDateError ? <Text style={m.dueDateError}>{editDueDateError}</Text> : null}
                                        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                                          <Pressable style={m.dueDateSave} onPress={confirmEditDueDate}>
                                            <Text style={m.dueDateSaveTxt}>Salvar</Text>
                                          </Pressable>
                                          <Pressable onPress={() => setEditingDueDateInst(null)}>
                                            <Text style={{ color: Colors.ink3, fontSize: 12, paddingVertical: 6 }}>Cancelar</Text>
                                          </Pressable>
                                        </View>
                                      </View>
                                    )}
                                  </View>

                                  <View style={{ flexDirection: "row", gap: 6 }}>
                                    {/* Pix */}
                                    <Pressable
                                      style={m.iconBtn}
                                      onPress={() => loadPix(ins.id)}
                                    >
                                      {pixLoading && pixInstId === ins.id
                                        ? <ActivityIndicator size="small" color={Colors.violet3} />
                                        : <Icon name="qr_code" size={16} color={pixInstId === ins.id ? Colors.violet3 : Colors.ink2} />}
                                    </Pressable>
                                    {/* Editar vencimento */}
                                    <Pressable style={m.iconBtn} onPress={() => isEditingThis ? setEditingDueDateInst(null) : openEditDueDate(ins)}>
                                      <Icon name="calendar" size={16} color={isEditingThis ? Colors.violet3 : Colors.ink2} />
                                    </Pressable>
                                  </View>
                                </View>
                              );
                            })
                          )}

                          {/* Pix inline */}
                          {pixInstId && pixData && openAccInst.find(i => i.id === pixInstId) && (
                            <View style={m.pixCard}>
                              <View style={{ alignItems: "center", marginBottom: 12 }}>
                                <QRCode value={pixData.emv} size={160} />
                              </View>
                              <Text style={m.pixLabel}>Pix copia-e-cola</Text>
                              <Pressable onPress={() => {
                                Clipboard.setString(pixData.emv);
                                toast.success("Copiado!");
                              }} style={m.pixCopy}>
                                <Icon name="copy" size={14} color={Colors.violet3} />
                                <Text style={m.pixCopyTxt} numberOfLines={2}>{pixData.emv}</Text>
                              </Pressable>
                              <Text style={m.pixAmt}>{fmt(pixData.amount)}</Text>
                              {pixData.installment && (
                                <Text style={m.pixMeta}>
                                  Parcela {pixData.installment.number} · venc. {fmtDate(pixData.installment.due_date)}
                                </Text>
                              )}
                            </View>
                          )}

                          {/* Ações do carnê */}
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                            <Pressable
                              style={[m.carneBtn]}
                              onPress={() => printCarne(companyId, acc.id!)}
                            >
                              <Icon name="printer" size={14} color={Colors.violet3} />
                              <Text style={m.carneBtnTxt}>Imprimir carnê</Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                /* Layout plano (sem carnês) */
                <View>
                  {openInst.length === 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: "center" }}>
                      <Text style={m.emptyInstText}>Nenhuma parcela em aberto.</Text>
                    </View>
                  ) : (
                    openInst.map(ins => {
                      const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
                      const hasCharges = (ins.charges_total ?? 0) > 0;
                      const isEditingThis = editingDueDateInst?.id === ins.id;

                      return (
                        <View key={ins.id} style={m.parcRow}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={[m.parcNum, ins.status === "overdue" && { color: Colors.red }]}>
                                Parcela {ins.installment_number}/{ins.total_installments}
                              </Text>
                              {ins.status === "overdue" && <Text style={m.overduePill}>Atrasada</Text>}
                            </View>
                            <Text style={m.parcS}>Venc. {fmtDate(ins.due_date)} · {fmt(rem)}</Text>

                            {hasCharges && (
                              <View style={m.chargesBox}>
                                <Text style={m.chargesRow}>Principal: {fmt(rem - (ins.charges_total ?? 0))}</Text>
                                <Text style={m.chargesRow}>Multa: {fmt(ins.late_fee ?? 0)}</Text>
                                <Text style={m.chargesRow}>Mora ({ins.days_charged ?? 0}d): {fmt(ins.late_interest ?? 0)}</Text>
                                <Text style={[m.chargesRow, { fontWeight: "700" }]}>Total: {fmt(ins.total_due ?? rem)}</Text>
                              </View>
                            )}

                            {isEditingThis && (
                              <View style={m.dueDateEditor}>
                                <DateInput
                                  value={editDueDateInput}
                                  onChangeText={v => { setEditDueDateInput(v); setEditDueDateError(""); }}
                                  placeholder="dd/mm/aaaa"
                                  style={m.dueDateInput}
                                />
                                {editDueDateError ? <Text style={m.dueDateError}>{editDueDateError}</Text> : null}
                                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                                  <Pressable style={m.dueDateSave} onPress={confirmEditDueDate}>
                                    <Text style={m.dueDateSaveTxt}>Salvar</Text>
                                  </Pressable>
                                  <Pressable onPress={() => setEditingDueDateInst(null)}>
                                    <Text style={{ color: Colors.ink3, fontSize: 12, paddingVertical: 6 }}>Cancelar</Text>
                                  </Pressable>
                                </View>
                              </View>
                            )}
                          </View>

                          <View style={{ flexDirection: "row", gap: 6 }}>
                            <Pressable style={m.iconBtn} onPress={() => loadPix(ins.id)}>
                              {pixLoading && pixInstId === ins.id
                                ? <ActivityIndicator size="small" color={Colors.violet3} />
                                : <Icon name="qr_code" size={16} color={pixInstId === ins.id ? Colors.violet3 : Colors.ink2} />}
                            </Pressable>
                            <Pressable style={m.iconBtn} onPress={() => isEditingThis ? setEditingDueDateInst(null) : openEditDueDate(ins)}>
                              <Icon name="calendar" size={16} color={isEditingThis ? Colors.violet3 : Colors.ink2} />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  )}

                  {/* Pix inline (layout plano) */}
                  {pixInstId && pixData && openInst.find(i => i.id === pixInstId) && (
                    <View style={m.pixCard}>
                      <View style={{ alignItems: "center", marginBottom: 12 }}>
                        <QRCode value={pixData.emv} size={160} />
                      </View>
                      <Text style={m.pixLabel}>Pix copia-e-cola</Text>
                      <Pressable onPress={() => {
                        Clipboard.setString(pixData!.emv);
                        toast.success("Copiado!");
                      }} style={m.pixCopy}>
                        <Icon name="copy" size={14} color={Colors.violet3} />
                        <Text style={m.pixCopyTxt} numberOfLines={2}>{pixData.emv}</Text>
                      </Pressable>
                      <Text style={m.pixAmt}>{fmt(pixData.amount)}</Text>
                      {pixData.installment && (
                        <Text style={m.pixMeta}>
                          Parcela {pixData.installment.number} · venc. {fmtDate(pixData.installment.due_date)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

          ) : tab === "historico" ? (
            <View>
              {histLoading && histItems.length === 0 ? (
                <ActivityIndicator color={Colors.violet3} style={{ marginTop: 16 }} />
              ) : histItems.length === 0 ? (
                <Text style={m.emptyInstText}>Nenhum evento encontrado.</Text>
              ) : (
                histItems.map((ev, i) => (
                  <View key={ev.id || i} style={m.tlRow}>
                    <View style={m.tlDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={m.tlTitle}>
                        {ev.type === "purchase" ? "Compra" :
                          ev.type === "manual_debit" ? "Débito manual" :
                          ev.type === "payment" ? "Pagamento" :
                          ev.type === "exchange_credit" ? "Crédito (troca)" :
                          "Devolução"}
                        {" "}{ev.amount > 0 ? "+" : ""}{fmt(ev.amount)}
                      </Text>
                      <Text style={m.tlSub}>{fmtDate(ev.created_at)}</Text>
                      {ev.items && ev.items.length > 0 && (
                        <Text style={m.tlDetail} numberOfLines={2}>
                          {ev.items.map(it => `${it.product_name} ×${it.quantity}`).join(", ")}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
              {histHasMore && (
                <Pressable style={m.loadMoreBtn} onPress={() => loadHistory(histCursor)} disabled={histLoading}>
                  {histLoading ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Text style={m.loadMoreTxt}>Carregar mais</Text>}
                </Pressable>
              )}
            </View>

          ) : tab === "conta" ? (
            <View>
              {/* Saldo geral */}
              <View style={m.summaryRow}>
                <Text style={m.summaryLabel}>Saldo total em aberto</Text>
                <Text style={[m.summaryValue, { color: totalBalance > 0 ? Colors.red : Colors.green }]}>{fmt(totalBalance)}</Text>
              </View>

              {/* Carnês */}
              {hasAccounts && (
                <View style={{ marginTop: 16 }}>
                  <Text style={m.sectionTitle}>Carnês ({accounts.length})</Text>
                  {accounts.map(acc => (
                    <View key={acc.id || "general"} style={m.accSummaryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={m.accSummaryName}>{acc.name}</Text>
                        <Text style={m.accSummaryMeta}>{acc.open_count} parcelas · {acc.status === "open" ? "Ativo" : "Fechado"}</Text>
                      </View>
                      <Text style={[m.accSummaryBal, acc.overdue && { color: Colors.red }]}>{fmt(acc.balance)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Criar carnê */}
              {!showNewAccount ? (
                <Pressable style={m.addAccountBtn} onPress={() => setShowNewAccount(true)}>
                  <Icon name="plus" size={14} color={Colors.violet3} />
                  <Text style={m.addAccountTxt}>Novo carnê</Text>
                </Pressable>
              ) : (
                <View style={m.newAccountForm}>
                  <TextInput
                    style={m.newAccountInput}
                    placeholder="Nome do carnê (ex: Mensal Janeiro)"
                    placeholderTextColor={Colors.ink3}
                    value={newAccountName}
                    onChangeText={setNewAccountName}
                    autoFocus
                  />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      style={[m.cta, { flex: 1 }, (creatingAccount || !newAccountName.trim()) && { opacity: 0.45 }]}
                      disabled={creatingAccount || !newAccountName.trim()}
                      onPress={createAccount}
                    >
                      {creatingAccount ? <ActivityIndicator size="small" color="#fff" /> : <Text style={m.ctaTxt}>Criar</Text>}
                    </Pressable>
                    <Pressable onPress={() => { setShowNewAccount(false); setNewAccountName(""); }} style={{ justifyContent: "center", paddingHorizontal: 12 }}>
                      <Text style={{ color: Colors.ink3 }}>Cancelar</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

          ) : tab === "termos" ? (
            <View>
              <Text style={m.sectionTitle}>Termos personalizados</Text>
              <Text style={m.termsDesc}>Sobrescreve o plano geral só para este cliente. Deixe em branco para usar o padrão.</Text>

              {profile?.terms?.overrides && Object.values(profile.terms.overrides).some(v => v !== null) && (
                <View style={m.overrideBadge}>
                  <Text style={m.overrideBadgeTxt}>Termos customizados ativos</Text>
                </View>
              )}

              <View style={m.fieldGroup}>
                <Text style={m.fieldLabel}>Máx. parcelas</Text>
                <TextInput
                  style={m.fieldInput}
                  value={termsMaxInst}
                  onChangeText={v => { setTermsMaxInst(v.replace(/\D/g, "")); setTermsDirty(true); }}
                  placeholder={String(profile?.terms?.effective?.max_installments ?? profile?.config?.max_installments ?? "")}
                  placeholderTextColor={Colors.ink3}
                  keyboardType="numeric"
                />
              </View>

              <View style={m.fieldGroup}>
                <Text style={m.fieldLabel}>Juros mensais (%)</Text>
                <TextInput
                  style={m.fieldInput}
                  value={termsInterest}
                  onChangeText={v => { setTermsInterest(v.replace(/[^\d,]/g, "")); setTermsDirty(true); }}
                  placeholder={profile?.terms?.effective?.interest_rate != null ? String((profile.terms.effective.interest_rate * 100).toFixed(2)) : ""}
                  placeholderTextColor={Colors.ink3}
                  keyboardType="decimal-pad"
                />
              </View>

              <Pressable
                style={[m.cta, (!termsDirty || savingTerms) && { opacity: 0.45 }]}
                disabled={!termsDirty || savingTerms}
                onPress={saveTerms}
              >
                {savingTerms ? <ActivityIndicator size="small" color="#fff" /> : <Text style={m.ctaTxt}>Salvar termos</Text>}
              </Pressable>

              {(termsMaxInst || termsInterest) && (
                <Pressable style={m.clearBtn} onPress={() => {
                  setTermsMaxInst(""); setTermsInterest(""); setTermsDirty(true);
                  toast.info?.("Limpar e salvar para remover customização");
                }}>
                  <Text style={m.clearBtnTxt}>Limpar customização</Text>
                </Pressable>
              )}
            </View>

          ) : /* bloqueio */ (
            <View>
              <Text style={m.sectionTitle}>Gestão de acesso ao crediário</Text>

              <View style={m.blockRow}>
                <View style={{ flex: 1 }}>
                  <Text style={m.blockLabel}>{isBlocked ? "Cliente bloqueado" : "Cliente ativo"}</Text>
                  <Text style={m.blockMeta}>{isBlocked ? (profile?.blocked_reason || "Sem motivo registrado") : "Compras liberadas no crediário"}</Text>
                </View>
                <Switch
                  value={isBlocked}
                  onValueChange={toggleBlock}
                  disabled={!!blockingAction}
                  trackColor={{ false: Colors.green + "66", true: Colors.red + "66" }}
                  thumbColor={isBlocked ? Colors.red : Colors.green}
                />
              </View>

              {!isBlocked && (
                <View style={m.fieldGroup}>
                  <Text style={m.fieldLabel}>Motivo do bloqueio (opcional)</Text>
                  <TextInput
                    style={[m.fieldInput, { minHeight: 60 }]}
                    value={blockReason}
                    onChangeText={setBlockReason}
                    placeholder="Ex.: inadimplência recorrente"
                    placeholderTextColor={Colors.ink3}
                    multiline
                  />
                </View>
              )}

              {!!blockingAction && <ActivityIndicator style={{ marginTop: 12 }} color={Colors.violet3} />}

              {/* Cobrar via WhatsApp */}
              {onCobrar && phone && (
                <Pressable
                  style={[m.cta, { marginTop: 20, backgroundColor: Colors.green }]}
                  onPress={() => { onClose(); onCobrar(customerId!, name, phone); }}
                >
                  <Icon name="message_circle" size={16} color="#fff" />
                  <Text style={m.ctaTxt}>Enviar cobrança via WhatsApp</Text>
                </Pressable>
              )}
            </View>
          )}

        </ScrollView>

        {/* ── Barra de ações persistente (fichaActionBar) ── */}
        <View style={m.fichaActionBar}>
          {/* Receber (FIFO normal) */}
          <View style={{ flex: 1 }}>
            <View style={m.amountIn}>
              <Text style={m.amountPrefix}>R$</Text>
              <TextInput
                style={m.amountInput}
                value={amount}
                onChangeText={v => setAmount(v.replace(/[^\d,.]/g, ""))}
                placeholder="0,00"
                placeholderTextColor={Colors.ink3}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <Pressable
            style={[m.fichaActionBtn, (amountNum <= 0 || payMut.isPending || dateInvalid) && { opacity: 0.45 }]}
            disabled={amountNum <= 0 || payMut.isPending || dateInvalid}
            onPress={() => payMut.mutate()}
          >
            {payMut.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={m.fichaActionBtnTxt}>Receber {amountNum > 0 ? fmt(amountNum) : ""}</Text>}
          </Pressable>

          {/* Valor Livre */}
          <Pressable
            style={[m.fichaActionBtn, m.fichaActionBtnSecondary, (parseAmount(freeAmt) <= 0 || freeSubmitting) && { opacity: 0.45 }]}
            disabled={parseAmount(freeAmt) <= 0 || freeSubmitting}
            onPress={confirmFreePayment}
          >
            {freeSubmitting
              ? <ActivityIndicator size="small" color={Colors.violet3} />
              : <Text style={[m.fichaActionBtnTxt, { color: Colors.violet3 }]}>
                  {parseAmount(freeAmt) > 0 ? `Confirmar ${fmt(parseAmount(freeAmt))}` : "Valor livre"}
                </Text>}
          </Pressable>
        </View>

        {/* ── Preview de distribuição (valor livre) ── */}
        {(freePreviewLoading || freePreview) && (
          <View style={m.previewBox}>
            {freePreviewLoading ? (
              <ActivityIndicator size="small" color={Colors.violet3} />
            ) : freePreview ? (
              <View>
                <Text style={m.previewTitle}>Preview de distribuição</Text>
                {freePreview.applied.map((line, i) => (
                  <View key={i} style={m.previewRow}>
                    <Text style={m.previewLabel}>Parcela {line.number ?? "?"}</Text>
                    <Text style={m.previewVal}>{fmt(line.principal_paid + line.charges_paid)}</Text>
                  </View>
                ))}
                <View style={[m.previewRow, { marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 6 }]}>
                  <Text style={m.previewLabel}>Saldo após</Text>
                  <Text style={[m.previewVal, { color: freePreview.new_balance > 0 ? Colors.red : Colors.green, fontSize: 16 }]}>
                    {fmt(freePreview.new_balance)}
                  </Text>
                </View>
                {freePreview.credit_generated > 0 && (
                  <View style={m.previewRow}>
                    <Text style={m.previewLabel}>Crédito gerado</Text>
                    <Text style={[m.previewVal, { color: Colors.green }]}>{fmt(freePreview.credit_generated)}</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        )}

      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "92%",
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },

  // Fixed header
  fichaHeaderFixed: {
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 0,
  },
  fichaHeaderRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  fichaName: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  fichaPhone: { fontSize: 12, color: Colors.ink3, marginTop: 2 },

  fichaScoreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  scoreBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  scoreBadgeTxt: { fontSize: 11, fontWeight: "700" },
  fichaLimitTxt: { fontSize: 11, color: Colors.ink3 },

  fichaHero: { alignItems: "center", paddingVertical: 14 },
  fichaHeroLabel: { fontSize: 10, fontWeight: "800", color: Colors.ink3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  fichaHeroValue: { fontSize: 36, fontWeight: "900", color: Colors.ink, letterSpacing: -1 },
  fichaHeroMeta: { fontSize: 11, color: Colors.ink3, marginTop: 4 },

  warnBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.amber + "18", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  warnText: { fontSize: 12, color: Colors.amber, flex: 1 },

  tabBar: { marginTop: 4, marginBottom: 0 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: Colors.violet3 },
  tabTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  tabTxtActive: { color: Colors.violet3 },

  // Carnê cards
  accCard: { backgroundColor: Colors.bg3, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, overflow: "hidden" },
  accHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  accName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  accBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: Colors.green + "44", backgroundColor: Colors.green + "18" },
  accBadgeTxt: { fontSize: 10, fontWeight: "700", color: Colors.green },
  accPeriod: { fontSize: 11, color: Colors.ink3 },
  accBalance: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  accNextDue: { fontSize: 11, color: Colors.ink3 },
  accBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: Colors.border },

  // Parcelas
  parcRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  parcNum: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  parcS: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  overduePill: { fontSize: 10, fontWeight: "700", color: Colors.red, backgroundColor: Colors.red + "18", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  emptyInstText: { fontSize: 13, color: Colors.ink3, paddingVertical: 12 },

  chargesBox: { marginTop: 6, backgroundColor: Colors.amber + "12", borderRadius: 8, padding: 8, gap: 2 },
  chargesRow: { fontSize: 11, color: Colors.ink2 },

  dueDateEditor: { marginTop: 8 },
  dueDateInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg3 },
  dueDateError: { fontSize: 11, color: Colors.red, marginTop: 4 },
  dueDateSave: { backgroundColor: Colors.violet3, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  dueDateSaveTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Pix card
  pixCard: { marginTop: 12, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  pixLabel: { fontSize: 11, fontWeight: "700", color: Colors.ink3, marginBottom: 6 },
  pixCopy: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.bg4, borderRadius: 8, padding: 10 },
  pixCopyTxt: { flex: 1, fontSize: 11, color: Colors.ink2, fontFamily: Platform.OS === "web" ? "monospace" : undefined },
  pixAmt: { fontSize: 18, fontWeight: "800", color: Colors.ink, marginTop: 10, textAlign: "center" },
  pixMeta: { fontSize: 11, color: Colors.ink3, marginTop: 4, textAlign: "center" },

  iconBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg3 },

  carneBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: Colors.violet3 + "55", backgroundColor: Colors.violetD },
  carneBtnTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  // Histórico
  tlRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  tlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.violet3, marginTop: 5 },
  tlTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  tlSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  tlDetail: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  loadMoreBtn: { paddingVertical: 12, alignItems: "center" },
  loadMoreTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },

  // Conta / summary
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  summaryLabel: { fontSize: 13, color: Colors.ink2 },
  summaryValue: { fontSize: 16, fontWeight: "800" },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 },
  accSummaryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  accSummaryName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  accSummaryMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  accSummaryBal: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  addAccountBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.violet3 + "55", backgroundColor: Colors.violetD },
  addAccountTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  newAccountForm: { marginTop: 12 },
  newAccountInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg3 },

  // Termos
  termsDesc: { fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  overrideBadge: { backgroundColor: Colors.violet3 + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 14, borderWidth: 1, borderColor: Colors.violet3 + "44" },
  overrideBadgeTxt: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: Colors.ink3, marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" },
  fieldInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg3 },
  clearBtn: { marginTop: 10, alignItems: "center" },
  clearBtnTxt: { fontSize: 12, color: Colors.red },

  // Bloqueio
  blockRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  blockLabel: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  blockMeta: { fontSize: 12, color: Colors.ink3, marginTop: 2 },

  // CTA buttons
  cta: { backgroundColor: Colors.violet3, borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  ctaTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Action bar
  fichaActionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  fichaActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.violet3,
    alignItems: "center",
    justifyContent: "center",
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

  // Amount input (action bar)
  amountIn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8 },
  amountPrefix: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  amountInput: { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.ink, outlineStyle: "none" as any },

  // Methods
  methods: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  method: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  methodActive: { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
  methodTxt: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  methodTxtActive: { color: Colors.violet3 },

  // Date input
  dateInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg3 },

  // Preview distribuição (valor livre)
  previewBox: { backgroundColor: Colors.bg3, borderTopWidth: 1, borderTopColor: Colors.border, padding: 14 },
  previewTitle: { fontSize: 11, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  previewLabel: { fontSize: 12, color: Colors.ink3 },
  previewVal: { fontSize: 13, fontWeight: "700", color: Colors.ink },

} as any);

export default ClienteCrediarioModal;
