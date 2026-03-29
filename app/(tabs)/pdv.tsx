import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WIDE = SCREEN_W > 768;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// ── Mock Products ────────────────────────────────────────────
const MOCK_PRODUCTS = [
  { id: "1", name: "Corte Masculino", price: 45.00, category: "Servicos", stock: null },
  { id: "2", name: "Barba Completa", price: 30.00, category: "Servicos", stock: null },
  { id: "3", name: "Pomada Modeladora", price: 35.90, category: "Produtos", stock: 24 },
  { id: "4", name: "Shampoo Anticaspa", price: 28.50, category: "Produtos", stock: 18 },
  { id: "5", name: "Oleo para Barba", price: 42.00, category: "Produtos", stock: 12 },
  { id: "6", name: "Corte + Barba", price: 65.00, category: "Combos", stock: null },
  { id: "7", name: "Hidratacao Capilar", price: 55.00, category: "Servicos", stock: null },
  { id: "8", name: "Cera Capilar", price: 32.90, category: "Produtos", stock: 15 },
  { id: "9", name: "Toalha Quente", price: 10.00, category: "Extras", stock: null },
  { id: "10", name: "Cerveja Artesanal", price: 14.00, category: "Extras", stock: 36 },
];

type CartItem = { productId: string; name: string; price: number; qty: number };

// ── Product Card ─────────────────────────────────────────────

function ProductCard({ product, onAdd }: {
  product: typeof MOCK_PRODUCTS[0]; onAdd: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onPress={onAdd}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        pc.card,
        hovered && { borderColor: Colors.border2, transform: [{ scale: 1.02 }] },
        isWeb && { transition: "all 0.15s ease" } as any,
      ]}
    >
      <View style={pc.iconWrap}>
        <Text style={pc.icon}>{product.category === "Servicos" ? "S" : product.category === "Combos" ? "C" : "P"}</Text>
      </View>
      <Text style={pc.name} numberOfLines={1}>{product.name}</Text>
      <Text style={pc.price}>{fmt(product.price)}</Text>
      {product.stock != null && (
        <Text style={[pc.stock, product.stock < 5 && { color: Colors.red }]}>
          {product.stock} un
        </Text>
      )}
    </Pressable>
  );
}
const pc = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, width: IS_WIDE ? "30%" : "47%", margin: IS_WIDE ? "1.5%" : "1.5%", alignItems: "center", gap: 6 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  icon: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  name: { fontSize: 12, color: Colors.ink, fontWeight: "600", textAlign: "center" },
  price: { fontSize: 14, color: Colors.green, fontWeight: "700" },
  stock: { fontSize: 10, color: Colors.ink3 },
});

// ── Cart Item Row ────────────────────────────────────────────

function CartRow({ item, onPlus, onMinus, onRemove }: {
  item: CartItem; onPlus: () => void; onMinus: () => void; onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        cr.row,
        hovered && { backgroundColor: Colors.bg4 },
        isWeb && { transition: "background-color 0.15s ease" } as any,
      ]}
    >
      <View style={cr.info}>
        <Text style={cr.name} numberOfLines={1}>{item.name}</Text>
        <Text style={cr.unit}>{fmt(item.price)} / un</Text>
      </View>
      <View style={cr.controls}>
        <Pressable onPress={onMinus} style={cr.btn}><Text style={cr.btnText}>-</Text></Pressable>
        <Text style={cr.qty}>{item.qty}</Text>
        <Pressable onPress={onPlus} style={cr.btn}><Text style={cr.btnText}>+</Text></Pressable>
      </View>
      <Text style={cr.total}>{fmt(item.price * item.qty)}</Text>
      <Pressable onPress={onRemove} style={cr.removeBtn}><Text style={cr.removeText}>x</Text></Pressable>
    </Pressable>
  );
}
const cr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  info: { flex: 1 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  unit: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  controls: { flexDirection: "row", alignItems: "center", gap: 6 },
  btn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  qty: { fontSize: 14, color: Colors.ink, fontWeight: "700", minWidth: 20, textAlign: "center" },
  total: { fontSize: 13, color: Colors.green, fontWeight: "600", minWidth: 70, textAlign: "right" },
  removeBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  removeText: { fontSize: 11, color: Colors.red, fontWeight: "700" },
});

// ── Payment Method Select ────────────────────────────────────

const PAYMENTS = [
  { key: "pix", label: "Pix" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "cartao", label: "Cartao" },
  { key: "debito", label: "Debito" },
];

function PaymentSelect({ selected, onSelect }: { selected: string; onSelect: (k: string) => void }) {
  return (
    <View style={ps.row}>
      {PAYMENTS.map(p => (
        <Pressable key={p.key} onPress={() => onSelect(p.key)} style={[ps.chip, selected === p.key && ps.chipActive]}>
          <Text style={[ps.chipText, selected === p.key && ps.chipTextActive]}>{p.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const ps = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
});

// ── Main Screen ──────────────────────────────────────────────

export default function PdvScreen() {
  const { isDemo } = useAuthStore();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("pix");
  const [category, setCategory] = useState("Todos");
  const [saleComplete, setSaleComplete] = useState(false);

  const categories = ["Todos", ...Array.from(new Set(MOCK_PRODUCTS.map(p => p.category)))];

  const filtered = MOCK_PRODUCTS.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "Todos" || p.category === category;
    return matchSearch && matchCat;
  });

  function addToCart(product: typeof MOCK_PRODUCTS[0]) {
    setSaleComplete(false);
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { productId: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.qty + delta;
      return newQty > 0 ? { ...i, qty: newQty } : i;
    }));
  }

  function removeItem(productId: string) {
    setCart(prev => prev.filter(i => i.productId !== productId));
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);

  function finalizeSale() {
    if (cart.length === 0) return;
    setSaleComplete(true);
    setCart([]);
  }

  // ── Render ───────────────────────────────────────────────

  const productGrid = (
    <View style={s.productsSection}>
      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          placeholder="Buscar produto..."
          placeholderTextColor={Colors.ink3}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={s.catRow}>
        {categories.map(c => (
          <Pressable key={c} onPress={() => setCategory(c)} style={[s.catChip, category === c && s.catChipActive]}>
            <Text style={[s.catChipText, category === c && s.catChipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Products */}
      <View style={s.productGrid}>
        {filtered.map(p => (
          <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />
        ))}
      </View>
    </View>
  );

  const cartPanel = (
    <View style={s.cartSection}>
      <View style={s.cartHeader}>
        <Text style={s.cartTitle}>Carrinho</Text>
        <View style={s.cartBadge}><Text style={s.cartBadgeText}>{itemCount}</Text></View>
      </View>

      {cart.length === 0 && !saleComplete && (
        <View style={s.emptyCart}>
          <Text style={s.emptyIcon}>$</Text>
          <Text style={s.emptyText}>Toque em um produto para adicionar</Text>
        </View>
      )}

      {saleComplete && (
        <View style={s.successCard}>
          <Text style={s.successIcon}>OK</Text>
          <Text style={s.successTitle}>Venda registrada!</Text>
          <Text style={s.successSub}>Pagamento: {PAYMENTS.find(p => p.key === payment)?.label}</Text>
        </View>
      )}

      <ScrollView style={s.cartList} showsVerticalScrollIndicator={false}>
        {cart.map(item => (
          <CartRow
            key={item.productId}
            item={item}
            onPlus={() => updateQty(item.productId, 1)}
            onMinus={() => updateQty(item.productId, -1)}
            onRemove={() => removeItem(item.productId)}
          />
        ))}
      </ScrollView>

      {cart.length > 0 && (
        <View style={s.cartFooter}>
          <View style={s.divider} />

          <Text style={s.payLabel}>Pagamento</Text>
          <PaymentSelect selected={payment} onSelect={setPayment} />

          <View style={s.divider} />

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{fmt(total)}</Text>
          </View>

          <Pressable style={s.finalizeBtn} onPress={finalizeSale}>
            <Text style={s.finalizeBtnText}>Finalizar venda</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  if (IS_WIDE) {
    return (
      <View style={s.webRoot}>
        <ScrollView style={s.webLeft} contentContainerStyle={s.webLeftContent}>
          <Text style={s.pageTitle}>PDV</Text>
          {productGrid}
          {isDemo && (
            <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo - dados ilustrativos</Text></View>
          )}
        </ScrollView>
        <View style={s.webRight}>
          {cartPanel}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>PDV</Text>
      {productGrid}
      {cartPanel}
      {isDemo && (
        <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo - dados ilustrativos</Text></View>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const s = StyleSheet.create({
  // Mobile
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },

  // Web split layout
  webRoot: { flex: 1, flexDirection: "row", backgroundColor: Colors.bg },
  webLeft: { flex: 1 },
  webLeftContent: { padding: 32, paddingBottom: 48 },
  webRight: { width: 360, borderLeftWidth: 1, borderLeftColor: Colors.border, backgroundColor: Colors.bg2 },

  // Search
  searchRow: { marginBottom: 12 },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },

  // Categories
  catScroll: { flexGrow: 0, marginBottom: 16 },
  catRow: { flexDirection: "row", gap: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  catChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  catChipTextActive: { color: Colors.violet3, fontWeight: "600" },

  // Products
  productsSection: {},
  productGrid: { flexDirection: "row", flexWrap: "wrap" },

  // Cart
  cartSection: { padding: IS_WIDE ? 20 : 0, marginTop: IS_WIDE ? 0 : 24, flex: IS_WIDE ? 1 : undefined },
  cartHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  cartTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  cartBadge: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  cartBadgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  emptyCart: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 32, color: Colors.ink3 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center" },

  successCard: { alignItems: "center", paddingVertical: 24, gap: 6, backgroundColor: Colors.greenD, borderRadius: 14, marginBottom: 16 },
  successIcon: { fontSize: 24, color: Colors.green, fontWeight: "700" },
  successTitle: { fontSize: 16, color: Colors.green, fontWeight: "700" },
  successSub: { fontSize: 12, color: Colors.ink3 },

  cartList: { maxHeight: IS_WIDE ? 300 : undefined },

  cartFooter: { marginTop: 12 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  payLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  totalLabel: { fontSize: 16, color: Colors.ink, fontWeight: "600" },
  totalValue: { fontSize: 24, color: Colors.green, fontWeight: "800", letterSpacing: -0.5 },

  finalizeBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  finalizeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
