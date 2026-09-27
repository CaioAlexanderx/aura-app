// ============================================================
// Edição do produto · Personalização — lado ligado sem campo (QA 26/09)
//
// "Tem verso?" ligado, com área e até preço, e nenhum campo com lado
// "Verso": a vitrine só desenha o verso quando há o que o cliente
// preencher nele (texto, foto ou arte). A lojista configurava o verso,
// cobrava por ele e a loja não mostrava nada — sem aviso nenhum.
// ============================================================
import { sideOf } from "./customizationConfig";

export type LadoExtra = "back" | "middle";

export const AVISO_LADO_SEM_CAMPO: Record<LadoExtra, string> = {
  back: "Para o verso aparecer na loja, adicione pelo menos um campo com lado 'Verso'.",
  middle: "Para o meio aparecer na loja, adicione pelo menos um campo com lado 'Meio'.",
};

/**
 * O lado está ligado e nenhum campo (inclusive o envio de arte, que também
 * é um campo com lado) mora nele?
 */
export function ladoSemCampo(
  config: { has_back?: boolean; has_middle?: boolean; fields?: Array<{ side?: string } | null> | null } | null | undefined,
  lado: LadoExtra,
): boolean {
  const ligado = lado === "back" ? !!config?.has_back : !!config?.has_middle;
  if (!ligado) return false;
  const campos = Array.isArray(config?.fields) ? config!.fields! : [];
  return !campos.some((f) => !!f && sideOf(f) === lado);
}
