// ============================================================
// AURA STUDIO · PDV — carrinho lateral (Fase 6 + agent/pdv)
// Head (total + sub-stats) · body (itens c/ qty/editar/remover) ·
// foot (Orçamento + Fechar venda). Empty state branded.
//
// CHIP DE TIPO (agent/pdv):
//   kind='quick'        → chip "venda rápida" (fundo neutro t.bgSoft)
//   kind='personalizado'→ chip "personalizado" (fundo t.accentSoft)
//
// 05/06/2026 (paridade Negócio): quantidade digitável entre as setas +
// lápis de preço de venda por item (preenço de tabela riscado + desconto).
// ============================================================
import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import type { CartLine } from "./types";
import { SumRow, money } from "./ui";
import { Ic } from "./icons";
import { lineSalePrice, lineListPrice, lineDiscount } from "./checkoutMath";

/** Chip que indica a origem do item no carrinho. */
function KindChip({ t, kind }: { t: StudioPalette; kind: CartLine["kind"] }) {
  const isCustom = kind === "personalizado";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: isCustom ? t.accentSoft : t.bgSoft,
        borderWidth: 1,
        borderColor: isCustom ? t.accentInk : t.ink5,
        marginTop: 2,
      }}
    >
      {isCustom && <Ic name="sparkle" size={9} color={t.accentInk} />}
      <Text
        style={{
          fontSize: 9,
          fontWeight: "800",
          letterSpacing: 0.3,
          color: isCustom ? t.accentInk : t.ink3,
          textTransform: "uppercase",
        }}
      >
        {isCustom ? "personalizado" : "venda rápida"}
      </Text>
    </View>
  );
}

function CartItem({
  t,
  line,
  onSetQty,
  onSetQtyTo,
  onSetPrice,
  onRemove,
  onEdit,
}: {
  t: StudioPalette;
  line: CartLine;
  onSetQty: (lineId: string, d: number) => void;
  onSetQtyTo: (lineId: string, qty: number) => void;
  onSetPrice: (lineId: string, price: number) => void;
  onRemove: (lineId: string) => void;
  onEdit: (line: CartLine) => void;
}) {
  const p = line.product;
  const custom = p.is_personalizable;
  const list = lineListPrice(line);
  const sale = lineSalePrice(line);
  const disc = lineDiscount(line);

  const [editing, setEditing] = useState(false);
  const [priceText, setPriceText] = useState(sale.toFixed(2));
  const [qtyText, setQtyText] = useState(String(line.qty));

  useEffect(() => { setQtyText(String(line.qty)); }, [line.qty]);
  useEffect(() => { if (!editing) setPriceText(sale.toFixed(2)); }, [sale, editing]);

  function commitQty() {
    const n = parseInt((qtyText || "").replace(/[^0-9]/g, ""), 10);
    if (!n || n < 1) { setQtyText(String(line.qty)); return; }
    if (n !== line.qty) onSetQtyTo(line.lineId, n);
  }
  function commitPrice() {
    const v = parseFloat((priceText || "").replace(",", "."));
    if (isNaN(v) || v < 0) { setPriceText(sale.toFixed(2)); setEditing(false); return; }
    onSetPrice(line.lineId, v);
    setEditing(false);
  }

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: t.ink5,
        backgroundColor: t.paperCardElev,
      }}
    >
      {custom ? (
        <PersonalizationPreview
          config={p.customization_config}
          values={line.values}
          size={46}
          showLabel={false}
        />
      ) : (
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 10,
            backgroundColor: t.bgSoft,
            borderWidth: 1,
            borderColor: t.ink5,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", color: t.ink3 }}>
            {(p.name || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 12.5, color: t.ink, fontWeight: "700" }}
          numberOfLines={1}
        >
          {p.name}
        </Text>

        {/* chip de tipo */}
        <KindChip t={t} kind={line.kind} />

        {/* botão "Editar arte" só para itens personalizados */}
        {line.kind === "personalizado" && (
          <Pressable
            onPress={() => onEdit(line)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
            }}
          >
            <Ic name="edit" size={11} color={t.accentInk} />
            <Text
              style={{ fontSize: 10.5, color: t.accentInk, fontWeight: "700" }}
            >
              Editar arte
            </Text>
          </Pressable>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 6,
          }}
        >
          {/* stepper com campo digitável entre as setas */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: t.ink5,
              overflow: "hidden",
            }}
          >
            <Pressable
              onPress={() => onSetQty(line.lineId, -1)}
              style={qtyBtn(t)}
            >
              <Ic name="minus" size={13} color={t.ink2} />
            </Pressable>
            <TextInput
              value={qtyText}
              onChangeText={setQtyText}
              onBlur={commitQty}
              onSubmitEditing={commitQty}
              keyboardType="number-pad"
              style={{
                minWidth: 30,
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: "800",
                color: t.ink,
                paddingVertical: 4,
                paddingHorizontal: 2,
                ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
              }}
            />
            <Pressable
              onPress={() => onSetQty(line.lineId, 1)}
              style={qtyBtn(t)}
            >
              <Ic name="plus" size={13} color={t.ink2} />
            </Pressable>
          </View>

          {/* preço de venda + lápis */}
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {sale < list && (
                <Text
                  style={{
                    fontSize: 10.5,
                    color: t.ink4,
                    textDecorationLine: "line-through",
                  }}
                >
                  R$ {money(list * line.qty)}
                </Text>
              )}
              <Text style={{ fontSize: 12.5, color: t.ink, fontWeight: "700" }}>
                R$ {money(sale * line.qty)}
              </Text>
              <Pressable
                onPress={() => setEditing((e) => !e)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: editing ? t.accent : t.ink5,
                  backgroundColor: editing ? t.accentSoft : t.bgSoft,
                  alignItems: "center",
                  justifyContent: "center",
                  ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
                }}
              >
                <Ic name="edit" size={12} color={editing ? t.accentInk : t.ink3} />
              </Pressable>
            </View>
            {disc > 0 && (
              <Text style={{ fontSize: 10, color: t.accentInk, fontWeight: "700", marginTop: 2 }}>
                desconto −R$ {money(disc)}
              </Text>
            )}
            {editing && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                <Text style={{ fontSize: 10.5, color: t.ink3 }}>Preço un.</Text>
                <TextInput
                  value={priceText}
                  onChangeText={setPriceText}
                  onBlur={commitPrice}
                  onSubmitEditing={commitPrice}
                  keyboardType="decimal-pad"
                  autoFocus
                  style={{
                    width: 78,
                    height: 30,
                    borderWidth: 1,
                    borderColor: t.primary,
                    borderRadius: 8,
                    textAlign: "right",
                    paddingHorizontal: 8,
                    fontSize: 12.5,
                    fontWeight: "700",
                    color: t.ink,
                    backgroundColor: t.bgSoft,
                    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
                  }}
                />
                <Pressable
                  onPress={commitPrice}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: t.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
                  }}
                >
                  <Ic name="check" size={14} color="#fff" />
                </Pressable>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => onRemove(line.lineId)}
            style={{ padding: 4 }}
          >
            <Ic name="trash" size={15} color={t.danger} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
const qtyBtn = (t: StudioPalette) => ({
  paddingHorizontal: 8,
  paddingVertical: 6,
  backgroundColor: t.bgSoft,
  ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
});

export function CartSidebar({
  t,
  cart,
  subtotal,
  count,
  customCount,
  payLabel,
  onSetQty,
  onSetQtyTo,
  onSetPrice,
  onRemove,
  onEdit,
  onQuote,
  onCheckout,
}: {
  t: StudioPalette;
  cart: CartLine[];
  subtotal: number;
  count: number;
  customCount: number;
  payLabel: string;
  onSetQty: (lineId: string, d: number) => void;
  onSetQtyTo: (lineId: string, qty: number) => void;
  onSetPrice: (lineId: string, price: number) => void;
  onRemove: (lineId: string) => void;
  onEdit: (line: CartLine) => void;
  onQuote: () => void;
  onCheckout: () => void;
}) {
  const has = cart.length > 0;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.paperCard,
        borderLeftWidth: 1,
        borderLeftColor: t.ink5,
      }}
    >
      {/* head */}
      <View
        dataSet={{ flyTarget: "cart" }}
        style={{
          padding: 16,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: t.ink5,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            color: t.ink3,
            fontWeight: "800",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Total da venda
        </Text>
        <Text style={{ fontSize: 30, color: t.ink, fontWeight: "800" }}>
          <Text style={{ fontSize: 16, color: t.ink3 }}>R$ </Text>
          {money(subtotal)}
        </Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          {[
            ["Itens", String(count)],
            ["Personalizados", String(customCount)],
            ["Pagamento", payLabel],
          ].map(([k, v]) => (
            <View key={k}>
              <Text
                style={{ fontSize: 10, color: t.ink3, fontWeight: "600" }}
              >
                {k}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: t.ink,
                  fontWeight: "800",
                }}
                numberOfLines={1}
              >
                {v}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* body */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, gap: 8 }}
      >
        {!has ? (
          <View
            style={{ alignItems: "center", gap: 8, paddingVertical: 40 }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: t.bgSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ic name="cart" size={26} color={t.ink3} />
            </View>
            <Text
              style={{ fontSize: 13, color: t.ink2, fontWeight: "700" }}
            >
              Carrinho vazio
            </Text>
            <Text style={{ fontSize: 11.5, color: t.ink3 }}>
              Toque em um produto para começar
            </Text>
          </View>
        ) : (
          cart.map((l) => (
            <CartItem
              key={l.lineId}
              t={t}
              line={l}
              onSetQty={onSetQty}
              onSetQtyTo={onSetQtyTo}
              onSetPrice={onSetPrice}
              onRemove={onRemove}
              onEdit={onEdit}
            />
          ))
        )}
      </ScrollView>

      {/* foot */}
      <View
        style={{
          padding: 14,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: t.ink5,
        }}
      >
        <SumRow t={t} label="Subtotal" value={subtotal} />
        <SumRow t={t} label="Total" value={subtotal} big />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Pressable
            onPress={onQuote}
            disabled={!has}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: has ? t.accentInk : t.ink5,
              opacity: has ? 1 : 0.5,
              ...(Platform.OS === "web"
                ? ({ cursor: has ? "pointer" : "not-allowed" } as any)
                : {}),
            }}
          >
            <Ic name="file_text" size={16} color={has ? t.accentInk : t.ink3} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: has ? t.accentInk : t.ink3,
              }}
            >
              Orçamento
            </Text>
          </Pressable>
          <Pressable
            onPress={onCheckout}
            disabled={!has}
            style={{
              flex: 1.3,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: has ? t.primary : t.ink5,
              opacity: has ? 1 : 0.6,
              ...(Platform.OS === "web"
                ? ({ cursor: has ? "pointer" : "not-allowed" } as any)
                : {}),
            }}
          >
            <Text
              style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}
            >
              Fechar venda
            </Text>
            <Ic name="arrow_right" size={16} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
