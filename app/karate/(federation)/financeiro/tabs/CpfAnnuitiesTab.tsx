// ============================================================
// CpfAnnuitiesTab — Anuidades CPF (praticantes individuais)
//
// Lista de anuidades por CPF com status, filtro e cobrança PIX.
// Exibida na aba "Anuidades Praticantes".
//
// Wired: GET /financial/annuities/cpf (aceita ?year=YYYY — PR #353 do
//        aura-backend; devolve transaction_id por linha)
//        POST /financial/annuities/cpf/{practitionerId}/pix
//        POST /financial/annuities/cpf/{practitionerId}/charge (dados reais).
//
// Paridade com DojoAnnuitiesTab (aba Dojô):
//   - "Lançar anuidade" para linhas sem cobrança (no_charge).
//   - Vencimento + dias em atraso exibidos na linha e no CSV.
//   - wa.me NÃO depende de transaction_id (o backend monta a mensagem
//     localmente; só cria intent PIX real é que precisa do transaction_id).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, ShojiPalette, KarateFonts, annuityStatusView } from "@/constants/karateTheme";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { PixPaymentModal } from "@/components/karate/PixPaymentModal";
import { WhatsAppChargeModal } from "@/components/karate/WhatsAppChargeModal";
import { LancarAnuidadeModal } from "@/components/karate/praticante-detalhe/LancarAnuidadeModal";
import { formatIsoToBr } from "@/components/inputs/DateInput";
import { downloadCsv } from "./EntriesTab";
import { karateApi, CpfAnnuity, AnnuityStatus } from "@/services/karateApi";

const STATUS_FILTER: { key: AnnuityStatus | "all"; label: string }[] = [
  { key: "all",        label: "Todos" },
  { key: "paid",       label: "Pago" },
  { key: "due",        label: "A vencer" },
  { key: "overdue",    label: "Vencido" },
  { key: "defaulting", label: "Inadimplente" },
  { key: "no_charge",  label: "Sem cobrança" },
];

// Estado da anuidade -> view canônica (fonte única: annuityStatusView).
function sm(status: string) {
  return annuityStatusView(status);
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// GET /financial/annuities/cpf não devolve days_overdue pronto (diferente da
// listagem de dojôs, que já calcula server-side — ver karateAnnuities.js).
// Calculamos aqui com a MESMA regra usada no backend para dojôs: só conta
// atraso quando o status já é overdue/defaulting/suspended (ausência de
// cobrança — no_charge — nunca é atraso).
function computeDaysOverdue(status: AnnuityStatus, dueDate: string | null | undefined): number {
  if (!dueDate) return 0;
  if (status !== "overdue" && status !== "defaulting" && status !== "suspended") return 0;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? new Date(dueDate + "T12:00:00") : new Date(dueDate);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
}

const STATUS_CSV_LABEL: Partial<Record<AnnuityStatus, string>> = {
  paid: "Pago", due: "A vencer", overdue: "Vencido", defaulting: "Inadimplente", suspended: "Inadimplente", no_charge: "Sem cobrança",
};

interface Props { federationId: string; }

export function CpfAnnuitiesTab({ federationId }: Props) {
  const [annuities, setAnnuities] = useState<CpfAnnuity[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState<AnnuityStatus | "all">("all");
  const [search, setSearch]       = useState("");
  const [pixTarget, setPixTarget] = useState<CpfAnnuity | null>(null);
  const [waTarget, setWaTarget] = useState<CpfAnnuity | null>(null);
  const [chargeTarget, setChargeTarget] = useState<CpfAnnuity | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listCpfAnnuities(federationId, { status: filter === "all" ? undefined : filter });
      setAnnuities(res.data);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, filter]);

  useEffect(() => { load(); }, [load]);

  if (error) return <KarateErrorState onRetry={() => load()} />;

  const filtered = annuities.filter((a) =>
    search === "" ||
    a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.karate_registration_number ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Export CSV das anuidades JÁ filtradas (busca + status). Client-side.
  // Vencimento + dias em atraso em paridade com a aba Dojô.
  const handleExport = () => {
    if (filtered.length === 0) return;
    const header = ["Praticante", "Registro", "Período", "Vencimento", "Valor", "Status", "Dias em atraso"];
    const rows = filtered.map((a) => [
      a.full_name ?? "",
      a.karate_registration_number ?? "",
      a.reference_period ?? "",
      formatIsoToBr(a.due_date) || "",
      a.amount.toFixed(2).replace(".", ","),
      STATUS_CSV_LABEL[a.status] ?? a.status,
      String(computeDaysOverdue(a.status, a.due_date)),
    ]);
    downloadCsv("anuidades_praticantes", header, rows);
  };

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />
      }
    >
      {/* Exportar CSV (lista filtrada) */}
      <View style={st.exportRow}>
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

      {/* Busca */}
      <View style={st.searchRow}>
        <Icon name="search" size={16} color={KarateColors.ink4} style={{ marginLeft: 10 }} />
        <TextInput
          style={st.searchInput}
          placeholder="Buscar praticante…"
          placeholderTextColor={KarateColors.ink4}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          accessibilityLabel="Buscar praticante"
        />
      </View>

      {/* Filtro */}
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
            <Text style={[st.filterLabel, filter === f.key && st.filterLabelActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading ? (
        [1,2,3].map((k) => <Skeleton key={k} height={68} style={{ marginBottom: 8 }} />)
      ) : filtered.length === 0 ? (
        <KarateEmptyState icon="person-outline" title="Nenhum praticante encontrado" />
      ) : (
        filtered.map((ann) => {
          const sKey = sm(ann.status).key;
          const daysOverdue = computeDaysOverdue(ann.status, ann.due_date);
          // wa.me NÃO depende de transaction_id — a mensagem é montada
          // localmente (nome, competência, valor, vencimento/status). Só a
          // criação de intent PIX real precisa do transaction_id.
          const canWhatsApp = ann.status !== "paid" && ann.status !== "no_charge";
          const canPix = ["due", "overdue", "defaulting"].includes(sKey) && !!ann.transaction_id;
          const canLaunch = sKey === "no_charge";
          return (
            <View key={ann.practitioner_id} style={st.card}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.name}>{ann.full_name}</Text>
                <Text style={st.meta}>{ann.karate_registration_number} · {ann.reference_period}</Text>
                {ann.due_date ? (
                  <Text style={st.meta}>Vencimento: {formatIsoToBr(ann.due_date)}</Text>
                ) : null}
                {daysOverdue > 0 && (
                  <Text style={st.overdue}>
                    <Icon name="warning" size={11} color={KarateColors.danger} /> {daysOverdue}d em atraso
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={st.amount}>{formatCurrency(ann.amount)}</Text>
                <View style={[st.badge, { backgroundColor: sm(ann.status).bg }]} accessibilityLabel={sm(ann.status).label}>
                  <Icon name={sm(ann.status).icon as any} size={11} color={sm(ann.status).color} />
                  <Text style={[st.badgeText, { color: sm(ann.status).color }]}>{sm(ann.status).label}</Text>
                </View>
                {canLaunch && (
                  <TouchableOpacity
                    style={st.launchBtn}
                    onPress={() => setChargeTarget(ann)}
                    accessibilityRole="button"
                    accessibilityLabel={`Lançar anuidade de ${ann.full_name}`}
                  >
                    <Icon name="add" size={13} color="#fff" />
                    <Text style={st.launchBtnLabel}>Lançar anuidade</Text>
                  </TouchableOpacity>
                )}
                {canPix && (
                  <TouchableOpacity
                    style={st.pixBtn}
                    onPress={() => setPixTarget(ann)}
                    accessibilityRole="button"
                    accessibilityLabel={`Cobrar PIX de ${ann.full_name}`}
                  >
                    <Icon name="qr-code-outline" size={13} color="#fff" />
                    <Text style={st.pixBtnLabel}>Cobrar PIX</Text>
                  </TouchableOpacity>
                )}
                {canWhatsApp && (
                  <TouchableOpacity
                    style={st.waBtn}
                    onPress={() => setWaTarget(ann)}
                    accessibilityRole="button"
                    accessibilityLabel={`Cobrar via WhatsApp de ${ann.full_name}`}
                  >
                    <Icon name="logo-whatsapp" size={13} color="#fff" />
                    <Text style={st.pixBtnLabel}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}

      {/* PIX Modal — só quando há transaction_id (POST .../pix exige) */}
      {pixTarget && pixTarget.transaction_id && (
        <PixPaymentModal
          visible={!!pixTarget}
          federationId={federationId}
          target={{
            practitionerId: pixTarget.practitioner_id,
            transactionId: pixTarget.transaction_id,
          }}
          amount={pixTarget.amount}
          description={`Anuidade CPF ${pixTarget.reference_period} — ${pixTarget.full_name}`}
          isAdmin
          onSuccess={() => { setPixTarget(null); load(true); }}
          onClose={() => setPixTarget(null)}
        />
      )}

      {/* Cobrança manual via WhatsApp — independe de transaction_id */}
      {waTarget && (
        <WhatsAppChargeModal
          visible={!!waTarget}
          federationId={federationId}
          target={{
            name: waTarget.full_name,
            phone: waTarget.whatsapp,
            amount: waTarget.amount,
            reference_period: waTarget.reference_period,
            due_date: waTarget.due_date,
            status: waTarget.status,
          }}
          onClose={() => setWaTarget(null)}
        />
      )}

      {/* Lançar anuidade (nova cobrança CPF) — mesmo endpoint/modal usado na
          ficha do praticante (AnuidadeCard). */}
      {chargeTarget && (
        <LancarAnuidadeModal
          visible={!!chargeTarget}
          federationId={federationId}
          practitionerId={chargeTarget.practitioner_id}
          practitionerName={chargeTarget.full_name}
          onClose={() => setChargeTarget(null)}
          onDone={() => {
            setChargeTarget(null);
            load(true);
          }}
        />
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:            { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:           { padding: 16, gap: 8, paddingBottom: 40 } as ViewStyle,
  searchRow:         { flexDirection: "row", alignItems: "center", backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, marginBottom: 4 } as ViewStyle,
  searchInput:       { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: KarateColors.ink } as TextStyle,
  filterChip:        { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  filterChipActive:  { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  filterLabel:       { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  filterLabelActive: { color: KarateColors.primary, fontWeight: "800" } as TextStyle,
  card:              { flexDirection: "row", backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8 } as ViewStyle,
  name:              { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta:              { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  overdue:           { fontSize: 11, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  amount:            { fontFamily: KarateFonts.mono, fontSize: 15, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  badge:             { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: KarateRadius.sm } as ViewStyle,
  badgeText:         { fontSize: 10, fontWeight: "700" } as TextStyle,
  pixBtn:            { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  pixBtnLabel:       { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,
  waBtn:             { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#25D366", borderRadius: KarateRadius.sm, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  launchBtn:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.ink, borderRadius: KarateRadius.sm, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  launchBtnLabel:    { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,
  exportRow:         { flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 } as ViewStyle,
  exportBtn:         { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  exportLabel:       { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
});
