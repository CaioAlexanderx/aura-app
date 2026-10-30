// ============================================================================
// AURA. — Etiquetas: gerar código de barras para quem está sem código
// (30/10/2026, card p-75; backend p-74)
//
//   POST /companies/:cid/products/barcodes/generate
//   Body: { targets: [{ product_id, variant_id|null }], dry_run }   (máx. 500)
//   200:  { dry_run, items: [{ product_id, variant_id, barcode }],
//           skipped: [{ product_id, variant_id, reason }] }
//
// O código vai para a etiqueta e para o bipe do Caixa, então a tela sempre
// mostra a PRÉVIA (dry_run) antes de guardar. O backend nunca sobrescreve
// código existente.
//
// Backend antigo (rota ausente, 404) ou quem não pode editar produto (403):
// o botão Gerar código não aparece (sondarGerarCodigos).
// Puro, sem React — testável direto e usado por PrintLabels.tsx.
// ============================================================================
import { request } from "@/services/api";
import { produtoSemCodigo, varianteSemCodigo, temEstoque, estoqueDaVariante } from "@/utils/etiquetasFiltro";

export const MAX_ALVOS_POR_CHAMADA = 500;

export type AlvoCodigo = { product_id: string; variant_id: string | null; nome: string; comEstoque: boolean };
export type CodigoGerado = { product_id: string; variant_id: string | null; barcode: string };
export type ResultadoGerar = { items: CodigoGerado[]; skipped: Array<{ product_id: string; variant_id: string | null; reason: string }> };

function caminho(companyId: string) {
  return "/companies/" + companyId + "/products/barcodes/generate";
}

/**
 * A rota existe e a pessoa pode usar? Manda uma lista vazia: o backend novo
 * responde 400 (lista vazia) antes de qualquer gravação; o antigo, 404.
 */
export async function sondarGerarCodigos(companyId: string): Promise<boolean> {
  if (typeof request !== "function") return false;
  try {
    await request<any>(caminho(companyId), { method: "POST", body: { targets: [], dry_run: true }, retry: 0 });
    return true;
  } catch (e: any) {
    var st = e && typeof e.status === "number" ? e.status : 0;
    return st === 400 || st === 422;
  }
}

/** Gera (dry_run = prévia, nada gravado) em pedaços de 500, um depois do outro. */
export async function gerarCodigos(companyId: string, alvos: readonly AlvoCodigo[], dryRun: boolean): Promise<ResultadoGerar> {
  var out: ResultadoGerar = { items: [], skipped: [] };
  for (var i = 0; i < alvos.length; i += MAX_ALVOS_POR_CHAMADA) {
    var pedaco = alvos.slice(i, i + MAX_ALVOS_POR_CHAMADA);
    var res: any = await request<any>(caminho(companyId), {
      method: "POST",
      body: { targets: pedaco.map(function(a) { return { product_id: a.product_id, variant_id: a.variant_id }; }), dry_run: dryRun },
      retry: 0,
      timeout: 30000,
    });
    out.items = out.items.concat(Array.isArray(res && res.items) ? res.items : []);
    out.skipped = out.skipped.concat(Array.isArray(res && res.skipped) ? res.skipped : []);
  }
  return out;
}

/**
 * Quem está sem código entre os produtos dados. Produto sem variantes (ou
 * com as variantes carregadas e nenhuma ativa) = o produto; com variantes
 * carregadas = cada variante sem código. Variantes ainda não carregadas
 * ficam de fora (não dá para saber).
 */
export function alvosSemCodigo(produtos: readonly any[], variantCache: Record<string, any[]>, nomeDaVariante?: (p: any, v: any) => string): AlvoCodigo[] {
  var out: AlvoCodigo[] = [];
  produtos.forEach(function(p) {
    if (!produtoSemCodigo(p)) return;
    var vs = variantCache[p.id];
    if (!p.has_variants || (vs && vs.length === 0)) {
      out.push({ product_id: p.id, variant_id: null, nome: p.name, comEstoque: temEstoque(p) });
      return;
    }
    if (!vs) return;
    vs.forEach(function(v) {
      if (!varianteSemCodigo(v, p)) return;
      var nome = nomeDaVariante ? nomeDaVariante(p, v) : p.name;
      out.push({ product_id: p.id, variant_id: v.id, nome: nome, comEstoque: estoqueDaVariante(v) > 0 });
    });
  });
  return out;
}

/** Chave do alvo: a variante quando há, senão o produto. */
export function chaveDoAlvo(a: { product_id: string; variant_id: string | null }): string {
  return a.variant_id || a.product_id;
}
