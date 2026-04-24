// ============================================================
// AURA. -- Caixa (PDV) — Claude Design redesign
//
// Arquitetura: toda regra de negocio permanece nos hooks existentes.
// Esta tela e apenas o orquestrador entre os hooks e os componentes
// visuais do "Claude Design" (glassmorphism + orbs + conic gradients).
//
// Conectores (100% wirados com backend real, nada mockado):
//   - useProducts()          produtos + estoque (backend)
//   - useCart()              carrinho, pagamento, finalizar, cupom,
//                            cliente, vendedora, desconto manual
//   - useCustomers()         lista de clientes
//   - useEmployees(...)      lista de funcionarias (via useQuery)
//   - usePdvSettings()       politicas require_customer/seller
//   - pdvApi.scan()          leitor de codigo de barras
//   - couponsApi.validate()  validacao de cupom
//   - openQuotePdf()         PDF de orcamento
//
// Layout: sidebar vem do _layout.tsx (expo-router).
// Wide (>860): grid "1fr 420px" — catalog scrolla, cart sticky.
// Narrow: scroll unico empilhado.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Platform, Dimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useProducts } from "@/hooks/useProducts";
import { useCart, PAYMENTS } from "@/hooks/useCart";
import { useCustomers } from "@/hooks/useCustomers";
import { usePdvSettings, validateSaleAgainstSettings } from "@/hooks/usePdvSettings";
import { usePagination } from "@/hooks/usePagination";

import { couponsApi, employeesApi, pdvApi } from "@/services/api";

import { toast } from "@/components/Toast";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";
import { QuickCustomerModal } from "@/components/QuickCustomerModal";
import { VariantPickerModal } from "@/components/VariantPickerModal";

import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { CaixaBackdrop } from "@/components/screens/pdv/CaixaBackdrop";
import { CaixaDesignStyle, IS_WEB, accentForProduct, productLetter, fmtCurrency } from "@/components/screens/pdv/types";
import { SearchBox } from "@/components/screens/pdv/SearchBox";
import { MerchantBanner } from "@/components/screens/pdv/MerchantBanner";
import { ActBarcode, ActPerson, ActCoupon } from "@/components/screens/pdv/ActionToolbar";
import { CategoryChips } from "@/components/screens/pdv/CategoryChips";
import { ProductGrid } from "@/components/screens/pdv/ProductGrid";
import { CartPanel, type CartDisplayItem, type PayChip } from "@/components/screens/pdv/CartPanel";
import { flyToCart } from "@/components/screens/pdv/flyToCart";

import type { Product } from "@/components/screens/estoque/types";
import { openQuotePdf, type QuoteItem } from "@/utils/quotePdf";

const PAGE_SIZE = 12;

// Icons for the 4 payment chips (maps backend id -> icon name in Icon set)
const PAY_ICONS: Record<string, string> = {
  pix: "dollar",
  dinheiro: "wallet",
  cartao: "receipt",
  debito: "trending_up",
};
const PAY_METHODS: PayChip[] = PAYMENTS.map(p => ({
  key: p.key,
  label: p.label,
  icon: PAY_ICONS[p.key] || "dollar",
}));

function useIsWide() {
  const [wide, setWide] = useState(
    (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 860
  );
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setWide(window.innerWidth > 860);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return wide;
}

export default function CaixaScreen() {
  const { company, isDemo } = useAuthStore();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { settings: pdvSettings } = usePdvSettings();

  const plan = (company?.plan || "essencial").toLowerCase();
  const isNegocioPlus = plan === "negocio" || plan === "expansao" || plan === "personalizado";

  // Employees: fetched only for Negocio+ (API returns 403 for Essencial).
  const { data: empData } = useQuery({
    queryKey: ["employees", company?.id],
    queryFn: () => employeesApi.list(company!.id),
    enabled: !!company?.id && isNegocioPlus,
    staleTime: 60000,
  });
  const employees = useMemo(
    () => ((empData?.employees || []) as any[]).map(e => ({ id: e.id, name: e.name || "", subtitle: e.role || undefined })),
    [empData]
  );

  const {
    cart, payment, setPayment, lastSale, total: totalRaw, totalAfterCoupon, itemCount, isProcessing,
    addToCart, setQty, updateQty, removeItem, finalizeSale, newSale,
    selectedCustomerId, selectedCustomerName, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
    discountType, discountValue, manualDiscountAmount,
  } = useCart();

  const wide = useIsWide();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const cartHeadRef = useRef<any>(null);

  // ── Categories (with counts) ─────────────────────────────
  const categories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const k = p.category || "Produtos";
      map[k] = (map[k] || 0) + 1;
    }
    const keys = Object.keys(map).sort();
    return [
      { id: "all", label: "Todos", count: products.length },
      ...keys.map(k => ({ id: k, label: k, count: map[k] })),
    ];
  }, [products]);

  // ── Filtered products ─────────────────────────────────────
  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.barcode?.includes(query) || p.code?.includes(query);
      const matchCat = cat === "all" || p.category === cat;
      return matchSearch && matchCat;
    });
  }, [products, query, cat]);

  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(filtered, PAGE_SIZE, query + cat);

  // ── Qty-by-base-id for the grid badges ───────────────────
  const qtyById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of cart) {
      const base = it.productId.split("__")[0];
      m[base] = (m[base] || 0) + it.qty;
    }
    return m;
  }, [cart]);

  // ── Handlers ─────────────────────────────────────────────
  async function handleScan(code: string) {
    const cleaned = (code || "").trim();
    if (!cleaned) return;
    const localProduct = products.find(p => p.barcode === cleaned);
    if (localProduct) { handleAddProduct(localProduct); return; }

    if (!company?.id || isDemo) { setQuery(cleaned); return; }
    try {
      const result = await pdvApi.scan(company.id, cleaned);
      if (result.match === "exact" && result.source === "variant_barcode" && result.product && result.variant_id) {
        const parent = products.find(p => p.id === result.product.id);
        if (parent) {
          const suffix = (result.product as any).sku_suffix || "Variante";
          const price = result.effective_price || parent.price;
          addToCart(parent, { id: result.variant_id, label: suffix, price });
          toast.success(parent.name + " · " + suffix);
          return;
        }
      }
      if (result.match === "exact" && result.product) {
        const full = products.find(p => p.id === result.product.id);
        if (full) { handleAddProduct(full); return; }
      }
      setQuery(cleaned);
    } catch {
      setQuery(cleaned);
    }
  }

  function handleAddProduct(p: Product, evt?: { x: number; y: number; accent: string; letter: string }) {
    if (p.has_variants) { setPendingProduct(p); return; }
    addToCart(p);
    // Fly-to-cart animation (web only).
    if (evt && cartHeadRef.current && IS_WEB) {
      const target = cartHeadRef.current.getBoundingClientRect?.();
      if (target) {
        flyToCart(
          { x: evt.x, y: evt.y },
          { x: target.left + target.width / 2 - 22, y: target.top + 30 },
          evt.accent,
          evt.letter
        );
      }
    }
  }

  function handleVariantSelected(variant: { id: string; label: string; price: number; stock: number }) {
    if (!pendingProduct) return;
    addToCart(pendingProduct, variant);
    setPendingProduct(null);
  }

  function handleFinalize() {
    const v = validateSaleAgainstSettings(pdvSettings, {
      customerId: selectedCustomerId,
      sellerId: selectedEmployeeId,
      sellerName,
    });
    if (!v.ok) {
      toast.error("Selecione " + v.missing.join(" e ") + " antes de finalizar a venda");
      return;
    }
    finalizeSale();
  }

  async function handleValidateCoupon(code: string) {
    if (!company?.id) return { ok: false, error: "Empresa não identificada" };
    try {
      const res = await couponsApi.validate(company.id, code, totalRaw);
      if (res.valid && res.code) {
        setCouponApplied({ code: res.code, discount: res.discount_amount || 0 });
        setCouponCode(res.code);
        toast.success("Cupom " + res.code + " aplicado! −" + fmtCurrency(res.discount_amount || 0));
        return { ok: true, code: res.code, discount: res.discount_amount };
      }
      return { ok: false, error: res.error || "Cupom inválido" };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Erro ao validar cupom" };
    }
  }

  function handleGenerateQuote() {
    if (cart.length === 0) {
      toast.info("Adicione produtos ao carrinho antes de gerar orçamento");
      return;
    }
    const items: QuoteItem[] = cart.map(i => ({ name: i.name, qty: i.qty, unitPrice: i.price }));
    const discount = couponApplied ? couponApplied.discount : (manualDiscountAmount || 0);
    const afterDiscount = totalRaw - discount;
    const profile = (company as any)?.profile || {};
    openQuotePdf({
      items,
      customerName: selectedCustomerName,
      sellerName: selectedEmployeeName || sellerName || null,
      total: totalRaw,
      totalAfterDiscount: discount > 0 ? afterDiscount : undefined,
      discount: discount > 0 ? discount : undefined,
      companyName: company?.name || "Sua empresa",
      companyLogoUrl: profile.logo_url || null,
      companyPhone: profile.phone || null,
      companyAddress: profile.address || null,
    });
    toast.success("Orçamento gerado");
  }

  // ── Display helpers ──────────────────────────────────────
  const displayItems: CartDisplayItem[] = cart.map(it => {
    const base = it.productId.split("__")[0];
    return {
      productId: it.productId,
      productBaseId: base,
      name: it.name,
      price: it.price,
      qty: it.qty,
    };
  });
  const subtotal = totalRaw;
  const couponDiscount = couponApplied?.discount || 0;
  const discountAmount = couponDiscount + (manualDiscountAmount || 0);
  const totalFinal = totalAfterCoupon;
  const discountLabel = couponApplied?.code
    ? couponApplied.code
    : manualDiscountAmount > 0
      ? discountType === "%" ? (discountValue + "%") : "manual"
      : null;

  const requiredHints: string[] = [];
  if (pdvSettings.require_customer && !selectedCustomerId) requiredHints.push("Cliente obrigatório");
  if (pdvSettings.require_seller && !selectedEmployeeId && !(sellerName || "").trim()) requiredHints.push("Vendedora obrigatória");

  // Active seller for the ActPerson card — can be free-text or employee
  const activeSellerValue = selectedEmployeeId
    ? { id: selectedEmployeeId, name: selectedEmployeeName || "Vendedora" }
    : sellerName?.trim()
      ? { id: "__free__" + sellerName.trim(), name: sellerName.trim() }
      : null;

  const activeCustomerValue = selectedCustomerId
    ? { id: selectedCustomerId, name: selectedCustomerName || "Cliente", subtitle: customers.find(c => c.id === selectedCustomerId)?.phone || undefined }
    : null;

  const customerOptions = customers.map(c => ({ id: c.id, name: c.name, subtitle: c.phone || c.email }));

  // Order number (last 6 chars of demo date or real sale) — for display only
  const orderSuffix = "#" + ((Date.now() % 100000).toString().padStart(5, "0"));

  // ── Sale complete fullscreen ─────────────────────────────
  if (lastSale) {
    if (wide) {
      return (
        <View style={s.root}>
          <CaixaDesignStyle />
          <CaixaBackdrop />
          <SaleComplete sale={lastSale} onNewSale={newSale} onEmitNfe={() => toast.info("Emissão de NF-e será integrada após configuração do provedor.")} />
        </View>
      );
    }
    return <SaleComplete sale={lastSale} onNewSale={newSale} onEmitNfe={() => toast.info("Emissão de NF-e será integrada após configuração do provedor.")} />;
  }

  // ═══════ WIDE (desktop web) — 2-col grid ═══════
  if (wide) {
    return (
      <View style={s.root}>
        <CaixaDesignStyle />
        <CaixaBackdrop />

        <View style={[s.main, IS_WEB && ({ display: "grid", gridTemplateColumns: "1fr 420px" } as any)]}>
          {/* CATALOG */}
          <ScrollView
            style={[s.catalog, IS_WEB && ({ maxHeight: "100vh", overflow: "auto" } as any)]}
            contentContainerStyle={{ padding: 28, paddingBottom: 48 }}
            className={IS_WEB ? "caixa-scrollable" : undefined}
          >
            {/* Header row */}
            <View style={s.topRow}>
              <View>
                <Text style={s.title}>Caixa</Text>
                <View style={s.titleSub}>
                  {IS_WEB && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#34d399",
                        boxShadow: "0 0 6px #34d399",
                        display: "inline-block",
                        animation: "caixaPulse 1.8s ease-in-out infinite",
                      } as any}
                    />
                  )}
                  <Text style={s.titleSubTxt}>
                    {(company?.name || "Sua loja") + " · venda " + orderSuffix}
                  </Text>
                </View>
              </View>
              <SearchBox value={query} onChange={setQuery} />
            </View>

            <MerchantBanner height={140} />

            {/* Action toolbar: 4 cards */}
            <View style={[s.actBar, IS_WEB && ({ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 } as any)]}>
              <ActBarcode onScan={handleScan} />
              <ActPerson
                kind="vendedora"
                shortcut="F2"
                value={activeSellerValue}
                onChange={v => {
                  if (!v) { selectEmployee(null, null); setSellerName(""); return; }
                  if (v.id.startsWith("__free__")) {
                    selectEmployee(null, null);
                    setSellerName(v.name);
                  } else {
                    selectEmployee(v.id, v.name);
                    setSellerName(v.name);
                  }
                }}
                options={employees}
                searchable={employees.length > 5}
                disabled={!isNegocioPlus && employees.length === 0 && false /* keep input enabled always */}
              />
              <ActPerson
                kind="cliente"
                shortcut="F3"
                value={activeCustomerValue}
                onChange={v => { if (v) selectCustomer(v.id, v.name); else selectCustomer(null, null); }}
                options={customerOptions}
                searchable
                addable={isNegocioPlus}
                onAddNew={() => setShowNewCustomer(true)}
                disabled={!isNegocioPlus}
                disabledHint="Disponível no plano Negócio"
              />
              <ActCoupon
                value={couponApplied}
                onChange={v => { if (v) setCouponApplied(v); else clearCoupon(); }}
                onValidate={handleValidateCoupon}
              />
            </View>

            <CategoryChips items={categories} active={cat} onSelect={setCat} />

            {products.length === 0 ? (
              <EmptyState
                icon="package"
                iconColor={Colors.amber}
                title="Nenhum produto cadastrado"
                subtitle="Cadastre produtos no Estoque para eles aparecerem aqui no Caixa."
              />
            ) : filtered.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text>
              </View>
            ) : (
              <>
                <ProductGrid
                  products={paginated}
                  qtyById={qtyById}
                  onAdd={(p, e) => handleAddProduct(p as Product, e)}
                  columns={4}
                />
                <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
              </>
            )}

            {isDemo && (
              <View style={s.demoBanner}>
                <Text style={s.demoTxt}>Modo demonstrativo</Text>
              </View>
            )}
          </ScrollView>

          {/* CART */}
          <View style={[s.cartWrap, IS_WEB && ({ position: "sticky" as any, top: 0, height: "100vh" } as any)]}>
            <CartPanel
              ref={cartHeadRef}
              orderNumber={orderSuffix}
              items={displayItems}
              subtotal={subtotal}
              discountAmount={discountAmount}
              total={totalFinal}
              itemCount={itemCount}
              payMethods={PAY_METHODS}
              activePay={payment}
              onPay={setPayment}
              onInc={id => updateQty(id, 1)}
              onDec={id => updateQty(id, -1)}
              onRemove={removeItem}
              onClear={() => { cart.forEach(i => removeItem(i.productId)); clearCoupon(); }}
              onFinalize={handleFinalize}
              onGenerateQuote={handleGenerateQuote}
              showOrcamento
              discountLabel={discountLabel}
              isProcessing={isProcessing}
              requiredHints={requiredHints}
            />
          </View>
        </View>

        <QuickCustomerModal
          visible={showNewCustomer}
          onClose={() => setShowNewCustomer(false)}
          onCustomerCreated={c => selectCustomer(c.id, c.name)}
        />
        <VariantPickerModal
          visible={!!pendingProduct}
          product={pendingProduct}
          onSelect={handleVariantSelected}
          onClose={() => setPendingProduct(null)}
        />
      </View>
    );
  }

  // ═══════ NARROW (mobile / tablet) — stacked ═══════
  return (
    <View style={{ flex: 1 }}>
      <CaixaDesignStyle />
      <CaixaBackdrop />
      <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text style={s.title}>Caixa</Text>
        <View style={{ marginBottom: 12 }}>
          <SearchBox value={query} onChange={setQuery} />
        </View>

        <MerchantBanner height={120} />

        <View style={{ gap: 10, marginBottom: 16 }}>
          <ActBarcode onScan={handleScan} />
          <ActPerson
            kind="vendedora"
            shortcut="F2"
            value={activeSellerValue}
            onChange={v => {
              if (!v) { selectEmployee(null, null); setSellerName(""); return; }
              if (v.id.startsWith("__free__")) { selectEmployee(null, null); setSellerName(v.name); }
              else { selectEmployee(v.id, v.name); setSellerName(v.name); }
            }}
            options={employees}
            searchable={employees.length > 5}
          />
          <ActPerson
            kind="cliente"
            shortcut="F3"
            value={activeCustomerValue}
            onChange={v => { if (v) selectCustomer(v.id, v.name); else selectCustomer(null, null); }}
            options={customerOptions}
            searchable
            addable={isNegocioPlus}
            onAddNew={() => setShowNewCustomer(true)}
            disabled={!isNegocioPlus}
            disabledHint="Disponível no plano Negócio"
          />
          <ActCoupon
            value={couponApplied}
            onChange={v => { if (v) setCouponApplied(v); else clearCoupon(); }}
            onValidate={handleValidateCoupon}
          />
        </View>

        <CategoryChips items={categories} active={cat} onSelect={setCat} />

        {products.length === 0 ? (
          <EmptyState
            icon="package"
            iconColor={Colors.amber}
            title="Nenhum produto cadastrado"
            subtitle="Cadastre produtos no Estoque para eles aparecerem aqui no Caixa."
          />
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text>
          </View>
        ) : (
          <>
            <ProductGrid
              products={paginated}
              qtyById={qtyById}
              onAdd={p => handleAddProduct(p as Product)}
              columns={2}
            />
            <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
          </>
        )}

        <View style={{ marginTop: 20 }}>
          <CartPanel
            ref={cartHeadRef}
            orderNumber={orderSuffix}
            items={displayItems}
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={totalFinal}
            itemCount={itemCount}
            payMethods={PAY_METHODS}
            activePay={payment}
            onPay={setPayment}
            onInc={id => updateQty(id, 1)}
            onDec={id => updateQty(id, -1)}
            onRemove={removeItem}
            onClear={() => { cart.forEach(i => removeItem(i.productId)); clearCoupon(); }}
            onFinalize={handleFinalize}
            onGenerateQuote={handleGenerateQuote}
            showOrcamento
            discountLabel={discountLabel}
            isProcessing={isProcessing}
            requiredHints={requiredHints}
          />
        </View>
      </ScrollView>

      <QuickCustomerModal
        visible={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCustomerCreated={c => selectCustomer(c.id, c.name)}
      />
      <VariantPickerModal
        visible={!!pendingProduct}
        product={pendingProduct}
        onSelect={handleVariantSelected}
        onClose={() => setPendingProduct(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  main: {
    flex: 1,
    flexDirection: "row",
    minWidth: 0,
  },
  catalog: {
    flex: 1,
    minWidth: 0,
  },
  cartWrap: {
    width: 420,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 22,
  },
  title: {
    fontSize: 26,
    color: Colors.ink,
    letterSpacing: -0.4,
    fontWeight: "700",
  },
  titleSub: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  titleSubTxt: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 11,
    color: Colors.ink3,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  actBar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  demoBanner: {
    alignSelf: "center",
    backgroundColor: Colors.violetD,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  demoTxt: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
});
