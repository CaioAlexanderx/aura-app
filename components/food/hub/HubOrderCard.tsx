import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Platform } from "react-native";
import { FoodTokensV2 } from "@/constants/food-tokens";
import { GlassCard } from "@/components/food/foundation/GlassCard";
import { Icon } from "@/components/Icon";
import type { HubOrder } from "@/hooks/useFoodHub";
import { orderAgeMinutes, orderAgeStatus, isNewOrder } from "@/hooks/useFoodHub";

const CHANNEL_COLOR: Record<string, string> = {
  ifood: FoodTokensV2.cIfood,
  "99food": FoodTokensV2.c99food,
  digital: FoodTokensV2.cDigital,
  whatsapp: FoodTokensV2.cWhatsapp,
  presencial: FoodTokensV2.cPresencial,
};

const CHANNEL_LABEL: Record<string, string> = {
  ifood: "iFood",
  "99food": "99Food",
  digital: "Canal",
  whatsapp: "WhatsApp",
  presencial: "Presencial",
};

const AGE_LATERAL: Record<string, string> = {
  ok: FoodTokensV2.stPronto,
  warn: FoodTokensV2.stPrep,
  late: FoodTokensV2.primary,
};

function resolveChannelKey(o: HubOrder): string {
  if (o.external_channel) return o.external_channel;
  if (o.channel) return o.channel;
  if (o.source === "digital_orders") return "digital";
  return "presencial";
}

function formatBRL(n: number) {
  return "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function metaTag(o: HubOrder): { icon: string; text: string } {
  if (o.table_number) return { icon: "users", text: "Mesa " + o.table_number };
  if (o.delivery_mode === "pickup") return { icon: "shopping_bag", text: "Retirada" };
  if (o.delivery_mode === "delivery" || o.customer_address) return { icon: "truck", text: "Delivery" };
  return { icon: "clipboard", text: "Pedido" };
}

function shortAddress(addr: any): string | null {
  if (!addr) return null;
  if (typeof addr === "string") return addr;
  const street = addr.street || addr.logradouro || "";
  const number = addr.number || addr.numero || "";
  const district = addr.district || addr.bairro || "";
  const parts = [street && number ? street + ", " + number : street, district].filter(Boolean);
  return parts.join(" — ") || null;
}

interface Props {
  order: HubOrder;
  onAccept?: (o: HubOrder) => void;
  onReject?: (o: HubOrder) => void;
  onPrint?: (o: HubOrder) => void;
  onDispatch?: (o: HubOrder) => void;
  onOpenNfce?: (o: HubOrder) => void;
  onOpen?: (o: HubOrder) => void;
}

export function HubOrderCard({ order, onAccept, onReject, onPrint, onDispatch, onOpenNfce, onOpen }: Props) {
  const channelKey = resolveChannelKey(order);
  const channelColor = CHANNEL_COLOR[channelKey] || FoodTokensV2.ink3;
  const channelLabel = CHANNEL_LABEL[channelKey] || channelKey;
  const age = orderAgeMinutes(order.created_at);
  const ageStatus = orderAgeStatus(order.created_at);
  const lateralColor = AGE_LATERAL[ageStatus];
  const meta = metaTag(order);
  const address = shortAddress(order.customer_address);
  const status = (order.status || "").toLowerCase();
  const isNew = isNewOrder(order.created_at) && (status === "pending" || status === "awaiting_approval" || status === "pending_payment");

  // Pulse animation pra pedidos novos
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isNew) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.015, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isNew, pulse]);

  const externalId = order.external_order_id ? "#" + order.external_order_id : "#" + order.id.slice(0, 6).toUpperCase();

  const canAccept = status === "pending" || status === "awaiting_approval" || status === "pending_payment";
  const canDispatch = status === "ready" && (order.delivery_mode === "delivery" || order.source === "digital_orders");

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Pressable onPress={() => onOpen?.(order)}>
        <GlassCard hover style={styles.card}>
          {/* lateral aging color */}
          <View style={[styles.lateral, { backgroundColor: lateralColor }]} />

          <View style={styles.inner}>
            {/* header */}
            <View style={styles.headerRow}>
              <View style={[styles.channelBadge, { backgroundColor: channelColor }]}>
                <Text style={[styles.channelBadgeText, channelKey === "99food" && { color: FoodTokensV2.c99foodText }]}>{channelLabel}</Text>
              </View>
              <Text style={styles.externalId}>{externalId}</Text>
              <View style={styles.spacer} />
              <Text style={[styles.age, ageStatus === "late" && { color: FoodTokensV2.primary, fontWeight: "700" }]}>
                {age <= 0 ? "agora" : age + " min"}
              </Text>
              {isNew && (
                <View style={styles.newPill}>
                  <Text style={styles.newPillText}>NOVO</Text>
                </View>
              )}
            </View>

            {/* customer */}
            <Text style={styles.customer} numberOfLines={1}>{order.customer_name || "Cliente sem nome"}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaTag}>
                <Icon name={meta.icon as any} size={11} color={FoodTokensV2.ink3} />
                <Text style={styles.metaText}>{meta.text}</Text>
              </View>
              {order.deliverer_name && (
                <View style={styles.metaTag}>
                  <Icon name="bike" size={11} color={FoodTokensV2.violet} />
                  <Text style={[styles.metaText, { color: FoodTokensV2.violet }]}>{order.deliverer_name}</Text>
                </View>
              )}
            </View>
            {address && <Text style={styles.address} numberOfLines={2}>{address}</Text>}

            {/* items */}
            <View style={styles.itemsBox}>
              {(order.items || []).slice(0, 4).map((it, idx) => (
                <Text key={idx} style={styles.itemLine} numberOfLines={1}>
                  <Text style={styles.qty}>{it.quantity}× </Text>
                  {it.name}{it.variation ? " · " + it.variation : ""}
                </Text>
              ))}
              {(order.items || []).length > 4 && (
                <Text style={styles.itemMore}>+{(order.items || []).length - 4} item(s)</Text>
              )}
            </View>

            {/* NFC-e link */}
            {order.nfce_emission_id && (
              <Pressable onPress={(e) => { e.stopPropagation?.(); onOpenNfce?.(order); }} style={styles.nfceLink}>
                <Icon name="file_text" size={11} color={FoodTokensV2.violet} />
                <Text style={styles.nfceText}>NFC-e emitida · ver</Text>
              </Pressable>
            )}

            {/* footer */}
            <View style={styles.footer}>
              <Text style={styles.total}>{formatBRL(order.total_amount)}</Text>
              <View style={styles.actions}>
                {canAccept && onReject && (
                  <Pressable onPress={(e) => { e.stopPropagation?.(); onReject(order); }} style={[styles.btn, styles.btnGhost]}>
                    <Text style={[styles.btnText, { color: FoodTokensV2.ink3 }]}>Recusar</Text>
                  </Pressable>
                )}
                {canAccept && onAccept && (
                  <Pressable onPress={(e) => { e.stopPropagation?.(); onAccept(order); }} style={[styles.btn, styles.btnPrimary]}>
                    <Text style={[styles.btnText, { color: "#fff" }]}>Aceitar</Text>
                  </Pressable>
                )}
                {onPrint && (
                  <Pressable onPress={(e) => { e.stopPropagation?.(); onPrint(order); }} style={[styles.btn, styles.btnGhost]}>
                    <Icon name="printer" size={12} color={FoodTokensV2.ink3} />
                  </Pressable>
                )}
                {canDispatch && onDispatch && (
                  <Pressable onPress={(e) => { e.stopPropagation?.(); onDispatch(order); }} style={[styles.btn, styles.btnViolet]}>
                    <Icon name="bike" size={12} color="#fff" />
                    <Text style={[styles.btnText, { color: "#fff", marginLeft: 4 }]}>Despachar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  lateral: {
    position: "absolute",
    top: 0, left: 0, bottom: 0,
    width: 3,
    opacity: 0.85,
  },
  inner: { padding: 12, paddingLeft: 14, gap: 6 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  channelBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  channelBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.4, textTransform: "uppercase" },
  externalId: {
    fontSize: 10, color: FoodTokensV2.ink3, fontWeight: "600",
    fontFamily: Platform.OS === "web" ? "JetBrains Mono, monospace" : undefined,
  },
  spacer: { flex: 1 },
  age: { fontSize: 10, color: FoodTokensV2.ink3 },
  newPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: FoodTokensV2.primary },
  newPillText: { fontSize: 8, color: "#fff", fontWeight: "800", letterSpacing: 0.6 },
  customer: { fontSize: 14, fontWeight: "700", color: FoodTokensV2.ink, marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: FoodTokensV2.bg2,
  },
  metaText: { fontSize: 10, color: FoodTokensV2.ink3, fontWeight: "600" },
  address: { fontSize: 11, color: FoodTokensV2.ink3, lineHeight: 15 },
  itemsBox: {
    backgroundColor: FoodTokensV2.bg2,
    borderRadius: FoodTokensV2.rSm,
    padding: 8,
    gap: 2,
  },
  itemLine: { fontSize: 11, color: FoodTokensV2.ink2 },
  qty: { fontWeight: "700", color: FoodTokensV2.primary },
  itemMore: { fontSize: 10, color: FoodTokensV2.ink4, fontStyle: "italic" },
  nfceLink: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: FoodTokensV2.violetSoft,
    borderWidth: 1, borderColor: FoodTokensV2.violetLine,
    alignSelf: "flex-start",
  },
  nfceText: { fontSize: 10, color: FoodTokensV2.violet, fontWeight: "700" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  total: { fontSize: 16, fontWeight: "800", color: FoodTokensV2.ink, letterSpacing: -0.4 },
  actions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  btn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
    minHeight: 28,
  },
  btnGhost: { backgroundColor: FoodTokensV2.bg2, borderWidth: 1, borderColor: FoodTokensV2.line2 },
  btnPrimary: { backgroundColor: FoodTokensV2.primary },
  btnViolet: { backgroundColor: FoodTokensV2.violet },
  btnText: { fontSize: 11, fontWeight: "700" },
});
