// ============================================================
// CpfAnnuitiesTab — Anuidades CPF (praticantes individuais)
//
// Lista de anuidades por CPF com status, filtro e cobrança PIX.
//
// Wired: GET /financial/annuities/cpf
//        POST /financial/annuities/cpf/{practitionerId}/pix
// MOCK: dados com shape fiel ao contrato v0.2.0.
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
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { PixPaymentModal } from "@/components/karate/PixPaymentModal";
import { karateApi, CpfAnnuity, AnnuityStatus } from "@/services/karateApi";

// ── MOCK ───────────────────────────────────────────────────
// Shape matches contract CpfAnnuity schema (v0.2.0).
// transaction_id is needed to call the /pix endpoint.
const MOCK_CPF_ANNUITIES: (CpfAnnuity & { transaction_id: string | null })[] = [
  { practitioner_id: "p1", full_name: "Takeshi Yamamoto",   karate_registration_number: "KR-0001", amount: 80, reference_period: "2026", due_date: "2026-03-31", paid_at: "2026-03-15", status: "paid",       transaction_id: "tx-p1" },
  { practitioner_id: "p2", full_name: "Ana Paula Rocha",    karate_registration_number: "KR-0002", amount: 80, reference_period: "2026", due_date: "2026-03-31", paid_at: null,          status: "overdue",    transaction_id: "tx-p2" },
  { practitioner_id: "p3", full_name: "Carlos Eduardo Lima",karate_registration_number: "KR-0003", amount: 80, reference_period: "2026", due_date: "2026-06-30", paid_at: null,          status: "due",        transaction_id: "tx-p3" },
  { practitioner_id: "p4", full_name: "Fernanda Costa",     karate_registration_number: "KR-0004", amount: 80, reference_period: "2026", due_date: "2026-01-31", paid_at: null,          status: "defaulting", transaction_id: null },
];

const STATUS_FILTER: { key: AnnuityStatus | "all"; label: string }[] = [
  { key: "all",        label: "Todos" },
  { key: "paid",       label: "Pago" },
  { key: "due",        label: "A vencer" },
  { key: "overdue",    label: "Vencido" },
  { key: "defaulting", label: "Inadimplente" },
];

const STATUS_MAP: Record<AnnuityStatus, { label: string; icon: string; color: string; bg: string }> = {
  paid:       { label: "Pago",         icon: "checkmark-circle", color: ShojiPalette.ok,     bg: ShojiPalette.okSoft },
  due:        { label: "A vencer",     icon: "time",             color: ShojiPalette.warn,   bg: ShojiPalette.warnSoft },
  overdue:    { label: "Vencido",      icon: "warning",          color: ShojiPalette.alert,  bg: ShojiPalette.alertSoft },
  defaulting: { label: "Inadimplente", icon: "close-circle",     color: ShojiPalette.danger, bg: ShojiPalette.dangerSoft },
  suspended:  { label: "Suspenso",     icon: "ban",              color: ShojiPalette.neutral,bg: ShojiPalette.neutralSoft },
};

// Extended type that carries transaction_id from the list response.
// The contract CpfAnnuity schema doesn't include transaction_id but
// POST /cpf/{id}/pix requires it. If the backend starts returning it
// in the list, it can be promoted to the base CpfAnnuity type.
type CpfAnnuityWithTx = CpfAnnuity & { transaction_id?: string | null };

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props { federationId: string; }

export function CpfAnnuitiesTab({ federationId }: Props) {
  const [annuities, setAnnuities] = useState<CpfAnnuityWithTx[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState<AnnuityStatus | "all">("all");
  const [search, setSearch]       = useState("");
  const [pixTarget, setPixTarget] = useState<CpfAnnuityWithTx | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      // TODO: remover fallback MOCK quando backend responder
      const res = await karateApi
        .listCpfAnnuities(federationId, { status: filter === "all" ? undefined : filter })
        .catch(() => ({ page: 1, page_size: 25, total: MOCK_CPF_ANNUITIES.length, data: MOCK_CPF_ANNUITIES }));
      setAnnuities(res.data as CpfAnnuityWithTx[]);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = annuities.filter((a) =>
    search === "" ||
    a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    a.karate_registration_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />
      }
    >
      {/* Busca */}
      <View style={st.searchRow}>
        <Ionicons name="search" size={16} color={KarateColors.ink4} style={{ marginLeft: 10 }} />
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
          const s = STATUS_MAP[ann.status];
          const canPay = ann.status !== "paid" && !!ann.transaction_id;
          return (
            <View key={ann.practitioner_id} style={st.card}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.name}>{ann.full_name}</Text>
                <Text style={st.meta}>{ann.karate_registration_number} · {ann.reference_period}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={st.amount}>{formatCurrency(ann.amount)}</Text>
                <View style={[st.badge, { backgroundColor: s.bg }]} accessibilityLabel={s.label}>
                  <Ionicons name={s.icon as any} size={11} color={s.color} />
                  <Text style={[st.badgeText, { color: s.color }]}>{s.label}</Text>
                </View>
                {canPay && (
                  <TouchableOpacity
                    style={st.pixBtn}
                    onPress={() => setPixTarget(ann)}
                    accessibilityRole="button"
                    accessibilityLabel={`Cobrar PIX de ${ann.full_name}`}
                  >
                    <Ionicons name="qr-code-outline" size={13} color="#fff" />
                    <Text style={st.pixBtnLabel}>Cobrar PIX</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}

      {/* PIX Modal — only shown when we have a transaction_id to pass */}
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
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:            { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:           { padding: 16, gap: 8, paddingBottom: 40 } as ViewStyle,
  searchRow:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, marginBottom: 4 } as ViewStyle,
  searchInput:       { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: KarateColors.ink } as TextStyle,
  filterChip:        { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  filterChipActive:  { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  filterLabel:       { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  filterLabelActive: { color: KarateColors.primary, fontWeight: "800" } as TextStyle,
  card:              { flexDirection: "row", backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8 } as ViewStyle,
  name:              { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta:              { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  amount:            { fontSize: 15, fontWeight: "900", color: KarateColors.ink } as TextStyle,
  badge:             { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 7, borderRadius: KarateRadius.sm } as ViewStyle,
  badgeText:         { fontSize: 10, fontWeight: "700" } as TextStyle,
  pixBtn:            { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  pixBtnLabel:       { fontSize: 11, fontWeight: "700", color: "#fff" } as TextStyle,
});
