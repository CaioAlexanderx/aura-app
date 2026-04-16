import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useCustomers } from "@/hooks/useCustomers";
import { EmptyState } from "@/components/EmptyState";
import { BrandBanner } from "@/components/BrandBanner";
import { ScrollableChips } from "@/components/ScrollableChips";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { ProductCard } from "@/components/screens/pdv/ProductCard";
import { CartPanel } from "@/components/screens/pdv/CartPanel";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { ScannerBar } from "@/components/screens/pdv/ScannerBar";
import { QuickCustomerModal } from "@/components/QuickCustomerModal";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { employeesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = 20;

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
  const { company } = useAuthStore();
  const { customers } = useCustomers();
  const {
    cart, payment, setPayment, lastSale, total, totalAfterCoupon, itemCount, isProcessing,
    addToCart, setQty, updateQty, removeItem, finalizeSale, newSale,
    selectedCustomerId, selectedCustomerName, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
  } = useCart();
  const IS_WIDE = useIsWide();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  // "Novo Cliente" é funcionalidade de CRM — disponível a partir do plano Negócio
  const canAddCustomer = (company?.plan || "essencial") !== "essencial";

  const { data: empData } = useQuery({
    queryKey: ["employees", company?.id],
    queryFn: () => employeesApi.list(company!.id),
    enabled: !!company?.id,
    staleTime: 60000,
  });
  const employees = (empData?.employees || []).map((e: any) => ({ id: e.id, name: e.name || "" }));
  const slimCustomers = customers.map(c => ({ id: c.id, name: c.name, phone: c.phone }));

  const categories = ["Todos", ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "Todos" || p.category === category;
    return matchSearch && matchCat;
  });
  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(filtered, PAGE_SIZE, search + category);

  function handleScan(code: string) {
    const product = products.find(p => p.barcode === code);
    if (product) addToCart(product);
    else setSearch(code);
  }

  function emitNfe() { toast.info("Emissao de NF-e sera integrada apos configuracao do provedor."); }

  function handleCustomerCreated(c: { id: string; name: string; phone: string }) {
    selectCustomer(c.id, c.name);
  }

  if (lastSale) {
    if (IS_WIDE) return <View style={s.webRoot}><View style={{ flex: 1 }}><SaleComplete sale={lastSale} onNewSale={newSale} onEmitNfe={emitNfe} /></View></View>;
    return <SaleComplete sale={lastSale} onNewSale={newSale} onEmitNfe={emitNfe} />;
  }

  const productGrid = (
    <View>
      <ScannerBar onScan={handleScan} />
      <View style={s.searchRow}>
        <TextInput style={[s.searchInput, { flex: 1 }]} placeholder="Buscar produto por nome..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
        {canAddCustomer && (
          <Pressable onPress={() => setShowNewCustomer(true)} style={s.newCustomerBtn}>
            <Icon name="user_plus" size={15} color={Colors.violet3} />
            <Text style={s.newCustomerText}>Novo cliente</Text>
          </Pressable>
        )}
      </View>
      <ScrollableChips items={categories} active={category} onSelect={setCategory} />
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {paginated.map(p => <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} isWide={IS_WIDE} />)}
        {filtered.length === 0 && products.length === 0 && <EmptyState icon="package" iconColor={Colors.amber} title="Nenhum produto cadastrado" subtitle="Cadastre produtos no Estoque para eles aparecerem aqui no Caixa." />}
        {filtered.length === 0 && products.length > 0 && <View style={{ width: "100%", alignItems: "center", paddingVertical: 40 }}><Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text></View>}
      </View>
      <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
    </View>
  );

  const cartPanelProps = {
    cart, payment, setPayment, total, totalAfterCoupon, itemCount, isWide: IS_WIDE,
    setQty, updateQty, removeItem, finalizeSale, isProcessing,
    customers: slimCustomers, employees,
    selectedCustomerId, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
  };

  if (IS_WIDE) return (
    <View style={s.webRoot}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 32, paddingBottom: 48 }}>
        <Text style={s.pageTitle}>Caixa</Text>
        <BrandBanner mode="block" />
        {productGrid}
        {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
      </ScrollView>
      <View style={{ width: 380, borderLeftWidth: 1, borderLeftColor: Colors.border, backgroundColor: Colors.bg2 }}>
        <CartPanel {...cartPanelProps} />
      </View>
      <QuickCustomerModal visible={showNewCustomer} onClose={() => setShowNewCustomer(false)} onCustomerCreated={handleCustomerCreated} />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text style={s.pageTitle}>Caixa</Text>
      <BrandBanner mode="block" />
      {productGrid}
      <CartPanel {...cartPanelProps} />
      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
      <QuickCustomerModal visible={showNewCustomer} onClose={() => setShowNewCustomer(false)} onCustomerCreated={handleCustomerCreated} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },
  webRoot: { flex: 1, flexDirection: "row", backgroundColor: "transparent" },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  newCustomerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2 },
  newCustomerText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
