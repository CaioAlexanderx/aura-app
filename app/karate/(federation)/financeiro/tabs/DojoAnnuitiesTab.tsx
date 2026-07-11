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
import { KarateColors, KarateRadius, ShojiPalette, KarateFonts, annuityStatusView } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { PixPaymentModal } from "@/components/karate/PixPaymentModal";
import { WhatsAppChargeModal } from "@/components/karate/WhatsAppChargeModal";
import { LancarAnuidadeDojoModal } from "@/components/karate/LancarAnuidadeDojoModal";
import { SearchField } from "@/components/karate/shoji";
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

// Estado da anuidade -> view canônica (fonte única: annuityStatusView).
function annuityStatusMeta(status: string) {
  return annuityStatusView(status);
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
  paid: "Pago", due: "A vencer", overdue: "Vencido", defaulting: "Inadimplente", suspended: "Inadimplente", no_charge: "Sem cobrança",
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
  const [voidTarget, setVoidTarget] = useState<DojoAnnuity | null>(null);
  const [voiding, setVoiding] = useState(false);

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

  // Filtro derivado (status × texto), client-side. NÃO toca no endpoint:
  // o status já vai no fetch; aqui só refinamos por nome do dojô / código FPKT.
  const filteredAnnuities = useMemo(() => {
    const byStatus = filter === "all"
      ? annuities
      : annuities.filter((a) => annuityStatusView(a.status).key === filter);
    const needle = q.trim().toLowerCase();
    if (!needle) return byStatus;
    return byStatus.filter((a) =>
      (a.dojo_name ?? "").toLowerCase().includes(needle) ||
      (a.fpkt_affiliation_id ?? "").toLowerCase().includes(needle)
    );
  }, [annuities, filter, q]);

  // Regra dos hooks: o early-return de erro só pode vir DEPOIS de todos os
  // hooks (useState/useCallback/useEffect/useMemo acima). Antes ficava entre
  // handleSearch e o useMemo de filteredAnnuities — nos renders com error
  // true, o useMemo deixava de ser chamado e o número/ordem de hooks mudava
  // entre renders, violando a regra dos hooks do React.
  if (error) return <KarateErrorState onRetry={() => load()} />;

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

  // Id da cobrança (annuity_history_id / annuity_id — aliases idênticos ao
  // mesmo registro de karate_dojo_annuity_history; ver PR #353 do
  // aura-backend). Desde esse PR o GET de listagem já devolve o id por
  // linha (antes só vinha na resposta do POST .../charge, o que deixava
  // "Cobrar PIX" e "Editar" mortos na listagem). Editar, Cobrar PIX e
  // Remover cobrança ficam disponíveis quando o id existe — ou seja,
  // sempre que a linha não é "sem cobrança" (no_charge).
  const annuityRowId = (a: DojoAnnuity) => a.annuity_history_id || a.annuity_id || null;

  // Remove (estorna) uma cobrança já lançada. voidAnnuity funciona mesmo
  // para cobranças já pagas (reverte a conciliação) — a confirmação
  // destrutiva abaixo é o único freio, por isso é explícita (mostra dojô +
  // competência) em vez de um "tem certeza?" genérico.
  const handleVoidAnnuity = async () => {
    if (!voidTarget) return;
    const id = annuityRowId(voidTarget);
    if (!id) { setVoidTarget(null); return; }
    setVoiding(true);
    try {
      await karateApi.voidAnnuity(federationId, voidTarget.dojo_id, id);
      toast.success("Cobrança removida");
      setVoidTarget(null);
      load(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover a cobrança.");
    } finally {
      setVoiding(false);
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
        filteredAnnuities.map((ann) => {
          const rowId = annuityRowId(ann);
          const confirmingVoid = voidTarget?.dojo_id === ann.dojo_id;
          return (
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
              {confirmingVoid ? (
                // Confirmação destrutiva INLINE (não um segundo <Modal> — no RN
                // Web um Modal aninhado dentro de outro renderiza atrás do pai
                // e vira no-op silencioso). Mostra explicitamente de quem/qual
                // competência para evitar remoção por engano.
                <View style={st.confirmVoidBox}>
                  <Text style={st.confirmVoidText}>
                    Remover a cobrança de {ann.dojo_name} — competência {ann.reference_period}?{"\n"}Esta ação não pode ser desfeita.
                  </Text>
                  <View style={st.confirmVoidActions}>
                    <TouchableOpacity
                      style={st.confirmVoidCancel}
                      onPress={() => setVoidTarget(null)}
                      disabled={voiding}
                      accessibilityRole="button"
                      accessibilityLabel="Cancelar remoção da cobrança"
                    >
                      <Text style={st.confirmVoidCancelLabel}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.confirmVoidDanger, voiding && { opacity: 0.6 }]}
                      onPress={handleVoidAnnuity}
                      disabled={voiding}
                      accessibilityRole="button"
                      accessibilityLabel={`Confirmar remoção da cobrança de ${ann.dojo_name}`}
                    >
                      <Text style={st.confirmVoidDangerLabel}>{voiding ? "Removendo…" : "Remover"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={st.rowActions}>
                  {annuityStatusView(ann.status).key === "no_charge" && (
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
                  {(["due", "overdue", "defaulting"].includes(annuityStatusView(ann.status).key)) && rowId && (
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
                  {ann.status !== "paid" && ann.status !== "no_charge" && rowId && (
                    <TouchableOpacity
                      style={st.iconBtn}
                      onPress={() => setEditTarget(ann)}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar anuidade de ${ann.dojo_name}`}
                    >
                      <Icon name="create-outline" size={14} color={KarateColors.ink2} />
                    </TouchableOpacity>
                  )}
                  {rowId && (
                    <TouchableOpacity
                      style={st.iconBtnDanger}
                      onPress={() => setVoidTarget(ann)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover cobrança de ${ann.dojo_name}`}
                    >
                      <Icon name="trash-outline" size={14} color={KarateColors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
          );
        })
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
  iconBtnDanger:{ alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.dangerSoft, backgroundColor: KarateColors.dangerSoft } as ViewStyle,

  confirmVoidBox:     { width: 220, gap: 8, backgroundColor: KarateColors.dangerSoft, borderWidth: 1, borderColor: KarateColors.danger, borderRadius: KarateRadius.md, padding: 10 } as ViewStyle,
  confirmVoidText:     { fontSize: 11.5, lineHeight: 16, color: KarateColors.ink2 } as TextStyle,
  confirmVoidActions:  { flexDirection: "row", justifyContent: "flex-end", gap: 8 } as ViewStyle,
  confirmVoidCancel:   { paddingVertical: 6, paddingHorizontal: 10, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  confirmVoidCancelLabel: { fontSize: 11.5, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  confirmVoidDanger:   { paddingVertical: 6, paddingHorizontal: 10, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.danger } as ViewStyle,
  confirmVoidDangerLabel: { fontSize: 11.5, fontWeight: "700", color: "#fff" } as TextStyle,

  badge:        { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: KarateRadius.sm } as ViewStyle,
  badgeText:    { fontSize: 10, fontWeight: "700" } as TextStyle,
  exportBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  exportLabel:  { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
});
