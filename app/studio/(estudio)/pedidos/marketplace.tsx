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
import { useMemo, useEffect, useState, useCallback } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import {
  studioApi,
  type MarketplaceOrderStudio,
  type MarketplacePlatform,
} from "@/services/studioApi";
import { CollectCustomizationModal } from "@/components/studio/CollectCustomizationModal";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";

// FIX (bug #20 QA): cores hardcoded fora dos tokens Studio — migradas pros
// tokens semânticos (warning/danger) que já existem e respeitam light/dark.
function buildPlatformMeta(t: StudioPalette): Record<string, { label: string; bg: string; fg: string }> {
  return {
    mercado_livre: { label: "Mercado Livre", bg: t.warningSoft, fg: t.warningInk },
    shopee:        { label: "Shopee",        bg: t.dangerSoft,  fg: t.dangerInk },
  };
}

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
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const PLATFORM_META = useMemo(() => buildPlatformMeta(t), [t]);
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

  // FIX (bug #19 QA): tela montava header/loading/empty à mão em vez de usar
  // os componentes canônicos Studio — migrado pra StudioScreen +
  // StudioPageHeader + StudioLoading/StudioEmpty, igual ao resto do app.
  return (
    <StudioScreen variant="reading">
      <StudioPageHeader
        eyebrow="VENDAS · MARKETPLACES"
        title="Pedidos do Marketplace"
        subtitle="Pedidos do ML/Shopee precisam ter personalização coletada antes de produzir, e depois código de rastreio confirmado."
        rightSlot={
          <Pressable style={s.reloadBtn} onPress={load} disabled={loading}>
            <Icon name="refresh-cw" size={14} color={t.ink2} />
            <Text style={s.reloadTxt}>{loading ? "Atualizando…" : "Atualizar"}</Text>
          </Pressable>
        }
      />

      {/* S-4: KPI strip */}
      {stats && (
        <View style={s.kpiStrip}>
          <View style={[s.kpi, stats.pending > 0 && { borderLeftColor: t.accent, borderLeftWidth: 4 }]}>
            <Text style={s.kpiLabel}>Pendentes</Text>
            <Text style={[s.kpiValue, stats.pending > 0 && { color: t.accent }]}>
              {stats.pending}
            </Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Coletados hoje</Text>
            <Text style={s.kpiValue}>{stats.collected_today}</Text>
          </View>
          <View style={[s.kpi, stats.overdue > 0 && { borderLeftColor: t.danger, borderLeftWidth: 4 }]}>
            <Text style={s.kpiLabel}>Atrasados (&gt;24h)</Text>
            <Text style={[s.kpiValue, stats.overdue > 0 && { color: t.dangerInk }]}>{stats.overdue}</Text>
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
            const meta = PLATFORM_META[p.platform] || { label: p.platform, bg: t.bgSoft, fg: t.ink3 };
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
        <StudioLoading variant="skeleton-list" rows={5} />
      ) : orders.length === 0 ? (
        <StudioEmpty
          emoji="📦"
          tone={filter === "pending" ? "celebration" : "default"}
          title={filter === "pending" ? "Nada pendente." : "Sem pedidos."}
          desc={
            filter === "pending"
              ? "Quando um pedido chegar do ML/Shopee aqui pra coletar a personalização, ele aparece nesta lista."
              : "Pedidos com personalização já coletada vão aparecer aqui quando você tiver."
          }
          primaryCta={{
            label: "Configurar anúncios",
            onPress: () => router.push("/studio/configuracoes/marketplace" as any),
          }}
        />
      ) : (
        <View style={s.list}>
          {orders.map((o) => {
            const platform = PLATFORM_META[o.platform] || { label: o.platform, bg: t.bgSoft, fg: t.ink3 };
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
                        <Icon name="package" size={11} color={t.primary} />
                        <Text style={s.trackingBtnTxt}>Marcar como enviado</Text>
                      </Pressable>
                    ) : (
                      <View style={s.trackingFormRow}>
                        <TextInput
                          value={trackingValue}
                          onChangeText={(v) => setTrackingOpen((prev) => ({ ...prev, [o.id]: v }))}
                          placeholder="Código de rastreio"
                          placeholderTextColor={t.ink4}
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
                          <Icon name="x" size={14} color={t.ink3} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
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
    </StudioScreen>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  // FIX (bug #19 QA): header/wrap manuais removidos — StudioScreen +
  // StudioPageHeader agora cuidam de fundo, largura e padding da tela.
  reloadBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5,
  },
  reloadTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "600" },

  // S-4 KPI strip — sem paddingHorizontal próprio: StudioScreen já
  // acolchoa a tela inteira (evitava indentação dobrada com o header).
  kpiStrip: {
    flexDirection: "row", gap: 10, flexWrap: "wrap",
    paddingBottom: 8,
  },
  kpi: {
    flex: 1, minWidth: 140,
    padding: 14, gap: 4,
    backgroundColor: t.paperCard,
    borderRadius: 12, borderWidth: 1, borderColor: t.ink5,
  },
  kpiLabel: { fontSize: 10.5, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 22, fontWeight: "800", color: t.ink, letterSpacing: -0.5 },
  kpiSub: { fontSize: 11, color: t.ink3 },

  platformSplit: {
    flexDirection: "row", gap: 8, paddingBottom: 12, flexWrap: "wrap",
  },
  platformChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    minWidth: 220,
  },
  platformChipLabel: { fontSize: 12, fontWeight: "800" },
  platformChipMeta: { fontSize: 11, marginTop: 2, opacity: 0.8 },

  filterRow: { paddingBottom: 12, gap: 12, flexDirection: "row", flexWrap: "wrap" },
  filterGroup: { gap: 6 },
  filterLabel: { fontSize: 10.5, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  tabs: { flexDirection: "row", gap: 6 },
  tab: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5,
  },
  tabActive: { backgroundColor: t.primarySoft, borderColor: t.primary },
  tabTxt: { fontSize: 12, color: t.ink2, fontWeight: "700" },
  tabTxtActive: { color: t.primary },

  list: { gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: t.paperCardElev,
    borderRadius: 14, padding: 14, gap: 6,
    borderWidth: 1, borderColor: t.ink5,
  },
  cardPending: { borderColor: t.accent, borderWidth: 2 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  platformBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  platformBadgeTxt: { fontSize: 11, fontWeight: "800" },
  ageBadge: { fontSize: 11, color: t.ink3, fontWeight: "700" },
  ageBadgeWarn: { color: t.dangerInk },

  cardOrderId: { fontSize: 11, color: t.ink4, fontWeight: "700", letterSpacing: 0.5 },
  cardCustomer: { fontSize: 14, color: t.ink, fontWeight: "800" },
  cardMeta: { fontSize: 11.5, color: t.ink3 },

  cardCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: t.accent,
    paddingVertical: 10, borderRadius: 10, marginTop: 6,
  },
  cardCtaTxt: { color: "#fff", fontWeight: "800", fontSize: 12.5 },

  collectedBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: t.successSoft,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    alignSelf: "flex-start", marginTop: 6,
  },
  collectedTxt: { fontSize: 10.5, color: t.successInk, fontWeight: "700" },

  shippedBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: t.infoSoft,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    alignSelf: "flex-start", marginTop: 6,
  },
  shippedTxt: { fontSize: 10.5, color: t.infoInk, fontWeight: "700" },

  trackingArea: {
    borderTopWidth: 1, borderTopColor: t.ink5,
    paddingTop: 10, marginTop: 6,
  },
  trackingBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: t.primarySoft,
    alignSelf: "flex-start",
  },
  trackingBtnTxt: { color: t.primary, fontSize: 11.5, fontWeight: "800" },

  trackingFormRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  trackingInput: {
    flex: 1, backgroundColor: t.paperCardElev, color: t.ink,
    padding: 8, borderRadius: 8, fontSize: 12,
    borderWidth: 1.5, borderColor: t.ink5,
  },
  trackingSave: {
    backgroundColor: t.primary,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  trackingSaveTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  trackingCancel: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: t.bgSoft,
  },

});
