// ============================================================
// DojoAnnuitiesTab — Anuidades Dojô
//
// Lista de anuidades por dojô com status + filtros.
// Tabela de porte editável (up_to_40 / 41_90 / 91_150 / over_150).
// Cobrança via modal PIX (PixPaymentModal).
//
// Wired: GET /financial/annuities/dojos
//        POST /financial/annuities/dojos/{dojoId}/charge
//        POST /financial/annuities/dojos/{dojoId}/pix
//        GET /financial/fees  PUT /financial/fees (dados reais).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ViewStyle,
  TextStyle,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, ShojiPalette, KarateFonts } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { PixPaymentModal } from "@/components/karate/PixPaymentModal";
import {
  karateApi,
  DojoAnnuity,
  AnnuityStatus,
  AnnualFee,
  AnnualFeeInput,
  SizeTier,
} from "@/services/karateApi";

const STATUS_FILTER: { key: AnnuityStatus | "all"; label: string }[] = [
  { key: "all",        label: "Todos" },
  { key: "paid",       label: "Pago" },
  { key: "due",        label: "A vencer" },
  { key: "overdue",    label: "Vencido" },
  { key: "defaulting", label: "Inadimplente" },
];

const SIZE_TIER_LABELS: Record<SizeTier, string> = {
  up_to_40: "Até 40",
  "41_90":  "41–90",
  "91_150": "91–150",
  over_150: "Acima 150",
};

const ANNUITY_STATUS_MAP: Record<AnnuityStatus, { label: string; icon: string; color: string; bg: string }> = {
  paid:       { label: "Pago",         icon: "checkmark-circle", color: ShojiPalette.ok,     bg: ShojiPalette.okSoft },
  due:        { label: "A vencer",     icon: "time",             color: ShojiPalette.warn,   bg: ShojiPalette.warnSoft },
  overdue:    { label: "Vencido",      icon: "warning",          color: ShojiPalette.alert,  bg: ShojiPalette.alertSoft },
  defaulting: { label: "Inadimplente", icon: "close-circle",     color: ShojiPalette.danger, bg: ShojiPalette.dangerSoft },
  suspended:  { label: "Suspenso",     icon: "ban",              color: ShojiPalette.neutral,bg: ShojiPalette.neutralSoft },
};

function AnnuityStatusBadge({ status }: { status: AnnuityStatus }) {
  const s = ANNUITY_STATUS_MAP[status];
  return (
    <View
      style={[st.badge, { backgroundColor: s.bg }]}
      accessibilityLabel={s.label}
    >
      <Ionicons name={s.icon as any} size={11} color={s.color} />
      <Text style={[st.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props { federationId: string; }

export function DojoAnnuitiesTab({ federationId }: Props) {
  const [annuities, setAnnuities] = useState<DojoAnnuity[]>([]);
  const [fees, setFees]           = useState<AnnualFee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState<AnnuityStatus | "all">("all");
  const [showFeeEditor, setShowFeeEditor] = useState(false);
  const [feeEdits, setFeeEdits]   = useState<Record<string, string>>({});
  const [savingFees, setSavingFees] = useState(false);
  const [pixTarget, setPixTarget] = useState<DojoAnnuity | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const [annRes, feeRes] = await Promise.all([
        karateApi.listDojoAnnuities(federationId, { status: filter === "all" ? undefined : filter }),
        karateApi.getAnnualFees(federationId),
      ]);
      setAnnuities(annRes.data);
      setFees(feeRes);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, filter]);

  useEffect(() => { load(); }, [load]);

  if (error) return <KarateErrorState onRetry={() => load()} />;

  const filteredAnnuities = filter === "all"
    ? annuities
    : annuities.filter((a) => a.status === filter);

  // Fee editor helpers
  const getFeeEditValue = (fee: AnnualFee) =>
    feeEdits[fee.id] !== undefined ? feeEdits[fee.id] : String(fee.amount);

  const handleSaveFees = async () => {
    setSavingFees(true);
    try {
      const updatedFees: AnnualFeeInput[] = fees.map((f) => ({
        fee_type: f.fee_type,
        size_tier: f.size_tier,
        amount: parseFloat(feeEdits[f.id] ?? String(f.amount)) || f.amount,
      }));
      const today = new Date().toISOString().slice(0, 10);
      const result = await karateApi.updateAnnualFees(federationId, { effective_from: today, fees: updatedFees });
      setFees(result);
      setFeeEdits({});
      setShowFeeEditor(false);
    } catch (e: any) {
      Alert.alert("Não foi possível salvar a tabela", e?.message ?? "Tente novamente.");
    } finally {
      setSavingFees(false);
    }
  };

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />
      }
    >
      {/* Tabela de Anuidades (editável) */}
      <View style={st.sectionHeader}>
        <Text style={st.sectionTitle}>TABELA DE ANUIDADES</Text>
        <TouchableOpacity
          onPress={() => setShowFeeEditor((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showFeeEditor ? "Cancelar edição" : "Editar tabela"}
          style={st.editBtn}
        >
          <Ionicons name={showFeeEditor ? "close" : "create-outline"} size={16} color={KarateColors.primary} />
          <Text style={st.editBtnLabel}>{showFeeEditor ? "Cancelar" : "Editar"}</Text>
        </TouchableOpacity>
      </View>

      <View style={st.card}>
        {/* Dojô por porte */}
        {fees.filter((f) => f.fee_type === "dojo").map((fee) => (
          <View key={fee.id} style={st.feeRow}>
            <Text style={st.feeTier}>
              Dojô {fee.size_tier ? SIZE_TIER_LABELS[fee.size_tier as SizeTier] : ""} praticantes
            </Text>
            {showFeeEditor ? (
              <TextInput
                style={st.feeInput}
                value={getFeeEditValue(fee)}
                onChangeText={(v) => setFeeEdits((prev) => ({ ...prev, [fee.id]: v }))}
                keyboardType="decimal-pad"
                accessibilityLabel={`Valor anuidade ${fee.size_tier}`}
              />
            ) : (
              <Text style={st.feeAmount}>{formatCurrency(fee.amount)}</Text>
            )}
          </View>
        ))}
        {/* CPF */}
        {fees.filter((f) => f.fee_type === "cpf").map((fee) => (
          <View key={fee.id} style={[st.feeRow, { borderTopWidth: 1, borderTopColor: KarateColors.border, paddingTop: 8 }]}>
            <Text style={st.feeTier}>Anuidade CPF (por praticante)</Text>
            {showFeeEditor ? (
              <TextInput
                style={st.feeInput}
                value={getFeeEditValue(fee)}
                onChangeText={(v) => setFeeEdits((prev) => ({ ...prev, [fee.id]: v }))}
                keyboardType="decimal-pad"
                accessibilityLabel="Valor anuidade CPF"
              />
            ) : (
              <Text style={st.feeAmount}>{formatCurrency(fee.amount)}</Text>
            )}
          </View>
        ))}
        {showFeeEditor && (
          <KarateButton
            label="Salvar nova vigência"
            variant="primary"
            onPress={handleSaveFees}
            loading={savingFees}
            style={{ marginTop: 8 }}
          />
        )}
      </View>

      {/* Filtro de status */}
      <Text style={[st.sectionTitle, { marginTop: 16 }]}>COBRANÇAS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
      >
        {STATUS_FILTER.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[st.filterChip, filter === f.key && st.filterChipActive]}
            onPress={() => setFilter(f.key)}
            accessibilityRole="radio"
            accessibilityLabel={f.label}
            accessibilityState={{ checked: filter === f.key }}
          >
            <Text style={[st.filterChipLabel, filter === f.key && st.filterChipLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading ? (
        [1,2,3].map((k) => <Skeleton key={k} height={72} style={{ marginBottom: 8 }} />)
      ) : filteredAnnuities.length === 0 ? (
        <KarateEmptyState icon="document-text-outline" title="Sem cobranças neste filtro" />
      ) : (
        filteredAnnuities.map((ann) => (
          <View key={ann.dojo_id} style={st.annuityCard}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.annuityName}>{ann.dojo_name}</Text>
              <Text style={st.annuityMeta}>
                {ann.fpkt_affiliation_id}
              </Text>
              {ann.days_overdue > 0 && (
                <Text style={st.annuityOverdue}>
                  <Ionicons name="warning" size={11} color={KarateColors.danger} /> {ann.days_overdue}d em atraso
                </Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={st.annuityAmount}>{formatCurrency(ann.amount)}</Text>
              <AnnuityStatusBadge status={ann.status} />
              {(ann.status === "due" || ann.status === "overdue" || ann.status === "defaulting") && (
                <TouchableOpacity
                  style={st.pixBtn}
                  onPress={() => setPixTarget(ann)}
                  accessibilityRole="button"
                  accessibilityLabel={`Registrar pagamento PIX de ${ann.dojo_name}`}
                >
                  <Ionicons name="qr-code-outline" size={13} color="#fff" />
                  <Text style={st.pixBtnLabel}>Cobrar PIX</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}

      {/* PIX Payment Modal */}
      {pixTarget && pixTarget.annuity_history_id && (
        <PixPaymentModal
          visible={!!pixTarget}
          federationId={federationId}
          target={{
            dojoId: pixTarget.dojo_id,
            annuityHistoryId: pixTarget.annuity_history_id,
          }}
          amount={pixTarget.amount}
          description={`Anuidade ${pixTarget.reference_period} — ${pixTarget.dojo_name}`}
          isAdmin
          onSuccess={(_intentId) => {
            setPixTarget(null);
            load(true);
          }}
          onClose={() => setPixTarget(null)}
        />
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:      { padding: 16, gap: 8, paddingBottom: 40 } as ViewStyle,
  sectionHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 6 } as ViewStyle,
  sectionTitle: { fontSize: 11, fontWeight: "800", color: KarateColors.ink3, letterSpacing: 1.2, textTransform: "uppercase" } as TextStyle,
  card:         { backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 10 } as ViewStyle,

  editBtn:      { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 } as ViewStyle,
  editBtnLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  feeRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } as ViewStyle,
  feeTier:      { fontSize: 13, color: KarateColors.ink2, flex: 1 } as TextStyle,
  feeAmount:    { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  feeInput:     { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, fontWeight: "700", color: KarateColors.ink, minWidth: 90, textAlign: "right" } as TextStyle,

  filterChip:        { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  filterChipActive:  { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  filterChipLabel:   { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  filterChipLabelActive: { color: KarateColors.primary, fontWeight: "800" } as TextStyle,

  annuityCard:  { flexDirection: "row", backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8 } as ViewStyle,
  annuityName:  { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  annuityMeta:  { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  annuityOverdue: { fontSize: 11, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  annuityAmount:{ fontFamily: KarateFonts.mono, fontSize: 16, fontWeight: "700", color: KarateColors.ink } as TextStyle,

  pixBtn:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  pixBtnLabel:  { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,

  badge:        { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: KarateRadius.sm } as ViewStyle,
  badgeText:    { fontSize: 10, fontWeight: "700" } as TextStyle,
});
