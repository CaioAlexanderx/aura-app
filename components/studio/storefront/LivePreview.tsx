// ============================================================
// components/studio/storefront/LivePreview.tsx
// Wrap do PersonalizationPreview com props claras e tipadas.
//
// PONTO DE PLUGUE ONDA 1 (Agente J):
//   O Agente J alimenta imageUrl com a URL R2 após upload
//   (vinda do FieldImage/useStorefront.uploadImage).
//   O posicionamento na print_area (width_cm/height_cm/position)
//   já é resolvido dentro do PersonalizationPreview.
//
// CONTRATO (não alterar assinatura de props):
//   config       — CustomizationConfig | null (inclui print_area, fields)
//   values       — Record<fieldId, any> (estado atual da personalização)
//   size         — number (px de lado do preview quadrado)
//   productName  — string (nome do produto, passado pro PersonalizationPreview)
//   showLabel    — boolean (exibe ou não o label do produto no preview)
//
// COMO O AGENTE J ALIMENTA O PREVIEW:
//   O values passado pro LivePreview já contém a URL da imagem
//   em values[field.id] após o FieldImage chamar onChange(url).
//   O PersonalizationPreview existente já lê esse campo e renderiza.
//   Agente J só precisa garantir que a URL R2 é passada em values.
//
// TRATAMENTO PDF (D1):
//   Quando values[fieldId] de um campo type='image' é uma URL .pdf,
//   o PersonalizationPreview tentaria renderizar via <image href> — o
//   que falha silenciosamente no browser. Portanto este wrap detecta
//   PDFs, remove o valor do campo antes de repassar ao PersonalizationPreview
//   (mantendo o mockup limpo do produto), e exibe uma nota discreta abaixo.
//
// DESACOPLAMENTO DE TEMA (Onda 0 · 0.6):
//   O storefront é público e NÃO monta o StudioThemeProvider. Por isso
//   usamos PersonalizationPreviewBase com uma paleta derivada do T da
//   própria loja (STOREFRONT_PALETTE) — em vez do PersonalizationPreview
//   temático, que cairia no default DARK do context interno do painel.
// ============================================================
import { View, Text, Platform } from "react-native";
import { PersonalizationPreviewBase, type PreviewPalette } from "@/components/studio/PersonalizationPreview";
import type { CustomizationConfig } from "./types";
import { T } from "./types";

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

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function LivePreview({
  config, values, size, productName, showLabel,
}: {
  /** CustomizationConfig do produto (inclui print_area, fields, has_back, etc.) */
  config: CustomizationConfig | null;
  /** Estado atual da personalização. Agente J grava a URL da imagem enviada em values[fieldId] */
  values: Record<string, any>;
  /** Tamanho em px (quadrado). Padrão configurador: min(320, 280web). Padrão checkout: 56 */
  size: number;
  /** Nome do produto — passado direto ao PersonalizationPreview */
  productName: string;
  /** Exibir label interno do preview? false no configurador e checkout */
  showLabel: boolean;
}) {
  // -------------------------------------------------------------------------
  // D1: Tratamento de PDF
  // -------------------------------------------------------------------------
  const pdfField = findPdfImageField(config, values);

  // Se há um campo image com PDF, stripa o valor antes de passar ao preview
  // para que o SVG mostre o mockup limpo (sem <image href> quebrado).
  const safeValues: Record<string, any> = pdfField
    ? { ...values, [pdfField.fieldId]: undefined }
    : values;

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

      {/* Nota discreta quando o cliente enviou um PDF */}
      {pdfField && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: "rgba(100,116,139,0.10)", // T.ink3 @ 10%
            borderWidth: 1,
            borderColor: "rgba(100,116,139,0.20)",
            // Não ultrapassa a largura do preview
            maxWidth: size,
          }}
          accessibilityRole="text"
          accessibilityLabel="PDF enviado. Pré-visualização indisponível."
        >
          {/* Ícone de documento — texto puro, sem dependência de lib de ícone */}
          <Text style={{ fontSize: 12, color: T.ink3 }}>📄</Text>
          <Text
            style={{
              fontSize: 11,
              color: T.ink3,
              fontWeight: "600",
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            PDF enviado — pré-visualização indisponível
          </Text>
        </View>
      )}
    </View>
  );
}

/** Tamanho padrão para o configurador (responsivo) */
export function defaultConfiguratorSize(): number {
  return Math.min(320, Platform.OS === "web" ? 320 : 280);
}
