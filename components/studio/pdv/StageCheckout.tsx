// ============================================================
// AURA STUDIO · PDV — checkout (Fase 6). Tela cheia: itens + cliente
// (opcional) + pagamento + total. Cliente nunca obrigatório.
// ============================================================
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { maskPhone } from "@/utils/masks";
import type { CartLine } from "./types";
import { PAY_METHODS } from "./types";
import { FInput, SumRow, money } from "./ui";
import { Ic } from "./icons";

export function StageCheckout({
  t, cart, subtotal, count, customCount,
  customer, setCustomer, phone, setPhone, pay, setPay, notes, setNotes,
  sending, error, onBack, onFinalize,
}: {
  t: StudioPalette; cart: CartLine[]; subtotal: number; count: number; customCount: number;
  customer: string; setCustomer: (s: string) => void; phone: string; setPhone: (s: string) => void;
  pay: string; setPay: (s: string) => void; notes: string; setNotes: (s: string) => void;
  sending: boolean; error: string | null; onBack: () => void; onFinalize: () => void;
}) {
  const hasCustom = customCount > 0;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, maxWidth: 920, alignSelf: "center", width: "100%" }}>
        <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <Ic name="arrow_left" size={17} color={t.ink2} />
          <Text style={{ fontSize: 13, color: t.ink2, fontWeight: "700" }}>Voltar ao caixa</Text>
        </Pressable>
        <Text style={{ fontSize: 26, color: t.ink, fontWeight: "800" }}>Fechar venda</Text>
        <Text style={{ fontSize: 13, color: t.ink3, marginTop: 2, marginBottom: 16 }}>
          {count} {count === 1 ? "item" : "itens"} · {hasCustom ? `${customCount} personalizados` : "sem personalização"}
        </Text>

        {/* Itens */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Itens da venda</Text>
          {cart.map((l) => (
            <View key={l.lineId} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line || t.ink5 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: l.product.is_personalizable ? t.accentSoft : t.bgSoft, borderWidth: 1, borderColor: t.ink5, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: l.product.is_personalizable ? t.accentInk : t.ink3 }}>{(l.product.name || "?").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, color: t.ink, fontWeight: "700" }} numberOfLines={1}>{l.product.name}</Text>
                <Text style={{ fontSize: 11, color: t.ink3 }}>Qtd {l.qty} · R$ {money(l.product.price)} un{l.product.is_personalizable ? " · personalizado" : ""}</Text>
              </View>
              <Text style={{ fontSize: 13, color: t.ink, fontWeight: "700" }}>R$ {money(l.product.price * l.qty)}</Text>
            </View>
          ))}
          <View style={{ marginTop: 12 }}><SumRow t={t} label="Total a pagar" value={subtotal} big /></View>
        </View>

        {/* Cliente (opcional) */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Cliente</Text>
          <Text style={{ fontSize: 12, color: t.ink3, marginBottom: 10 }}>{hasCustom ? "Vincule para acompanhar a arte por WhatsApp (opcional)" : "Opcional para esta venda"}</Text>
          <View style={{ gap: 10 }}>
            <FInput t={t} value={customer} onChangeText={setCustomer} placeholder="Nome do cliente" />
            <FInput t={t} value={phone} onChangeText={(v) => setPhone(maskPhone(v))} placeholder="WhatsApp (00) 00000-0000" keyboardType="phone-pad" />
          </View>
        </View>

        {/* Pagamento */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Pagamento</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {PAY_METHODS.map((m) => {
              const active = pay === m.id;
              return (
                <Pressable key={m.id} onPress={() => setPay(m.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: active ? t.primarySoft : t.bgSoft, borderWidth: 1, borderColor: active ? t.primary : t.ink5, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}>
                  <Ic name={m.icon} size={18} color={active ? t.primary : t.ink3} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: active ? t.primary : t.ink2 }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Observação */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Observação</Text>
          <FInput t={t} value={notes} onChangeText={setNotes} placeholder="Algo importante sobre o pedido?" multiline />
        </View>

        {error ? <Text style={{ fontSize: 12.5, color: t.danger, textAlign: "center", marginTop: 6 }}>{error}</Text> : null}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: t.paperCardElev, borderTopWidth: 1, borderTopColor: t.ink5 }}>
        <Pressable
          onPress={onFinalize} disabled={sending || cart.length === 0}
          style={{ maxWidth: 920, alignSelf: "center", width: "100%", paddingVertical: 15, borderRadius: 12, backgroundColor: t.primary, alignItems: "center", opacity: sending || cart.length === 0 ? 0.5 : 1, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>{sending ? "Registrando…" : `Fechar venda · R$ ${money(subtotal)}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const panel = (t: StudioPalette) => ({ backgroundColor: t.paperCard, borderRadius: 14, borderWidth: 1, borderColor: t.ink5, padding: 16, marginBottom: 12 } as const);
const panelTitle = (t: StudioPalette) => ({ fontSize: 14, color: t.ink, fontWeight: "800", marginBottom: 8 } as const);
