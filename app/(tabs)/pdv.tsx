import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";
import { ProductCard } from "@/components/screens/pdv/ProductCard";
import { CartPanel } from "@/components/screens/pdv/CartPanel";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { ScannerBar } from "@/components/screens/pdv/ScannerBar";

function useIsWide() {
  const [wide, setWide] = useState((typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 860);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setWide(window.innerWidth > 860);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return wide;
}

export default function PdvScreen() {
  const { products, isDemo } = useProducts();
  const { cart, payment, setPayment, lastSale, total, itemCount, addToCart, setQty, updateQty, removeItem, finalizeSale, newSale } = useCart();
  const IS_WIDE = useIsWide();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");

  const categories = ["Todos", ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "Todos" || p.category === category;
    return matchSearch && matchCat;
  });

  function handleScan(code: string) {
    const product = products.find(p => p.barcode === code);
    if (product) addToCart(product);
    else setSearch(code);
  }

  function emitNfe() { toast.info("Emissao de NF-e sera integrada apos configuracao do provedor."); }

  if (lastSale) {
    if (IS_WIDE) return <View style={s.webRoot}><View style={{ flex: 1 }}><SaleComplete sale={lastSale} onNewSale={newSale} onEmitNfe={emitNfe} /></View></View>;
    return <SaleComplete sale={lastSale} onNewSale={newSale} onEmitNfe={emitNfe} />;
  }

  const productGrid = (
    <View>
      <ScannerBar onScan={handleScan} />
      <TextInput style={s.searchInput} placeholder="Buscar produto por nome..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {categories.map(c => <Pressable key={c} onPress={() => setCategory(c)} style={[s.catChip, category === c && s.catChipActive]}><Text style={[s.catChipText, category === c && s.catChipTextActive]}>{c}</Text></Pressable>)}
      </ScrollView>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {filtered.map(p => <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} isWide={IS_WIDE} />)}
        {filtered.length === 0 && products.length === 0 && <EmptyState icon="package" iconColor={Colors.amber} title="Nenhum produto cadastrado" subtitle="Cadastre produtos no Estoque para eles aparecerem aqui no Caixa." />}
        {filtered.length === 0 && products.length > 0 && <View style={{ width: "100%", alignItems: "center", paddingVertical: 40 }}><Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text></View>}
      </View>
    </View>
  );

  const cartPanel = <CartPanel cart={cart} payment={payment} setPayment={setPayment} total={total} itemCount={itemCount} isWide={IS_WIDE} setQty={setQty} updateQty={updateQty} removeItem={removeItem} finalizeSale={finalizeSale} />;

  if (IS_WIDE) return (
    <View style={s.webRoot}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 32, paddingBottom: 48 }}>
        <Text style={s.pageTitle}>Caixa</Text>
        {productGrid}
        {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
      </ScrollView>
      <View style={{ width: 380, borderLeftWidth: 1, borderLeftColor: Colors.border, backgroundColor: Colors.bg2 }}>{cartPanel}</View>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text style={s.pageTitle}>Caixa</Text>
      {productGrid}
      {cartPanel}
      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },
  webRoot: { flex: 1, flexDirection: "row", backgroundColor: "transparent" },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 12 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  catChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  catChipTextActive: { color: Colors.violet3, fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
