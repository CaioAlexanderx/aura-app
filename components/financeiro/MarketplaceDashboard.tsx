import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { HoverCard } from "@/components/HoverCard";

// ============================================================
// MKT-03: MarketplaceDashboard — Multi-platform order management
// ============================================================

export interface MarketplaceConnection {
  id: string; platform: string; store_name?: string; status: string;
  total_orders: number; mapped_products: number; last_sync?: string;
  sync_products: boolean; sync_orders: boolean; sync_stock: boolean;
}

export interface MarketplaceOrder {
  id: string; platform: string; external_id: string; status: string;
  customer_name?: string; items: { name: string; quantity: number; unit_price: number }[];
  total: number; shipping_cost: number; marketplace_fee: number; net_revenue: number;
  tracking_code?: string; store_name?: string; created_at: string;
}

export interface PlatformStats {
  platform: string; total_orders: number; delivered: number; active: number;
  gmv: number; net_revenue: number; total_fees: number;
}

interface Props {
  connections: MarketplaceConnection[];
  orders: MarketplaceOrder[];
  stats: PlatformStats[];
  onConnect?: (platform: string) => void;
  onSyncOrders?: (connectionId: string) => void;
  onMapProducts?: (connectionId: string) => void;
  onUpdateOrder?: (orderId: string, status: string) => void;
  onViewOrder?: (orderId: string) => void;
}

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); }

const PLATFORMS: Record<string, { name: string; color: string; icon: string }> = {
  mercado_livre: { name: "Mercado Livre", color: "#FFE600", icon: "\uD83D\uDED2" },
  shopee:        { name: "Shopee",        color: "#EE4D2D", icon: "\uD83D\uDED2" },
  amazon:        { name: "Amazon",        color: "#FF9900", icon: "\uD83D\uDCE6" },
  magalu:        { name: "Magalu",        color: "#0086FF", icon: "\uD83D\uDCF1" },
  americanas:    { name: "Americanas",    color: "#EE1233", icon: "\uD83C\uDFE0" },
  shein:         { name: "Shein",         color: "#000000", icon: "\uD83D\uDC57" },
};

const ORDER_ST: Record<string, { bg: string; color: string; label: string }> = {
  novo:       { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", label: "Novo" },
  pago:       { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Pago" },
  separando:  { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Separando" },
  enviado:    { bg: "rgba(124,58,237,0.12)",  color: "#7C3AED", label: "Enviado" },
  entregue:   { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Entregue" },
  cancelado:  { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", label: "Cancelado" },
  devolvido:  { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", label: "Devolvido" },
};

export function MarketplaceDashboard({ connections, orders, stats, onConnect, onSyncOrders, onMapProducts, onUpdateOrder, onViewOrder }: Props) {
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const totalGMV = stats.reduce((s, p) => s + Number(p.gmv), 0);
  const totalNet = stats.reduce((s, p) => s + Number(p.net_revenue), 0);
  const totalFees = stats.reduce((s, p) => s + Number(p.total_fees), 0);
  const totalOrders = stats.reduce((s, p) => s + p.total_orders, 0);

  const filteredOrders = platformFilter ? orders.filter(o => o.platform === platformFilter) : orders;

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <HoverCard style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{fmt(totalGMV)}</Text><Text style={s.kpiLbl}>GMV Total</Text></HoverCard>
        <HoverCard style={s.kpi}><Text style={[s.kpiVal, { color: Colors.violet3 }]}>{fmt(totalNet)}</Text><Text style={s.kpiLbl}>Receita liquida</Text></HoverCard>
        <HoverCard style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{fmt(totalFees)}</Text><Text style={s.kpiLbl}>Taxas marketplace</Text></HoverCard>
        <HoverCard style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{totalOrders}</Text><Text style={s.kpiLbl}>Pedidos</Text></HoverCard>
      </View>

      {/* Platform cards */}
      <Text style={s.sectionTitle}>Canais conectados</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {connections.map(conn => {
          const plat = PLATFORMS[conn.platform] || { name: conn.platform, color: "#888", icon: "\uD83D\uDCE6" };
          const platStats = stats.find(s => s.platform === conn.platform);
          return (
            <Pressable key={conn.id} onPress={() => setPlatformFilter(platformFilter === conn.platform ? null : conn.platform)}
              style={[s.platCard, platformFilter === conn.platform && { borderColor: plat.color }]}>
              <View style={s.platHeader}>
                <Text style={s.platIcon}>{plat.icon}</Text>
                <Text style={[s.platName, { color: plat.color }]}>{plat.name}</Text>
                <View style={[s.connBadge, { backgroundColor: conn.status === "ativo" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)" }]}>
                  <Text style={{ fontSize: 8, fontWeight: "600", color: conn.status === "ativo" ? "#10B981" : "#F59E0B" }}>{conn.status === "ativo" ? "Ativo" : "Pendente"}</Text>
                </View>
              </View>
              <View style={s.platStats}>
                <Text style={s.platStat}>{conn.total_orders} pedidos</Text>
                <Text style={s.platStat}>{conn.mapped_products} produtos</Text>
                {platStats && <Text style={[s.platStat, { color: "#10B981" }]}>{fmt(Number(platStats.net_revenue))}</Text>}
              </View>
              <View style={s.platActions}>
                {onSyncOrders && <Pressable onPress={() => onSyncOrders(conn.id)} style={s.platBtn}><Text style={s.platBtnT}>Sincronizar</Text></Pressable>}
                {onMapProducts && <Pressable onPress={() => onMapProducts(conn.id)} style={s.platBtn}><Text style={s.platBtnT}>Produtos</Text></Pressable>}
              </View>
            </Pressable>
          );
        })}
        {/* Add platform */}
        {onConnect && (
          <View style={s.addPlatCard}>
            <Text style={s.addPlatTitle}>Conectar novo</Text>
            <View style={s.addPlatGrid}>
              {Object.entries(PLATFORMS).filter(([k]) => !connections.some(c => c.platform === k)).map(([key, plat]) => (
                <Pressable key={key} onPress={() => onConnect(key)} style={s.addPlatBtn}>
                  <Text style={s.addPlatIcon}>{plat.icon}</Text>
                  <Text style={s.addPlatName}>{plat.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Revenue per platform bar */}
      {stats.length > 0 && (
        <HoverCard style={s.revenueCard}>
          <Text style={s.revTitle}>Receita por canal</Text>
          {stats.map(st => {
            const plat = PLATFORMS[st.platform] || { name: st.platform, color: "#888" };
            const pct = totalGMV > 0 ? Math.round(Number(st.gmv) / totalGMV * 100) : 0;
            return (
              <View key={st.platform} style={s.revRow}>
                <Text style={[s.revLabel, { color: plat.color }]}>{plat.name}</Text>
                <View style={s.revBarBg}><View style={[s.revBarFill, { width: pct + "%", backgroundColor: plat.color }]} /></View>
                <Text style={s.revPct}>{fmt(Number(st.gmv))} ({pct}%)</Text>
              </View>
            );
          })}
        </HoverCard>
      )}

      {/* Orders list */}
      <Text style={s.sectionTitle}>Pedidos recentes {platformFilter ? `\u2014 ${PLATFORMS[platformFilter]?.name || platformFilter}` : ""}</Text>
      {filteredOrders.map(order => {
        const st = ORDER_ST[order.status] || ORDER_ST.novo;
        const plat = PLATFORMS[order.platform] || { name: order.platform, color: "#888" };
        return (
          <Pressable key={order.id} onPress={() => onViewOrder?.(order.id)} style={s.orderRow}>
            <View style={[s.orderPlat, { backgroundColor: plat.color + "18" }]}><Text style={{ fontSize: 10, fontWeight: "600", color: plat.color }}>{plat.name.substring(0, 3)}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.orderExt}>#{order.external_id}</Text>
              <Text style={s.orderCustomer}>{order.customer_name || "Cliente"}</Text>
              <Text style={s.orderItems}>{order.items?.length || 0} item(s){order.tracking_code ? " \u2022 " + order.tracking_code : ""}</Text>
            </View>
            <View style={s.orderRight}>
              <Text style={s.orderTotal}>{fmt(order.total)}</Text>
              <Text style={s.orderNet}>Liq: {fmt(order.net_revenue)}</Text>
              <View style={[s.badge, { backgroundColor: st.bg }]}><Text style={[s.badgeT, { color: st.color }]}>{st.label}</Text></View>
            </View>
          </Pressable>
        );
      })}
      {filteredOrders.length === 0 && <Text style={s.emptyT}>Nenhum pedido encontrado.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 },
  kpiRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  kpi: { flex: 1, minWidth: IS_WIDE ? 120 : "45%", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kpiVal: { fontSize: 20, fontWeight: "800" }, kpiLbl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  platCard: { width: 200, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  platHeader: { flexDirection: "row", alignItems: "center", gap: 6 }, platIcon: { fontSize: 16 },
  platName: { fontSize: 13, fontWeight: "700", flex: 1 },
  connBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  platStats: { gap: 2 }, platStat: { fontSize: 11, color: Colors.ink3 },
  platActions: { flexDirection: "row", gap: 4 }, platBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 0.5, borderColor: Colors.border }, platBtnT: { fontSize: 9, color: Colors.ink3, fontWeight: "500" },
  addPlatCard: { width: 200, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed", gap: 8 },
  addPlatTitle: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },
  addPlatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  addPlatBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.bg4 },
  addPlatIcon: { fontSize: 12 }, addPlatName: { fontSize: 10, color: Colors.ink2 },
  revenueCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  revTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  revRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  revLabel: { fontSize: 11, fontWeight: "600", width: 80 },
  revBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.bg4 }, revBarFill: { height: 6, borderRadius: 3 },
  revPct: { fontSize: 10, color: Colors.ink3, width: 100, textAlign: "right" },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 0.5, borderColor: Colors.border },
  orderPlat: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  orderExt: { fontSize: 11, fontWeight: "600", color: Colors.ink3, fontFamily: "monospace" },
  orderCustomer: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  orderItems: { fontSize: 10, color: Colors.ink3 },
  orderRight: { alignItems: "flex-end", gap: 2 },
  orderTotal: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  orderNet: { fontSize: 10, color: "#10B981" },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }, badgeT: { fontSize: 9, fontWeight: "600" },
  emptyT: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 20 },
});

export default MarketplaceDashboard;
