import { View, Text } from "react-native";
import { FoodColors } from "@/constants/food-tokens";

export default function CardapioScreen() {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Cardápio</Text>
      <Text style={{ fontSize: 13, color: FoodColors.ink3, lineHeight: 20 }}>
        CRUD de itens, categorias e cardápios (com horários almoço/jantar).
        Ficha técnica ligando itens a produtos do estoque para cálculo de CMV e margem por prato.
      </Text>

      <View style={{
        backgroundColor: FoodColors.surface, borderColor: FoodColors.border, borderWidth: 1,
        borderRadius: 12, padding: 32, alignItems: "center", marginTop: 8,
      }}>
        <Text style={{ fontSize: 48 }}>📖</Text>
        <Text style={{ fontSize: 14, color: FoodColors.ink, marginTop: 12, fontWeight: "600" }}>
          Em construção
        </Text>
        <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 4, textAlign: "center", maxWidth: 420 }}>
          Fase 1 do BACKLOG_AURA_FOOD.md (primeiro alvo). Backend já pronto:{" "}
          <Text style={{ color: FoodColors.amber }}>/food/menus</Text>,{" "}
          <Text style={{ color: FoodColors.amber }}>/food/categories</Text>,{" "}
          <Text style={{ color: FoodColors.amber }}>/food/items</Text>,{" "}
          <Text style={{ color: FoodColors.amber }}>/food/recipes</Text>.
        </Text>
      </View>
    </View>
  );
}
