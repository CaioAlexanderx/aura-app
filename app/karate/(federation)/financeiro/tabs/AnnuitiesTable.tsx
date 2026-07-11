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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl, useWindowDimensions, ViewStyle, TextStyle, Platform, Clipboard,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP, KarateShadows as SH,
  annuityStatusView,
} from "@/constants/karateTheme";
import { SearchField, Chip, Mono, Body, RowPressable } from "@/components/karate/shoji";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { toast } from "@/components/Toast";
import { PixPaymentModal } from "@/components/karate/PixPaymentModal";
import { LancarAnuidadeDojoModal } from "@/components/karate/LancarAnuidadeDojoModal";
import { LancarAnuidadeModal } from "@/components/karate/praticante-detalhe/LancarAnuidadeModal";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import {
  karateApi, DojoAnnuity, CpfAnnuity, AnnuityInstallment, AnnuityStatusFilter, AnnuityPlan, AnnuityStatus,
} from "@/services/karateApi";
import { BatchLaunchModal } from "@/components/karate/BatchLaunchModal";
import { SendEmailBatchModal, EmailBatchTarget } from "@/components/karate/SendEmailBatchModal";
import { VoidBatchModal, VoidBatchTarget } from "@/components/karate/VoidBatchModal";
import { WhatsAppChargeModal, WhatsAppChargeTarget } from "@/components/karate/WhatsAppChargeModal";
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

// ── Normalização Dojô/CPF → view-model comum da tabela ──────────────
export interface AnnuityRowVM {
  key: string;
  rowId: string | null;         // annuity_id — null quando no_charge (nenhuma ação de linha se aplica)
  name: string;
  code: string | null;          // fpkt_affiliation_id (dojô) ou karate_registration_number (praticante)
  whatsapp: string | null;
  plan: AnnuityPlan | null;
  status: string;                // computed_status do backend (paid/due/overdue/defaulting/no_charge)
  daysOverdue: number;
  amount: number;
  total: number;
  paidTotal: number;
  dueDate: string | null;
  installments: AnnuityInstallment[];
  referencePeriod: string;
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
      plan: d.plan ?? null,
      status: d.status,
      daysOverdue: d.days_overdue ?? computeDaysOverdue(d.installments ?? []),
      amount: d.amount ?? 0,
      total: d.total ?? d.amount ?? 0,
      paidTotal: d.paid_total ?? (d.status === "paid" ? (d.amount ?? 0) : 0),
      dueDate: d.due_date ?? null,
      installments: d.installments ?? [],
      referencePeriod: d.reference_period,
    };
  }
  const p = item as CpfAnnuity;
  return {
    key: p.practitioner_id,
    rowId: p.annuity_id ?? null,
    name: p.full_name,
    code: p.karate_registration_number ?? null,
    whatsapp: p.whatsapp ?? null,
    plan: p.plan ?? null,
    status: p.status,
    daysOverdue: computeDaysOverdue(p.installments ?? []),
    amount: p.amount ?? 0,
    total: p.total ?? p.amount ?? 0,
    paidTotal: p.paid_total ?? (p.status === "paid" ? (p.amount ?? 0) : 0),
    dueDate: p.due_date ?? null,
    installments: p.installments ?? [],
    referencePeriod: p.reference_period,
  };
}

// ── Trilha de parcelas: classifica cada parcela em paga/vencida/a
//    vencer/futura. SÓ a PRIMEIRA parcela pendente (por seq) vira "a
//    vencer" quando ainda não venceu — as pendentes seguintes são
//    "futura" (parcela futura nunca deixa ninguém atrasado — CLAUDE.md).
type InstState = "paga" | "vencida" | "a_vencer" | "futura";
function classifyInstallments(installments: AnnuityInstallment[]): { inst: AnnuityInstallment; state: InstState }[] {
  const sorted = [...installments].sort((a, b) => a.seq - b.seq);
  const today = new Date().toISOString().slice(0, 10);
  let firstPendingSeen = false;
  return sorted.map((inst) => {
    if (inst.status === "paid") return { inst, state: "paga" as InstState };
    const overdue = !!inst.due_date && inst.due_date <= today;
    if (overdue) return { inst, state: "vencida" as InstState };
    if (!firstPendingSeen) { firstPendingSeen = true; return { inst, state: "a_vencer" as InstState }; }
    return { inst, state: "futura" as InstState };
  });
}

const INST_STATE_VIEW: Record<InstState, { label: string; color: string; bg: string; icon: string }> = {
  paga:      { label: "Paga",     color: P.ok,      bg: P.okWash,      icon: "checkmark-circle" },
  vencida:   { label: "Vencida",  color: P.danger,  bg: P.dangerWash,  icon: "warning" },
  a_vencer:  { label: "A vencer", color: P.warn,    bg: P.warnWash,    icon: "time" },
  futura:    { label: "Futura",   color: P.neutral, bg: P.neutralWash, icon: "ellipse-outline" },
};

function InstallmentPill({ inst, state, active, onPress }: { inst: AnnuityInstallment; state: InstState; active: boolean; onPress: () => void }) {
  const v = INST_STATE_VIEW[state];
  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: v.bg, borderColor: active ? P.red : "transparent" }]}
      onPress={(e) => { e.stopPropagation?.(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={`Parcela ${inst.seq}, ${monthAbbrOf(inst.due_date)}, ${v.label}`}
    >
      <Icon name={v.icon as any} size={10} color={v.color} />
      <Text style={[styles.pillText, { color: v.color }]}>{monthAbbrOf(inst.due_date)}</Text>
    </TouchableOpacity>
  );
}

// ── Painel expandido: detalhe de cada parcela + ações (pagar/pix/editar) ─
function InstallmentDetailRow({
  inst, state, onPay, onPix, onEdit, onSendEmail,
}: {
  inst: AnnuityInstallment; state: InstState;
  onPay: (instId: string, method: "pix" | "dinheiro" | "transferencia" | "outro") => Promise<void>;
  onPix: (instId: string, amount: number, label: string) => void;
  onEdit: (instId: string, body: { amount?: number; due_date?: string }) => Promise<void>;
  onSendEmail: (instId: string) => void;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [amountTxt, setAmountTxt] = useState(String(inst.amount).replace(".", ","));
  const [dueTxt, setDueTxt] = useState(formatIsoToBr(inst.due_date));

  const v = INST_STATE_VIEW[state];
  const isPending = inst.status !== "paid";

  const submitPay = async (method: "pix" | "dinheiro" | "transferencia" | "outro") => {
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
          <Icon name={v.icon as any} size={11} color={v.color} />
          <Text style={[styles.instBadgeText, { color: v.color }]}>{v.label}</Text>
        </View>
        <Body muted style={{ fontSize: 11.5, width: 78 }}>Parcela {inst.seq}</Body>
        <Body muted style={{ fontSize: 11.5, width: 96 }}>{inst.due_date ? formatIsoToBr(inst.due_date) : "Sem data"}</Body>
        <Mono style={{ fontSize: 12.5, width: 88 }}>{fmtMoney(inst.amount)}</Mono>
        {inst.status === "paid" ? (
          <Body muted style={{ fontSize: 11, flex: 1 }}>
            Pago em {inst.paid_at ? formatIsoToBr(inst.paid_at.slice(0, 10)) : "—"}
          </Body>
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
              style={styles.instActionBtn}
              onPress={() => onSendEmail(inst.id)}
              accessibilityRole="button"
              accessibilityLabel={`Enviar e-mail de cobrança da parcela ${inst.seq}`}
            >
              <Icon name="mail" size={12} color={C.ink} />
              <Text style={styles.instActionLabel}>E-mail</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isPending && payOpen && (
        <View style={styles.instSubPanel}>
          <Body muted style={{ fontSize: 11 }}>Forma de recebimento:</Body>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {(["pix", "dinheiro", "transferencia", "outro"] as const).map((m) => (
              <TouchableOpacity key={m} disabled={paying} style={styles.methodChip} onPress={() => submitPay(m)} accessibilityRole="button" accessibilityLabel={`Confirmar pagamento via ${m}`}>
                <Text style={styles.methodChipLabel}>{m === "pix" ? "PIX" : m === "dinheiro" ? "Dinheiro" : m === "transferencia" ? "Transferência" : "Outro"}</Text>
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
    </View>
  );
}

// ── Linha da tabela (dojô ou praticante) ─────────────────────────────
function AnnuityRowItem({
  vm, wide, selected, selectable, expanded, onToggleSelect, onToggleExpand,
  onPay, onPix, onEdit, onSendEmail, onVoid, onLaunch, voidConfirming, onVoidConfirm, onVoidCancel, voiding,
}: {
  vm: AnnuityRowVM; wide: boolean; selected: boolean; selectable: boolean; expanded: boolean;
  onToggleSelect: () => void; onToggleExpand: () => void;
  onPay: (instId: string, method: "pix" | "dinheiro" | "transferencia" | "outro") => Promise<void>;
  onPix: (instId: string, amount: number, label: string) => void;
  onEdit: (instId: string, body: { amount?: number; due_date?: string }) => Promise<void>;
  onSendEmail: (instId: string) => void;
  onVoid: () => void; onLaunch: () => void;
  voidConfirming: boolean; onVoidConfirm: () => void; onVoidCancel: () => void; voiding: boolean;
}) {
  const sv = annuityStatusView(vm.status);
  const isNoCharge = vm.status === "no_charge";
  const trail = classifyInstallments(vm.installments);

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

        <View style={{ flex: wide ? 2 : undefined, minWidth: wide ? undefined : 140, gap: 2 }}>
          <Text style={styles.name} numberOfLines={1}>{vm.name}</Text>
          <Mono style={{ fontSize: 10, color: P.red }}>{vm.code || "—"}</Mono>
        </View>

        {wide && (
          <View style={{ width: 100 }}>
            <Body muted style={{ fontSize: 12 }}>{vm.plan ? PLAN_LABEL[vm.plan] : "—"}</Body>
          </View>
        )}

        <View style={{ width: wide ? 220 : "100%", flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: wide ? 0 : 6 }}>
          {trail.length === 0 ? (
            <Body muted style={{ fontSize: 11 }}>Sem parcelas lançadas</Body>
          ) : (
            trail.map(({ inst, state }) => (
              <InstallmentPill key={inst.id} inst={inst} state={state} active={expanded} onPress={onToggleExpand} />
            ))
          )}
        </View>

        {wide && (
          <View style={{ width: 110, alignItems: "flex-end" }}>
            <Mono style={{ fontSize: 13, fontWeight: "700", color: C.ink }}>{fmtMoney(vm.total)}</Mono>
            {vm.paidTotal > 0 && vm.paidTotal < vm.total && (
              <Body muted style={{ fontSize: 10 }}>{fmtMoney(vm.paidTotal)} pago</Body>
            )}
          </View>
        )}

        <View style={{ width: wide ? 130 : undefined, alignItems: "flex-end", gap: 4 }}>
          <View style={[styles.badge, { backgroundColor: sv.bg }]} accessibilityLabel={sv.label}>
            <Icon name={sv.icon as any} size={11} color={sv.color} />
            <Text style={[styles.badgeText, { color: sv.color }]}>{sv.label}</Text>
          </View>
          {vm.daysOverdue > 0 && <Body muted style={{ fontSize: 10, color: P.red }}>{vm.daysOverdue}d em atraso</Body>}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isNoCharge ? (
            <TouchableOpacity style={styles.launchBtn} onPress={(e) => { e.stopPropagation?.(); onLaunch(); }} accessibilityRole="button" accessibilityLabel={`Lançar anuidade de ${vm.name}`}>
              <Icon name="add" size={13} color="#fff" />
              <Text style={styles.launchBtnLabel}>Lançar</Text>
            </TouchableOpacity>
          ) : (
            <>
              {vm.installments.length > 0 && (
                <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={C.ink4} />
              )}
              {vm.rowId && (
                <TouchableOpacity style={styles.iconBtnDanger} onPress={(e) => { e.stopPropagation?.(); onVoid(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover cobrança de ${vm.name}`}>
                  <Icon name="trash-outline" size={14} color={P.red} />
                </TouchableOpacity>
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
          {trail.map(({ inst, state }) => (
            <InstallmentDetailRow key={inst.id} inst={inst} state={state} onPay={onPay} onPix={onPix} onEdit={onEdit} onSendEmail={onSendEmail} />
          ))}
        </View>
      )}
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
  count, payableCount, noChargeCount, emailCount, onClear, onBulkPay, bulkPaying, onCopyMessage, onBulkLaunch, onBulkEmail, onBulkVoid,
}: {
  count: number; payableCount: number; noChargeCount: number; emailCount: number;
  onClear: () => void; onBulkPay: () => void; bulkPaying: boolean; onCopyMessage: () => void;
  onBulkLaunch: () => void; onBulkEmail: () => void; onBulkVoid: () => void;
}) {
  if (count === 0) return null;
  // Mockup (.floatbar): pílula ESCURA (ink) flutuante, sombra, cantos
  // arredondados — nunca uma barra clara edge-to-edge. Ordem dos botões
  // segue o mockup (Registrar pagamento → Enviar por e-mail → Copiar
  // mensagem), com "Lançar cobrança em lote" (aditivo da F3, sem
  // equivalente no mockup) por último. "Limpar seleção" é texto no canto
  // direito (mockup .clear), não um ícone X à esquerda.
  return (
    <View style={styles.bulkBar}>
      <Text style={styles.bulkCount}>{count} selecionado{count === 1 ? "" : "s"}</Text>
      {payableCount > 0 && (
        <TouchableOpacity style={styles.bulkBtn} onPress={onBulkPay} disabled={bulkPaying} accessibilityRole="button" accessibilityLabel="Registrar pagamento em lote">
          {bulkPaying ? <ActivityIndicator size="small" color={P.paperWarm} /> : <Icon name="checkmark" size={13} color={P.paperWarm} />}
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
            volta ao estado sem filtro. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Chip label="Todos" active={p.statusFilter === "all"} onPress={() => p.onStatusFilter("all")} />
          <Chip label="Pago" active={p.statusFilter === "paid"} onPress={() => p.onStatusFilter("paid")} />
          <Chip label="A vencer" active={p.statusFilter === "due"} onPress={() => p.onStatusFilter("due")} />
          <Chip label="Vencido" active={p.statusFilter === "overdue"} onPress={() => p.onStatusFilter("overdue")} />
          <Chip label="Inadimplente" active={p.statusFilter === "defaulting"} onPress={() => p.onStatusFilter("defaulting")} />
          <Chip label="Sem cobrança" active={p.statusFilter === "no_charge"} onPress={() => p.onStatusFilter("no_charge")} />
        </View>
        <Body muted style={{ fontSize: 11.5, marginBottom: 6 }}>{p.total} {p.total === 1 ? "registro" : "registros"} na temporada</Body>
        {p.showThead && (
          <View style={styles.thead}>
            <View style={{ width: 22 }} />
            <Text style={[styles.th, { flex: 2 }]}>{p.seg === "dojo" ? "Dojô" : "Praticante"}</Text>
            <Text style={[styles.th, { width: 100 }]}>Plano</Text>
            <Text style={[styles.th, { width: 220 }]}>Parcelas</Text>
            <Text style={[styles.th, { width: 110, textAlign: "right" }]}>Total</Text>
            <Text style={[styles.th, { width: 130, textAlign: "right" }]}>Status</Text>
            <View style={{ width: 40 }} />
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
  onMutated: () => void;
  headerElement: React.ReactNode;
}

export function AnnuitiesTable({ federationId, seg, year, statusFilter, onStatusFilterChange, onMutated, headerElement }: Props) {
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
  const [bulkPaying, setBulkPaying] = useState(false);
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

  // Volta pra página 1 sempre que o filtro/busca/segmento/ano muda; limpa
  // seleção (evita agir sobre linhas que já não estão na tela).
  useEffect(() => { setPage(1); setSelected(new Set()); setExpandedKey(null); }, [seg, year, statusFilter, debouncedQ]);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const params = { status: statusFilter, year, q: debouncedQ || undefined, page, pageSize: PAGE_SIZE };
      const res = seg === "dojo"
        ? await karateApi.listDojoAnnuities(federationId, params)
        : await karateApi.listCpfAnnuities(federationId, params);
      setItems(res.data.map((it) => toRowVM(seg, it)));
      setTotal(res.total);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, seg, year, statusFilter, debouncedQ, page]);
  useEffect(() => { load(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Ações de parcela ────────────────────────────────────────────
  const handlePayInstallment = useCallback(async (instId: string, method: "pix" | "dinheiro" | "transferencia" | "outro") => {
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
  // handleBulkPay acima) — cada ação olha só pro que faz sentido pra ela.
  const noChargeSelectedRows = useMemo(() => items.filter((i) => selected.has(i.key) && !i.rowId), [items, selected]);

  // Fase F4 — mesmo critério de "achar a parcela acionável" que
  // handleBulkPay já usa (vencida ou a_vencer): é a parcela que faz
  // sentido cobrar agora. Conta quantos dos selecionados TÊM essa parcela
  // (emailPayableCount, alimenta o botão da barra) sem precisar abrir o
  // modal — o modal em si recalcula na hora de montar os targets.
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
  // handleBulkPay, cada linha contribui com sua parcela vencida/a_vencer
  // (uma por linha; se não tiver nenhuma pendente, entra em noPendingCount
  // — informativo, não é erro, mostrado no modal antes de confirmar).
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
  // que tem cobrança (mesmo subconjunto de handleBulkPay). Não filtramos
  // paga/NFS-e aqui: o backend já pula (não erra) esses casos com motivo
  // claro (has_paid_installment / has_nfse) — filtrar client-side só
  // duplicaria essa regra e poderia ficar desatualizado.
  const handleOpenVoidBatch = useCallback(() => {
    const targets: VoidBatchTarget[] = selectedRows
      .filter((vm) => !!vm.rowId)
      .map((vm) => ({ annuityId: vm.rowId as string, name: vm.name, referencePeriod: vm.referencePeriod }));
    setVoidModalTargets(targets);
  }, [selectedRows]);

  const handleBulkPay = useCallback(async () => {
    if (selectedRows.length === 0) return;
    setBulkPaying(true);
    const results = await Promise.allSettled(selectedRows.map(async (vm) => {
      const pending = classifyInstallments(vm.installments).find((c) => c.state === "vencida" || c.state === "a_vencer");
      if (!pending) throw new Error(`${vm.name}: nenhuma parcela pendente`);
      await karateApi.payInstallment(federationId, pending.inst.id, { payment_method: "pix" });
      return vm.name;
    }));
    setBulkPaying(false);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    if (fail.length === 0) {
      toast.success(`${ok} pagamento(s) registrado(s)`);
    } else if (ok === 0) {
      toast.error(`Nenhum pagamento registrado — ${fail.length} falharam.`);
    } else {
      toast.warning(`${ok} pagos, ${fail.length} falharam (${fail.map((f) => f.reason?.message ?? "erro").slice(0, 3).join("; ")})`);
    }
    setSelected(new Set());
    load(true);
    onMutated();
  }, [selectedRows, federationId, load, onMutated]);

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
              wide={wide}
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
        onBulkPay={handleBulkPay}
        bulkPaying={bulkPaying}
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

  rowCard: { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 10 } as ViewStyle,
  rowMain: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 } as ViewStyle,

  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.line2, alignItems: "center", justifyContent: "center", backgroundColor: P.glass2 } as ViewStyle,
  checkboxOn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,

  name: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,

  pill: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: R.pill, borderWidth: 1.5 } as ViewStyle,
  pillText: { fontFamily: F.mono, fontSize: 10, fontWeight: "700" } as TextStyle,

  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: R.pill } as ViewStyle,
  badgeText: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,

  launchBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: P.ink, borderRadius: R.sm, paddingVertical: 6, paddingHorizontal: 10 } as ViewStyle,
  launchBtnLabel: { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,

  iconBtnDanger: { alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, borderWidth: 1, borderColor: P.dangerWash, backgroundColor: P.dangerWash } as ViewStyle,

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
