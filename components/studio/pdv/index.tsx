// ============================================================
// AURA STUDIO · PDV (Caixa do estúdio) — orquestrador (Fase 6)
// Conecta catálogo+scanner, carrinho e checkout aos stages e ao
// layout (desktop 2 colunas / mobile coluna única + barra).
// Lógica de dados/negócio reaproveitada do caixa.tsx original.
// ============================================================
import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Platform, useWindowDimensions } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { toast } from "@/components/Toast";

import type { CartLine, StudioProduct } from "./types";
import { PAY_METHODS } from "./types";
import { useStudioCatalog } from "./useStudioCatalog";
import { useStudioCart } from "./useStudioCart";
import { useStudioCheckout } from "./useStudioCheckout";
import { Hero, KpiStrip, Toolbar } from "./Chrome";
import { ProductCard } from "./ProductCard";
import { CartSidebar } from "./CartSidebar";
import { StageConfigure } from "./StageConfigure";
import { StageCheckout } from "./StageCheckout";
import { StageDone } from "./StageDone";
import { QuoteModal } from "./QuoteModal";
import { CategoryChip, money } from "./ui";
import { Ic } from "./icons";

type ConfigureTarget = { product: StudioProduct; values: Record<string, any>; qty: number; editLineId: string | null };

export default function StudioCaixaPage() {
  const auth = useAuthStore();
  const t = useStudioTokens();
  const cid = (auth.company as any)?.id as string | undefined;
  const company = auth.company as any;
  const operatorName =
    (auth.user as any)?.name || (auth.user as any)?.full_name ||
    (auth.user as any)?.email?.split("@")[0] || "Operador";

  const { width: winW } = useWindowDimensions();
  const wide = winW >= 1024;
  const xPad = winW >= 1280 ? 28 : winW >= 768 ? 22 : 14;

  const [stage, setStage] = useState<"list" | "checkout" | "done">("list");
  const [configure, setConfigure] = useState<ConfigureTarget | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(i); }, []);

  const cart = useStudioCart();
  const checkout = useStudioCheckout(cid);

  const openConfigure = useCallback((p: StudioProduct, line?: CartLine) => {
    setConfigure({ product: p, values: line?.values || {}, qty: line?.qty || 1, editLineId: line?.lineId || null });
  }, []);

  const handleProductPress = useCallback((p: StudioProduct) => {
    if (p.is_personalizable) openConfigure(p);
    else { cart.addSimple(p); toast.success(p.name + " adicionado"); }
  }, [cart, openConfigure]);

  const catalog = useStudioCatalog(cid, handleProductPress);

  // carrega templates ao abrir o configurador (quebra o ciclo c/ o catalog)
  useEffect(() => { if (configure) catalog.loadTemplates(configure.product.id); }, [configure?.product.id]);

  const payLabel = useMemo(() => PAY_METHODS.find((m) => m.id === checkout.pay)?.label || "—", [checkout.pay]);
  const hasStats = catalog.stats.pedidos_hoje > 0 || catalog.stats.faturamento_hoje > 0 || catalog.stats.aguardando_arte > 0 || catalog.stats.em_producao > 0;
  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const timeLabel = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const cartQtyOf = useCallback((pid: string) => cart.cart.filter((l) => l.product.id === pid).reduce((a, l) => a + l.qty, 0), [cart.cart]);

  function confirmConfigure(values: Record<string, any>, qty: number, editLineId: string | null) {
    if (!configure) return;
    cart.addCustom(configure.product, values, qty, editLineId);
    toast.success(editLineId ? "Personalização atualizada" : configure.product.name + " personalizado e adicionado");
    setConfigure(null);
  }

  async function onFinalize() {
    const ok = await checkout.finalizeSale(cart.cart, cart.subtotal);
    if (ok) { cart.clear(); setStage("done"); }
  }
  function onNewSale() { checkout.reset(); setStage("list"); }

  // ── loading ──
  if (catalog.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <StudioLoading variant="spinner" />
      </View>
    );
  }

  // ── stages full-screen ──
  if (stage === "checkout") {
    return (
      <StageCheckout
        t={t} cart={cart.cart} subtotal={cart.subtotal} count={cart.count} customCount={cart.customCount}
        customer={checkout.customer} setCustomer={checkout.setCustomer} phone={checkout.phone} setPhone={checkout.setPhone}
        pay={checkout.pay} setPay={checkout.setPay} notes={checkout.notes} setNotes={checkout.setNotes}
        sending={checkout.sending} error={checkout.error} onBack={() => setStage("list")} onFinalize={onFinalize}
      />
    );
  }
  if (stage === "done" && checkout.done) {
    return <StageDone t={t} done={checkout.done} onNewSale={onNewSale} />;
  }

  // ── grid de catálogo ──
  const gap = 12;
  const contentW = (wide ? winW - 360 : winW) - xPad * 2;
  const cols = Math.max(2, Math.min(5, Math.floor(contentW / 200)));
  const cardW = Math.floor((contentW - gap * (cols - 1)) / cols);

  const Catalog = (
    <View style={{ paddingHorizontal: xPad, paddingTop: 14, paddingBottom: 40 }}>
      <View style={{ maxWidth: 1280, alignSelf: "center", width: "100%" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <Text style={{ fontSize: 16, color: t.ink, fontWeight: "800" }}>Catálogo</Text>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: t.accent }} />
              <Text style={{ fontSize: 11, color: t.ink3 }}>Personalizável</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: t.ink5 }} />
              <Text style={{ fontSize: 11, color: t.ink3 }}>Comum</Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }} style={{ marginBottom: 4 }}>
          {catalog.categories.map((c) => (
            <CategoryChip key={c.id} t={t} label={c.label} count={c.count} active={catalog.cat === c.id} onPress={() => catalog.setCat(c.id)} />
          ))}
        </ScrollView>

        {catalog.filtered.length === 0 ? (
          <Text style={{ textAlign: "center", color: t.ink3, paddingVertical: 40 }}>Nenhum produto encontrado.</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {catalog.filtered.map((p) => (
              <View key={p.id} style={{ width: cardW }}>
                <ProductCard t={t} product={p} inCartQty={cartQtyOf(p.id)} onPress={handleProductPress} />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const MainScroll = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: wide ? 0 : (cart.count > 0 ? 96 : 24) }}>
      <Hero t={t} operatorName={operatorName} dateLabel={dateLabel} timeLabel={timeLabel} stats={catalog.stats} hasStats={hasStats} xPad={xPad} />
      <KpiStrip t={t} stats={catalog.stats} xPad={xPad} />
      <Toolbar t={t} query={catalog.query} setQuery={catalog.setQuery} scanStatus={catalog.scanStatus} xPad={xPad} />
      {Catalog}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {wide ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          {MainScroll}
          <View style={{ width: 360, ...(Platform.OS === "web" ? ({ position: "sticky", top: 0, height: "100vh" } as any) : {}) }}>
            <CartSidebar
              t={t} cart={cart.cart} subtotal={cart.subtotal} count={cart.count} customCount={cart.customCount} payLabel={payLabel}
              onSetQty={cart.setQty} onRemove={cart.removeLine} onEdit={(l) => openConfigure(l.product, l)}
              onQuote={() => setShowQuote(true)} onCheckout={() => setStage("checkout")}
            />
          </View>
        </View>
      ) : (
        <>
          {MainScroll}
          {cart.count > 0 && (
            <Pressable
              onPress={() => setStage("checkout")}
              style={{ position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: t.ink, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ backgroundColor: t.accent, minWidth: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{cart.count}</Text>
                </View>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>R$ {money(cart.subtotal)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Fechar venda</Text>
                <Ic name="arrow_right" size={16} color="#fff" />
              </View>
            </Pressable>
          )}
        </>
      )}

      {configure && (
        <StageConfigure
          t={t} product={configure.product} initialValues={configure.values} initialQty={configure.qty}
          editLineId={configure.editLineId} templates={catalog.templatesById[configure.product.id] || []}
          onCancel={() => setConfigure(null)} onConfirm={confirmConfigure}
        />
      )}
      {showQuote && (
        <QuoteModal t={t} cart={cart.cart} subtotal={cart.subtotal} count={cart.count} company={company} operatorName={operatorName} onClose={() => setShowQuote(false)} />
      )}
    </View>
  );
}
