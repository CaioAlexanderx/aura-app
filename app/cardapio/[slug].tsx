import { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";

const API_BASE = ((typeof process !== "undefined" && (process.env as any)?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1");

const T = {
  bg: "#fafaf5", card: "#ffffff", border: "#e8e2d8",
  ink: "#1a1a2e", ink2: "#444", ink3: "#888", ink4: "#aaa",
  red: "#EF4444", orange: "#f97316", green: "#10B981", amber: "#F59E0B",
};

type FoodItem = {
  id: string; category_id: string | null;
  name: string; description: string | null; price: number;
  photo_url: string | null; preparation_time_min: number | null;
  is_active: boolean; is_available: boolean;
};
type Cat  = { id: string; name: string; sort_order: number };
type Menu = {
  id: string; name: string; slug: string;
  accepts_online_orders: boolean; min_order_amount: number | null;
  description: string | null; company_id: string;
};
type Zone = { id: string; name: string; fee: number; min_time_min: number | null; max_time_min: number | null };

type CartLine = { item: FoodItem; qty: number; notes: string };

export default function CardapioPage() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = String(params.slug || "");
  const cartKey = "aura-food-storefront-" + slug;

  const [menu, setMenu]       = useState<Menu | null>(null);
  const [categories, setCats] = useState<Cat[]>([]);
  const [items, setItems]     = useState<FoodItem[]>([]);
  const [business, setBiz]    = useState<string>("");
  const [zones, setZones]     = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart]           = useState<Record<string, CartLine>>({});
  const [stage, setStage]         = useState<"menu" | "cart" | "sent">("menu");

  // form cart
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [zoneId, setZoneId]               = useState<string | null>(null);
  const [street, setStreet]   = useState("");
  const [number, setNumber]   = useState("");
  const [complement, setComp] = useState("");
  const [neighborhood, setNeigh] = useState("");
  const [city, setCity]       = useState("");
  const [notes, setNotes]     = useState("");

  const [sending, setSending] = useState(false);
  const [sentOrder, setSent]  = useState<{ order_id: string; total: number; delivery_fee: number; estimated_ready_at: string | null } | null>(null);

  useEffect(() => {
    if (!slug) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try { const saved = window.localStorage.getItem(cartKey); if (saved) setCart(JSON.parse(saved)); } catch {}
    }
    Promise.all([
      fetch(API_BASE + "/food/menu/public/" + slug).then(r => r.json()),
      fetch(API_BASE + "/food/menu/public/" + slug + "/zones").then(r => r.json()),
    ])
      .then(([m, z]) => {
        if (m.error) throw new Error(m.error);
        setMenu(m.menu);
        setCats(m.categories || []);
        setItems(m.items || []);
        setBiz(m.menu?.name || "Cardápio");
        setZones(Array.isArray(z) ? z : []);
        setLoading(false);
      })
      .catch(e => { setError(e?.message || "Erro"); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !slug) return;
    try { window.localStorage.setItem(cartKey, JSON.stringify(cart)); } catch {}
  }, [cart, slug, cartKey]);

  const filtered = useMemo(() => {
    let out = items.filter(i => i.is_active && i.is_available);
    if (activeCat) out = out.filter(i => i.category_id === activeCat);
    return out;
  }, [items, activeCat]);

  const lines     = Object.values(cart).filter(c => c.qty > 0);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal  = lines.reduce((s, l) => s + Number(l.item.price) * l.qty, 0);
  const zoneFee   = zoneId ? Number(zones.find(z => z.id === zoneId)?.fee || 0) : 0;
  const total     = subtotal + zoneFee;

  const minOrder = menu?.min_order_amount ? Number(menu.min_order_amount) : 0;
  const meetsMin = subtotal >= minOrder;

  const addItem = (it: FoodItem) => setCart(p => ({ ...p, [it.id]: { item: it, qty: (p[it.id]?.qty || 0) + 1, notes: p[it.id]?.notes || "" } }));
  const changeQty = (id: string, d: number) => setCart(p => {
    const c = p[id]; if (!c) return p;
    const nq = Math.max(0, c.qty + d);
    if (nq === 0) { const x = { ...p }; delete x[id]; return x; }
    return { ...p, [id]: { ...c, qty: nq } };
  });

  const sendOrder = async () => {
    if (lines.length === 0) return;
    if (!customerName || !customerPhone) { setError("Nome e telefone obrigatórios"); return; }
    if (!meetsMin) { setError("Pedido mínimo de R$ " + minOrder.toFixed(2)); return; }
    setSending(true); setError(null);
    try {
      const orderItems = lines.map(l => ({
        item_id: l.item.id, item_name: l.item.name,
        quantity: l.qty, unit_price: Number(l.item.price),
        notes: l.notes || null,
      }));
      const delivery_address = (street || neighborhood || city) ? {
        street, number, complement, neighborhood, city,
      } : null;
      const res = await fetch(API_BASE + "/food/menu/public/" + slug + "/order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderItems, customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          delivery_address, delivery_zone_id: zoneId,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSent({
        order_id: data.order_id, total: Number(data.total || total),
        delivery_fee: Number(data.delivery_fee || zoneFee),
        estimated_ready_at: data.estimated_ready_at || null,
      });
      setCart({});
      if (Platform.OS === "web" && typeof window !== "undefined") { try { window.localStorage.removeItem(cartKey); } catch {} }
      setStage("sent");
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar pedido");
    }
    setSending(false);
  };

  if (loading) return <Center><ActivityIndicator color={T.red} size="large" /></Center>;
  if (error && !menu) return <Center><Text style={{ fontSize: 36 }}>⚠️</Text><Text style={{ color: T.ink, fontWeight: "700", marginTop: 12 }}>{error}</Text></Center>;
  if (!menu) return null;

  if (stage === "sent" && sentOrder) {
    return (
      <Center>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: T.green, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 40, color: "#fff" }}>✓</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "800", color: T.ink, marginTop: 16 }}>Pedido enviado!</Text>
        <Text style={{ fontSize: 13, color: T.ink3, marginTop: 6, textAlign: "center", maxWidth: 320 }}>
          Você receberá confirmação por WhatsApp e atualizações do pedido.
        </Text>
        <View style={{ backgroundColor: T.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: T.border, alignItems: "center", gap: 6, minWidth: 260, marginTop: 16 }}>
          <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Total</Text>
          <Text style={{ fontSize: 26, color: T.red, fontWeight: "800" }}>R$ {sentOrder.total.toFixed(2)}</Text>
          {sentOrder.delivery_fee > 0 && <Text style={{ fontSize: 11, color: T.ink3 }}>Inclui entrega R$ {sentOrder.delivery_fee.toFixed(2)}</Text>}
          {sentOrder.estimated_ready_at && (
            <Text style={{ fontSize: 12, color: T.ink2, marginTop: 4 }}>
              Pronto em ±{Math.max(0, Math.round((new Date(sentOrder.estimated_ready_at).getTime() - Date.now()) / 60000))}min
            </Text>
          )}
        </View>
        <Pressable onPress={() => { setStage("menu"); setSent(null); }} style={{ backgroundColor: T.red, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 16 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>+ Pedir mais</Text>
        </Pressable>
      </Center>
    );
  }

  if (stage === "cart") {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{ backgroundColor: T.card, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.border, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => setStage("menu")}><Text style={{ fontSize: 22, color: T.ink2 }}>←</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: T.ink }}>Seu pedido</Text>
            <Text style={{ fontSize: 11, color: T.ink3 }}>{business}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }}>
          {/* items */}
          {lines.map(l => (
            <View key={l.item.id} style={{ backgroundColor: T.card, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: T.border, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: T.ink, fontWeight: "700" }}>{l.item.name}</Text>
                <Text style={{ fontSize: 12, color: T.red, fontWeight: "700", marginTop: 2 }}>R$ {(Number(l.item.price) * l.qty).toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pressable onPress={() => changeQty(l.item.id, -1)} style={qtyBtn}><Text style={qtyTxt}>−</Text></Pressable>
                <Text style={{ minWidth: 22, textAlign: "center", fontWeight: "800", color: T.ink }}>{l.qty}</Text>
                <Pressable onPress={() => changeQty(l.item.id, 1)} style={qtyBtn}><Text style={qtyTxt}>+</Text></Pressable>
              </View>
            </View>
          ))}

          {/* address form */}
          <Text style={sectionLabel}>Seus dados</Text>
          <FieldRow><FInput v={customerName} on={setCustomerName} ph="Nome *" /></FieldRow>
          <FieldRow><FInput v={customerPhone} on={setCustomerPhone} ph="WhatsApp/Telefone *" kb="phone-pad" /></FieldRow>

          <Text style={sectionLabel}>Endereço de entrega</Text>
          <FieldRow><FInput v={street} on={setStreet} ph="Rua" flex={3} /><FInput v={number} on={setNumber} ph="Nº" flex={1} /></FieldRow>
          <FieldRow><FInput v={complement} on={setComp} ph="Complemento" /></FieldRow>
          <FieldRow><FInput v={neighborhood} on={setNeigh} ph="Bairro" flex={2} /><FInput v={city} on={setCity} ph="Cidade" flex={2} /></FieldRow>

          {zones.length > 0 && (
            <>
              <Text style={sectionLabel}>Zona de entrega</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {zones.map(z => (
                  <Pressable key={z.id} onPress={() => setZoneId(z.id)} style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: zoneId === z.id ? T.red : T.card,
                    borderWidth: 1, borderColor: zoneId === z.id ? T.red : T.border,
                  }}>
                    <Text style={{ color: zoneId === z.id ? "#fff" : T.ink, fontSize: 12, fontWeight: "700" }}>{z.name}</Text>
                    <Text style={{ color: zoneId === z.id ? "rgba(255,255,255,0.8)" : T.ink3, fontSize: 10 }}>
                      R$ {Number(z.fee).toFixed(2)} · {z.min_time_min || "?"}-{z.max_time_min || "?"}min
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={sectionLabel}>Observação</Text>
          <FieldRow><FInput v={notes} on={setNotes} ph="Ex: trocar gelo, sem cebola" multi /></FieldRow>

          {/* totais */}
          <View style={{ backgroundColor: T.card, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: T.border, gap: 4, marginTop: 6 }}>
            <TotalRow l="Subtotal" v={subtotal} />
            <TotalRow l="Entrega" v={zoneFee} muted />
            <View style={{ height: 1, backgroundColor: T.border, marginVertical: 4 }} />
            <TotalRow l="Total" v={total} big />
          </View>

          {!meetsMin && minOrder > 0 && (
            <Text style={{ fontSize: 12, color: T.red, textAlign: "center" }}>
              Pedido mínimo R$ {minOrder.toFixed(2)} — faltam R$ {(minOrder - subtotal).toFixed(2)}
            </Text>
          )}
          {error && <Text style={{ fontSize: 12, color: T.red, textAlign: "center" }}>{error}</Text>}
        </ScrollView>

        <View style={{ backgroundColor: T.card, padding: 14, borderTopWidth: 1, borderTopColor: T.border }}>
          <Pressable
            onPress={sendOrder} disabled={!meetsMin || !customerName || !customerPhone || sending}
            style={{ backgroundColor: T.red, paddingVertical: 14, borderRadius: 10, alignItems: "center",
              opacity: (!meetsMin || !customerName || !customerPhone || sending) ? 0.4 : 1 }}>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
              {sending ? "Enviando..." : ("Enviar pedido • R$ " + total.toFixed(2))}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // MENU stage
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={[
        { padding: 24, paddingBottom: 28, backgroundColor: T.red },
        Platform.OS === "web" ? ({ background: "linear-gradient(135deg, " + T.red + ", " + T.orange + ")" } as any) : {},
      ]}>
        <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Delivery</Text>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{business}</Text>
        {minOrder > 0 && (
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 6 }}>
            Pedido mínimo R$ {minOrder.toFixed(2)}
          </Text>
        )}
      </View>

      <View style={{ backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10, gap: 8 }}>
          <CatChip label="Todos" active={!activeCat} onPress={() => setActiveCat(null)} />
          {categories.map(c => <CatChip key={c.id} label={c.name} active={activeCat === c.id} onPress={() => setActiveCat(c.id)} />)}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: cartCount > 0 ? 100 : 30 }}>
        {filtered.map(item => {
          const qty = cart[item.id]?.qty || 0;
          return (
            <View key={item.id} style={{ backgroundColor: T.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border, flexDirection: "row", gap: 12 }}>
              <View style={{ width: 60, height: 60, borderRadius: 10, backgroundColor: "#f0e9e0", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 26 }}>🍽</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: T.ink, fontWeight: "700" }}>{item.name}</Text>
                {item.description && <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }} numberOfLines={2}>{item.description}</Text>}
                <Text style={{ fontSize: 14, color: T.red, fontWeight: "800", marginTop: 4 }}>R$ {Number(item.price).toFixed(2)}</Text>
              </View>
              {qty === 0 ? (
                <Pressable onPress={() => addItem(item)} style={{ alignSelf: "flex-end", width: 32, height: 32, borderRadius: 10, backgroundColor: T.red, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>+</Text>
                </Pressable>
              ) : (
                <View style={{ alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Pressable onPress={() => changeQty(item.id, -1)} style={qtyBtnSm}><Text style={qtyTxtSm}>−</Text></Pressable>
                  <Text style={{ minWidth: 20, textAlign: "center", color: T.ink, fontWeight: "800" }}>{qty}</Text>
                  <Pressable onPress={() => changeQty(item.id, 1)} style={qtyBtnSm}><Text style={qtyTxtSm}>+</Text></Pressable>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {cartCount > 0 && (
        <Pressable onPress={() => setStage("cart")} style={{ position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: T.ink, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ backgroundColor: T.red, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{cartCount}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>itens</Text>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>R$ {subtotal.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Continuar →</Text>
        </Pressable>
      )}
    </View>
  );
}

function Center({ children }: { children: any }) {
  return <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>{children}</View>;
}
function CatChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: active ? T.red : "#f5f5f5" }}>
      <Text style={{ color: active ? "#fff" : T.ink2, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
function FieldRow({ children }: { children: any }) {
  return <View style={{ flexDirection: "row", gap: 8 }}>{children}</View>;
}
function FInput({ v, on, ph, kb, multi, flex }: { v: string; on: (s: string) => void; ph: string; kb?: any; multi?: boolean; flex?: number }) {
  return (
    <TextInput
      value={v} onChangeText={on} placeholder={ph} placeholderTextColor={T.ink4}
      keyboardType={kb}
      multiline={multi}
      style={{
        flex: flex ?? 1, backgroundColor: T.card, color: T.ink, padding: 12,
        borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: T.border,
        minHeight: multi ? 60 : undefined,
      }}
    />
  );
}
function TotalRow({ l, v, big, muted }: { l: string; v: number; big?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: big ? 14 : 12, color: big ? T.ink : (muted ? T.ink3 : T.ink2), fontWeight: big ? "800" : "500" }}>{l}</Text>
      <Text style={{ fontSize: big ? 18 : 12, color: big ? T.red : (muted ? T.ink3 : T.ink), fontWeight: big ? "800" : "600" }}>R$ {Number(v).toFixed(2)}</Text>
    </View>
  );
}
const sectionLabel: any = { fontSize: 11, color: T.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10 };
const qtyBtn: any   = { width: 30, height: 30, borderRadius: 8, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" };
const qtyTxt: any   = { color: T.ink, fontSize: 16, fontWeight: "800" };
const qtyBtnSm: any = { width: 26, height: 26, borderRadius: 6, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" };
const qtyTxtSm: any = { color: T.ink, fontSize: 14, fontWeight: "800" };
