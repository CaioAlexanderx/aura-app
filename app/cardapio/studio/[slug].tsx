import { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { maskPhone } from "@/utils/masks";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import type { CustomizationConfig, CustomizationField } from "@/services/studioApi";

// ============================================================
// /cardapio/studio/[slug] — Storefront publico Studio. Sem auth.
//
// Nivel 1 Sub-onda D (25/05/2026)
// 25/05/2026 (fechamento Loja Digital Studio):
//   + price_delta de option/color somado no carrinho + display por linha
//   + upload R2 de foto direto da página (web) pra campos type=image
//   + estagio "sent" mostra politica de revisões + prazo
//
// Cliente entra no link, ve grid de produtos personalizaveis,
// abre o configurador (text/image/template/color/option),
// preview SVG ao vivo via PersonalizationPreview, fecha pedido
// com nome+telefone e pix/cartao/on_delivery.
//
// Backend: GET /storefront/:slug/studio/products  (com revisions policy)
//          POST /storefront/:slug/studio/order
//          GET  /storefront/:slug/studio/order/:oid (poll)
//          POST /storefront/:slug/studio/upload    (R2 publico)
// ============================================================

const API_BASE =
  (typeof process !== "undefined" && (process.env as any)?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

// Paleta Studio (navy primary + magenta accent)
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
  amber: "#F59E0B",
  red: "#EF4444",
};

type StudioStoreProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  stock_qty: number;
  customization_config: CustomizationConfig | null;
  templates: Array<{
    id: string; name: string; image_url: string; thumb_url: string | null;
    category_name: string | null;
  }>;
};

type StoreRevisions = {
  max_included: number;         // 0 = ilimitado (loja não definiu)
  extra_price: number;          // R$ cobrado por revisão extra
  policy_text: string | null;   // texto custom da loja
};

type StorePayload = {
  site: {
    name: string; tagline?: string;
    primary_color: string; accent_color: string;
    logo_url: string | null; cover_url?: string | null;
  };
  products: StudioStoreProduct[];
  sla: { sla_base_days: number; queue_qty: number; total_estimate_days: number };
  payment: { has_pix: boolean; has_card: boolean; pay_on_delivery_enabled: boolean };
  revisions: StoreRevisions;
  total_products: number;
};

type CartLine = {
  lineId: string;
  product: StudioStoreProduct;
  qty: number;
  values: Record<string, any>;
};

type Stage = "list" | "configure" | "checkout" | "sent";

// ============================================================
// Soma os price_delta das choices selecionadas em option/color.
// Espelha o helper `computeChoicesDelta` no backend pra cliente
// ver o preço correto antes de submeter.
// ============================================================
function choicesDelta(cfg: CustomizationConfig | null | undefined, values: Record<string, any>): number {
  if (!cfg?.fields) return 0;
  let delta = 0;
  for (const f of cfg.fields) {
    if (f.type !== "option" && f.type !== "color") continue;
    const choices = f.config?.choices;
    if (!Array.isArray(choices) || choices.length === 0) continue;
    const selected = values[f.id];
    if (selected == null) continue;
    const sels = Array.isArray(selected) ? selected : [selected];
    for (const s of sels) {
      const c = choices.find((ch: any) => ch.value === s || ch.label === s);
      if (c && typeof c.price_delta === "number" && !isNaN(c.price_delta)) {
        delta += c.price_delta;
      }
    }
  }
  return delta;
}

// Preço efetivo = price + delta. Sem qty.
function lineUnitPrice(line: CartLine): number {
  return Number(line.product.price) + choicesDelta(line.product.customization_config, line.values);
}

function lineTotal(line: CartLine): number {
  return lineUnitPrice(line) * line.qty;
}

export default function StudioStorefrontPage() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = String(params.slug || "");

  const [store, setStore] = useState<StorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("list");
  const [activeProduct, setActiveProduct] = useState<StudioStoreProduct | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const [editingQty, setEditingQty] = useState(1);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);

  // Checkout form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | "on_delivery" | null>(null);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressNeigh, setAddressNeigh] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [notes, setNotes] = useState("");

  const [sending, setSending] = useState(false);
  const [sentOrder, setSentOrder] = useState<{
    order_id: string;
    order_number: string;
    total: number;
    status: string;
    pix: { qrcode: string; payload: string } | null;
    card: { init_point: string } | null;
  } | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(API_BASE + "/storefront/" + slug + "/studio/products")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStore(data as StorePayload);
        const pm = data.payment?.has_pix ? "pix" : data.payment?.has_card ? "card" : data.payment?.pay_on_delivery_enabled ? "on_delivery" : null;
        setPaymentMethod(pm);
      })
      .catch((e) => setError(e?.message || "Erro ao carregar loja"))
      .finally(() => setLoading(false));
  }, [slug]);

  const cartSubtotal = useMemo(
    () => cart.reduce((s, l) => s + lineTotal(l), 0),
    [cart]
  );

  // Preço atual sendo configurado (com deltas live)
  const configuringUnitPrice = useMemo(() => {
    if (!activeProduct) return 0;
    return Number(activeProduct.price) + choicesDelta(activeProduct.customization_config, editingValues);
  }, [activeProduct, editingValues]);

  function openConfigure(product: StudioStoreProduct) {
    setActiveProduct(product);
    setEditingLineId(null);
    const initial: Record<string, any> = {};
    const cfg = product.customization_config;
    if (cfg?.fields) {
      for (const f of cfg.fields) {
        if (f.type === "color" && f.config.colors?.length) {
          initial[f.id] = f.config.colors[0];
        }
      }
    }
    setEditingValues(initial);
    setEditingQty(1);
    setStage("configure");
  }

  function editCartLine(line: CartLine) {
    setActiveProduct(line.product);
    setEditingLineId(line.lineId);
    setEditingValues(line.values);
    setEditingQty(line.qty);
    setStage("configure");
  }

  function commitConfigure() {
    if (!activeProduct) return;
    const cfg = activeProduct.customization_config;
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
      setCart((prev) => [...prev, { lineId, product: activeProduct, qty: editingQty, values: editingValues }]);
    }
    setActiveProduct(null);
    setEditingLineId(null);
    setStage("list");
  }

  function removeCartLine(lineId: string) {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  async function submitOrder() {
    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Nome e telefone obrigatorios");
      return;
    }
    if (cart.length === 0) {
      setError("Carrinho vazio");
      return;
    }
    if (deliveryType === "delivery" && !addressStreet.trim()) {
      setError("Informe o endereco de entrega");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const body = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || null,
        delivery_type: deliveryType,
        payment_method: paymentMethod || undefined,
        notes: notes.trim() || null,
        items: cart.map((l) => ({
          product_id: l.product.id,
          quantity: l.qty,
          customization: l.values,
        })),
        address_zip: addressZip.replace(/\D/g, "") || null,
        address_street: addressStreet.trim() || null,
        address_number: addressNumber.trim() || null,
        address_neighborhood: addressNeigh.trim() || null,
        address_city: addressCity.trim() || null,
        address_state: addressState.trim().toUpperCase() || null,
      };
      const res = await fetch(API_BASE + "/storefront/" + slug + "/studio/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSentOrder(data);
      setStage("sent");
      setCart([]);
      if (data.card?.init_point && Platform.OS === "web" && typeof window !== "undefined") {
        setTimeout(() => { window.location.href = data.card.init_point; }, 800);
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar pedido");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Center><ActivityIndicator color={T.primary} size="large" /></Center>;
  if (error && !store)
    return (
      <Center>
        <Text style={{ fontSize: 36 }}>!</Text>
        <Text style={{ color: T.ink, fontWeight: "700", marginTop: 12 }}>{error}</Text>
      </Center>
    );
  if (!store) return null;

  // ─── STAGE: SENT ─────────────────────────────────────────────
  if (stage === "sent" && sentOrder) {
    const rev = store.revisions;
    const slaDays = store.sla.total_estimate_days;
    return (
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ padding: 24, paddingBottom: 40, alignItems: "center", minHeight: "100%" as any }}>
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
          Pedido enviado!
        </Text>
        <Text style={{ fontSize: 13, color: T.ink3, marginTop: 6, textAlign: "center", maxWidth: 320 }}>
          {sentOrder.pix
            ? "Pague o Pix abaixo. Depois disso, a loja inicia a arte e envia mockup pra aprovação no WhatsApp."
            : sentOrder.card
            ? "Redirecionando ao pagamento com cartão..."
            : "A loja confirmará seu pedido em breve por WhatsApp."}
        </Text>

        <View
          style={{
            backgroundColor: T.card, borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: T.border,
            alignItems: "center", gap: 6, minWidth: 260, marginTop: 16,
          }}
        >
          <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Pedido</Text>
          <Text style={{ fontSize: 18, color: T.ink, fontWeight: "800" }}>#{sentOrder.order_number}</Text>
          <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase", marginTop: 8 }}>Total</Text>
          <Text style={{ fontSize: 26, color: T.primary, fontWeight: "800" }}>
            R$ {Number(sentOrder.total).toFixed(2)}
          </Text>
          <Text style={{ fontSize: 11, color: T.accent, fontWeight: "700", marginTop: 8 }}>
            Aguardando produção da arte
          </Text>
        </View>

        {sentOrder.pix && (
          <View style={{ marginTop: 16, maxWidth: 320, gap: 8 }}>
            <Text style={{ fontSize: 11, color: T.ink3, textAlign: "center" }}>Pix copia-e-cola</Text>
            <Text
              style={{
                fontSize: 11, color: T.ink, fontFamily: Platform.OS === "web" ? "monospace" : undefined,
                padding: 10, backgroundColor: T.bg, borderRadius: 8, borderWidth: 1, borderColor: T.border,
              }}
              numberOfLines={4}
            >
              {sentOrder.pix.payload}
            </Text>
          </View>
        )}

        {/* Próximos passos — Studio-specific */}
        <View
          style={{
            backgroundColor: T.card, borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: T.border,
            marginTop: 20, maxWidth: 380, width: "100%",
          }}
        >
          <Text style={{ fontSize: 11, color: T.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
            Próximos passos
          </Text>
          <NextStep n={1} title="A loja recebe seu pedido" desc="Tudo que você personalizou já chegou. A produção entra na fila." />
          <NextStep n={2} title="Arte é preparada" desc={`Em até ${slaDays} ${slaDays === 1 ? "dia útil" : "dias úteis"} a loja gera o mockup digital do seu pedido.`} />
          <NextStep n={3} title="Você aprova pelo WhatsApp" desc="A loja te envia o mockup pra aprovar. Se quiser ajustes, é só pedir." />
          <NextStep n={4} title="Produção e entrega" desc="Após aprovado, vai pra produção. Entrega/retirada conforme combinado." last />
        </View>

        {/* Política de revisões — só se loja configurou */}
        {(rev.max_included > 0 || rev.policy_text) && (
          <View
            style={{
              backgroundColor: T.bg, borderRadius: 12, padding: 14,
              borderWidth: 1, borderColor: T.border,
              marginTop: 12, maxWidth: 380, width: "100%",
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 11, color: T.ink3, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" }}>
              Política de revisões
            </Text>
            {rev.max_included > 0 && (
              <Text style={{ fontSize: 12, color: T.ink2, lineHeight: 17 }}>
                <Text style={{ fontWeight: "800", color: T.primary }}>{rev.max_included}</Text>
                {" "}revis{rev.max_included === 1 ? "ão" : "ões"} grát{rev.max_included === 1 ? "is" : "is"} no mockup.
                {rev.extra_price > 0 && (
                  <>
                    {" "}Revisão extra: <Text style={{ fontWeight: "800", color: T.accent }}>R$ {rev.extra_price.toFixed(2)}</Text>.
                  </>
                )}
              </Text>
            )}
            {rev.policy_text && (
              <Text style={{ fontSize: 11.5, color: T.ink3, lineHeight: 16, fontStyle: "italic" }}>
                {rev.policy_text}
              </Text>
            )}
          </View>
        )}

        <Pressable
          onPress={() => { setStage("list"); setSentOrder(null); }}
          style={{
            backgroundColor: T.primary, paddingHorizontal: 24, paddingVertical: 12,
            borderRadius: 10, marginTop: 20,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>+ Personalizar outro</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ─── STAGE: CONFIGURE ────────────────────────────────────────
  if (stage === "configure" && activeProduct) {
    const cfg = activeProduct.customization_config;
    const hasDelta = configuringUnitPrice !== Number(activeProduct.price);
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View
          style={{
            backgroundColor: T.card,
            paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: T.border,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}
        >
          <Pressable onPress={() => { setStage("list"); setActiveProduct(null); setError(null); }}>
            <Text style={{ fontSize: 22, color: T.ink2 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Personalize</Text>
            <Text style={{ fontSize: 17, fontWeight: "800", color: T.ink }}>{activeProduct.name}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: T.primary }}>
              R$ {configuringUnitPrice.toFixed(2)}
            </Text>
            {hasDelta && (
              <Text style={{ fontSize: 9.5, color: T.ink3, marginTop: 1 }}>
                base R$ {Number(activeProduct.price).toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
          <View style={{ alignItems: "center" }}>
            <PersonalizationPreview
              config={cfg}
              values={editingValues}
              size={Math.min(320, Platform.OS === "web" ? 320 : 280)}
              productName={activeProduct.name}
              showLabel={false}
            />
          </View>

          {cfg?.fields?.map((f) => (
            <FieldEditor
              key={f.id}
              field={f}
              value={editingValues[f.id]}
              templates={activeProduct.templates}
              slug={slug}
              onChange={(v) => setEditingValues((prev) => ({ ...prev, [f.id]: v }))}
            />
          ))}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: T.ink, fontWeight: "700" }}>Quantidade</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => setEditingQty(Math.max(1, editingQty - 1))} style={qtyBtn}>
                <Text style={qtyTxt}>−</Text>
              </Pressable>
              <Text style={{ minWidth: 30, textAlign: "center", color: T.ink, fontWeight: "800", fontSize: 16 }}>
                {editingQty}
              </Text>
              <Pressable onPress={() => setEditingQty(editingQty + 1)} style={qtyBtn}>
                <Text style={qtyTxt}>+</Text>
              </Pressable>
            </View>
          </View>

          {error && (
            <Text style={{ fontSize: 12, color: T.red, textAlign: "center" }}>{error}</Text>
          )}
        </ScrollView>

        <View style={{ backgroundColor: T.card, padding: 14, borderTopWidth: 1, borderTopColor: T.border }}>
          <Pressable
            onPress={commitConfigure}
            style={{ backgroundColor: T.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
              {editingLineId ? "Atualizar" : "Adicionar"} • R$ {(configuringUnitPrice * editingQty).toFixed(2)}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── STAGE: CHECKOUT ─────────────────────────────────────────
  if (stage === "checkout") {
    const sendDisabled = sending || cart.length === 0 || !customerName.trim() || !customerPhone.trim();
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View
          style={{
            backgroundColor: T.card,
            paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: T.border,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}
        >
          <Pressable onPress={() => setStage("list")}>
            <Text style={{ fontSize: 22, color: T.ink2 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Finalizar</Text>
            <Text style={{ fontSize: 17, fontWeight: "800", color: T.ink }}>Seu pedido</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 140 }}>
          <Text style={sectionLabel}>Itens personalizados</Text>
          {cart.map((l) => {
            const unit = lineUnitPrice(l);
            const hasDelta = unit !== Number(l.product.price);
            return (
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
                    Qtd {l.qty} · R$ {lineTotal(l).toFixed(2)}
                  </Text>
                  {hasDelta && (
                    <Text style={{ fontSize: 10, color: T.accent, marginTop: 1 }}>
                      inclui R$ {(unit - Number(l.product.price)).toFixed(2)} por opções
                    </Text>
                  )}
                </View>
                <View style={{ gap: 6 }}>
                  <Pressable onPress={() => editCartLine(l)} style={editChip}>
                    <Text style={editChipTxt}>Editar</Text>
                  </Pressable>
                  <Pressable onPress={() => removeCartLine(l.lineId)} style={removeChip}>
                    <Text style={removeChipTxt}>Remover</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <Text style={sectionLabel}>Seus dados</Text>
          <FInput v={customerName} on={setCustomerName} ph="Nome *" />
          <FInput v={customerPhone} on={(v) => setCustomerPhone(maskPhone(v))} ph="WhatsApp *" kb="phone-pad" />
          <FInput v={customerEmail} on={setCustomerEmail} ph="E-mail (opcional)" kb="email-address" />

          {store.payment.pay_on_delivery_enabled || store.payment.has_pix || store.payment.has_card ? (
            <>
              <Text style={sectionLabel}>Retirada ou entrega?</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setDeliveryType("pickup")}
                  style={[chip, deliveryType === "pickup" && chipActive]}
                >
                  <Text style={[chipTxt, deliveryType === "pickup" && chipTxtActive]}>Retirar na loja</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDeliveryType("delivery")}
                  style={[chip, deliveryType === "delivery" && chipActive]}
                >
                  <Text style={[chipTxt, deliveryType === "delivery" && chipTxtActive]}>Receber em casa</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {deliveryType === "delivery" && (
            <>
              <Text style={sectionLabel}>Endereço</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <FInput v={addressStreet} on={setAddressStreet} ph="Rua" flex={3} />
                <FInput v={addressNumber} on={setAddressNumber} ph="Nº" flex={1} />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <FInput v={addressNeigh} on={setAddressNeigh} ph="Bairro" flex={2} />
                <FInput v={addressCity} on={setAddressCity} ph="Cidade" flex={2} />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <FInput v={addressState} on={(v) => setAddressState(v.toUpperCase().slice(0, 2))} ph="UF" flex={1} />
                <FInput v={addressZip} on={setAddressZip} ph="CEP" flex={2} kb="numeric" />
              </View>
            </>
          )}

          <Text style={sectionLabel}>Pagamento</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {store.payment.has_pix && (
              <Pressable onPress={() => setPaymentMethod("pix")} style={[chip, paymentMethod === "pix" && chipActive]}>
                <Text style={[chipTxt, paymentMethod === "pix" && chipTxtActive]}>Pix</Text>
              </Pressable>
            )}
            {store.payment.has_card && (
              <Pressable onPress={() => setPaymentMethod("card")} style={[chip, paymentMethod === "card" && chipActive]}>
                <Text style={[chipTxt, paymentMethod === "card" && chipTxtActive]}>Cartão</Text>
              </Pressable>
            )}
            {store.payment.pay_on_delivery_enabled && (
              <Pressable
                onPress={() => setPaymentMethod("on_delivery")}
                style={[chip, paymentMethod === "on_delivery" && chipActive]}
              >
                <Text style={[chipTxt, paymentMethod === "on_delivery" && chipTxtActive]}>
                  Pagar {deliveryType === "delivery" ? "na entrega" : "na retirada"}
                </Text>
              </Pressable>
            )}
          </View>

          <Text style={sectionLabel}>Observação</Text>
          <FInput v={notes} on={setNotes} ph="Algo importante pra loja saber?" multi />

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

          <Text style={{ fontSize: 11, color: T.ink3, textAlign: "center", marginTop: 4 }}>
            Prazo de produção estimado: ~{store.sla.total_estimate_days} {store.sla.total_estimate_days === 1 ? "dia útil" : "dias úteis"}
          </Text>

          {error && <Text style={{ fontSize: 12, color: T.red, textAlign: "center" }}>{error}</Text>}
        </ScrollView>

        <View style={{ backgroundColor: T.card, padding: 14, borderTopWidth: 1, borderTopColor: T.border }}>
          <Pressable
            onPress={submitOrder}
            disabled={sendDisabled}
            style={{
              backgroundColor: T.primary,
              paddingVertical: 14, borderRadius: 10, alignItems: "center",
              opacity: sendDisabled ? 0.4 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
              {sending ? "Enviando..." : "Enviar pedido • R$ " + cartSubtotal.toFixed(2)}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── STAGE: LIST ─────────────────────────────────────────────
  const accent = store.site.accent_color || T.accent;
  const primary = store.site.primary_color || T.primary;
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View
        style={[
          { padding: 24, paddingBottom: 28, backgroundColor: primary },
          Platform.OS === "web"
            ? ({ background: "linear-gradient(135deg, " + primary + ", " + accent + ")" } as any)
            : {},
        ]}
      >
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Aura Studio · Personalizados
        </Text>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{store.site.name}</Text>
        {store.site.tagline ? (
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 6 }}>{store.site.tagline}</Text>
        ) : null}
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 10 }}>
          Prazo de produção: ~{store.sla.total_estimate_days}{" "}
          {store.sla.total_estimate_days === 1 ? "dia útil" : "dias úteis"}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: cart.length > 0 ? 110 : 30 }}
      >
        {store.products.length === 0 ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 36 }}>🎨</Text>
            <Text style={{ color: T.ink, fontWeight: "700", marginTop: 12, textAlign: "center" }}>
              Esta loja ainda não tem produtos personalizáveis publicados.
            </Text>
            <Text style={{ color: T.ink3, fontSize: 12, marginTop: 6, textAlign: "center" }}>
              Volte em breve!
            </Text>
          </View>
        ) : (
          store.products.map((p) => (
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
                size={72}
                showLabel={false}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: T.ink, fontWeight: "700" }}>{p.name}</Text>
                {p.description ? (
                  <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }} numberOfLines={2}>
                    {p.description}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 14, color: primary, fontWeight: "800", marginTop: 4 }}>
                  A partir de R$ {Number(p.price).toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  alignSelf: "center", paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: 999, backgroundColor: accent,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>Personalizar →</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {cart.length > 0 && (
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
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                {cart.reduce((s, l) => s + l.qty, 0)}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>itens personalizados</Text>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>R$ {cartSubtotal.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Finalizar →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ============================================================
// Field editor — renderiza UI conforme tipo
// ============================================================
function FieldEditor({
  field, value, templates, slug, onChange,
}: {
  field: CustomizationField;
  value: any;
  templates: Array<{ id: string; image_url: string; thumb_url: string | null; name: string }>;
  slug: string;
  onChange: (v: any) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
          placeholder={field.config.fonts?.[0] ? "Texto..." : "Digite aqui"}
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
    const choices = field.config.choices || [];
    // Se choices tem price_delta, prefere choices; senão usa colors raw
    return (
      <View>
        <Text style={sectionLabel}>
          {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {colors.map((c) => {
            const choice = choices.find((ch: any) => ch.value === c || ch.label === c);
            const delta = choice?.price_delta;
            const selected = value === c;
            return (
              <View key={c} style={{ alignItems: "center", gap: 2 }}>
                <Pressable
                  onPress={() => onChange(c)}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: c,
                    borderWidth: selected ? 3 : 1,
                    borderColor: selected ? T.primary : T.border,
                  }}
                />
                {typeof delta === "number" && delta !== 0 && (
                  <Text style={{ fontSize: 9, fontWeight: "700", color: selected ? T.accent : T.ink3 }}>
                    {delta > 0 ? "+" : ""}R$ {delta.toFixed(2)}
                  </Text>
                )}
              </View>
            );
          })}
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
          {choices.map((c: any) => {
            const selected = value === c.value;
            const delta = typeof c.price_delta === "number" ? c.price_delta : 0;
            return (
              <Pressable
                key={c.value}
                onPress={() => onChange(c.value)}
                style={[chip, selected && chipActive, { alignItems: "center" }]}
              >
                <Text style={[chipTxt, selected && chipTxtActive]}>{c.label}</Text>
                {delta !== 0 && (
                  <Text
                    style={{
                      fontSize: 9.5, fontWeight: "700",
                      color: selected ? "rgba(255,255,255,0.8)" : T.accent,
                      marginTop: 2,
                    }}
                  >
                    {delta > 0 ? "+" : ""}R$ {delta.toFixed(2)}
                  </Text>
                )}
              </Pressable>
            );
          })}
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
          <Text style={{ fontSize: 12, color: T.ink3, fontStyle: "italic" }}>
            Loja não cadastrou templates ainda.
          </Text>
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
                  // @ts-ignore - native img on web
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
    // Upload via file input (web). Native: cliente cola URL manual (futuro: expo-image-picker)
    async function handleFileSelect(ev: any) {
      const file: File | undefined = ev?.target?.files?.[0];
      if (!file) return;
      const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowed.includes(file.type)) {
        setUploadError("Aceitos: PNG, JPG, WEBP");
        return;
      }
      if (file.size > (field.config.max_mb || 15) * 1024 * 1024) {
        setUploadError(`Arquivo grande demais (max ${field.config.max_mb || 15}MB)`);
        return;
      }
      setUploading(true);
      setUploadError(null);
      try {
        const reader = new FileReader();
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
          reader.readAsDataURL(file);
        });
        const res = await fetch(API_BASE + "/storefront/" + slug + "/studio/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_base64: dataUrl.split(",")[1],
            content_type: file.type,
            filename: file.name,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        onChange(data.url);
        // limpa o input pra permitir re-upload do mesmo arquivo
        try { ev.target.value = ""; } catch (_) {}
      } catch (e: any) {
        setUploadError(e?.message || "Erro no upload");
      } finally {
        setUploading(false);
      }
    }

    return (
      <View>
        <Text style={sectionLabel}>
          {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
        </Text>
        {value ? (
          <View style={{ gap: 8 }}>
            {Platform.OS === "web" ? (
              // @ts-ignore - native img on web
              <img
                src={String(value)}
                alt="preview"
                style={{
                  width: "100%", maxHeight: 200, objectFit: "contain",
                  borderRadius: 8, border: "1px solid " + T.border,
                  backgroundColor: T.bg,
                } as any}
              />
            ) : (
              <Text style={{ fontSize: 12, color: T.green }}>Imagem enviada ✓</Text>
            )}
            <Pressable
              onPress={() => { onChange(""); setUploadError(null); }}
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                backgroundColor: "#fee2e2",
              }}
            >
              <Text style={{ color: T.red, fontSize: 11, fontWeight: "700" }}>Remover</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {Platform.OS === "web" ? (
              <View>
                {/* @ts-ignore - native label/input on web */}
                <label
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", gap: 6,
                    padding: 20, backgroundColor: T.card,
                    border: "2px dashed " + T.border, borderRadius: 10,
                    cursor: uploading ? "wait" : "pointer",
                    opacity: uploading ? 0.6 : 1,
                  } as any}
                >
                  <Text style={{ fontSize: 24 }}>{uploading ? "⏳" : "📷"}</Text>
                  <Text style={{ fontSize: 13, color: T.ink, fontWeight: "700" }}>
                    {uploading ? "Enviando..." : "Escolher foto"}
                  </Text>
                  <Text style={{ fontSize: 11, color: T.ink3 }}>PNG, JPG ou WEBP até {field.config.max_mb || 15}MB</Text>
                  {/* @ts-ignore */}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    style={{ display: "none" } as any}
                  />
                </label>
                <Text style={{ fontSize: 10, color: T.ink3, marginTop: 6, textAlign: "center" }}>
                  ou cole o link da imagem abaixo
                </Text>
                <TextInput
                  value={String(value || "")}
                  onChangeText={onChange}
                  placeholder="https://..."
                  placeholderTextColor={T.ink4}
                  style={{
                    backgroundColor: T.card, color: T.ink, padding: 10,
                    borderRadius: 8, fontSize: 12,
                    borderWidth: 1, borderColor: T.border,
                    marginTop: 4,
                  }}
                />
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, color: T.ink3 }}>
                  Cole o link da imagem (ou envie por WhatsApp depois)
                </Text>
                <TextInput
                  value={String(value || "")}
                  onChangeText={onChange}
                  placeholder="https://..."
                  placeholderTextColor={T.ink4}
                  style={{
                    backgroundColor: T.card, color: T.ink, padding: 12,
                    borderRadius: 8, fontSize: 13,
                    borderWidth: 1, borderColor: T.border,
                  }}
                />
              </View>
            )}
            {uploadError && (
              <Text style={{ fontSize: 11, color: T.red }}>{uploadError}</Text>
            )}
          </View>
        )}
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

function NextStep({ n, title, desc, last }: { n: number; title: string; desc: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingBottom: last ? 0 : 12 }}>
      <View
        style={{
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: T.primary,
          alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12.5, color: T.ink, fontWeight: "800" }}>{title}</Text>
        <Text style={{ fontSize: 11.5, color: T.ink3, marginTop: 2, lineHeight: 16 }}>{desc}</Text>
      </View>
    </View>
  );
}

function FInput({
  v, on, ph, kb, multi, flex,
}: {
  v: string; on: (s: string) => void; ph: string;
  kb?: any; multi?: boolean; flex?: number;
}) {
  return (
    <TextInput
      value={v}
      onChangeText={on}
      placeholder={ph}
      placeholderTextColor={T.ink4}
      keyboardType={kb}
      multiline={multi}
      style={{
        flex: flex ?? 1, backgroundColor: T.card, color: T.ink, padding: 12,
        borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: T.border,
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
