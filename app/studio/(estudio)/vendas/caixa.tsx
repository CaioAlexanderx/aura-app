import { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { pdvApi } from "@/services/pdvApi";
import { studioApi, type CustomizationConfig, type CustomizationField } from "@/services/studioApi";
import { request } from "@/services/api";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import { maskPhone } from "@/utils/masks";

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
// ============================================================

const T = {
  bg: "#FAFAFC",
  card: "#FFFFFF",
  border: "#E5E7EB",
  ink: "#0F172A",
  ink2: "#334155",
  ink3: "#64748B",
  ink4: "#94A3B8",
  primary: "#1E3A8A",
  accent: "#EC4899",
  green: "#10B981",
  red: "#EF4444",
};

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

export default function StudioCaixaPage() {
  const auth = useAuthStore();
  const cid = (auth.company as any)?.id as string | undefined;
  const accent = T.accent;
  const primary = T.primary;

  const [products, setProducts] = useState<StudioProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  // Carga inicial — usa endpoint dedicado /studio/products
  useEffect(() => {
    if (!cid) return;
    setLoading(true);
    // Endpoint dedicado /studio/products (criado em studioSaleItemPatch.js
    // pra expor is_personalizable + customization_config, que a rota
    // /products generica nao retorna)
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

  async function loadTemplatesIfNeeded(productId: string) {
    if (templatesById[productId] || !cid) return;
    try {
      const data = await studioApi.templatesByProduct(cid, productId);
      const list = (data.templates || []).map((t: any) => ({
        id: t.id, name: t.name, image_url: t.image_url, thumb_url: t.thumb_url || null,
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
      // Mapeia em ordem: cart[i] -> saleItems[i] (mesma ordem de insert)
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
            // Se 503 (schema pendente) ou 404, logamos e seguimos
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
          `Oi ${customerName.split(" ")[0] || "tudo bem"}! Sua arte personalizada já está na produção 🎨\n` +
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

  if (loading) return <Center><ActivityIndicator color={primary} size="large" /></Center>;

  // ─── STAGE: DONE ──────────────────────────────────────────────
  if (stage === "done" && done) {
    return (
      <Center>
        <View
          style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: T.green,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 40, color: "#fff" }}>✓</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "800", color: T.ink, marginTop: 16 }}>
          Venda registrada!
        </Text>
        <Text style={{ fontSize: 13, color: T.ink3, marginTop: 6, textAlign: "center", maxWidth: 360 }}>
          O pedido entrou em "Aguardando arte" no KDS automaticamente.
        </Text>
        <View
          style={{
            backgroundColor: T.card, borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: T.border,
            alignItems: "center", gap: 6, minWidth: 280, marginTop: 16,
          }}
        >
          <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Total</Text>
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
            <Text style={{ fontSize: 16 }}>💬</Text>
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
      </Center>
    );
  }

  // ─── STAGE: CONFIGURE ───────────────────────────────────────────
  if (stage === "configure" && active) {
    const cfg = active.customization_config;
    const templates = templatesById[active.id] || [];
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View
          style={{
            backgroundColor: T.card,
            paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: T.border,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}
        >
          <Pressable onPress={() => { setStage("list"); setActive(null); setError(null); }}>
            <Text style={{ fontSize: 22, color: T.ink2 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Personalizar</Text>
            <Text style={{ fontSize: 17, fontWeight: "800", color: T.ink }}>{active.name}</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "800", color: primary }}>
            R$ {active.price.toFixed(2)}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}>
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
            />
          ))}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
            <Text style={{ fontSize: 13, color: T.ink, fontWeight: "700" }}>Quantidade</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => setEditingQty(Math.max(1, editingQty - 1))} style={qtyBtn}>
                <Text style={qtyTxt}>−</Text>
              </Pressable>
              <Text style={{ minWidth: 30, textAlign: "center", color: T.ink, fontWeight: "800", fontSize: 16 }}>{editingQty}</Text>
              <Pressable onPress={() => setEditingQty(editingQty + 1)} style={qtyBtn}>
                <Text style={qtyTxt}>+</Text>
              </Pressable>
            </View>
          </View>

          {error && <Text style={{ fontSize: 12, color: T.red, textAlign: "center" }}>{error}</Text>}
        </ScrollView>

        <View style={{ backgroundColor: T.card, padding: 14, borderTopWidth: 1, borderTopColor: T.border }}>
          <Pressable
            onPress={commitConfigure}
            style={{ backgroundColor: primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" }}
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
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View
          style={{
            backgroundColor: T.card, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: T.border,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}
        >
          <Pressable onPress={() => setStage("list")}>
            <Text style={{ fontSize: 22, color: T.ink2 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Fechar venda</Text>
            <Text style={{ fontSize: 17, fontWeight: "800", color: T.ink }}>Resumo do pedido</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 140 }}>
          <Text style={sectionLabel}>Itens personalizados</Text>
          {cart.map((l) => (
            <View
              key={l.lineId}
              style={{
                backgroundColor: T.card, borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: T.border,
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
                <Text style={{ fontSize: 13, color: T.ink, fontWeight: "700" }}>{l.product.name}</Text>
                <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>
                  Qtd {l.qty} · R$ {(l.product.price * l.qty).toFixed(2)}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable onPress={() => editLine(l)} style={editChip}>
                  <Text style={editChipTxt}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => removeLine(l.lineId)} style={removeChip}>
                  <Text style={removeChipTxt}>Remover</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Text style={sectionLabel}>Cliente (pra acompanhar arte)</Text>
          <FInput v={customerName} on={setCustomerName} ph="Nome do cliente" />
          <FInput v={customerPhone} on={(v) => setCustomerPhone(maskPhone(v))} ph="WhatsApp" kb="phone-pad" />

          <Text style={sectionLabel}>Forma de pagamento</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {["dinheiro", "pix", "credito", "debito", "crediario"].map((m) => (
              <Pressable
                key={m}
                onPress={() => setPaymentMethod(m)}
                style={[chip, paymentMethod === m && chipActive]}
              >
                <Text style={[chipTxt, paymentMethod === m && chipTxtActive]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={sectionLabel}>Observação</Text>
          <FInput v={notes} on={setNotes} ph="Algo importante sobre o pedido?" multi />

          <View
            style={{
              backgroundColor: T.card, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: T.border, gap: 4, marginTop: 6,
            }}
          >
            <TotalRow l="Subtotal" v={cartSubtotal} />
            <View style={{ height: 1, backgroundColor: T.border, marginVertical: 4 }} />
            <TotalRow l="Total" v={cartSubtotal} big />
          </View>

          {error && <Text style={{ fontSize: 12, color: T.red, textAlign: "center" }}>{error}</Text>}
        </ScrollView>

        <View style={{ backgroundColor: T.card, padding: 14, borderTopWidth: 1, borderTopColor: T.border }}>
          <Pressable
            onPress={finalizeSale}
            disabled={sendDisabled}
            style={{
              backgroundColor: primary,
              paddingVertical: 14, borderRadius: 10, alignItems: "center",
              opacity: sendDisabled ? 0.4 : 1,
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
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View
        style={[
          { padding: 22, paddingBottom: 24, backgroundColor: primary },
          Platform.OS === "web"
            ? ({ background: "linear-gradient(135deg, " + primary + ", " + accent + ")" } as any)
            : {},
        ]}
      >
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Vendas · Caixa Studio
        </Text>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 4 }}>
          Atender no balcão
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 6 }}>
          Toque num produto personalizável pra começar
        </Text>
      </View>

      <View style={{ padding: 12, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar produto..."
          placeholderTextColor={T.ink4}
          style={{
            backgroundColor: T.bg, color: T.ink, padding: 12,
            borderRadius: 8, fontSize: 13,
            borderWidth: 1, borderColor: T.border,
          }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: cartCount > 0 ? 110 : 30 }}
      >
        {error && !products.length && (
          <View style={{ padding: 16, backgroundColor: "#fee2e2", borderRadius: 8 }}>
            <Text style={{ color: T.red, fontSize: 12, fontWeight: "700" }}>{error}</Text>
          </View>
        )}

        {filteredProducts.length === 0 ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 36 }}>🎨</Text>
            <Text style={{ color: T.ink, fontWeight: "700", marginTop: 12, textAlign: "center" }}>
              {search.trim() ? "Nada encontrado." : "Nenhum produto personalizável cadastrado."}
            </Text>
            <Text style={{ color: T.ink3, fontSize: 12, marginTop: 6, textAlign: "center", maxWidth: 280 }}>
              {search.trim()
                ? "Tente outro termo."
                : "Cadastre em Estúdio › Produtos e marque \"é personalizável\"."}
            </Text>
          </View>
        ) : (
          filteredProducts.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => openConfigure(p)}
              style={{
                backgroundColor: T.card, borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: T.border,
                flexDirection: "row", gap: 12, alignItems: "center",
              }}
            >
              <PersonalizationPreview
                config={p.customization_config}
                values={{}}
                size={68}
                showLabel={false}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: T.ink, fontWeight: "700" }}>{p.name}</Text>
                {p.category ? (
                  <Text style={{ fontSize: 10, color: T.ink3, marginTop: 2, textTransform: "uppercase" }}>
                    {p.category}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 14, color: primary, fontWeight: "800", marginTop: 4 }}>
                  R$ {p.price.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  alignSelf: "center", paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: 999, backgroundColor: accent,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>Personalizar</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {cartCount > 0 && (
        <Pressable
          onPress={() => setStage("checkout")}
          style={{
            position: "absolute", left: 12, right: 12, bottom: 12,
            backgroundColor: T.ink, borderRadius: 12,
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
// Field editor (mesmo padrão do storefront público)
// ============================================================
function FieldEditor({
  field, value, templates, onChange,
}: {
  field: CustomizationField;
  value: any;
  templates: Array<{ id: string; image_url: string; thumb_url: string | null; name: string }>;
  onChange: (v: any) => void;
}) {
  if (field.type === "text") {
    const maxChars = field.config.max_chars || 30;
    return (
      <View>
        <Text style={sectionLabel}>
          {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
        </Text>
        <TextInput
          value={String(value || "")}
          onChangeText={(t) => onChange(t.slice(0, maxChars))}
          placeholder="Digite aqui"
          placeholderTextColor={T.ink4}
          maxLength={maxChars}
          style={{
            backgroundColor: T.card, color: T.ink, padding: 12,
            borderRadius: 8, fontSize: 14,
            borderWidth: 1, borderColor: T.border,
          }}
        />
        <Text style={{ fontSize: 10, color: T.ink3, marginTop: 4 }}>
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
          {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
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
                borderColor: value === c ? T.primary : T.border,
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
          {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
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
          {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
        </Text>
        {templates.length === 0 ? (
          <Text style={{ fontSize: 12, color: T.ink3, fontStyle: "italic" }}>Nenhum template vinculado a esse produto.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {templates.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => onChange(t.image_url)}
                style={{
                  width: 80, height: 80, borderRadius: 8,
                  borderWidth: value === t.image_url ? 3 : 1,
                  borderColor: value === t.image_url ? T.primary : T.border,
                  overflow: "hidden",
                  backgroundColor: T.bg,
                }}
              >
                {Platform.OS === "web" ? (
                  // @ts-ignore native img on web
                  <img src={t.thumb_url || t.image_url} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" } as any} />
                ) : (
                  <Text style={{ fontSize: 10, color: T.ink3, padding: 6 }}>{t.name}</Text>
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
          {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
        </Text>
        <TextInput
          value={String(value || "")}
          onChangeText={onChange}
          placeholder="Link da imagem (ou receber por WhatsApp depois)"
          placeholderTextColor={T.ink4}
          style={{
            backgroundColor: T.card, color: T.ink, padding: 12,
            borderRadius: 8, fontSize: 13,
            borderWidth: 1, borderColor: T.border,
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
function Center({ children }: { children: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
      {children}
    </View>
  );
}

function FInput({ v, on, ph, kb, multi }: { v: string; on: (s: string) => void; ph: string; kb?: any; multi?: boolean }) {
  return (
    <TextInput
      value={v}
      onChangeText={on}
      placeholder={ph}
      placeholderTextColor={T.ink4}
      keyboardType={kb}
      multiline={multi}
      style={{
        backgroundColor: T.card, color: T.ink, padding: 12,
        borderRadius: 8, fontSize: 13,
        borderWidth: 1, borderColor: T.border,
        minHeight: multi ? 60 : undefined,
      }}
    />
  );
}

function TotalRow({ l, v, big }: { l: string; v: number; big?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: big ? 14 : 12, color: big ? T.ink : T.ink2, fontWeight: big ? "800" : "500" }}>{l}</Text>
      <Text style={{ fontSize: big ? 18 : 12, color: big ? T.primary : T.ink, fontWeight: big ? "800" : "600" }}>
        R$ {Number(v).toFixed(2)}
      </Text>
    </View>
  );
}

const sectionLabel: any = {
  fontSize: 11, color: T.ink3, fontWeight: "700",
  textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6,
};
const qtyBtn: any = {
  width: 30, height: 30, borderRadius: 8,
  backgroundColor: "#f3f4f6",
  alignItems: "center", justifyContent: "center",
};
const qtyTxt: any = { color: T.ink, fontSize: 16, fontWeight: "800" };

const chip: any = {
  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: T.border,
};
const chipActive: any = { backgroundColor: T.primary, borderColor: T.primary };
const chipTxt: any = { color: T.ink2, fontSize: 12, fontWeight: "700" };
const chipTxtActive: any = { color: "#fff" };

const editChip: any = {
  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  backgroundColor: T.primary,
};
const editChipTxt: any = { color: "#fff", fontSize: 10, fontWeight: "800" };
const removeChip: any = {
  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  backgroundColor: "#fee2e2",
};
const removeChipTxt: any = { color: T.red, fontSize: 10, fontWeight: "800" };
