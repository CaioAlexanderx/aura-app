import { View, Text } from "react-native";
import { FoodColors } from "@/constants/food-tokens";

export default function DeliveryScreen() {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Delivery</Text>
      <Text style={{ fontSize: 13, color: FoodColors.ink3, lineHeight: 20 }}>
        Pedidos delivery próprio + iFood (import CSV nesta Fase 1; API oficial em fase futura).
        Zonas de entrega com taxa + tempo estimado. WhatsApp automático ao receber pedido.
      </Text>

      <View style={{
        backgroundColor: FoodColors.surface, borderColor: FoodColors.border, borderWidth: 1,
        borderRadius: 12, padding: 32, alignItems: "center", marginTop: 8,
      }}>
        <Text style={{ fontSize: 48 }}>🛵</Text>
        <Text style={{ fontSize: 14, color: FoodColors.ink, marginTop: 12, fontWeight: "600" }}>
          Em construção
        </Text>
        <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 4, textAlign: "center", maxWidth: 420 }}>
          Fases 5–6 do BACKLOG_AURA_FOOD.md. Backend já pronto:{" "}
          <Text style={{ color: FoodColors.amber }}>/food/orders?channel=delivery_proprio</Text>,{" "}
          <Text style={{ color: FoodColors.amber }}>/food/ifood/import</Text>,{" "}
          <Text style={{ color: FoodColors.amber }}>/food/delivery-zones</Text>.
        </Text>
      </View>
    </View>
  );
}
