// ============================================================
// AnnuitiesTable — Fase F2 · Shoji
//
// Tabela de cobranças (Dojôs | Praticantes) do hub de Anuidades.
// FlatList VIRTUALIZADA (troca o antigo `.map()` num ScrollView das
// DojoAnnuitiesTab/CpfAnnuitiesTab) — a FlatList é o ÚNICO scroller da
// página: o header (season/KPIs/chips, vindo do hub) + busca + chips de
// status + thead rolam junto com as linhas, mesmo padrão de
// Praticantes/Dojôs (fix de scroll de página inteira, 11/07/2026).
//
// Paginação REAL (page/pageSize/total do backend — GET /financial/
// annuities/dojos|cpf, Fase F2), nunca fatiada em memória.
//
// Regras de produto respeitadas:
//   - Ausência de cobrança (no_charge) É NEUTRA — nunca vermelha/alerta.
//   - em_dia = nenhuma parcela VENCIDA em aberto (parcela futura não conta).
//   - Nada aqui inativa por falta de pagamento — só "Remover cobrança"
//     (retirada do lançamento, NÃO estorno financeiro — a transaction
//     cancelada preserva a trilha), que é uma correção de lançamento, não
//     uma penalidade. Fase F4 estende essa mesma ação pro lote (barra de
//     seleção → VoidBatchModal, POST .../void-batch).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl, useWindowDimensions, ViewStyle, TextStyle, Platform, Clipboard,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP, KarateShadows as SH,
  annuityStatusView, annuityReceivableStatusView,
} from "@/constants/karateTheme";
import { SearchField, Chip, Mono, Body, RowPressable, ShojiBadge } from "@/components/karate/shoji";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { toast } from "@/components/Toast";
import { PixPaymentModal } from "@/components/karate/PixPaymentModal";
import { LancarAnuidadeDojoModal } from "@/components/karate/LancarAnuidadeDojoModal";
import { LancarAnuidadeModal } from "@/components/karate/praticante-detalhe/LancarAnuidadeModal";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import {
  karateApi, DojoAnnuity, CpfAnnuity, AnnuityInstallment, AnnuityStatusFilter, AnnuityPlan, AnnuityStatus,
  FinanceAuditEntry, AnnuityPaymentMethod, AnnuityReceiveResult, AnnuityDojoStatusFilter,
} from "@/services/karateApi";
import { BatchLaunchModal } from "@/components/karate/BatchLaunchModal";
import { SendEmailBatchModal, EmailBatchTarget } from "@/components/karate/SendEmailBatchModal";
import { VoidBatchModal, VoidBatchTarget } from "@/components/karate/VoidBatchModal";
import { WhatsAppChargeModal, WhatsAppChargeTarget } from "@/components/karate/WhatsAppChargeModal";
import { BulkPayConfirmModal, BulkPayTarget } from "@/components/karate/BulkPayConfirmModal";
// Fase F4 — anuidade como recebível: folha de baixa livre (prévia FIFO ao
// vivo, contra o backend) e extrato do ledger de uma anuidade.
import { AnnuityReceiveModal } from "@/components/karate/AnnuityReceiveModal";
import { AnnuityStatementModal } from "@/components/karate/AnnuityStatementModal";
import type { SegKey } from "./AnnuitiesHub";

const PAGE_SIZE = 50;
const DEBOUNCE_MS = 350;
const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthAbbrOf(dueDate: string | null): string {
  if (!dueDate) return "—";
  const m = /^\d{4}-(\d{2})-\d{2}/.exec(dueDate);
  if (!m) return "—";
  const idx = parseInt(m[1], 10) - 1;
  return MONTH_ABBR[idx] ?? "—";
}

const PLAN_LABEL: Record<AnnuityPlan, string> = { anual: "Anual", semestral: "Semestral", trimestral: "Trimestral" };

// ── Fase G3: histórico curto e legível (linguagem de gestor, não de log
// de sistema) — traduz cada linha de karate_finance_audit_log pra uma
// frase que a UI mostra ao expandir a parcela. `created_at` é
// TIMESTAMPTZ (com offset) — new Date(iso) é seguro aqui, mesmo padrão
// já usado em fmtExpiry (inscricao/[eventId].tsx).
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

// ── Normalização Dojô/CPF → view-model comum da tabela ──────────────
export interface AnnuityRowVM {
  key: string;
  rowId: string | null;         // annuity_id — null quando no_charge (nenhuma ação de linha se aplica)
  name: string;
  code: string | null;          // fpkt_affiliation_id (dojô) ou karate_registration_number (praticante)
  whatsapp: string | null;
  /** Aditivo (Fase F4/PIX) — indicador de canal de contato na cobrança. */
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
  /** Ativo/inativo do DOJÔ titular (PR #413) — null pro segmento CPF
   *  (praticante não tem esse conceito aqui; o backend já filtra
   *  praticante inativo por padrão, sem parametrização). */
  isActive: boolean | null;
}

// computeDaysOverdue: deriva "dias em atraso" a partir das PRÓPRIAS parcelas
// (due_date x hoje), sem depender de um campo do backend. Corrige um buraco
// real: CpfAnnuity nunca trouxe `days_overdue` (só DojoAnnuity tem esse campo
// na API), então a linha de "Xd em atraso" nunca aparecia pra praticantes —
// o segmento inteiro perdia essa informação, mesmo sendo a pergunta nº1 de
// quem abre a tela ("quem está atrasado"). Mantém o campo do backend como
// fonte preferencial pra dojô (autoridade do servidor), com fallback pro
// cálculo local; pra CPF (que nunca teve o campo) usa sempre o cálculo local.
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

function toRowVM(seg: SegKey, item: DojoAnnuity | CpfAnnuity): AnnuityRowVM {
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
    // CPF não tem conceito de dojo_status na API (ver AnnuityDojoStatusFilter
    // em services/karateApi.ts) — sempre null aqui.
    isActive: null,
  };
}

// ── Trilha de parcelas: classifica cada parcela em paga/parcial/vencida/a
//    vencer/futura. SÓ a PRIMEIRA parcela NÃO paga (por seq, parcial
//    inclusive) consome a posição de "próxima pendente" — as seguintes só
//    viram "a vencer" se essa primeira já não tiver ficado com outro rótulo
//    (parcela futura nunca deixa ninguém atrasado — CLAUDE.md).
//
// Precedência (paga > parcial > vencida > a_vencer > futura), aditiva à
// F1 da reforma da anuidade (migration 247 — amount_paid + status='partial'
// no backend, ver services/karateApi.ts): uma parcela com baixa parcial
// SEMPRE cai em "parcial", mesmo se já venceu — o estado "parcial" tem
// prioridade visual (mesma âmbar do badge "Parcial" da linha,
// annuityReceivableStatusView) sobre "vencida", mas carrega consigo a
// flag `overdue` pra a pill/badge ainda sinalizarem o atraso (ícone
// "warning" em vez de "time") em vez de escondê-lo. Decisão: uma parcela
// parcial-e-vencida NÃO deve ficar visualmente idêntica a uma vencida sem
// nenhum pagamento (perderia a informação valiosa de que já entrou
// dinheiro), nem idêntica a uma parcial em dia (perderia o alerta de
// atraso) — por isso os dois sinais coexistem na mesma pill em vez de a
// gente escolher só um.
//
// `status` do backend é a fonte de verdade pra "é parcial?" (persistido,
// migration 247); o fallback por amount_paid/amount cobre ambiente com
// backend desatualizado (migration 247 não aplicada — status nunca vem
// 'partial', mas amount_paid pode ter sido setado por um caminho antigo)
// ou item sem `status` normalizado. "Paga" idem: status==='paid' OU
// amount_paid >= amount (arredondamento de centavo — 0.005).
type InstState = "paga" | "parcial" | "vencida" | "a_vencer" | "futura";
function classifyInstallments(installments: AnnuityInstallment[]): { inst: AnnuityInstallment; state: InstState; overdue: boolean }[] {
  const sorted = [...installments].sort((a, b) => a.seq - b.seq);
  const today = new Date().toISOString().slice(0, 10);
  let firstPendingSeen = false;
  return sorted.map((inst) => {
    const amount = Number(inst.amount) || 0;
    const amountPaid = Number(inst.amount_paid) || 0;
    const fullyPaid = inst.status === "paid" || (amount > 0 && amountPaid >= amount - 0.005);
    if (fullyPaid) return { inst, state: "paga" as InstState, overdue: false };

    // Não paga (nem em parte, nem no total) — consome a posição de
    // "próxima pendente" ANTES de decidir o rótulo final, pra manter a
    // regra "só a primeira parcela não-paga vira a_vencer" mesmo quando
    // essa primeira acaba rotulada "parcial" ou "vencida".
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

// Mesma âmbar do badge "Parcial" da linha (annuityReceivableStatusView,
// P.warn/P.warnWash) — "parcial" fala a mesma língua de cor em toda a
// tela, do badge da linha à pill da trilha. Ícone difere de "a_vencer"
// (que também usa essa âmbar) só na variante parcial+vencida (abaixo, em
// InstallmentPill) — a cor sozinha nunca é o único sinal (WCAG 1.4.1,
// CLAUDE.md do design system).
const INST_STATE_VIEW: Record<InstState, { label: string; color: string; bg: string; icon: string }> = {
  paga:      { label: "Paga",     color: P.ok,      bg: P.okWash,      icon: "checkmark-circle" },
  parcial:   { label: "Parcial",  color: P.warn,    bg: P.warnWash,    icon: "time" },
  vencida:   { label: "Vencida",  color: P.danger,  bg: P.dangerWash,  icon: "warning" },
  a_vencer:  { label: "A vencer", color: P.warn,    bg: P.warnWash,    icon: "time" },
  futura:    { label: "Futura",   color: P.neutral, bg: P.neutralWash, icon: "ellipse-outline" },
};

// InstallmentPill — trilha adaptada a split payments (se houver, ver
// classifyInstallments acima). Duas pistas visuais pra "parcial", nenhuma
// delas exige inventar cor nova:
//   1) preenchimento proporcional (mini barra no rodapé da pill,
//      amount_paid/amount, vindo PRONTO do backend — nunca recalculado
//      aqui) — é o que diferencia uma pill "parcial" (âmbar + barrinha) de
//      uma "a_vencer" (mesma âmbar, sem barra, porque amount_paid é 0).
//   2) ícone "warning" (em vez de "time") quando a parcial também já
//      venceu — mesmo ícone que "vencida" usa, na cor âmbar de "parcial"
//      (não vira vermelho: parcial tem prioridade visual sobre vencida,
//      ver comentário de classifyInstallments).
// accessibilityLabel carrega o valor por extenso (R$X de R$Y) pra quem usa
// leitor de tela, já que a barra visual é decorativa/redundante pra esse
// público.
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

// ── Trilha de parcelas x resumo — quando ela vale a pena mostrar ────
// A trilha de pills existe pra revelar uma PROGRESSÃO (semestral/trimestral
// de Dojô: 2/4 parcelas). Praticante paga sempre parcela única (regra de
// negócio fixa — R$60, vencimento maio), então uma trilha de 1 pill só não
// informa nada, só ocupa espaço e finge complexidade que não existe.
//
// A condição abaixo é sobre o DADO (installments.length > 1), não sobre o
// segmento: se algum praticante tiver mais de uma parcela (dado legado,
// correção manual), a trilha real volta a aparecer — a UI nunca esconde
// informação por causa do segmento em que está.
function shouldShowInstallmentTrail(seg: SegKey, trail: { inst: AnnuityInstallment; state: InstState; overdue: boolean }[]): boolean {
  return seg === "dojo" || trail.length > 1;
}

// Substituto da trilha quando ela é ocultada (Praticantes, parcela única):
// mostra a informação que de fato importa na linha — vencimento + situação
// da parcela — em vez de uma pill que só repete o mês por extenso. Mesma
// adaptação a split payments da pill: parcial mostra o valor recebido, e
// parcial+vencida troca o ícone pra "warning" (mesma regra de
// InstallmentPill — cor âmbar de "parcial" tem prioridade, o ícone é quem
// avisa o atraso).
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
// Adaptado a split payments: badge usa INST_STATE_VIEW (já cobre "Parcial"
// com a mesma âmbar da pill/badge da linha) + ícone "warning" quando
// parcial-e-vencida (mesma regra de InstallmentPill); o valor devido ganha
// uma legenda "R$X pago" abaixo quando há baixa parcial — sempre o
// amount_paid que já vem do backend, nunca recalculado aqui.
function InstallmentDetailRow({
  inst, state, overdue, federationId, onPay, onPix, onEdit, onSendEmail, hasEmail,
}: {
  inst: AnnuityInstallment; state: InstState; overdue: boolean; federationId: string;
  onPay: (instId: string, method: AnnuityPaymentMethod) => Promise<void>;
  onPix: (instId: string, amount: number, label: string) => void;
  onEdit: (instId: string, body: { amount?: number; due_date?: string }) => Promise<void>;
  onSendEmail: (instId: string) => void;
  /** Aditivo (Fase F4/PIX) — sem e-mail cadastrado, o botão "E-mail" some
   *  desabilitado com o motivo em texto, nunca um erro depois do clique. */
  hasEmail: boolean;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [amountTxt, setAmountTxt] = useState(String(inst.amount).replace(".", ","));
  const [dueTxt, setDueTxt] = useState(formatIsoToBr(inst.due_date));

  // Fase G3: histórico curto e legível — carrega só quando o operador pede
  // (não em toda expansão de parcela, pra não disparar N requests por
  // linha visível). Cache simples em estado local (fecha/reabre relança).
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
      // onPay já mostra o toast de erro (karateApi.payInstallment) — aqui só
      // evitamos unhandled rejection; o painel fica aberto pra permitir retry.
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
      // onEdit já mostra o toast de erro (karateApi.updateInstallment) — só
      // evita unhandled rejection; formulário fica aberto pra permitir retry.
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
            {(["pix", "transferencia", "dinheiro", "credito_cbkt", "outro"] as const).map((m) => (
              <TouchableOpacity key={m} disabled={paying} style={styles.methodChip} onPress={() => submitPay(m)} accessibilityRole="button" accessibilityLabel={`Confirmar pagamento via ${m}`}>
                <Text style={styles.methodChipLabel}>{m === "pix" ? "PIX" : m === "dinheiro" ? "Dinheiro" : m === "transferencia" ? "Transferência" : m === "credito_cbkt" ? "Crédito CBKT" : "Outro"}</Text>
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

      {/* Fase G3: histórico curto e legível — "Pago por Fulano em dd/mm às
          hh:mm", "Cobrança criada pela campanha em dd/mm", "Removida por
          Fulano". Linguagem de gestor, não de log de sistema. */}
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
function AnnuityRowItem({
  vm, seg, wide, selected, selectable, expanded, federationId, onToggleSelect, onToggleExpand,
  onPay, onPix, onEdit, onSendEmail, onVoid, onLaunch, voidConfirming, onVoidConfirm, onVoidCancel, voiding,
  onReceive, onStatement,
}: {
  vm: AnnuityRowVM; seg: SegKey; wide: boolean; selected: boolean; selectable: boolean; expanded: boolean; federationId: string;
  onToggleSelect: () => void; onToggleExpand: () => void;
  onPay: (instId: string, method: AnnuityPaymentMethod) => Promise<void>;
  onPix: (instId: string, amount: number, label: string) => void;
  onEdit: (instId: string, body: { amount?: number; due_date?: string }) => Promise<void>;
  onSendEmail: (instId: string) => void;
  onVoid: () => void; onLaunch: () => void;
  voidConfirming: boolean; onVoidConfirm: () => void; onVoidCancel: () => void; voiding: boolean;
  /** Fase F4 — abre a folha de baixa livre / o extrato deste recebível. */
  onReceive: () => void; onStatement: () => void;
}) {
  const isNoCharge = vm.status === "no_charge";
  // Fase F4: badge do recebível (Quitado/Parcial/Em aberto/Atrasado) usa
  // paid_total/total (F3, agregados do backend) além do computed_status —
  // é rótulo visual, não a distribuição FIFO (ver AnnuityReceiveModal). O
  // estado "Sem cobrança" continua no vocabulário antigo (annuityStatusView),
  // que já é a fonte certa pra ele.
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
          {/* Fase F5 (mockup v2) — nome + plano na MESMA célula (pílula
              inline, mesmo espírito do mockup .plan), no lugar da antiga
              coluna "Plano" isolada (só existia em telas largas). */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{vm.name}</Text>
            {vm.plan && <Text style={styles.planPill}>{PLAN_LABEL[vm.plan]}</Text>}
            {/* Rótulo de dojô inativo (PR #413 — is_active por linha).
                Só aparece quando é FALSE: no recorte padrão ("Ativos")
                nunca aparece nenhuma linha inativa, então o rótulo "Ativo"
                seria redundante em toda a tabela — só sinalizamos a
                EXCEÇÃO. É essencial no recorte "Todos"/"Inativos" pra
                distinguir quem já não é filiado. Mesmo componente
                (ShojiBadge dojoStatus=) que DojosListTab usa pro mesmo
                conceito — nenhum badge novo inventado aqui. */}
            {seg === "dojo" && vm.isActive === false && <ShojiBadge dojoStatus="inactive" />}
          </View>
          <Mono style={{ fontSize: 10, color: P.red }}>{vm.code || "—"}</Mono>
          {/* Fase F5 (mockup v2) — barra devido→recebido com legenda de
              valores (recebido / de total) logo abaixo — a mesma informação
              que antes vivia numa coluna "Total" à parte, agora lida junto
              do progresso (mockup .amts). Só faz sentido quando existe
              cobrança com valor > 0. */}
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

          {/* Trilha de parcelas — aditiva ao mockup v2 (que só tem a barra):
              MANTIDA aqui, mais discreta/aninhada sob o progresso, porque é
              a única forma de abrir/pagar uma parcela FORA da ordem FIFO
              (função existente shipped na F2 — não pode sumir, ver PR). */}
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

        {/* Fase F5 (mockup v2) — saldo com coluna PRÓPRIA à direita (peso
            visual: mono maior, cor só quando atrasado — "paleta contida").
            Antes o saldo dividia a mesma coluna estreita do badge de status
            com tipografia pequena; agora o badge fica no topo e o número
            do saldo ganha destaque abaixo, mais perto do mockup aprovado. */}
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
          {/* Fase F5 — P.danger (não P.red): mesmo token semântico do
              badge/KPI "Atrasado" acima (ver annuityReceivableStatusView) —
              o vermelhão de carimbo (P.red) fica reservado pra AÇÃO. */}
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
              {/* Fase F5 (mockup v2: "ação primária destacada, secundárias
                  contidas") — extrato + remover cobrança AGRUPADOS e
                  contidos (ícone só, borda fraca), a ação primária
                  "Receber" separada e destacada em vermelho. Nenhuma das
                  duas ações mudou de comportamento — só reorganizadas. */}
              <View style={styles.secondaryActions}>
                {/* Fase F4 — extrato do recebível (sempre acessível, mesmo
                    quitado: histórico de baixas não desaparece). */}
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
              {/* Fase F4 — ação primária do recebível: abre a folha de baixa
                  livre (prévia FIFO ao vivo contra o backend, nunca
                  recalculada no cliente). Só quando há saldo em aberto —
                  quitado não oferece "Receber" (mesma regra do mockup v2). */}
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
// Ao expandir uma cobranca, o gestor ve ANTES de tentar enviar se aquela
// pessoa/dojo tem WhatsApp e/ou e-mail cadastrado - hoje ele so descobria
// depois de clicar e ver o "pulado" no modal. Ausencia de canal e o
// estado NORMAL da maioria (das 549 faixas-pretas ativas, so 2 tem
// e-mail e 523 tem telefone - ver CLAUDE.md) - por isso NUNCA vermelho/
// alerta aqui, sempre neutro (mesmo tom de "Historico"/pilulas info).
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
const AnnuityRow = React.memo(AnnuityRowItem);

// ── Barra de multi-seleção ────────────────────────────────────────
// Fase F3: a mesma seleção agora alimenta DUAS ações, cada uma só olhando
// pro subconjunto que faz sentido pra ela — "Registrar pagamento" ignora
// linhas sem cobrança, "Lançar cobrança" (POST .../batch) ignora linhas
// que já têm cobrança (o backend as devolveria em `skipped[]` de qualquer
// forma, mas filtrar aqui deixa a intenção clara pro operador).
function BulkBar({
  count, payableCount, noChargeCount, emailCount, onClear, onOpenBulkPay, onCopyMessage, onBulkLaunch, onBulkEmail, onBulkVoid,
}: {
  count: number; payableCount: number; noChargeCount: number; emailCount: number;
  onClear: () => void; onOpenBulkPay: () => void; onCopyMessage: () => void;
  onBulkLaunch: () => void; onBulkEmail: () => void; onBulkVoid: () => void;
}) {
  if (count === 0) return null;
  // Mockup (.floatbar): pílula ESCURA (ink) flutuante, sombra, cantos
  // arredondados — nunca uma barra clara edge-to-edge. Ordem dos botões
  // segue o mockup (Registrar pagamento → Enviar por e-mail → Copiar
  // mensagem), com "Lançar cobrança em lote" (aditivo da F3, sem
  // equivalente no mockup) por último. "Limpar seleção" é texto no canto
  // direito (mockup .clear), não um ícone X à esquerda.
  //
  // BUGFIX P0 (11/07/2026): "Registrar pagamento" NUNCA muta no clique
  // direto — onOpenBulkPay só abre o BulkPayConfirmModal (contagem + valor
  // total + confirmar/cancelar separados). Era o único botão da barra sem
  // esse passo (todos os outros já abriam modal) e já causou baixa
  // acidental de 3 anuidades reais em produção. A baixa em si (e o
  // spinner) agora vivem dentro do modal, não aqui.
  return (
    <View style={styles.bulkBar}>
      <Text style={styles.bulkCount}>{count} selecionado{count === 1 ? "" : "s"}</Text>
      {payableCount > 0 && (
        <TouchableOpacity style={styles.bulkBtn} onPress={onOpenBulkPay} accessibilityRole="button" accessibilityLabel="Registrar pagamento em lote">
          <Icon name="checkmark" size={13} color={P.paperWarm} />
          <Text style={styles.bulkBtnLabel}>Registrar pagamento</Text>
        </TouchableOpacity>
      )}
      {/* Envio de e-mail em lote (Fase F4) — POST .../send-email-batch, via
          SendEmailBatchModal (prévia + contagem antes de enviar, resultado
          sent/skipped/errors — alvo sem e-mail cadastrado é pulado, nunca
          erro). Só aparece quando ao menos 1 selecionado tem parcela
          pendente pra cobrar (mesmo critério de "Registrar pagamento"). */}
      {emailCount > 0 && (
        <TouchableOpacity style={styles.bulkBtn} onPress={onBulkEmail} accessibilityRole="button" accessibilityLabel="Enviar cobrança por e-mail em lote">
          <Icon name="mail" size={13} color={P.paperWarm} />
          <Text style={styles.bulkBtnLabel}>Enviar por e-mail</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.bulkBtn} onPress={onCopyMessage} accessibilityRole="button" accessibilityLabel="Copiar mensagem de cobrança">
        <Icon name="copy-outline" size={13} color={P.paperWarm} />
        <Text style={styles.bulkBtnLabel}>Copiar mensagem</Text>
      </TouchableOpacity>
      {/* Retirada de cobrança em lote (Fase F4) — POST .../void-batch, via
          VoidBatchModal (confirmação destrutiva + contagem). É retirada do
          lançamento, NÃO estorno financeiro — o backend já pula (não erra)
          parcela paga ou NFS-e emitida, com motivo claro no resultado. */}
      {payableCount > 0 && (
        <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnWarn]} onPress={onBulkVoid} accessibilityRole="button" accessibilityLabel="Retirar cobrança em lote">
          <Icon name="trash-outline" size={13} color="#fff" />
          <Text style={[styles.bulkBtnLabel, { color: "#fff" }]}>Retirar cobrança</Text>
        </TouchableOpacity>
      )}
      {noChargeCount > 0 && (
        <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnWarn]} onPress={onBulkLaunch} accessibilityRole="button" accessibilityLabel="Lançar cobrança em lote">
          <Icon name="add" size={13} color="#fff" />
          <Text style={[styles.bulkBtnLabel, { color: "#fff" }]}>Lançar cobrança{noChargeCount > 1 ? ` (${noChargeCount})` : ""}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onClear} accessibilityRole="button" accessibilityLabel="Limpar seleção" style={styles.bulkClear}>
        <Text style={styles.bulkClearLabel}>Limpar seleção</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Header estável da FlatList (season header do hub + busca + chips + thead) ──
type TableHeaderProps = {
  headerElement: React.ReactNode;
  q: string; onChangeQ: (t: string) => void;
  statusFilter: AnnuityStatusFilter; onStatusFilter: (s: AnnuityStatusFilter) => void;
  total: number; seg: SegKey; showThead: boolean;
};
const TableHeader = React.memo(function TableHeader(p: TableHeaderProps) {
  return (
    <View>
      {p.headerElement}
      <View style={[styles.pocoCap, SH.sunken]}>
        <SearchField
          value={p.q}
          onChangeText={p.onChangeQ}
          placeholder={p.seg === "dojo" ? "Buscar por nome do dojô ou código FPKT..." : "Buscar por nome ou matrícula..."}
          style={{ marginBottom: 14 }}
        />
        {/* Chips de status (mockup .chips) — seleção única (rádio), mesmo
            statusFilter que os KPIs do hub também dirigem (clicar aqui
            reflete lá e vice-versa, uma fonte única de verdade). "Todos"
            volta ao estado sem filtro.
            BUGFIX P2 — taxonomia unificada (11/07/2026): existiam TRÊS
            nomes pra "atrasado" no hub — o KPI dizia "Atrasado" (alias
            overdue ∪ defaulting ∪ suspended, mesma regra de
            karateAnnuitySummary.js), e esta linha de chips tinha "Vencido"
            (só overdue, 0-90d) E "Inadimplente" (só defaulting, 91-180d) —
            sem chip nenhum pra 'suspended' (>180d). Resultado: 3 rótulos
            pro que o gestor lê como o mesmo conceito, com 3 números
            diferentes. Agora o chip usa o MESMO alias 'atrasado' que o
            KPI — mesmo nome, mesmo número, sempre (ver STATUS_ALIASES em
            karateAnnuities.js, backend). O badge por LINHA continua
            mostrando o estágio granular (Vencido/Inadimplente, ver
            annuityStatusView em karateTheme.ts) — isso é detalhe
            informativo por registro, não um filtro agregado, então não
            reabre a confusão. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Chip label="Todos" active={p.statusFilter === "all"} onPress={() => p.onStatusFilter("all")} />
          <Chip label="Pago" active={p.statusFilter === "paid"} onPress={() => p.onStatusFilter("paid")} />
          <Chip label="A vencer" active={p.statusFilter === "due"} onPress={() => p.onStatusFilter("due")} />
          <Chip label="Atrasado" active={p.statusFilter === "atrasado"} onPress={() => p.onStatusFilter("atrasado")} />
          <Chip label="Sem cobrança" active={p.statusFilter === "no_charge"} onPress={() => p.onStatusFilter("no_charge")} />
        </View>
        <Body muted style={{ fontSize: 11.5, marginBottom: 6 }}>{p.total} {p.total === 1 ? "registro" : "registros"} na temporada</Body>
        {/* Fase F5 (mockup v2) — thead reduzido a 2 colunas reais (Dojô/
            Praticante + Saldo): "Plano" virou pílula inline no nome,
            "Parcelas" e "Total" viraram a barra + legenda sob o nome —
            nenhuma informação sumiu, só o cabeçalho de tabela parou de
            listar como colunas o que agora é lido dentro da própria
            célula (razão do "ainda parece tabela" apontado pelo Caio). */}
        {p.showThead && (
          <View style={styles.thead}>
            <View style={{ width: 22 }} />
            <Text style={[styles.th, { flex: 2 }]}>{p.seg === "dojo" ? "Dojô" : "Praticante"}</Text>
            <Text style={[styles.th, { width: 150, textAlign: "right" }]}>Saldo</Text>
            <View style={{ width: 96 }} />
          </View>
        )}
      </View>
    </View>
  );
});

// ── Componente principal ──────────────────────────────────────────
interface Props {
  federationId: string;
  seg: SegKey;
  year: string;
  statusFilter: AnnuityStatusFilter;
  onStatusFilterChange: (s: AnnuityStatusFilter) => void;
  /** Filtro ativo/inativo do segmento Dojô (PR #413, backend) — vem do hub
   *  (AnnuitiesHub), fonte única compartilhada com o summary/KPIs. Só é
   *  usado quando seg==="dojo" (listCpfAnnuities não tem esse parâmetro). */
  dojoStatus: AnnuityDojoStatusFilter;
  onMutated: () => void;
  headerElement: React.ReactNode;
}

export function AnnuitiesTable({ federationId, seg, year, statusFilter, onStatusFilterChange, dojoStatus, onMutated, headerElement }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [items, setItems] = useState<AnnuityRowVM[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS); return () => clearTimeout(t); }, [q]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [voidTargetKey, setVoidTargetKey] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [chargeTargetKey, setChargeTargetKey] = useState<string | null>(null);
  const [pixTarget, setPixTarget] = useState<{ installmentId: string; amount: number; label: string } | null>(null);
  // BUGFIX P0 (11/07/2026) — "Registrar pagamento" em lote agora exige
  // confirmação (BulkPayConfirmModal), mesmo padrão de
  // emailModalTargets/voidModalTargets abaixo: não-nulo (mesmo array
  // vazio) é o sinal de "modal aberto", nunca reaproveita um array antigo
  // depois de fechado.
  const [bulkPayTargets, setBulkPayTargets] = useState<BulkPayTarget[] | null>(null);
  const [bulkPayNoPending, setBulkPayNoPending] = useState(0);
  // Fase F3 — lançar cobrança em lote (POST .../batch) pras linhas
  // selecionadas que ainda não têm cobrança nesta temporada.
  const [batchLaunchOpen, setBatchLaunchOpen] = useState(false);
  // Fase F4 — envio manual de e-mail (single via botão da parcela, lote via
  // barra de seleção) e retirada de cobrança em lote. `emailModalTargets`
  // não-nulo (mesmo vazio) é o sinal de "modal aberto" (mesmo padrão de
  // batchLaunchOpen/voidModalTargets abaixo) — nunca reaproveitamos um
  // array antigo depois de fechado (sempre null on close).
  const [emailModalTargets, setEmailModalTargets] = useState<EmailBatchTarget[] | null>(null);
  const [emailModalNoPending, setEmailModalNoPending] = useState(0);
  const [voidModalTargets, setVoidModalTargets] = useState<VoidBatchTarget[] | null>(null);
  // Alvo do WhatsApp aberto a partir de um "pulado" do SendEmailBatchModal
  // (sem e-mail cadastrado) — nunca aberto com o SendEmailBatchModal ainda
  // visível (armadilha Modal-dentro-de-Modal); ver onOpenWhatsApp abaixo.
  const [waTarget, setWaTarget] = useState<WhatsAppChargeTarget | null>(null);
  // Fase F4 — anuidade como recebível: folha de baixa livre (por rowId/
  // annuity_id) e extrato. `receiveTargetKey`/`statementTargetKey` não-nulo
  // é o sinal de "modal aberto" (mesmo padrão de emailModalTargets/
  // voidModalTargets acima) — nunca os dois abertos ao mesmo tempo
  // (armadilha Modal-dentro-de-Modal: cada open* fecha qualquer outro modal
  // transiente primeiro, ver openReceive/openStatement abaixo).
  const [receiveTargetKey, setReceiveTargetKey] = useState<string | null>(null);
  const [statementTargetKey, setStatementTargetKey] = useState<string | null>(null);

  // Volta pra página 1 sempre que o filtro/busca/segmento/ano/dojo_status
  // muda; limpa seleção (evita agir sobre linhas que já não estão na
  // tela). BUGFIX real já visto no roster: trocar de filtro sem resetar a
  // página deixa a lista vazia (ex.: página 3 de "Ativos" pode não existir
  // em "Inativos") sem explicar o motivo pro operador.
  useEffect(() => { setPage(1); setSelected(new Set()); setExpandedKey(null); }, [seg, year, statusFilter, dojoStatus, debouncedQ]);

  // Condição de corrida: cada fetch carrega um id incremental; só a
  // resposta MAIS RECENTE pode escrever no estado (mesmo padrão de
  // DojosListTab/CadastralTab). Trocar o filtro dojo_status rápido demais
  // (ou junto de outro filtro) antes disparava duas requisições concorrentes
  // e a mais lenta podia sobrescrever a lista com dados do recorte errado.
  const reqIdRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const myReq = ++reqIdRef.current;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      // dojo_status só existe na rota de dojô (PR #413) — a rota de CPF
      // (listCpfAnnuities) não tem esse parâmetro no backend, então só
      // entra no payload quando seg==="dojo". Mesmo valor que o hub manda
      // pro summary (getAnnuitySummary) nesse mesmo recorte — garante que
      // lista e KPIs nunca divergem.
      const params = seg === "dojo"
        ? { status: statusFilter, year, q: debouncedQ || undefined, page, pageSize: PAGE_SIZE, dojo_status: dojoStatus }
        : { status: statusFilter, year, q: debouncedQ || undefined, page, pageSize: PAGE_SIZE };
      const res = seg === "dojo"
        ? await karateApi.listDojoAnnuities(federationId, params)
        : await karateApi.listCpfAnnuities(federationId, params);
      if (myReq !== reqIdRef.current) return; // resposta obsoleta — descarta
      setItems(res.data.map((it) => toRowVM(seg, it)));
      setTotal(res.total);
    } catch {
      if (myReq !== reqIdRef.current) return;
      setError(true);
    } finally {
      if (myReq === reqIdRef.current) {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    }
  }, [federationId, seg, year, statusFilter, dojoStatus, debouncedQ, page]);
  useEffect(() => { load(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Ações de parcela ────────────────────────────────────────────
  const handlePayInstallment = useCallback(async (instId: string, method: AnnuityPaymentMethod) => {
    try {
      await karateApi.payInstallment(federationId, instId, { payment_method: method });
      toast.success("Pagamento registrado");
      load(true);
      onMutated();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar o pagamento.");
      throw e;
    }
  }, [federationId, load, onMutated]);

  const handleEditInstallment = useCallback(async (instId: string, body: { amount?: number; due_date?: string }) => {
    try {
      await karateApi.updateInstallment(federationId, instId, body);
      toast.success("Parcela atualizada");
      load(true);
      onMutated();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível editar a parcela.");
      throw e;
    }
  }, [federationId, load, onMutated]);

  const handleVoid = useCallback(async () => {
    if (!voidTargetKey) return;
    const vm = items.find((i) => i.key === voidTargetKey);
    if (!vm || !vm.rowId) { setVoidTargetKey(null); return; }
    setVoiding(true);
    try {
      await karateApi.voidAnnuityGeneric(federationId, vm.rowId);
      toast.success("Cobrança removida");
      setVoidTargetKey(null);
      load(true);
      onMutated();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover a cobrança.");
    } finally {
      setVoiding(false);
    }
  }, [voidTargetKey, items, federationId, load, onMutated]);

  // ── Fase F4 — folha de baixa livre / extrato do recebível ───────────
  // Cada open* fecha qualquer OUTRO modal transiente antes de abrir o seu
  // (mesma disciplina do resto do arquivo — nunca dois <Modal> montados ao
  // mesmo tempo, armadilha Modal-dentro-de-Modal no RN Web).
  const openReceive = useCallback((key: string) => {
    setStatementTargetKey(null);
    setPixTarget(null);
    setChargeTargetKey(null);
    setVoidTargetKey(null);
    setReceiveTargetKey(key);
  }, []);
  const closeReceive = useCallback(() => setReceiveTargetKey(null), []);

  const openStatement = useCallback((key: string) => {
    setReceiveTargetKey(null);
    setPixTarget(null);
    setChargeTargetKey(null);
    setVoidTargetKey(null);
    setStatementTargetKey(key);
  }, []);
  const closeStatement = useCallback(() => setStatementTargetKey(null), []);

  // Sucesso da baixa — a lista e os KPIs (via onMutated, que recarrega o
  // summary no hub) leem a MESMA fonte pós-baixa: um refetch real do
  // backend (load(true)), nunca um patch otimista da linha em memória.
  // Isso é deliberado (evita a família de bug "estado duplicado" — mutação
  // escreve numa lista, UI lê outra — já documentada nas armadilhas desta
  // tela) mesmo custando um round-trip extra.
  const handleReceiveSuccess = useCallback((_result: AnnuityReceiveResult) => {
    setReceiveTargetKey(null);
    load(true);
    onMutated();
  }, [load, onMutated]);

  const receiveTargetVm = items.find((i) => i.key === receiveTargetKey) || null;
  const statementTargetVm = items.find((i) => i.key === statementTargetKey) || null;

  // ── Multi-seleção — pagamento em lote (nunca all-or-nothing silencioso) ──
  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const selectedRows = useMemo(() => items.filter((i) => selected.has(i.key) && i.rowId), [items, selected]);
  // Fase F3 — subconjunto sem cobrança da MESMA seleção: alimenta o
  // "Lançar cobrança em lote" (BatchLaunchModal → POST .../batch). Linhas
  // que já têm cobrança ficam de fora daqui (essas são o alvo de
  // handleOpenBulkPay acima) — cada ação olha só pro que faz sentido pra ela.
  const noChargeSelectedRows = useMemo(() => items.filter((i) => selected.has(i.key) && !i.rowId), [items, selected]);

  // Fase F4 — mesmo critério de "achar a parcela acionável" que
  // handleOpenBulkPay já usa (vencida ou a_vencer): é a parcela que faz
  // sentido cobrar agora. Conta quantos dos selecionados TÊM essa parcela
  // (emailPayableCount, alimenta o botão da barra) sem precisar abrir o
  // modal — o modal em si recalcula na hora de montar os targets.
  //
  // Decisão consciente (trilha adaptável a split payments, ver
  // classifyInstallments acima): NÃO inclui "parcial" aqui de propósito.
  // Esses fluxos legados de LOTE (e-mail/"Registrar pagamento") mostram
  // `inst.amount` (valor cheio) ao operador antes de confirmar —
  // BulkPayConfirmModal em particular é um componente com histórico de bug
  // P0 de dinheiro (ver comentário no próprio arquivo), então trocar esse
  // valor pro saldo em aberto (amount - amount_paid) merece revisão própria,
  // fora do escopo desta mudança (só a trilha). Uma parcela parcial
  // permanece acionável pelo fluxo "Receber" por linha (split-aware, F4) —
  // ela só não entra automaticamente nesses atalhos em lote por enquanto.
  const emailPayableCount = useMemo(() => selectedRows.filter(
    (vm) => classifyInstallments(vm.installments).some((c) => c.state === "vencida" || c.state === "a_vencer")
  ).length, [selectedRows]);

  // Envio manual — linha (parcela específica, já sabida pelo caller) ──
  const handleOpenRowEmail = useCallback((vm: AnnuityRowVM, instId: string) => {
    const inst = vm.installments.find((i) => i.id === instId);
    if (!inst) return;
    setEmailModalNoPending(0);
    setEmailModalTargets([{
      key: `${vm.key}-${inst.id}`,
      instId: inst.id,
      name: vm.name,
      whatsapp: vm.whatsapp,
      amount: inst.amount,
      referencePeriod: vm.referencePeriod,
      dueDate: inst.due_date,
      status: vm.status as AnnuityStatus,
    }]);
  }, []);

  // Envio manual — lote (barra de seleção) — mesma seleção de
  // handleOpenBulkPay, cada linha contribui com sua parcela vencida/a_vencer
  // (uma por linha; se não tiver nenhuma pendente, entra em noPendingCount
  // — informativo, não é erro, mostrado no modal antes de confirmar).
  // "parcial" fica de fora aqui pelo mesmo motivo documentado em
  // emailPayableCount acima.
  const handleOpenBulkEmail = useCallback(() => {
    const targets: EmailBatchTarget[] = [];
    let noPending = 0;
    selectedRows.forEach((vm) => {
      const c = classifyInstallments(vm.installments).find((x) => x.state === "vencida" || x.state === "a_vencer");
      if (!c) { noPending += 1; return; }
      targets.push({
        key: `${vm.key}-${c.inst.id}`,
        instId: c.inst.id,
        name: vm.name,
        whatsapp: vm.whatsapp,
        amount: c.inst.amount,
        referencePeriod: vm.referencePeriod,
        dueDate: c.inst.due_date,
        status: vm.status as AnnuityStatus,
      });
    });
    setEmailModalNoPending(noPending);
    setEmailModalTargets(targets);
  }, [selectedRows]);

  // Retirada de cobrança em lote — annuity_id de cada linha selecionada
  // que tem cobrança (mesmo subconjunto de handleOpenBulkPay). Não filtramos
  // paga/NFS-e aqui: o backend já pula (não erra) esses casos com motivo
  // claro (has_paid_installment / has_nfse) — filtrar client-side só
  // duplicaria essa regra e poderia ficar desatualizado.
  const handleOpenVoidBatch = useCallback(() => {
    const targets: VoidBatchTarget[] = selectedRows
      .filter((vm) => !!vm.rowId)
      .map((vm) => ({ annuityId: vm.rowId as string, name: vm.name, referencePeriod: vm.referencePeriod }));
    setVoidModalTargets(targets);
  }, [selectedRows]);

  // BUGFIX P0 (11/07/2026) — antes disparava a baixa DIRETO no clique do
  // botão da barra (handleBulkPay chamado por onBulkPay sem passo
  // intermediário nenhum); um clique exploratório no QA marcou 3
  // anuidades reais como pagas. Agora só MONTA os alvos (mesmo critério de
  // handleOpenBulkEmail: parcela vencida ou a_vencer) e abre o
  // BulkPayConfirmModal — a baixa em si só acontece depois do operador
  // confirmar explicitamente lá dentro (contagem + valor total visíveis
  // antes de mutar).
  // "parcial" fica de fora aqui pelo mesmo motivo documentado em
  // emailPayableCount acima (BulkPayConfirmModal exibe inst.amount cheio,
  // não o saldo em aberto — trocar isso é fora do escopo desta mudança).
  const handleOpenBulkPay = useCallback(() => {
    const targets: BulkPayTarget[] = [];
    let noPending = 0;
    selectedRows.forEach((vm) => {
      const c = classifyInstallments(vm.installments).find((x) => x.state === "vencida" || x.state === "a_vencer");
      if (!c) { noPending += 1; return; }
      targets.push({
        key: `${vm.key}-${c.inst.id}`,
        instId: c.inst.id,
        name: vm.name,
        amount: c.inst.amount,
        referencePeriod: vm.referencePeriod,
      });
    });
    setBulkPayNoPending(noPending);
    setBulkPayTargets(targets);
  }, [selectedRows]);

  const handleCopyMessage = useCallback(() => {
    const rows = items.filter((i) => selected.has(i.key));
    if (rows.length === 0) return;
    const lines = rows.map((r, idx) => {
      const owed = Math.max(0, r.total - r.paidTotal);
      return `${idx + 1}. ${r.name}${r.code ? ` (${r.code})` : ""} — ${fmtMoney(owed)} em aberto${r.dueDate ? ` — vencimento ${formatIsoToBr(r.dueDate)}` : ""}`;
    });
    const totalOwed = rows.reduce((s, r) => s + Math.max(0, r.total - r.paidTotal), 0);
    const msg = `Cobranças em aberto — Anuidades ${seg === "dojo" ? "Dojô" : "Praticantes"} · temporada ${year}\n\n${lines.join("\n")}\n\nTotal em aberto: ${fmtMoney(totalOwed)}`;
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(msg).catch(() => {});
    } else {
      Clipboard.setString(msg);
    }
    toast.success("Mensagem copiada");
  }, [items, selected, seg, year]);

  const chargeTargetVm = items.find((i) => i.key === chargeTargetKey) || null;

  if (error) {
    return (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={<View>{headerElement}</View>}
        ListEmptyComponent={<KarateErrorState onRetry={() => load()} style={{ paddingVertical: 60 }} />}
        contentContainerStyle={styles.pageScroll}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        ListHeaderComponent={
          <TableHeader
            headerElement={headerElement}
            q={q} onChangeQ={setQ}
            statusFilter={statusFilter} onStatusFilter={onStatusFilterChange}
            total={total} seg={seg} showThead={wide && items.length > 0}
          />
        }
        ListFooterComponent={
          <View style={styles.pocoFoot}>
            {pageCount > 1 && (
              <View style={styles.pagerRow}>
                <Text style={styles.pagerInfo}>Página {page} de {pageCount} · {total} registros</Text>
                <View style={styles.pagerBtns}>
                  <TouchableOpacity
                    style={[styles.pagerBtn, page <= 1 && styles.pagerBtnOff]}
                    disabled={page <= 1}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Página anterior"
                  >
                    <Icon name="chevron-back" size={13} color={C.ink} />
                    <Text style={styles.pagerBtnTxt}>Anterior</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pagerBtn, page >= pageCount && styles.pagerBtnOff]}
                    disabled={page >= pageCount}
                    onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Próxima página"
                  >
                    <Text style={styles.pagerBtnTxt}>Próxima</Text>
                    <Icon name="chevron-forward" size={13} color={C.ink} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.pocoItem}>
            {loading ? (
              <View style={{ paddingTop: 8 }}>
                {[1, 2, 3, 4].map((k) => <View key={k} style={styles.skeletonRow} />)}
              </View>
            ) : (
              <KarateEmptyState
                icon="document-text-outline"
                title={q.trim() ? "Nenhum registro encontrado" : "Sem cobranças neste filtro"}
                subtitle={q.trim() ? "Ajuste a busca ou o filtro de status." : "Ausência de cobrança não é inadimplência — é um convite a cobrar."}
                style={{ paddingVertical: 40 }}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.pocoItem}>
            <AnnuityRow
              vm={item}
              seg={seg}
              wide={wide}
              federationId={federationId}
              selected={selected.has(item.key)}
              // Fase F3: seleção agora cobre TAMBÉM linhas sem cobrança
              // (no_charge) — são o alvo real de "Lançar cobrança em lote"
              // (POST .../batch). Linhas com cobrança seguem usáveis pra
              // "Registrar pagamento em lote" (ambas as ações filtram a
              // seleção pelo que fizer sentido pra cada uma — ver
              // selectedRows / noChargeSelectedRows abaixo).
              selectable
              expanded={expandedKey === item.key}
              onToggleSelect={() => toggleSelect(item.key)}
              onToggleExpand={() => setExpandedKey((k) => (k === item.key ? null : item.key))}
              onPay={handlePayInstallment}
              onPix={(instId, amount, label) => setPixTarget({ installmentId: instId, amount, label: `${item.name} — ${label}` })}
              onEdit={handleEditInstallment}
              onSendEmail={(instId) => handleOpenRowEmail(item, instId)}
              onVoid={() => setVoidTargetKey(item.key)}
              onLaunch={() => setChargeTargetKey(item.key)}
              voidConfirming={voidTargetKey === item.key}
              onVoidConfirm={handleVoid}
              onVoidCancel={() => setVoidTargetKey(null)}
              voiding={voiding}
              onReceive={() => openReceive(item.key)}
              onStatement={() => openStatement(item.key)}
            />
          </View>
        )}
        contentContainerStyle={styles.pageScroll}
        style={{ flex: 1, width: "100%" }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
      />

      <BulkBar
        count={selected.size}
        payableCount={selectedRows.length}
        noChargeCount={noChargeSelectedRows.length}
        emailCount={emailPayableCount}
        onClear={() => setSelected(new Set())}
        onOpenBulkPay={handleOpenBulkPay}
        onCopyMessage={handleCopyMessage}
        onBulkLaunch={() => setBatchLaunchOpen(true)}
        onBulkEmail={handleOpenBulkEmail}
        onBulkVoid={handleOpenVoidBatch}
      />

      {batchLaunchOpen && (
        <BatchLaunchModal
          visible={batchLaunchOpen}
          federationId={federationId}
          year={year}
          seg={seg}
          targets={noChargeSelectedRows.map((r) => ({ id: r.key, name: r.name }))}
          onClose={() => setBatchLaunchOpen(false)}
          onDone={() => {
            setBatchLaunchOpen(false);
            setSelected(new Set());
            load(true);
            onMutated();
          }}
        />
      )}

      {/* BUGFIX P0 (11/07/2026) — confirmação antes de "Registrar
          pagamento" em lote (contagem + valor total + confirmar/cancelar
          separados). Ver comentário de handleOpenBulkPay acima. */}
      {bulkPayTargets && (
        <BulkPayConfirmModal
          visible={!!bulkPayTargets}
          federationId={federationId}
          targets={bulkPayTargets}
          noPendingCount={bulkPayNoPending}
          onClose={() => setBulkPayTargets(null)}
          onDone={() => { setBulkPayTargets(null); setSelected(new Set()); load(true); onMutated(); }}
        />
      )}

      {pixTarget && (
        <PixPaymentModal
          visible={!!pixTarget}
          federationId={federationId}
          target={{ installmentId: pixTarget.installmentId }}
          amount={pixTarget.amount}
          description={`Anuidade — ${pixTarget.label}`}
          isAdmin
          onSuccess={() => { setPixTarget(null); load(true); onMutated(); }}
          onClose={() => setPixTarget(null)}
        />
      )}

      {chargeTargetVm && seg === "dojo" && (
        <LancarAnuidadeDojoModal
          visible={!!chargeTargetVm}
          mode="charge"
          federationId={federationId}
          dojoId={chargeTargetVm.key}
          dojoName={chargeTargetVm.name}
          onClose={() => setChargeTargetKey(null)}
          onDone={() => { setChargeTargetKey(null); load(true); onMutated(); }}
        />
      )}
      {chargeTargetVm && seg === "cpf" && (
        <LancarAnuidadeModal
          visible={!!chargeTargetVm}
          federationId={federationId}
          practitionerId={chargeTargetVm.key}
          practitionerName={chargeTargetVm.name}
          onClose={() => setChargeTargetKey(null)}
          onDone={() => { setChargeTargetKey(null); load(true); onMutated(); }}
        />
      )}

      {/* Fase F4 — envio manual de e-mail (linha OU lote, mesmo modal —
          reaproveita a confirmação com prévia + contagem e o resultado
          sent/skipped/errors pros dois casos). "Concluir" recarrega a
          lista (parcela pode ter mudado de estado no log da régua) e
          limpa a seleção (relevante só no caso de lote). */}
      {emailModalTargets && (
        <SendEmailBatchModal
          visible={!!emailModalTargets}
          federationId={federationId}
          targets={emailModalTargets}
          noPendingCount={emailModalNoPending}
          onClose={() => setEmailModalTargets(null)}
          onDone={() => { setEmailModalTargets(null); setSelected(new Set()); load(true); onMutated(); }}
          onOpenWhatsApp={(t) => { setEmailModalTargets(null); setWaTarget(t); }}
        />
      )}

      {/* Fase F4 — retirada de cobrança em lote (destrutivo, com
          confirmação + contagem antes de agir). */}
      {voidModalTargets && (
        <VoidBatchModal
          visible={!!voidModalTargets}
          federationId={federationId}
          targets={voidModalTargets}
          onClose={() => setVoidModalTargets(null)}
          onDone={() => { setVoidModalTargets(null); setSelected(new Set()); load(true); onMutated(); }}
        />
      )}

      {/* WhatsApp — só abre depois que o SendEmailBatchModal já fechou
          (onOpenWhatsApp acima), nunca com os dois <Modal> montados ao
          mesmo tempo (armadilha Modal-dentro-de-Modal no RN Web). */}
      {waTarget && (
        <WhatsAppChargeModal
          visible={!!waTarget}
          federationId={federationId}
          target={waTarget}
          onClose={() => setWaTarget(null)}
        />
      )}

      {/* Fase F4 — folha de baixa livre (prévia FIFO ao vivo contra
          /receive/preview, confirmação via /receive). Só abre quando a
          linha tem cobrança (rowId) — mesma guarda que o botão "Receber"
          já aplica antes de chamar onReceive. */}
      {receiveTargetVm && receiveTargetVm.rowId && (
        <AnnuityReceiveModal
          visible={!!receiveTargetVm}
          federationId={federationId}
          annuityId={receiveTargetVm.rowId}
          name={receiveTargetVm.name}
          code={receiveTargetVm.code}
          planLabel={receiveTargetVm.plan ? PLAN_LABEL[receiveTargetVm.plan] : null}
          referencePeriod={receiveTargetVm.referencePeriod}
          dueTotal={receiveTargetVm.total}
          paidTotal={receiveTargetVm.paidTotal}
          installments={receiveTargetVm.installments}
          onClose={closeReceive}
          onSuccess={handleReceiveSuccess}
        />
      )}

      {/* Fase F4 — extrato do recebível (GET .../payments). */}
      {statementTargetVm && statementTargetVm.rowId && (
        <AnnuityStatementModal
          visible={!!statementTargetVm}
          federationId={federationId}
          annuityId={statementTargetVm.rowId}
          name={statementTargetVm.name}
          onClose={closeStatement}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageScroll: { paddingHorizontal: 40, paddingTop: 48, paddingBottom: 96 } as ViewStyle,

  // marginTop propositalmente ausente: o espaçamento até o header vem do
  // próprio RaisedHeader (marginBottom: 28, ver AnnuitiesHub) — mesma fonte
  // única de verdade usada em Praticantes/Dojôs (pocoCap não duplica a margem).
  pocoCap: { backgroundColor: P.paper2, borderTopWidth: 1.5, borderTopColor: C.line2, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 24, paddingTop: 20 } as ViewStyle,
  pocoItem: { backgroundColor: P.paper2, paddingHorizontal: 24 } as ViewStyle,
  pocoFoot: { backgroundColor: P.paper2, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 } as ViewStyle,

  thead: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, gap: 8 } as ViewStyle,
  th: { fontFamily: F.body, fontSize: 10, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,

  skeletonRow: { height: 56, borderRadius: R.md, backgroundColor: C.line, opacity: 0.4, marginBottom: 8 } as ViewStyle,

  // Fase F5 (mockup v2) — respiro generoso: mais padding vertical na
  // linha (era 10/6, mockup usa 15px de padding no .row) e gap maior entre
  // as células (era 8, agora 12) — mesma estrutura "poço + divisor" de
  // Praticantes/Dojôs (CLAUDE.md #6), só com mais ar entre os elementos.
  rowCard: { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 14 } as ViewStyle,
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 } as ViewStyle,

  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.line2, alignItems: "center", justifyContent: "center", backgroundColor: P.glass2 } as ViewStyle,
  checkboxOn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,

  name: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  // Fase F5 (mockup v2) — nome + plano na mesma linha (pílula inline,
  // mockup .plan), substitui a antiga coluna "Plano" (só em telas largas).
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" } as ViewStyle,
  planPill: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: C.ink2, borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, paddingHorizontal: 6, paddingVertical: 1 } as TextStyle,

  // overflow:"hidden" existe pra clipar o pillFill (mini barra de progresso
  // do split payment) dentro do arredondado da pill — sem isso a barra
  // vazaria retangular por cima do borderRadius. position:"relative" pra
  // servir de container do position:"absolute" do pillFill.
  pill: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: R.pill, borderWidth: 1.5, overflow: "hidden", position: "relative" } as ViewStyle,
  pillText: { fontFamily: F.mono, fontSize: 10, fontWeight: "700" } as TextStyle,
  // Fase F1 da reforma da anuidade (split payments) — preenchimento
  // proporcional (amount_paid/amount, vindo pronto do backend) no rodapé da
  // pill "parcial". É o que diferencia visualmente uma pill parcial de uma
  // "a_vencer" (mesma âmbar, mas a_vencer nunca tem essa barra porque
  // amount_paid é 0 ali).
  pillFill: { position: "absolute", left: 0, bottom: 0, height: 2.5, opacity: 0.55 } as ViewStyle,

  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: R.pill } as ViewStyle,
  badgeText: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,

  launchBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: P.ink, borderRadius: R.sm, paddingVertical: 6, paddingHorizontal: 10 } as ViewStyle,
  launchBtnLabel: { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,

  // Fase F4 (mockup v2) — barra compacta devido→recebido, sob o nome do
  // dojô/praticante. Cor única (P.ok) — o mockup só usa vermelho pra
  // ação/perigo, nunca pra "progresso normal".
  progBarTrack: { height: 4, borderRadius: 3, backgroundColor: P.paper3, overflow: "hidden", marginTop: 5, width: "100%", maxWidth: 260 } as ViewStyle,
  progBarFill: { height: "100%", borderRadius: 3, backgroundColor: P.ok } as ViewStyle,
  // Fase F5 (mockup v2 .amts) — legenda de valores sob a barra, no lugar
  // da antiga coluna "Total" isolada (mesma informação, lida junto do
  // progresso — só existia em telas largas antes, agora sempre visível).
  progCaptions: { flexDirection: "row", justifyContent: "space-between", marginTop: 5, maxWidth: 260 } as ViewStyle,
  progCaptionRecv: { fontSize: 10.5, color: P.ok, fontWeight: "500" } as TextStyle,
  progCaptionDue: { fontSize: 10.5, color: C.ink3 } as TextStyle,

  // Fase F4 — ação primária do recebível (mockup .btn.primary: vermelho é
  // reservado pra ação real, aqui "Receber").
  // Fase F5 — botão primário um pouco mais generoso (mockup .btn: 9px 15px).
  receiveBtn: { backgroundColor: P.red, borderRadius: R.sm, paddingVertical: 9, paddingHorizontal: 15 } as ViewStyle,
  receiveBtnLabel: { fontSize: 12.5, fontWeight: "700", color: "#fdf8f2" } as TextStyle,
  statementBtn: { alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass } as ViewStyle,

  iconBtnDanger: { alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, borderWidth: 1, borderColor: P.dangerWash, backgroundColor: P.dangerWash } as ViewStyle,
  // Fase F5 (mockup v2: "secundárias contidas") — agrupa extrato + remover
  // cobrança num cluster compacto, visualmente separado da ação primária.
  secondaryActions: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,

  // Fase F5 (mockup v2) — saldo com peso tipográfico próprio (era 14, mono
  // 700, dividindo coluna com o badge; mockup usa ~20px de destaque).
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
  // Fase F4/PIX — botão de ação desabilitado (ex.: "E-mail" sem e-mail
  // cadastrado). Nunca vermelho/alerta: opacidade reduzida + hint neutro
  // abaixo (emailHint), mesmo princípio de "ausência de canal não é erro".
  instActionBtnDisabled: { opacity: 0.5 } as ViewStyle,
  instActionLabelDisabled: { color: P.ink4 } as TextStyle,
  emailHint: { fontSize: 10.5, color: C.ink3, marginTop: 2, textAlign: "right" } as TextStyle,
  // Indicadores de canal de contato (Fase F4/PIX) — pílulas neutras (nunca
  // vermelho/alerta) mostradas ao expandir a cobrança, ANTES de qualquer
  // tentativa de envio. "On" (canal cadastrado) usa o verde-chá ok* já
  // usado pra "em dia/aprovado"; "off" é só tom neutro (ink3/glass), não
  // um estado de erro — é o normal da maioria dos cadastros hoje.
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

  pagerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, paddingTop: 12 } as ViewStyle,
  pagerInfo: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  pagerBtns: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  pagerBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, borderWidth: 1, borderColor: C.line, backgroundColor: P.glass } as ViewStyle,
  pagerBtnOff: { opacity: 0.4 } as ViewStyle,
  pagerBtnTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink } as TextStyle,

  // Mockup .floatbar: pílula ink flutuante (não uma barra clara
  // edge-to-edge) — cantos arredondados, sombra projetada, margem lateral
  // (não cola nas bordas da tela) e sticky no rodapé da viewport.
  bulkBar: {
    flexDirection: "row", alignItems: "center", gap: 9,
    position: Platform.OS === "web" ? ("sticky" as any) : "relative", bottom: 16,
    marginHorizontal: 24, marginTop: 18,
    backgroundColor: P.ink, borderRadius: R.lg,
    paddingVertical: 11, paddingHorizontal: 18, flexWrap: "wrap",
    ...(Platform.OS === "web" ? ({ boxShadow: "0 8px 28px rgba(43,38,32,0.30)" } as any) : {}),
  } as ViewStyle,
  bulkCount: { fontSize: 12.5, fontWeight: "700", color: P.paperWarm, marginRight: 2 } as TextStyle,
  bulkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.sm, borderWidth: 1, borderColor: "rgba(255,253,248,0.22)", backgroundColor: "rgba(255,253,248,0.10)" } as ViewStyle,
  bulkBtnWarn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  bulkBtnLabel: { fontSize: 12, fontWeight: "700", color: P.paperWarm } as TextStyle,
  bulkClear: { marginLeft: "auto" } as ViewStyle,
  bulkClearLabel: { fontSize: 12.5, color: P.paperWarm, opacity: 0.65 } as TextStyle,
});
