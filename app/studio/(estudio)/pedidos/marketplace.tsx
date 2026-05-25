// ============================================================
// AURA STUDIO · /studio/pedidos/marketplace
//
// Sub-onda Marketplaces S-2 (25/05/2026)
//
// Hub de pedidos vindos de marketplace (ML/Shopee) com vertical='studio'.
// Lista marketplace_orders pendentes de coleta de personalização +
// histórico recente. Click no card abre CollectCustomizationModal.
//
// View studio_orders (KDS) ainda nao une marketplace_orders — entao
// pedidos de marketplace nao aparecem no KDS principal ate aquela view
// ser estendida. Esta tela e a porta de entrada exclusiva pros pedidos
// marketplace ate la.
//
// Quando S-2.5 (view unificada) for entregue, esta tela vira opcional —
// usuario pode coletar personalizacao direto pelo KDS.
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Modal,
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
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

const PLATFORM_META: Record<string, { label: string; bg: string; fg: string }> = {
  mercado_livre: { label: "Mercado Livre", bg: "#FEF3C7", fg: "#92400E" },
  shopee:        { label: "Shopee",        bg: "#FFEDD5", fg: "#9A3412" },
};

type Filter = "pending" | "collected" | "all";

export default function MarketplaceOrdersHub() {
  const router = useRouter();
  const { company } = useAuthStore();
  const cid = company?.id;

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<MarketplaceOrderStudio[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [platformFilter, setPlatformFilter] = useState<MarketplacePlatform | "all">("all");
  const [activeOrder, setActiveOrder] = useState<MarketplaceOrderStudio | null>(null);

  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const r = await studioApi.listMarketplaceOrders(cid, {
        pending_only: filter === "pending",
        platform: platformFilter !== "all" ? platformFilter : undefined,
        limit: 200,
      });
      let list = r.orders || [];
      // Filtro local pra "collected" quando pending_only=false
      if (filter === "collected") {
        list = list.filter((o) => !!o.customization_collected_at);
      }
      setOrders(list);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar pedidos");
    } finally { setLoading(false); }
  }, [cid, filter, platformFilter]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = orders.filter((o) => !o.customization_collected_at).length;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>VENDAS · MARKETPLACES</Text>
          <Text style={s.title}>Pedidos do Marketplace</Text>
          <Text style={s.sub}>
            Pedidos que chegaram do ML/Shopee precisam ter a personalização coletada antes de virar produção.
            Click no card e preencha o que o cliente pediu.
          </Text>
        </View>
        <Pressable style={s.reloadBtn} onPress={load} disabled={loading}>
          <Icon name="refresh-cw" size={14} color={StudioColors.ink2} />
          <Text style={s.reloadTxt}>{loading ? "Atualizando…" : "Atualizar"}</Text>
        </Pressable>
      </View>

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
            const hours = (Date.now() - new Date(o.created_at).getTime()) / 3600000;
            const ageTxt = hours < 24 ? Math.round(hours) + "h" : Math.round(hours / 24) + "d";
            const ageWarn = pending && hours > 24;

            return (
              <Pressable
                key={o.id}
                style={[s.card, pending && s.cardPending]}
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
                ) : (
                  <View style={s.collectedBadge}>
                    <Icon name="check" size={11} color="#065F46" />
                    <Text style={s.collectedTxt}>
                      Personalização coletada · {o.customization_collected_at
                        ? new Date(o.customization_collected_at).toLocaleDateString("pt-BR")
                        : ""}
                    </Text>
                  </View>
                )}
              </Pressable>
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
    paddingHorizontal: 28, paddingTop: 24, paddingBottom: 16, gap: 16, flexWrap: "wrap",
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
