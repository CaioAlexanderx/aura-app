import { View, Text } from "react-native";
import { FoodColors } from "@/constants/food-tokens";

export default function MesasScreen() {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Mesas</Text>
      <Text style={{ fontSize: 13, color: FoodColors.ink3, lineHeight: 20 }}>
        Mapa de mesas com status (livre/ocupada/reservada), badge de chamada de garçom,
        comanda agregada por mesa, KPIs em tempo real.
      </Text>

      <View style={{
        backgroundColor: FoodColors.surface, borderColor: FoodColors.border, borderWidth: 1,
        borderRadius: 12, padding: 32, alignItems: "center", marginTop: 8,
      }}>
        <Text style={{ fontSize: 48 }}>🍽️</Text>
        <Text style={{ fontSize: 14, color: FoodColors.ink, marginTop: 12, fontWeight: "600" }}>
          Em construção
        </Text>
        <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 4, textAlign: "center", maxWidth: 420 }}>
          Fase 2 do BACKLOG_AURA_FOOD.md. Backend já pronto:{" "}
          <Text style={{ color: FoodColors.amber }}>GET /companies/:id/food/tables</Text>,{" "}
          <Text style={{ color: FoodColors.amber }}>GET /food/waiter/tables</Text> (agregado com chamadas).
        </Text>
      </View>
    </View>
  );
}
