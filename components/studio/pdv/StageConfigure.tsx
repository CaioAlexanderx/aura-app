// ============================================================
// AURA STUDIO · PDV — configurador (Fase 6 + agent/pdv)
// Preview ao vivo (PersonalizationPreview) + campos data-driven, todos
// OPCIONAIS. "Adicionar ao carrinho" SEMPRE ativo (nunca trava).
//
// Sem mudança de comportamento nesta fase. O StageConfigure agora
// só é aberto via handleCustomize (botão "✎ Personalizar"), nunca
// pelo quick-add. O produto passado pode ter campos ou não — ambos
// os casos são tratados (0 campos → mensagem informativa + botão ativo).
// ============================================================
import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import type { StudioProduct } from "./types";
import { FieldEditor } from "./FieldEditor";
import { Ic } from "./icons";
import { money } from "./ui";

type Tpl = {
  id: string;
  name: string;
  image_url: string;
  thumb_url: string | null;
};

export function StageConfigure({
  t,
  product,
  initialValues,
  initialQty,
  editLineId,
  templates,
  onCancel,
  onConfirm,
}: {
  t: StudioPalette;
  product: StudioProduct;
  initialValues: Record<string, any>;
  initialQty: number;
  editLineId: string | null;
  templates: Tpl[];
  onCancel: () => void;
  onConfirm: (
    values: Record<string, any>,
    qty: number,
    editLineId: string | null,
  ) => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 880;
  const [values, setValues] = useState<Record<string, any>>(initialValues || {});
  const [qty, setQty] = useState(initialQty || 1);
  useEffect(() => {
    setValues(initialValues || {});
    setQty(initialQty || 1);
  }, [editLineId]);

  const cfg = product.customization_config;
  const fields = cfg?.fields || [];

  return (
    <View
      style={[
        { flex: 1, backgroundColor: "rgba(2,6,23,0.66)" },
        Platform.OS === "web"
          ? ({ position: "fixed", inset: 0, zIndex: 1000 } as any)
          : ({
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            } as any),
      ]}
    >
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onCancel}
      />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        pointerEvents="box-none"
      >
        <View
          style={{
            width: "100%",
            maxWidth: 920,
            maxHeight: "92%",
            borderRadius: 18,
            overflow: "hidden",
            backgroundColor: t.paperCardElev,
            borderWidth: 1,
            borderColor: t.ink5,
            flexDirection: wide ? "row" : "column",
            ...(Platform.OS === "web"
              ? ({
                  boxShadow: "0 24px 60px -18px rgba(2,6,23,0.7)",
                } as any)
              : {}),
          }}
        >
          {/* Preview ao vivo */}
          <View
            style={{
              width: wide ? 320 : "100%",
              padding: 20,
              gap: 12,
              alignItems: "center",
              backgroundColor: t.bgSoft,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
              }}
            >
              <Ic name="sparkle" size={14} color={t.accentInk} />
              <Text
                style={{
                  fontSize: 11,
                  color: t.ink3,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Pré-visualização ao vivo
              </Text>
            </View>
            <PersonalizationPreview
              config={cfg}
              values={values}
              size={wide ? 260 : 200}
              productName={product.name}
              showLabel={false}
            />
            <Text
              style={{ fontSize: 12, color: t.ink2, fontWeight: "700" }}
            >
              {product.name} ·{" "}
              <Text style={{ color: t.primary }}>R$ {money(product.price)}</Text>
            </Text>
          </View>

          {/* Form */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: 18,
                paddingBottom: 6,
              }}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Ic name="sparkle" size={13} color={t.accentInk} />
                  <Text
                    style={{
                      fontSize: 10.5,
                      color: t.accentInk,
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Produto personalizável
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 19,
                    color: t.ink,
                    fontWeight: "800",
                    marginTop: 3,
                  }}
                >
                  {product.name}
                </Text>
                <Text
                  style={{ fontSize: 12.5, color: t.ink3, marginTop: 1 }}
                >
                  R$ {money(product.price)} / unidade · personalização opcional
                </Text>
              </View>
              <Pressable onPress={onCancel} style={{ padding: 6 }}>
                <Ic name="x" size={20} color={t.ink3} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 18, paddingTop: 8, gap: 16 }}
            >
              {fields.length === 0 ? (
                <Text style={{ fontSize: 13, color: t.ink3 }}>
                  Este produto não tem campos de personalização configurados.
                  Você pode adicioná-lo direto ao carrinho.
                </Text>
              ) : (
                fields.map((f) => (
                  <FieldEditor
                    key={f.id}
                    t={t}
                    field={f}
                    value={values[f.id]}
                    templates={templates}
                    onChange={(v) =>
                      setValues((prev) => ({ ...prev, [f.id]: v }))
                    }
                  />
                ))
              )}
            </ScrollView>

            {/* footer — botão SEMPRE ativo */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: t.ink5,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: t.ink5,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  onPress={() => setQty(Math.max(1, qty - 1))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: t.bgSoft,
                  }}
                >
                  <Ic name="minus" size={16} color={t.ink2} />
                </Pressable>
                <Text
                  style={{
                    minWidth: 32,
                    textAlign: "center",
                    fontSize: 15,
                    fontWeight: "800",
                    color: t.ink,
                  }}
                >
                  {qty}
                </Text>
                <Pressable
                  onPress={() => setQty(qty + 1)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: t.bgSoft,
                  }}
                >
                  <Ic name="plus" size={16} color={t.ink2} />
                </Pressable>
              </View>
              <Pressable
                onPress={() => onConfirm(values, qty, editLineId)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: t.accent,
                  ...(Platform.OS === "web"
                    ? ({ cursor: "pointer" } as any)
                    : {}),
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 14.5, fontWeight: "800" }}
                >
                  {editLineId ? "Salvar alterações" : "Adicionar ao carrinho"}
                </Text>
                <Ic name="cart" size={17} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
