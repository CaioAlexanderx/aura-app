// ============================================================
// AURA. -- Caixa (PDV) — orquestrador de layout
//
// Toda a lógica de estado e handlers vive em hooks/usePdvState.
// Todos os modais estão em components/screens/pdv/PdvModals.
// Este arquivo é responsável apenas pela camada de layout/JSX.
//
// 14/05/2026: decomposição + CreditInstallmentModal + ActCrediario.
//
// 17/05/2026 (Davi 13/14"): actBar com `repeat(${actCols}, 1fr)` forçava
// 5/6 colunas em qualquer largura — em 1366×768 @125% scale isso dava
// ~117px/card e truncava todos os labels (L. V.S. C.V em vez de "Scanner",
// "Vendedora", "Cliente"). Agora usa `auto-fit, minmax(140px, 1fr)`:
// cards quebram em 2/3 linhas automaticamente conforme a largura,
// mantendo labels legíveis sempre.
//
// 17/06/2026 (Davi — "Finalizar" cortado em todos os monitores): o painel
// do carrinho e o catálogo usavam height/maxHeight: 100vh, mas no layout
// (app/(tabs)/_layout.tsx) o conteúdo fica ABAIXO da topbar do sininho
// (~46px = 10px padding + 36px do sino). Então 100vh transbordava por baixo
// exatamente a altura da topbar e cortava o rodapé do carrinho em qualquer
// monitor. FIX: a área do PDV usa a altura REAL disponível
// (calc(100vh - TOPBAR_H)) num único lugar (s.main no web) e os filhos
// (catálogo + carrinho) usam height/maxHeight: 100%.
// O carrinho desktop recebe `fill` (corpo rola + checkout ancora no fundo);
// o mobile NÃO recebe fill → altura natural, a página rola (sem vazio).
//
// 16/09/2026 (Fase 0 · I0.3) — a grade só começava na metade da tela:
//   · O MerchantBanner era um painel roxo de 200px (+18 de margem) que só
//     segurava a logo do lojista. Saiu. A logo agora abre o cabeçalho, em
//     48px ao lado do título, e reaparece grande (120px) no carrinho vazio —
//     em evidência, sem custar altura da grade.
//   · O estado do leitor saiu do card de 52px da barra de ações (onde
//     truncava em "Escutando · pode b…") e virou chip na linha da busca.
//   · A barra de ações virou botões de TEXTO de 40px com largura natural.
//   Alturas acima da grade, catálogo desktop (viewport 1920×911 → 865 úteis):
//     antes  28 + 70 (topo) + 218 (painel roxo) + 70 (ações) + 42 (categorias)
//            = 428px, 47% da altura útil — fora do primeiro terço (288px).
//     agora  24 + 70 (topo) + 56 (busca) + 52 (ações) + 42 (categorias)
//            = 244px, 28% — dentro do primeiro terço.
//   Mobile 390×780 (669 úteis, fora topbar do sino e barra de abas):
//     antes 610px até a grade (entrava meio par de produtos);
//     agora 272px, e os cards `dense` deixam dois pares inteiros na dobra.
// ============================================================
import { useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Colors } from "@/constants/colors";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { CaixaBackdrop } from "@/components/screens/pdv/CaixaBackdrop";
import { CaixaDesignStyle, IS_WEB } from "@/components/screens/pdv/types";
import { SearchBox } from "@/components/screens/pdv/SearchBox";
import { MerchantLogo } from "@/components/screens/pdv/MerchantLogo";
import { ScannerStatusChip } from "@/components/screens/pdv/ScannerStatusChip";
import {
  ActBarcode, ActPerson, ActCoupon, ActTroca, ActMais,
} from "@/components/screens/pdv/ActionToolbar";
import { CategoryChips } from "@/components/screens/pdv/CategoryChips";
import { ProductGrid } from "@/components/screens/pdv/ProductGrid";
import { CartPanel } from "@/components/screens/pdv/CartPanel";
import { CaixaButton } from "@/components/screens/pdv/CaixaButton";
import { PdvModals } from "@/components/screens/pdv/PdvModals";
import { IndicadoPorChip } from "@/components/matcon/IndicadoPorChip";

import { usePdvState } from "@/hooks/usePdvState";
import { querAbrirTroca } from "@/utils/devolucaoOuTroca";
import { productMinCardFor } from "@/hooks/useViewport";
import type { Product } from "@/components/screens/estoque/types";

const PAGE_SIZE = 12;

// Altura da topbar do sininho no layout desktop (app/(tabs)/_layout.tsx):
// padding 10px (top) + NotificationBell 36px = 46px. A área útil do PDV é
// a viewport menos essa barra — senão o painel do carrinho (100vh) transborda
// por baixo e corta o "Finalizar venda" (report Davi 17/06, em todo monitor).
const TOPBAR_H = 46;
const CONTENT_H = `calc(100vh - ${TOPBAR_H}px)`;

function CaixaScreenInner() {
  const st = usePdvState();

  // 16/09/2026: "Trocar tamanho ou produto" do Editar lançamento chega aqui
  // com ?troca=1 e já abre a Troca (caso MHT / Karina Quadros).
  const params = useLocalSearchParams<{ troca?: string }>();
  useEffect(() => {
    if (!querAbrirTroca(params.troca)) return;
    st.openTroca();
    try { router.setParams({ troca: undefined } as any); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.troca]);

  const { company, isDemo, isNegocioPlus, clientesEnabled, vp, wide } = st;
  const { caixaEnabled, sessaoAtiva, isAberto, caixaLoading, invalidateCaixa } = st;
  const { employees, autoEmitNfce, scannerListening, lastScannedCode } = st;
  const { query, setQuery, cat, setCat, showOutOfStock, setShowOutOfStock } = st;
  const { categories, outOfStockCount, paginated, page, totalPages, filteredTotal, goTo, qtyById } = st;
  const { selectedCustomerId, selectedCustomerName, crediarioEnabled } = st;
  const { couponApplied, setCouponApplied, clearCoupon } = st;
  const { activeSellerValue, activeCustomerValue, customerOptions, customerRecentCount, pickCustomerWithPhone } = st;
  const { sellerPickerRef, customerPickerRef } = st;
  const { handleScan, handleAddProduct, handleVariantSelected, handleValidateCoupon } = st;
  const { selectEmployee, setSellerName } = st;
  const { cartProps, cartHeadRef, orderLabel } = st;
  // 22/09/2026 (Matcon M3): chip "Indicado por" — st.referral vem de
  // useMatconReferral (busca/seleção do profissional); referral.active já
  // é matcon_enabled && matcon_club_enabled (única leitura do toggle, em
  // usePdvState). totalFinal é o total ATUAL do carrinho (subtotal −
  // descontos), o mesmo número que o CartPanel mostra em "Total".
  const { referral, totalFinal } = st;

  // 16/06/2026: grid de produtos fluido + crediário só como modalidade de
  // pagamento (card removido da toolbar). Gateamos o chip por crediarioEnabled.
  const productMinCard = productMinCardFor(vp);
  // As políticas do Caixa (Configurações) viram ponto âmbar no botão: o
  // usePdvState só cria o `requiredHint` quando o campo é exigido E está
  // vazio — que é exatamente quando o ponto deve aparecer.
  const precisaCliente   = st.requiredHints.some(h => h.label === "Cliente obrigatório");
  const precisaVendedora = st.requiredHints.some(h => h.label === "Vendedora obrigatória");
  const pdvPayMethods = crediarioEnabled
    ? cartProps.payMethods
    : cartProps.payMethods.filter((m: any) => m.key !== "crediario");

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
      saleTotal={st.crediarioModalAmount}
      onCrediarioConfirm={st.handleCrediarioConfirm}
      onCrediarioClose={st.closeCrediario}
    />
  );

  if (st.lastSale) {
    if (wide) {
      return (
        <View style={s.root}>
          <CaixaDesignStyle />
          <CaixaBackdrop />
          <SaleComplete sale={st.lastSale} onNewSale={st.newSale} autoEmit={autoEmitNfce} matconEnabled={st.matconEnabled} />
        </View>
      );
    }
    return <SaleComplete sale={st.lastSale} onNewSale={st.newSale} autoEmit={autoEmitNfce} matconEnabled={st.matconEnabled} />;
  }

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

  function ProductSection({ columns, minCard, dense }: { columns: number; minCard?: number; dense?: boolean }) {
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
          minCard={minCard}
          compact={vp.compact}
          dense={dense}
          matconEnabled={st.matconEnabled}
        />
        <Pagination page={page} totalPages={totalPages} total={filteredTotal}
          pageSize={PAGE_SIZE} onPage={goTo} />
      </>
    );
  }

  // ── Layout wide (desktop) ─────────────────────────────────────
  if (wide) {
    return (
      <View style={s.root}>
        <CaixaDesignStyle />
        <CaixaBackdrop />

        <View style={[s.main, IS_WEB && ({ display: "grid", gridTemplateColumns: `1fr ${st.cartWidth}px`, height: CONTENT_H } as any)]}>

          <ScrollView
            style={[s.catalog, IS_WEB && ({ maxHeight: "100%", overflow: "auto" } as any)]}
            contentContainerStyle={{ padding: vp.sm ? 16 : 28, paddingTop: vp.sm ? 14 : 24, paddingBottom: 48 }}
            className={IS_WEB ? "caixa-scrollable" : undefined}
          >
            <View style={IS_WEB && vp.xxl ? ({ maxWidth: 1700, alignSelf: "center", width: "100%" } as any) : null}>

              {/* Cabeçalho: a logo do lojista abre a tela, em 48px. Sem logo
                  (ou plano sem direito a ela) entra o tile violeta com a
                  inicial da loja — o mesmo do menu lateral, nunca a da Aura. */}
              <View style={s.topRow}>
                <MerchantLogo size={48} />
                <View style={{ minWidth: 0 }}>
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
                    <Text style={s.titleSubTxt} numberOfLines={1}>
                      {/* 29/08/2026: era "· venda #12345" com um numero
                          aleatorio que trocava a cada render. Enquanto a venda
                          e rascunho nao ha numero real pra mostrar. */}
                      {(company?.name || "Sua loja") + " · " + orderLabel}
                      {autoEmitNfce ? " · NFC-e auto" : ""}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 8 }} />
                {caixaEnabled && (
                  <CaixaButton
                    isAberto={isAberto}
                    isLoading={caixaLoading}
                    openedByName={sessaoAtiva?.opened_by?.name || null}
                    openedAtIso={sessaoAtiva?.opened_at || null}
                    onClick={st.openCaixaModal}
                  />
                )}
              </View>

              {/* Busca + estado do leitor: o lojista já está olhando pra cá
                  quando vai bipar, então o status mora aqui. */}
              <View style={s.searchRow}>
                <SearchBox value={query} onChange={setQuery} maxWidth={560} />
                <ScannerStatusChip listening={scannerListening} lastCode={lastScannedCode} />
              </View>

              {/* Barra de ações — botões de TEXTO com largura natural. Nada de
                  grid de colunas iguais (era o que truncava os rótulos). */}
              <View style={[s.actBar, IS_WEB && ({ position: "relative", zIndex: 50 } as any)]}>
                <ActPerson
                  ref={customerPickerRef}
                  kind="cliente" shortcut="F3"
                  value={activeCustomerValue}
                  onChange={pickCustomerWithPhone}
                  options={customerOptions}
                  recentCount={customerRecentCount}
                  required={precisaCliente}
                  searchable
                  addable={clientesEnabled}
                  onAddNew={st.openNewCustomer}
                  disabled={!clientesEnabled}
                  disabledHint="Disponível no plano Negócio"
                />
                <ActPerson
                  ref={sellerPickerRef}
                  kind="vendedora" shortcut="F2"
                  value={activeSellerValue}
                  onChange={v => {
                    if (!v) { selectEmployee(null, null); setSellerName(""); return; }
                    if (v.id.startsWith("__free__")) { selectEmployee(null, null); setSellerName(v.name); }
                    else { selectEmployee(v.id, v.name); setSellerName(v.name); }
                  }}
                  options={employees}
                  required={precisaVendedora}
                  searchable={employees.length > 5}
                />
                <IndicadoPorChip referral={referral} saleTotal={totalFinal} matconOn={referral.active} />
                <ActCoupon
                  value={couponApplied}
                  onChange={v => { if (v) setCouponApplied(v); else clearCoupon(); }}
                  onValidate={handleValidateCoupon}
                />
                <ActTroca onOpen={st.openTroca} />
                <View style={{ flex: 1, minWidth: 8 }} />
                <ActBarcode onScan={handleScan} listening={scannerListening} lastCode={lastScannedCode} />
              </View>

              <View style={s.catRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <CategoryChips items={categories} active={cat} onSelect={setCat} />
                </View>
                <StockToggle />
              </View>

              <ProductSection columns={st.productCols} minCard={productMinCard} />

              {isDemo && (
                <View style={s.demoBanner}>
                  <Text style={s.demoTxt}>Modo demonstrativo</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={[
            s.cartWrap,
            { width: st.cartWidth },
            IS_WEB && ({ height: "100%" } as any),
          ]}>
            <CartPanel ref={cartHeadRef} {...cartProps} payMethods={pdvPayMethods} compact={vp.compact} fill />
          </View>
        </View>

        {modals}
      </View>
    );
  }

  // ── Layout mobile ──────────────────────────────────────────
  // Em mobile usa grid auto-fit também (2 colunas em <360px, 3 em >360px).
  return (
    <View style={{ flex: 1 }}>
      <CaixaDesignStyle />
      <CaixaBackdrop />
      <ScrollView
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <View style={s.topRowMobile}>
          <MerchantLogo size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title}>Caixa</Text>
            <Text style={s.titleSubTxt} numberOfLines={1}>
              {(company?.name || "Sua loja") + " · " + orderLabel}
            </Text>
          </View>
        </View>

        {caixaEnabled && (
          <View style={{ marginBottom: 10 }}>
            <CaixaButton
              isAberto={isAberto}
              isLoading={caixaLoading}
              openedByName={sessaoAtiva?.opened_by?.name || null}
              openedAtIso={sessaoAtiva?.opened_at || null}
              onClick={st.openCaixaModal}
            />
          </View>
        )}

        <View style={s.searchRow}>
          <SearchBox value={query} onChange={setQuery} />
          <ScannerStatusChip listening={scannerListening} lastCode={lastScannedCode} compact />
        </View>

        {/* Mobile: Cliente, Vendedora e "Mais…". Cupom, troca e digitação
            manual do código moram dentro do Mais — escritos, não em ícones. */}
        <View style={[s.actBar, IS_WEB && ({ position: "relative", zIndex: 50 } as any)]}>
          <ActPerson
            ref={customerPickerRef}
            kind="cliente" shortcut="F3"
            value={activeCustomerValue}
            onChange={pickCustomerWithPhone}
            options={customerOptions}
            recentCount={customerRecentCount}
            required={precisaCliente}
            searchable
            addable={clientesEnabled}
            onAddNew={st.openNewCustomer}
            disabled={!clientesEnabled}
            disabledHint="Disponível no plano Negócio"
          />
          <ActPerson
            ref={sellerPickerRef}
            kind="vendedora" shortcut="F2"
            value={activeSellerValue}
            onChange={v => {
              if (!v) { selectEmployee(null, null); setSellerName(""); return; }
              if (v.id.startsWith("__free__")) { selectEmployee(null, null); setSellerName(v.name); }
              else { selectEmployee(v.id, v.name); setSellerName(v.name); }
            }}
            options={employees}
            required={precisaVendedora}
            searchable={employees.length > 5}
          />
          <IndicadoPorChip referral={referral} saleTotal={totalFinal} matconOn={referral.active} />
          <View style={{ flex: 1, minWidth: 4 }} />
          <ActMais
            coupon={couponApplied}
            onCouponChange={v => { if (v) setCouponApplied(v); else clearCoupon(); }}
            onValidateCoupon={handleValidateCoupon}
            onTroca={st.openTroca}
            onScan={handleScan}
            listening={scannerListening}
            lastCode={lastScannedCode}
          />
        </View>

        <View style={[s.catRow, { marginBottom: 8 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <CategoryChips items={categories} active={cat} onSelect={setCat} />
          </View>
          <StockToggle />
        </View>

        <ProductSection columns={2} dense />

        <View style={{ marginTop: 20 }}>
          <CartPanel ref={cartHeadRef} {...cartProps} payMethods={pdvPayMethods} compact={vp.compact} />
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
  topRow:      { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  topRowMobile:{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  title:       { fontSize: 26, color: Colors.ink, letterSpacing: -0.4, fontWeight: "700" },
  titleSub:    { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  titleSubTxt: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 11, color: Colors.ink3, letterSpacing: 0.6, textTransform: "uppercase",
  },
  searchRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  actBar:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" },
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
