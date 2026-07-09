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
//
// Fix (busca/foco) — MESMA causa raiz do PR #309 (praticantes) e do Fix 12
//   da lista de dojôs: o campo de busca precisa viver FORA de qualquer header
//   de lista que seja reconciliado/remontado a cada render, senão o TextInput
//   é desmontado e perde o foco a cada tecla. Aqui a lista de cobranças é um
//   `.map()` dentro de um ScrollView, então o SearchField fica como um bloco
//   PERSISTENTE no corpo da tela (acima da lista), com `onChangeText` estável
//   e o filtro derivado por `useMemo` (combina status + texto: nome do dojô e
//   código FPKT). NÃO altera o endpoint nem a lógica de dados — só a busca.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, ShojiPalette, KarateFonts } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { PixPaymentModal } from "@/components/karate/PixPaymentModal";
import { WhatsAppChargeModal } from "@/components/karate/WhatsAppChargeModal";
import { LancarAnuidadeDojoModal } from "@/components/karate/LancarAnuidadeDojoModal";
import { SearchField } from "@/components/karate/shoji";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";
import { downloadCsv } from "./EntriesTab";
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
  { key: "no_charge",  label: "Sem cobrança" },
];

const SIZE_TIER_LABELS: Record<SizeTier, string> = {
  up_to_40: "Até 40",
  "41_90":  "41–90",
  "91_150": "91–150",
  over_150: "Acima 150",
};

const ANNUITY_STATUS_MAP: Partial<Record<AnnuityStatus, { label: string; icon: string; color: string; bg: string }>> = {
  paid:       { label: "Pago",         icon: "checkmark-circle", color: ShojiPalette.ok,     bg: ShojiPalette.okSoft },
  due:        { label: "A vencer",     icon: "time",             color: ShojiPalette.warn,   bg: ShojiPalette.warnSoft },
  overdue:    { label: "Vencido",      icon: "warning",          color: ShojiPalette.alert,  bg: ShojiPalette.alertSoft },
  defaulting: { label: "Inadimplente", icon: "close-circle",     color: ShojiPalette.danger, bg: ShojiPalette.dangerSoft },
  suspended:  { label: "Suspenso",     icon: "ban",              color: ShojiPalette.neutral,bg: ShojiPalette.neutralSoft },
  no_charge:  { label: "Sem cobrança", icon: "remove-circle-outline", color: ShojiPalette.neutral, bg: ShojiPalette.neutralSoft },
};

// Fallback neutro para qualquer status fora do ANNUITY_STATUS_MAP — evita que
// um status desconhecido (ex.: novo valor do enum ainda não mapeado aqui)
// derrube a linha inteira do card (Cannot read properties of undefined
// (reading 'bg')), o que blanqueava a lista inteira em vez de só o badge.
// Mesmo padrão defensivo do `sm()` em AnuidadeCard.tsx.
const ANNUITY_STATUS_FALLBACK = { label: "\u2014", icon: "help-circle", color: ShojiPalette.neutral, bg: ShojiPalette.neutralSoft };
function annuityStatusMeta(status: string) {
  return ANNUITY_STATUS_MAP[status as AnnuityStatus] || { ...ANNUITY_STATUS_FALLBACK, label: status || "\u2014" };
}

function AnnuityStatusBadge({ status }: { status: AnnuityStatus }) {
  const s = annuityStatusMeta(status);
  return (
    <View
      style={[st.badge, { backgroundColor: s.bg }]}
      accessibilityLabel={s.label}
    >
      <Icon name={s.icon as any} size={11} color={s.color} />
      <Text style={[st.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_CSV_LABEL: Partial<Record<AnnuityStatus, string>> = {
  paid: "Pago", due: "A vencer", overdue: "Vencido", defaulting: "Inadimplente", suspended: "Suspenso", no_charge: "Sem cobrança",
};

interface Props { federationId: string; }

export function DojoAnnuitiesTab({ federationId }: Props) {
  const [annuities, setAnnuities] = useState<DojoAnnuity[]>([]);
  const [fees, setFees]           = useState<AnnualFee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState<AnnuityStatus | "all">("all");
  const [q, setQ]                 = useState("");
  const [showFeeEditor, setShowFeeEditor] = useState(false);
  const [feeEdits, setFeeEdits]   = useState<Record<string, string>>({});
  const [savingFees, setSavingFees] = useState(false);
  const [pixTarget, setPixTarget] = useState<DojoAnnuity | null>(null);
  const [waTarget, setWaTarget] = useState<DojoAnnuity | null>(null);
  const [chargeTarget, setChargeTarget] = useState<DojoAnnuity | null>(null);
  const [editTarget, setEditTarget] = useState<DojoAnnuity | null>(null);

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

  // Handler estável da busca — evita recriar a função a cada render, o que
  // (junto do campo viver fora de qualquer header de lista remontável) garante
  // que o TextInput não perca o foco entre teclas.
  const handleSearch = useCallback((t: string) => setQ(t), []);

  if (error) return <KarateErrorState onRetry={() => load()} />;

  // Filtro derivado (status × texto), client-side. NÃO toca no endpoint:
  // o status já vai no fetch; aqui só refinamos por nome do dojô / código FPKT.
  const filteredAnnuities = useMemo(() => {
    const byStatus = filter === "all"
      ? annuities
      : annuities.filter((a) => a.status === filter);
    const needle = q.trim().toLowerCase();
    if (!needle) return byStatus;
    return byStatus.filter((a) =>
      (a.dojo_name ?? "").toLowerCase().includes(needle) ||
      (a.fpkt_affiliation_id ?? "").toLowerCase().includes(needle)
    );
  }, [annuities, filter, q]);

  // Export CSV das cobranças JÁ filtradas (status + busca). Client-side.
  const handleExport = () => {
    if (filteredAnnuities.length === 0) return;
    const header = ["Dojô", "Código FPKT", "Período", "Valor", "Status", "Dias em atraso"];
    const rows = filteredAnnuities.map((a) => [
      a.dojo_name ?? "",
      a.fpkt_affiliation_id ?? "",
      a.reference_period ?? "",
      a.amount.toFixed(2).replace(".", ","),
      STATUS_CSV_LABEL[a.status] ?? a.status,
      String(a.days_overdue ?? 0),
    ]);
    downloadCsv("anuidades_dojo", header, rows);
  };

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

  // Id da cobrança (annuity_history_id) — só presente na resposta do POST
  // .../charge, NÃO no GET de listagem (backend ainda não devolve id na
  // listagem). Editar/Excluir só ficam disponíveis para linhas com id
  // conhecido (ex.: cobrança lançada nesta sessão) — mesmo padrão defensivo
  // de annuityId() em app/karate/(federation)/dojos/[dojoId].tsx.
  const annuityRowId = (a: DojoAnnuity) => a.annuity_history_id || a.annuity_id || null;

  const handleVoid = async (ann: DojoAnnuity) => {
    const id = annuityRowId(ann);
    if (!id) {
      toast.error("Não foi possível identificar esta cobrança para estorno.");
      return;
    }
    const ok = await confirmAsync({
      title: "Estornar anuidade?",
      message: `Estornar a anuidade ${ann.reference_period} de ${ann.dojo_name}? O lançamento será cancelado.`,
      confirmLabel: "Estornar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await karateApi.voidAnnuity(federationId, ann.dojo_id, id);
      toast.success("Anuidade estornada");
      load(true);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível estornar a anuidade.");
    }
  };

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      keyboardShouldPersistTaps="handled"
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
          <Icon name={showFeeEditor ? "close" : "create-outline"} size={16} color={KarateColors.primary} />
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
        {fees.length === 0 && !showFeeEditor ? (
          <Text style={{ fontSize: 12.5, color: KarateColors.ink3, paddingVertical: 6, lineHeight: 18 }}>
            Nenhuma anuidade configurada ainda. Toque em “Editar” para definir os valores por porte de dojô e por CPF.
          </Text>
        ) : null}
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
      <View style={[st.sectionHeader, { marginTop: 16 }]}>
        <Text style={st.sectionTitle}>COBRANÇAS</Text>
        <TouchableOpacity
          style={st.exportBtn}
          onPress={handleExport}
          accessibilityRole="button"
          accessibilityLabel="Exportar CSV"
        >
          <Icon name="download" size={14} color={KarateColors.ink2} />
          <Text style={st.exportLabel}>Exportar</Text>
        </TouchableOpacity>
      </View>

      {/* Busca — bloco PERSISTENTE, fora de qualquer header de lista. O campo é
          montado uma vez aqui no corpo; como a lista de cobranças é um `.map()`
          e não um header reconciliado, o TextInput mantém o foco entre teclas. */}
      <SearchField
        value={q}
        onChangeText={handleSearch}
        placeholder="Buscar por nome do dojô ou código FPKT..."
        style={{ marginTop: 4, marginBottom: 4 }}
      />

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
        <KarateEmptyState
          icon="document-text-outline"
          title={q.trim() ? "Nenhum dojô encontrado" : "Sem cobranças neste filtro"}
        />
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
                  <Icon name="warning" size={11} color={KarateColors.danger} /> {ann.days_overdue}d em atraso
                </Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={st.annuityAmount}>{formatCurrency(ann.amount)}</Text>
              <AnnuityStatusBadge status={ann.status} />
              <View style={st.rowActions}>
                {ann.status === "no_charge" && (
                  <TouchableOpacity
                    style={st.launchBtn}
                    onPress={() => setChargeTarget(ann)}
                    accessibilityRole="button"
                    accessibilityLabel={`Lançar anuidade de ${ann.dojo_name}`}
                  >
                    <Icon name="add" size={13} color="#fff" />
                    <Text style={st.launchBtnLabel}>Lançar anuidade</Text>
                  </TouchableOpacity>
                )}
                {(ann.status === "due" || ann.status === "overdue" || ann.status === "defaulting") && (
                  <TouchableOpacity
                    style={st.pixBtn}
                    onPress={() => setPixTarget(ann)}
                    accessibilityRole="button"
                    accessibilityLabel={`Registrar pagamento PIX de ${ann.dojo_name}`}
                  >
                    <Icon name="qr-code-outline" size={13} color="#fff" />
                    <Text style={st.pixBtnLabel}>Cobrar PIX</Text>
                  </TouchableOpacity>
                )}
                {ann.status !== "paid" && ann.status !== "no_charge" && (
                  <TouchableOpacity
                    style={st.waBtn}
                    onPress={() => setWaTarget(ann)}
                    accessibilityRole="button"
                    accessibilityLabel={`Cobrar via WhatsApp de ${ann.dojo_name}`}
                  >
                    <Icon name="logo-whatsapp" size={13} color="#fff" />
                    <Text style={st.waBtnLabel}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
                {ann.status !== "paid" && ann.status !== "no_charge" && (
                  <TouchableOpacity
                    style={st.iconBtn}
                    onPress={() => setEditTarget(ann)}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar anuidade de ${ann.dojo_name}`}
                  >
                    <Icon name="create-outline" size={14} color={KarateColors.ink2} />
                  </TouchableOpacity>
                )}
                {ann.status !== "no_charge" && (
                  <TouchableOpacity
                    style={st.iconBtn}
                    onPress={() => handleVoid(ann)}
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir anuidade de ${ann.dojo_name}`}
                  >
                    <Icon name="trash" size={14} color={KarateColors.danger} />
                  </TouchableOpacity>
                )}
              </View>
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

      {/* Cobrança manual via WhatsApp */}
      {waTarget && (
        <WhatsAppChargeModal
          visible={!!waTarget}
          federationId={federationId}
          target={{
            name: waTarget.dojo_name,
            phone: waTarget.whatsapp,
            amount: waTarget.amount,
            reference_period: waTarget.reference_period,
            due_date: waTarget.due_date,
            status: waTarget.status,
          }}
          onClose={() => setWaTarget(null)}
        />
      )}

      {/* Lançar anuidade (nova cobrança) */}
      {chargeTarget && (
        <LancarAnuidadeDojoModal
          visible={!!chargeTarget}
          mode="charge"
          federationId={federationId}
          dojoId={chargeTarget.dojo_id}
          dojoName={chargeTarget.dojo_name}
          onClose={() => setChargeTarget(null)}
          onDone={() => {
            setChargeTarget(null);
            load(true);
          }}
        />
      )}

      {/* Editar anuidade (cobrança não paga) */}
      {editTarget && (
        <LancarAnuidadeDojoModal
          visible={!!editTarget}
          mode="edit"
          federationId={federationId}
          dojoId={editTarget.dojo_id}
          dojoName={editTarget.dojo_name}
          annuityId={annuityRowId(editTarget)}
          annuity={editTarget}
          onClose={() => setEditTarget(null)}
          onDone={() => {
            setEditTarget(null);
            load(true);
          }}
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

  rowActions:   { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" } as ViewStyle,

  pixBtn:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  pixBtnLabel:  { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,
  waBtn:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#25D366", borderRadius: KarateRadius.sm, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  waBtnLabel:   { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,

  launchBtn:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.ink, borderRadius: KarateRadius.sm, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  launchBtnLabel: { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,

  iconBtn:      { alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,

  badge:        { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: KarateRadius.sm } as ViewStyle,
  badgeText:    { fontSize: 10, fontWeight: "700" } as TextStyle,
  exportBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  exportLabel:  { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
});
