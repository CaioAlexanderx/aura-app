import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Platform, ActivityIndicator } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { Icon } from "@/components/Icon";
import {
  useDispatchOrder,
  type DispatchReadyOrder,
} from "@/hooks/useFoodDispatch";
import { vehicleIcon, vehicleLabel, type FoodDeliverer } from "@/hooks/useFoodDeliverers";

// ============================================================
// DispatchModal — atribui motoboy a um pedido pronto e mostra PIN.
//
// Fluxo:
//  1. Lista motoboys ativos (ordenada por current_orders_count asc).
//  2. Click no motoboy → POST /dispatch → backend retorna PIN.
//  3. Tela troca pra view do PIN gigante (4 dígitos) + WhatsApp share.
//
// Memory feedback_trocamodal_padrao_canonico: header + corpo + footer
// alinhados ao DNA TrocaModal.
// ============================================================

export function DispatchModal({
  order,
  deliverers,
  onClose,
}: {
  order: DispatchReadyOrder;
  deliverers: FoodDeliverer[];
  onClose: () => void;
}) {
  const dispatchMut = useDispatchOrder();
  const [pin, setPin] = useState<string | null>(null);
  const [chosenDeliverer, setChosenDeliverer] = useState<FoodDeliverer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...deliverers]
      .filter(d => d.active)
      .sort((a, b) => Number(a.current_orders_count || 0) - Number(b.current_orders_count || 0)),
    [deliverers],
  );

  const handlePick = (d: FoodDeliverer) => {
    setError(null);
    setChosenDeliverer(d);
    dispatchMut.mutate(
      { orderId: order.id, delivererId: d.id },
      {
        onSuccess: (r) => setPin(r.deliverer_pin),
        onError: (e: any) => {
          setError(e?.message || "Erro ao despachar");
          setChosenDeliverer(null);
        },
      },
    );
  };

  const handleCopyPin = () => {
    if (!pin || Platform.OS !== "web" || typeof navigator === "undefined") return;
    try { navigator.clipboard.writeText(pin); } catch {}
  };

  const handleWhatsApp = () => {
    if (!pin || !chosenDeliverer) return;
    const phone = (chosenDeliverer.phone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      "Aura Food · Entrega #" + order.external_short + "\n" +
      "PIN: " + pin + "\n\n" +
      "Cliente: " + (order.customer_name || "--") + "\n" +
      "Endereço: " + (order.address_summary || "--") + "\n" +
      "Total R$ " + Number(order.total).toFixed(2) + "\n\n" +
      "Confirme a entrega informando o PIN ao cliente."
    );
    const url = phone
      ? "https://wa.me/55" + phone + "?text=" + msg
      : "https://wa.me/?text=" + msg;
    if (Platform.OS === "web" && typeof window !== "undefined") window.open(url, "_blank");
  };

  return (
    <Overlay onClose={onClose}>
      <View style={{
        width: "100%", maxWidth: 460,
        backgroundColor: FoodColors.bg, borderRadius: 16,
        borderWidth: 1, borderColor: FoodColors.border, overflow: "hidden",
      }}>
        {/* Header */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          padding: 14, borderBottomWidth: 1, borderBottomColor: FoodColors.border,
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10, backgroundColor: FoodColors.redDim,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 18 }}>🏍️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: FoodColors.ink }}>
              {pin ? "Pedido despachado" : "Despachar pedido"}
            </Text>
            <Text style={{ fontSize: 11, color: FoodColors.ink3 }}>
              #{order.external_short} · R$ {Number(order.total).toFixed(2)}
              {order.customer_name ? "  ·  " + order.customer_name : ""}
            </Text>
          </View>
          <Pressable onPress={onClose} style={{
            width: 30, height: 30, borderRadius: 8, backgroundColor: FoodColors.surface,
            alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="x" size={13} color={FoodColors.ink2} />
          </Pressable>
        </View>

        {/* Body */}
        {!pin ? (
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 14, gap: 8 }}>
            {order.address_summary && (
              <View style={{
                backgroundColor: FoodColors.surface, padding: 10, borderRadius: 8,
                borderWidth: 1, borderColor: FoodColors.border, marginBottom: 6,
              }}>
                <Text style={{ fontSize: 10, color: FoodColors.ink3, textTransform: "uppercase",
                  fontWeight: "700", letterSpacing: 0.5 }}>Endereço</Text>
                <Text style={{ fontSize: 13, color: FoodColors.ink, marginTop: 2 }} numberOfLines={2}>
                  {order.address_summary}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 10, color: FoodColors.ink3, textTransform: "uppercase",
              fontWeight: "700", letterSpacing: 0.5 }}>
              Escolha o motoboy
            </Text>

            {sorted.length === 0 ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ fontSize: 12, color: FoodColors.ink3 }}>
                  Nenhum motoboy ativo. Cadastre em Motoboys primeiro.
                </Text>
              </View>
            ) : sorted.map(d => {
              const isChosen = chosenDeliverer?.id === d.id && dispatchMut.isPending;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => handlePick(d)}
                  disabled={dispatchMut.isPending}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 10,
                    padding: 12, borderRadius: 10,
                    backgroundColor: FoodColors.surface,
                    borderWidth: 1, borderColor: isChosen ? FoodColors.red : FoodColors.border,
                    opacity: dispatchMut.isPending && !isChosen ? 0.3 : 1,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 18, backgroundColor: FoodColors.surface2,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ fontSize: 16 }}>{vehicleIcon(d.vehicle)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: FoodColors.ink }}>{d.name}</Text>
                    <Text style={{ fontSize: 10, color: FoodColors.ink3 }}>
                      {vehicleLabel(d.vehicle)}
                      {Number(d.current_orders_count || 0) > 0
                        ? "  ·  " + d.current_orders_count + " em rota"
                        : "  ·  livre agora"}
                    </Text>
                  </View>
                  {isChosen ? (
                    <ActivityIndicator color={FoodColors.red} size="small" />
                  ) : (
                    <Icon name="chevron_right" size={14} color={FoodColors.ink3} />
                  )}
                </Pressable>
              );
            })}

            {error && (
              <View style={{
                backgroundColor: "rgba(239,68,68,0.1)", borderLeftWidth: 3,
                borderLeftColor: FoodColors.red, padding: 10, borderRadius: 6, marginTop: 4,
              }}>
                <Text style={{ fontSize: 12, color: FoodColors.red, fontWeight: "700" }}>{error}</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={{ padding: 24, alignItems: "center", gap: 16 }}>
            <Text style={{ fontSize: 11, color: FoodColors.ink3, textTransform: "uppercase",
              fontWeight: "700", letterSpacing: 1 }}>
              PIN da entrega
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {pin.split("").map((d, i) => (
                <View key={i} style={{
                  width: 56, height: 72, borderRadius: 10,
                  backgroundColor: FoodColors.surface2,
                  borderWidth: 2, borderColor: FoodColors.red,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 36, fontWeight: "900", color: FoodColors.ink,
                    fontVariant: ["tabular-nums"] }}>{d}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 12, color: FoodColors.ink3, textAlign: "center", maxWidth: 320 }}>
              Mostre ou envie ao motoboy {chosenDeliverer?.name || ""}. Ele precisará informar este PIN ao cliente pra confirmar a entrega.
            </Text>

            <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
              <Pressable onPress={handleCopyPin} style={{
                flex: 1, paddingVertical: 11, borderRadius: 8,
                backgroundColor: FoodColors.surface, borderWidth: 1, borderColor: FoodColors.border,
                alignItems: "center",
              }}>
                <Text style={{ color: FoodColors.ink, fontSize: 13, fontWeight: "700" }}>Copiar PIN</Text>
              </Pressable>
              <Pressable onPress={handleWhatsApp} style={{
                flex: 1, paddingVertical: 11, borderRadius: 8,
                backgroundColor: FoodColors.green, alignItems: "center",
              }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Enviar WhatsApp</Text>
              </Pressable>
            </View>

            <Pressable onPress={onClose} style={{
              alignSelf: "stretch", paddingVertical: 12, borderRadius: 8,
              backgroundColor: FoodColors.red, alignItems: "center",
            }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Concluir</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: any; onClose: () => void }) {
  return (
    <Pressable onPress={onClose} style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
      padding: 16, zIndex: 200,
      ...(Platform.OS === "web" ? ({ backdropFilter: "blur(4px)" } as any) : {}),
    }}>
      <Pressable onPress={(e) => { (e as any)?.stopPropagation?.(); }} style={{ width: "100%", maxWidth: 460 }}>
        {children}
      </Pressable>
    </Pressable>
  );
}

export default DispatchModal;
