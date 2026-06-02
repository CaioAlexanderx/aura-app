// ============================================================
// AURA STUDIO · PDV — card de produto (Fase 6)
// Dois caminhos visuais: personalizável (accent magenta + badge +
// preview ao vivo + CTA "Personalizar →") vs comum (neutro + inicial
// + CTA "Adicionar +"). Hover-lift no web.
// ============================================================
import { View, Text, Pressable, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import type { StudioProduct } from "./types";
import { PersonalizableBadge, money } from "./ui";
import { Ic } from "./icons";

export function ProductCard({
  t, product, inCartQty, onPress,
}: {
  t: StudioPalette;
  product: StudioProduct;
  inCartQty: number;
  onPress: (p: StudioProduct) => void;
}) {
  const p = product;
  const custom = p.is_personalizable;
  const edge = custom ? t.accent : t.ink5;

  return (
    <Pressable
      onPress={() => onPress(p)}
      style={({ hovered, pressed }: any) => ({
        backgroundColor: t.paperCardElev, borderRadius: 14, padding: 13,
        borderWidth: 1, borderColor: t.ink5,
        borderLeftWidth: 3, borderLeftColor: edge,
        gap: 10, flex: 1, minWidth: 0, minHeight: 232,
        ...(Platform.OS === "web"
          ? ({
              transition: "transform .18s ease, box-shadow .18s ease",
              transform: pressed ? "scale(.99)" : hovered ? "translateY(-2px)" : "none",
              boxShadow: hovered ? `0 12px 28px -10px ${edge}66` : `0 1px 2px rgba(2,6,23,0.06)`,
              cursor: "pointer",
            } as any)
          : {}),
      })}
    >
      {/* topo: badge + qty no carrinho */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 20 }}>
        {custom ? <PersonalizableBadge t={t} /> : <View />}
        {inCartQty > 0 && (
          <View style={{ backgroundColor: t.ink, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>×{inCartQty}</Text>
          </View>
        )}
      </View>

      {/* thumb */}
      <View style={{ alignItems: "center", paddingVertical: 4 }}>
        {custom ? (
          <PersonalizationPreview config={p.customization_config} values={{}} size={92} showLabel={false} />
        ) : (
          <View style={{ width: 92, height: 92, borderRadius: 12, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 30, fontWeight: "800", color: t.ink3 }}>
              {(p.name || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* nome + meta — altura fixa p/ padronizar os cards (clamp 2 linhas) */}
      <View style={{ gap: 3 }}>
        <Text
          style={{ fontSize: 14, color: t.ink, fontWeight: "800", lineHeight: 18, minHeight: 36 }}
          numberOfLines={2}
        >
          {p.name}
        </Text>
        <Text style={{ fontSize: 10.5, color: t.ink3 }} numberOfLines={1}>
          {p.sku ? "SKU " + String(p.sku).slice(-6) : (p.category || "—")}
        </Text>
      </View>

      {/* rodapé: preço + CTA — fixo no fundo, CTA sem quebra */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
        <Text style={{ fontSize: 15, color: t.primary, fontWeight: "800" }} numberOfLines={1}>R$ {money(p.price)}</Text>
        <View
          style={{
            flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 5,
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
            backgroundColor: custom ? t.accent : t.primary,
          }}
        >
          {!custom && <Ic name="plus" size={14} color="#fff" />}
          <Text
            numberOfLines={1}
            style={{ color: "#fff", fontSize: 12, fontWeight: "800", ...(Platform.OS === "web" ? ({ whiteSpace: "nowrap" } as any) : {}) }}
          >
            {custom ? "Personalizar" : "Adicionar"}
          </Text>
          {custom && <Ic name="arrow_right" size={14} color="#fff" />}
        </View>
      </View>
    </Pressable>
  );
}
