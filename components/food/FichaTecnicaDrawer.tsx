import { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Modal, Platform, ActivityIndicator } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { Icon } from "@/components/Icon";
import {
  useFoodRecipe,
  useAddIngredientMutation,
  useDeleteIngredientMutation,
} from "@/hooks/useFoodMenu";
import { FoodMargemBadge } from "@/components/food/FoodMargemBadge";

// ============================================================
// FichaTecnicaDrawer — drawer lateral desktop / modal full-screen mobile.
//
// Mostra ingredientes do prato (food_recipes), CMV total calculado,
// margem com semáforo, alerta visual quando margem < 30% (margin_alert
// vindo do backend).
//
// Fase 1: form inline pra adicionar ingrediente (nome livre + qty + un
// + unit_cost). Linkar a product_id do estoque vem em Fase posterior
// quando o autocomplete de products estiver pronto.
// ============================================================

interface Props {
  itemId: string | null;
  onClose: () => void;
}

export function FichaTecnicaDrawer({ itemId, onClose }: Props) {
  const visible = !!itemId;
  const { data, isLoading } = useFoodRecipe(itemId);
  const addM = useAddIngredientMutation(itemId || "");
  const delM = useDeleteIngredientMutation(itemId || "");

  const [form, setForm] = useState({
    ingredient_name: "",
    unit: "un",
    quantity: "",
    unit_cost: "",
  });
  const resetForm = () => setForm({ ingredient_name: "", unit: "un", quantity: "", unit_cost: "" });

  const handleAdd = async () => {
    if (!form.ingredient_name || !form.quantity || !form.unit_cost) return;
    await addM.mutateAsync({
      ingredient_name: form.ingredient_name,
      unit: form.unit,
      quantity: parseFloat(form.quantity),
      unit_cost: parseFloat(form.unit_cost),
    });
    resetForm();
  };

  const handleDelete = async (rid: string) => {
    await delM.mutateAsync(rid);
  };

  const isWeb = Platform.OS === "web";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        flexDirection: isWeb ? "row" : "column",
      }}>
        {isWeb && <Pressable style={{ flex: 1 }} onPress={onClose} />}
        <View style={{
          backgroundColor: FoodColors.bg,
          width: isWeb ? 520 : "100%",
          maxWidth: isWeb ? 520 : "100%",
          height: isWeb ? "100%" : "88%",
          marginTop: isWeb ? 0 : "auto",
          borderTopLeftRadius: isWeb ? 0 : 16,
          borderTopRightRadius: isWeb ? 0 : 16,
          borderLeftWidth: isWeb ? 1 : 0,
          borderLeftColor: FoodColors.border,
        }}>
          {/* Header */}
          <View style={{
            paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: FoodColors.border,
            flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: FoodColors.red, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
                FICHA TÉCNICA
              </Text>
              <Text style={{ fontSize: 18, color: FoodColors.ink, fontWeight: "800", marginTop: 2 }} numberOfLines={1}>
                {data?.item_name || "..."}
              </Text>
            </View>
            <Pressable onPress={onClose} style={{
              width: 32, height: 32, alignItems: "center", justifyContent: "center",
              borderRadius: 8, backgroundColor: FoodColors.surface2,
            }}>
              <Icon name="x" size={16} color={FoodColors.ink3} />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
            {isLoading || !data ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <ActivityIndicator color={FoodColors.red} />
              </View>
            ) : (
              <>
                {/* Stats */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={statCardStyle}>
                    <Text style={statLabel}>Preço</Text>
                    <Text style={[statValue, { color: FoodColors.green }]}>R$ {Number(data.sale_price || 0).toFixed(2)}</Text>
                  </View>
                  <View style={statCardStyle}>
                    <Text style={statLabel}>CMV</Text>
                    <Text style={statValue}>R$ {Number(data.total_cost || 0).toFixed(2)}</Text>
                  </View>
                  <View style={statCardStyle}>
                    <Text style={statLabel}>Margem</Text>
                    <View style={{ marginTop: 4 }}>
                      <FoodMargemBadge marginPct={data.margin_pct} size="md" />
                    </View>
                  </View>
                </View>

                {data.margin_alert && (
                  <View style={{
                    backgroundColor: "rgba(239,68,68,0.1)",
                    borderLeftWidth: 3, borderLeftColor: FoodColors.red,
                    padding: 10, borderRadius: 6,
                  }}>
                    <Text style={{ fontSize: 12, color: FoodColors.red, fontWeight: "600" }}>
                      ⚠ Margem baixa (&lt;30%)
                    </Text>
                    <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 2 }}>
                      Considere ajustar preço ou reduzir custo dos ingredientes.
                    </Text>
                  </View>
                )}

                {/* Ingredientes */}
                <Text style={sectionLabel}>
                  Ingredientes ({data.ingredients.length})
                </Text>

                {data.ingredients.length === 0 && (
                  <View style={{
                    backgroundColor: FoodColors.surface, borderRadius: 10, padding: 20,
                    alignItems: "center", borderWidth: 1, borderColor: FoodColors.border, borderStyle: "dashed",
                  }}>
                    <Text style={{ fontSize: 12, color: FoodColors.ink3, textAlign: "center" }}>
                      Sem ingredientes cadastrados.{"\n"}Adicione abaixo para calcular o CMV.
                    </Text>
                  </View>
                )}

                {data.ingredients.map(ing => (
                  <View key={ing.id} style={{
                    backgroundColor: FoodColors.surface, borderRadius: 10, padding: 12,
                    borderWidth: 1, borderColor: FoodColors.border,
                    flexDirection: "row", alignItems: "center", gap: 10,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "600" }}>{ing.ingredient_name}</Text>
                      <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 2 }}>
                        {Number(ing.quantity).toFixed(2)} {ing.unit} × R$ {Number(ing.unit_cost).toFixed(2)}
                        {ing.product_name ? "  ·  " : ""}
                        {ing.product_name ? <Text style={{ color: FoodColors.cyan }}>linkado a {ing.product_name}</Text> : null}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "700", minWidth: 70, textAlign: "right" }}>
                      R$ {(Number(ing.quantity) * Number(ing.unit_cost)).toFixed(2)}
                    </Text>
                    <Pressable onPress={() => handleDelete(ing.id)} style={{
                      width: 28, height: 28, alignItems: "center", justifyContent: "center",
                      borderRadius: 6, backgroundColor: FoodColors.surface2,
                    }}>
                      <Icon name="trash" size={12} color={FoodColors.ink3} />
                    </Pressable>
                  </View>
                ))}

                {/* Add form */}
                <View style={{
                  backgroundColor: FoodColors.surface, borderRadius: 10, padding: 14,
                  borderWidth: 1, borderColor: FoodColors.border, gap: 8, marginTop: 4,
                }}>
                  <Text style={{ fontSize: 12, color: FoodColors.ink2, fontWeight: "700", marginBottom: 4 }}>
                    + Adicionar ingrediente
                  </Text>
                  <TextInput
                    value={form.ingredient_name}
                    onChangeText={v => setForm({ ...form, ingredient_name: v })}
                    placeholder="Nome (ex: Carne picanha)"
                    placeholderTextColor={FoodColors.ink4}
                    style={inputStyle}
                  />
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TextInput
                      value={form.quantity}
                      onChangeText={v => setForm({ ...form, quantity: v })}
                      placeholder="Qtd"
                      placeholderTextColor={FoodColors.ink4}
                      keyboardType="decimal-pad"
                      style={[inputStyle, { flex: 1 }]}
                    />
                    <TextInput
                      value={form.unit}
                      onChangeText={v => setForm({ ...form, unit: v })}
                      placeholder="un"
                      placeholderTextColor={FoodColors.ink4}
                      style={[inputStyle, { width: 70, textAlign: "center" }]}
                    />
                    <TextInput
                      value={form.unit_cost}
                      onChangeText={v => setForm({ ...form, unit_cost: v })}
                      placeholder="R$/un"
                      placeholderTextColor={FoodColors.ink4}
                      keyboardType="decimal-pad"
                      style={[inputStyle, { flex: 1 }]}
                    />
                  </View>
                  <Pressable
                    onPress={handleAdd}
                    disabled={!form.ingredient_name || !form.quantity || !form.unit_cost || addM.isPending}
                    style={{
                      backgroundColor: FoodColors.red, padding: 10, borderRadius: 6, alignItems: "center",
                      opacity: (!form.ingredient_name || !form.quantity || !form.unit_cost || addM.isPending) ? 0.4 : 1,
                    }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                      {addM.isPending ? "Adicionando..." : "+ Adicionar"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: FoodColors.border }}>
            <Pressable onPress={onClose} style={{
              backgroundColor: FoodColors.surface2, padding: 12, borderRadius: 8, alignItems: "center",
            }}>
              <Text style={{ color: FoodColors.ink, fontSize: 13, fontWeight: "600" }}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const statCardStyle: any = {
  flex: 1,
  backgroundColor: FoodColors.surface,
  borderRadius: 10,
  padding: 12,
  borderWidth: 1,
  borderColor: FoodColors.border,
};
const statLabel: any = {
  fontSize: 10,
  color: FoodColors.ink3,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
const statValue: any = {
  fontSize: 16,
  color: FoodColors.ink,
  fontWeight: "800",
  marginTop: 2,
};
const sectionLabel: any = {
  fontSize: 12,
  color: FoodColors.ink2,
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginTop: 6,
};
const inputStyle: any = {
  backgroundColor: FoodColors.bg,
  color: FoodColors.ink,
  padding: 10,
  borderRadius: 6,
  fontSize: 13,
  borderWidth: 1,
  borderColor: FoodColors.border,
};

export default FichaTecnicaDrawer;
