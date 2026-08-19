import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioApi, StudioOrder, StudioProductionStatus } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

// QA fix (achado #11): esta tab usava uma janela própria (30d/limit 100,
// sem paginação) como fonte de dados, diferente do feed do hub
// /studio/pedidos — os números batiam raramente. Em vez de manter duas
// fontes de verdade, a tab virou um atalho: resumo (KPIs + últimos
// pedidos) + CTA pro hub, que é a única tela com a lista completa/paginada.

// QA fix (achado #20): labels de status/origem tinham cores pastel fixas
// (#FCE7F3 etc) — quebravam no dark mode. Viram funções que recebem o
// StudioPalette e usam os tokens semânticos (successSoft/warningSoft/...).
function statusMeta(t: StudioPalette): Record<StudioProductionStatus, { label: string; color: string; bg: string }> {
  return {
    awaiting_customization: { label: "Aguardando personalização", color: t.accent,     bg: t.accentSoft },
    pending_art:            { label: "Aguardando arte",           color: t.warningInk, bg: t.warningSoft },
    approved:               { label: "Aprovado",                  color: t.infoInk,    bg: t.infoSoft },
    in_production:          { label: "Em produção",                color: t.primary,    bg: t.primarySoft },
    ready:                  { label: "Pronto",                     color: t.successInk, bg: t.successSoft },
    delivered:              { label: "Entregue",                   color: t.ink3,       bg: t.bgSoft },
    cancelled:              { label: "Cancelado",                  color: t.ink4,       bg: t.bgSoft },
  };
}

function sourceMeta(t: StudioPalette): Record<string, { label: string; icon: string; color: string; bg: string }> {
  return {
    digital:     { label: "Loja Digital", icon: "globe",         color: t.primary, bg: t.primarySoft },
    pdv:         { label: "PDV",          icon: "shopping-bag",  color: t.successInk, bg: t.successSoft },
    marketplace: { label: "Marketplace",  icon: "external-link", color: t.warningInk, bg: t.warningSoft },
  };
}

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

const RECENT_COUNT = 5;

export function TabStudioPedidos() {
  const t = useStudioTokens();
  const styles = useMemo(() => buildStyles(t), [t]);
  const STATUS_META = useMemo(() => statusMeta(t), [t]);
  const SOURCE_META = useMemo(() => sourceMeta(t), [t]);
  const router = useRouter();
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<StudioOrder[]>([]);
  // QA fix (achado #18): sem company.id o loading ficava true pra sempre
  // (return antecipado sem setLoading(false)) — spinner infinito.
  const [blocked, setBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id) { setLoading(false); setBlocked(true); return; }
    setBlocked(false);
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

  const recent = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, RECENT_COUNT);
  }, [orders]);

  // Bug #1 (ALTA): navegava pra /studio/kds?focus=, rota do módulo food que
  // não existe pro Studio — card clicava e não fazia nada. O hub de pedidos
  // do Studio tem sua própria página de detalhe em /studio/pedidos/[id].
  function goToOrder(orderId: string) {
    router.push(`/studio/pedidos/${orderId}` as any);
  }

  function goToHub() {
    router.push("/studio/pedidos" as any);
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={t.primary} />
        <Text style={styles.loadingText}>Carregando pedidos…</Text>
      </View>
    );
  }

  if (blocked) {
    return (
      <View style={styles.loadingWrap}>
        <Icon name="alert-circle" size={28} color={t.ink4} />
        <Text style={styles.loadingText}>Não foi possível identificar sua empresa. Recarregue a página.</Text>
      </View>
    );
  }

  // Item #9: a tab não monta mais o próprio ScrollView — StudioScreen
  // (usado por loja-digital.tsx) já é quem rola a tela toda.
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pedidos Studio</Text>
          <Text style={styles.subtitle}>
            Resumo dos últimos 30 dias. A lista completa (com paginação e filtros) fica no hub de Pedidos.
          </Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Icon name="refresh-cw" size={16} color={t.primary} />
          <Text style={styles.refreshBtnText}>Atualizar</Text>
        </Pressable>
      </View>

      {/* KPIs strip */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Aguardando arte</Text>
          <Text style={[styles.kpiValue, { color: t.warningInk }]}>{kpis.pendingArt}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Em produção</Text>
          <Text style={[styles.kpiValue, { color: t.primary }]}>{kpis.inProduction}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Prontos</Text>
          <Text style={[styles.kpiValue, { color: t.successInk }]}>{kpis.ready}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Entregues</Text>
          <Text style={[styles.kpiValue, { color: t.ink3 }]}>{kpis.delivered}</Text>
        </View>
      </View>

      {/* CTA pro hub — atalho principal da tab (achado #11) */}
      <Pressable style={styles.hubBtn} onPress={goToHub}>
        <Icon name="clipboard" size={16} color="#fff" />
        <Text style={styles.hubBtnText}>Ver todos os pedidos</Text>
        <Icon name="arrow-right" size={14} color="#fff" />
      </Pressable>

      {/* Últimos pedidos (preview, não é a lista completa) */}
      <Text style={styles.sectionLabel}>Últimos pedidos</Text>
      {recent.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="inbox" size={40} color={t.ink4} />
          <Text style={styles.emptyTitle}>Nenhum pedido nos últimos 30 dias</Text>
          <Text style={styles.emptyDesc}>
            Quando você receber pedidos Studio (Loja Digital, PDV ou Marketplace), eles aparecerão aqui.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {recent.map(o => {
            const src = SOURCE_META[o.source || "digital"] || SOURCE_META.digital;
            const st = STATUS_META[o.studio_production_status || "pending_art"] || STATUS_META.pending_art;
            return (
              <Pressable key={o.id} style={styles.orderCard} onPress={() => goToOrder(o.id)}>
                <View style={styles.orderHeader}>
                  <View style={[styles.sourceCircle, { backgroundColor: src.bg }]}>
                    <Icon name={src.icon as any} size={12} color={src.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {o.display_name || o.customer_name || "Cliente sem nome"}
                    </Text>
                    <Text style={styles.orderMeta}>
                      {src.label} · {shortId(o.id)}
                      {o.item_count != null ? ` · ${o.item_count} item${o.item_count === 1 ? "" : "s"}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.totalValue}>{formatBRL(o.total_amount)}</Text>
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
    </View>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  loadingText: { marginTop: 4, color: t.ink3, fontSize: 14, textAlign: "center" },

  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16, gap: 12, flexWrap: "wrap" },
  title: { fontSize: 22, fontWeight: "700", color: t.ink },
  subtitle: { fontSize: 13, color: t.ink3, marginTop: 4, lineHeight: 18 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: t.paperCardElev,
    borderWidth: 1,
    borderColor: t.ink5,
    gap: 6,
  },
  refreshBtnText: { color: t.primary, fontSize: 13, fontWeight: "600" },

  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  kpiCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: t.paperCardElev,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  kpiLabel: { fontSize: 12, color: t.ink3, marginBottom: 6 },
  kpiValue: { fontSize: 24, fontWeight: "700" },

  hubBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: t.primary,
    paddingVertical: 13,
    borderRadius: 12,
    marginBottom: 20,
  },
  hubBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  sectionLabel: { fontSize: 12, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 },

  list: { gap: 10 },
  orderCard: {
    backgroundColor: t.paperCardElev,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  orderHeader: { flexDirection: "row", alignItems: "center" },
  sourceCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  customerName: { fontSize: 14, fontWeight: "600", color: t.ink },
  orderMeta: { fontSize: 11, color: t.ink3, marginTop: 2 },
  totalValue: { fontSize: 14, fontWeight: "700", color: t.ink },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: t.bgSoft,
  },
  dateText: { fontSize: 11, color: t.ink4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: t.paperCardElev,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: t.ink, marginTop: 12 },
  emptyDesc: { fontSize: 13, color: t.ink3, textAlign: "center", marginTop: 6, lineHeight: 19 },
});

export default TabStudioPedidos;
