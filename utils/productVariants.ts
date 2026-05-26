import type { CustomizationConfig } from "@/services/studioApi";

// Variante elegível pra usar como multiplier de insumo.
// Hoje suportamos campos do tipo "option" e "color" — esses sao os unicos
// que tem choices com valores discretos identificaveis (P/M/G, branco/preto, etc).
// Campos "text", "image" e "template" NAO geram variantes (sao livres/continuos).
export type ProductVariant = {
  fieldId: string;      // ex: "f_1734567890_0"
  fieldLabel: string;   // ex: "Tamanho"
  fieldType: "option" | "color";
  values: Array<{
    value: string;      // ex: "p"
    label: string;      // ex: "Pequeno"
  }>;
};

/**
 * Extrai variantes elegíveis pra multiplier de insumo do customization_config.
 *
 * Regras:
 * - Field tipo "option" com choices não-vazio → variante
 * - Field tipo "color" com colors[] ou choices não-vazio → variante (cada cor é um value)
 * - Field tipo "text", "image", "template" → NAO sao variantes
 * - Field sem id ou label vazio → ignora silenciosamente (defensivo)
 * - Choices duplicados (mesmo value) → deduplica mantendo primeira ocorrência
 *
 * @param config customization_config do produto (pode ser null/undefined)
 * @returns lista de variantes (vazia se nenhum field elegível)
 */
export function extractProductVariants(config: CustomizationConfig | null | undefined): ProductVariant[] {
  if (!config || !Array.isArray(config.fields)) return [];

  const variants: ProductVariant[] = [];

  for (const f of config.fields) {
    if (!f || typeof f !== "object") continue;
    const id = typeof f.id === "string" && f.id.trim() ? f.id : null;
    const label = typeof f.label === "string" && f.label.trim() ? f.label : null;
    if (!id || !label) continue;

    if (f.type === "option") {
      const choices = Array.isArray(f.config?.choices) ? f.config.choices : [];
      const values = choices
        .filter((c: any) => c && typeof c.value === "string" && c.value.trim())
        .map((c: any) => ({
          value: String(c.value),
          label: typeof c.label === "string" && c.label.trim() ? c.label : String(c.value),
        }));
      if (values.length === 0) continue;
      // dedup
      const seen = new Set<string>();
      const dedup = values.filter((v) => {
        if (seen.has(v.value)) return false;
        seen.add(v.value);
        return true;
      });
      variants.push({ fieldId: id, fieldLabel: label, fieldType: "option", values: dedup });
    } else if (f.type === "color") {
      // color tem 2 formas legacy: config.colors (string[]) ou config.choices (rich)
      const choices = Array.isArray(f.config?.choices) ? f.config.choices : [];
      const colors = Array.isArray(f.config?.colors) ? f.config.colors : [];
      let values: Array<{ value: string; label: string }> = [];

      if (choices.length > 0) {
        values = choices
          .filter((c: any) => c && typeof c.value === "string" && c.value.trim())
          .map((c: any) => ({
            value: String(c.value),
            label: typeof c.label === "string" && c.label.trim() ? c.label : String(c.value),
          }));
      } else if (colors.length > 0) {
        values = colors
          .filter((c: any) => typeof c === "string" && c.trim())
          .map((c: string) => ({ value: c, label: c }));
      }

      if (values.length === 0) continue;
      const seen = new Set<string>();
      const dedup = values.filter((v) => {
        if (seen.has(v.value)) return false;
        seen.add(v.value);
        return true;
      });
      variants.push({ fieldId: id, fieldLabel: label, fieldType: "color", values: dedup });
    }
    // text, image, template: skip
  }

  return variants;
}

/**
 * Helper: verifica se um insumo na composição tem multiplier configurado
 * pra alguma variante. Útil pra UI mostrar badge "Por variante".
 */
export function hasVariantMultiplier(
  multiplier: Record<string, Record<string, number>> | null | undefined
): boolean {
  if (!multiplier || typeof multiplier !== "object") return false;
  return Object.keys(multiplier).length > 0;
}

/**
 * Helper: calcula o multiplier médio de uma variante (pra mostrar
 * "custo médio por unidade" no footer da ficha técnica).
 */
export function averageMultiplier(
  multiplier: Record<string, Record<string, number>> | null | undefined,
  fieldId: string
): number {
  if (!multiplier || !multiplier[fieldId]) return 1;
  const values = Object.values(multiplier[fieldId]).filter((n) => typeof n === "number" && !isNaN(n));
  if (values.length === 0) return 1;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}
