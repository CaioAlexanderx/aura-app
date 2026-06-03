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
// ============================================================
import { Platform } from "react-native";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import type { CustomizationConfig } from "./types";

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
  return (
    <PersonalizationPreview
      config={config}
      values={values}
      size={size}
      productName={productName}
      showLabel={showLabel}
    />
  );
}

/** Tamanho padrão para o configurador (responsivo) */
export function defaultConfiguratorSize(): number {
  return Math.min(320, Platform.OS === "web" ? 320 : 280);
}
