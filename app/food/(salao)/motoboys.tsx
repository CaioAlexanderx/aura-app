import { View, Text } from "react-native";
import { FoodColors } from "@/constants/food-tokens";

export default function MotoboysScreen() {
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
          Em construção
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
