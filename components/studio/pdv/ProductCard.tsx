// ============================================================
// AURA STUDIO · PDV — card de produto (Fase 6 + agent/pdv)
//
// DOIS CAMINHOS DE AÇÃO (para produtos personalizáveis):
//   Primário  → "＋ Adicionar"   (quick-add, 1 toque, sem modal)
//   Secundário → "✎ Personalizar" (abre StageConfigure)
//
// Para produtos NÃO personalizáveis: só "＋ Adicionar" (primário).
// O botão "Personalizar" usa t.accentInk (escuro) sobre t.accentSoft
// (fundo claro) — contraste AA seguro (≥4.5:1).
// Hover-lift no web preservado.
// ============================================================
import { useRef } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import type { StudioProduct } from "./types";
import type { FlyRect } from "./flyToCart";
import { PersonalizableBadge, money } from "./ui";
import { Ic } from "./icons";

export function ProductCard({
  t,
  product,
  inCartQty,
  onQuickAdd,
  onCustomize,
}: {
  t: StudioPalette;
  product: StudioProduct;
  inCartQty: number;
  /** Quick-add: adiciona direto ao carrinho, sem modal. */
  onQuickAdd: (p: StudioProduct, rect?: FlyRect | null) => void;
  /** Personalizar: abre StageConfigure (só para produtos personalizáveis). */
  onCustomize: (p: StudioProduct) => void;
}) {
  const p = product;
  const custom = p.is_personalizable;
  const hasFields =
    custom &&
    Array.isArray(p.customization_config?.fields) &&
    (p.customization_config?.fields.length ?? 0) > 0;

  const ref = useRef<any>(null);

  function measureRect(): FlyRect | null {
    if (
      Platform.OS === "web" &&
      ref.current &&
      (ref.current as any).getBoundingClientRect
    ) {
      const r = (ref.current as any).getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    return null;
  }

  return (
    <View
      ref={ref}
      style={{
        backgroundColor: t.paperCardElev,
        borderRadius: 14,
        padding: 13,
        borderWidth: 1,
        borderColor: t.ink5,
        borderLeftWidth: 3,
        borderLeftColor: custom ? t.accent : t.ink5,
        gap: 10,
        flex: 1,
        minWidth: 0,
        minHeight: 232,
        ...(Platform.OS === "web"
          ? ({
              transition: "box-shadow .18s ease",
              boxShadow: `0 1px 2px rgba(2,6,23,0.06)`,
            } as any)
          : {}),
      }}
    >
      {/* topo: badge + qty no carrinho */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 20,
        }}
      >
        {custom ? <PersonalizableBadge t={t} /> : <View />}
        {inCartQty > 0 && (
          <View
            style={{
              backgroundColor: t.ink,
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
              ×{inCartQty}
            </Text>
          </View>
        )}
      </View>

      {/* thumb */}
      <View style={{ alignItems: "center", paddingVertical: 4 }}>
        {custom ? (
          <PersonalizationPreview
            config={p.customization_config}
            values={{}}
            size={92}
            showLabel={false}
          />
        ) : (
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 12,
              backgroundColor: t.bgSoft,
              borderWidth: 1,
              borderColor: t.ink5,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{ fontSize: 30, fontWeight: "800", color: t.ink3 }}
            >
              {(p.name || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* nome + meta */}
      <View style={{ gap: 3 }}>
        <Text
          style={{
            fontSize: 14,
            color: t.ink,
            fontWeight: "800",
            lineHeight: 18,
            minHeight: 36,
          }}
          numberOfLines={2}
        >
          {p.name}
        </Text>
        <Text style={{ fontSize: 10.5, color: t.ink3 }} numberOfLines={1}>
          {p.sku
            ? "SKU " + String(p.sku).slice(-6)
            : p.barcode
            ? "Cód " + String(p.barcode).slice(-6)
            : p.category || "—"}
        </Text>
      </View>

      {/* rodapé: preço + CTAs */}
      <View style={{ marginTop: "auto", gap: 6 }}>
        <Text
          style={{ fontSize: 15, color: t.primary, fontWeight: "800" }}
          numberOfLines={1}
        >
          R$ {money(p.price)}
        </Text>

        {/* CTA primário — "＋ Adicionar" */}
        <Pressable
          onPress={() => onQuickAdd(p, measureRect())}
          style={({ hovered, pressed }: any) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: t.primary,
            ...(Platform.OS === "web"
              ? ({
                  cursor: "pointer",
                  transition: "transform .14s ease, opacity .14s ease",
                  transform: pressed
                    ? "scale(.97)"
                    : hovered
                    ? "translateY(-1px)"
                    : "none",
                  opacity: pressed ? 0.88 : 1,
                } as any)
              : {}),
          })}
          accessibilityLabel={`Adicionar ${p.name} ao carrinho`}
          accessibilityRole="button"
        >
          <Ic name="plus" size={14} color="#fff" />
          <Text
            numberOfLines={1}
            style={{
              color: "#fff",
              fontSize: 12,
              fontWeight: "800",
              ...(Platform.OS === "web"
                ? ({ whiteSpace: "nowrap" } as any)
                : {}),
            }}
          >
            Adicionar
          </Text>
        </Pressable>

        {/* CTA secundário — "✎ Personalizar" (só para personalizáveis) */}
        {custom && (
          <Pressable
            onPress={() => onCustomize(p)}
            style={({ hovered, pressed }: any) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              // fundo claro + texto escuro = AA-safe (evita rosa-sobre-rosa)
              backgroundColor: t.accentSoft,
              borderWidth: 1,
              borderColor: t.accentInk,
              ...(Platform.OS === "web"
                ? ({
                    cursor: "pointer",
                    transition: "opacity .14s ease",
                    opacity: pressed ? 0.75 : hovered ? 0.9 : 1,
                  } as any)
                : {}),
              // Se não tem campos configurados, torna o botão discreto
              ...(!hasFields ? { opacity: 0.55 } : {}),
            })}
            accessibilityLabel={`Personalizar ${p.name}`}
            accessibilityRole="button"
          >
            <Text
              numberOfLines={1}
              style={{
                // t.accentInk = tom escuro da família magenta → contraste ≥4.5 sobre accentSoft
                color: t.accentInk,
                fontSize: 11,
                fontWeight: "700",
                ...(Platform.OS === "web"
                  ? ({ whiteSpace: "nowrap" } as any)
                  : {}),
              }}
            >
              ✎ Personalizar
            </Text>
            <Ic name="arrow_right" size={12} color={t.accentInk} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
