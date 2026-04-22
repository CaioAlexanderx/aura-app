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
import { VariantPickerModal } from "@/components/VariantPickerModal";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { employeesApi, pdvApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@/components/screens/estoque/types";

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
  const plan = (company?.plan || "essencial").toLowerCase();
  const isNegocioPlus = plan === "negocio" || plan === "expansao" || plan === "personalizado";
  const {
    cart, payment, setPayment, lastSale, total, totalAfterCoupon, itemCount, isProcessing,
    addToCart, setQty, updateQty, removeItem, finalizeSale, newSale,
    selectedCustomerId, selectedCustomerName, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
  } = useCart();
  const IS_WIDE = useIsWide();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const canAddCustomer = isNegocioPlus;

  // Employees: only fetched for Negocio+ (API returns 403 for Essencial)
  const { data: empData } = useQuery({
    queryKey: ["employees", company?.id],
    queryFn: () => employeesApi.list(company!.id),
    enabled: !!company?.id && isNegocioPlus,
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

  // FIX 22/04 (Fase C gap): handleScan variant-aware.
  // 1. Busca local por barcode do produto pai (rapido, UX instantanea)
  // 2. Se nao achou, consulta backend /pdv/scan/:code que tambem procura
  //    em product_variants.barcode e products.sku
  // 3. Fallback: preenche o campo de busca textual
  async function handleScan(code: string) {
    const cleaned = (code || "").trim();
    if (!cleaned) return;

    // Step 1: barcode do produto pai (local)
    const localProduct = products.find(p => p.barcode === cleaned);
    if (localProduct) { handleAddProduct(localProduct); return; }

    // Step 2: backend lookup (variante, sku, textual)
    if (!company?.id || isDemo) { setSearch(cleaned); return; }
    try {
      const result = await pdvApi.scan(company.id, cleaned);
      if (result.match === "exact" && result.source === "variant_barcode" && result.product && result.variant_id) {
        // Barcode de variante: adiciona direto ao carrinho
        const parent = products.find(p => p.id === result.product.id);
        if (parent) {
          const suffix = (result.product as any).sku_suffix || "Variante";
          const price = result.effective_price || parent.price;
          addToCart(parent, { id: result.variant_id, label: suffix, price: price });
          toast.success(parent.name + " - " + suffix);
          return;
        }
      }
      if (result.match === "exact" && result.product) {
        // Barcode/SKU do pai: delega a handleAddProduct (abre modal se tiver variantes)
        const fullProduct = products.find(p => p.id === result.product.id);
        if (fullProduct) { handleAddProduct(fullProduct); return; }
      }
      // Sem match exato: fallback para busca textual
      setSearch(cleaned);
    } catch {
      // Erro de rede/lookup: degrada pra busca textual
      setSearch(cleaned);
    }
  }

  function handleAddProduct(product: Product) {
    if (product.has_variants) { setPendingProduct(product); }
    else { addToCart(product); }
  }

  function handleVariantSelected(variant: { id: string; label: string; price: number; stock: number }) {
    if (!pendingProduct) return;
    addToCart(pendingProduct, variant);
    setPendingProduct(null);
  }

  function emitNfe() { toast.info("Emissao de NF-e sera integrada apos configuracao do provedor."); }
  function handleCustomerCreated(c: { id: string; name: string; phone: string }) { selectCustomer(c.id, c.name); }

  if (lastSale) {
    if (IS_WIDE) return <View style={s.webRoot}><View style={{ flex: 1 }}><SaleComplete sale={lastSale} onNewSale={newSale} onEmitNfe={emitNfe} /></View></View>;
    return <SaleComplete sale={lastSale} onNewSale={newSale} onEmitNfe={emitNfe} />;
  }

  const productGrid = (
    <View>
      <ScannerBar onScan={handleScan} />

      {/* Busca: label em cinza para diferenciar do scanner (violeta) */}
      <View style={s.searchHeader}>
        <Icon name="search" size={12} color={Colors.ink3} />
        <Text style={s.searchLabel}>BUSCAR PRODUTO</Text>
      </View>
      <View style={s.searchRow}>
        <View style={s.searchInputWrap}>
          <Icon name="search" size={16} color={Colors.ink3} />
          <TextInput
            style={s.searchInput}
            placeholder="Digite o nome do produto..."
            placeholderTextColor={Colors.ink3}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        {canAddCustomer && (
          <Pressable onPress={() => setShowNewCustomer(true)} style={s.newCustomerBtn}>
            <Icon name="user_plus" size={15} color={Colors.violet3} />
            <Text style={s.newCustomerText}>Novo cliente</Text>
          </Pressable>
        )}
      </View>

      <ScrollableChips items={categories} active={category} onSelect={setCategory} />
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {paginated.map(p => (
          <ProductCard key={p.id} product={p} onAdd={() => handleAddProduct(p)} isWide={IS_WIDE}
            variantBadge={p.has_variants ? "Variantes" : undefined} />
        ))}
        {filtered.length === 0 && products.length === 0 && <EmptyState icon="package" iconColor={Colors.amber} title="Nenhum produto cadastrado" subtitle="Cadastre produtos no Estoque para eles aparecerem aqui no Caixa." />}
        {filtered.length === 0 && products.length > 0 && <View style={{ width: "100%", alignItems: "center", paddingVertical: 40 }}><Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text></View>}
      </View>
      <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
    </View>
  );

  const cartPanelProps = {
    cart, payment, setPayment, total, totalAfterCoupon, itemCount, isWide: IS_WIDE,
    setQty, updateQty, removeItem, finalizeSale: () => finalizeSale(), isProcessing,
    customers: slimCustomers, employees,
    selectedCustomerId, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    plan,
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
      <VariantPickerModal visible={!!pendingProduct} product={pendingProduct} onSelect={handleVariantSelected} onClose={() => setPendingProduct(null)} />
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
      <VariantPickerModal visible={!!pendingProduct} product={pendingProduct} onSelect={handleVariantSelected} onClose={() => setPendingProduct(null)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },
  webRoot: { flex: 1, flexDirection: "row", backgroundColor: "transparent" },

  // Busca de produto: label em cinza (neutro) para contrastar com o scanner (violeta)
  searchHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, paddingHorizontal: 2 },
  searchLabel: { fontSize: 10, fontWeight: "700", color: Colors.ink3, letterSpacing: 1.2 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "stretch" },
  searchInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.bg3, borderRadius: 10,
    paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink, paddingVertical: 11 },

  newCustomerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2 },
  newCustomerText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
