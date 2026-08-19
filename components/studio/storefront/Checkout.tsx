// ============================================================
// components/studio/storefront/Checkout.tsx
// Stage="checkout": dados do cliente, endereço, pagamento,
// resumo do carrinho e botão "Enviar pedido".
// ============================================================
import { View, Text, Pressable, ScrollView } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { T, sectionLabel, chip, chipActive, chipTxt, chipTxtActive } from "./types";
import { CartItemList } from "./Cart";
import { FInput } from "./ui/FInput";
import { TotalRow } from "./ui/TotalRow";
import { PoweredByAura } from "./ui/PoweredByAura";

export function Checkout({ sf }: { sf: StorefrontState }) {
  if (!sf.store) return null;
  const sendDisabled =
    sf.sending || sf.cart.length === 0 || !sf.customerName.trim() || !sf.customerPhone.trim();

  // S8 — modalidades do config da loja. Sem o bloco `delivery` no payload
  // (backend anterior ao S8) cai no par de antes, que era o comportamento
  // fixo — assim uma loja em versão velha não fica sem opção nenhuma.
  const d = sf.store.delivery;
  const modalidades: Array<{ value: "pickup" | "delivery" | "courier"; label: string }> = [];
  if (!d || d.pickup_enabled) modalidades.push({ value: "pickup", label: "Retirar na loja" });
  if (!d || d.delivery_enabled) modalidades.push({ value: "delivery", label: "Receber em casa" });
  if (d?.courier_pickup_enabled) modalidades.push({ value: "courier", label: "Retirada por app" });

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
        <Pressable onPress={() => sf.goTo("list")}>
          <Text style={{ fontSize: 22, color: T.ink2 }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Finalizar</Text>
          <Text style={{ fontSize: 17, fontWeight: "800", color: T.ink }}>Seu pedido</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16, gap: 10, paddingBottom: 180,
          width: "100%", maxWidth: 720, alignSelf: "center",
        }}
      >
        <Text style={sectionLabel}>Itens personalizados</Text>
        <CartItemList sf={sf} />

        <Text style={sectionLabel}>Seus dados</Text>
        <FInput v={sf.customerName} on={sf.setCustomerName} ph="Nome *" />
        <FInput v={sf.customerPhone} on={sf.setCustomerPhone} ph="WhatsApp *" kb="phone-pad" />
        <FInput v={sf.customerEmail} on={sf.setCustomerEmail} ph="E-mail (opcional)" kb="email-address" />

        {/* S8 — as modalidades vêm do config da loja. Antes eram duas
            fixas, e uma loja com delivery_enabled=false oferecia "Receber
            em casa" para o cliente tomar 400 no fechamento. */}
        {modalidades.length > 0 ? (
          <>
            <Text style={sectionLabel}>Como você quer receber?</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {modalidades.map((m) => (
                <Pressable
                  key={m.value}
                  onPress={() => sf.setDeliveryType(m.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sf.deliveryType === m.value }}
                  style={[chip, sf.deliveryType === m.value && chipActive]}
                >
                  <Text style={[chipTxt, sf.deliveryType === m.value && chipTxtActive]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* S8 — quem vai buscar. Sem nome e placa a lojista entrega a arte
            de um cliente para o primeiro motoboy que citar o pedido. */}
        {sf.deliveryType === "courier" && (
          <>
            <Text style={sectionLabel}>Quem vai retirar</Text>
            <Text style={{ fontSize: 11, color: T.ink3, marginTop: -4 }}>
              Você chama o entregador pelo app e nos diz quem é. O frete é pago direto no aplicativo.
            </Text>
            <FInput v={sf.courierName} on={sf.setCourierName} ph="Nome do entregador *" />
            <FInput v={sf.courierPlate} on={sf.setCourierPlate} ph="Placa (ABC-1234) *" />
          </>
        )}

        {sf.deliveryType === "delivery" && (
          <>
            <Text style={sectionLabel}>Endereço</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <FInput v={sf.addressStreet} on={sf.setAddressStreet} ph="Rua" flex={3} />
              <FInput v={sf.addressNumber} on={sf.setAddressNumber} ph="Nº" flex={1} />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <FInput v={sf.addressNeigh} on={sf.setAddressNeigh} ph="Bairro" flex={2} />
              <FInput v={sf.addressCity} on={sf.setAddressCity} ph="Cidade" flex={2} />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <FInput v={sf.addressState} on={sf.setAddressState} ph="UF" flex={1} />
              <FInput v={sf.addressZip} on={sf.setAddressZip} ph="CEP" flex={2} kb="numeric" />
            </View>

            {/* S2 — frete cotado no servidor pelo CEP. A cotação é uma ação
                explícita: são 8 dígitos e o servidor geocodifica o CEP,
                então não vale disparar a cada tecla. */}
            <Pressable
              onPress={() => sf.quoteShipping()}
              disabled={sf.quotingShipping}
              accessibilityRole="button"
              style={[chip, { alignSelf: "flex-start", opacity: sf.quotingShipping ? 0.6 : 1 }]}
            >
              <Text style={chipTxt}>
                {sf.quotingShipping ? "Calculando frete..." : "Calcular frete"}
              </Text>
            </Pressable>

            {sf.shippingError ? (
              <Text style={{ fontSize: 12, color: T.red, fontWeight: "700" }}>{sf.shippingError}</Text>
            ) : sf.shippingQuote && typeof sf.shippingQuote.fee === "number" ? (
              <Text style={{ fontSize: 12, color: T.ink2 }}>
                {sf.shippingQuote.free_shipping
                  ? "Frete grátis para este CEP"
                  : "Frete: R$ " + sf.shippingQuote.fee.toFixed(2)}
                {sf.shippingQuote.eta ? " · " + sf.shippingQuote.eta : ""}
              </Text>
            ) : null}
          </>
        )}

        <Text style={sectionLabel}>Pagamento</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {sf.store.payment.has_pix && (
            <Pressable
              onPress={() => sf.setPaymentMethod("pix")}
              style={[chip, sf.paymentMethod === "pix" && chipActive]}
            >
              <Text style={[chipTxt, sf.paymentMethod === "pix" && chipTxtActive]}>Pix</Text>
            </Pressable>
          )}
          {sf.store.payment.has_card && (
            <Pressable
              onPress={() => sf.setPaymentMethod("card")}
              style={[chip, sf.paymentMethod === "card" && chipActive]}
            >
              <Text style={[chipTxt, sf.paymentMethod === "card" && chipTxtActive]}>Cartão</Text>
            </Pressable>
          )}
          {sf.store.payment.pay_on_delivery_enabled && (
            <Pressable
              onPress={() => sf.setPaymentMethod("on_delivery")}
              style={[chip, sf.paymentMethod === "on_delivery" && chipActive]}
            >
              <Text style={[chipTxt, sf.paymentMethod === "on_delivery" && chipTxtActive]}>
                Pagar {sf.deliveryType === "delivery" ? "na entrega" : "na retirada"}
              </Text>
            </Pressable>
          )}
        </View>

        <Text style={sectionLabel}>Observação</Text>
        <FInput v={sf.notes} on={sf.setNotes} ph="Algo importante pra loja saber?" multi />

        <View
          style={{
            backgroundColor: T.card, borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: T.border, gap: 4, marginTop: 6,
          }}
        >
          <TotalRow l="Subtotal" v={sf.cartSubtotal} />
          {/* S2 — o frete só entra na conta depois de cotado. Antes disso
              o total mostra o subtotal, sem inventar um valor. */}
          {sf.deliveryType === "delivery" && sf.shippingQuote && typeof sf.shippingQuote.fee === "number" ? (
            <TotalRow l="Frete" v={sf.shippingFee} />
          ) : null}
          <View style={{ height: 1, backgroundColor: T.border, marginVertical: 4 }} />
          <TotalRow l="Total" v={sf.cartTotal} big />
        </View>

        <Text style={{ fontSize: 11, color: T.ink3, textAlign: "center", marginTop: 4 }}>
          Prazo de produção estimado: ~{sf.store.sla.total_estimate_days}{" "}
          {sf.store.sla.total_estimate_days === 1 ? "dia útil" : "dias úteis"}
        </Text>

        {sf.error && (
          <Text style={{ fontSize: 12, color: T.red, textAlign: "center" }}>{sf.error}</Text>
        )}
      </ScrollView>

      <View style={{ backgroundColor: T.card, padding: 14, borderTopWidth: 1, borderTopColor: T.border }}>
        <Pressable
          onPress={sf.submitOrder}
          disabled={sendDisabled}
          style={{
            backgroundColor: T.primary,
            paddingVertical: 14, borderRadius: 10, alignItems: "center",
            opacity: sendDisabled ? 0.4 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
            {sf.sending ? "Enviando..." : "Enviar pedido • R$ " + sf.cartTotal.toFixed(2)}
          </Text>
        </Pressable>
      </View>

      <PoweredByAura />
    </View>
  );
}
