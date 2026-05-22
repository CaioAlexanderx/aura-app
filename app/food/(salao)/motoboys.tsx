import { View, Text } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { EmptyState } from "@/components/EmptyState";
import { useAuthStore } from "@/stores/auth";

// 2026-05-21 (F4 do polish pre-Fase 7): nome de tabela (food_deliverers)
// e nome de PR/fase so aparecem pra is_staff. Cliente vê EmptyState.

export default function MotoboysScreen() {
  const { user } = useAuthStore();
  if (user?.is_staff) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Motoboys</Text>
        <Text style={{ fontSize: 13, color: FoodColors.ink3, lineHeight: 20 }}>
          CRUD de entregadores (food_deliverers) com comissão pct ou fixa,
          veículo (moto/bicicleta/carro/a pé), histórico de despachos.
        </Text>

        <View style={{
          backgroundColor: FoodColors.surface, borderColor: FoodColors.border, borderWidth: 1,
          borderRadius: 12, padding: 32, alignItems: "center", marginTop: 8,
        }}>
          <Text style={{ fontSize: 48 }}>🏍️</Text>
          <Text style={{ fontSize: 14, color: FoodColors.ink, marginTop: 12, fontWeight: "600" }}>
            [STAFF] Em construção
          </Text>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 4, textAlign: "center", maxWidth: 420 }}>
            Fase 8 do BACKLOG_AURA_FOOD.md. Backend já pronto em foodDeliverers.js +{" "}
            <Text style={{ color: FoodColors.amber }}>food_deliverers</Text> +{" "}
            <Text style={{ color: FoodColors.amber }}>food_dispatch_log</Text>.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <EmptyState
      icon="users"
      title="Em breve"
      subtitle="O cadastro de entregadores com comissões e histórico de rotas chega na próxima atualização."
    />
  );
}
