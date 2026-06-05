import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Modal, TextInput, RefreshControl,
  Platform, Dimensions, Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditApi } from "@/services/creditApi";
import { toast } from "@/components/Toast";
import type { CreditInstallment, CustomerTermsOverrides } from "@/services/creditApi";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 720;

var fmt = function(n: number) {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

var fmtDate = function(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit",
    });
  } catch { return ""; }
};

var fmtDateFull = function(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return ""; }
};

var daysLate = function(dueDate: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000));
};

function phoneToWa(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : "55" + digits;
}

function installmentRemaining(inst: CreditInstallment): number {
  const covered = Number(inst.covered_amount ?? inst.amount_paid ?? 0);
  return Math.max(0, Number(inst.amount_due) - covered);
}

const SCORE_LABEL_MAP: Record<string, string> = {
  premium: "Histórico: excelente",
  bom: "Histórico: bom",
  regular: "Histórico: regular",
  restrito: "Histórico: restrito",
  bloqueado: "Bloqueado",
};

const SCORE_COLORS: Record<string, string> = {
  premium: Colors.green,
  bom: "#34d399",
  regular: Colors.amber,
  restrito: "#f97316",
  bloqueado: Colors.red,
};

const PAYMENT_METHODS = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "cartao", label: "Cartão" },
];

function computeTrafficLight(status: string, installments: CreditInstallment[]) {
  if (status === "blocked") return "red";
  const overdue = installments.filter(i => i.status === "overdue");
  if (overdue.length === 0) return "green";
  const critical = overdue.some(i => daysLate(i.due_date) > 30);
  return critical ? "red" : "yellow";
}

const TRAFFIC_LIGHT_COLORS: Record<string, string> = {
  green: Colors.green,
  yellow: Colors.amber,
  red: Colors.red,
};

// ─── Modal de baixa de parcela ─────────────────────────────
type PayModalProps = {
  installment: CreditInstallment;
  config?: { interest_rate: number; late_fee_rate: number; late_interest_daily: number };
  onClose: () => void;
  onConfirm: (id: string, amount: number, method: string) => void;
  isPending: boolean;
};

function PayInstallmentModal({ installment, config, onClose, onConfirm, isPending }: PayModalProps) {
  const remaining = installmentRemaining(installment);
  const late = installment.status === "overdue" ? daysLate(installment.due_date) : 0;
  const lateFee = late > 0 && config ? remaining * (config.late_fee_rate / 100) : 0;
  const lateInterest = late > 0 && config ? remaining * (config.late_interest_daily / 100) * late : 0;
  const suggested = remaining + lateFee + lateInterest;

  const [amount, setAmount] = useState(suggested.toFixed(2).replace(".", ","));
  const [method, setMethod] = useState("pix");

  function parseAmt() {
    return parseFloat(amount.replace(/\./g, "").replace(",", ".")) || suggested;
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pm.backdrop} onPress={onClose}>
        <Pressable style={pm.sheet} onPress={() => {}}>
          <Text style={pm.title}>
            Parcela {installment.installment_number}/{installment.total_installments}
          </Text>
          <Text style={pm.subtitle}>
            Venceu em {fmtDateFull(installment.due_date)}
            {late > 0 ? ` · ${late} dias de atraso` : ""}
          </Text>

          <View style={pm.row}>
            <Text style={pm.rowLabel}>Saldo descoberto</Text>
            <Text style={pm.rowValue}>{fmt(remaining)}</Text>
          </View>
          {lateFee > 0 && (
            <View style={pm.row}>
              <Text style={pm.rowLabel}>Multa ({config?.late_fee_rate}%)</Text>
              <Text style={[pm.rowValue, { color: Colors.red }]}>+ {fmt(lateFee)}</Text>
            </View>
          )}
          {lateInterest > 0 && (
            <View style={pm.row}>
              <Text style={pm.rowLabel}>Juros ({config?.late_interest_daily}%/dia × {late}d)</Text>
              <Text style={[pm.rowValue, { color: Colors.red }]}>+ {fmt(lateInterest)}</Text>
            </View>
          )}

          <View style={pm.divider} />

          <Text style={pm.inputLabel}>Valor a receber (R$)</Text>
          <TextInput
            style={pm.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
            placeholderTextColor={Colors.ink3}
          />

          <Text style={[pm.inputLabel, { marginTop: 14 }]}>Forma de pagamento</Text>
          <View style={pm.methodRow}>
            {PAYMENT_METHODS.map(m => (
              <Pressable
                key={m.key}
                style={[pm.methodPill, method === m.key && pm.methodPillActive]}
                onPress={() => setMethod(m.key)}
              >
                <Text style={[pm.methodPillText, method === m.key && pm.methodPillTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={pm.btnRow}>
            <Pressable style={pm.cancelBtn} onPress={onClose}>
              <Text style={pm.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[pm.confirmBtn, isPending && { opacity: 0.6 }]}
              onPress={() => onConfirm(installment.id, parseAmt(), method)}
              disabled={isPending}
            >
              {isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={pm.confirmBtnText}>Confirmar recebimento</Text>
              }
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Modal de pagamento avulso (saldo fiado) ───────────────────
type FiadoPayModalProps = {
  onClose: () => void;
  onConfirm: (amount: number, method: string) => void;
  isPending: boolean;
};

function FiadoPayModal({ onClose, onConfirm, isPending }: FiadoPayModalProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("pix");

  function parseAmt() {
    return parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0;
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pm.backdrop} onPress={onClose}>
        <Pressable style={pm.sheet} onPress={() => {}}>
          <Text style={pm.title}>Registrar recebimento</Text>
          <Text style={pm.subtitle}>Abatimento manual no saldo do cliente (valor livre)</Text>

          <Text style={pm.inputLabel}>Valor (R$)</Text>
          <TextInput
            style={pm.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={Colors.ink3}
            selectTextOnFocus
          />

          <Text style={[pm.inputLabel, { marginTop: 14 }]}>Forma de pagamento</Text>
          <View style={pm.methodRow}>
            {PAYMENT_METHODS.map(m => (
              <Pressable
                key={m.key}
                style={[pm.methodPill, method === m.key && pm.methodPillActive]}
                onPress={() => setMethod(m.key)}
              >
                <Text style={[pm.methodPillText, method === m.key && pm.methodPillTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={pm.btnRow}>
            <Pressable style={pm.cancelBtn} onPress={onClose}>
              <Text style={pm.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[pm.confirmBtn, (isPending || !parseAmt()) && { opacity: 0.5 }]}
              onPress={() => onConfirm(parseAmt(), method)}
              disabled={isPending || !parseAmt()}
            >
              {isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={pm.confirmBtnText}>Registrar</Text>
              }
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Modal de bloquear/desbloquear ──────────────────────────
type BlockModalProps = {
  isBlocked: boolean;
  onClose: () => void;
  onConfirm: (action: "block" | "unblock", reason?: string) => void;
  isPending: boolean;
};

function BlockModal({ isBlocked, onClose, onConfirm, isPending }: BlockModalProps) {
  const [reason, setReason] = useState("");
  const action: "block" | "unblock" = isBlocked ? "unblock" : "block";

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pm.backdrop} onPress={onClose}>
        <Pressable style={pm.sheet} onPress={() => {}}>
          <Text style={pm.title}>
            {isBlocked ? "Desbloquear cliente" : "Bloquear cliente"}
          </Text>
          <Text style={pm.subtitle}>
            {isBlocked
              ? "O cliente voltará a ter crédito disponível."
              : "O cliente não poderá fazer novas compras no crediário."}
          </Text>
          {!isBlocked && (
            <>
              <Text style={pm.inputLabel}>Motivo (opcional)</Text>
              <TextInput
                style={[pm.input, { height: 72, textAlignVertical: "top" }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Ex: parcelas em atraso há mais de 30 dias"
                placeholderTextColor={Colors.ink3}
                multiline
              />
            </>
          )}
          <View style={pm.btnRow}>
            <Pressable style={pm.cancelBtn} onPress={onClose}>
              <Text style={pm.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[pm.confirmBtn, isPending && { opacity: 0.6 }, !isBlocked && { backgroundColor: Colors.red }]}
              onPress={() => onConfirm(action, reason || undefined)}
              disabled={isPending}
            >
              {isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={pm.confirmBtnText}>{isBlocked ? "Desbloquear" : "Bloquear"}</Text>
              }
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── F2: Card "Condições deste cliente" ────────────────────────
// Campos editaveis: cada um opt-in (vazio = usa padrão da loja).
// Mostra discretamente o valor "efetivo" quando override vazio.
type TermsCardProps = {
  companyId: string;
  customerId: string;
};

type PeriodKind = "semanal" | "quinzenal" | "mensal" | "custom";

function periodKindFromOverride(unit: string | null, count: number | null): PeriodKind {
  if (!unit) return "mensal";
  if (unit === "week" && count === 1) return "semanal";
  if (unit === "week" && count === 2) return "quinzenal";
  if (unit === "month") return "mensal";
  return "custom";
}

function TermsCard({ companyId, customerId }: TermsCardProps) {
  const qc = useQueryClient();
  const profileQ = useQuery({
    queryKey: ["credit-profile", companyId, customerId],
    queryFn: () => creditApi.getCustomerProfile(companyId, customerId),
    enabled: !!companyId && !!customerId,
    staleTime: 30_000,
  });

  const terms = profileQ.data?.terms;
  const ov = terms?.overrides;
  const ef = terms?.effective;

  // Local edit state
  const [editing, setEditing] = useState(false);
  const [interestRate, setInterestRate] = useState("");
  const [maxInstallments, setMaxInstallments] = useState("");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("mensal");
  const [periodDays, setPeriodDays] = useState("20");
  const [dueDay, setDueDay] = useState("");
  const [lateFeeRate, setLateFeeRate] = useState("");
  const [lateInterestDaily, setLateInterestDaily] = useState("");

  function startEdit() {
    if (!ov) return;
    setInterestRate(ov.interest_rate != null ? String((ov.interest_rate * 100).toFixed(2)) : "");
    setMaxInstallments(ov.max_installments != null ? String(ov.max_installments) : "");
    setPeriodKind(periodKindFromOverride(ov.period_unit, ov.period_count));
    setPeriodDays(ov.period_count != null && ov.period_unit === "day" ? String(ov.period_count) : "20");
    setDueDay(ov.due_day != null ? String(ov.due_day) : "");
    setLateFeeRate(ov.late_fee_rate != null ? String((ov.late_fee_rate * 100).toFixed(2)) : "");
    setLateInterestDaily(ov.late_interest_daily != null ? String((ov.late_interest_daily * 100).toFixed(4)) : "");
    setEditing(true);
  }

  const termsMut = useMutation({
    mutationFn: (body: Partial<CustomerTermsOverrides>) =>
      creditApi.updateCustomerTerms(companyId, customerId, body),
    onSuccess: () => {
      toast.success("Condições atualizadas!");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao salvar condições"),
  });

  function handleSave() {
    function parseOptFloat(v: string): number | null {
      const n = parseFloat(v.replace(",", "."));
      return v.trim() === "" ? null : isFinite(n) ? n / 100 : null;
    }
    function parseOptInt(v: string): number | null {
      const n = parseInt(v, 10);
      return v.trim() === "" ? null : isFinite(n) ? n : null;
    }
    let periodUnit: "day" | "week" | "month" | null = null;
    let periodCount: number | null = null;
    if (periodKind === "semanal") { periodUnit = "week"; periodCount = 1; }
    else if (periodKind === "quinzenal") { periodUnit = "week"; periodCount = 2; }
    else if (periodKind === "mensal") { periodUnit = "month"; periodCount = 1; }
    else if (periodKind === "custom") {
      periodUnit = "day";
      const d = parseInt(periodDays, 10);
      periodCount = isFinite(d) && d > 0 ? d : null;
    }

    const body: Partial<CustomerTermsOverrides> = {
      interest_rate: parseOptFloat(interestRate),
      max_installments: parseOptInt(maxInstallments),
      period_unit: periodUnit,
      period_count: periodCount,
      due_day: parseOptInt(dueDay),
      late_fee_rate: parseOptFloat(lateFeeRate),
      late_interest_daily: parseOptFloat(lateInterestDaily),
    };
    termsMut.mutate(body);
  }

  const PERIOD_OPTS: Array<[PeriodKind, string]> = [
    ["semanal", "Semanal"],
    ["quinzenal", "Quinzenal"],
    ["mensal", "Mensal"],
    ["custom", "Personalizado"],
  ];

  if (!terms && !profileQ.isLoading) return null; // backend ainda nao suporta terms

  return (
    <View style={s.sectionCard}>
      <View style={[s.sectionTitleRow]}>
        <Text style={s.sectionTitle}>Condições deste cliente</Text>
        {!editing && (
          <Pressable style={s.editBtn} onPress={startEdit}>
            <Icon name="edit" size={13} color={Colors.violet3} />
            <Text style={s.editBtnTxt}>Editar</Text>
          </Pressable>
        )}
      </View>

      {profileQ.isLoading && <ActivityIndicator color={Colors.violet3} style={{ marginVertical: 8 }} />}

      {!editing && ov && ef && (
        <View style={s.termsGrid}>
          {([
            ["Juros ao mês", ov.interest_rate != null ? `${(ov.interest_rate * 100).toFixed(2)}%` : null, ef.interest_rate != null ? `${(ef.interest_rate * 100).toFixed(2)}%` : null],
            ["Prazo máximo", ov.max_installments != null ? `${ov.max_installments}x` : null, ef.max_installments != null ? `${ef.max_installments}x` : null],
            ["Dia de vencimento", ov.due_day != null ? `Dia ${ov.due_day}` : null, ef.due_day != null ? `Dia ${ef.due_day}` : null],
            ["Multa", ov.late_fee_rate != null ? `${(ov.late_fee_rate * 100).toFixed(2)}%` : null, ef.late_fee_rate != null ? `${(ef.late_fee_rate * 100).toFixed(2)}%` : null],
            ["Juros de mora/dia", ov.late_interest_daily != null ? `${(ov.late_interest_daily * 100).toFixed(4)}%` : null, ef.late_interest_daily != null ? `${(ef.late_interest_daily * 100).toFixed(4)}%` : null],
          ] as [string, string | null, string | null][]).map(([label, override, effective]) => (
            <View key={label} style={s.termsRow}>
              <Text style={s.termsLabel}>{label}</Text>
              {override != null
                ? <Text style={s.termsValue}>{override}</Text>
                : <Text style={s.termsValueDefault}>{effective ?? —""} <Text style={s.termsValueDefaultHint}>(padrão)</Text></Text>
              }
            </View>
          ))}
        </View>
      )}

      {!editing && !ov && !profileQ.isLoading && (
        <Text style={s.termsHint}>Todas as condições seguem o padrão da loja. Toque em Editar para personalizar.</Text>
      )}

      {editing && (
        <View style={s.termsEditForm}>
          {/* Juros ao mês */}
          <View style={s.termsField}>
            <Text style={s.termsFieldLabel}>Juros ao mês % <Text style={s.termsFieldHint}>(vazio = padrão {ef?.interest_rate != null ? `${(ef.interest_rate * 100).toFixed(2)}%` : ""})</Text></Text>
            <TextInput
              style={s.termsInput}
              value={interestRate}
              onChangeText={setInterestRate}
              placeholder="Ex: 2,50"
              placeholderTextColor={Colors.ink3}
              keyboardType="decimal-pad"
            />
          </View>
          {/* Prazo máximo */}
          <View style={s.termsField}>
            <Text style={s.termsFieldLabel}>Prazo máximo (parcelas) <Text style={s.termsFieldHint}>(vazio = padrão {ef?.max_installments ?? ""}x)</Text></Text>
            <TextInput
              style={s.termsInput}
              value={maxInstallments}
              onChangeText={v => setMaxInstallments(v.replace(/\D/g, ""))}
              placeholder="Ex: 12"
              placeholderTextColor={Colors.ink3}
              keyboardType="numeric"
            />
          </View>
          {/* Periodicidade */}
          <Text style={s.termsFieldLabel}>Periodicidade <Text style={s.termsFieldHint}>(vazio = padrão loja)</Text></Text>
          <View style={s.termsPeriodChips}>
            {PERIOD_OPTS.map(([k, lbl]) => (
              <Pressable
                key={k}
                onPress={() => setPeriodKind(k)}
                style={[s.termsPeriodChip, periodKind === k && s.termsPeriodChipOn]}
              >
                <Text style={[s.termsPeriodChipTxt, periodKind === k && s.termsPeriodChipTxtOn]}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
          {periodKind === "custom" && (
            <View style={s.termsCustomDaysRow}>
              <Text style={s.termsCustomDaysLbl}>A cada</Text>
              <TextInput
                style={s.termsCustomDaysInput}
                value={periodDays}
                keyboardType="numeric"
                onChangeText={v => setPeriodDays(v.replace(/\D/g, "").slice(0, 3))}
              />
              <Text style={s.termsCustomDaysLbl}>dias</Text>
            </View>
          )}
          {/* Dia de vencimento */}
          <View style={s.termsField}>
            <Text style={s.termsFieldLabel}>Dia de vencimento (1-31) <Text style={s.termsFieldHint}>(vazio = padrão)</Text></Text>
            <TextInput
              style={s.termsInput}
              value={dueDay}
              onChangeText={v => setDueDay(v.replace(/\D/g, "").slice(0, 2))}
              placeholder="Ex: 10"
              placeholderTextColor={Colors.ink3}
              keyboardType="numeric"
            />
          </View>
          {/* Multa */}
          <View style={s.termsField}>
            <Text style={s.termsFieldLabel}>Multa % <Text style={s.termsFieldHint}>(vazio = padrão {ef?.late_fee_rate != null ? `${(ef.late_fee_rate * 100).toFixed(2)}%` : ""})</Text></Text>
            <TextInput
              style={s.termsInput}
              value={lateFeeRate}
              onChangeText={setLateFeeRate}
              placeholder="Ex: 2,00"
              placeholderTextColor={Colors.ink3}
              keyboardType="decimal-pad"
            />
          </View>
          {/* Juros de mora */}
          <View style={s.termsField}>
            <Text style={s.termsFieldLabel}>Juros de mora %/dia <Text style={s.termsFieldHint}>(vazio = padrão {ef?.late_interest_daily != null ? `${(ef.late_interest_daily * 100).toFixed(4)}%` : ""})</Text></Text>
            <TextInput
              style={s.termsInput}
              value={lateInterestDaily}
              onChangeText={setLateInterestDaily}
              placeholder="Ex: 0,0333"
              placeholderTextColor={Colors.ink3}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={s.termsBtnRow}>
            <Pressable style={s.termsCancelBtn} onPress={() => setEditing(false)}>
              <Text style={s.termsCancelBtnTxt}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[s.termsSaveBtn, termsMut.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={termsMut.isPending}
            >
              {termsMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.termsSaveBtnTxt}>Salvar condições</Text>
              }
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Tela principal ─────────────────────────────────────────
export default function CrediarioClienteScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { company } = useAuthStore();
  const qc = useQueryClient();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [payingInstallment, setPayingInstallment] = useState<CreditInstallment | null>(null);
  const [showFiadoPay, setShowFiadoPay] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const profileQ = useQuery({
    queryKey: ["credit-profile", company?.id, id],
    queryFn: () => creditApi.getCustomerProfile(company!.id, id),
    enabled: !!company?.id && !!id,
    staleTime: 30_000,
  });

  const historyQ = useQuery({
    queryKey: ["credit-history", company?.id, id],
    queryFn: () => creditApi.getCustomerHistory(company!.id, id),
    enabled: !!company?.id && !!id,
    staleTime: 30_000,
  });

  const payMut = useMutation({
    mutationFn: ({ iid, amount, method }: { iid: string; amount: number; method: string }) =>
      creditApi.payInstallment(company!.id, iid, { amount_paid: amount, payment_method: method }),
    onSuccess: () => {
      toast.success("Parcela recebida!");
      setPayingInstallment(null);
      qc.invalidateQueries({ queryKey: ["credit-profile", company?.id, id] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard"] });
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao dar baixa na parcela"),
  });

  const fiadoMut = useMutation({
    mutationFn: ({ amount, method }: { amount: number; method: string }) =>
      creditApi.receivePayment(company!.id, id, { amount, payment_method: method }),
    onSuccess: () => {
      toast.success("Recebimento registrado!");
      setShowFiadoPay(false);
      qc.invalidateQueries({ queryKey: ["credit-history", company?.id, id] });
      qc.invalidateQueries({ queryKey: ["credit-profile", company?.id, id] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard"] });
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao registrar recebimento"),
  });

  const blockMut = useMutation({
    mutationFn: ({ action, reason }: { action: "block" | "unblock"; reason?: string }) =>
      creditApi.blockCustomer(company!.id, id, action, reason),
    onSuccess: (data) => {
      toast.success(data.status === "blocked" ? "Cliente bloqueado" : "Cliente desbloqueado");
      setShowBlockModal(false);
      qc.invalidateQueries({ queryKey: ["credit-profile", company?.id, id] });
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao alterar status"),
  });

  const collectMut = useMutation({
    mutationFn: (installmentId: string) =>
      creditApi.triggerCollection(company!.id, installmentId),
    onSuccess: (data) => {
      const phone55 = phoneToWa(data.phone);
      const url = `https://wa.me/${phone55}?text=${encodeURIComponent(data.message)}`;
      Linking.openURL(url).catch(() =>
        toast.error("Não foi possível abrir o WhatsApp")
      );
      toast.success("WhatsApp aberto para cobrança");
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao gerar cobrança"),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["credit-profile", company?.id, id] }),
      qc.invalidateQueries({ queryKey: ["credit-history", company?.id, id] }),
    ]);
    setRefreshing(false);
  }, [company?.id, id]);

  const profile = profileQ.data;
  const history = historyQ.data;
  const openInstallments = profile?.open_installments?.filter(i => i.status !== "paid" && i.status !== "cancelled") || [];
  const overdueInstallments = openInstallments.filter(i => i.status === "overdue");
  const isBlocked = profile?.status === "blocked";
  const trafficLight = profile ? computeTrafficLight(profile.status, openInstallments) : "green";
  const trafficColor = TRAFFIC_LIGHT_COLORS[trafficLight];
  const scoreLabel = profile?.label ? (SCORE_LABEL_MAP[profile.label] || profile.label) : null;
  const scoreLabelColor = profile?.label ? (SCORE_COLORS[profile.label] || Colors.ink3) : Colors.ink3;
  const totalOpenInstallmentsAmount = openInstallments.reduce(
    (sum, i) => sum + installmentRemaining(i), 0
  );
  const isLoading = profileQ.isLoading;

  return (
    <>
      <ScrollView
        style={s.screen}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.violet3} />
        }
      >
        {/* Header */}
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Icon name="chevron_right" size={16} color={Colors.violet3} style={{ transform: [{ rotate: "180deg" }] } as any} />
            <Text style={s.backText}>Crediário</Text>
          </Pressable>

          <View style={{ position: "relative" }}>
            <Pressable style={s.menuBtn} onPress={() => setMenuOpen(v => !v)}>
              <Icon name="more" size={18} color={Colors.ink3} />
            </Pressable>
            {menuOpen && (
              <Pressable
                style={s.menuDropdown}
                onPress={() => {
                  setMenuOpen(false);
                  setShowBlockModal(true);
                }}
              >
                <Icon name={isBlocked ? "check" : "alert"} size={14} color={isBlocked ? Colors.green : Colors.red} />
                <Text style={[s.menuItemText, { color: isBlocked ? Colors.green : Colors.red }]}>
                  {isBlocked ? "Desbloquear cliente" : "Bloquear cliente"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Identidade */}
        <View style={s.clientHeader}>
          <View style={s.clientAvatarBox}>
            <Text style={s.clientAvatarText}>
              {(name || "?")[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.clientName} numberOfLines={1}>{name || "Cliente"}</Text>
            <View style={s.trafficRow}>
              <View style={[s.trafficDot, { backgroundColor: trafficColor }]} />
              <Text style={[s.trafficLabel, { color: trafficColor }]}>
                {trafficLight === "green" && "Em dia"}
                {trafficLight === "yellow" && "Parcela(s) em atraso"}
                {trafficLight === "red" && (isBlocked ? "Bloqueado" : "Inadimplência crítica")}
              </Text>
              {isBlocked && profile?.blocked_reason && (
                <Text style={s.blockedReason} numberOfLines={1}> · {profile.blocked_reason}</Text>
              )}
            </View>
          </View>
        </View>

        {isLoading && (
          <View style={s.loadingBox}>
            <ActivityIndicator color={Colors.violet3} size="large" />
            <Text style={s.loadingText}>Carregando perfil...</Text>
          </View>
        )}

        {!isLoading && profile && (
          <>
            {/* Resumo */}
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Resumo</Text>

              {history && (
                <View style={s.resumeRow}>
                  <View style={s.resumeLeft}>
                    <Text style={s.resumeLabel}>Saldo devedor (fiado)</Text>
                    <Text style={s.resumeMeta}>Ledger acumulado</Text>
                  </View>
                  <Text style={[s.resumeValue, history.balance > 0 && { color: Colors.red }]}>
                    {fmt(history.balance)}
                  </Text>
                </View>
              )}

              <View style={[s.resumeRow, { marginTop: history ? 12 : 0 }]}>
                <View style={s.resumeLeft}>
                  <Text style={s.resumeLabel}>Parcelas abertas</Text>
                  <Text style={s.resumeMeta}>
                    {openInstallments.length} parcela{openInstallments.length !== 1 ? "s" : ""}
                    {overdueInstallments.length > 0 && (
                      ` · ${overdueInstallments.length} vencida${overdueInstallments.length !== 1 ? "s" : ""}`
                    )}
                  </Text>
                </View>
                <Text style={[s.resumeValue, totalOpenInstallmentsAmount > 0 && { color: Colors.amber }]}>
                  {fmt(totalOpenInstallmentsAmount)}
                </Text>
              </View>

              {scoreLabel && (
                <View style={[s.scoreBadge, { backgroundColor: scoreLabelColor + "18", borderColor: scoreLabelColor + "44" }]}>
                  <View style={[s.scoreDot, { backgroundColor: scoreLabelColor }]} />
                  <Text style={[s.scoreBadgeText, { color: scoreLabelColor }]}>{scoreLabel}</Text>
                </View>
              )}
            </View>

            {/* F2: Condições do cliente */}
            {company?.id && id && (
              <TermsCard companyId={company.id} customerId={id} />
            )}

            {/* Parcelas em aberto */}
            {openInstallments.length > 0 && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>Parcelas em aberto</Text>
                {openInstallments.map((inst) => {
                  const remaining = installmentRemaining(inst);
                  const late = inst.status === "overdue" ? daysLate(inst.due_date) : 0;
                  const isOverdue = inst.status === "overdue";
                  const isCollecting = collectMut.isPending && collectMut.variables === inst.id;
                  const hasPartialCoverage = Number(inst.covered_amount) > 0 && remaining < Number(inst.amount_due);
                  return (
                    <View key={inst.id} style={s.installmentRow}>
                      <View style={s.installmentLeft}>
                        <Text style={s.installmentTitle}>
                          Parcela {inst.installment_number}/{inst.total_installments}
                          {" · "}
                          <Text style={s.installmentAmount}>{fmt(remaining)}</Text>
                          {hasPartialCoverage && (
                            <Text style={{ color: Colors.ink3, fontSize: 10 }}>
                              {" "}({fmt(Number(inst.amount_due))} total)
                            </Text>
                          )}
                        </Text>
                        <Text style={s.installmentDate}>Vence {fmtDate(inst.due_date)}</Text>
                      </View>
                      <View style={s.installmentRight}>
                        <View style={[
                          s.statusBadge,
                          isOverdue
                            ? { backgroundColor: Colors.red + "18", borderColor: Colors.red + "44" }
                            : { backgroundColor: Colors.green + "18", borderColor: Colors.green + "44" }
                        ]}>
                          <Text style={[
                            s.statusBadgeText,
                            { color: isOverdue ? Colors.red : Colors.green }
                          ]}>
                            {isOverdue ? `Atrasada ${late}d` : "No prazo"}
                          </Text>
                        </View>
                        <View style={s.installmentActions}>
                          {isOverdue && (
                            <Pressable
                              style={[s.waBtn, isCollecting && { opacity: 0.6 }]}
                              onPress={() => collectMut.mutate(inst.id)}
                              disabled={collectMut.isPending}
                            >
                              {isCollecting
                                ? <ActivityIndicator color="#fff" size="small" style={{ width: 14, height: 14 }} />
                                : <Text style={s.waBtnText}>WhatsApp</Text>
                              }
                            </Pressable>
                          )}
                          <Pressable
                            style={s.receiveBtn}
                            onPress={() => setPayingInstallment(inst)}
                          >
                            <Text style={s.receiveBtnText}>Receber</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {openInstallments.length === 0 && (
              <View style={s.emptyInstallments}>
                <Icon name="check" size={22} color={Colors.green} />
                <Text style={s.emptyInstallmentsText}>Nenhuma parcela em aberto</Text>
              </View>
            )}

            {/* Histórico (colapsável) */}
            {history && (
              <View style={s.sectionCard}>
                <Pressable
                  style={s.historyToggleRow}
                  onPress={() => setHistoryOpen(v => !v)}
                >
                  <Text style={s.sectionTitle}>Histórico (fiado legado)</Text>
                  <Icon
                    name="chevron_right"
                    size={14}
                    color={Colors.ink3}
                    style={{ transform: [{ rotate: historyOpen ? "270deg" : "90deg" }] } as any}
                  />
                </Pressable>

                {historyOpen && (
                  <>
                    {history.transactions.length === 0 && (
                      <Text style={s.historyEmpty}>Nenhuma transação registrada.</Text>
                    )}
                    {history.transactions.map((tx) => {
                      const isDebit = tx.type === "debit";
                      return (
                        <View key={tx.id} style={s.txRow}>
                          <View style={[s.txIconBox, { backgroundColor: isDebit ? Colors.red + "18" : Colors.green + "18" }]}>
                            <Icon
                              name={isDebit ? "arrow_down" : "arrow_up"}
                              size={12}
                              color={isDebit ? Colors.red : Colors.green}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.txLabel}>
                              {isDebit ? "Venda fiado" : "Pagamento"}
                              {tx.notes ? ` — ${tx.notes}` : ""}
                            </Text>
                            <Text style={s.txDate}>{fmtDateFull(tx.created_at)}</Text>
                          </View>
                          <Text style={[s.txAmount, { color: isDebit ? Colors.red : Colors.green }]}>
                            {isDebit ? "-" : "+"}{fmt(tx.amount)}
                          </Text>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Rodapé fixo */}
      {!isLoading && (
        <View style={s.footer}>
          <Pressable
            style={s.footerBtn}
            onPress={() => setShowFiadoPay(true)}
          >
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.footerBtnText}>Registrar recebimento</Text>
          </Pressable>
        </View>
      )}

      {menuOpen && (
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => setMenuOpen(false)}
        />
      )}

      {payingInstallment && (
        <PayInstallmentModal
          installment={payingInstallment}
          config={profile?.config}
          onClose={() => setPayingInstallment(null)}
          onConfirm={(iid, amount, method) => payMut.mutate({ iid, amount, method })}
          isPending={payMut.isPending}
        />
      )}

      {showFiadoPay && (
        <FiadoPayModal
          onClose={() => setShowFiadoPay(false)}
          onConfirm={(amount, method) => fiadoMut.mutate({ amount, method })}
          isPending={fiadoMut.isPending}
        />
      )}

      {showBlockModal && profile && (
        <BlockModal
          isBlocked={isBlocked}
          onClose={() => setShowBlockModal(false)}
          onConfirm={(action, reason) => blockMut.mutate({ action, reason })}
          isPending={blockMut.isPending}
        />
      )}
    </>
  );
}

// ─── Estilos ─────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: IS_WIDE ? 32 : 16, paddingBottom: 24, maxWidth: 720, alignSelf: "center", width: "100%" },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  menuBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  menuDropdown: {
    position: "absolute", top: 40, right: 0, zIndex: 999,
    backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", gap: 8,
    minWidth: 180,
    ...(Platform.OS === "web" ? { boxShadow: "0 4px 20px rgba(0,0,0,0.18)" } as any : {}),
  },
  menuItemText: { fontSize: 13, fontWeight: "600" },

  clientHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  clientAvatarBox: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
  },
  clientAvatarText: { fontSize: 22, fontWeight: "800", color: Colors.violet3 },
  clientName: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.3, marginBottom: 4 },
  trafficRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  trafficDot: { width: 8, height: 8, borderRadius: 4 },
  trafficLabel: { fontSize: 12, fontWeight: "600" },
  blockedReason: { fontSize: 11, color: Colors.ink3 },

  loadingBox: { paddingVertical: 60, alignItems: "center", gap: 16 },
  loadingText: { fontSize: 13, color: Colors.ink3 },

  sectionCard: {
    backgroundColor: Colors.bg3, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: {
    fontSize: 10, fontWeight: "800", color: Colors.ink3,
    letterSpacing: 0.8, textTransform: "uppercase",
  },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  editBtnTxt: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },

  // Resumo
  resumeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resumeLeft: { flex: 1 },
  resumeLabel: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  resumeMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  resumeValue: { fontSize: 18, fontWeight: "800", color: Colors.ink, letterSpacing: -0.3 },
  scoreBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 14, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, alignSelf: "flex-start",
  },
  scoreDot: { width: 7, height: 7, borderRadius: 3.5 },
  scoreBadgeText: { fontSize: 11.5, fontWeight: "700" },

  // F2: Termos
  termsGrid: { gap: 10 },
  termsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  termsLabel: { fontSize: 12, color: Colors.ink3 },
  termsValue: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  termsValueDefault: { fontSize: 12, color: Colors.ink3 },
  termsValueDefaultHint: { fontSize: 11, color: Colors.ink3 },
  termsHint: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  termsEditForm: { gap: 0 },
  termsField: { marginTop: 12 },
  termsFieldLabel: { fontSize: 11, fontWeight: "600", color: Colors.ink2, marginBottom: 5 },
  termsFieldHint: { fontWeight: "400", color: Colors.ink3 },
  termsInput: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: Colors.ink,
    backgroundColor: Colors.bg2,
  },
  termsPeriodChips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 6 },
  termsPeriodChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  termsPeriodChipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  termsPeriodChipTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  termsPeriodChipTxtOn: { color: "#fff" },
  termsCustomDaysRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, padding: 9 },
  termsCustomDaysLbl: { fontSize: 13, color: Colors.ink2, fontWeight: "600" },
  termsCustomDaysInput: { width: 55, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 7, paddingVertical: 6, textAlign: "center", color: Colors.ink, fontWeight: "800", fontSize: 13 },
  termsBtnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  termsCancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  termsCancelBtnTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  termsSaveBtn: { flex: 2, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center" },
  termsSaveBtnTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Parcelas
  installmentRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  installmentLeft: { flex: 1 },
  installmentTitle: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  installmentAmount: { fontWeight: "700" },
  installmentDate: { fontSize: 11, color: Colors.ink3, marginTop: 3 },
  installmentRight: { alignItems: "flex-end", gap: 6 },
  installmentActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: "700" },
  receiveBtn: {
    backgroundColor: Colors.violet, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  receiveBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  waBtn: {
    backgroundColor: "#25D366", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    minWidth: 36, alignItems: "center", justifyContent: "center",
  },
  waBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  emptyInstallments: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.greenD, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.green + "33", marginBottom: 14,
  },
  emptyInstallmentsText: { fontSize: 13, color: Colors.green, fontWeight: "600" },

  historyToggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 0,
  },
  historyEmpty: { fontSize: 12, color: Colors.ink3, marginTop: 4 },
  txRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  txIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  txLabel: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  txDate: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: "700" },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16,
    backgroundColor: Colors.bg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  footerBtn: {
    backgroundColor: Colors.violet, borderRadius: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14,
  },
  footerBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

const pm = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  sheet: {
    width: "100%", maxWidth: 460,
    backgroundColor: Colors.bg3, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: Colors.border,
    ...(Platform.OS === "web" ? { boxShadow: "0 8px 32px rgba(0,0,0,0.28)" } as any : {}),
  },
  title: { fontSize: 17, fontWeight: "800", color: Colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 12, color: Colors.ink3, marginBottom: 16, lineHeight: 17 },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  rowLabel: { fontSize: 12, color: Colors.ink3 },
  rowValue: { fontSize: 13, fontWeight: "600", color: Colors.ink },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },

  inputLabel: { fontSize: 11, fontWeight: "700", color: Colors.ink3, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: Colors.ink,
  },

  methodRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  methodPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4,
  },
  methodPillActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  methodPillText: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },
  methodPillTextActive: { color: Colors.violet3 },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  cancelBtnText: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  confirmBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.violet, alignItems: "center",
  },
  confirmBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
