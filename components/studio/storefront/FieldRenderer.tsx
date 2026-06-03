// ============================================================
// components/studio/storefront/FieldRenderer.tsx
// Switch por field.type — PONTO DE EXTENSÃO para novos tipos.
//
// COMO ADICIONAR UM NOVO TIPO (ex: "art_service" — Agente H):
//   1. Crie components/studio/storefront/fields/FieldArtService.tsx
//   2. Importe aqui: import { FieldArtService } from "./fields/FieldArtService";
//   3. Adicione o case:
//      if (field.type === "art_service") {
//        return <FieldArtService field={field} value={value} onChange={onChange} />;
//      }
//   Nenhum outro arquivo precisa ser alterado.
//
// CONTRATO (não alterar assinatura):
//   props.field      — CustomizationField (inclui .type e .config)
//   props.value      — any  (valor corrente do customization[field.id])
//   props.onChange   — (v: any) => void  (grava no customization via setFieldValue)
//   props.templates  — lista de templates do produto (passada pro FieldTemplate)
//   props.slug       — slug da loja (passado pro FieldImage para o endpoint de upload)
// ============================================================
import type { CustomizationField, StudioStoreProduct } from "./types";
import { FieldText } from "./fields/FieldText";
import { FieldColor } from "./fields/FieldColor";
import { FieldOption } from "./fields/FieldOption";
import { FieldTemplate } from "./fields/FieldTemplate";
import { FieldImage } from "./fields/FieldImage";

export function FieldRenderer({
  field, value, templates, slug, onChange,
}: {
  field: CustomizationField;
  value: any;
  templates: StudioStoreProduct["templates"];
  slug: string;
  onChange: (v: any) => void;
}) {
  if (field.type === "text") {
    return <FieldText field={field} value={value} onChange={onChange} />;
  }
  if (field.type === "color") {
    return <FieldColor field={field} value={value} onChange={onChange} />;
  }
  if (field.type === "option") {
    return <FieldOption field={field} value={value} onChange={onChange} />;
  }
  if (field.type === "template") {
    return <FieldTemplate field={field} value={value} templates={templates} onChange={onChange} />;
  }
  if (field.type === "image") {
    return <FieldImage field={field} value={value} slug={slug} onChange={onChange} />;
  }
  // PONTO DE EXTENSÃO: adicione novos types aqui (Agentes H, I, etc.)
  // Ex: if (field.type === "art_service") { return <FieldArtService ... />; }
  return null;
}
