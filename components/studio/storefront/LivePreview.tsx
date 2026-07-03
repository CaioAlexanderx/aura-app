// ============================================================
// components/studio/storefront/LivePreview.tsx
// Wrap do PersonalizationPreview com props claras e tipadas.
//
// VISUAL ENGINE F3/F4 (03/07/2026):
//   Quando slug+productId são passados (ProductConfigurator) e o
//   produto tem template visual vinculado (fetch público, cache),
//   o preview sobe de nível:
//     photo2d → canvas do motor compose2d (frente/verso, arte real)
//     model3d → viewer 3D da caneca (Mug3DPreview, arraste pra girar)
//   Sem template (ou nativo, ou uso no checkout sem as props novas)
//   → comportamento ANTIGO intacto (PersonalizationPreviewBase SVG).
//
// CONTRATO (props antigas inalteradas; slug/productId são opcionais):
//   config       — CustomizationConfig | null (inclui print_area, fields)
//   values       — Record<fieldId, any> (estado atual da personalização)
//   size         — number (px de lado do preview)
//   productName  — string
//   showLabel    — boolean
//   slug?        — slug da loja (habilita o motor)
//   productId?   — id do produto (habilita o motor)
//
// TRATAMENTO PDF (D1): mantido — valor PDF é stripado antes de
// qualquer renderer (SVG ou canvas) e a nota discreta aparece abaixo.
//
// DESACOPLAMENTO DE TEMA (Onda 0 · 0.6): mantido — storefront usa
// PersonalizationPreviewBase com STOREFRONT_PALETTE no fallback.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, Platform, Pressable } from "react-native";
import { PersonalizationPreviewBase, type PreviewPalette } from "@/components/studio/PersonalizationPreview";
import type { CustomizationConfig } from "./types";
import { T } from "./types";
import type { VisualTemplate, VisualView } from "@/services/studioVisualApi";
import { fetchStorefrontVisualTemplate } from "./visualTemplatePublic";
import { composeView } from "@/components/studio/visualEngine/compose2d";
import { Mug3DPreview } from "@/components/studio/visualEngine/Mug3DPreview";

// Paleta do storefront (light) derivada do T da loja — sem tocar no
// tema interno do painel. Mantém o mockup coerente com a vitrine pública.
const STOREFRONT_PALETTE: PreviewPalette = {
  bgSoft: T.bg,
  ink: T.ink,
  ink3: T.ink3,
  ink4: T.ink4,
  ink5: T.border,
  primary: T.primary,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retorna true se a string parece ser uma URL de PDF. */
function isPdfUrl(v: unknown): boolean {
  if (typeof v !== "string" || !v) return false;
  // Remove query string / fragment antes de checar a extensão
  try {
    const pathname = new URL(v).pathname;
    return pathname.toLowerCase().endsWith(".pdf");
  } catch {
    // URL relativa ou inválida — checa direto na string
    return v.split("?")[0].toLowerCase().endsWith(".pdf");
  }
}

/**
 * Encontra o primeiro campo type='image' que contém uma URL PDF em values.
 * Retorna { fieldId } se encontrou, null caso contrário.
 */
function findPdfImageField(
  config: CustomizationConfig | null,
  values: Record<string, any>,
): { fieldId: string } | null {
  if (!config?.fields) return null;
  for (const field of config.fields) {
    if (field.type === "image" && isPdfUrl(values[field.id])) {
      return { fieldId: field.id };
    }
  }
  return null;
}

function PdfNote({ size }: { size: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(100,116,139,0.10)",
        borderWidth: 1,
        borderColor: "rgba(100,116,139,0.20)",
        maxWidth: size,
      }}
      accessibilityRole="text"
      accessibilityLabel="PDF enviado. Pré-visualização indisponível."
    >
      <Text style={{ fontSize: 12, color: T.ink3 }}>📄</Text>
      <Text
        style={{ fontSize: 11, color: T.ink3, fontWeight: "600", flexShrink: 1 }}
        numberOfLines={1}
      >
        PDF enviado — pré-visualização indisponível
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function LivePreview({
  config, values, size, productName, showLabel, slug, productId,
}: {
  config: CustomizationConfig | null;
  values: Record<string, any>;
  size: number;
  productName: string;
  showLabel: boolean;
  /** F3: slug da loja — junto com productId habilita o motor visual */
  slug?: string;
  /** F3: id do produto — junto com slug habilita o motor visual */
  productId?: string;
}) {
  const canUseEngine = Platform.OS === "web" && !!slug && !!productId;
  const [tpl, setTpl] = useState<VisualTemplate | null>(null);
  const [viewId, setViewId] = useState<"front" | "back">("front");
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    if (canUseEngine) {
      fetchStorefrontVisualTemplate(slug as string, productId as string).then((t) => {
        if (alive) setTpl(t);
      });
    } else {
      setTpl(null);
    }
    return () => { alive = false; };
  }, [slug, productId, canUseEngine]);

  // D1: Tratamento de PDF (vale pra qualquer renderer)
  const pdfField = findPdfImageField(config, values);
  const safeValues: Record<string, any> = pdfField
    ? { ...values, [pdfField.fieldId]: undefined }
    : values;

  const photoViews: VisualView[] =
    tpl?.kind === "photo2d" && Array.isArray(tpl.spec?.views) && tpl.spec!.views!.length
      ? (tpl.spec!.views as VisualView[])
      : [];
  const engineView = photoViews.length
    ? (viewId === "back" && photoViews[1] ? photoViews[1] : photoViews[0])
    : null;
  const showBackToggle = photoViews.length > 1 && config?.has_back === true;
  const safeValuesKey = JSON.stringify(safeValues);

  useEffect(() => {
    if (!engineView || !canvasRef.current) return;
    composeView(canvasRef.current, engineView, safeValues, {
      showAreas: false,
      pixelWidth: 800,
    });
    // safeValuesKey representa safeValues de forma estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineView, safeValuesKey]);

  // ── F4: template 3D (caneca) ───────────────────────────
  if (tpl?.kind === "model3d" && tpl.spec) {
    return (
      <View style={{ alignItems: "center", gap: 6 }}>
        <Mug3DPreview
          spec={tpl.spec}
          values={safeValues}
          size={size}
          accentColor={T.primary}
        />
        {pdfField && <PdfNote size={size} />}
      </View>
    );
  }

  // ── F3: template 2D (foto/vetor + arte real do cliente) ──────
  if (engineView) {
    const h = Math.round(size * (engineView.base.h / engineView.base.w));
    return (
      <View style={{ alignItems: "center", gap: 6 }}>
        {showBackToggle && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["front", "back"] as const).map((v) => {
              const sel = viewId === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setViewId(v)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
                    backgroundColor: sel ? T.primary : "transparent",
                    borderWidth: 1.5, borderColor: sel ? T.primary : T.border,
                  }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: sel ? "#fff" : T.ink3 }}>
                    {v === "front" ? "Frente" : "Verso"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ width: size, height: h, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: T.border }}>
          {/* @ts-ignore — canvas DOM no web (motor compose2d) */}
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" } as any} />
        </View>
        {pdfField && <PdfNote size={size} />}
      </View>
    );
  }

  // ── Fallback: comportamento antigo (SVG) ────────────────────
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <PersonalizationPreviewBase
        config={config}
        values={safeValues}
        size={size}
        productName={productName}
        showLabel={showLabel}
        t={STOREFRONT_PALETTE}
      />
      {pdfField && <PdfNote size={size} />}
    </View>
  );
}

/** Tamanho padrão para o configurador (responsivo) */
export function defaultConfiguratorSize(): number {
  return Math.min(320, Platform.OS === "web" ? 320 : 280);
}
