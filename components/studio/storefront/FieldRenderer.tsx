// ============================================================
// components/studio/storefront/FieldRenderer.tsx
// Switch por field.type — PONTO DE EXTENSÃO para novos tipos.
//
// COMO ADICIONAR UM NOVO TIPO:
//   Siga o padrão abaixo. Cada agente adiciona seu bloco aqui.
//
// CONTRATO (não alterar assinatura):
//   props.field      — CustomizationField (inclui .type e .config)
//   props.value      — any  (valor corrente do customization[field.id])
//   props.onChange   — (v: any) => void  (grava no customization via setFieldValue)
//   props.templates  — lista de templates do produto (passada pro FieldTemplate)
//   props.slug       — slug da loja (passado pro FieldImage para o endpoint de upload)
//   props.values     — Record<string, any> (todos os valores — usado por FieldArtService para briefing)
//   props.onFieldChange — (fieldId: string, v: any) => void  (setFieldValue direto — Agente H)
// ============================================================
import type { CustomizationField, StudioStoreProduct } from "./types";
import { FieldText }       from "./fields/FieldText";
import { FieldColor }      from "./fields/FieldColor";
import { FieldOption }     from "./fields/FieldOption";
import { FieldTemplate }   from "./fields/FieldTemplate";
import { FieldImage }      from "./fields/FieldImage";
import { FieldArtService } from "./fields/FieldArtService";

export function FieldRenderer({
  field, value, templates, slug, onChange,
  values, onFieldChange,
}: {
  field: CustomizationField;
  value: any;
  templates: StudioStoreProduct["templates"];
  slug: string;
  onChange: (v: any) => void;
  // Props adicionais (Agente H) — opcionais para não quebrar callers existentes
  values?: Record<string, any>;
  onFieldChange?: (fieldId: string, v: any) => void;
}) {
  if (field.type === "text") {
    // A cor da arte mora numa chave lateral (`<campo>_cor`), mesmo padrao
    // que `art_service_brief` ja usa. O validador do backend so exige
    // campos obrigatorios preenchidos, entao chave extra nao derruba o
    // pedido e o valor viaja junto ate o banco.
    //
    // PENDENTE: as telas de producao montam a lista a partir de
    // `config.fields`, entao uma chave que nao e campo simplesmente nao
    // aparece. O dado esta salvo; falta exibi-lo pra oficina.
    return (
      <FieldText
        field={field}
        value={value}
        onChange={onChange}
        corValue={values?.[field.id + "_cor"]}
        onCorChange={onFieldChange ? (v) => onFieldChange(field.id + "_cor", v) : undefined}
      />
    );
  }
  if (field.type === "color") {
    return <FieldColor field={field} value={value} onChange={onChange} />;
  }
  // Agente H: art_service é type='option' com is_art_service:true — renderiza componente dedicado
  if (field.type === "option" && field.config?.is_art_service) {
    return (
      <FieldArtService
        field={field}
        value={value}
        briefValue={values?.["art_service_brief"] ?? ""}
        onChange={onChange}
        onBriefChange={(v) => onFieldChange?.("art_service_brief", v)}
      />
    );
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
  // PONTO DE EXTENSÃO: adicione novos types aqui (Agentes I, J, etc.)
  return null;
}
