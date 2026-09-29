// ============================================================
// components/studio/orcamentoVideo/modeloDaPeca.ts
//
// O modelo de mockup da peça do orçamento (29/09/2026, backend 364).
//
// Cada item do orçamento pode trocar o modelo só naquele orçamento
// (studio_quote_items.visual_template_key). null = herda do produto;
// SEM_MODELO = a lojista tirou o mockup só aqui. O vídeo 3D lê o modelo
// do item antes do modelo do produto.
//
// Arquivo à parte de pecaDoOrcamento.ts de propósito: lá mora a arte
// (tamanho, posição, cores), que muda por outro caminho.
// ============================================================
import { studioVisualApi } from "@/services/studioVisualApi";
import { carregarFontes, type FontesDaPeca } from "./pecaDoOrcamento";

/** `visual_template_key` do item quando o mockup foi tirado só neste orçamento. */
export const SEM_MODELO = "sem-mockup";

/**
 * As fontes da peça (personalização + modelo), com o modelo do item no
 * lugar do modelo do produto quando a lojista trocou no orçamento.
 */
export async function carregarFontesDaPeca(
  companyId: string,
  productId: string,
  chaveDoItem: string | null | undefined,
): Promise<FontesDaPeca> {
  const base = await carregarFontes(companyId, productId);
  if (!chaveDoItem) return base;
  if (chaveDoItem === SEM_MODELO) return { ...base, template: null };
  const r = await studioVisualApi.getVisualTemplate(companyId, chaveDoItem).catch(() => null);
  // Modelo arquivado ou fora do ar: fica o do produto, como a vitrine faz.
  return r?.template ? { ...base, template: r.template } : base;
}
