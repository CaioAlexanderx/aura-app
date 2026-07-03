// ============================================================
// components/studio/storefront/ProductConfigurator.tsx
// Orquestra os fields de um produto: frente/verso, opt-in verso,
// LivePreview, quantidade, botao Adicionar/Atualizar.
// Agente I (03/06/2026): link 'Ver guia de medidas' + values/onFieldChange no FieldRenderer
// Agente J (03/06/2026): ocultar campo image quando art_service=designer + limpar valor
// Visual Engine F3 (03/07/2026): slug+productId passados ao LivePreview —
//   com template visual vinculado, o preview vira canvas 2D/viewer 3D.
// ============================================================
import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { T } from "./types";
import { FieldRenderer } from "./FieldRenderer";
import { LivePreview, defaultConfiguratorSize } from "./LivePreview";
import { PoweredByAura } from "./ui/PoweredByAura";
import { SizeGuideModal } from "./SizeGuideModal";

const qtyBtn: any = {
  width: 30, height: 30, borderRadius: 8,
  backgroundColor: "#f3f4f6",
  alignItems: "center", justifyContent: "center",
};
const qtyTxt: any = { color: T.ink, fontSize: 16, fontWeight: "800" };

export function ProductConfigurator({
  sf,
  slug,
}: {
  sf: StorefrontState;
  /** Slug da loja — necessario para o endpoint de upload no FieldImage */
  slug: string;
}) {
  const {
    activeProduct, editingValues, setFieldValue, editingQty, setEditingQty,
    editingAddBack, setEditingAddBack, configuringUnitPrice, commitConfigure,
    goTo, error,
    // editingLineId nao e exposto diretamente — inferimos pelo comportamento:
    // quando activeProduct nao e null E tem um lineId travado, e edicao.
    // O hook sabe internamente; o texto do botao muda via sf._isEditing.
  } = sf;

  // Agente I: estado local do modal do guia de medidas
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  // Agente J: detecta o campo art_service e o campo image em todos os fields.
  // Calculado ANTES do early return para que o useEffect abaixo possa ser
  // chamado incondicionalmente (Rules of Hooks).
  const cfg = activeProduct?.customization_config;
  const allFieldsForHooks = cfg?.fields || [];
  const artServiceField = allFieldsForHooks.find(
    (f) => f.type === "option" && (f.config as any)?.is_art_service
  );
  const imageField = allFieldsForHooks.find((f) => f.type === "image");

  // Agente J: valor atual do campo art_service (null quando o campo nao existe
  // ou quando activeProduct ainda nao esta carregado).
  const artServiceValue =
    artServiceField != null
      ? (editingValues[artServiceField.id] ?? "")
      : null;

  // Agente J: limpa o valor do campo image ao trocar para 'designer'.
  // DEVE ficar ANTES de qualquer early return para respeitar as Rules of Hooks.
  // O corpo do effect e defensivo: retorna cedo se activeProduct for null,
  // se nao houver campo image ou se o art_service nao for 'designer'.
  useEffect(() => {
    if (artServiceValue !== "designer") return;
    if (!imageField) return;
    const currentImageVal = editingValues[imageField.id];
    if (currentImageVal != null && currentImageVal !== "") {
      setFieldValue(imageField.id, "");
    }
    // editingValues intencionalmente omitido da dep-array: queremos reagir
    // apenas a mudancas no valor do art_service, nao a cada keystroke geral.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artServiceValue]);

  if (!activeProduct) return null;

  const hasDelta = configuringUnitPrice !== Number(activeProduct.price);

  // Agente I: extrai size_guide do customization_config
  const sizeGuide = (cfg as any)?.size_guide as
    | { file_url: string; content_type: string }
    | undefined;
  const hasSizeGuide = !!(sizeGuide?.file_url);

  const allFields = cfg?.fields || [];
  const frontFields = allFields.filter((f) => ((f as any).side || "front") === "front");
  const backFields = allFields.filter((f) => (f as any).side === "back");
  const hasBack = cfg?.has_back === true;
  const backCharge = cfg?.back_charge_enabled === true;
  const backPrice = Number(cfg?.back_price_delta) || 0;
  const shouldRenderBack = hasBack && backFields.length > 0;
  const showBackBody = shouldRenderBack && (!backCharge || editingAddBack);

  // Agente J: designer=true quando o campo art_service existe e tem valor 'designer'
  const artServiceDesigner =
    artServiceField != null &&
    editingValues[artServiceField.id] === "designer";

  // Agente I + J: passa values + onFieldChange ao FieldRenderer;
  // quando art_service=designer, nao renderiza o campo image.
  const renderField = (f: typeof allFields[0]) => {
    // Agente J: suprime campo image enquanto designer estiver ativo
    if (f.type === "image" && artServiceDesigner) return null;

    return (
      <FieldRenderer
        key={f.id}
        field={f}
        value={editingValues[f.id]}
        templates={activeProduct.templates}
        slug={slug}
        onChange={(v) => setFieldValue(f.id, v)}
        values={editingValues}
        onFieldChange={setFieldValue}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Modal guia de medidas */}
      {showSizeGuide && hasSizeGuide && (
        <SizeGuideModal
          sizeGuide={sizeGuide!}
          onClose={() => setShowSizeGuide(false)}
        />
      )}

      {/* Header */}
      <View
        style={{
          backgroundColor: T.card,
          paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
          borderBottomWidth: 1, borderBottomColor: T.border,
          flexDirection: "row", alignItems: "center", gap: 10,
        }}
      >
        <Pressable onPress={() => { goTo("list"); sf.setError(null); }}>
          <Text style={{ fontSize: 22, color: T.ink2 }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Personalize</Text>
          <Text style={{ fontSize: 17, fontWeight: "800", color: T.ink }}>{activeProduct.name}</Text>
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: "rgba(30,58,138,0.08)",
              paddingHorizontal: 8, paddingVertical: 3,
              borderRadius: 999, marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 9, color: T.primary, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>
              Estúdio · Arte personalizada
            </Text>
          </View>

          {/* Agente I: link 'Ver guia de medidas' — só quando size_guide existe */}
          {hasSizeGuide && (
            <Pressable
              onPress={() => setShowSizeGuide(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 6,
                alignSelf: "flex-start",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: "rgba(30,58,138,0.25)",
                backgroundColor: "rgba(30,58,138,0.05)",
              }}
            >
              <Text style={{ fontSize: 11 }}>📐</Text>
              <Text
                style={{
                  fontSize: 11,
                  color: T.primary,
                  fontWeight: "700",
                  textDecorationLine: "underline",
                }}
              >
                Ver guia de medidas
              </Text>
            </Pressable>
          )}
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 160 }}>
        <View style={{ alignItems: "center" }}>
          <LivePreview
            config={cfg}
            values={editingValues}
            size={defaultConfiguratorSize()}
            productName={activeProduct.name}
            showLabel={false}
            slug={slug}
            productId={activeProduct.id}
          />
        </View>

        {/* Fields: flat quando sem verso, agrupados quando com verso */}
        {!shouldRenderBack ? (
          <>{allFields.map(renderField)}</>
        ) : (
          <>
            {/* Frente */}
            <View style={{ gap: 4, marginTop: 4 }}>
              <Text style={{ fontSize: 10.5, color: T.primary, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                Frente
              </Text>
            </View>
            {frontFields.map(renderField)}

            {/* Divisor VERSO */}
            <View style={{ marginTop: 18, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(30,58,138,0.08)" }}>
                <Text style={{ fontSize: 12, color: T.primary }}>↻</Text>
                <Text style={{ fontSize: 10.5, color: T.primary, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Verso</Text>
              </View>
              <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
            </View>

            {/* Opt-in verso cobrado */}
            {backCharge ? (
              <Pressable
                onPress={() => {
                  const next = !editingAddBack;
                  setEditingAddBack(next);
                  if (next && backPrice > 0) {
                    console.log("[storefront] verso adicionado: +R$ " + backPrice.toFixed(2));
                  }
                }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  backgroundColor: T.card, borderRadius: 10, padding: 12,
                  borderWidth: 1.5,
                  borderColor: editingAddBack ? T.primary : T.border,
                }}
              >
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    borderWidth: 2,
                    borderColor: editingAddBack ? T.primary : T.ink4,
                    backgroundColor: editingAddBack ? T.primary : "transparent",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {editingAddBack && (
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>✓</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: T.ink, fontWeight: "800" }}>
                    Personalizar também o verso
                  </Text>
                  {!editingAddBack && (
                    <Text style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>
                      Opcional · adiciona arte no lado de trás da peça
                    </Text>
                  )}
                  {editingAddBack && backPrice > 0 && (
                    <Text style={{ fontSize: 11.5, color: T.green, fontWeight: "700", marginTop: 2 }}>
                      +R$ {backPrice.toFixed(2)} no total
                    </Text>
                  )}
                </View>
                {!editingAddBack && backPrice > 0 && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(236,72,153,0.12)" }}>
                    <Text style={{ fontSize: 11, color: T.accent, fontWeight: "800" }}>+R$ {backPrice.toFixed(2)}</Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <Text style={{ fontSize: 11, color: T.ink3, textAlign: "center", fontStyle: "italic", marginTop: -2 }}>
                Verso incluso · sem custo adicional
              </Text>
            )}

            {/* Fields do verso (so quando ativo) */}
            {showBackBody && backFields.map(renderField)}
          </>
        )}

        {/* Quantidade */}
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

      {/* Botao CTA */}
      <View style={{ backgroundColor: T.card, padding: 14, borderTopWidth: 1, borderTopColor: T.border }}>
        <Pressable
          onPress={commitConfigure}
          style={{ backgroundColor: T.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
            {(sf as any)._editingLineId ? "Atualizar" : "Adicionar"} • R$ {(configuringUnitPrice * editingQty).toFixed(2)}
          </Text>
        </Pressable>
      </View>

      <PoweredByAura />
    </View>
  );
}
