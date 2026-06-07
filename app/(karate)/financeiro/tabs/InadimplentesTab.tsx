// ============================================================
// InadimplentesTab — Inadimplentes (dojôs + CPF)
//
// Lista completa de inadimplentes com valor, dias de atraso,
// badge de status e botão de cobrança (WhatsApp ou e-mail).
//
// Wired: GET /financial/overdue
//        POST /financial/overdue/{targetId}/remind
// MOCK: dados com shape fiel ao contrato.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ViewStyle,
  TextStyle,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import {
  karateApi,
  OverdueItem,
  ReminderChannel,
  OverdueTargetType,
} from "@/services/karateApi";

// ── MOCK ───────────────────────────────────────────────────
const MOCK_OVERDUE: OverdueItem[] = [
  { target_type: "dojo", target_id: "d1", name: "Dojô Shotokan ABC",       amount: 1200, days_overdue: 67,  status: "overdue",    last_reminder_at: null },
  { target_type: "dojo", target_id: "d4", name: "Centro Karatê Zen",       amount: 3000, days_overdue: 100, status: "defaulting", last_reminder_at: "2026-04-01T09:00:00Z" },
  { target_type: "cpf",  target_id: "p2", name: "Ana Paula Rocha",          amount: 80,   days_overdue: 67,  status: "overdue",    last_reminder_at: null },
  { target_type: "cpf",  target_id: "p4", name: "Fernanda Costa",           amount: 80,   days_overdue: 130, status: "defaulting", last_reminder_at: "2026-03-15T08:00:00Z" },
];

const STATUS_MAP = {
  overdue:    { label: "Vencido",      icon: "warning",      color: ShojiPalette.alert,  bg: ShojiPalette.alertSoft },
  defaulting: { label: "Inadimplente", icon: "close-circle", color: ShojiPalette.danger, bg: ShojiPalette.dangerSoft },
  due:        { label: "A vencer",     icon: "time",         color: ShojiPalette.warn,   bg: ShojiPalette.warnSoft },
  paid:       { label: "Pago",         icon: "checkmark-circle", color: ShojiPalette.ok, bg: ShojiPalette.okSoft },
  suspended:  { label: "Suspenso",     icon: "ban",          color: ShojiPalette.neutral, bg: ShojiPalette.neutralSoft },
} as const;

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

interface Props { federationId: string; }

export function InadimplentesTab({ federationId }: Props) {
  const [items, setItems]           = useState<OverdueItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminding, setReminding]   = useState<string | null>(null); // targetId being reminded

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      // TODO: remover fallback MOCK quando backend responder
      const res = await karateApi
        .listOverdue(federationId)
        .catch(() => MOCK_OVERDUE);
      setItems(res);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const handleRemind = useCallback(
    async (item: OverdueItem, channel: ReminderChannel) => {
      setReminding(item.target_id);
      try {
        // TODO: remover fallback MOCK quando backend responder
        await karateApi
          .remindOverdue(federationId, item.target_id, {
            channel,
            target_type: item.target_type as OverdueTargetType,
          })
          .catch(() => ({ queued: true }));
        const channelLabel = channel === "whatsapp" ? "WhatsApp" : "e-mail";
        if (Platform.OS === "web") {
          alert(`Cobrança enviada via ${channelLabel} para ${item.name}.`);
        } else {
          Alert.alert("Cobrança enviada", `Notificação via ${channelLabel} para ${item.name}.`);
        }
      } finally {
        setReminding(null);
      }
    },
    [federationId]
  );

  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />
      }
    >
      {/* Sumário */}
      {!loading && items.length > 0 && (
        <View style={st.summaryCard}>
          <View style={st.summaryItem} accessibilityLabel={`${items.length} inadimplentes`}>
            <Ionicons name="close-circle" size={18} color={KarateColors.danger} />
            <Text style={st.summaryValue}>{items.length}</Text>
            <Text style={st.summaryLabel}>inadimplentes</Text>
          </View>
          <View style={st.summaryDivider} />
          <View style={st.summaryItem} accessibilityLabel={`Total a receber: ${formatCurrency(totalAmount)}`}>
            <Ionicons name="cash-outline" size={18} color={KarateColors.danger} />
            <Text style={st.summaryValue}>{formatCurrency(totalAmount)}</Text>
            <Text style={st.summaryLabel}>a receber</Text>
          </View>
        </View>
      )}

      {/* Lista */}
      {loading ? (
        [1, 2, 3].map((k) => <Skeleton key={k} height={90} style={{ marginBottom: 8 }} />)
      ) : items.length === 0 ? (
        <KarateEmptyState
          icon="checkmark-circle-outline"
          title="Nenhum inadimplente"
          subtitle="Todos os dojôs e praticantes estão em dia."
        />
      ) : (
        items.map((item) => {
          const s = STATUS_MAP[item.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.overdue;
          const isReminding = reminding === item.target_id;
          return (
            <View key={`${item.target_type}-${item.target_id}`} style={st.card}>
              {/* Tipo + nome */}
              <View style={st.cardHeader}>
                <View style={st.typeChip}>
                  <Ionicons
                    name={item.target_type === "dojo" ? "home-outline" : "person-outline"}
                    size={11}
                    color={KarateColors.ink3}
                  />
                  <Text style={st.typeLabel}>
                    {item.target_type === "dojo" ? "Dojô" : "CPF"}
                  </Text>
                </View>
                <View style={[st.statusBadge, { backgroundColor: s.bg }]} accessibilityLabel={s.label}>
                  <Ionicons name={s.icon as any} size={11} color={s.color} />
                  <Text style={[st.statusText, { color: s.color }]}>{s.label}</Text>
                </View>
              </View>

              <Text style={st.name}>{item.name}</Text>

              {/* Valor + dias */}
              <View style={st.metaRow}>
                <Text style={st.amount}>{formatCurrency(item.amount)}</Text>
                <Text style={st.overdueDays}>
                  {item.days_overdue > 0 ? (
                    <>
                      <Ionicons name="time-outline" size={11} color={KarateColors.danger} />
                      {` ${item.days_overdue}d em atraso`}
                    </>
                  ) : "Vencimento imediato"}
                </Text>
              </View>

              {item.last_reminder_at && (
                <Text style={st.lastReminder}>
                  Última cobrança: {formatDate(item.last_reminder_at)}
                </Text>
              )}

              {/* Ações de cobrança */}
              <View style={st.actions}>
                <TouchableOpacity
                  style={[st.actionBtn, st.actionWhatsapp]}
                  onPress={() => handleRemind(item, "whatsapp")}
                  disabled={isReminding}
                  accessibilityRole="button"
                  accessibilityLabel={`Cobrar ${item.name} via WhatsApp`}
                  accessibilityState={{ busy: isReminding }}
                >
                  <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                  <Text style={st.actionLabel}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.actionBtn, st.actionEmail]}
                  onPress={() => handleRemind(item, "email")}
                  disabled={isReminding}
                  accessibilityRole="button"
                  accessibilityLabel={`Cobrar ${item.name} via e-mail`}
                  accessibilityState={{ busy: isReminding }}
                >
                  <Ionicons name="mail-outline" size={14} color={KarateColors.primary} />
                  <Text style={[st.actionLabel, { color: KarateColors.primary }]}>E-mail</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:       { padding: 16, gap: 10, paddingBottom: 40 } as ViewStyle,

  summaryCard:   { flexDirection: "row", backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.primaryLine, padding: 16, alignItems: "center", justifyContent: "space-around", marginBottom: 4 } as ViewStyle,
  summaryItem:   { alignItems: "center", gap: 4 } as ViewStyle,
  summaryDivider:{ width: 1, height: 40, backgroundColor: KarateColors.border } as ViewStyle,
  summaryValue:  { fontSize: 20, fontWeight: "900", color: KarateColors.danger } as TextStyle,
  summaryLabel:  { fontSize: 11, color: KarateColors.danger, fontWeight: "600" } as TextStyle,

  card:          { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 8 } as ViewStyle,
  cardHeader:    { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  typeChip:      { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2, paddingHorizontal: 6, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.bg2 } as ViewStyle,
  typeLabel:     { fontSize: 10, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  statusBadge:   { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 2, paddingHorizontal: 7, borderRadius: KarateRadius.sm } as ViewStyle,
  statusText:    { fontSize: 10, fontWeight: "700" } as TextStyle,
  name:          { fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  metaRow:       { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" } as ViewStyle,
  amount:        { fontSize: 17, fontWeight: "900", color: KarateColors.danger } as TextStyle,
  overdueDays:   { fontSize: 12, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  lastReminder:  { fontSize: 11, color: KarateColors.ink4 } as TextStyle,
  actions:       { flexDirection: "row", gap: 8, marginTop: 4 } as ViewStyle,
  actionBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: KarateRadius.sm } as ViewStyle,
  actionWhatsapp:{ backgroundColor: "#25D366" } as ViewStyle,
  actionEmail:   { backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  actionLabel:   { fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
});
