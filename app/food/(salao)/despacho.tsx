import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { FoodColors } from "@/constants/food-tokens";
import {
  useDispatchBoard,
  type DispatchReadyOrder,
  type DispatchInRouteOrder,
} from "@/hooks/useFoodDispatch";
import { vehicleIcon, type FoodDeliverer } from "@/hooks/useFoodDeliverers";
import { DispatchModal } from "@/components/food/DispatchModal";
import { ConfirmDeliveryModal } from "@/components/food/ConfirmDeliveryModal";

// ============================================================
// /food/(salao)/despacho — Fase 8: board do delivery próprio.
//
// Desktop: 3 colunas (Prontos / Em rota / Motoboys ativos).
// Mobile: tabs (escolher entre os 3).
// Polling 15s via useDispatchBoard.
// ============================================================

type MobileTab = "ready" | "inroute" | "deliverers";

export default function DespachoScreen() {
  const router = useRouter();
  const { data, isLoading } = useDispatchBoard();
  const [dispatchOrder, setDispatchOrder] = useState<DispatchReadyOrder | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<DispatchInRouteOrder | null>(null);
  const [tab, setTab] = useState<MobileTab>("ready");
  const isMobile = Platform.OS !== "web";

  const ready = data?.ready || [];
  const inRoute = data?.inRoute || [];
  const deliverers = data?.deliverers || [];

  // Empty state: sem motoboys ativos cadastrados
  const hasDeliverers = deliverers.length > 0;

  if (!isLoading && !hasDeliverers) {
    return (
      <View style={{ flex: 1 }}>
        <Header />
        <View style={{
          backgroundColor: FoodColors.surface, borderRadius: 12, padding: 32,
          alignItems: "center", borderWidth: 1, borderColor: FoodColors.border, borderStyle: "dashed",
          gap: 10, marginTop: 16,
        }}>
          <Text style={{ fontSize: 48 }}>🏍️</Text>
          <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "700" }}>
            Cadastre seu primeiro motoboy
          </Text>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, textAlign: "center", maxWidth: 360 }}>
            Para usar o despacho do delivery próprio, você precisa de pelo menos 1 entregador ativo.
          </Text>
          <Pressable
            onPress={() => router.push("/food/(salao)/motoboys" as any)}
            style={{
              marginTop: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
              backgroundColor: FoodColors.red,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>→ Ir para Motoboys</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header />

      {isLoading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator color={FoodColors.red} />
        </View>
      ) : isMobile ? (
        <>
          <View style={{ flexDirection: "row", gap: 4, marginVertical: 8 }}>
            <TabBtn label={"Prontos (" + ready.length + ")"} active={tab === "ready"} onPress={() => setTab("ready")} />
            <TabBtn label={"Em rota (" + inRoute.length + ")"} active={tab === "inroute"} onPress={() => setTab("inroute")} />
            <TabBtn label={"Motoboys"} active={tab === "deliverers"} onPress={() => setTab("deliverers")} />
          </View>
          {tab === "ready"      && <ReadyColumn orders={ready} onDispatch={setDispatchOrder} />}
          {tab === "inroute"    && <InRouteColumn orders={inRoute} onConfirm={setConfirmOrder} />}
          {tab === "deliverers" && <DeliverersColumn deliverers={deliverers} onPress={() => router.push("/food/(salao)/motoboys" as any)} />}
        </>
      ) : (
        <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
          <View style={{ flex: 1.1 }}>
            <ColumnHeader title="✓ Prontos" count={ready.length} color={FoodColors.green} />
            <ReadyColumn orders={ready} onDispatch={setDispatchOrder} />
          </View>
          <View style={{ flex: 1.1 }}>
            <ColumnHeader title="🚴 Em rota" count={inRoute.length} color={FoodColors.amber} />
            <InRouteColumn orders={inRoute} onConfirm={setConfirmOrder} />
          </View>
          <View style={{ flex: 0.8 }}>
            <ColumnHeader title="🏍️ Motoboys" count={deliverers.filter(d => d.active).length} color={FoodColors.red} />
            <DeliverersColumn deliverers={deliverers} onPress={() => router.push("/food/(salao)/motoboys" as any)} />
          </View>
        </View>
      )}

      {dispatchOrder && (
        <DispatchModal
          order={dispatchOrder}
          deliverers={deliverers}
          onClose={() => setDispatchOrder(null)}
        />
      )}
      {confirmOrder && (
        <ConfirmDeliveryModal
          order={confirmOrder}
          onClose={() => setConfirmOrder(null)}
        />
      )}
    </View>
  );
}

function Header() {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Despacho</Text>
      <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 2 }}>
        Atribua entregadores aos pedidos prontos e confirme entregas com PIN. Atualiza a cada 15s.
      </Text>
    </View>
  );
}

function ColumnHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 14, paddingVertical: 10,
      borderBottomWidth: 2, borderBottomColor: color,
      backgroundColor: FoodColors.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    }}>
      <Text style={{ fontSize: 13, color, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View style={{
        backgroundColor: FoodColors.surface3, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999,
      }}>
        <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "800" }}>{count}</Text>
      </View>
    </View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center",
      backgroundColor: active ? FoodColors.redDim : FoodColors.surface,
      borderWidth: 1, borderColor: active ? FoodColors.red : FoodColors.border,
    }}>
      <Text style={{
        fontSize: 11, fontWeight: "700",
        color: active ? FoodColors.red : FoodColors.ink3,
      }}>{label}</Text>
    </Pressable>
  );
}

// ============================================================
// Coluna 1 — Prontos (delivery próprio, status=ready)
// ============================================================
function ReadyColumn({
  orders, onDispatch,
}: {
  orders: DispatchReadyOrder[];
  onDispatch: (o: DispatchReadyOrder) => void;
}) {
  return (
    <ScrollView style={{
      flex: 1, backgroundColor: FoodColors.surface,
      borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
      borderWidth: 1, borderColor: FoodColors.border,
      maxHeight: Platform.OS === "web" ? undefined : 520,
    }} contentContainerStyle={{ padding: 10, gap: 8 }}>
      {orders.length === 0 ? (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: FoodColors.ink3 }}>Sem pedidos prontos pra despachar</Text>
        </View>
      ) : orders.map(o => (
        <View key={o.id} style={{
          backgroundColor: FoodColors.surface2, borderRadius: 10, padding: 10,
          borderWidth: 1, borderColor: FoodColors.border,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: FoodColors.green, fontWeight: "800" }}>
              #{o.external_short}
            </Text>
            <Text style={{ fontSize: 11, color: FoodColors.amber, fontWeight: "700" }}>
              {Math.floor(Number(o.waiting_minutes || 0))} min
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: FoodColors.ink, fontWeight: "600" }} numberOfLines={1}>
            {o.customer_name || "Sem nome"}
          </Text>
          {o.address_summary && (
            <Text style={{ fontSize: 11, color: FoodColors.ink3 }} numberOfLines={2}>
              📍 {o.address_summary}
            </Text>
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "800" }}>
              R$ {Number(o.total).toFixed(2)}
            </Text>
            <Pressable onPress={() => onDispatch(o)} style={{
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6,
              backgroundColor: FoodColors.red,
            }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>Despachar</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ============================================================
// Coluna 2 — Em rota
// ============================================================
function InRouteColumn({
  orders, onConfirm,
}: {
  orders: DispatchInRouteOrder[];
  onConfirm: (o: DispatchInRouteOrder) => void;
}) {
  return (
    <ScrollView style={{
      flex: 1, backgroundColor: FoodColors.surface,
      borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
      borderWidth: 1, borderColor: FoodColors.border,
      maxHeight: Platform.OS === "web" ? undefined : 520,
    }} contentContainerStyle={{ padding: 10, gap: 8 }}>
      {orders.length === 0 ? (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: FoodColors.ink3 }}>Sem pedidos em rota</Text>
        </View>
      ) : orders.map(o => (
        <View key={o.id} style={{
          backgroundColor: FoodColors.surface2, borderRadius: 10, padding: 10,
          borderWidth: 1, borderColor: FoodColors.border,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: FoodColors.amber, fontWeight: "800" }}>
              #{o.external_short}
            </Text>
            <Text style={{ fontSize: 11, color: FoodColors.ink3, fontWeight: "700" }}>
              {Math.floor(Number(o.in_route_minutes || 0))} min em rota
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: FoodColors.ink, fontWeight: "600" }} numberOfLines={1}>
            {o.customer_name || "Sem nome"}
          </Text>
          {o.address_summary && (
            <Text style={{ fontSize: 11, color: FoodColors.ink3 }} numberOfLines={2}>
              📍 {o.address_summary}
            </Text>
          )}
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6,
            paddingTop: 6, borderTopWidth: 1, borderTopColor: FoodColors.border, borderStyle: "dashed",
          }}>
            <Text style={{ fontSize: 14 }}>{vehicleIcon(o.deliverer_vehicle)}</Text>
            <Text style={{ flex: 1, fontSize: 11, color: FoodColors.ink2, fontWeight: "600" }} numberOfLines={1}>
              {o.deliverer_name}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "800" }}>
              R$ {Number(o.total).toFixed(2)}
            </Text>
            <Pressable onPress={() => onConfirm(o)} style={{
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6,
              backgroundColor: FoodColors.green,
            }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>Confirmar entrega</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ============================================================
// Coluna 3 — Motoboys ativos (resumo)
// ============================================================
function DeliverersColumn({
  deliverers, onPress,
}: {
  deliverers: FoodDeliverer[];
  onPress: () => void;
}) {
  const active = useMemo(
    () => deliverers.filter(d => d.active)
      .sort((a, b) => Number(b.current_orders_count || 0) - Number(a.current_orders_count || 0)),
    [deliverers],
  );

  return (
    <ScrollView style={{
      flex: 1, backgroundColor: FoodColors.surface,
      borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
      borderWidth: 1, borderColor: FoodColors.border,
      maxHeight: Platform.OS === "web" ? undefined : 520,
    }} contentContainerStyle={{ padding: 10, gap: 6 }}>
      {active.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, textAlign: "center" }}>
            Nenhum motoboy ativo no momento
          </Text>
        </View>
      ) : active.map(d => {
        const inRoute = Number(d.current_orders_count || 0);
        return (
          <Pressable key={d.id} onPress={onPress} style={{
            flexDirection: "row", alignItems: "center", gap: 8, padding: 10,
            borderRadius: 8, backgroundColor: FoodColors.surface2,
            borderWidth: 1, borderColor: FoodColors.border,
          }}>
            <Text style={{ fontSize: 18 }}>{vehicleIcon(d.vehicle)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: FoodColors.ink, fontWeight: "700" }} numberOfLines={1}>
                {d.name}
              </Text>
              <Text style={{ fontSize: 10, color: FoodColors.ink3 }}>
                {inRoute > 0 ? inRoute + " em rota" : "livre"}
                {Number(d.deliveries_today || 0) > 0 ? "  ·  " + d.deliveries_today + " hoje" : ""}
              </Text>
            </View>
            {inRoute > 0 && (
              <View style={{
                backgroundColor: FoodColors.amber, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                minWidth: 22, alignItems: "center",
              }}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{inRoute}</Text>
              </View>
            )}
          </Pressable>
        );
      })}

      <Pressable onPress={onPress} style={{
        marginTop: 6, padding: 10, borderRadius: 8, alignItems: "center",
        backgroundColor: FoodColors.surface2, borderWidth: 1, borderColor: FoodColors.border, borderStyle: "dashed",
      }}>
        <Text style={{ fontSize: 12, color: FoodColors.ink3, fontWeight: "600" }}>
          + Gerenciar motoboys
        </Text>
      </Pressable>
    </ScrollView>
  );
}
