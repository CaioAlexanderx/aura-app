// ============================================================
// components/studio/storefront/Cart.tsx
// Barra flutuante do carrinho (stage="list") + lista no checkout.
// ============================================================
import { View, Text, Pressable } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { T } from "./types";
import { LivePreview } from "./LivePreview";

// Helpers expostos pelo hook
function effectiveBackSelected(
  cfg: any, explicit: boolean | undefined
): boolean {
  if (!cfg || cfg.has_back !== true) return false;
  if (cfg.back_charge_enabled !== true) return true;
  return explicit === true;
}

/** Barra flutuante no stage="list" quando há itens no carrinho */
export function CartBar({
  sf, accent,
}: {
  sf: StorefrontState;
  accent: string;
}) {
  if (sf.cart.length === 0) return null;
  return (
    <Pressable
      onPress={() => sf.goTo("checkout")}
      style={{
        position: "absolute", left: 12, right: 12, bottom: 40,
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
            {sf.cart.reduce((s, l) => s + l.qty, 0)}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>itens personalizados</Text>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>R$ {sf.cartSubtotal.toFixed(2)}</Text>
        </View>
      </View>
      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Finalizar →</Text>
    </Pressable>
  );
}

/** Lista de itens no checkout */
export function CartItemList({ sf }: { sf: StorefrontState }) {
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

  return (
    <>
      {sf.cart.map((l) => {
        const unit = sf._lineUnitPrice(l);
        const hasDelta = unit !== Number(l.product.price);
        const backActive = effectiveBackSelected(
          l.product.customization_config,
          l.hasBackSelected
        );
        return (
          <View
            key={l.lineId}
            style={{
              backgroundColor: T.card, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: T.border,
              flexDirection: "row", alignItems: "center", gap: 12,
            }}
          >
            <LivePreview
              config={l.product.customization_config}
              values={l.values}
              size={56}
              productName={l.product.name}
              showLabel={false}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: T.ink, fontWeight: "700" }}>{l.product.name}</Text>
              <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>
                Qtd {l.qty} · R$ {sf._lineTotal(l).toFixed(2)}
              </Text>
              {hasDelta && (
                <Text style={{ fontSize: 10, color: T.accent, marginTop: 1 }}>
                  inclui R$ {(unit - Number(l.product.price)).toFixed(2)} por opções
                </Text>
              )}
              {backActive &&
                (Number(l.product.customization_config?.back_price_delta) || 0) > 0 && (
                  <Text style={{ fontSize: 10, color: T.green, fontWeight: "700", marginTop: 1 }}>
                    + verso (R$ {Number(l.product.customization_config?.back_price_delta || 0).toFixed(2)})
                  </Text>
                )}
              {backActive &&
                (Number(l.product.customization_config?.back_price_delta) || 0) === 0 &&
                l.product.customization_config?.has_back === true && (
                  <Text style={{ fontSize: 10, color: T.ink3, marginTop: 1 }}>com verso personalizado</Text>
                )}
            </View>
            <View style={{ gap: 6 }}>
              <Pressable onPress={() => sf.editCartLine(l)} style={editChip}>
                <Text style={editChipTxt}>Editar</Text>
              </Pressable>
              <Pressable onPress={() => sf.removeCartLine(l.lineId)} style={removeChip}>
                <Text style={removeChipTxt}>Remover</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
}
