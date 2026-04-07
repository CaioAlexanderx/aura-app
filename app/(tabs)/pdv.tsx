import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, pdvApi } from "@/services/api";
import { toast } from "@/components/Toast";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
import { cacheProducts, getCachedProducts, addToQueue, getQueueLength, syncQueue, startAutoSync } from "@/services/offlineSync";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function useIsWide() {
  const [wide, setWide] = useState(Dimensions.get("window").width > 860);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setWide(window.innerWidth > 860);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return wide;
}

const MOCK_PRODUCTS = [
  { id: "1", name: "Corte Masculino", price: 45.00, category: "Servicos", stock: null, barcode: null },
  { id: "2", name: "Barba Completa", price: 30.00, category: "Servicos", stock: null, barcode: null },
  { id: "3", name: "Pomada Modeladora", price: 35.90, category: "Produtos", stock: 24, barcode: "7891000315507" },
  { id: "4", name: "Shampoo Anticaspa", price: 28.50, category: "Produtos", stock: 18, barcode: "7891000428901" },
  { id: "5", name: "Oleo para Barba", price: 42.00, category: "Produtos", stock: 12, barcode: null },
  { id: "6", name: "Corte + Barba", price: 65.00, category: "Combos", stock: null, barcode: null },
  { id: "7", name: "Hidratacao Capilar", price: 55.00, category: "Servicos", stock: null, barcode: null },
  { id: "8", name: "Cera Capilar", price: 32.90, category: "Produtos", stock: 15, barcode: "7891000532104" },
  { id: "9", name: "Toalha Quente", price: 10.00, category: "Extras", stock: null, barcode: null },
  { id: "10", name: "Cerveja Artesanal", price: 14.00, category: "Extras", stock: 36, barcode: "7891000667802" },
];

type CartItem = { productId: string; name: string; price: number; qty: number };
type SaleResult = { id: string; total: number; payment: string; items: CartItem[]; date: string };

function HoverButton({ label, color, bgColor, onPress, icon, full }: {
  label: string; color: string; bgColor: string; onPress: () => void; icon?: string; full?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable onPress={onPress} onHoverIn={isWeb ? () => setHovered(true) : undefined} onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[hb.btn, { backgroundColor: bgColor }, full && { flex: 1 }, hovered && { transform: [{ translateY: -2 }, { scale: 1.03 }], shadowColor: color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 }, isWeb && { transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" } as any]}>
      {icon && <Text style={[hb.icon, { color }]}>{icon}</Text>}
      <Text style={[hb.text, { color }]}>{label}</Text>
    </Pressable>
  );
}
const hb = StyleSheet.create({ btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16 }, icon: { fontSize: 15, fontWeight: "700" }, text: { fontSize: 14, fontWeight: "700" } });

function ProductCard({ product, onAdd, isWide }: { product: typeof MOCK_PRODUCTS[0]; onAdd: () => void; isWide: boolean }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const catIcon = product.category === "Servicos" ? "S" : product.category === "Combos" ? "C" : product.category === "Extras" ? "E" : "P";
  return (
    <Pressable onPress={onAdd} onHoverIn={isWeb ? () => setHovered(true) : undefined} onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[pc.card, { width: isWide ? "30%" : "47%", margin: "1.5%" }, hovered && pc.cardHovered, isWeb && { transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" } as any]}>
      <View style={[pc.iconWrap, hovered && pc.iconWrapHovered]}><Text style={pc.icon}>{catIcon}</Text></View>
      <Text style={pc.name} numberOfLines={1}>{product.name}</Text>
      <Text style={pc.price}>{fmt(product.price)}</Text>
      <View style={pc.bottomRow}>
        {product.stock != null && <Text style={[pc.stock, product.stock < 5 && { color: Colors.red }]}>{product.stock} un</Text>}
        {product.barcode && <Text style={pc.barcodeBadge}>EAN</Text>}
      </View>
    </Pressable>
  );
}
const pc = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", gap: 6 },
  cardHovered: { borderColor: Colors.violet2, transform: [{ translateY: -4 }, { scale: 1.04 }], shadowColor: Colors.violet, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8, backgroundColor: Colors.bg4 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 6, borderWidth: 1, borderColor: Colors.border2 },
  iconWrapHovered: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  icon: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600", textAlign: "center" },
  price: { fontSize: 15, color: Colors.green, fontWeight: "800" },
  bottomRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  stock: { fontSize: 10, color: Colors.ink3 },
  barcodeBadge: { fontSize: 8, color: Colors.violet3, backgroundColor: Colors.violetD, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, fontWeight: "600" },
});

function ScannerBar({ onScan }: { onScan: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  function handleScan() { if (!code.trim()) return; onScan(code.trim()); setCode(""); }
  function simulateScan() { setScanning(true); setTimeout(() => { const mockCode = "7891000315507"; setCode(mockCode); onScan(mockCode); setScanning(false); }, 800); }
  return (
    <View style={sc.bar}>
      <TextInput style={sc.input} placeholder="Codigo de barras ou QR..." placeholderTextColor={Colors.ink3} value={code} onChangeText={setCode} onSubmitEditing={handleScan} />
      <Pressable onPress={handleScan} style={sc.btn}><Text style={sc.btnText}>Buscar</Text></Pressable>
      <Pressable onPress={simulateScan} style={[sc.btn, sc.scanBtn]}><Text style={sc.scanBtnText}>{scanning ? "..." : "Escanear"}</Text></Pressable>
    </View>
  );
}
const sc = StyleSheet.create({ bar: { flexDirection: "row", gap: 8, marginBottom: 16 }, input: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: Colors.ink }, btn: { backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border }, btnText: { fontSize: 12, color: Colors.ink, fontWeight: "600" }, scanBtn: { backgroundColor: Colors.violetD, borderColor: Colors.border2 }, scanBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" } });

function CartRow({ item, onPlus, onMinus, onRemove }: { item: CartItem; onPlus: () => void; onMinus: () => void; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable onHoverIn={isWeb ? () => setHovered(true) : undefined} onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[cr.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}>
      <View style={cr.info}><Text style={cr.name} numberOfLines={1}>{item.name}</Text><Text style={cr.unit}>{fmt(item.price)} / un</Text></View>
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
const cr = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 }, info: { flex: 1 }, name: { fontSize: 13, color: Colors.ink, fontWeight: "500" }, unit: { fontSize: 10, color: Colors.ink3, marginTop: 1 }, controls: { flexDirection: "row", alignItems: "center", gap: 6 }, btn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" }, btnText: { fontSize: 14, color: Colors.ink, fontWeight: "600" }, qty: { fontSize: 14, color: Colors.ink, fontWeight: "700", minWidth: 20, textAlign: "center" }, total: { fontSize: 13, color: Colors.green, fontWeight: "600", minWidth: 70, textAlign: "right" }, removeBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" }, removeText: { fontSize: 11, color: Colors.red, fontWeight: "700" } });

const PAYMENTS = [{ key: "pix", label: "Pix" }, { key: "dinheiro", label: "Dinheiro" }, { key: "cartao", label: "Cartao" }, { key: "debito", label: "Debito" }];

function PaymentSelect({ selected, onSelect }: { selected: string; onSelect: (k: string) => void }) {
  return (<View style={pss.row}>{PAYMENTS.map(p => { const active = selected === p.key; return (<Pressable key={p.key} onPress={() => onSelect(p.key)} style={[pss.chip, active && pss.chipActive]}><Text style={[pss.chipText, active && pss.chipTextActive]}>{p.label}</Text></Pressable>); })}</View>);
}
const pss = StyleSheet.create({ row: { flexDirection: "row", gap: 6, flexWrap: "wrap" }, chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border }, chipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet }, chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" }, chipTextActive: { color: "#fff", fontWeight: "600" } });

function SaleCompleteView({ sale, onNewSale, onEmitNfe }: { sale: SaleResult; onNewSale: () => void; onEmitNfe: () => void }) {
  return (
    <View style={sv.container}>
      <View style={sv.card}>
        <View style={sv.checkCircle}><Text style={sv.checkIcon}>OK</Text></View>
        <Text style={sv.title}>Venda registrada!</Text>
        <Text style={sv.saleId}>#{sale.id}</Text>
        <View style={sv.summaryRow}><Text style={sv.summaryLabel}>Total</Text><Text style={sv.summaryValue}>{fmt(sale.total)}</Text></View>
        <View style={sv.summaryRow}><Text style={sv.summaryLabel}>Pagamento</Text><Text style={sv.summaryMeta}>{PAYMENTS.find(p => p.key === sale.payment)?.label}</Text></View>
        <View style={sv.summaryRow}><Text style={sv.summaryLabel}>Itens</Text><Text style={sv.summaryMeta}>{sale.items.reduce((s, i) => s + i.qty, 0)} produtos</Text></View>
        <View style={sv.divider} />
        <View style={sv.actions}>
          <HoverButton label="Emitir NF-e" icon="N" color={Colors.ink} bgColor={Colors.bg4} onPress={onEmitNfe} full />
          <HoverButton label="Nova venda" icon="+" color="#fff" bgColor={Colors.violet} onPress={onNewSale} full />
        </View>
        <View style={sv.secondaryActions}>
          <Pressable style={sv.linkBtn}><Text style={sv.linkText}>Imprimir cupom</Text></Pressable>
          <Pressable style={sv.linkBtn}><Text style={sv.linkText}>Enviar por WhatsApp</Text></Pressable>
        </View>
      </View>
    </View>
  );
}
const sv = StyleSheet.create({ container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }, card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border, maxWidth: 420, width: "100%" }, checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 2, borderColor: Colors.green }, checkIcon: { fontSize: 20, color: Colors.green, fontWeight: "800" }, title: { fontSize: 20, color: Colors.ink, fontWeight: "700", marginBottom: 4 }, saleId: { fontSize: 12, color: Colors.ink3, marginBottom: 20 }, summaryRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 8 }, summaryLabel: { fontSize: 13, color: Colors.ink3 }, summaryValue: { fontSize: 18, color: Colors.green, fontWeight: "800" }, summaryMeta: { fontSize: 13, color: Colors.ink, fontWeight: "600" }, divider: { height: 1, backgroundColor: Colors.border, width: "100%", marginVertical: 16 }, actions: { flexDirection: "row", gap: 10, width: "100%" }, secondaryActions: { flexDirection: "row", gap: 16, marginTop: 16 }, linkBtn: { paddingVertical: 6 }, linkText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" } });

export default function PdvScreen() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();

  // CONN-12: Fetch real products from backend
  const { data: apiProducts } = useQuery({
    queryKey: ["products", company?.id],
    queryFn: () => companiesApi.products(company!.id),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
  });

  // Mutation for creating sales
  const saleMutation = useMutation({
    mutationFn: (body: any) => pdvApi.createSale(company!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", company?.id] });
      qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });
      qc.invalidateQueries({ queryKey: ["transactions", company?.id] });
    },
  });
  const IS_WIDE = useIsWide();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("pix");
  const [category, setCategory] = useState("Todos");
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);

  // Use API products if available, fallback to mock
  let products = (apiProducts?.products || apiProducts?.rows || apiProducts) instanceof Array
    ? (apiProducts.products || apiProducts.rows || apiProducts).map((p: any) => ({
        id: p.id || p.product_id,
        name: p.name || p.product_name,
        price: parseFloat(p.price || p.sale_price) || 0,
        category: p.category || "Produtos",
        stock: p.stock_quantity != null ? parseInt(p.stock_quantity) : p.stock,
        barcode: p.barcode || p.ean || null,
      }))
    : MOCK_PRODUCTS;
  if (products.length === 0) { products = MOCK_PRODUCTS; }
  const categories = ["Todos", ...Array.from(new Set(products.map((p: any) => p.category)))];
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "Todos" || p.category === category;
    return matchSearch && matchCat;
  });

  function handleScan(code: string) { const product = products.find((p: any) => p.barcode === code); if (product) addToCart(product); else setSearch(code); }
  function addToCart(product: typeof MOCK_PRODUCTS[0]) { setLastSale(null); setCart(prev => { const existing = prev.find(i => i.productId === product.id); if (existing) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i); return [...prev, { productId: product.id, name: product.name, price: product.price, qty: 1 }]; }); }
  function updateQty(productId: string, delta: number) { setCart(prev => prev.map(i => { if (i.productId !== productId) return i; const newQty = i.qty + delta; return newQty > 0 ? { ...i, qty: newQty } : i; })); }
  function removeItem(productId: string) { setCart(prev => prev.filter(i => i.productId !== productId)); }
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);
  function finalizeSale() { if (cart.length === 0) return; const saleId = Date.now().toString(36).toUpperCase().slice(-6); setLastSale({ id: saleId, total, payment, items: [...cart], date: new Date().toLocaleString("pt-BR") }); setCart([]); }
  function newSale() { setLastSale(null); setCart([]); setSearch(""); }
  function emitNfe() { alert("Emissao de NF-e sera integrada com NFE.io apos CNPJ aprovado."); }

  if (lastSale) {
    if (IS_WIDE) return (<View style={s.webRoot}><View style={{ flex: 1 }}><SaleCompleteView sale={lastSale} onNewSale={newSale} onEmitNfe={emitNfe} /></View></View>);
    return <SaleCompleteView sale={lastSale} onNewSale={newSale} onEmitNfe={emitNfe} />;
  }

  const productGrid = (
    <View>
      <ScannerBar onScan={handleScan} />
      <View style={{ marginBottom: 12 }}><TextInput style={s.searchInput} placeholder="Buscar produto por nome..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {categories.map(c => (<Pressable key={c} onPress={() => setCategory(c)} style={[s.catChip, category === c && s.catChipActive]}><Text style={[s.catChipText, category === c && s.catChipTextActive]}>{c}</Text></Pressable>))}
      </ScrollView>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {filtered.map(p => (<ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} isWide={IS_WIDE} />))}
        {filtered.length === 0 && <View style={{ width: "100%", alignItems: "center", paddingVertical: 40 }}><Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text></View>}
      </View>
    </View>
  );

  const cartPanel = (
    <View style={{ padding: IS_WIDE ? 20 : 0, marginTop: IS_WIDE ? 0 : 24, flex: IS_WIDE ? 1 : undefined }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Text style={{ fontSize: 16, color: Colors.ink, fontWeight: "700" }}>Caixa</Text>
        {itemCount > 0 && <View style={{ backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: "#fff", fontWeight: "700" }}>{itemCount}</Text></View>}
      </View>
      {cart.length === 0 && (<View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}><Text style={{ fontSize: 32, color: Colors.ink3 }}>$</Text><Text style={{ fontSize: 12, color: Colors.ink3, textAlign: "center" }}>Toque em um produto ou escaneie um codigo</Text></View>)}
      <ScrollView style={{ maxHeight: IS_WIDE ? 280 : undefined }} showsVerticalScrollIndicator={false}>
        {cart.map(item => (<CartRow key={item.productId} item={item} onPlus={() => updateQty(item.productId, 1)} onMinus={() => updateQty(item.productId, -1)} onRemove={() => removeItem(item.productId)} />))}
      </ScrollView>
      {cart.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 12 }} />
          <Text style={{ fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Pagamento</Text>
          <PaymentSelect selected={payment} onSelect={setPayment} />
          <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 12 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ fontSize: 16, color: Colors.ink, fontWeight: "600" }}>Total</Text>
            <Text style={{ fontSize: 24, color: Colors.green, fontWeight: "800", letterSpacing: -0.5 }}>{fmt(total)}</Text>
          </View>
          <HoverButton label="Finalizar venda" icon="$" color="#fff" bgColor={Colors.violet} onPress={finalizeSale} />
        </View>
      )}
    </View>
  );

  if (IS_WIDE) {
    return (
      <View style={s.webRoot}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 32, paddingBottom: 48 }}>
          <Text style={s.pageTitle}>Caixa</Text>
          {productGrid}
          {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo - dados ilustrativos</Text></View>}
        </ScrollView>
        <View style={{ width: 380, borderLeftWidth: 1, borderLeftColor: Colors.border, backgroundColor: Colors.bg2 }}>{cartPanel}</View>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text style={s.pageTitle}>Caixa</Text>
      {productGrid}
      {cartPanel}
      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo - dados ilustrativos</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },
  webRoot: { flex: 1, flexDirection: "row", backgroundColor: "transparent" },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  catChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  catChipTextActive: { color: Colors.violet3, fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
