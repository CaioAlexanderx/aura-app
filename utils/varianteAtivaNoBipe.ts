// ============================================================
// AURA. — Bipe achado no servidor: o produto tem tamanho ativo?
//
// 19/10/2026 (tq-30, INC-2026-10-19-01). Quando o código bipado não está na
// lista local, o Caixa e a Troca perguntam ao servidor (/pdv/scan). Se ele
// acha o PAI (pelo código de barras ou pelo SKU do produto), o item entrava
// direto no carrinho sem variant_id: a venda baixava products.stock_qty e
// nenhum tamanho, e a peça continuava "disponível" na soma das variantes.
//
// Regra (Produto, Nina): com pelo menos uma variante ativa, abre o seletor
// de variante (o mesmo do caminho local). Variante ativa = a mesma definição
// do seletor (`is_active !== false`). Sem variante ativa, segue como hoje.
//
// O scan por código de barras do pai já devolve `variants` (só as ativas,
// scanner.js). O scan por SKU não devolve: aí a lista vem do mesmo endpoint
// que o seletor usa. Se essa consulta falhar, segue como hoje (entra
// direto): o seletor também não teria tamanho para mostrar.
// ============================================================
import { companiesApi } from "@/services/api";

export function ehVarianteAtiva(v: any): boolean {
  return !!v && v.is_active !== false;
}

type BuscarVariantes = (companyId: string, productId: string) => Promise<{ variants?: any[] } | null | undefined>;

export async function temVarianteAtiva(
  companyId: string,
  product: any,
  buscar: BuscarVariantes = (c, p) => companiesApi.variants(c, p),
): Promise<boolean> {
  if (!product || !product.id) return false;
  if (Array.isArray(product.variants)) return product.variants.some(ehVarianteAtiva);
  try {
    const res = await buscar(companyId, product.id);
    return Array.isArray(res?.variants) && res!.variants!.some(ehVarianteAtiva);
  } catch {
    return false;
  }
}
