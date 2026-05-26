import { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Platform, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { pdvApi } from "@/services/pdvApi";
import { studioApi, type CustomizationConfig, type CustomizationField } from "@/services/studioApi";
import { request } from "@/services/api";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import { maskPhone } from "@/utils/masks";
import { StudioGradients } from "@/constants/studio-tokens";
import { useStudioTokens, type StudioTokens } from "@/contexts/StudioThemeMode";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";

// ============================================================
// /studio/(estudio)/vendas/caixa — PDV Studio nativo
//
// Sub-onda E do Nivel 1 Studio (25/05/2026)
//
// Substitui StudioBridge por PDV real adaptado a personalizados:
//  - Lista produtos is_personalizable=true da empresa
//  - Configurador inline com PersonalizationPreview SVG ao vivo
//  - Carrinho com customization por item
//  - Fecha venda via POST /pdv/sale (sem customization no body)
//  - Para cada item personalizado, PATCH /studio/sale-items/:id/customization
//  - Trigger SQL trg_sales_studio_status marca produção automaticamente
//  - Modal pós-venda oferece envio wa.me pro cliente acompanhar arte
//
// 26/05/2026 (redesign UI) — hero customizado com data + total do dia +
// pill operador, KPI strip horizontal (4 cards), atalhos rápidos
// (4 chips), empty state com StudioEmpty, cards de produto com
// border-left magenta + badge PERSONALIZÁVEL. Funcionalidade
// (carrinho, cálculo, submit) preservada 100%.
//
// 26/05/2026 (layout proporção) — refatoração de layout espelhando
// app/(tabs)/pdv.tsx do varejo: container central com maxWidth 1400px
// + paddingHorizontal responsivo + layout 2 colunas (catálogo
// esquerda + carrinho lateral fixo direita) em desktop (>=1024px).
// Mobile mantém coluna única + FAB carrinho. Identidade Studio
// preservada (navy primary + magenta accent, gradient navy→magenta).
// ============================================================

const CART_WIDTH = 360;
const DESKTOP_BREAK = 1024;
const MAX_CONTENT = 1400;

type StudioProduct = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
  stock_qty: number;
  customization_config: CustomizationConfig | null;
};

type CartLine = {
  lineId: string;
  product: StudioProduct;
  qty: number;
  values: Record<string, any>;
};

type Stage = "list" | "configure" | "checkout" | "done";

type DayStats = {
  pedidos_hoje: number;
  faturamento_hoje: number;
  aguardando_arte: number;
  em_producao: number;
};

export default function StudioCaixaPage() {
  const auth = useAuthStore();
  const router = useRouter();
  const cid = (auth.company as any)?.id as string | undefined;
  const operatorName =
    (auth.user as any)?.name ||
    (auth.user as any)?.full_name ||
    (auth.user as any)?.email?.split("@")[0] ||
    "Operador";
  const t = useStudioTokens();
  const accent = t.accent;
  const primary = t.primary;

  const { width: winW } = useWindowDimensions();
  const wide = winW >= DESKTOP_BREAK;
  const xPad = winW >= 1280 ? 32 : winW >= 768 ? 24 : 14;

  const [products, setProducts] = useState<StudioProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(new Date());
  const [stats, setStats] = useState<DayStats>({
    pedidos_hoje: 0,
    faturamento_hoje: 0,
    aguardando_arte: 0,
    em_producao: 0,
  });

  const [stage, setStage] = useState<Stage>("list");
  const [active, setActive] = useState<StudioProduct | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const [editingQty, setEditingQty] = useState(1);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  // Checkout
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("dinheiro");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{
    sale_id: string;
    total: number;
    wa_link: string | null;
  } | null>(null);

  // Templates do produto (cache simples)
  const [templatesById, setTemplatesById] = useState<Record<string, Array<{ id: string; name: string; image_url: string; thumb_url: string | null }>>>({});

  // Tick relógio (1min) — só pra header
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  // Carga inicial — usa endpoint dedicado /studio/products
  useEffect(() => {
    if (!cid) return;
    setLoading(true);
    request<{ products: any[] }>("/companies/" + cid + "/studio/products", { method: "GET" })
      .then(async (data) => {
        const list = (data.products || [])
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price),
            image_url: p.image_url || null,
            category: p.category || null,
            stock_qty: parseFloat(p.stock_qty || 0),
            customization_config: p.customization_config,
          }));
        setProducts(list);
      })
      .catch((e) => setError(e?.message || "Erro ao carregar produtos personalizáveis"))
      .finally(() => setLoading(false));
  }, [cid]);

  // Stats do dia — best-effort, ignora erros (endpoints podem nao existir
  // em todas empresas / planos). Padrao defensivo armadilha_schema_pre_migration.
  useEffect(() => {
    if (!cid) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await request<any>("/companies/" + cid + "/studio/dashboard/today", { method: "GET" }).catch(() => null);
        if (cancelled || !r) return;
        setStats({
          pedidos_hoje: Number(r?.pedidos_hoje || r?.orders_today || 0),
          faturamento_hoje: Number(r?.faturamento_hoje || r?.revenue_today || 0),
          aguardando_arte: Number(r?.aguardando_arte || r?.awaiting_art || 0),
          em_producao: Number(r?.em_producao || r?.in_production || 0),
        });
      } catch (_) {
        // silencioso
      }
    })();
    return () => { cancelled = true; };
  }, [cid]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const cartSubtotal = useMemo(
    () => cart.reduce((s, l) => s + l.product.price * l.qty, 0),
    [cart]
  );
  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  const styles = useMemo(() => buildStyles(t), [t]);

  async function loadTemplatesIfNeeded(productId: string) {
    if (templatesById[productId] || !cid) return;
    try {
      const data = await studioApi.templatesByProduct(cid, productId);
      const list = (data.templates || []).map((tpl: any) => ({
        id: tpl.id, name: tpl.name, image_url: tpl.image_url, thumb_url: tpl.thumb_url || null,
      }));
      setTemplatesById((prev) => ({ ...prev, [productId]: list }));
    } catch (_) {
      setTemplatesById((prev) => ({ ...prev, [productId]: [] }));
    }
  }

  function openConfigure(p: StudioProduct) {
    setActive(p);
    setEditingLineId(null);
    const init: Record<string, any> = {};
    const cfg = p.customization_config;
    if (cfg?.fields) {
      for (const f of cfg.fields) {
        if (f.type === "color" && f.config.colors?.length) init[f.id] = f.config.colors[0];
      }
    }
    setEditingValues(init);
    setEditingQty(1);
    loadTemplatesIfNeeded(p.id);
    setStage("configure");
  }

  function editLine(l: CartLine) {
    setActive(l.product);
    setEditingLineId(l.lineId);
    setEditingValues(l.values);
    setEditingQty(l.qty);
    loadTemplatesIfNeeded(l.product.id);
    setStage("configure");
  }

  function commitConfigure() {
    if (!active) return;
    const cfg = active.customization_config;
    if (cfg?.fields) {
      for (const f of cfg.fields) {
        if (f.required) {
          const v = editingValues[f.id];
          if (v == null || (typeof v === "string" && !v.trim())) {
            setError(`Preencha "${f.label}"`);
            return;
          }
        }
      }
    }
    setError(null);
    if (editingLineId) {
      setCart((prev) =>
        prev.map((l) => (l.lineId === editingLineId ? { ...l, qty: editingQty, values: editingValues } : l))
      );
    } else {
      const lineId = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7);
      setCart((prev) => [...prev, { lineId, product: active, qty: editingQty, values: editingValues }]);
    }
    setActive(null);
    setEditingLineId(null);
    setStage("list");
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  async function finalizeSale() {
    if (!cid) return;
    if (cart.length === 0) {
      setError("Carrinho vazio");
      return;
    }
    setSending(true);
    setError(null);
    try {
      // 1. POST /pdv/sale — venda normal sem customization
      const saleBody: any = {
        items: cart.map((l) => ({
          product_id: l.product.id,
          quantity: l.qty,
          unit_price: l.product.price,
          product_name_snapshot: l.product.name,
        })),
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        seller_name: customerName.trim() || null,
      };
      const saleRes = await pdvApi.createSale(cid, saleBody);
      const saleId = saleRes?.sale?.id;
      const saleItems: any[] = saleRes?.sale?.items || [];

      // 2. Para cada item personalizado, PATCH studio/sale-items/:id/customization
      const patchPromises: Promise<any>[] = [];
      for (let i = 0; i < cart.length; i++) {
        const line = cart[i];
        const si = saleItems[i];
        if (!si?.id) continue;
        patchPromises.push(
          request<any>(
            "/companies/" + cid + "/studio/sale-items/" + si.id + "/customization",
            { method: "PATCH", body: { customization: line.values } }
          ).catch((err) => {
            console.warn("[studio-pdv] patch customization fail:", err?.message);
          })
        );
      }
      await Promise.allSettled(patchPromises);

      // 3. Monta wa.me link pro cliente acompanhar
      let waLink: string | null = null;
      if (customerPhone.trim()) {
        const digits = customerPhone.replace(/\D/g, "");
        const phone = digits.startsWith("55") ? digits : "55" + digits;
        const msg = encodeURIComponent(
          `Oi ${customerName.split(" ")[0] || "tudo bem"}! Sua arte personalizada já está na produção\n` +
            `Pedido #${String(saleId).slice(0, 8)} · R$ ${cartSubtotal.toFixed(2)}\n\n` +
            `Em breve te mando o mockup pra aprovação.`
        );
        waLink = `https://wa.me/${phone}?text=${msg}`;
      }

      setDone({
        sale_id: saleId,
        total: parseFloat(saleRes?.sale?.total_amount || cartSubtotal),
        wa_link: waLink,
      });
      setCart([]);
      setStage("done");
    } catch (e: any) {
      setError(e?.message || "Erro ao fechar venda");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <StudioLoading variant="spinner" />
      </View>
    );
  }

  // ─── STAGE: DONE ──────────────────────────────────────────────
  if (stage === "done" && done) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View
          style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: t.success,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 40, color: "#fff" }}>OK</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, marginTop: 16 }}>
          Venda registrada!
        </Text>
        <Text style={{ fontSize: 13, color: t.ink3, marginTop: 6, textAlign: "center", maxWidth: 360 }}>
          O pedido entrou em "Aguardando arte" no Fluxo de Produção automaticamente.
        </Text>
        <View
          style={{
            backgroundColor: t.paperCardElev, borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: t.ink5,
            alignItems: "center", gap: 6, minWidth: 280, marginTop: 16,
          }}
        >
          <Text style={{ fontSize: 11, color: t.ink3, textTransform: "uppercase" }}>Total</Text>
          <Text style={{ fontSize: 26, color: primary, fontWeight: "800" }}>
            R$ {done.total.toFixed(2)}
          </Text>
          <Text style={{ fontSize: 11, color: accent, fontWeight: "700", marginTop: 8 }}>
            Em produção
          </Text>
        </View>

        {done.wa_link && Platform.OS === "web" && (
          <Pressable
            onPress={() => { if (typeof window !== "undefined") window.open(done.wa_link!, "_blank"); }}
            style={{
              backgroundColor: "#25D366", paddingHorizontal: 20, paddingVertical: 12,
              borderRadius: 10, marginTop: 16, flexDirection: "row", gap: 8, alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Mandar wa.me pro cliente</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => { setStage("list"); setDone(null); setCustomerName(""); setCustomerPhone(""); setNotes(""); }}
          style={{
            backgroundColor: primary, paddingHorizontal: 24, paddingVertical: 12,
            borderRadius: 10, marginTop: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>+ Nova venda</Text>
        </Pressable>
      </View>
    );
  }

  // ─── STAGE: CONFIGURE ───────────────────────────────────────────
  if (stage === "configure" && active) {
    const cfg = active.customization_config;
    const templates = templatesById[active.id] || [];
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <View
          style={{
            backgroundColor: t.paperCardElev,
            paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: t.ink5,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}
        >
          <Pressable onPress={() => { setStage("list"); setActive(null); setError(null); }}>
            <Text style={{ fontSize: 22, color: t.ink2 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: t.ink3, textTransform: "uppercase" }}>Personalizar</Text>
            <Text style={{ fontSize: 17, fontWeight: "800", color: t.ink }}>{active.name}</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "800", color: primary }}>
            R$ {active.price.toFixed(2)}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120, maxWidth: 720, alignSelf: "center", width: "100%" }}>
          <View style={{ alignItems: "center" }}>
            <PersonalizationPreview
              config={cfg}
              values={editingValues}
              size={300}
              productName={active.name}
              showLabel={false}
            />
          </View>

          {cfg?.fields?.map((f) => (
            <FieldEditor
              key={f.id}
              field={f}
              value={editingValues[f.id]}
              templates={templates}
              onChange={(v) => setEditingValues((prev) => ({ ...prev, [f.id]: v }))}
              t={t}
            />
          ))}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
            <Text style={{ fontSize: 13, color: t.ink, fontWeight: "700" }}>Quantidade</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => setEditingQty(Math.max(1, editingQty - 1))} style={styles.qtyBtn}>
                <Text style={styles.qtyTxt}>−</Text>
              </Pressable>
              <Text style={{ minWidth: 30, textAlign: "center", color: t.ink, fontWeight: "800", fontSize: 16 }}>{editingQty}</Text>
              <Pressable onPress={() => setEditingQty(editingQty + 1)} style={styles.qtyBtn}>
                <Text style={styles.qtyTxt}>+</Text>
              </Pressable>
            </View>
          </View>

          {error && <Text style={{ fontSize: 12, color: t.danger, textAlign: "center" }}>{error}</Text>}
        </ScrollView>

        <View style={{ backgroundColor: t.paperCardElev, padding: 14, borderTopWidth: 1, borderTopColor: t.ink5 }}>
          <Pressable
            onPress={commitConfigure}
            style={{ backgroundColor: primary, paddingVertical: 14, borderRadius: 10, alignItems: "center", maxWidth: 720, alignSelf: "center", width: "100%" }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
              {editingLineId ? "Atualizar" : "Adicionar"} • R$ {(active.price * editingQty).toFixed(2)}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── STAGE: CHECKOUT ────────────────────────────────────────────
  if (stage === "checkout") {
    const sendDisabled = sending || cart.length === 0;
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <View
          style={{
            backgroundColor: t.paperCardElev, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: t.ink5,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}
        >
          <Pressable onPress={() => setStage("list")}>
            <Text style={{ fontSize: 22, color: t.ink2 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: t.ink3, textTransform: "uppercase" }}>Fechar venda</Text>
            <Text style={{ fontSize: 17, fontWeight: "800", color: t.ink }}>Resumo do pedido</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 140, maxWidth: 720, alignSelf: "center", width: "100%" }}>
          <Text style={styles.sectionLabel}>Itens personalizados</Text>
          {cart.map((l) => (
            <View
              key={l.lineId}
              style={{
                backgroundColor: t.paperCardElev, borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: t.ink5,
                flexDirection: "row", alignItems: "center", gap: 12,
              }}
            >
              <PersonalizationPreview
                config={l.product.customization_config}
                values={l.values}
                size={56}
                showLabel={false}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: t.ink, fontWeight: "700" }}>{l.product.name}</Text>
                <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
                  Qtd {l.qty} · R$ {(l.product.price * l.qty).toFixed(2)}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable onPress={() => editLine(l)} style={styles.editChip}>
                  <Text style={styles.editChipTxt}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => removeLine(l.lineId)} style={styles.removeChip}>
                  <Text style={styles.removeChipTxt}>Remover</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Text style={styles.sectionLabel}>Cliente (pra acompanhar arte)</Text>
          <FInput v={customerName} on={setCustomerName} ph="Nome do cliente" t={t} />
          <FInput v={customerPhone} on={(v) => setCustomerPhone(maskPhone(v))} ph="WhatsApp" kb="phone-pad" t={t} />

          <Text style={styles.sectionLabel}>Forma de pagamento</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {["dinheiro", "pix", "credito", "debito", "crediario"].map((m) => (
              <Pressable
                key={m}
                onPress={() => setPaymentMethod(m)}
                style={[styles.chip, paymentMethod === m && styles.chipActive]}
              >
                <Text style={[styles.chipTxt, paymentMethod === m && styles.chipTxtActive]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Observação</Text>
          <FInput v={notes} on={setNotes} ph="Algo importante sobre o pedido?" multi t={t} />

          <View
            style={{
              backgroundColor: t.paperCardElev, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: t.ink5, gap: 4, marginTop: 6,
            }}
          >
            <TotalRow l="Subtotal" v={cartSubtotal} t={t} />
            <View style={{ height: 1, backgroundColor: t.ink5, marginVertical: 4 }} />
            <TotalRow l="Total" v={cartSubtotal} big t={t} />
          </View>

          {error && <Text style={{ fontSize: 12, color: t.danger, textAlign: "center" }}>{error}</Text>}
        </ScrollView>

        <View style={{ backgroundColor: t.paperCardElev, padding: 14, borderTopWidth: 1, borderTopColor: t.ink5 }}>
          <Pressable
            onPress={finalizeSale}
            disabled={sendDisabled}
            style={{
              backgroundColor: primary,
              paddingVertical: 14, borderRadius: 10, alignItems: "center",
              opacity: sendDisabled ? 0.4 : 1,
              maxWidth: 720, alignSelf: "center", width: "100%",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
              {sending ? "Registrando..." : "Fechar venda • R$ " + cartSubtotal.toFixed(2)}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── STAGE: LIST ──────────────────────────────────────────────
  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const timeLabel = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hasStats =
    stats.pedidos_hoje > 0 ||
    stats.faturamento_hoje > 0 ||
    stats.aguardando_arte > 0 ||
    stats.em_producao > 0;

  // ── Componente: Hero (compartilhado entre desktop e mobile) ──
  const Hero = (
    <View
      style={[
        { backgroundColor: primary, paddingHorizontal: xPad, paddingTop: 22, paddingBottom: 22 },
        Platform.OS === "web"
          ? ({ background: `linear-gradient(135deg, ${StudioGradients.brand[0]}, ${StudioGradients.brand[1]})` } as any)
          : ({ backgroundColor: t.primary } as any),
      ]}
    >
      <View style={{ maxWidth: MAX_CONTENT, alignSelf: "center", width: "100%" }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 10, fontWeight: "800", letterSpacing: 1.2,
                color: accent, textTransform: "uppercase",
              }}
            >
              VENDAS · PDV STUDIO
            </Text>
            <Text
              style={{
                fontSize: 28, fontWeight: "800", color: "#fff",
                marginTop: 4, lineHeight: 32,
              }}
            >
              Caixa do estúdio
            </Text>
            <Text
              style={{
                fontSize: 12, color: "rgba(255,255,255,0.78)",
                marginTop: 6, textTransform: "capitalize",
              }}
            >
              {dateLabel}
              {hasStats
                ? ` · R$ ${stats.faturamento_hoje.toFixed(2)} em ${stats.pedidos_hoje} ${stats.pedidos_hoje === 1 ? "pedido" : "pedidos"} hoje`
                : " · Pronto pra primeira venda"}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.14)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
              borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
              alignItems: "center", flexDirection: "row", gap: 8,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" }} />
            <View>
              <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: "600", letterSpacing: 0.5 }}>
                ESTAÇÃO ATIVA
              </Text>
              <Text style={{ fontSize: 12, color: "#fff", fontWeight: "800" }}>
                {timeLabel} · {operatorName}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  // ── Componente: KPI strip ──
  const KpiStrip = (
    <View style={{ paddingHorizontal: xPad, paddingTop: 12 }}>
      <View style={{ maxWidth: MAX_CONTENT, alignSelf: "center", width: "100%" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 4 }}
        >
          <KpiCard t={t} label="Pedidos hoje" value={String(stats.pedidos_hoje)} icon="◆" />
          <KpiCard t={t} label="Faturamento hoje" value={`R$ ${stats.faturamento_hoje.toFixed(0)}`} icon="$" />
          <KpiCard t={t} label="Aguardando arte" value={String(stats.aguardando_arte)} icon="◷" tone="warn" />
          <KpiCard t={t} label="Em produção" value={String(stats.em_producao)} icon="►" tone="accent" />
        </ScrollView>
      </View>
    </View>
  );

  // ── Componente: Atalhos ──
  const Shortcuts = (
    <View style={{ paddingHorizontal: xPad, paddingTop: 14 }}>
      <View style={{ maxWidth: MAX_CONTENT, alignSelf: "center", width: "100%" }}>
        <Text
          style={{
            fontSize: 10, color: t.ink3, fontWeight: "800",
            letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8,
          }}
        >
          Atalhos rápidos
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          <ShortcutChip t={t} icon="►" label="Ver Produção" onPress={() => router.push("/studio/producao" as any)} />
          <ShortcutChip t={t} icon="◆" label="Pedidos do dia" onPress={() => router.push("/studio/pedidos" as any)} />
          <ShortcutChip t={t} icon="+" label="Cadastrar produto" onPress={() => router.push("/studio/produtos" as any)} />
          <ShortcutChip t={t} icon="✓" label="Aprovações" onPress={() => router.push("/studio/aprovacao" as any)} />
        </ScrollView>
      </View>
    </View>
  );

  // ── Componente: Search ──
  const SearchBar = (
    <View style={{ paddingHorizontal: xPad, paddingTop: 16, paddingBottom: 4 }}>
      <View style={{ maxWidth: MAX_CONTENT, alignSelf: "center", width: "100%" }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar produto personalizável..."
          placeholderTextColor={t.ink4}
          style={{
            backgroundColor: t.paperCardElev, color: t.ink, padding: 12,
            borderRadius: 10, fontSize: 13,
            borderWidth: 1, borderColor: t.ink5,
          }}
        />
      </View>
    </View>
  );

  // ── Componente: Lista produtos ──
  const ProductList = (
    <View style={{ paddingHorizontal: xPad, paddingTop: 12, gap: 10 }}>
      <View style={{ maxWidth: MAX_CONTENT, alignSelf: "center", width: "100%", gap: 10 }}>
        {error && !products.length && (
          <View style={{ padding: 16, backgroundColor: t.dangerSoft, borderRadius: 8 }}>
            <Text style={{ color: t.danger, fontSize: 12, fontWeight: "700" }}>{error}</Text>
          </View>
        )}

        {filteredProducts.length === 0 ? (
          search.trim() ? (
            <StudioEmpty
              icon="search"
              title="Nada encontrado."
              desc="Tente outro termo de busca."
            />
          ) : (
            <StudioEmpty
              icon="shopping-bag"
              title="Catálogo personalizado vazio"
              desc='Marque produtos como "personalizáveis" em Estúdio › Produtos pra começar a vender no PDV.'
              primaryCta={{
                label: "Cadastrar produto",
                onPress: () => router.push("/studio/produtos" as any),
              }}
              secondaryCta={{
                label: "Ver galeria",
                onPress: () => router.push("/studio/galeria" as any),
              }}
            />
          )
        ) : (
          filteredProducts.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => openConfigure(p)}
              style={({ hovered, pressed }: any) => ({
                backgroundColor: t.paperCardElev, borderRadius: 14,
                padding: 14, paddingLeft: 16,
                borderWidth: 1, borderColor: t.ink5,
                borderLeftWidth: 3, borderLeftColor: accent,
                flexDirection: "row", gap: 14, alignItems: "center",
                ...(Platform.OS === "web"
                  ? ({
                      transition: "transform 0.18s ease, box-shadow 0.18s ease",
                      transform: pressed ? "scale(0.99)" : hovered ? "scale(1.01)" : "scale(1)",
                      boxShadow: hovered
                        ? `0 8px 24px ${accent}33, 0 2px 6px rgba(0,0,0,0.05)`
                        : `0 2px 6px ${accent}1A`,
                      cursor: "pointer",
                    } as any)
                  : {}),
              })}
            >
              <PersonalizationPreview
                config={p.customization_config}
                values={{}}
                size={68}
                showLabel={false}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ fontSize: 15, color: t.ink, fontWeight: "800", flexShrink: 1 }}>
                    {p.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: accent + "1A",
                      borderWidth: 1, borderColor: accent + "55",
                      paddingHorizontal: 8, paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9, color: accent, fontWeight: "800",
                        letterSpacing: 0.6, textTransform: "uppercase",
                      }}
                    >
                      Personalizável
                    </Text>
                  </View>
                </View>
                {p.category ? (
                  <Text style={{ fontSize: 10, color: t.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {p.category}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 16, color: primary, fontWeight: "800", marginTop: 4 }}>
                  R$ {p.price.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  alignSelf: "center", paddingHorizontal: 14, paddingVertical: 9,
                  borderRadius: 999, backgroundColor: accent,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 }}>
                  Personalizar →
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );

  // ── Componente: Carrinho lateral (desktop) ──
  const CartSidebar = (
    <View
      style={{
        backgroundColor: t.paperCard,
        borderLeftWidth: 1, borderLeftColor: t.ink5,
        padding: 16, gap: 12,
        flex: 1,
        ...(Platform.OS === "web"
          ? ({ position: "sticky" as any, top: 0, height: "100vh", maxHeight: "100vh", overflow: "auto" } as any)
          : {}),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 13, color: t.ink, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" }}>
          Carrinho
        </Text>
        <View
          style={{
            backgroundColor: cartCount > 0 ? accent : t.bgSoft,
            paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontSize: 11, color: cartCount > 0 ? "#fff" : t.ink3, fontWeight: "800" }}>
            {cartCount} {cartCount === 1 ? "item" : "itens"}
          </Text>
        </View>
      </View>

      {cart.length === 0 ? (
        <View
          style={{
            backgroundColor: t.bgSoft, borderRadius: 12,
            borderWidth: 1, borderColor: t.ink5, borderStyle: "dashed" as any,
            padding: 24, alignItems: "center", gap: 8,
            marginTop: 10,
          }}
        >
          <View
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: accent + "1A",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18, color: accent, fontWeight: "800" }}>+</Text>
          </View>
          <Text style={{ fontSize: 12, color: t.ink2, fontWeight: "700", textAlign: "center" }}>
            Carrinho vazio
          </Text>
          <Text style={{ fontSize: 11, color: t.ink3, textAlign: "center", lineHeight: 16 }}>
            Selecione um produto à esquerda e personalize.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
          {cart.map((l) => (
            <View
              key={l.lineId}
              style={{
                backgroundColor: t.paperCardElev, borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: t.ink5,
                flexDirection: "row", alignItems: "center", gap: 10,
              }}
            >
              <PersonalizationPreview
                config={l.product.customization_config}
                values={l.values}
                size={44}
                showLabel={false}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12, color: t.ink, fontWeight: "700" }} numberOfLines={1}>
                  {l.product.name}
                </Text>
                <Text style={{ fontSize: 10, color: t.ink3, marginTop: 2 }}>
                  Qtd {l.qty} · R$ {(l.product.price * l.qty).toFixed(2)}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  <Pressable onPress={() => editLine(l)} style={styles.editChip}>
                    <Text style={styles.editChipTxt}>Editar</Text>
                  </Pressable>
                  <Pressable onPress={() => removeLine(l.lineId)} style={styles.removeChip}>
                    <Text style={styles.removeChipTxt}>Remover</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <View
        style={{
          backgroundColor: t.paperCardElev, borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: t.ink5, gap: 4,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total
          </Text>
          <Text style={{ fontSize: 20, color: primary, fontWeight: "800" }}>
            R$ {cartSubtotal.toFixed(2)}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => setStage("checkout")}
        disabled={cart.length === 0}
        style={{
          backgroundColor: cart.length === 0 ? t.ink5 : primary,
          paddingVertical: 14, borderRadius: 10,
          alignItems: "center",
          opacity: cart.length === 0 ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
          Fechar venda →
        </Text>
      </Pressable>
    </View>
  );

  // ─── LAYOUT WIDE (desktop) ─── 2 colunas: catálogo + carrinho sticky
  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <View
          style={[
            { flex: 1, minWidth: 0 },
            Platform.OS === "web"
              ? ({ display: "grid", gridTemplateColumns: `1fr ${CART_WIDTH}px` } as any)
              : { flexDirection: "row" },
          ]}
        >
          <ScrollView
            style={[
              { flex: 1, minWidth: 0 },
              Platform.OS === "web" ? ({ maxHeight: "100vh", overflow: "auto" } as any) : {},
            ]}
            contentContainerStyle={{ paddingBottom: 48 }}
          >
            {Hero}
            {KpiStrip}
            {Shortcuts}
            {SearchBar}
            {ProductList}
          </ScrollView>

          <View style={{ width: CART_WIDTH }}>
            {CartSidebar}
          </View>
        </View>
      </View>
    );
  }

  // ─── LAYOUT MOBILE ─── coluna única + FAB carrinho
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: cartCount > 0 ? 110 : 30 }}
      >
        {Hero}
        {KpiStrip}
        {Shortcuts}
        {SearchBar}
        {ProductList}
      </ScrollView>

      {cartCount > 0 && (
        <Pressable
          onPress={() => setStage("checkout")}
          style={{
            position: "absolute", left: 12, right: 12, bottom: 12,
            backgroundColor: t.ink, borderRadius: 12,
            paddingVertical: 14, paddingHorizontal: 16,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                backgroundColor: accent, width: 26, height: 26,
                borderRadius: 13, alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{cartCount}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>itens personalizados</Text>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>R$ {cartSubtotal.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Fechar →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ============================================================
// Sub-components (KPI / Shortcut)
// ============================================================
function KpiCard({
  t, label, value, icon, tone,
}: {
  t: StudioTokens;
  label: string;
  value: string;
  icon: string;
  tone?: "warn" | "accent" | "primary";
}) {
  const iconColor =
    tone === "warn" ? t.warning :
    tone === "accent" ? t.accent :
    t.accent;
  return (
    <View
      style={{
        backgroundColor: t.paperCard, borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: t.ink5,
        minWidth: 140, gap: 4,
      }}
    >
      <View
        style={{
          width: 28, height: 28, borderRadius: 8,
          backgroundColor: iconColor + "1A",
          alignItems: "center", justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <Text style={{ color: iconColor, fontSize: 14, fontWeight: "800" }}>{icon}</Text>
      </View>
      <Text style={{ fontSize: 22, color: t.primary, fontWeight: "800", lineHeight: 24 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

function ShortcutChip({
  t, icon, label, onPress,
}: {
  t: StudioTokens;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => ({
        flexDirection: "row", alignItems: "center", gap: 8,
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: t.paperCardElev,
        borderWidth: 1, borderColor: t.ink5,
        ...(Platform.OS === "web"
          ? ({
              transition: "all 0.15s ease",
              cursor: "pointer",
              borderColor: hovered ? t.accent : t.ink5,
              boxShadow: hovered ? `0 2px 8px ${t.accent}22` : "none",
            } as any)
          : {}),
      })}
    >
      <View
        style={{
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: t.accent + "1A",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Text style={{ color: t.accent, fontSize: 11, fontWeight: "800" }}>{icon}</Text>
      </View>
      <Text style={{ fontSize: 12, color: t.ink, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

// ============================================================
// Field editor (mesmo padrão do storefront público)
// ============================================================
function FieldEditor({
  field, value, templates, onChange, t,
}: {
  field: CustomizationField;
  value: any;
  templates: Array<{ id: string; image_url: string; thumb_url: string | null; name: string }>;
  onChange: (v: any) => void;
  t: StudioTokens;
}) {
  const sectionLabel = {
    fontSize: 11, color: t.ink3, fontWeight: "700" as const,
    textTransform: "uppercase" as const, letterSpacing: 0.5, marginTop: 6,
  };
  const chip = {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5,
  };
  const chipActive = { backgroundColor: t.primary, borderColor: t.primary };
  const chipTxt = { color: t.ink2, fontSize: 12, fontWeight: "700" as const };
  const chipTxtActive = { color: "#fff" };

  if (field.type === "text") {
    const maxChars = field.config.max_chars || 30;
    return (
      <View>
        <Text style={sectionLabel}>
          {field.label} {field.required && <Text style={{ color: t.danger }}>*</Text>}
        </Text>
        <TextInput
          value={String(value || "")}
          onChangeText={(txt) => onChange(txt.slice(0, maxChars))}
          placeholder="Digite aqui"
          placeholderTextColor={t.ink4}
          maxLength={maxChars}
          style={{
            backgroundColor: t.paperCardElev, color: t.ink, padding: 12,
            borderRadius: 8, fontSize: 14,
            borderWidth: 1, borderColor: t.ink5,
          }}
        />
        <Text style={{ fontSize: 10, color: t.ink3, marginTop: 4 }}>
          {String(value || "").length}/{maxChars}
        </Text>
      </View>
    );
  }
  if (field.type === "color") {
    const colors = field.config.colors || ["#FFFFFF", "#000000"];
    return (
      <View>
        <Text style={sectionLabel}>
          {field.label} {field.required && <Text style={{ color: t.danger }}>*</Text>}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {colors.map((c) => (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: c,
                borderWidth: value === c ? 3 : 1,
                borderColor: value === c ? t.primary : t.ink5,
              }}
            />
          ))}
        </View>
      </View>
    );
  }
  if (field.type === "option") {
    const choices = field.config.choices || [];
    return (
      <View>
        <Text style={sectionLabel}>
          {field.label} {field.required && <Text style={{ color: t.danger }}>*</Text>}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {choices.map((c) => (
            <Pressable
              key={c.value}
              onPress={() => onChange(c.value)}
              style={[chip, value === c.value && chipActive]}
            >
              <Text style={[chipTxt, value === c.value && chipTxtActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  if (field.type === "template") {
    return (
      <View>
        <Text style={sectionLabel}>
          {field.label} {field.required && <Text style={{ color: t.danger }}>*</Text>}
        </Text>
        {templates.length === 0 ? (
          <Text style={{ fontSize: 12, color: t.ink3, fontStyle: "italic" }}>Nenhum template vinculado a esse produto.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {templates.map((tpl) => (
              <Pressable
                key={tpl.id}
                onPress={() => onChange(tpl.image_url)}
                style={{
                  width: 80, height: 80, borderRadius: 8,
                  borderWidth: value === tpl.image_url ? 3 : 1,
                  borderColor: value === tpl.image_url ? t.primary : t.ink5,
                  overflow: "hidden",
                  backgroundColor: t.bg,
                }}
              >
                {Platform.OS === "web" ? (
                  // @ts-ignore native img on web
                  <img src={tpl.thumb_url || tpl.image_url} alt={tpl.name} style={{ width: "100%", height: "100%", objectFit: "cover" } as any} />
                ) : (
                  <Text style={{ fontSize: 10, color: t.ink3, padding: 6 }}>{tpl.name}</Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }
  if (field.type === "image") {
    return (
      <View>
        <Text style={sectionLabel}>
          {field.label} {field.required && <Text style={{ color: t.danger }}>*</Text>}
        </Text>
        <TextInput
          value={String(value || "")}
          onChangeText={onChange}
          placeholder="Link da imagem (ou receber por WhatsApp depois)"
          placeholderTextColor={t.ink4}
          style={{
            backgroundColor: t.paperCardElev, color: t.ink, padding: 12,
            borderRadius: 8, fontSize: 13,
            borderWidth: 1, borderColor: t.ink5,
          }}
        />
      </View>
    );
  }
  return null;
}

// ============================================================
// Helpers
// ============================================================
function FInput({ v, on, ph, kb, multi, t }: { v: string; on: (s: string) => void; ph: string; kb?: any; multi?: boolean; t: StudioTokens }) {
  return (
    <TextInput
      value={v}
      onChangeText={on}
      placeholder={ph}
      placeholderTextColor={t.ink4}
      keyboardType={kb}
      multiline={multi}
      style={{
        backgroundColor: t.paperCardElev, color: t.ink, padding: 12,
        borderRadius: 8, fontSize: 13,
        borderWidth: 1, borderColor: t.ink5,
        minHeight: multi ? 60 : undefined,
      }}
    />
  );
}

function TotalRow({ l, v, big, t }: { l: string; v: number; big?: boolean; t: StudioTokens }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: big ? 14 : 12, color: big ? t.ink : t.ink2, fontWeight: big ? "800" : "500" }}>{l}</Text>
      <Text style={{ fontSize: big ? 18 : 12, color: big ? t.primary : t.ink, fontWeight: big ? "800" : "600" }}>
        R$ {Number(v).toFixed(2)}
      </Text>
    </View>
  );
}

function buildStyles(t: StudioTokens) {
  return {
    sectionLabel: {
      fontSize: 11, color: t.ink3, fontWeight: "700" as const,
      textTransform: "uppercase" as const, letterSpacing: 0.5, marginTop: 6,
    },
    qtyBtn: {
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: t.bgSoft,
      alignItems: "center" as const, justifyContent: "center" as const,
    },
    qtyTxt: { color: t.ink, fontSize: 16, fontWeight: "800" as const },
    chip: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
      backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5,
    },
    chipActive: { backgroundColor: t.primary, borderColor: t.primary },
    chipTxt: { color: t.ink2, fontSize: 12, fontWeight: "700" as const },
    chipTxtActive: { color: "#fff" },
    editChip: {
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
      backgroundColor: t.primary,
    },
    editChipTxt: { color: "#fff", fontSize: 10, fontWeight: "800" as const },
    removeChip: {
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
      backgroundColor: t.dangerSoft,
    },
    removeChipTxt: { color: t.danger, fontSize: 10, fontWeight: "800" as const },
  };
}
