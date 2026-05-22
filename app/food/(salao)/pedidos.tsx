import { View, Text } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { EmptyState } from "@/components/EmptyState";
import { useAuthStore } from "@/stores/auth";

// 2026-05-21 (F4 do polish pre-Fase 7): placeholder tecnico (Fase 3 do
// BACKLOG, rotas de food/orders/kds) so aparece para is_staff. Cliente
// final vê EmptyState genérico "Em breve".

export default function PedidosScreen() {
  const { user } = useAuthStore();
  if (user?.is_staff) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Pedidos</Text>
        <Text style={{ fontSize: 13, color: FoodColors.ink3, lineHeight: 20 }}>
          Lista de pedidos (presencial/delivery_proprio/ifood/whatsapp/online),
          KDS da cozinha em modo TV, máquina de estados pending → preparing → ready → delivered.
        </Text>

        <View style={{
          backgroundColor: FoodColors.surface, borderColor: FoodColors.border, borderWidth: 1,
          borderRadius: 12, padding: 32, alignItems: "center", marginTop: 8,
        }}>
          <Text style={{ fontSize: 48 }}>🔥</Text>
          <Text style={{ fontSize: 14, color: FoodColors.ink, marginTop: 12, fontWeight: "600" }}>
            [STAFF] Em construção
          </Text>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 4, textAlign: "center", maxWidth: 420 }}>
            Fase 3 do BACKLOG_AURA_FOOD.md (KDS). Backend já pronto:{" "}
            <Text style={{ color: FoodColors.amber }}>GET /food/orders/kds</Text>,{" "}
            <Text style={{ color: FoodColors.amber }}>PATCH /food/orders/:id/status</Text>,{" "}
            <Text style={{ color: FoodColors.amber }}>PATCH /food/orders/:id/items/:iid/kds</Text>.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <EmptyState
      icon="clipboard"
      title="Em breve"
      subtitle="A central de pedidos chega na próxima atualização. Por enquanto, use o KDS Cozinha em /food/kds para acompanhar pedidos em tempo real."
    />
  );
}
