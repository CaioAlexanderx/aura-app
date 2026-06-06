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
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const todayTs = new Date(todayStr).getTime();
  const dueTs = new Date(dueDate).getTime();
  return Math.max(0, Math.floor((todayTs - dueTs) / 86400000));
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

// ─── Modal de baixa de parcela ─────────────────────────────────
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
            {late > 0 ? ` · ${late}d em atraso` : ""}
          </Text>

          {late > 0 && (
            <View>
              <View style={pm.row}>
                <Text style={pm.rowLabel}>Valor original</Text>
                <Text style={pm.rowValue}>{fmt(remaining)}</Text>
              </View>
              {lateFee > 0 && (
                <View style={pm.row}>
                  <Text style={pm.rowLabel}>Multa ({config?.late_fee_rate}%)</Text>
                  <Text style={pm.rowValue}>{fmt(lateFee)}</Text>
                </View>
              )}
              {lateInterest > 0 && (
                <View style={pm.row}>
                  <Text style={pm.rowLabel}>Juros ({config?.late_interest_daily}%/dia × {late}d)</Text>
                  <Text style={pm.rowValue}>{fmt(lateInterest)}</Text>
                </View>
              )}
              <View style={pm.divider} />
            </View>
          )}

          <Text style={pm.inputLabel}>VALOR A RECEBER (R$)</Text>
          <TextInput
            style={pm.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />

          <Text style={[pm.inputLabel, { marginTop: 14 }]}>FORMA DE PAGAMENTO</Text>
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
              style={pm.confirmBtn}
              onPress={() => onConfirm(installment.id, parseAmt(), method)}
              disabled={isPending}
            >
              <Text style={pm.confirmBtnText}>
                {isPending ? "Registrando..." : "Confirmar Recebimento"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Modal de edição de termos por cliente ─────────────────────────────────
type TermsModalProps = {
  profile: any;
  config: any;
  onClose: () => void;
  onSave: (overrides: CustomerTermsOverrides) => void;
  isPending: boolean;
};

function TermsModal({ profile, config, onClose, onSave, isPending }: TermsModalProps) {
  const eff = profile?.terms?.effective ?? {};
  const [interestRate, setInterestRate]         = useState(String(eff.interest_rate ?? config?.interest_rate ?? "0"));
  const [maxInstallments, setMaxInstallments]   = useState(String(eff.max_installments ?? config?.max_installments ?? "12"));
  const [lateFeerate, setLateFeeRate]           = useState(String(eff.late_fee_rate ?? config?.late_fee_rate ?? "2"));
  const [lateInterestDaily, setLateInterestDaily] = useState(String(eff.late_interest_daily ?? config?.late_interest_daily ?? "0.033"));

  function save() {
    const build = (val: string, orig: number | undefined) => {
      const f = parseFloat(val.replace(",", "."));
      if (isNaN(f)) return null;
      if (orig !== undefined && Math.abs(f - orig) < 0.0001) return null;
      return f;
    };
    const overrides: CustomerTermsOverrides = {};
    const ir = build(interestRate, config?.interest_rate);
    if (ir !== null) overrides.interest_rate = ir;
    const mi = parseInt(maxInstallments);
    if (!isNaN(mi) && mi !== config?.max_installments) overrides.max_installments = mi;
    const lf = build(lateFeerate, config?.late_fee_rate);
    if (lf !== null) overrides.late_fee_rate = lf;
    const li = build(lateInterestDaily, config?.late_interest_daily);
    if (li !== null) overrides.late_interest_daily = li;
    onSave(overrides);
  }

  function clearOverrides() {
    onSave({
      interest_rate: null, max_installments: null,
      late_fee_rate: null, late_interest_daily: null,
    } as any);
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pm.backdrop} onPress={onClose}>
        <Pressable style={[pm.sheet, { maxWidth: 480 }]} onPress={() => {}}>
          <Text style={pm.title}>Condições Personalizadas</Text>
          <Text style={pm.subtitle}>
            Ajuste as condições para este cliente. Deixe igual ao padrão para usar as configurações da loja.
          </Text>

          {[
            { label: "Juros (%/parcela)", value: interestRate, onChange: setInterestRate },
            { label: "Máx. parcelas", value: maxInstallments, onChange: setMaxInstallments },
            { label: "Multa por atraso (%)", value: lateFeerate, onChange: setLateFeeRate },
            { label: "Juros diário (%)", value: lateInterestDaily, onChange: setLateInterestDaily },
          ].map(field => (
            <View key={field.label} style={{ marginBottom: 12 }}>
              <Text style={pm.inputLabel}>{field.label.toUpperCase()}</Text>
              <TextInput
                style={pm.input}
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </View>
          ))}

          <View style={pm.btnRow}>
            <Pressable style={pm.cancelBtn} onPress={clearOverrides}>
              <Text style={pm.cancelBtnText}>Limpar exceções</Text>
            </Pressable>
            <Pressable style={pm.confirmBtn} onPress={save} disabled={isPending}>
              <Text style={pm.confirmBtnText}>{isPending ? "Salvando..." : "Salvar"}</Text>
            </Pressable>
          </View>
          <Pressable onPress={onClose} style={{ alignItems: "center", marginTop: 12 }}>
            <Text style={{ fontSize: 12, color: Colors.ink3 }}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Tela principal ─────────────────────────────────────────────
export default function ClienteCrediarioScreen() {
  const { id: customerId } = useLocalSearchParams<{ id: string }>();
  const { companyId } = useAuthStore();
  const qc = useQueryClient();

  const [payingInst, setPayingInst]   = useState<CreditInstallment | null>(null);
  const [showTerms, setShowTerms]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllInst, setShowAllInst] = useState(false);

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["credit-profile", companyId, customerId],
    queryFn: () => creditApi.getCustomerProfile(companyId!, customerId!),
    enabled: !!companyId && !!customerId,
    staleTime: 30_000,
  });

  const payMut = useMutation({
    mutationFn: ({ id, amount, method }: { id: string; amount: number; method: string }) =>
      creditApi.payInstallment(companyId!, id, amount, method),
    onSuccess: () => {
      setPayingInst(null);
      toast.success("Recebimento registrado!");
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar pagamento"),
  });

  const termsMut = useMutation({
    mutationFn: (overrides: CustomerTermsOverrides) =>
      creditApi.updateCustomerTerms(companyId!, customerId!, overrides),
    onSuccess: () => {
      setShowTerms(false);
      toast.success("Condições atualizadas!");
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar condições"),
  });

  const blockMut = useMutation({
    mutationFn: ({ action, reason }: { action: "block" | "unblock"; reason?: string }) =>
      creditApi.blockCustomer(companyId!, customerId!, action, reason),
    onSuccess: (_, { action }) => {
      toast.success(action === "block" ? "Crédito bloqueado." : "Crédito desbloqueado.");
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao alterar bloqueio"),
  });

  const isBlocked = profile?.status === "blocked";
  const openInst  = (profile?.open_installments ?? []) as CreditInstallment[];
  const config    = profile?.config;
  const terms     = profile?.terms;

  const visibleInst = showAllInst ? openInst : openInst.slice(0, 5);

  if (isLoading) {
    return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={Colors.violet} />
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center", gap: 12 }]}>
        <Icon name="AlertCircle" size={32} color={Colors.red} />
        <Text style={{ color: Colors.ink3 }}>Erro ao carregar perfil do cliente.</Text>
        <Pressable onPress={() => refetch()} style={{ padding: 8 }}>
          <Text style={{ color: Colors.violet, fontWeight: "700" }}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  const trafficColor = TRAFFIC_LIGHT_COLORS[computeTrafficLight(profile.status, openInst)];
  const scoreLabel   = SCORE_LABEL_MAP[profile.label ?? "regular"] ?? "Regular";
  const scoreColor   = SCORE_COLORS[profile.label ?? "regular"] ?? Colors.amber;

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.violet} />}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Icon name="ChevronLeft" size={20} color={Colors.violet} />
            <Text style={s.backTxt}>Voltar</Text>
          </Pressable>
          <Text style={s.headerTitle}>Perfil de Crédito</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* ── Hero card ── */}
        <View style={s.heroCard}>
          <View style={s.heroRow}>
            <View style={[s.trafficDot, { backgroundColor: trafficColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.heroName}>{profile.customer_name || "Cliente"}</Text>
              <Text style={s.heroScore}>{scoreLabel}</Text>
            </View>
            <View style={s.heroRight}>
              <Text style={s.heroScoreNum}>{profile.credit_score ?? profile.score ?? 500}</Text>
              <Text style={s.heroScoreLabel}>pontos</Text>
            </View>
          </View>

          {/* KPI strip */}
          <View style={s.kpiRow}>
            <View style={s.kpiCell}>
              <Text style={s.kpiVal}>{fmt(profile.credit_limit ?? 0)}</Text>
              <Text style={s.kpiLbl}>Limite</Text>
            </View>
            <View style={s.kpiDiv} />
            <View style={s.kpiCell}>
              <Text style={[s.kpiVal, { color: Colors.violet }]}>{fmt(profile.credit_used ?? 0)}</Text>
              <Text style={s.kpiLbl}>Em aberto</Text>
            </View>
            <View style={s.kpiDiv} />
            <View style={s.kpiCell}>
              <Text style={[s.kpiVal, { color: Colors.green }]}>
                {fmt(Math.max(0, (profile.credit_limit ?? 0) - (profile.credit_used ?? 0)))}
              </Text>
              <Text style={s.kpiLbl}>Disponível</Text>
            </View>
          </View>

          {isBlocked && (
            <View style={s.blockedBanner}>
              <Icon name="Lock" size={14} color={Colors.red} />
              <Text style={s.blockedText}>
                Crédito suspenso{profile.blocked_reason ? `: ${profile.blocked_reason}` : ""}
              </Text>
            </View>
          )}
        </View>

        {/* ── Condições vigentes ── */}
        {terms && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Condições de Crédito</Text>
              <Pressable onPress={() => setShowTerms(true)} style={s.editBtn}>
                <Icon name="Settings2" size={13} color={Colors.violet} />
                <Text style={s.editBtnTxt}>Personalizar</Text>
              </Pressable>
            </View>
            <View style={s.termsGrid}>
              {[
                { label: "Juros/parcela", value: `${((terms.effective?.interest_rate ?? 0) * 100).toFixed(1)}%` },
                { label: "Máx. parcelas", value: String(terms.effective?.max_installments ?? config?.max_installments ?? 12) },
                { label: "Multa atraso", value: `${terms.effective?.late_fee_rate ?? config?.late_fee_rate ?? 2}%` },
                { label: "Juros diário", value: `${terms.effective?.late_interest_daily ?? config?.late_interest_daily ?? 0.033}%` },
              ].map(({ label, value }) => (
                <View key={label} style={s.termCell}>
                  <Text style={s.termVal}>{value}</Text>
                  <Text style={s.termLbl}>{label}</Text>
                </View>
              ))}
            </View>
            {terms.overrides && Object.keys(terms.overrides).length > 0 && (
              <View style={s.customBadge}>
                <Icon name="Star" size={11} color={Colors.violet} />
                <Text style={s.customBadgeTxt}>Condições personalizadas ativas</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Parcelas abertas ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Parcelas em Aberto</Text>
            {openInst.length > 5 && (
              <Pressable onPress={() => setShowAllInst(v => !v)}>
                <Text style={s.seeAll}>{showAllInst ? "Ver menos" : `Ver todas (${openInst.length})`}</Text>
              </Pressable>
            )}
          </View>

          {openInst.length === 0 ? (
            <View style={s.emptyInstallments}>
              <Icon name="CheckCircle2" size={16} color={Colors.green} />
              <Text style={s.emptyInstallmentsText}>Nenhuma parcela em aberto</Text>
            </View>
          ) : (
            visibleInst.map(inst => {
                  const late = inst.status === "overdue" ? daysLate(inst.due_date) : 0;
                  const isOverdue = inst.status === "overdue" && daysLate(inst.due_date) > 0;
                  const remaining = installmentRemaining(inst);
                  return (
                    <View key={inst.id} style={s.installmentRow}>
                      <View style={s.installmentLeft}>
                        <Text style={s.installmentTitle}>
                          <Text style={s.installmentAmount}>{fmt(remaining)}</Text>
                          {" "}· {inst.installment_number}/{inst.total_installments}
                        </Text>
                        <Text style={s.installmentDate}>
                          Vence {fmtDate(inst.due_date)}
                        </Text>
                      </View>
                      <View style={s.installmentRight}>
                        <View style={s.installmentActions}>
                          <View style={[
                            s.statusBadge,
                            { borderColor: isOverdue ? Colors.red : Colors.green,
                              backgroundColor: isOverdue ? Colors.redD : Colors.greenD }
                          ]}>
                            <Text style={[
                              s.statusBadgeText,
                              { color: isOverdue ? Colors.red : Colors.green }
                            ]}>
                              {isOverdue ? `Atrasada ${late}d` : "No prazo"}
                            </Text>
                          </View>
                          {isOverdue && (
                            <Pressable
                              style={s.waBtn}
                              onPress={() => {
                                const phone = profile.phone ? phoneToWa(profile.phone) : null;
                                if (!phone) return toast.error("Cliente sem telefone cadastrado.");
                                const msg = encodeURIComponent(
                                  `Olá! Sua parcela ${inst.installment_number}/${inst.total_installments} de ${fmt(remaining)} está ${late}d em atraso. Regularize o quanto antes.`
                                );
                                Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
                              }}
                            >
                              <Text style={s.waBtnText}>WA</Text>
                            </Pressable>
                          )}
                        </View>
                        <Pressable
                          style={s.receiveBtn}
                          onPress={() => setPayingInst(inst)}
                        >
                          <Text style={s.receiveBtnText}>Receber</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
          )}
        </View>

        {/* ── Histórico de transações ── */}
        <View style={[s.card, { marginBottom: 100 }]}>
          <Pressable style={s.historyToggleRow} onPress={() => setShowHistory(v => !v)}>
            <Text style={s.cardTitle}>Histórico de Pagamentos</Text>
            <Icon name={showHistory ? "ChevronUp" : "ChevronDown"} size={16} color={Colors.ink3} />
          </Pressable>
          {showHistory && <HistorySection companyId={companyId!} customerId={customerId!} />}
        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={s.footer}>
        <Pressable
          style={[s.footerBtn, { backgroundColor: isBlocked ? Colors.green : Colors.red }]}
          onPress={() => {
            if (isBlocked) {
              blockMut.mutate({ action: "unblock" });
            } else {
              blockMut.mutate({ action: "block", reason: "Inadimplência" });
            }
          }}
          disabled={blockMut.isPending}
        >
          <Icon name={isBlocked ? "Unlock" : "Lock"} size={16} color="#fff" />
          <Text style={s.footerBtnText}>
            {blockMut.isPending
              ? "Aguarde..."
              : isBlocked
              ? "Desbloquear Crédito"
              : "Bloquear Crédito"}
          </Text>
        </Pressable>
      </View>

      {/* ── Modais ── */}
      {payingInst && (
        <PayInstallmentModal
          installment={payingInst}
          config={config}
          onClose={() => setPayingInst(null)}
          onConfirm={(id, amount, method) => payMut.mutate({ id, amount, method })}
          isPending={payMut.isPending}
        />
      )}
      {showTerms && (
        <TermsModal
          profile={profile}
          config={config}
          onClose={() => setShowTerms(false)}
          onSave={(overrides) => termsMut.mutate(overrides)}
          isPending={termsMut.isPending}
        />
      )}
    </View>
  );
}

// ─── HistorySection ─────────────────────────────────────────────
function HistorySection({ companyId, customerId }: { companyId: string; customerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["credit-history", companyId, customerId],
    queryFn: () => creditApi.getCustomerTransactions(companyId, customerId),
    staleTime: 60_000,
  });

  if (isLoading) return <ActivityIndicator color={Colors.violet} style={{ marginTop: 8 }} />;
  if (!data?.length) return <Text style={s.historyEmpty}>Nenhum pagamento registrado.</Text>;

  return (
    <>
      {data.map((tx: any) => (
        <View key={tx.id} style={s.txRow}>
          <View style={[s.txIconBox, { backgroundColor: tx.amount > 0 ? Colors.greenD : Colors.redD }]}>
            <Icon name={tx.amount > 0 ? "ArrowDownLeft" : "ArrowUpRight"} size={14}
              color={tx.amount > 0 ? Colors.green : Colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.txLabel}>{tx.description || (tx.amount > 0 ? "Recebimento" : "Lançamento")}</Text>
            <Text style={s.txDate}>{fmtDateFull(tx.created_at)}</Text>
          </View>
          <Text style={[s.txAmount, { color: tx.amount > 0 ? Colors.green : Colors.red }]}>
            {tx.amount > 0 ? "+" : ""}{fmt(tx.amount)}
          </Text>
        </View>
      ))}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16, paddingTop: Platform.OS === "ios" ? 8 : 4,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  backTxt: { fontSize: 14, color: Colors.violet, fontWeight: "600" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: Colors.ink },

  heroCard: {
    backgroundColor: Colors.bg3, borderRadius: 18,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
    ...(Platform.OS === "web" ? { boxShadow: "0 2px 12px rgba(0,0,0,0.07)" } as any : {}),
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  trafficDot: { width: 12, height: 12, borderRadius: 6 },
  heroName: { fontSize: 17, fontWeight: "800", color: Colors.ink },
  heroScore: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  heroRight: { alignItems: "center" },
  heroScoreNum: { fontSize: 24, fontWeight: "900", color: Colors.violet },
  heroScoreLabel: { fontSize: 10, color: Colors.ink3 },

  kpiRow: { flexDirection: "row", alignItems: "center" },
  kpiCell: { flex: 1, alignItems: "center" },
  kpiDiv: { width: 1, height: 28, backgroundColor: Colors.border },
  kpiVal: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  kpiLbl: { fontSize: 10, color: Colors.ink3, marginTop: 2 },

  blockedBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.redD, borderRadius: 8, padding: 8, marginTop: 12,
    borderWidth: 1, borderColor: Colors.red + "33",
  },
  blockedText: { fontSize: 12, color: Colors.red, fontWeight: "600" },

  card: {
    backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  editBtnTxt: { fontSize: 12, color: Colors.violet, fontWeight: "600" },
  seeAll: { fontSize: 12, color: Colors.violet, fontWeight: "600" },

  termsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  termCell: {
    flex: 1, minWidth: "40%", backgroundColor: Colors.bg4, borderRadius: 10,
    padding: 10, alignItems: "center",
  },
  termVal: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  termLbl: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  customBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8,
    backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: "flex-start",
  },
  customBadgeTxt: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },

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
