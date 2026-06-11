// ============================================================
// AURA. — Crediário · Modal de detalhe do cliente
//
// Fase 1 FE (07/06/2026):
//   - Exibe score_label + available_limit
//   - Banner de bloqueio (status === 'blocked')
//   - Lista de parcelas abertas
//   - Recebimento rápido (valor livre ou parcela específica)
//
// Fase 2 FE (08/06/2026 — PR #206):
//   - Preview de cobrança (juros/multa) na parcela atrasada
//   - valorAPagarParcela calculado com encargos
//   - editInstallmentDueDate corrigido
//
// Fase 3 FE (09/06/2026):
//   - Hero "Em aberto" em destaque
//   - Agrupamento carnê só se nomeado
//   - Histórico de pagamentos
//   - glitches null / Invalid Date corrigidos
//
// Design system: violeta #7c3aed / fundo #f5f3ff / neutros Ink
// ============================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import creditApi from "@/services/creditApi";
import Colors from "@/constants/Colors";

// ─── tipos locais ────────────────────────────────────────────
interface Installment {
  id: string;
  installment_number: number;
  due_date: string | null;
  amount: number;
  status: "open" | "paid" | "overdue" | "cancelled";
  paid_at?: string | null;
  paid_amount?: number | null;
  account_name?: string | null;
  // encargos (Fase 2)
  late_fee?: number | null;
  daily_interest?: number | null;
  grace_period_days?: number | null;
  total_with_charges?: number | null;
  days_overdue?: number | null;
}

interface Payment {
  id: string;
  paid_at: string;
  amount: number;
  installment_number?: number | null;
  note?: string | null;
}

interface CustomerProfile {
  customer_id: string;
  customer_name: string;
  score_label: "Excelente" | "Bom" | "Regular" | "Ruim" | "Novo";
  available_limit: number;
  used_limit: number;
  total_limit: number;
  status: "active" | "blocked" | "inactive";
  open_installments: number;
  overdue_installments: number;
  open_balance: number;
  overdue_balance: number;
  // extras Fase 3
  last_payment_at?: string | null;
  last_payment_amount?: number | null;
}

// ─── helpers ─────────────────────────────────────────────────
const fmtBRL = (v: number | null | undefined) => {
  const n = typeof v === "number" ? v : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    // aceita "YYYY-MM-DD" e ISO completo
    const [datePart] = iso.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    if (!y || !m || !d) return "—";
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
};

const isOverdue = (inst: Installment): boolean => {
  if (inst.status !== "open") return false;
  if (!inst.due_date) return false;
  try {
    const [datePart] = inst.due_date.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    if (!y || !m || !d) return false;
    const due = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  } catch {
    return false;
  }
};

const SCORE_COLOR: Record<string, string> = {
  Excelente: "#16a34a",
  Bom: "#2563eb",
  Regular: "#d97706",
  Ruim: "#dc2626",
  Novo: "#7c3aed",
};

// ─── sub-componentes ──────────────────────────────────────────

/** Chips de filtro de status */
function FilterChips({
  active,
  onChange,
}: {
  active: string;
  onChange: (v: string) => void;
}) {
  const opts = [
    { key: "open", label: "Em aberto" },
    { key: "overdue", label: "Atrasadas" },
    { key: "paid", label: "Pagas" },
    { key: "all", label: "Todas" },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 8 }}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}
    >
      {opts.map((o) => (
        <TouchableOpacity
          key={o.key}
          onPress={() => onChange(o.key)}
          style={[
            styles.chip,
            active === o.key && styles.chipActive,
          ]}
        >
          <Text
            style={[
              styles.chipText,
              active === o.key && styles.chipTextActive,
            ]}
          >
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

/** Card de uma parcela */
function InstallmentCard({
  inst,
  onReceive,
  chargesEnabled,
}: {
  inst: Installment;
  onReceive: (inst: Installment) => void;
  chargesEnabled: boolean;
}) {
  const overdue = isOverdue(inst);
  const paid = inst.status === "paid";
  const cancelled = inst.status === "cancelled";

  // valor a pagar com encargos (se habilitado e disponível)
  const totalWithCharges =
    chargesEnabled &&
    overdue &&
    typeof inst.total_with_charges === "number"
      ? inst.total_with_charges
      : null;

  const accountLabel = inst.account_name ? `[${inst.account_name}] ` : "";

  return (
    <View
      style={[
        styles.instCard,
        overdue && styles.instCardOverdue,
        paid && styles.instCardPaid,
        cancelled && styles.instCardCancelled,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.instLabel}>
          {accountLabel}Parcela {inst.installment_number}
          {inst.due_date ? ` · ${fmtDate(inst.due_date)}` : ""}
        </Text>

        {/* encargos breakdown (Fase 2) */}
        {chargesEnabled && overdue && inst.days_overdue != null && (
          <Text style={styles.instChargesNote}>
            {inst.days_overdue}d atraso
            {typeof inst.late_fee === "number" && inst.late_fee > 0
              ? ` · multa ${fmtBRL(inst.late_fee)}`
              : ""}
            {typeof inst.daily_interest === "number" &&
            inst.daily_interest > 0
              ? ` · juros ${fmtBRL(inst.daily_interest)}`
              : ""}
          </Text>
        )}

        <Text
          style={[
            styles.instAmount,
            overdue && styles.instAmountOverdue,
            paid && styles.instAmountPaid,
          ]}
        >
          {totalWithCharges != null
            ? fmtBRL(totalWithCharges)
            : fmtBRL(inst.amount)}
          {totalWithCharges != null && (
            <Text style={styles.instAmountBase}>
              {" "}
              (orig. {fmtBRL(inst.amount)})
            </Text>
          )}
        </Text>

        {paid && inst.paid_at && (
          <Text style={styles.instPaidAt}>
            Pago em {fmtDate(inst.paid_at)}
            {inst.paid_amount != null
              ? ` · ${fmtBRL(inst.paid_amount)}`
              : ""}
          </Text>
        )}
      </View>

      {!paid && !cancelled && (
        <TouchableOpacity
          style={styles.btnReceive}
          onPress={() => onReceive(inst)}
        >
          <Ionicons name="checkmark-circle" size={14} color="#fff" />
          <Text style={styles.btnReceiveText}>Receber</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Card de um pagamento no histórico */
function PaymentCard({ p }: { p: Payment }) {
  return (
    <View style={styles.paymentCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.paymentDate}>{fmtDate(p.paid_at)}</Text>
        {p.installment_number != null && (
          <Text style={styles.paymentNote}>
            Parcela {p.installment_number}
          </Text>
        )}
        {p.note ? (
          <Text style={styles.paymentNote}>{p.note}</Text>
        ) : null}
      </View>
      <Text style={styles.paymentAmount}>{fmtBRL(p.amount)}</Text>
    </View>
  );
}

// ─── modal principal ──────────────────────────────────────────
interface Props {
  visible: boolean;
  customerId: string;
  onClose: () => void;
}

export default function ClienteCrediarioModal({
  visible,
  customerId,
  onClose,
}: Props) {
  const { company } = useAuthStore();
  const companyId = company?.id ?? "";

  // perfil + parcelas + histórico
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // abas
  const [tab, setTab] = useState<"parcelas" | "historico">("parcelas");

  // filtro
  const [filter, setFilter] = useState<string>("open");

  // recebimento rápido
  const [receiveModal, setReceiveModal] = useState(false);
  const [receiveInst, setReceiveInst] = useState<Installment | null>(null);
  const [receiveValue, setReceiveValue] = useState("");
  const [receivePaidAt, setReceivePaidAt] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  });
  const [saving, setSaving] = useState(false);
  const receiveInputRef = useRef<TextInput>(null);

  // configurações de encargos
  const [chargesEnabled, setChargesEnabled] = useState(false);

  // ── carga ──────────────────────────────────────────────────
  const load = useCallback(
    async (silent = false) => {
      if (!companyId || !customerId) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [prof, insts, hist, config] = await Promise.all([
          creditApi.getCustomerProfile(companyId, customerId),
          creditApi.getInstallments(companyId, customerId),
          creditApi.getCustomerHistory(companyId, customerId),
          creditApi.getPlanConfig(companyId).catch(() => null),
        ]);
        setProfile(prof);
        setInstallments(Array.isArray(insts) ? insts : []);
        setPayments(Array.isArray(hist) ? hist : []);
        setChargesEnabled(
          !!(config as any)?.late_charges_enabled
        );
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar dados");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, customerId]
  );

  useEffect(() => {
    if (visible) {
      setTab("parcelas");
      setFilter("open");
      load();
    }
  }, [visible, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  // ── filtro de parcelas ─────────────────────────────────────
  const filteredInstallments = installments.filter((i) => {
    if (filter === "open") return i.status === "open" && !isOverdue(i);
    if (filter === "overdue") return isOverdue(i);
    if (filter === "paid") return i.status === "paid";
    return true; // "all"
  });

  // agrupamento por carnê (só se account_name preenchido)
  type Group = { name: string | null; items: Installment[] };
  const grouped: Group[] = [];
  filteredInstallments.forEach((inst) => {
    const key = inst.account_name || null;
    let g = grouped.find((x) => x.name === key);
    if (!g) {
      g = { name: key, items: [] };
      grouped.push(g);
    }
    g.items.push(inst);
  });

  // ── receber parcela ────────────────────────────────────────
  const openReceive = (inst: Installment) => {
    // valor sugerido: com encargos se habilitado
    const suggested =
      chargesEnabled &&
      isOverdue(inst) &&
      typeof inst.total_with_charges === "number"
        ? inst.total_with_charges
        : inst.amount;
    setReceiveInst(inst);
    setReceiveValue(suggested.toFixed(2).replace(".", ","));
    const d = new Date();
    setReceivePaidAt(
      `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()}`
    );
    setReceiveModal(true);
    setTimeout(() => receiveInputRef.current?.focus(), 200);
  };

  const confirmReceive = async () => {
    if (!receiveInst || !companyId) return;
    const raw = receiveValue.replace(",", ".");
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Valor inválido", "Informe um valor maior que zero.");
      return;
    }

    // parse paid_at dd/mm/aaaa → ISO
    let paidAtIso: string | undefined;
    if (receivePaidAt) {
      const parts = receivePaidAt.split("/");
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const dt = new Date(
          Number(yyyy),
          Number(mm) - 1,
          Number(dd),
          12,
          0,
          0
        );
        if (!isNaN(dt.getTime())) {
          paidAtIso = dt.toISOString();
        }
      }
    }

    setSaving(true);
    try {
      await creditApi.payInstallment(companyId, receiveInst.id, {
        amount,
        paid_at: paidAtIso,
      });
      setReceiveModal(false);
      setReceiveInst(null);
      await load(true);
    } catch (e: any) {
      Alert.alert(
        "Erro ao registrar",
        e?.message ?? "Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  };

  // ── render ─────────────────────────────────────────────────
  const scoreColor = profile
    ? (SCORE_COLOR[profile.score_label] ?? "#7c3aed")
    : "#7c3aed";

  // resumo do hero
  const totalOpen =
    profile?.open_balance != null ? profile.open_balance : 0;
  const totalOverdue =
    profile?.overdue_balance != null ? profile.overdue_balance : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* ── header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBack}>
          <Ionicons name="chevron-down" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile?.customer_name ?? "Ficha do cliente"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: "#f5f3ff" }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7c3aed"
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── loading / erro ── */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color="#7c3aed" size="large" />
          </View>
        )}
        {!loading && error && (
          <View style={styles.centered}>
            <Ionicons
              name="alert-circle-outline"
              size={40}
              color="#dc2626"
            />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && profile && (
          <>
            {/* ── banner bloqueio ── */}
            {profile.status === "blocked" && (
              <View style={styles.blockedBanner}>
                <Ionicons name="ban" size={16} color="#fff" />
                <Text style={styles.blockedText}>
                  Cliente bloqueado para novas compras no crediário
                </Text>
              </View>
            )}

            {/* ── hero saldo ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLabel}>Em aberto</Text>
                  <Text style={styles.heroValue}>{fmtBRL(totalOpen)}</Text>
                  {totalOverdue > 0 && (
                    <Text style={styles.heroOverdue}>
                      {fmtBRL(totalOverdue)} em atraso
                    </Text>
                  )}
                </View>
                <View style={styles.scoreChip}>
                  <Text
                    style={[styles.scoreText, { color: scoreColor }]}
                  >
                    {profile.score_label}
                  </Text>
                </View>
              </View>

              {/* barra de uso do limite */}
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>
                  Limite disponível:{" "}
                  <Text style={styles.limitValue}>
                    {fmtBRL(profile.available_limit)}
                  </Text>
                </Text>
                <Text style={styles.limitLabel}>
                  Total:{" "}
                  <Text style={styles.limitValue}>
                    {fmtBRL(profile.total_limit)}
                  </Text>
                </Text>
              </View>

              {profile.total_limit > 0 && (
                <View style={styles.limitBar}>
                  <View
                    style={[
                      styles.limitBarFill,
                      {
                        width: `${Math.min(
                          100,
                          (profile.used_limit / profile.total_limit) * 100
                        )}%` as any,
                        backgroundColor:
                          profile.used_limit / profile.total_limit > 0.8
                            ? "#dc2626"
                            : "#7c3aed",
                      },
                    ]}
                  />
                </View>
              )}

              {/* último pagamento */}
              {profile.last_payment_at && (
                <Text style={styles.lastPayment}>
                  Último pagamento:{" "}
                  {fmtDate(profile.last_payment_at)}
                  {profile.last_payment_amount != null
                    ? ` · ${fmtBRL(profile.last_payment_amount)}`
                    : ""}
                </Text>
              )}
            </View>

            {/* ── abas ── */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === "parcelas" && styles.tabActive]}
                onPress={() => setTab("parcelas")}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "parcelas" && styles.tabTextActive,
                  ]}
                >
                  Parcelas ({profile.open_installments})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  tab === "historico" && styles.tabActive,
                ]}
                onPress={() => setTab("historico")}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "historico" && styles.tabTextActive,
                  ]}
                >
                  Histórico ({payments.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── aba parcelas ── */}
            {tab === "parcelas" && (
              <View style={styles.section}>
                <FilterChips active={filter} onChange={setFilter} />

                {filteredInstallments.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons
                      name="checkmark-done-circle-outline"
                      size={32}
                      color="#7c3aed"
                    />
                    <Text style={styles.emptyText}>
                      Nenhuma parcela nesta categoria
                    </Text>
                  </View>
                ) : (
                  grouped.map((g, gi) => (
                    <View key={gi}>
                      {g.name && (
                        <Text style={styles.groupHeader}>{g.name}</Text>
                      )}
                      {g.items.map((inst) => (
                        <InstallmentCard
                          key={inst.id}
                          inst={inst}
                          onReceive={openReceive}
                          chargesEnabled={chargesEnabled}
                        />
                      ))}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ── aba histórico ── */}
            {tab === "historico" && (
              <View style={styles.section}>
                {payments.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons
                      name="receipt-outline"
                      size={32}
                      color="#7c3aed"
                    />
                    <Text style={styles.emptyText}>
                      Nenhum pagamento registrado
                    </Text>
                  </View>
                ) : (
                  payments.map((p) => (
                    <PaymentCard key={p.id} p={p} />
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── modal recebimento ── */}
      <Modal
        visible={receiveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiveModal(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setReceiveModal(false)}
        >
          <TouchableOpacity
            style={styles.receiveSheet}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={styles.receiveTitle}>
              Registrar recebimento
            </Text>
            {receiveInst && (
              <Text style={styles.receiveSubtitle}>
                Parcela {receiveInst.installment_number}
                {receiveInst.due_date
                  ? ` · venc. ${fmtDate(receiveInst.due_date)}`
                  : ""}
              </Text>
            )}

            <Text style={styles.fieldLabel}>Valor (R$)</Text>
            <TextInput
              ref={receiveInputRef}
              style={styles.valueInput}
              value={receiveValue}
              onChangeText={setReceiveValue}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholder="0,00"
            />

            <Text style={styles.fieldLabel}>Data do pagamento</Text>
            <TextInput
              style={styles.valueInput}
              value={receivePaidAt}
              onChangeText={setReceivePaidAt}
              placeholder="dd/mm/aaaa"
              keyboardType={
                Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"
              }
              maxLength={10}
            />

            <View style={styles.receiveActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setReceiveModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
                onPress={confirmReceive}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

// ─── estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  // header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ede9fe",
  },
  headerBack: { width: 40, alignItems: "flex-start" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: Colors.ink,
  },

  // estados
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorText: {
    marginTop: 8,
    color: "#dc2626",
    textAlign: "center",
    fontSize: 14,
  },
  retryBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: "#7c3aed",
    borderRadius: 8,
  },
  retryBtnText: { color: "#fff", fontWeight: "600" },

  // banner bloqueio
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  blockedText: { color: "#fff", fontSize: 13, fontWeight: "500" },

  // hero
  heroCard: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  heroLabel: { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  heroValue: { fontSize: 28, fontWeight: "700", color: Colors.ink },
  heroOverdue: { fontSize: 13, color: "#dc2626", marginTop: 2 },

  scoreChip: {
    borderWidth: 1,
    borderColor: "#ede9fe",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#f5f3ff",
  },
  scoreText: { fontSize: 13, fontWeight: "600" },

  limitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  limitLabel: { fontSize: 12, color: "#6b7280" },
  limitValue: { fontWeight: "600", color: Colors.ink },
  limitBar: {
    height: 6,
    backgroundColor: "#ede9fe",
    borderRadius: 3,
    overflow: "hidden",
  },
  limitBarFill: { height: 6, borderRadius: 3 },
  lastPayment: {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
  },

  // abas
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#7c3aed" },
  tabText: { fontSize: 13, fontWeight: "500", color: "#6b7280" },
  tabTextActive: { color: "#fff" },

  // seção
  section: { paddingHorizontal: 16 },
  groupHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7c3aed",
    marginTop: 8,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // chips
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ede9fe",
  },
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { fontSize: 12, color: "#6b7280" },
  chipTextActive: { color: "#fff", fontWeight: "600" },

  // parcelas
  instCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#7c3aed",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  instCardOverdue: { borderLeftColor: "#dc2626" },
  instCardPaid: { borderLeftColor: "#16a34a", opacity: 0.75 },
  instCardCancelled: { borderLeftColor: "#9ca3af", opacity: 0.5 },
  instLabel: { fontSize: 13, color: "#6b7280", marginBottom: 2 },
  instChargesNote: { fontSize: 11, color: "#dc2626", marginBottom: 2 },
  instAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.ink,
  },
  instAmountOverdue: { color: "#dc2626" },
  instAmountPaid: { color: "#16a34a" },
  instAmountBase: { fontSize: 12, fontWeight: "400", color: "#9ca3af" },
  instPaidAt: { fontSize: 11, color: "#6b7280", marginTop: 2 },

  btnReceive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7c3aed",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginLeft: 8,
  },
  btnReceiveText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // histórico
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  paymentDate: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  paymentNote: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  paymentAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16a34a",
  },

  // empty
  emptyBox: {
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  emptyText: { fontSize: 14, color: "#6b7280", textAlign: "center" },

  // modal recebimento
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  receiveSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  receiveTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: 4,
  },
  receiveSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  valueInput: {
    borderWidth: 1,
    borderColor: "#ede9fe",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: 16,
    backgroundColor: "#faf5ff",
  },
  receiveActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#7c3aed",
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
} as any);
