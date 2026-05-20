import { useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, Platform, ActivityIndicator } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { Icon } from "@/components/Icon";
import {
  useFoodComanda,
  useAnswerWaiterCallMutation,
  useTableStatusMutation,
  useUpdateOrderStatusMutation,
  type FoodTable,
  type FoodComandaOrder,
} from "@/hooks/useFoodTables";
import { AnotarPedidoDrawer } from "@/components/food/AnotarPedidoDrawer";

// ============================================================
// TableDrawer — drawer lateral 520px (desktop) / modal 88% (mobile)
// com comanda agregada da mesa + ações do garçom.
//
// Entrada: table (mesa selecionada no mapa).
// Backend: GET /food/tables/:id/comanda (Fase 2).
// Polling 5s pra refletir status do KDS e novos pedidos.
// ============================================================

const STATUS_COLORS = {
  pending:   FoodColors.amber,
  confirmed: FoodColors.cyan,
  preparing: FoodColors.cyan,
  ready:     FoodColors.green,
  delivered: FoodColors.ink3,
  cancelled: FoodColors.ink4,
};
const STATUS_LABEL: Record<string, string> = {
  pending:   "Aguardando",
  confirmed: "Confirmado",
  preparing: "Cozinha",
  ready:     "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

interface Props {
  table: FoodTable | null;
  onClose: () => void;
}

export function TableDrawer({ table, onClose }: Props) {
  const visible = !!table;
  const { data, isLoading } = useFoodComanda(table?.id || null);
  const answerCall   = useAnswerWaiterCallMutation();
  const setStatus    = useTableStatusMutation();
  const updateOrderStatus = useUpdateOrderStatusMutation();
  const [anotarOpen, setAnotarOpen] = useState(false);

  const handleAnswer = () => {
    if (data?.waiter_call) answerCall.mutate(data.waiter_call.id);
  };
  const handleClose = async () => {
    if (!table) return;
    if (data && data.active_orders_count > 0) {
      if (Platform.OS === "web" && !window.confirm("Mesa tem pedidos ativos. Fechar mesmo assim?")) return;
    }
    await setStatus.mutateAsync({ id: table.id, status: "free" });
    onClose();
  };
  const handleCancelOrder = async (orderId: string) => {
    if (Platform.OS === "web" && !window.confirm("Cancelar este pedido?")) return;
    await updateOrderStatus.mutateAsync({ orderId, status: "cancelled" });
  };

  const isWeb = Platform.OS === "web";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
        flexDirection: isWeb ? "row" : "column",
      }}>
        {isWeb && <Pressable style={{ flex: 1 }} onPress={onClose} />}
        <View style={{
          backgroundColor: FoodColors.bg,
          width: isWeb ? 520 : "100%",
          height: isWeb ? "100%" : "88%",
          marginTop: isWeb ? 0 : "auto",
          borderTopLeftRadius: isWeb ? 0 : 16,
          borderTopRightRadius: isWeb ? 0 : 16,
          borderLeftWidth: isWeb ? 1 : 0,
          borderLeftColor: FoodColors.border,
        }}>
          {/* Header */}
          {table && (
            <View style={{
              paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
              borderBottomWidth: 1, borderBottomColor: FoodColors.border,
              flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: FoodColors.red, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
                  MESA {table.number}
                </Text>
                <Text style={{ fontSize: 22, color: FoodColors.ink, fontWeight: "800", marginTop: 2 }}>
                  {table.status === "free" ? "Mesa livre" :
                   table.status === "reserved" ? "Mesa reservada" :
                   "Comanda aberta"}
                </Text>
                {data && (
                  <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 2 }}>
                    {table.seats ? table.seats + " lugares" : ""}
                    {data.duration_min != null && " · " + data.duration_min + "min"}
                    {data.active_orders_count > 0 && " · " + data.active_orders_count + " pedidos abertos"}
                  </Text>
                )}
              </View>
              <Pressable onPress={onClose} style={{
                width: 32, height: 32, alignItems: "center", justifyContent: "center",
                borderRadius: 8, backgroundColor: FoodColors.surface2,
              }}>
                <Icon name="x" size={16} color={FoodColors.ink3} />
              </Pressable>
            </View>
          )}

          {/* Body */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
            {isLoading ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <ActivityIndicator color={FoodColors.red} />
              </View>
            ) : !data ? (
              <Text style={{ color: FoodColors.ink3, textAlign: "center", marginTop: 30 }}>
                Erro ao carregar comanda
              </Text>
            ) : (
              <>
                {data.waiter_call && (
                  <View style={{
                    backgroundColor: "rgba(239,68,68,0.15)",
                    borderLeftWidth: 3, borderLeftColor: FoodColors.red,
                    padding: 12, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 10,
                  }}>
                    <Text style={{ fontSize: 20 }}>🔔</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: FoodColors.red, fontWeight: "700" }}>
                        Chamada de garçom
                      </Text>
                      <Text style={{ fontSize: 11, color: FoodColors.ink3 }}>
                        {data.waiter_call.reason}
                      </Text>
                    </View>
                    <Pressable onPress={handleAnswer} style={{
                      backgroundColor: FoodColors.red, paddingHorizontal: 12, paddingVertical: 6,
                      borderRadius: 6,
                    }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Atender</Text>
                    </Pressable>
                  </View>
                )}

                {data.orders.length === 0 ? (
                  <View style={{
                    backgroundColor: FoodColors.surface, borderRadius: 12, padding: 30,
                    alignItems: "center", borderWidth: 1, borderColor: FoodColors.border, borderStyle: "dashed",
                  }}>
                    <Text style={{ fontSize: 36, marginBottom: 8 }}>🍽️</Text>
                    <Text style={{ fontSize: 14, color: FoodColors.ink, fontWeight: "700" }}>
                      Mesa sem pedidos
                    </Text>
                    <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 4, textAlign: "center" }}>
                      Toque em "+ Pedido" para abrir a primeira comanda.
                    </Text>
                  </View>
                ) : (
                  data.orders.map(o => (
                    <OrderBlock key={o.id} order={o} onCancel={handleCancelOrder} />
                  ))
                )}

                {/* Totais */}
                {data.orders.length > 0 && (
                  <View style={{
                    backgroundColor: FoodColors.surface, borderRadius: 10, padding: 14,
                    borderWidth: 1, borderColor: FoodColors.border, gap: 4, marginTop: 4,
                  }}>
                    <TotalRow label="Subtotal" value={data.subtotal_open} />
                    {data.discount_total > 0 && (
                      <TotalRow label="Desconto" value={-data.discount_total} muted />
                    )}
                    {data.service_fee_pct > 0 && (
                      <TotalRow
                        label={"Taxa de serviço (" + data.service_fee_pct + "%)"}
                        value={data.service_fee_amount}
                        muted
                      />
                    )}
                    <View style={{ height: 1, backgroundColor: FoodColors.border, marginVertical: 6 }} />
                    <TotalRow label="TOTAL" value={data.total_open} bold />
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          {table && (
            <View style={{
              padding: 14, borderTopWidth: 1, borderTopColor: FoodColors.border,
              flexDirection: "row", gap: 8,
            }}>
              {data && data.orders.length > 0 && (
                <Pressable onPress={handleClose} style={{
                  paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8,
                  backgroundColor: FoodColors.surface2,
                }}>
                  <Text style={{ color: FoodColors.ink, fontSize: 13, fontWeight: "600" }}>💳 Fechar mesa</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setAnotarOpen(true)}
                style={{
                  flex: 1,
                  backgroundColor: FoodColors.red,
                  paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>+ Anotar pedido</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {anotarOpen && table && (
        <AnotarPedidoDrawer
          tableId={table.id}
          tableNumber={table.number}
          onClose={() => setAnotarOpen(false)}
        />
      )}
    </Modal>
  );
}

function OrderBlock({ order, onCancel }: { order: FoodComandaOrder; onCancel: (id: string) => void }) {
  const color = STATUS_COLORS[order.status] || FoodColors.ink3;
  const label = STATUS_LABEL[order.status] || order.status;
  const time = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const isOpen = !['delivered','cancelled'].includes(order.status);

  return (
    <View style={{
      backgroundColor: FoodColors.surface, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: FoodColors.border,
    }}>
      <View style={{
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8, paddingBottom: 8,
        borderBottomWidth: 1, borderBottomColor: FoodColors.border, borderStyle: "dashed",
      }}>
        <Text style={{ fontSize: 11, color: FoodColors.ink3 }}>
          Pedido · {time}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{
            backgroundColor: color + "33", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
          }}>
            <Text style={{ fontSize: 9, color, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {label}
            </Text>
          </View>
          {isOpen && (
            <Pressable onPress={() => onCancel(order.id)} style={{ padding: 4 }}>
              <Icon name="x" size={11} color={FoodColors.ink3} />
            </Pressable>
          )}
        </View>
      </View>
      {order.items.map(item => (
        <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
          <Text style={{ fontSize: 13, color: FoodColors.ink2, flex: 1 }}>
            <Text style={{ color: FoodColors.ink3, fontWeight: "700" }}>{item.quantity}× </Text>
            {item.item_name}
            {item.variation_name ? " (" + item.variation_name + ")" : ""}
          </Text>
          <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "600" }}>
            R$ {Number(item.total_price).toFixed(2)}
          </Text>
        </View>
      ))}
      {order.notes && (
        <Text style={{ fontSize: 11, color: FoodColors.amber, marginTop: 4, fontStyle: "italic" }}>
          ⚠ {order.notes}
        </Text>
      )}
    </View>
  );
}

function TotalRow({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{
        fontSize: bold ? 14 : 12,
        color: bold ? FoodColors.ink : (muted ? FoodColors.ink3 : FoodColors.ink2),
        fontWeight: bold ? "800" : "500",
      }}>{label}</Text>
      <Text style={{
        fontSize: bold ? 16 : 12,
        color: bold ? FoodColors.green : (muted ? FoodColors.ink3 : FoodColors.ink),
        fontWeight: bold ? "800" : "600",
      }}>R$ {Number(value).toFixed(2)}</Text>
    </View>
  );
}

export default TableDrawer;
