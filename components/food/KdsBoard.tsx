import { View, Text, Pressable, ScrollView, Platform, ActivityIndicator } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { Icon } from "@/components/Icon";
import {
  useFoodKds,
  useAdvanceOrderStatusMutation,
  useToggleItemKdsStatusMutation,
  isOrderLate,
  type KdsOrder,
} from "@/hooks/useFoodKds";

// ============================================================
// KdsBoard — 3 colunas (Aguardando confirmed / Preparando /
// Pronto pra servir). Cards grandes pra TV.
// ============================================================

export function KdsBoard() {
  const { confirmed, preparing, ready, isLoading, counts } = useFoodKds();
  const advance = useAdvanceOrderStatusMutation();
  const toggleItem = useToggleItemKdsStatusMutation();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={FoodColors.red} size="large" />
      </View>
    );
  }

  return (
    <View style={{
      flex: 1, flexDirection: "row", gap: 12, padding: 12,
    }}>
      <Column
        title="⏳ Aguardando"
        accent={FoodColors.amber}
        count={counts.confirmed}
        orders={confirmed}
        onAdvance={(o) => advance.mutate({ orderId: o.id, status: "preparing" })}
        onCancel={(o) => advance.mutate({ orderId: o.id, status: "cancelled" })}
        advanceLabel="▶ Iniciar"
        onToggleItem={(orderId, itemId, ks) => toggleItem.mutate({ orderId, itemId, kds_status: ks })}
      />
      <Column
        title="🔥 Preparando"
        accent={FoodColors.cyan}
        count={counts.preparing}
        orders={preparing}
        onAdvance={(o) => advance.mutate({ orderId: o.id, status: "ready" })}
        advanceLabel="✓ Pronto"
        onToggleItem={(orderId, itemId, ks) => toggleItem.mutate({ orderId, itemId, kds_status: ks })}
      />
      <Column
        title="✓ Pronto · servir"
        accent={FoodColors.green}
        count={counts.ready}
        orders={ready}
        onAdvance={(o) => advance.mutate({ orderId: o.id, status: "delivered" })}
        advanceLabel="✓ Servido"
        onToggleItem={(orderId, itemId, ks) => toggleItem.mutate({ orderId, itemId, kds_status: ks })}
      />
    </View>
  );
}

function Column({
  title, accent, count, orders, onAdvance, onCancel, advanceLabel, onToggleItem,
}: {
  title: string;
  accent: string;
  count: number;
  orders: KdsOrder[];
  onAdvance: (o: KdsOrder) => void;
  onCancel?: (o: KdsOrder) => void;
  advanceLabel: string;
  onToggleItem: (orderId: string, itemId: string, ks: "pending" | "preparing" | "done") => void;
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: FoodColors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: FoodColors.border, overflow: "hidden",
    }}>
      <View style={{
        padding: 14, borderBottomWidth: 2, borderBottomColor: accent,
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      }}>
        <Text style={{ fontSize: 14, color: accent, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {title}
        </Text>
        <View style={{
          backgroundColor: FoodColors.surface3, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999,
        }}>
          <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "800" }}>{count}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 10 }}>
        {orders.length === 0 ? (
          <View style={{ paddingVertical: 30, alignItems: "center", opacity: 0.4 }}>
            <Text style={{ fontSize: 12, color: FoodColors.ink3 }}>Sem pedidos</Text>
          </View>
        ) : (
          orders.map(o => (
            <KdsCard
              key={o.id}
              order={o}
              onAdvance={() => onAdvance(o)}
              onCancel={onCancel ? () => onCancel(o) : undefined}
              advanceLabel={advanceLabel}
              onToggleItem={onToggleItem}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function KdsCard({
  order, onAdvance, onCancel, advanceLabel, onToggleItem,
}: {
  order: KdsOrder;
  onAdvance: () => void;
  onCancel?: () => void;
  advanceLabel: string;
  onToggleItem: (orderId: string, itemId: string, ks: "pending" | "preparing" | "done") => void;
}) {
  const late = isOrderLate(order);
  const orderTag = "#" + order.id.slice(0, 6).toUpperCase();
  const time = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const waiting = Math.floor(Number(order.waiting_minutes || 0));
  const waitMm = String(waiting).padStart(2, "0");

  const sourceLabel =
    order.channel === "ifood"            ? "iFood" :
    order.channel === "whatsapp"         ? "WhatsApp" :
    order.channel === "delivery_proprio" ? "Delivery" :
    order.table_number                   ? "Mesa " + order.table_number :
    "Presencial";

  const channelColor =
    order.channel === "ifood"            ? FoodColors.cyan :
    order.channel === "whatsapp"         ? FoodColors.green :
    order.channel === "delivery_proprio" ? FoodColors.amber :
                                           FoodColors.red;

  return (
    <View style={[
      {
        backgroundColor: FoodColors.surface2, borderRadius: 10, padding: 12,
        borderWidth: 2, borderColor: late ? FoodColors.red : FoodColors.border,
      },
      late && Platform.OS === "web" ? ({ animation: "cardpulse 2s infinite" } as any) : {},
    ]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ backgroundColor: channelColor, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{orderTag}</Text>
          </View>
          <Text style={{ fontSize: 10, color: FoodColors.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {sourceLabel}
          </Text>
        </View>
        <Text style={{
          fontSize: 18, fontVariant: ["tabular-nums"], fontWeight: "800",
          color: late ? FoodColors.red : FoodColors.ink,
        }}>
          {waitMm}min
        </Text>
      </View>

      {(order.customer_name || order.table_number) && (
        <Text style={{ fontSize: 11, color: FoodColors.ink3, marginBottom: 6 }}>
          {order.customer_name || (order.table_number ? "Mesa " + order.table_number : "")}
          {time && "  ·  " + time}
        </Text>
      )}

      <View style={{ borderTopWidth: 1, borderTopColor: FoodColors.border, borderStyle: "dashed", paddingTop: 6 }}>
        {order.items.map(item => {
          const next: "pending" | "preparing" | "done" =
            item.kds_status === "pending" ? "preparing" :
            item.kds_status === "preparing" ? "done" :
            "pending";
          return (
            <Pressable
              key={item.id}
              onPress={() => onToggleItem(order.id, item.id, next)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 }}
            >
              <View style={{
                width: 18, height: 18, borderRadius: 4,
                borderWidth: 1.5,
                borderColor:
                  item.kds_status === "done"      ? FoodColors.green :
                  item.kds_status === "preparing" ? FoodColors.cyan :
                  FoodColors.ink4,
                backgroundColor:
                  item.kds_status === "done"      ? FoodColors.green :
                  item.kds_status === "preparing" ? "rgba(6,182,212,0.2)" :
                  "transparent",
                alignItems: "center", justifyContent: "center",
              }}>
                {item.kds_status === "done" && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text>}
              </View>
              <Text style={{ color: FoodColors.ink3, fontWeight: "700", minWidth: 22 }}>{item.quantity}×</Text>
              <Text style={{
                fontSize: 14, flex: 1,
                color: item.kds_status === "done" ? FoodColors.ink4 : FoodColors.ink,
                textDecorationLine: item.kds_status === "done" ? "line-through" : "none",
              }}>
                {item.item_name}
                {item.variation_name ? " (" + item.variation_name + ")" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {order.notes && (
        <View style={{
          backgroundColor: "rgba(245,158,11,0.1)",
          borderLeftWidth: 3, borderLeftColor: FoodColors.amber,
          padding: 6, borderRadius: 4, marginTop: 6,
        }}>
          <Text style={{ fontSize: 11, color: FoodColors.amber, fontWeight: "600" }}>⚠ {order.notes}</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
        {onCancel && (
          <Pressable onPress={onCancel} style={{
            paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6,
            backgroundColor: FoodColors.surface, borderWidth: 1, borderColor: FoodColors.border,
          }}>
            <Text style={{ color: FoodColors.ink3, fontSize: 11, fontWeight: "600" }}>🚫</Text>
          </Pressable>
        )}
        <Pressable onPress={onAdvance} style={{
          flex: 1, paddingVertical: 10, borderRadius: 6,
          backgroundColor: FoodColors.green, alignItems: "center",
        }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>{advanceLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default KdsBoard;
