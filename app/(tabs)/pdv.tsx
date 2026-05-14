// ============================================================
// AURA. -- Caixa (PDV) — orquestrador de layout
//
// Toda a lógica de estado e handlers vive em hooks/usePdvState.
// Todos os modais estão em components/screens/pdv/PdvModals.
// Este arquivo é responsável apenas pela camada de layout/JSX.
//
// 14/05/2026: decomposição + CreditInstallmentModal + ActCrediario.
// ActCrediario (F6) aparece na actBar quando crediario_enabled=true;
// grid passa de 5 para 6 colunas condicionalmente.
// ============================================================
import {
  View, Text, ScrollView, StyleSheet, Pressable, Platform,
} from "react-native";

import { Colors } from "@/constants/colors";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { CaixaBackdrop } from "@/components/screens/pdv/CaixaBackdrop";
import { CaixaDesignStyle, IS_WEB } from "@/components/screens/pdv/types";
import { SearchBox } from "@/components/screens/pdv/SearchBox";
import { MerchantBanner } from "@/components/screens/pdv/MerchantBanner";
import {
  ActBarcode, ActPerson, ActCoupon, ActTroca, ActCrediario,
} from "@/components/screens/pdv/ActionToolbar";
import { CategoryChips } from "@/components/screens/pdv/CategoryChips";
import { ProductGrid } from "@/components/screens/pdv/ProductGrid";
import { CartPanel } from "@/components/screens/pdv/CartPanel";
import { CaixaButton } from "@/components/screens/pdv/CaixaButton";
import { PdvModals } from "@/components/screens/pdv/PdvModals";

import { usePdvState } from "@/hooks/usePdvState";
import type { Product } from "@/components/screens/estoque/types";

const PAGE_SIZE = 12;

function CaixaScreenInner() {
  const st = usePdvState();

  // ── Aliases ────────────────────────────────────────────────────
  const { company, isDemo, isNegocioPlus, clientesEnabled, vp, wide } = st;
  const { caixaEnabled, sessaoAtiva, isAberto, caixaLoading, invalidateCaixa } = st;
  const { employees, autoEmitNfce, scannerListening, lastScannedCode } = st;
  const { query, setQuery, cat, setCat, showOutOfStock, setShowOutOfStock } = st;
  const { categories, outOfStockCount, paginated, page, totalPages, filteredTotal, goTo, qtyById } = st;
  const { selectedCustomerId, selectedCustomerName, crediarioEnabled } = st;
  const { couponApplied, setCouponApplied, clearCoupon } = st;
  const { activeSellerValue, activeCustomerValue, customerOptions, pickCustomerWithPhone } = st;
  const { handleScan, handleAddProduct, handleVariantSelected, handleValidateCoupon } = st;
  const { handleOpenCrediario, selectEmployee, setSellerName } = st;
  const { cartProps, cartHeadRef, orderSuffix } = st;

  // Número de colunas da actBar: 6 quando crediário está habilitado, 5 caso contrário.
  const actCols = crediarioEnabled ? 6 : 5;

  // ── Bloco de modais ────────────────────────────────────────────
  const modals = (
    <PdvModals
      showNewCustomer={st.showNewCustomer}
      onCloseNewCustomer={st.closeNewCustomer}
      onCustomerCreated={c => st.selectCustomer(c.id, c.name, (c as any).phone || null)}
      pendingProduct={st.pendingProduct}
      onVariantSelected={handleVariantSelected}
      onClosePendingProduct={st.closePendingProduct}
      showTroca={st.showTroca}
      companyId={company?.id || ""}
      products={st.products}
      onCloseTroca={st.closeTroca}
      showCaixaModal={st.showCaixaModal}
      companyName={company?.name || "Sua empresa"}
      companyCnpj={(company as any)?.cnpj || (company as any)?.profile?.cnpj || null}
      sessaoAtiva={sessaoAtiva}
      onCloseCaixa={st.closeCaixaModal}
      onCaixaSuccess={invalidateCaixa}
      showChangeModal={st.showChangeModal}
      cashModalAmount={st.cashModalAmount}
      cashModalIsSplit={st.cashModalIsSplit}
      onCancelChange={st.cancelChange}
      onConfirmChange={st.handleConfirmCashChange}
      showCrediario={st.showCrediario}
      customerId={selectedCustomerId}
      customerName={selectedCustomerName}
      saleTotal={st.totalFinal}
      onCrediarioConfirm={st.handleCrediarioConfirm}
      onCrediarioClose={st.closeCrediario}
    />
  );

  // ── Tela de venda concluída ────────────────────────────────────
  if (st.lastSale) {
    if (wide) {
      return (
        <View style={s.root}>
          <CaixaDesignStyle />
          <CaixaBackdrop />
          <SaleComplete sale={st.lastSale} onNewSale={st.newSale} autoEmit={autoEmitNfce} />
        </View>
      );
    }
    return <SaleComplete sale={st.lastSale} onNewSale={st.newSale} autoEmit={autoEmitNfce} />;
  }

  // ── Toggle de produtos sem estoque ─────────────────────────────
  function StockToggle() {
    if (outOfStockCount === 0) return null;
    return (
      <Pressable
        onPress={() => setShowOutOfStock(v => !v)}
        style={[stkStyles.btn, showOutOfStock && stkStyles.btnActive]}
      >
        <Text style={[stkStyles.txt, showOutOfStock && stkStyles.txtActive]}>
          {showOutOfStock
            ? "Ocultar zerados (" + outOfStockCount + ")"
            : "Mostrar zerados (" + outOfStockCount + ")"}
        </Text>
      </Pressable>
    );
  }

  // ── Grid de produtos ───────────────────────────────────────────
  function ProductSection({ columns }: { columns: number }) {
    if (st.products.length === 0)
      return (
        <EmptyState icon="package" iconColor={Colors.amber}
          title="Nenhum produto cadastrado"
          subtitle="Cadastre produtos no Estoque para eles aparecerem aqui no Caixa."
        />
      );
    if (paginated.length === 0)
      return (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 13, color: Colors.ink3 }}>
            {!showOutOfStock && outOfStockCount > 0
              ? "Nenhum produto encontrado com estoque. Tente \"Mostrar zerados\" acima."
              : "Nenhum produto encontrado"}
          </Text>
        </View>
      );
    return (
      <>
        <ProductGrid
          products={paginated}
          qtyById={qtyById}
          onAdd={(p, e) => handleAddProduct(p as Product, e)}
          columns={columns}
        />
        <Pagination page={page} totalPages={totalPages} total={filteredTotal}
          pageSize={PAGE_SIZE} onPage={goTo} />
      </>
    );
  }

  // ── Layout wide (desktop) ──────────────────────────────────────
  if (wide) {
    return (
      <View style={s.root}>
        <CaixaDesignStyle />
        <CaixaBackdrop />

        <View style={[s.main, IS_WEB && ({ display: "grid", gridTemplateColumns: `1fr ${st.cartWidth}px` } as any)]}>

          {/* Catálogo (coluna esquerda) */}
          <ScrollView
            style={[s.catalog, IS_WEB && ({ maxHeight: "100vh", overflow: "auto" } as any)]}
            contentContainerStyle={{ padding: vp.sm ? 16 : 28, paddingBottom: 48 }}
            className={IS_WEB ? "caixa-scrollable" : undefined}
          >
            <View style={IS_WEB && vp.xxl ? ({ maxWidth: 1700, alignSelf: "center", width: "100%" } as any) : null}>

              {/* Top row */}
              <View style={s.topRow}>
                {caixaEnabled && (
                  <CaixaButton
                    isAberto={isAberto}
                    isLoading={caixaLoading}
                    openedByName={sessaoAtiva?.opened_by?.name || null}
                    openedAtIso={sessaoAtiva?.opened_at || null}
                    onClick={st.openCaixaModal}
                  />
                )}
                <View>
                  <Text style={s.title}>Caixa</Text>
                  <View style={s.titleSub}>
                    {IS_WEB && (
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background:  caixaEnabled && !isAberto ? "rgba(170,160,235,0.65)" : "#34d399",
                        boxShadow:   caixaEnabled && !isAberto ? "none" : "0 0 6px #34d399",
                        display:     "inline-block",
                        animation:   caixaEnabled && !isAberto ? "none" : "caixaPulse 1.8s ease-in-out infinite",
                      } as any} />
                    )}
                    <Text style={s.titleSubTxt}>
                      {(company?.name || "Sua loja") + " · venda " + orderSuffix}
                      {autoEmitNfce ? " · NFC-e auto" : ""}
                    </Text>
                  </View>
                </View>
                <SearchBox value={query} onChange={setQuery} />
              </View>

              <MerchantBanner height={vp.sm ? 120 : 200} />

              {/* Action toolbar — 5 ou 6 colunas */}
              <View style={[s.actBar, IS_WEB && ({
                display: "grid",
                gridTemplateColumns: `repeat(${actCols}, 1fr)`,
                gap: vp.sm ? 6 : 10,
                position: "relative",
                zIndex: 50,
              } as any)]}>
                <ActBarcode onScan={handleScan} listening={scannerListening} lastCode={lastScannedCode} />
                <ActPerson
                  kind="vendedora" shortcut="F2"
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
                  kind="cliente" shortcut="F3"
                  value={activeCustomerValue}
                  onChange={pickCustomerWithPhone}
                  options={customerOptions}
                  searchable
                  addable={clientesEnabled}
                  onAddNew={st.openNewCustomer}
                  disabled={!clientesEnabled}
                  disabledHint="Disponível no plano Negócio"
                />
                <ActCoupon
                  value={couponApplied}
                  onChange={v => { if (v) setCouponApplied(v); else clearCoupon(); }}
                  onValidate={handleValidateCoupon}
                />
                <ActTroca onOpen={st.openTroca} />
                {crediarioEnabled && (
                  <ActCrediario
                    onOpen={handleOpenCrediario}
                    hasCustomer={!!selectedCustomerId}
                  />
                )}
              </View>

              <View style={s.catRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <CategoryChips items={categories} active={cat} onSelect={setCat} />
                </View>
                <StockToggle />
              </View>

              <ProductSection columns={st.productCols} />

              {isDemo && (
                <View style={s.demoBanner}>
                  <Text style={s.demoTxt}>Modo demonstrativo</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* CartPanel (coluna direita, sticky) */}
          <View style={[
            s.cartWrap,
            { width: st.cartWidth },
            IS_WEB && ({ position: "sticky" as any, top: 0, height: "100vh" } as any),
          ]}>
            <CartPanel ref={cartHeadRef} {...cartProps} />
          </View>
        </View>

        {modals}
      </View>
    );
  }

  // ── Layout mobile ──────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <CaixaDesignStyle />
      <CaixaBackdrop />
      <ScrollView
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <Text style={s.title}>Caixa</Text>

        {caixaEnabled && (
          <View style={{ marginTop: 8, marginBottom: 12 }}>
            <CaixaButton
              isAberto={isAberto}
              isLoading={caixaLoading}
              openedByName={sessaoAtiva?.opened_by?.name || null}
              openedAtIso={sessaoAtiva?.opened_at || null}
              onClick={st.openCaixaModal}
            />
          </View>
        )}

        <View style={{ marginBottom: 12 }}>
          <SearchBox value={query} onChange={setQuery} />
        </View>

        <MerchantBanner height={160} />

        {/* Action toolbar mobile */}
        <View style={[{ gap: 10, marginBottom: 16 }, IS_WEB && ({ position: "relative", zIndex: 50 } as any)]}>
          <ActBarcode onScan={handleScan} listening={scannerListening} lastCode={lastScannedCode} />
          <ActPerson
            kind="vendedora" shortcut="F2"
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
            kind="cliente" shortcut="F3"
            value={activeCustomerValue}
            onChange={pickCustomerWithPhone}
            options={customerOptions}
            searchable
            addable={clientesEnabled}
            onAddNew={st.openNewCustomer}
            disabled={!clientesEnabled}
            disabledHint="Disponível no plano Negócio"
          />
          <ActCoupon
            value={couponApplied}
            onChange={v => { if (v) setCouponApplied(v); else clearCoupon(); }}
            onValidate={handleValidateCoupon}
          />
          <ActTroca onOpen={st.openTroca} />
          {crediarioEnabled && (
            <ActCrediario
              onOpen={handleOpenCrediario}
              hasCustomer={!!selectedCustomerId}
            />
          )}
        </View>

        <View style={s.catRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <CategoryChips items={categories} active={cat} onSelect={setCat} />
          </View>
          <StockToggle />
        </View>

        <ProductSection columns={2} />

        <View style={{ marginTop: 20 }}>
          <CartPanel ref={cartHeadRef} {...cartProps} />
        </View>
      </ScrollView>

      {modals}
    </View>
  );
}

export default function CaixaScreen() {
  return (
    <RequireCompanyScope context="pdv" actionLabel="abrir o caixa">
      <CaixaScreenInner />
    </RequireCompanyScope>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  main:        { flex: 1, flexDirection: "row", minWidth: 0 },
  catalog:     { flex: 1, minWidth: 0 },
  cartWrap:    { overflow: "hidden" },
  topRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 22 },
  title:       { fontSize: 26, color: Colors.ink, letterSpacing: -0.4, fontWeight: "700" },
  titleSub:    { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  titleSubTxt: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 11, color: Colors.ink3, letterSpacing: 0.6, textTransform: "uppercase",
  },
  actBar:      { flexDirection: "row", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  catRow:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  demoBanner:  { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoTxt:     { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
});

const stkStyles = StyleSheet.create({
  btn:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "rgba(124,58,237,0.06)", borderWidth: 1, borderColor: "rgba(124,58,237,0.25)", flexShrink: 0 },
  btnActive: { backgroundColor: "rgba(124,58,237,0.18)", borderColor: "rgba(124,58,237,0.55)" },
  txt:       { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  txtActive: { color: "#a78bfa" },
});
