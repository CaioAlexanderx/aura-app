// ============================================================
// AURA STUDIO · /studio/pedidos/marketplace
//
// Sub-ondas Marketplaces S-2 + S-4 (25/05/2026)
//
// Hub de pedidos vindos de marketplace (ML/Shopee) com vertical='studio'.
// - S-2: lista marketplace_orders + CollectCustomizationModal
// - S-4: KPI strip + split por plataforma + tracking form ("Marcar enviado")
//
// Quando a view studio_orders unificada (S-2.5) for usada pelo KDS, o
// lojista tambem pode coletar pelo KDS — esta tela continua sendo a porta
// de entrada dedicada com agregados/SLA.
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import {
  studioApi,
  type MarketplaceOrderStudio,
  type MarketplacePlatform,
} from "@/services/studioApi";
import { CollectCustomizationModal } from "@/components/studio/CollectCustomizationModal";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

const PLATFORM_META: Record<string, { label: string; bg: string; fg: string }> = {
  mercado_livre: { label: "Mercado Livre", bg: "#FEF3C7", fg: "#92400E" },
  shopee:        { label: "Shopee",        bg: "#FFEDD5", fg: "#9A3412" },
};

type Filter = "pending" | "collected" | "all";

type MarketplaceStats = {
  pending: number;
  collected_today: number;
  overdue: number;
  shipped_count: number;
  delivered_count: number;
  total_orders: number;
  avg_ticket: number | null;
  gmv_total: number;
  by_platform: Array<{ platform: string; total: number; pending: number; gmv: number }>;
  computed_at: string;
};

export default function MarketplaceOrdersHub() {
  const router = useRouter();
  const { company } = useAuthStore();
  const cid = company?.id;

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<MarketplaceOrderStudio[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [platformFilter, setPlatformFilter] = useState<MarketplacePlatform | "all">("all");
  const [activeOrder, setActiveOrder] = useState<MarketplaceOrderStudio | null>(null);

  // S-4: stats + tracking form
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [trackingOpen, setTrackingOpen] = useState<Record<string, string>>({});
  const [savingTracking, setSavingTracking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        studioApi.listMarketplaceOrders(cid, {
          pending_only: filter === "pending",
          platform: platformFilter !== "all" ? platformFilter : undefined,
          limit: 200,
        }),
        request<MarketplaceStats>("/companies/" + cid + "/studio/marketplace/stats", { method: "GET" })
          .catch(() => null),
      ]);
      let list = ordersRes.orders || [];
      if (filter === "collected") {
        list = list.filter((o) => !!o.customization_collected_at);
      }
      setOrders(list);
      if (statsRes) setStats(statsRes);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar pedidos");
    } finally { setLoading(false); }
  }, [cid, filter, platformFilter]);

  useEffect(() => { load(); }, [load]);

  async function saveTracking(orderId: string) {
    if (!cid) return;
    const code = (trackingOpen[orderId] || "").trim();
    if (code.length < 3) {
      toast.error("Código de rastreio precisa ter pelo menos 3 caracteres");
      return;
    }
    setSavingTracking(orderId);
    try {
      await request<any>(
        "/companies/" + cid + "/studio/marketplace-orders/" + orderId + "/tracking",
        { method: "PATCH", body: { tracking_code: code } }
      );
      toast.success("✨ Rastreio salvo. Status atualizado pra enviado.");
      setTrackingOpen((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar rastreio");
    } finally { setSavingTracking(null); }
  }

  const pendingCount = orders.filter((o) => !o.customization_collected_at).length;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>VENDAS · MARKETPLACES</Text>
          <Text style={s.title}>Pedidos do Marketplace</Text>
          <Text style={s.sub}>
            Pedidos do ML/Shopee precisam ter personalização coletada antes de produzir, e depois código de rastreio confirmado.
          </Text>
        </View>
        <Pressable style={s.reloadBtn} onPress={load} disabled={loading}>
          <Icon name="refresh-cw" size={14} color={StudioColors.ink2} />
          <Text style={s.reloadTxt}>{loading ? "Atualizando…" : "Atualizar"}</Text>
        </Pressable>
      </View>

      {/* S-4: KPI strip */}
      {stats && (
        <View style={s.kpiStrip}>
          <View style={[s.kpi, stats.pending > 0 && { borderLeftColor: StudioColors.accent, borderLeftWidth: 4 }]}>
            <Text style={s.kpiLabel}>Pendentes</Text>
            <Text style={[s.kpiValue, stats.pending > 0 && { color: StudioColors.accent }]}>
              {stats.pending}
            </Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Coletados hoje</Text>
            <Text style={s.kpiValue}>{stats.collected_today}</Text>
          </View>
          <View style={[s.kpi, stats.overdue > 0 && { borderLeftColor: "#EF4444", borderLeftWidth: 4 }]}>
            <Text style={s.kpiLabel}>Atrasados (&gt;24h)</Text>
            <Text style={[s.kpiValue, stats.overdue > 0 && { color: "#991B1B" }]}>{stats.overdue}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>GMV total</Text>
            <Text style={s.kpiValue}>R$ {Number(stats.gmv_total).toFixed(2)}</Text>
            {stats.avg_ticket != null && (
              <Text style={s.kpiSub}>Ticket médio R$ {Number(stats.avg_ticket).toFixed(2)}</Text>
            )}
          </View>
        </View>
      )}

      {/* S-4: split por plataforma */}
      {stats && stats.by_platform && stats.by_platform.length > 0 && (
        <View style={s.platformSplit}>
          {stats.by_platform.map((p) => {
            const meta = PLATFORM_META[p.platform] || { label: p.platform, bg: "#F1F5F9", fg: "#64748B" };
            return (
              <View key={p.platform} style={[s.platformChip, { backgroundColor: meta.bg }]}>
                <Text style={[s.platformChipLabel, { color: meta.fg }]}>{meta.label}</Text>
                <Text style={[s.platformChipMeta, { color: meta.fg }]}>
                  {p.total} pedidos
                  {p.pending > 0 ? ` · ${p.pending} pendente${p.pending === 1 ? "" : "s"}` : ""}
                  {" · R$ "}{Number(p.gmv).toFixed(2)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Filtros */}
      <View style={s.filterRow}>
        <View style={s.filterGroup}>
          <Text style={s.filterLabel}>Status</Text>
          <View style={s.tabs}>
            {[
              { key: "pending" as Filter, label: "Pendentes" },
              { key: "collected" as Filter, label: "Coletados" },
              { key: "all" as Filter, label: "Todos" },
            ].map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setFilter(t.key)}
                style={[s.tab, filter === t.key && s.tabActive]}
              >
                <Text style={[s.tabTxt, filter === t.key && s.tabTxtActive]}>
                  {t.label}
                  {t.key === "pending" && pendingCount > 0 ? " · " + pendingCount : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.filterGroup}>
          <Text style={s.filterLabel}>Plataforma</Text>
          <View style={s.tabs}>
            {[
              { key: "all" as const, label: "Todas" },
              { key: "mercado_livre" as const, label: "Mercado Livre" },
              { key: "shopee" as const, label: "Shopee" },
            ].map((p) => (
              <Pressable
                key={p.key}
                onPress={() => setPlatformFilter(p.key)}
                style={[s.tab, platformFilter === p.key && s.tabActive]}
              >
                <Text style={[s.tabTxt, platformFilter === p.key && s.tabTxtActive]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Lista */}
      {loading && orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={StudioColors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={s.emptyCard}>
          <View style={s.celebrateEmoji}>
            <Text style={{ fontSize: 36 }}>📦</Text>
          </View>
          <Text style={s.emptyTitle}>
            {filter === "pending" ? "Nada pendente." : "Sem pedidos."}
          </Text>
          <Text style={s.emptySub}>
            {filter === "pending"
              ? "Quando um pedido chegar do ML/Shopee aqui pra coletar a personalização, ele aparece nesta lista."
              : "Pedidos com personalização já coletada vão aparecer aqui quando você tiver."}
          </Text>
          <View style={s.emptyCtas}>
            <Pressable
              onPress={() => router.push("/studio/configuracoes/marketplace" as any)}
              style={[s.emptyBtn, { backgroundColor: StudioColors.primary }]}
            >
              <Icon name="settings" size={14} color="#fff" />
              <Text style={s.emptyBtnTxt}>Configurar anúncios</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list}>
          {orders.map((o) => {
            const platform = PLATFORM_META[o.platform] || { label: o.platform, bg: "#F1F5F9", fg: "#64748B" };
            const pending = !o.customization_collected_at;
            const isShipped = !!((o as any).tracking_code) || o.status === "enviado" || o.status === "entregue";
            const hours = (Date.now() - new Date(o.created_at).getTime()) / 3600000;
            const ageTxt = hours < 24 ? Math.round(hours) + "h" : Math.round(hours / 24) + "d";
            const ageWarn = pending && hours > 24;
            const trackingValue = trackingOpen[o.id];
            const trackingFormVisible = trackingValue !== undefined;

            return (
              <View
                key={o.id}
                style={[s.card, pending && s.cardPending]}
              >
                <Pressable
                  onPress={() => pending && setActiveOrder(o)}
                  disabled={!pending}
                >
                  <View style={s.cardHead}>
                    <View style={[s.platformBadge, { backgroundColor: platform.bg }]}>
                      <Text style={[s.platformBadgeTxt, { color: platform.fg }]}>
                        {platform.label}
                      </Text>
                    </View>
                    <Text style={[s.ageBadge, ageWarn && s.ageBadgeWarn]}>
                      {ageWarn ? "⚠ " : ""}{ageTxt} atrás
                    </Text>
                  </View>

                  <Text style={s.cardOrderId}>#{o.external_id || o.id.slice(0, 8)}</Text>
                  <Text style={s.cardCustomer} numberOfLines={1}>
                    {o.customer_name || "Sem nome"}
                  </Text>
                  <Text style={s.cardMeta}>
                    {Array.isArray(o.items) ? o.items.length : 0} item{(Array.isArray(o.items) ? o.items.length : 0) === 1 ? "" : "s"}
                    {" · R$ "}{Number(o.total).toFixed(2)}
                  </Text>

                  {pending ? (
                    <View style={s.cardCta}>
                      <Icon name="message-circle" size={12} color="#fff" />
                      <Text style={s.cardCtaTxt}>Coletar personalização →</Text>
                    </View>
                  ) : isShipped ? (
                    <View style={s.shippedBadge}>
                      <Icon name="package" size={11} color="#1E40AF" />
                      <Text style={s.shippedTxt}>
                        Enviado · {(o as any).tracking_code || "—"}
                      </Text>
                    </View>
                  ) : (
                    <View style={s.collectedBadge}>
                      <Icon name="check" size={11} color="#065F46" />
                      <Text style={s.collectedTxt}>
                        Coletado · {o.customization_collected_at
                          ? new Date(o.customization_collected_at).toLocaleDateString("pt-BR")
                          : ""}
                      </Text>
                    </View>
                  )}
                </Pressable>

                {/* S-4: form tracking pra pedidos coletados mas ainda não enviados */}
                {!pending && !isShipped && (
                  <View style={s.trackingArea}>
                    {!trackingFormVisible ? (
                      <Pressable
                        onPress={() => setTrackingOpen((prev) => ({ ...prev, [o.id]: "" }))}
                        style={s.trackingBtn}
                      >
                        <Icon name="package" size={11} color={StudioColors.primary} />
                        <Text style={s.trackingBtnTxt}>Marcar como enviado</Text>
                      </Pressable>
                    ) : (
                      <View style={s.trackingFormRow}>
                        <TextInput
                          value={trackingValue}
                          onChangeText={(v) => setTrackingOpen((prev) => ({ ...prev, [o.id]: v }))}
                          placeholder="Código de rastreio"
                          placeholderTextColor={StudioColors.ink4}
                          style={s.trackingInput}
                          autoFocus
                        />
                        <Pressable
                          onPress={() => saveTracking(o.id)}
                          disabled={savingTracking === o.id}
                          style={[s.trackingSave, savingTracking === o.id && { opacity: 0.4 }]}
                        >
                          {savingTracking === o.id ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={s.trackingSaveTxt}>Salvar</Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => setTrackingOpen((prev) => {
                            const next = { ...prev }; delete next[o.id]; return next;
                          })}
                          style={s.trackingCancel}
                        >
                          <Icon name="x" size={14} color={StudioColors.ink3} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={!!activeOrder}
        animationType="slide"
        onRequestClose={() => setActiveOrder(null)}
      >
        {activeOrder && (
          <CollectCustomizationModal
            order={activeOrder}
            onClose={() => setActiveOrder(null)}
            onSaved={() => { setActiveOrder(null); load(); }}
          />
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: StudioColors.bg },
  header: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 28, paddingTop: 24, paddingBottom: 12, gap: 16, flexWrap: "wrap",
  },
  eyebrow: { fontSize: 11, color: StudioColors.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: StudioColors.ink, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: StudioColors.ink3, marginTop: 4, maxWidth: 620, lineHeight: 19 },
  reloadBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: StudioColors.ink5,
  },
  reloadTxt: { fontSize: 12.5, color: StudioColors.ink2, fontWeight: "600" },

  // S-4 KPI strip
  kpiStrip: {
    flexDirection: "row", gap: 10, flexWrap: "wrap",
    paddingHorizontal: 28, paddingBottom: 8,
  },
  kpi: {
    flex: 1, minWidth: 140,
    padding: 14, gap: 4,
    backgroundColor: StudioColors.paperCard,
    borderRadius: 12, borderWidth: 1, borderColor: StudioColors.ink5,
  },
  kpiLabel: { fontSize: 10.5, color: StudioColors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 22, fontWeight: "800", color: StudioColors.ink, letterSpacing: -0.5 },
  kpiSub: { fontSize: 11, color: StudioColors.ink3 },

  platformSplit: {
    flexDirection: "row", gap: 8, paddingHorizontal: 28, paddingBottom: 12, flexWrap: "wrap",
  },
  platformChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    minWidth: 220,
  },
  platformChipLabel: { fontSize: 12, fontWeight: "800" },
  platformChipMeta: { fontSize: 11, marginTop: 2, opacity: 0.8 },

  filterRow: { paddingHorizontal: 28, paddingBottom: 12, gap: 12, flexDirection: "row", flexWrap: "wrap" },
  filterGroup: { gap: 6 },
  filterLabel: { fontSize: 10.5, color: StudioColors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  tabs: { flexDirection: "row", gap: 6 },
  tab: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: StudioColors.ink5,
  },
  tabActive: { backgroundColor: StudioColors.primarySoft, borderColor: StudioColors.primary },
  tabTxt: { fontSize: 12, color: StudioColors.ink2, fontWeight: "700" },
  tabTxtActive: { color: StudioColors.primary },

  list: { padding: 20, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14, padding: 14, gap: 6,
    borderWidth: 1, borderColor: StudioColors.ink5,
  },
  cardPending: { borderColor: StudioColors.accent, borderWidth: 2 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  platformBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  platformBadgeTxt: { fontSize: 11, fontWeight: "800" },
  ageBadge: { fontSize: 11, color: StudioColors.ink3, fontWeight: "700" },
  ageBadgeWarn: { color: "#991B1B" },

  cardOrderId: { fontSize: 11, color: StudioColors.ink4, fontWeight: "700", letterSpacing: 0.5 },
  cardCustomer: { fontSize: 14, color: StudioColors.ink, fontWeight: "800" },
  cardMeta: { fontSize: 11.5, color: StudioColors.ink3 },

  cardCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: StudioColors.accent,
    paddingVertical: 10, borderRadius: 10, marginTop: 6,
  },
  cardCtaTxt: { color: "#fff", fontWeight: "800", fontSize: 12.5 },

  collectedBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    alignSelf: "flex-start", marginTop: 6,
  },
  collectedTxt: { fontSize: 10.5, color: "#065F46", fontWeight: "700" },

  shippedBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    alignSelf: "flex-start", marginTop: 6,
  },
  shippedTxt: { fontSize: 10.5, color: "#1E40AF", fontWeight: "700" },

  trackingArea: {
    borderTopWidth: 1, borderTopColor: StudioColors.ink5,
    paddingTop: 10, marginTop: 6,
  },
  trackingBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: StudioColors.primarySoft,
    alignSelf: "flex-start",
  },
  trackingBtnTxt: { color: StudioColors.primary, fontSize: 11.5, fontWeight: "800" },

  trackingFormRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  trackingInput: {
    flex: 1, backgroundColor: "#fff", color: StudioColors.ink,
    padding: 8, borderRadius: 8, fontSize: 12,
    borderWidth: 1.5, borderColor: StudioColors.ink5,
  },
  trackingSave: {
    backgroundColor: StudioColors.primary,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  trackingSaveTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  trackingCancel: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: StudioColors.bgSoft,
  },

  emptyCard: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 40, gap: 10, margin: 28,
    backgroundColor: StudioColors.paperCard, borderRadius: 18,
    borderWidth: 1, borderColor: StudioColors.ink5,
  },
  celebrateEmoji: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: StudioColors.mintSoft,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: StudioColors.ink, marginTop: 6 },
  emptySub: { fontSize: 13, color: StudioColors.ink3, textAlign: "center", maxWidth: 460, lineHeight: 19 },
  emptyCtas: { flexDirection: "row", gap: 10, marginTop: 16 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
  },
  emptyBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
