import { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";

// ============================================================
// /m/[tableId] — Cardápio público do QR da mesa. Sem auth.
// Consome rotas públicas /api/v1/food/table/public/:tableId/*.
// Mobile-first, tema light pro cliente final.
// ============================================================

const API_BASE = ((typeof process !== "undefined" && (process.env as any)?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1");

// Tema light
const T = {
  bg:     "#fafaf5",
  card:   "#ffffff",
  border: "#e8e2d8",
  ink:    "#1a1a2e",
  ink2:   "#444",
  ink3:   "#888",
  ink4:   "#aaa",
  red:    "#EF4444",
  orange: "#f97316",
  green:  "#10B981",
  amber:  "#F59E0B",
};

type FoodItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  preparation_time_min: number | null;
  serves: number | null;
  is_active: boolean;
  is_available: boolean;
};
type FoodCategory = { id: string; name: string; sort_order: number };
type FoodTable    = { id: string; number: string; seats: number | null };
type PublicMenu = {
  table: FoodTable;
  business: string;
  menu: { name: string; accepts_online_orders: boolean; min_order_amount: number | null };
  categories: FoodCategory[];
  items: FoodItem[];
};

type CartLine = { item: FoodItem; qty: number; notes: string };

export default function QrTablePage() {
  const params = useLocalSearchParams<{ tableId: string }>();
  const tableId = String(params.tableId || "");

  const [menu, setMenu]               = useState<PublicMenu | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [activeCategory, setActiveCat] = useState<string | null>(null);
  const [cart, setCart]               = useState<Record<string, CartLine>>({});
  const [stage, setStage]             = useState<"menu" | "cart" | "sent">("menu");
  const [customerName, setCustomerName] = useState("");
  const [observation, setObservation]   = useState("");
  const [sending, setSending]         = useState(false);
  const [sentOrder, setSentOrder]     = useState<{ order_id: string; total: number; estimated_ready_at: string | null; tracking_url: string } | null>(null);
  const [callingWaiter, setCalling]   = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);

  // localStorage cart key
  const cartKey = "aura-food-cart-" + tableId;

  useEffect(() => {
    if (!tableId) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(cartKey);
        if (saved) setCart(JSON.parse(saved));
      } catch {}
    }
    fetch(API_BASE + "/food/table/public/" + tableId + "/menu")
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setMenu(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e?.message || "Erro ao carregar cardápio");
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // persist cart
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !tableId) return;
    try { window.localStorage.setItem(cartKey, JSON.stringify(cart)); } catch {}
  }, [cart, tableId, cartKey]);

  const items = menu?.items || [];
  const filtered = useMemo(() => {
    let out = items.filter(i => i.is_active && i.is_available);
    if (activeCategory) out = out.filter(i => i.category_id === activeCategory);
    return out;
  }, [items, activeCategory]);

  const cartLines  = Object.values(cart).filter(c => c.qty > 0);
  const cartCount  = cartLines.reduce((s, c) => s + c.qty, 0);
  const cartTotal  = cartLines.reduce((s, c) => s + Number(c.item.price) * c.qty, 0);

  const addItem = (item: FoodItem) => setCart(prev => ({
    ...prev,
    [item.id]: { item, qty: (prev[item.id]?.qty || 0) + 1, notes: prev[item.id]?.notes || "" },
  }));
  const changeQty = (itemId: string, delta: number) => setCart(prev => {
    const cur = prev[itemId];
    if (!cur) return prev;
    const next = Math.max(0, cur.qty + delta);
    if (next === 0) { const c = { ...prev }; delete c[itemId]; return c; }
    return { ...prev, [itemId]: { ...cur, qty: next } };
  });
  const setLineNote = (itemId: string, n: string) => setCart(prev => ({ ...prev, [itemId]: { ...prev[itemId], notes: n } }));

  const callWaiter = async () => {
    setCalling(true);
    try {
      await fetch(API_BASE + "/food/table/public/" + tableId + "/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Chamada do cliente" }),
      });
      setWaiterCalled(true);
      setTimeout(() => setWaiterCalled(false), 4000);
    } catch {}
    setCalling(false);
  };

  const sendOrder = async () => {
    if (cartLines.length === 0) return;
    setSending(true);
    try {
      const orderItems = cartLines.map(c => ({
        item_id: c.item.id,
        item_name: c.item.name,
        quantity: c.qty,
        unit_price: Number(c.item.price),
        notes: c.notes || null,
      }));
      const res = await fetch(API_BASE + "/food/table/public/" + tableId + "/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderItems,
          customer_name: customerName.trim() || null,
          notes: observation.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSentOrder({
        order_id: data.order_id,
        total: Number(data.total || cartTotal),
        estimated_ready_at: data.estimated_ready_at || null,
        tracking_url: data.tracking_url || ("getaura.com.br/pedido/" + data.order_id),
      });
      setCart({});
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try { window.localStorage.removeItem(cartKey); } catch {}
      }
      setStage("sent");
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar pedido");
    }
    setSending(false);
  };

  // ─── render ───────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={T.red} size="large" />
        <Text style={{ color: T.ink3, marginTop: 12 }}>Carregando cardápio...</Text>
      </View>
    );
  }
  if (error || !menu) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: T.ink }}>Não foi possível carregar</Text>
        <Text style={{ fontSize: 13, color: T.ink3, marginTop: 4, textAlign: "center" }}>
          {error || "Mesa não encontrada. Verifique se o QR está correto."}
        </Text>
      </View>
    );
  }

  // SENT STAGE
  if (stage === "sent" && sentOrder) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{
          flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16,
        }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40, backgroundColor: T.green,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 40, color: "#fff" }}>✓</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: T.ink, textAlign: "center" }}>
            Pedido enviado!
          </Text>
          <Text style={{ fontSize: 14, color: T.ink3, textAlign: "center", lineHeight: 20 }}>
            Sua comanda da Mesa {menu.table.number} foi enviada pra cozinha.
          </Text>
          <View style={{
            backgroundColor: T.card, borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: T.border, alignItems: "center", gap: 6, minWidth: 240,
          }}>
            <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>Total do pedido</Text>
            <Text style={{ fontSize: 26, color: T.red, fontWeight: "800" }}>R$ {sentOrder.total.toFixed(2)}</Text>
            {sentOrder.estimated_ready_at && (
              <Text style={{ fontSize: 12, color: T.ink2, marginTop: 4 }}>
                Pronto em ±{Math.max(0, Math.round((new Date(sentOrder.estimated_ready_at).getTime() - Date.now()) / 60000))}min
              </Text>
            )}
          </View>
          <Pressable onPress={() => { setStage("menu"); setSentOrder(null); }} style={{
            backgroundColor: T.red, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8,
          }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>+ Pedir mais</Text>
          </Pressable>
          <Pressable onPress={callWaiter} disabled={callingWaiter} style={{
            paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
            borderWidth: 1, borderColor: T.border, opacity: callingWaiter ? 0.6 : 1,
          }}>
            <Text style={{ color: T.ink, fontSize: 13, fontWeight: "600" }}>
              {waiterCalled ? "✓ Garçom avisado" : "🔔 Chamar garçom"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // CART STAGE
  if (stage === "cart") {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{
          backgroundColor: T.card, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
          borderBottomWidth: 1, borderBottomColor: T.border,
          flexDirection: "row", alignItems: "center", gap: 10,
        }}>
          <Pressable onPress={() => setStage("menu")} style={{ padding: 4 }}>
            <Text style={{ fontSize: 22, color: T.ink2 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: T.ink }}>Seu pedido</Text>
            <Text style={{ fontSize: 11, color: T.ink3 }}>Mesa {menu.table.number}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}>
          {cartLines.length === 0 ? (
            <Text style={{ color: T.ink3, textAlign: "center", marginTop: 30 }}>Carrinho vazio</Text>
          ) : (
            cartLines.map(l => (
              <View key={l.item.id} style={{
                backgroundColor: T.card, borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: T.border, gap: 8,
              }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: T.ink, fontWeight: "700" }}>{l.item.name}</Text>
                    <Text style={{ fontSize: 12, color: T.red, fontWeight: "700", marginTop: 2 }}>
                      R$ {(Number(l.item.price) * l.qty).toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable onPress={() => changeQty(l.item.id, -1)} style={qtyBtn}><Text style={qtyTxt}>−</Text></Pressable>
                    <Text style={{ minWidth: 22, textAlign: "center", color: T.ink, fontWeight: "800", fontSize: 15 }}>{l.qty}</Text>
                    <Pressable onPress={() => changeQty(l.item.id, +1)} style={qtyBtn}><Text style={qtyTxt}>+</Text></Pressable>
                  </View>
                </View>
                <TextInput
                  value={l.notes} onChangeText={t => setLineNote(l.item.id, t)}
                  placeholder="Observação (ex: sem cebola)"
                  placeholderTextColor={T.ink4}
                  style={{ backgroundColor: T.bg, color: T.ink, padding: 8, borderRadius: 6, fontSize: 12, borderWidth: 1, borderColor: T.border }}
                />
              </View>
            ))
          )}

          {cartLines.length > 0 && (
            <>
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase", fontWeight: "600" }}>Seu nome (opcional)</Text>
                <TextInput
                  value={customerName} onChangeText={setCustomerName}
                  placeholder="Ex: Maria" placeholderTextColor={T.ink4}
                  style={{ backgroundColor: T.card, color: T.ink, padding: 12, borderRadius: 8, fontSize: 14, borderWidth: 1, borderColor: T.border }}
                />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase", fontWeight: "600" }}>Observação geral</Text>
                <TextInput
                  value={observation} onChangeText={setObservation}
                  placeholder="Algo a avisar pra cozinha?" placeholderTextColor={T.ink4}
                  multiline
                  style={{ backgroundColor: T.card, color: T.ink, padding: 12, borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: T.border, minHeight: 60 }}
                />
              </View>
            </>
          )}
        </ScrollView>

        <View style={{
          backgroundColor: T.card, padding: 14,
          borderTopWidth: 1, borderTopColor: T.border,
          flexDirection: "row", alignItems: "center", gap: 10,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: T.ink3, textTransform: "uppercase" }}>Total</Text>
            <Text style={{ fontSize: 20, color: T.red, fontWeight: "800" }}>R$ {cartTotal.toFixed(2)}</Text>
          </View>
          <Pressable
            onPress={sendOrder} disabled={cartLines.length === 0 || sending}
            style={{
              backgroundColor: T.red, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10,
              opacity: (cartLines.length === 0 || sending) ? 0.5 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
              {sending ? "Enviando..." : "Enviar pedido →"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // MENU STAGE
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Hero */}
      <View style={{ position: "relative" }}>
        <View style={[
          { padding: 24, paddingBottom: 28, backgroundColor: T.red },
          Platform.OS === "web" ? ({ background: "linear-gradient(135deg, " + T.red + ", " + T.orange + ")" } as any) : {},
        ]}>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
            Restaurante
          </Text>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 4 }}>
            {menu.business}
          </Text>
          <View style={{
            marginTop: 12, alignSelf: "flex-start",
            backgroundColor: "rgba(255,255,255,0.22)",
            paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999,
          }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              📍 Mesa {menu.table.number}
              {menu.table.seats ? "  ·  " + menu.table.seats + " lugares" : ""}
            </Text>
          </View>
        </View>
        <Pressable onPress={callWaiter} disabled={callingWaiter} style={{
          position: "absolute", top: 18, right: 18,
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: "rgba(255,255,255,0.28)",
          alignItems: "center", justifyContent: "center",
          opacity: callingWaiter ? 0.5 : 1,
        }}>
          <Text style={{ fontSize: 20 }}>{waiterCalled ? "✓" : "🔔"}</Text>
        </Pressable>
      </View>

      {/* Categorias sticky */}
      <View style={{ backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10, gap: 8 }}>
          <CatChip label="Todos" active={!activeCategory} onPress={() => setActiveCat(null)} />
          {menu.categories.map(c => (
            <CatChip key={c.id} label={c.name} active={activeCategory === c.id} onPress={() => setActiveCat(c.id)} />
          ))}
        </ScrollView>
      </View>

      {/* Lista de itens */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: cartCount > 0 ? 100 : 30 }}>
        {filtered.length === 0 ? (
          <Text style={{ color: T.ink3, textAlign: "center", marginTop: 30 }}>
            {items.length === 0 ? "Cardápio vazio" : "Nenhum item nessa categoria"}
          </Text>
        ) : (
          filtered.map(item => {
            const qty = cart[item.id]?.qty || 0;
            return (
              <View key={item.id} style={{
                backgroundColor: T.card, borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: T.border,
                flexDirection: "row", gap: 12,
              }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 10,
                  backgroundColor: "#f0e9e0",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 28 }}>🍽</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, color: T.ink, fontWeight: "700" }} numberOfLines={1}>{item.name}</Text>
                  {item.description && (
                    <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2, lineHeight: 15 }} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                  {item.preparation_time_min && (
                    <View style={{
                      alignSelf: "flex-start", marginTop: 4,
                      backgroundColor: "#fef3c7",
                      paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
                    }}>
                      <Text style={{ fontSize: 9, color: "#92400e", fontWeight: "700" }}>⏱ {item.preparation_time_min}min</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 14, color: T.red, fontWeight: "800", marginTop: 4 }}>
                    R$ {Number(item.price).toFixed(2)}
                  </Text>
                </View>
                {qty === 0 ? (
                  <Pressable onPress={() => addItem(item)} style={{
                    alignSelf: "flex-end",
                    width: 32, height: 32, borderRadius: 10, backgroundColor: T.red,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>+</Text>
                  </Pressable>
                ) : (
                  <View style={{ alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Pressable onPress={() => changeQty(item.id, -1)} style={qtyBtnLight}><Text style={qtyTxtLight}>−</Text></Pressable>
                    <Text style={{ minWidth: 20, textAlign: "center", color: T.ink, fontWeight: "800", fontSize: 14 }}>{qty}</Text>
                    <Pressable onPress={() => changeQty(item.id, +1)} style={qtyBtnLight}><Text style={qtyTxtLight}>+</Text></Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Cart bar fixa */}
      {cartCount > 0 && (
        <Pressable onPress={() => setStage("cart")} style={{
          position: "absolute", left: 12, right: 12, bottom: 12,
          backgroundColor: T.ink, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ backgroundColor: T.red, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{cartCount}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>itens no carrinho</Text>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>R$ {cartTotal.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Ver pedido →</Text>
        </Pressable>
      )}
    </View>
  );
}

function CatChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
      backgroundColor: active ? T.red : "#f5f5f5",
      borderWidth: 0,
    }}>
      <Text style={{ color: active ? "#fff" : T.ink2, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

const qtyBtn: any = {
  width: 30, height: 30, borderRadius: 8,
  backgroundColor: "#f5f5f5",
  alignItems: "center", justifyContent: "center",
};
const qtyTxt: any = { color: T.ink, fontSize: 16, fontWeight: "800" };
const qtyBtnLight: any = {
  width: 26, height: 26, borderRadius: 6,
  backgroundColor: "#f5f5f5",
  alignItems: "center", justifyContent: "center",
};
const qtyTxtLight: any = { color: T.ink, fontSize: 14, fontWeight: "800" };
