import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import { studioApi, StudioOrder, StudioProductionStatus } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

const STATUS_LABELS: Record<StudioProductionStatus, { label: string; color: string; bg: string }> = {
  awaiting_customization: { label: "Aguardando personalização", color: "#EC4899", bg: "#FCE7F3" },
  pending_art:            { label: "Aguardando arte",          color: "#F59E0B", bg: "#FEF3C7" },
  approved:               { label: "Aprovado",                  color: "#3B82F6", bg: "#DBEAFE" },
  in_production:          { label: "Em produção",               color: "#1E3A8A", bg: "#DBEAFE" },
  ready:                  { label: "Pronto",                    color: "#10B981", bg: "#D1FAE5" },
  delivered:              { label: "Entregue",                  color: "#64748B", bg: "#E2E8F0" },
  cancelled:              { label: "Cancelado",                 color: "#94A3B8", bg: "#F1F5F9" },
};

const SOURCE_LABELS: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  digital:     { label: "Loja Digital", icon: "globe",         color: "#1E3A8A", bg: "#DBEAFE" },
  pdv:         { label: "PDV",          icon: "shopping-bag",  color: "#10B981", bg: "#D1FAE5" },
  marketplace: { label: "Marketplace",  icon: "external-link", color: "#F59E0B", bg: "#FEF3C7" },
};

const STATUS_ORDER: StudioProductionStatus[] = [
  "awaiting_customization",
  "pending_art",
  "approved",
  "in_production",
  "ready",
  "delivered",
  "cancelled",
];

function formatBRL(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
           " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return "#" + id.slice(0, 8).toUpperCase();
}

export function TabStudioPedidos() {
  const router = useRouter();
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<StudioOrder[]>([]);
  const [filterSource, setFilterSource] = useState<"all" | "digital" | "pdv" | "marketplace">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | StudioProductionStatus>("all");

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const r = await studioApi.listOrders(company.id, { days: 30, limit: 100 });
      setOrders(r.orders || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filterSource !== "all" && o.source !== filterSource) return false;
      if (filterStatus !== "all" && o.studio_production_status !== filterStatus) return false;
      return true;
    });
  }, [orders, filterSource, filterStatus]);

  const kpis = useMemo(() => {
    let pendingArt = 0;
    let inProduction = 0;
    let ready = 0;
    let delivered = 0;
    for (const o of orders) {
      switch (o.studio_production_status) {
        case "pending_art": pendingArt++; break;
        case "in_production": inProduction++; break;
        case "ready": ready++; break;
        case "delivered": delivered++; break;
      }
    }
    return { pendingArt, inProduction, ready, delivered };
  }, [orders]);

  function goToOrder(orderId: string) {
    router.push(`/studio/kds?focus=${orderId}`);
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={StudioColors.primary} />
        <Text style={styles.loadingText}>Carregando pedidos…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pedidos Studio</Text>
          <Text style={styles.subtitle}>
            Últimos 30 dias. Lista unificada de Loja Digital, PDV e Marketplaces.
          </Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Icon name="refresh-cw" size={16} color={StudioColors.primary} />
          <Text style={styles.refreshBtnText}>Atualizar</Text>
        </Pressable>
      </View>

      <Text style={styles.totalLine}>{orders.length} pedido{orders.length === 1 ? "" : "s"} no período</Text>

      {/* KPIs strip */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Aguardando arte</Text>
          <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>{kpis.pendingArt}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Em produção</Text>
          <Text style={[styles.kpiValue, { color: "#1E3A8A" }]}>{kpis.inProduction}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Prontos</Text>
          <Text style={[styles.kpiValue, { color: "#10B981" }]}>{kpis.ready}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Entregues</Text>
          <Text style={[styles.kpiValue, { color: "#64748B" }]}>{kpis.delivered}</Text>
        </View>
      </View>

      {/* Filtros source */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterGroupLabel}>Origem</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label="Todos" active={filterSource === "all"} onPress={() => setFilterSource("all")} />
          <FilterChip label="Loja Digital" icon="globe" active={filterSource === "digital"} onPress={() => setFilterSource("digital")} />
          <FilterChip label="PDV" icon="shopping-bag" active={filterSource === "pdv"} onPress={() => setFilterSource("pdv")} />
          <FilterChip label="Marketplace" icon="external-link" active={filterSource === "marketplace"} onPress={() => setFilterSource("marketplace")} />
        </ScrollView>
      </View>

      {/* Filtros status */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterGroupLabel}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label="Todos" active={filterStatus === "all"} onPress={() => setFilterStatus("all")} />
          {STATUS_ORDER.map(s => (
            <FilterChip
              key={s}
              label={STATUS_LABELS[s].label}
              active={filterStatus === s}
              onPress={() => setFilterStatus(s)}
              color={STATUS_LABELS[s].color}
            />
          ))}
        </ScrollView>
      </View>

      {/* Lista de pedidos */}
      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="inbox" size={40} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Nenhum pedido encontrado</Text>
          <Text style={styles.emptyDesc}>
            {orders.length === 0
              ? "Quando você receber pedidos Studio (Loja Digital, PDV ou Marketplace), eles aparecerão aqui."
              : "Nenhum pedido bate com os filtros aplicados. Tente ajustar Origem ou Status."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map(o => {
            const src = SOURCE_LABELS[o.source] || SOURCE_LABELS.digital;
            const st = STATUS_LABELS[o.studio_production_status] || STATUS_LABELS.pending_art;
            const itemsCount = (o as any).items_count ?? (o as any).item_count ?? null;
            return (
              <Pressable key={o.id} style={styles.orderCard} onPress={() => goToOrder(o.id)}>
                <View style={styles.orderHeader}>
                  <View style={[styles.sourceCircle, { backgroundColor: src.bg }]}>
                    <Icon name={src.icon as any} size={12} color={src.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {o.customer_name || "Cliente sem nome"}
                    </Text>
                    <Text style={styles.orderMeta}>
                      {src.label} · {shortId(o.id)}
                      {itemsCount != null ? ` · ${itemsCount} item${itemsCount === 1 ? "" : "s"}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.totalValue}>{formatBRL(o.total)}</Text>
                  </View>
                </View>

                <View style={styles.orderFooter}>
                  <Text style={styles.dateText}>{formatDate(o.created_at)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function FilterChip({
  label, active, onPress, icon, color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: string;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: color || StudioColors.primary, borderColor: color || StudioColors.primary },
      ]}
    >
      {icon && (
        <Icon
          name={icon as any}
          size={12}
          color={active ? "#fff" : "#64748B"}
          style={{ marginRight: 6 }}
        />
      )}
      <Text style={[styles.chipText, active && { color: "#fff", fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 16, paddingBottom: 48 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },

  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#0F172A" },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 4, lineHeight: 18 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  refreshBtnText: { color: StudioColors.primary, fontSize: 13, fontWeight: "600" },
  totalLine: { fontSize: 12, color: "#64748B", marginBottom: 16 },

  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  kpiCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  kpiLabel: { fontSize: 12, color: "#64748B", marginBottom: 6 },
  kpiValue: { fontSize: 24, fontWeight: "700" },

  filterGroup: { marginBottom: 12 },
  filterGroupLabel: { fontSize: 12, color: "#64748B", fontWeight: "600", marginBottom: 6 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipText: { fontSize: 12, color: "#475569" },

  list: { gap: 10, marginTop: 8 },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  orderHeader: { flexDirection: "row", alignItems: "center" },
  sourceCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  customerName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  orderMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  totalValue: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  dateText: { fontSize: 11, color: "#94A3B8" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#0F172A", marginTop: 12 },
  emptyDesc: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 6, lineHeight: 19 },
});
