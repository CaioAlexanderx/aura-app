// ============================================================
// AnnuityReceivableRow — Shoji · Fase F4/F5 (extraído do hub de Anuidades)
//
// Fonte única do RENDER de uma linha de anuidade-como-recebível (barra
// devido→recebido, saldo, selo Quitado/Parcial/Em aberto/Atrasado via
// annuityReceivableStatusView, trilha de parcelas, painel expandido com
// pagar/pix/editar/e-mail/histórico por parcela) — usada tanto pela aba
// de Anuidades do hub financeiro (AnnuitiesTable.tsx) quanto pela seção
// de Anuidades dentro da página do dojô ([dojoId].tsx). Extraído de
// AnnuitiesTable.tsx (AnnuityRowItem, ~linha 619) para não existir uma 2ª
// implementação paralela do mesmo recebível — qualquer ajuste visual ou
// de regra de negócio (badge, trilha, ações) muda nos DOIS lugares de uma
// vez, nunca diverge.
//
// 🔴 Mesma regra de AnnuityReceiveModal: nada aqui recalcula a
// distribuição FIFO — só exibe paid_total/total/installments que já
// vieram prontos do backend (GET .../annuities/dojos|cpf).
// ============================================================
import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
  annuityStatusView, annuityReceivableStatusView,
} from "@/constants/karateTheme";
import { Mono, Body, RowPressable, ShojiBadge } from "@/components/karate/shoji";
import { toast } from "@/components/Toast";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import {
  karateApi, DojoAnnuity, CpfAnnuity, AnnuityInstallment, AnnuityPlan, AnnuityPaymentMethod,
  FinanceAuditEntry,
} from "@/services/karateApi";

/** Mesmo vocabulário de segmento do hub (AnnuitiesHub.SegKey) — redeclarado
 *  aqui em vez de importado de um arquivo de página (app/karate/...) pra
 *  não criar uma dependência de componente compartilhado -> página. É
 *  estruturalmente idêntico a SegKey; qualquer valor "dojo"|"cpf" das duas
 *  pontas é intercambiável. */
export type ReceivableSeg = "dojo" | "cpf";

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthAbbrOf(dueDate: string | null): string {
  if (!dueDate) return "—";
  const m = /^\d{4}-(\d{2})-\d{2}/.exec(dueDate);
  if (!m) return "—";
  const idx = parseInt(m[1], 10) - 1;
  return MONTH_ABBR[idx] ?? "—";
}

export const PLAN_LABEL: Record<AnnuityPlan, string> = { anual: "Anual", semestral: "Semestral", trimestral: "Trimestral" };

// ── Fase G3: histórico curto e legível (linguagem de gestor, não de log
// de sistema) — traduz cada linha de karate_finance_audit_log pra uma
// frase que a UI mostra ao expandir a parcela.
function fmtAuditWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const timePart = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} às ${timePart}`;
}

export function describeFinanceAuditEntry(entry: FinanceAuditEntry): string {
  const when = fmtAuditWhen(entry.created_at);
  const byWebhook = entry.actor_label === "webhook";
  const who = byWebhook ? null : entry.actor_label;

  switch (entry.action) {
    case "installment_pay":
    case "annuity_pay":
    case "annuity_charge_and_pay":
      if (byWebhook) return `Pago automaticamente via PIX em ${when}`;
      return who ? `Pago por ${who} em ${when}` : `Pago em ${when}`;
    case "intent_confirm":
      if (byWebhook) return `Pagamento confirmado automaticamente em ${when}`;
      return who ? `Pagamento confirmado por ${who} em ${when}` : `Pagamento confirmado em ${when}`;
    case "charge_create":
      if (entry.source === "campaign") return `Cobrança criada pela campanha em ${when}`;
      if (entry.source === "batch") return `Cobrança criada em lote em ${when}`;
      return who ? `Cobrança criada por ${who} em ${when}` : `Cobrança criada em ${when}`;
    case "void":
      if (entry.source === "batch") return `Removida em lote em ${when}`;
      return who ? `Removida por ${who} em ${when}` : `Removida em ${when}`;
    case "annuity_patch":
    case "installment_patch":
      return who ? `Valor ou vencimento alterado por ${who} em ${when}` : `Valor ou vencimento alterado em ${when}`;
    case "plan_change":
      return who ? `Plano alterado por ${who} em ${when}` : `Plano alterado em ${when}`;
    case "email_send":
      if (entry.source === "batch") return `E-mail de cobrança enviado em lote em ${when}`;
      return who ? `E-mail de cobrança enviado por ${who} em ${when}` : `E-mail de cobrança enviado em ${when}`;
    default:
      return who ? `Atualizado por ${who} em ${when}` : `Atualizado em ${when}`;
  }
}

// ── Normalização Dojô/CPF → view-model comum da linha ────────────────
export interface AnnuityRowVM {
  key: string;
  rowId: string | null;         // annuity_id — null quando no_charge (nenhuma ação de linha se aplica)
  name: string;
  code: string | null;          // fpkt_affiliation_id (dojô) ou karate_registration_number (praticante)
  whatsapp: string | null;
  email: string | null;
  plan: AnnuityPlan | null;
  status: string;                // computed_status do backend (paid/due/overdue/defaulting/no_charge)
  daysOverdue: number;
  amount: number;
  total: number;
  paidTotal: number;
  dueDate: string | null;
  installments: AnnuityInstallment[];
  referencePeriod: string;
  /** Ativo/inativo do DOJÔ titular (PR #413) — null pro segmento CPF. */
  isActive: boolean | null;
}

// computeDaysOverdue: deriva "dias em atraso" a partir das PRÓPRIAS parcelas
// (due_date x hoje), sem depender de um campo do backend.
function computeDaysOverdue(installments: AnnuityInstallment[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let max = 0;
  for (const inst of installments) {
    if (inst.status === "paid" || !inst.due_date) continue;
    const due = new Date(`${inst.due_date}T00:00:00`);
    const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
    if (days > max) max = days;
  }
  return max;
}

/** Converte um DojoAnnuity/CpfAnnuity (item cru da API) no view-model comum
 *  da linha. Fonte única usada por AnnuitiesTable (hub) e pela seção de
 *  Anuidades da página do dojô — as duas leem o MESMO shape de
 *  GET /financial/annuities/dojos (a última, com `dojo_id` filtrando um
 *  único dojô). */
export function toRowVM(seg: ReceivableSeg, item: DojoAnnuity | CpfAnnuity): AnnuityRowVM {
  if (seg === "dojo") {
    const d = item as DojoAnnuity;
    const rowId = d.annuity_history_id || d.annuity_id || null;
    return {
      key: d.dojo_id,
      rowId,
      name: d.dojo_name,
      code: d.fpkt_affiliation_id ?? null,
      whatsapp: d.whatsapp ?? null,
      email: d.email ?? null,
      plan: d.plan ?? null,
      status: d.status,
      daysOverdue: d.days_overdue ?? computeDaysOverdue(d.installments ?? []),
      amount: d.amount ?? 0,
      total: d.total ?? d.amount ?? 0,
      paidTotal: d.paid_total ?? (d.status === "paid" ? (d.amount ?? 0) : 0),
      dueDate: d.due_date ?? null,
      installments: d.installments ?? [],
      referencePeriod: d.reference_period,
      isActive: typeof d.is_active === "boolean" ? d.is_active : null,
    };
  }
  const p = item as CpfAnnuity;
  return {
    key: p.practitioner_id,
    rowId: p.annuity_id ?? null,
    name: p.full_name,
    code: p.karate_registration_number ?? null,
    whatsapp: p.whatsapp ?? null,
    email: p.email ?? null,
    plan: p.plan ?? null,
    status: p.status,
    daysOverdue: computeDaysOverdue(p.installments ?? []),
    amount: p.amount ?? 0,
    total: p.total ?? p.amount ?? 0,
    paidTotal: p.paid_total ?? (p.status === "paid" ? (p.amount ?? 0) : 0),
    dueDate: p.due_date ?? null,
    installments: p.installments ?? [],
    referencePeriod: p.reference_period,
    isActive: null,
  };
}

// ── Trilha de parcelas: classifica cada parcela em paga/parcial/vencida/a
//    vencer/futura (ver histórico completo da regra no AnnuitiesTable.tsx
//    original — reproduzido aqui sem alteração de comportamento).
export type InstState = "paga" | "parcial" | "vencida" | "a_vencer" | "futura";
export function classifyInstallments(installments: AnnuityInstallment[]): { inst: AnnuityInstallment; state: InstState; overdue: boolean }[] {
  const sorted = [...installments].sort((a, b) => a.seq - b.seq);
  const today = new Date().toISOString().slice(0, 10);
  let firstPendingSeen = false;
  return sorted.map((inst) => {
    const amount = Number(inst.amount) || 0;
    const amountPaid = Number(inst.amount_paid) || 0;
    const fullyPaid = inst.status === "paid" || (amount > 0 && amountPaid >= amount - 0.005);
    if (fullyPaid) return { inst, state: "paga" as InstState, overdue: false };

    const isFirstPending = !firstPendingSeen;
    firstPendingSeen = true;

    const overdue = !!inst.due_date && inst.due_date <= today;
    const isPartial = inst.status === "partial" || (amountPaid > 0.005 && amountPaid < amount - 0.005);
    if (isPartial) return { inst, state: "parcial" as InstState, overdue };
    if (overdue) return { inst, state: "vencida" as InstState, overdue: true };
    if (isFirstPending) return { inst, state: "a_vencer" as InstState, overdue: false };
    return { inst, state: "futura" as InstState, overdue: false };
  });
}

const INST_STATE_VIEW: Record<InstState, { label: string; color: string; bg: string; icon: string }> = {
  paga:      { label: "Paga",     color: P.ok,      bg: P.okWash,      icon: "checkmark-circle" },
  parcial:   { label: "Parcial",  color: P.warn,    bg: P.warnWash,    icon: "time" },
  vencida:   { label: "Vencida",  color: P.danger,  bg: P.dangerWash,  icon: "warning" },
  a_vencer:  { label: "A vencer", color: P.warn,    bg: P.warnWash,    icon: "time" },
  futura:    { label: "Futura",   color: P.neutral, bg: P.neutralWash, icon: "ellipse-outline" },
};

function InstallmentPill({ inst, state, overdue, active, onPress }: { inst: AnnuityInstallment; state: InstState; overdue: boolean; active: boolean; onPress: () => void }) {
  const v = INST_STATE_VIEW[state];
  const amount = Number(inst.amount) || 0;
  const amountPaid = Number(inst.amount_paid) || 0;
  const fillPct = state === "parcial" && amount > 0 ? Math.max(0, Math.min(1, amountPaid / amount)) : 0;
  const icon = state === "parcial" && overdue ? "warning" : v.icon;
  const label = state === "parcial"
    ? `Parcela ${inst.seq}, ${monthAbbrOf(inst.due_date)}, Parcial, ${fmtMoney(amountPaid)} de ${fmtMoney(amount)}${overdue ? ", vencida" : ""}`
    : `Parcela ${inst.seq}, ${monthAbbrOf(inst.due_date)}, ${v.label}`;
  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: v.bg, borderColor: active ? P.red : "transparent" }]}
      onPress={(e) => { e.stopPropagation?.(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {fillPct > 0 && (
        <View pointerEvents="none" style={[styles.pillFill, { width: `${fillPct * 100}%`, backgroundColor: v.color }]} />
      )}
      <Icon name={icon as any} size={10} color={v.color} />
      <Text style={[styles.pillText, { color: v.color }]}>{monthAbbrOf(inst.due_date)}</Text>
    </TouchableOpacity>
  );
}

export function shouldShowInstallmentTrail(seg: ReceivableSeg, trail: { inst: AnnuityInstallment; state: InstState; overdue: boolean }[]): boolean {
  return seg === "dojo" || trail.length > 1;
}

function InstallmentSummary({ vm, state, overdue }: { vm: AnnuityRowVM; state: InstState | null; overdue: boolean }) {
  const v = state ? INST_STATE_VIEW[state] : null;
  const inst = state === "parcial" ? vm.installments[0] : null;
  const icon = state === "parcial" && overdue ? "warning" : v?.icon;
  const label = inst
    ? `Parcial · ${fmtMoney(Number(inst.amount_paid) || 0)} de ${fmtMoney(Number(inst.amount) || 0)}${overdue ? " · vencida" : ""}`
    : v?.label ?? "";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {v && <Icon name={icon as any} size={12} color={v.color} />}
      <Body muted style={{ fontSize: 11.5 }}>
        {vm.dueDate ? `Vence ${formatIsoToBr(vm.dueDate)}` : "Sem vencimento"}
        {v ? ` · ${label}` : ""}
      </Body>
    </View>
  );
}

// ── Painel expandido: detalhe de cada parcela + ações (pagar/pix/editar) ─
function InstallmentDetailRow({
  inst, state, overdue, federationId, onPay, onPix, onEdit, onSendEmail, hasEmail,
}: {
  inst: AnnuityInstallment; state: InstState; overdue: boolean; federationId: string;
  onPay: (instId: string, method: AnnuityPaymentMethod) => Promise<void>;
  onPix: (instId: string, amount: number, label: string) => void;
  onEdit: (instId: string, body: { amount?: number; due_date?: string }) => Promise<void>;
  onSendEmail: (instId: string) => void;
  hasEmail: boolean;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [amountTxt, setAmountTxt] = useState(String(inst.amount).replace(".", ","));
  const [dueTxt, setDueTxt] = useState(formatIsoToBr(inst.due_date));

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<FinanceAuditEntry[] | null>(null);
  const [historyError, setHistoryError] = useState(false);

  const toggleHistory = async () => {
    setPayOpen(false);
    setEditOpen(false);
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (historyItems !== null || historyLoading) return;
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const res = await karateApi.getFinanceAudit(federationId, { targetId: inst.id, limit: 10 });
      setHistoryItems(res.items ?? []);
    } catch {
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  const v = INST_STATE_VIEW[state];
  const badgeIcon = state === "parcial" && overdue ? "warning" : v.icon;
  const amountPaid = Number(inst.amount_paid) || 0;
  const isPending = inst.status !== "paid";

  const submitPay = async (method: AnnuityPaymentMethod) => {
    setPaying(true);
    try {
      await onPay(inst.id, method);
      setPayOpen(false);
    } catch {
      // onPay já mostra o toast de erro — só evitamos unhandled rejection.
    } finally {
      setPaying(false);
    }
  };

  const submitEdit = async () => {
    const dueIso = dueTxt.length === 10 ? parseBrDate(dueTxt) : undefined;
    if (dueTxt.length === 10 && !dueIso) {
      toast.error("Vencimento inválido.");
      return;
    }
    const amt = parseFloat(amountTxt.replace(",", "."));
    if (isNaN(amt) || amt <= 0) {
      toast.error("Valor deve ser maior que zero.");
      return;
    }
    setSavingEdit(true);
    try {
      await onEdit(inst.id, { amount: amt, due_date: dueIso || undefined });
      setEditOpen(false);
    } catch {
      // onEdit já mostra o toast de erro — só evita unhandled rejection.
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <View style={styles.instRow}>
      <View style={styles.instRowMain}>
        <View style={[styles.instBadge, { backgroundColor: v.bg }]}>
          <Icon name={badgeIcon as any} size={11} color={v.color} />
          <Text style={[styles.instBadgeText, { color: v.color }]}>{v.label}</Text>
        </View>
        <Body muted style={{ fontSize: 11.5, width: 78 }}>Parcela {inst.seq}</Body>
        <Body muted style={{ fontSize: 11.5, width: 96 }}>{inst.due_date ? formatIsoToBr(inst.due_date) : "Sem data"}</Body>
        <View style={{ width: 88 }}>
          <Mono style={{ fontSize: 12.5 }}>{fmtMoney(inst.amount)}</Mono>
          {state === "parcial" && (
            <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: v.color, marginTop: 1 }}>
              {fmtMoney(amountPaid)} pago
            </Text>
          )}
        </View>
        {inst.status === "paid" ? (
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <Body muted style={{ fontSize: 11 }}>
              Pago em {inst.paid_at ? formatIsoToBr(inst.paid_at.slice(0, 10)) : "—"}
            </Body>
            <TouchableOpacity
              style={styles.instActionBtn}
              onPress={toggleHistory}
              accessibilityRole="button"
              accessibilityLabel={`Ver histórico da parcela ${inst.seq}`}
            >
              <Icon name="clock" size={12} color={C.ink} />
              <Text style={styles.instActionLabel}>Histórico</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 6, flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <TouchableOpacity
              style={styles.instActionBtn}
              onPress={() => { setPayOpen((v2) => !v2); setEditOpen(false); }}
              accessibilityRole="button"
              accessibilityLabel={`Registrar pagamento da parcela ${inst.seq}`}
            >
              <Icon name="checkmark" size={12} color={C.ink} />
              <Text style={styles.instActionLabel}>Pagar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.instActionBtn}
              onPress={() => onPix(inst.id, inst.amount, `parcela ${inst.seq}`)}
              accessibilityRole="button"
              accessibilityLabel={`PIX da parcela ${inst.seq}`}
            >
              <Icon name="qr-code" size={12} color={C.ink} />
              <Text style={styles.instActionLabel}>PIX</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.instActionBtn}
              onPress={() => { setEditOpen((v2) => !v2); setPayOpen(false); }}
              accessibilityRole="button"
              accessibilityLabel={`Editar parcela ${inst.seq}`}
            >
              <Icon name="edit" size={12} color={C.ink} />
              <Text style={styles.instActionLabel}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.instActionBtn, !hasEmail && styles.instActionBtnDisabled]}
              onPress={() => { if (hasEmail) onSendEmail(inst.id); }}
              disabled={!hasEmail}
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasEmail }}
              accessibilityLabel={
                hasEmail
                  ? `Enviar e-mail de cobrança da parcela ${inst.seq}`
                  : "Sem e-mail cadastrado — use o WhatsApp ou peça a atualização cadastral"
              }
            >
              <Icon name="mail" size={12} color={hasEmail ? C.ink : P.ink4} />
              <Text style={[styles.instActionLabel, !hasEmail && styles.instActionLabelDisabled]}>E-mail</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.instActionBtn}
              onPress={toggleHistory}
              accessibilityRole="button"
              accessibilityLabel={`Ver histórico da parcela ${inst.seq}`}
            >
              <Icon name="clock" size={12} color={C.ink} />
              <Text style={styles.instActionLabel}>Histórico</Text>
            </TouchableOpacity>
          </View>
        )}
        {!hasEmail && isPending && (
          <Text style={styles.emailHint}>
            Sem e-mail cadastrado — use o WhatsApp ou peça a atualização cadastral.
          </Text>
        )}
      </View>

      {isPending && payOpen && (
        <View style={styles.instSubPanel}>
          <Body muted style={{ fontSize: 11 }}>Forma de recebimento:</Body>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {(["pix", "transferencia", "dinheiro", "credito_cbkt", "credito_exame", "boleto", "outro"] as const).map((m) => (
              <TouchableOpacity key={m} disabled={paying} style={styles.methodChip} onPress={() => submitPay(m)} accessibilityRole="button" accessibilityLabel={`Confirmar pagamento via ${m}`}>
                <Text style={styles.methodChipLabel}>{m === "pix" ? "PIX" : m === "dinheiro" ? "Dinheiro" : m === "transferencia" ? "Transferência" : m === "credito_cbkt" ? "Crédito CBKT" : m === "credito_exame" ? "Crédito exame/curso" : m === "boleto" ? "Boleto" : "Outro"}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {paying && <ActivityIndicator size="small" color={P.red} />}
        </View>
      )}

      {isPending && editOpen && (
        <View style={styles.instSubPanel}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <View>
              <Body muted style={{ fontSize: 10.5 }}>Valor</Body>
              <TextInput
                value={amountTxt}
                onChangeText={setAmountTxt}
                keyboardType="decimal-pad"
                style={styles.instInput}
                accessibilityLabel="Novo valor da parcela"
              />
            </View>
            <View>
              <Body muted style={{ fontSize: 10.5 }}>Vencimento</Body>
              <TextInput
                value={dueTxt}
                onChangeText={(t) => setDueTxt(maskBrDate(t))}
                placeholder="dd/mm/aaaa"
                keyboardType="number-pad"
                style={styles.instInput}
                accessibilityLabel="Novo vencimento da parcela"
              />
            </View>
            <TouchableOpacity disabled={savingEdit} style={styles.instSaveBtn} onPress={submitEdit} accessibilityRole="button" accessibilityLabel="Salvar parcela">
              {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.instSaveLabel}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {historyOpen && (
        <View style={styles.instSubPanel}>
          {historyLoading ? (
            <ActivityIndicator size="small" color={P.red} />
          ) : historyError ? (
            <Body muted style={{ fontSize: 11 }}>Não foi possível carregar o histórico agora.</Body>
          ) : !historyItems || historyItems.length === 0 ? (
            <Body muted style={{ fontSize: 11 }}>Sem histórico registrado para esta parcela ainda.</Body>
          ) : (
            <View style={{ gap: 6 }}>
              {historyItems.map((entry) => (
                <View key={entry.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name="clock" size={11} color={C.ink4} />
                  <Body muted style={{ fontSize: 11 }}>{describeFinanceAuditEntry(entry)}</Body>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Linha da tabela (dojô ou praticante) ─────────────────────────────
function AnnuityReceivableRowItem({
  vm, seg, wide, selected, selectable, expanded, federationId, onToggleSelect, onToggleExpand,
  onPay, onPix, onEdit, onSendEmail, onVoid, onLaunch, voidConfirming, onVoidConfirm, onVoidCancel, voiding,
  onReceive, onStatement, onEditAnnuity,
}: {
  vm: AnnuityRowVM; seg: ReceivableSeg; wide: boolean; selected: boolean; selectable: boolean; expanded: boolean; federationId: string;
  onToggleSelect: () => void; onToggleExpand: () => void;
  onPay: (instId: string, method: AnnuityPaymentMethod) => Promise<void>;
  onPix: (instId: string, amount: number, label: string) => void;
  onEdit: (instId: string, body: { amount?: number; due_date?: string }) => Promise<void>;
  onSendEmail: (instId: string) => void;
  onVoid: () => void; onLaunch: () => void;
  voidConfirming: boolean; onVoidConfirm: () => void; onVoidCancel: () => void; voiding: boolean;
  onReceive: () => void; onStatement: () => void;
  /** Só faz sentido pra seg="dojo" (a rota PATCH de header só existe pra
   *  dojô — ver AnnuityUpdateInput em karateApi.ts). */
  onEditAnnuity: () => void;
}) {
  const isNoCharge = vm.status === "no_charge";
  const sv = isNoCharge ? annuityStatusView(vm.status) : annuityReceivableStatusView(vm.status, vm.paidTotal, vm.total);
  const saldo = Math.max(0, Math.round((vm.total - vm.paidTotal) * 100) / 100);
  const trail = classifyInstallments(vm.installments);
  const showTrail = shouldShowInstallmentTrail(seg, trail);

  return (
    <View style={styles.rowCard}>
      <RowPressable style={styles.rowMain} onPress={vm.installments.length > 0 ? onToggleExpand : undefined} accessibilityLabel={`Detalhe de ${vm.name}`}>
        {selectable ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onToggleSelect(); }}
            style={[styles.checkbox, selected && styles.checkboxOn]}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`Selecionar ${vm.name}`}
          >
            {selected ? <Icon name="checkmark" size={12} color="#fff" /> : null}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}

        <View style={{ flex: wide ? 2 : undefined, minWidth: wide ? undefined : 140, gap: 3 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{vm.name}</Text>
            {vm.plan && <Text style={styles.planPill}>{PLAN_LABEL[vm.plan]}</Text>}
            {seg === "dojo" && vm.isActive === false && <ShojiBadge dojoStatus="inactive" />}
          </View>
          <Mono style={{ fontSize: 10, color: P.red }}>{vm.code || "—"}</Mono>
          {!isNoCharge && vm.total > 0 && (
            <>
              <View style={styles.progBarTrack} accessibilityLabel={`${fmtMoney(vm.paidTotal)} recebido de ${fmtMoney(vm.total)}`}>
                <View style={[styles.progBarFill, { width: `${Math.max(0, Math.min(100, Math.round((vm.paidTotal / vm.total) * 100)))}%` }]} />
              </View>
              <View style={styles.progCaptions}>
                <Mono style={styles.progCaptionRecv}>{fmtMoney(vm.paidTotal)} recebido</Mono>
                <Mono style={styles.progCaptionDue}>de {fmtMoney(vm.total)}</Mono>
              </View>
            </>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
            {trail.length === 0 ? (
              <Body muted style={{ fontSize: 11 }}>Sem parcelas lançadas</Body>
            ) : showTrail ? (
              trail.map(({ inst, state, overdue }) => (
                <InstallmentPill key={inst.id} inst={inst} state={state} overdue={overdue} active={expanded} onPress={onToggleExpand} />
              ))
            ) : (
              <InstallmentSummary vm={vm} state={trail[0]?.state ?? null} overdue={trail[0]?.overdue ?? false} />
            )}
          </View>
        </View>

        <View style={{ width: wide ? 150 : undefined, alignItems: "flex-end", gap: 4 }}>
          <View style={[styles.badge, { backgroundColor: sv.bg }]} accessibilityLabel={sv.label}>
            <Icon name={sv.icon as any} size={11} color={sv.color} />
            <Text style={[styles.badgeText, { color: sv.color }]}>{sv.label}</Text>
          </View>
          {!isNoCharge && (
            saldo <= 0.005 ? (
              <Body muted style={{ fontSize: 11, color: P.ok }}>saldo quitado</Body>
            ) : (
              <>
                <Mono style={[styles.balanceNum, { color: sv.key === "atrasado" ? P.danger : C.ink }]}>
                  {fmtMoney(saldo)}
                </Mono>
                <Text style={styles.balanceCap}>saldo</Text>
              </>
            )
          )}
          {vm.daysOverdue > 0 && <Body muted style={{ fontSize: 10, color: P.danger }}>{vm.daysOverdue}d em atraso</Body>}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isNoCharge ? (
            <TouchableOpacity style={styles.launchBtn} onPress={(e) => { e.stopPropagation?.(); onLaunch(); }} accessibilityRole="button" accessibilityLabel={`Lançar anuidade de ${vm.name}`}>
              <Icon name="add" size={13} color="#fff" />
              <Text style={styles.launchBtnLabel}>Lançar</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.secondaryActions}>
                {seg === "dojo" && vm.rowId && (
                  <TouchableOpacity
                    style={styles.statementBtn}
                    onPress={(e) => { e.stopPropagation?.(); onEditAnnuity(); }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar anuidade de ${vm.name}`}
                  >
                    <Icon name="edit" size={14} color={C.ink3} />
                  </TouchableOpacity>
                )}
                {vm.rowId && (
                  <TouchableOpacity
                    style={styles.statementBtn}
                    onPress={(e) => { e.stopPropagation?.(); onStatement(); }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Extrato de ${vm.name}`}
                  >
                    <Icon name="receipt" size={14} color={C.ink3} />
                  </TouchableOpacity>
                )}
                {vm.rowId && (
                  <TouchableOpacity style={styles.iconBtnDanger} onPress={(e) => { e.stopPropagation?.(); onVoid(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover cobrança de ${vm.name}`}>
                    <Icon name="trash-outline" size={14} color={P.red} />
                  </TouchableOpacity>
                )}
              </View>
              {vm.rowId && saldo > 0.005 && (
                <TouchableOpacity
                  style={styles.receiveBtn}
                  onPress={(e) => { e.stopPropagation?.(); onReceive(); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Receber pagamento de ${vm.name}`}
                >
                  <Text style={styles.receiveBtnLabel}>Receber</Text>
                </TouchableOpacity>
              )}
              {vm.installments.length > 0 && (
                <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={C.ink4} />
              )}
            </>
          )}
        </View>
      </RowPressable>

      {voidConfirming && (
        <View style={styles.confirmVoidBox}>
          <Text style={styles.confirmVoidText}>
            Remover a cobrança de {vm.name} — competência {vm.referencePeriod}? Isso apaga o lançamento e cancela a transação conciliada. Esta ação não pode ser desfeita.
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <TouchableOpacity style={styles.confirmCancelBtn} onPress={onVoidCancel} disabled={voiding} accessibilityRole="button" accessibilityLabel="Cancelar remoção">
              <Text style={styles.confirmCancelLabel}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmDangerBtn, voiding && { opacity: 0.6 }]} onPress={onVoidConfirm} disabled={voiding} accessibilityRole="button" accessibilityLabel="Confirmar remoção">
              <Text style={styles.confirmDangerLabel}>{voiding ? "Removendo…" : "Remover"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {expanded && vm.installments.length > 0 && (
        <View style={styles.instPanel}>
          <ContactChannelsRow whatsapp={vm.whatsapp} email={vm.email} />
          {trail.map(({ inst, state, overdue }) => (
            <InstallmentDetailRow
              key={inst.id}
              inst={inst}
              state={state}
              overdue={overdue}
              federationId={federationId}
              onPay={onPay}
              onPix={onPix}
              onEdit={onEdit}
              onSendEmail={onSendEmail}
              hasEmail={!!vm.email}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Canais de contato (Fase F4/PIX) ──────────────────────────────────
function ContactChannelsRow({ whatsapp, email }: { whatsapp: string | null; email: string | null }) {
  return (
    <View style={styles.channelsRow}>
      <View style={[styles.channelPill, whatsapp ? styles.channelPillOn : styles.channelPillOff]}>
        <Icon name="call-outline" size={11} color={whatsapp ? P.ok : C.ink3} />
        <Text style={[styles.channelPillText, whatsapp ? styles.channelPillTextOn : styles.channelPillTextOff]}>
          {whatsapp ? "WhatsApp cadastrado" : "Sem WhatsApp cadastrado"}
        </Text>
      </View>
      <View style={[styles.channelPill, email ? styles.channelPillOn : styles.channelPillOff]}>
        <Icon name="mail-outline" size={11} color={email ? P.ok : C.ink3} />
        <Text style={[styles.channelPillText, email ? styles.channelPillTextOn : styles.channelPillTextOff]}>
          {email ? "E-mail cadastrado" : "Sem e-mail cadastrado"}
        </Text>
      </View>
    </View>
  );
}

/** Componente público — memoizado (mesma linha, mesmas props, mesmo render). */
export const AnnuityReceivableRow = React.memo(AnnuityReceivableRowItem);

const styles = StyleSheet.create({
  rowCard: { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 14 } as ViewStyle,
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 } as ViewStyle,

  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.line2, alignItems: "center", justifyContent: "center", backgroundColor: P.glass2 } as ViewStyle,
  checkboxOn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,

  name: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" } as ViewStyle,
  planPill: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: C.ink2, borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, paddingHorizontal: 6, paddingVertical: 1 } as TextStyle,

  pill: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: R.pill, borderWidth: 1.5, overflow: "hidden", position: "relative" } as ViewStyle,
  pillText: { fontFamily: F.mono, fontSize: 10, fontWeight: "700" } as TextStyle,
  pillFill: { position: "absolute", left: 0, bottom: 0, height: 2.5, opacity: 0.55 } as ViewStyle,

  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: R.pill } as ViewStyle,
  badgeText: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,

  launchBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: P.ink, borderRadius: R.sm, paddingVertical: 6, paddingHorizontal: 10 } as ViewStyle,
  launchBtnLabel: { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,

  progBarTrack: { height: 4, borderRadius: 3, backgroundColor: P.paper3, overflow: "hidden", marginTop: 5, width: "100%", maxWidth: 260 } as ViewStyle,
  progBarFill: { height: "100%", borderRadius: 3, backgroundColor: P.ok } as ViewStyle,
  progCaptions: { flexDirection: "row", justifyContent: "space-between", marginTop: 5, maxWidth: 260 } as ViewStyle,
  progCaptionRecv: { fontSize: 10.5, color: P.ok, fontWeight: "500" } as TextStyle,
  progCaptionDue: { fontSize: 10.5, color: C.ink3 } as TextStyle,

  receiveBtn: { backgroundColor: P.red, borderRadius: R.sm, paddingVertical: 9, paddingHorizontal: 15 } as ViewStyle,
  receiveBtnLabel: { fontSize: 12.5, fontWeight: "700", color: "#fdf8f2" } as TextStyle,
  statementBtn: { alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass } as ViewStyle,

  iconBtnDanger: { alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, borderWidth: 1, borderColor: P.dangerWash, backgroundColor: P.dangerWash } as ViewStyle,
  secondaryActions: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,

  balanceNum: { fontFamily: F.mono, fontSize: 17, fontWeight: "700", letterSpacing: 0.2 } as TextStyle,
  balanceCap: { fontFamily: F.mono, fontSize: 9.5, color: C.ink3, letterSpacing: 0.3 } as TextStyle,

  confirmVoidBox: { marginTop: 10, gap: 8, backgroundColor: P.dangerWash, borderWidth: 1, borderColor: P.danger, borderRadius: R.md, padding: 12 } as ViewStyle,
  confirmVoidText: { fontSize: 11.5, lineHeight: 16, color: C.ink2 } as TextStyle,
  confirmCancelBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.sm, borderWidth: 1, borderColor: C.line } as ViewStyle,
  confirmCancelLabel: { fontSize: 11.5, fontWeight: "700", color: C.ink2 } as TextStyle,
  confirmDangerBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.sm, backgroundColor: P.red } as ViewStyle,
  confirmDangerLabel: { fontSize: 11.5, fontWeight: "700", color: "#fff" } as TextStyle,

  instPanel: { marginTop: 10, gap: 8, backgroundColor: P.glass2, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 10 } as ViewStyle,
  instRow: { gap: 6 } as ViewStyle,
  instRowMain: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" } as ViewStyle,
  instBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 2, paddingHorizontal: 7, borderRadius: R.pill, width: 84 } as ViewStyle,
  instBadgeText: { fontSize: 10, fontWeight: "700" } as TextStyle,
  instActionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: R.sm, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass } as ViewStyle,
  instActionLabel: { fontSize: 11, fontWeight: "600", color: C.ink } as TextStyle,
  instActionBtnDisabled: { opacity: 0.5 } as ViewStyle,
  instActionLabelDisabled: { color: P.ink4 } as TextStyle,
  emailHint: { fontSize: 10.5, color: C.ink3, marginTop: 2, textAlign: "right" } as TextStyle,
  channelsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 2 } as ViewStyle,
  channelPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: R.pill, borderWidth: 1 } as ViewStyle,
  channelPillOn: { backgroundColor: P.okWash, borderColor: P.okLine } as ViewStyle,
  channelPillOff: { backgroundColor: P.glass, borderColor: C.line2 } as ViewStyle,
  channelPillText: { fontSize: 10.5, fontWeight: "700" } as TextStyle,
  channelPillTextOn: { color: P.ok } as TextStyle,
  channelPillTextOff: { color: C.ink3 } as TextStyle,
  instSubPanel: { marginLeft: 92, gap: 8, backgroundColor: P.paperWarm, borderRadius: R.sm, padding: 8, borderWidth: 1, borderColor: C.line } as ViewStyle,
  instInput: { borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12.5, color: C.ink, minWidth: 90 } as TextStyle,
  instSaveBtn: { backgroundColor: P.ink, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 14, alignSelf: "flex-end" } as ViewStyle,
  instSaveLabel: { fontSize: 12, fontWeight: "700", color: "#fff" } as TextStyle,
  methodChip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: R.pill, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass } as ViewStyle,
  methodChipLabel: { fontSize: 11, fontWeight: "600", color: C.ink } as TextStyle,
});
