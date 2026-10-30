// ============================================================================
// AURA. — Etiquetas: variantes de vários produtos de uma vez (30/10/2026, p-72)
//
// A tela de etiquetas buscava as variantes com uma chamada por produto; o
// "Marcar todos" disparava uma por produto marcado. O backend novo (p-73)
// devolve as variantes de até 200 produtos numa chamada:
//   GET /companies/:cid/products/variants?product_ids=a,b,c
//   -> { variants_by_product: { "<pid>": [variante, ...] } }
// Produto que a empresa não enxerga vem omitido (tratado como sem variante).
//
// Backend antigo (rota ausente, 404) ou qualquer falha: a tela volta ao
// caminho de sempre, uma chamada por produto, com no máximo 4 ao mesmo tempo.
// Puro, sem React — testável direto e usado por PrintLabels.tsx.
// ============================================================================
import { request } from "@/services/api";

export const MAX_IDS_POR_LOTE = 200;
export const CONCORRENCIA_POR_PRODUTO = 4;

/** Divide a lista em pedaços de no máximo `tamanho`. */
export function emPedacos<T>(lista: readonly T[], tamanho: number): T[][] {
  var out: T[][] = [];
  for (var i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
  return out;
}

/** Roda as tarefas com no máximo `limite` ao mesmo tempo; nunca rejeita. */
export async function comLimite<T>(tarefas: Array<() => Promise<T>>, limite: number): Promise<Array<T | undefined>> {
  var resultados: Array<T | undefined> = new Array(tarefas.length);
  var proxima = 0;
  async function trabalhador() {
    while (proxima < tarefas.length) {
      var i = proxima++;
      try { resultados[i] = await tarefas[i](); } catch { resultados[i] = undefined; }
    }
  }
  var n = Math.max(1, Math.min(limite, tarefas.length));
  var ws: Promise<void>[] = [];
  for (var k = 0; k < n; k++) ws.push(trabalhador());
  await Promise.all(ws);
  return resultados;
}

/**
 * Variantes de até 200 produtos numa chamada. Rejeita se a rota não existir
 * (backend antigo) ou falhar — quem chama cai no caminho por produto.
 * Todo id pedido volta no mapa: omitido pelo backend = [].
 */
export async function buscarVariantesEmLote(companyId: string, ids: readonly string[]): Promise<Record<string, any[]>> {
  if (typeof request !== "function") throw new Error("sem cliente de API");
  var res: any = await request<any>(
    "/companies/" + companyId + "/products/variants?product_ids=" + ids.map(encodeURIComponent).join(","),
    { retry: 0 },
  );
  var mapa = res && res.variants_by_product;
  if (!mapa || typeof mapa !== "object") throw new Error("resposta sem variants_by_product");
  var out: Record<string, any[]> = {};
  ids.forEach(function(id) { out[id] = Array.isArray(mapa[id]) ? mapa[id] : []; });
  return out;
}
