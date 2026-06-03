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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 180 }}>
        <Text style={sectionLabel}>Itens personalizados</Text>
        <CartItemList sf={sf} />

        <Text style={sectionLabel}>Seus dados</Text>
        <FInput v={sf.customerName} on={sf.setCustomerName} ph="Nome *" />
        <FInput v={sf.customerPhone} on={sf.setCustomerPhone} ph="WhatsApp *" kb="phone-pad" />
        <FInput v={sf.customerEmail} on={sf.setCustomerEmail} ph="E-mail (opcional)" kb="email-address" />

        {(sf.store.payment.pay_on_delivery_enabled || sf.store.payment.has_pix || sf.store.payment.has_card) ? (
          <>
            <Text style={sectionLabel}>Retirada ou entrega?</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => sf.setDeliveryType("pickup")}
                style={[chip, sf.deliveryType === "pickup" && chipActive]}
              >
                <Text style={[chipTxt, sf.deliveryType === "pickup" && chipTxtActive]}>Retirar na loja</Text>
              </Pressable>
              <Pressable
                onPress={() => sf.setDeliveryType("delivery")}
                style={[chip, sf.deliveryType === "delivery" && chipActive]}
              >
                <Text style={[chipTxt, sf.deliveryType === "delivery" && chipTxtActive]}>Receber em casa</Text>
              </Pressable>
            </View>
          </>
        ) : null}

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
          <View style={{ height: 1, backgroundColor: T.border, marginVertical: 4 }} />
          <TotalRow l="Total" v={sf.cartSubtotal} big />
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
            {sf.sending ? "Enviando..." : "Enviar pedido • R$ " + sf.cartSubtotal.toFixed(2)}
          </Text>
        </Pressable>
      </View>

      <PoweredByAura />
    </View>
  );
}
