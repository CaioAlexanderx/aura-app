// ============================================================
// AURA STUDIO · PDV — carrinho lateral (Fase 6)
// Head (total + sub-stats) · body (itens c/ qty/editar/remover) ·
// foot (Orçamento + Fechar venda). Empty state branded.
// ============================================================
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import type { CartLine } from "./types";
import { SumRow, money } from "./ui";
import { Ic } from "./icons";

function CartItem({
  t, line, onSetQty, onRemove, onEdit,
}: {
  t: StudioPalette; line: CartLine;
  onSetQty: (lineId: string, d: number) => void; onRemove: (lineId: string) => void; onEdit: (line: CartLine) => void;
}) {
  const p = line.product;
  const custom = p.is_personalizable;
  return (
    <View style={{ flexDirection: "row", gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: t.ink5, backgroundColor: t.paperCardElev }}>
      {custom ? (
        <PersonalizationPreview config={p.customization_config} values={line.values} size={46} showLabel={false} />
      ) : (
        <View style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: t.ink3 }}>{(p.name || "?").charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12.5, color: t.ink, fontWeight: "700" }} numberOfLines={1}>{p.name}</Text>
        {custom && (
          <Pressable onPress={() => onEdit(line)} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Ic name="edit" size={11} color={t.accentInk} />
            <Text style={{ fontSize: 10.5, color: t.accentInk, fontWeight: "700" }}>Editar arte</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: t.ink5, overflow: "hidden" }}>
            <Pressable onPress={() => onSetQty(line.lineId, -1)} style={qtyBtn(t)}><Ic name="minus" size={13} color={t.ink2} /></Pressable>
            <Text style={{ minWidth: 26, textAlign: "center", fontSize: 12.5, fontWeight: "800", color: t.ink }}>{line.qty}</Text>
            <Pressable onPress={() => onSetQty(line.lineId, 1)} style={qtyBtn(t)}><Ic name="plus" size={13} color={t.ink2} /></Pressable>
          </View>
          <Text style={{ flex: 1, fontSize: 12.5, color: t.ink, fontWeight: "700", textAlign: "right" }}>R$ {money(p.price * line.qty)}</Text>
          <Pressable onPress={() => onRemove(line.lineId)} style={{ padding: 4 }}><Ic name="trash" size={15} color={t.danger} /></Pressable>
        </View>
      </View>
    </View>
  );
}
const qtyBtn = (t: StudioPalette) => ({ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: t.bgSoft, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) });

export function CartSidebar({
  t, cart, subtotal, count, customCount, payLabel, onSetQty, onRemove, onEdit, onQuote, onCheckout,
}: {
  t: StudioPalette; cart: CartLine[]; subtotal: number; count: number; customCount: number; payLabel: string;
  onSetQty: (lineId: string, d: number) => void; onRemove: (lineId: string) => void; onEdit: (line: CartLine) => void;
  onQuote: () => void; onCheckout: () => void;
}) {
  const has = cart.length > 0;
  return (
    <View style={{ flex: 1, backgroundColor: t.paperCard, borderLeftWidth: 1, borderLeftColor: t.ink5 }}>
      {/* head */}
      <View style={{ padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: t.ink5 }}>
        <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" }}>Total da venda</Text>
        <Text style={{ fontSize: 30, color: t.ink, fontWeight: "800" }}>
          <Text style={{ fontSize: 16, color: t.ink3 }}>R$ </Text>{money(subtotal)}
        </Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          {[["Itens", String(count)], ["Personalizados", String(customCount)], ["Pagamento", payLabel]].map(([k, v]) => (
            <View key={k}>
              <Text style={{ fontSize: 10, color: t.ink3, fontWeight: "600" }}>{k}</Text>
              <Text style={{ fontSize: 13, color: t.ink, fontWeight: "800" }} numberOfLines={1}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* body */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {!has ? (
          <View style={{ alignItems: "center", gap: 8, paddingVertical: 40 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.bgSoft, alignItems: "center", justifyContent: "center" }}>
              <Ic name="cart" size={26} color={t.ink3} />
            </View>
            <Text style={{ fontSize: 13, color: t.ink2, fontWeight: "700" }}>Carrinho vazio</Text>
            <Text style={{ fontSize: 11.5, color: t.ink3 }}>Toque em um produto para começar</Text>
          </View>
        ) : (
          cart.map((l) => (
            <CartItem key={l.lineId} t={t} line={l} onSetQty={onSetQty} onRemove={onRemove} onEdit={onEdit} />
          ))
        )}
      </ScrollView>

      {/* foot */}
      <View style={{ padding: 14, gap: 8, borderTopWidth: 1, borderTopColor: t.ink5 }}>
        <SumRow t={t} label="Subtotal" value={subtotal} />
        <SumRow t={t} label="Total" value={subtotal} big />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Pressable
            onPress={onQuote} disabled={!has}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: has ? t.accentInk : t.ink5, opacity: has ? 1 : 0.5, ...(Platform.OS === "web" ? ({ cursor: has ? "pointer" : "not-allowed" } as any) : {}) }}
          >
            <Ic name="file_text" size={16} color={has ? t.accentInk : t.ink3} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: has ? t.accentInk : t.ink3 }}>Orçamento</Text>
          </Pressable>
          <Pressable
            onPress={onCheckout} disabled={!has}
            style={{ flex: 1.3, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: has ? t.primary : t.ink5, opacity: has ? 1 : 0.6, ...(Platform.OS === "web" ? ({ cursor: has ? "pointer" : "not-allowed" } as any) : {}) }}
          >
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>Fechar venda</Text>
            <Ic name="arrow_right" size={16} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
