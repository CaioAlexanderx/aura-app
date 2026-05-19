import { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Modal, Platform, ActivityIndicator } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { Icon } from "@/components/Icon";
import { useFoodMenu, type FoodItem } from "@/hooks/useFoodMenu";
import { useCreateOrderMutation, type CreateOrderItem } from "@/hooks/useFoodTables";

// ============================================================
// AnotarPedidoDrawer — drawer separado sobre o TableDrawer.
// Mostra catálogo (reusa GET /food/menu) e carrinho.
// Submit chama POST /food/orders { table_id, items, channel='presencial' }.
//
// Fase 2: sem variações / adicionais ainda. Itens vão como flat (price
// fixo do food_items). Variações entram em sub-PR junto com CRUD
// de variações no front (não existe ainda).
// ============================================================

type CartLine = { item: FoodItem; qty: number; notes: string };

interface Props {
  tableId: string;
  tableNumber: string;
  onClose: () => void;
}

export function AnotarPedidoDrawer({ tableId, tableNumber, onClose }: Props) {
  const { data: menu, isLoading } = useFoodMenu();
  const createOrder = useCreateOrderMutation();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [observation, setObservation] = useState("");

  const categories = menu?.categories || [];
  const items = menu?.items || [];

  const filtered = useMemo(() => {
    let out = items.filter(i => i.is_active && i.is_available);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      out = out.filter(i => i.name.toLowerCase().includes(q));
    }
    if (categoryFilter) out = out.filter(i => i.category_id === categoryFilter);
    return out;
  }, [items, search, categoryFilter]);

  const addToCart = (item: FoodItem) => {
    setCart(prev => {
      const idx = prev.findIndex(l => l.item.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { item, qty: 1, notes: "" }];
    });
  };
  const setQty = (itemId: string, delta: number) => {
    setCart(prev => prev
      .map(l => l.item.id === itemId ? { ...l, qty: Math.max(0, l.qty + delta) } : l)
      .filter(l => l.qty > 0)
    );
  };
  const setLineNote = (itemId: string, note: string) => {
    setCart(prev => prev.map(l => l.item.id === itemId ? { ...l, notes: note } : l));
  };

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + Number(l.item.price) * l.qty, 0);

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    const orderItems: CreateOrderItem[] = cart.map(l => ({
      item_id: l.item.id,
      item_name: l.item.name,
      quantity: l.qty,
      unit_price: Number(l.item.price),
      notes: l.notes || null,
    }));
    await createOrder.mutateAsync({
      table_id: tableId,
      channel: "presencial",
      items: orderItems,
      notes: observation || null,
    });
    onClose();
  };

  const isWeb = Platform.OS === "web";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
        flexDirection: isWeb ? "row" : "column",
      }}>
        {isWeb && <Pressable style={{ flex: 1 }} onPress={onClose} />}
        <View style={{
          backgroundColor: FoodColors.bg,
          width: isWeb ? 640 : "100%",
          height: isWeb ? "100%" : "95%",
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
                NOVO PEDIDO · MESA {tableNumber}
              </Text>
              <Text style={{ fontSize: 18, color: FoodColors.ink, fontWeight: "800", marginTop: 2 }}>
                Selecione os itens
              </Text>
            </View>
            <Pressable onPress={onClose} style={{
              width: 32, height: 32, alignItems: "center", justifyContent: "center",
              borderRadius: 8, backgroundColor: FoodColors.surface2,
            }}>
              <Icon name="x" size={16} color={FoodColors.ink3} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={{
            flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10,
            borderBottomWidth: 1, borderBottomColor: FoodColors.border,
            backgroundColor: FoodColors.surface, alignItems: "center", gap: 8,
          }}>
            <Icon name="search" size={14} color={FoodColors.ink3} />
            <TextInput
              value={search} onChangeText={setSearch}
              placeholder="Buscar item..."
              placeholderTextColor={FoodColors.ink4}
              style={{ flex: 1, padding: 8, color: FoodColors.ink, fontSize: 13 }}
            />
          </View>

          {/* Categories */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: FoodColors.border }}
            contentContainerStyle={{ padding: 10, gap: 6 }}
          >
            <CatChip label="Todos" active={!categoryFilter} onPress={() => setCategoryFilter(null)} />
            {categories.map(c => (
              <CatChip key={c.id} label={c.name} active={categoryFilter === c.id} onPress={() => setCategoryFilter(c.id)} />
            ))}
          </ScrollView>

          {/* Catalog grid */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
            {isLoading ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <ActivityIndicator color={FoodColors.red} />
              </View>
            ) : filtered.length === 0 ? (
              <Text style={{ color: FoodColors.ink3, textAlign: "center", marginTop: 30 }}>
                Nenhum item disponível{search ? " para \"" + search + "\"" : ""}
              </Text>
            ) : (
              filtered.map(item => {
                const cartLine = cart.find(l => l.item.id === item.id);
                const qty = cartLine?.qty || 0;
                return (
                  <View key={item.id} style={{
                    backgroundColor: FoodColors.surface,
                    borderRadius: 10, padding: 12,
                    borderWidth: 1, borderColor: qty > 0 ? FoodColors.red : FoodColors.border,
                    flexDirection: "row", gap: 12, alignItems: "center",
                  }}>
                    <View style={{
                      width: 48, height: 48, borderRadius: 8,
                      backgroundColor: FoodColors.surface2,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text style={{ fontSize: 22 }}>🍽</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "600" }}>{item.name}</Text>
                      <Text style={{ fontSize: 12, color: FoodColors.green, fontWeight: "700", marginTop: 2 }}>
                        R$ {Number(item.price).toFixed(2)}
                        {item.preparation_time_min ? <Text style={{ color: FoodColors.ink3, fontSize: 10 }}>{"  ·  " + item.preparation_time_min + "min"}</Text> : null}
                      </Text>
                    </View>
                    {qty === 0 ? (
                      <Pressable onPress={() => addToCart(item)} style={{
                        backgroundColor: FoodColors.red, paddingHorizontal: 14, paddingVertical: 8,
                        borderRadius: 8,
                      }}>
                        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>+</Text>
                      </Pressable>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Pressable onPress={() => setQty(item.id, -1)} style={qtyBtnStyle}>
                          <Text style={{ color: FoodColors.ink, fontSize: 16, fontWeight: "800" }}>−</Text>
                        </Pressable>
                        <Text style={{ minWidth: 24, textAlign: "center", color: FoodColors.ink, fontWeight: "800", fontSize: 14 }}>
                          {qty}
                        </Text>
                        <Pressable onPress={() => setQty(item.id, 1)} style={qtyBtnStyle}>
                          <Text style={{ color: FoodColors.ink, fontSize: 16, fontWeight: "800" }}>+</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Cart preview */}
          {cartCount > 0 && (
            <View style={{
              backgroundColor: FoodColors.surface, borderTopWidth: 1, borderTopColor: FoodColors.border,
              maxHeight: 220,
            }}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: FoodColors.border }}>
                <Text style={{ fontSize: 11, color: FoodColors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Carrinho ({cartCount} {cartCount === 1 ? "item" : "itens"})
                </Text>
              </View>
              <ScrollView style={{ maxHeight: 130 }} contentContainerStyle={{ padding: 12, gap: 6 }}>
                {cart.map(l => (
                  <View key={l.item.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, color: FoodColors.ink2, flex: 1 }}>
                      <Text style={{ color: FoodColors.red, fontWeight: "700" }}>{l.qty}× </Text>
                      {l.item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: FoodColors.ink, fontWeight: "600" }}>
                      R$ {(Number(l.item.price) * l.qty).toFixed(2)}
                    </Text>
                  </View>
                ))}
                <TextInput
                  value={observation} onChangeText={setObservation}
                  placeholder="Observação geral do pedido (opcional)"
                  placeholderTextColor={FoodColors.ink4}
                  style={{
                    backgroundColor: FoodColors.bg, color: FoodColors.ink,
                    padding: 8, borderRadius: 6, fontSize: 12,
                    borderWidth: 1, borderColor: FoodColors.border, marginTop: 8,
                  }}
                />
              </ScrollView>
            </View>
          )}

          {/* Footer */}
          <View style={{
            padding: 14, borderTopWidth: 1, borderTopColor: FoodColors.border,
            flexDirection: "row", gap: 8, alignItems: "center",
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: FoodColors.ink3, textTransform: "uppercase" }}>Total parcial</Text>
              <Text style={{ fontSize: 18, color: FoodColors.green, fontWeight: "800" }}>
                R$ {cartTotal.toFixed(2)}
              </Text>
            </View>
            <Pressable
              onPress={handleSubmit}
              disabled={cartCount === 0 || createOrder.isPending}
              style={{
                backgroundColor: FoodColors.red, paddingHorizontal: 18, paddingVertical: 12,
                borderRadius: 8, opacity: (cartCount === 0 || createOrder.isPending) ? 0.4 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
                {createOrder.isPending ? "Enviando..." : "🔥 Enviar pra cozinha"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CatChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      backgroundColor: active ? FoodColors.redDim : FoodColors.surface2,
      borderWidth: 1, borderColor: active ? FoodColors.red : FoodColors.border,
    }}>
      <Text style={{
        color: active ? FoodColors.red : FoodColors.ink3,
        fontSize: 12, fontWeight: "600",
      }}>{label}</Text>
    </Pressable>
  );
}

const qtyBtnStyle: any = {
  width: 28, height: 28, borderRadius: 6,
  backgroundColor: FoodColors.surface2, borderWidth: 1, borderColor: FoodColors.border,
  alignItems: "center", justifyContent: "center",
};

export default AnotarPedidoDrawer;
