// ============================================================
// AURA. — Estoque local depois da venda (p-149, 17/11/2026)
//
// Antes: toda venda do Caixa invalidava ["products", companyId], e o
// catálogo inteiro (GET /products?limit=20000) descia de novo logo depois
// de cada venda — numa loja de 2.000 produtos, um download grande por
// cliente atendido, competindo com a próxima venda.
//
// Agora: o estoque dos itens vendidos baixa na hora no cache (o que o
// servidor gravou) e o catálogo é conferido com o servidor uma vez, um
// tempo depois da última venda (FOLGA_MS). Numa sequência de vendas, uma
// recarga só no fim. Com dois caixas, o estoque mostrado pode atrasar
// alguns segundos; o servidor continua barrando venda sem saldo.
//
// Regras do estoque mostrado (hooks/useProducts.mapApiProduct):
//   - produto simples: stock_qty;
//   - produto com variantes: variants_stock_total (o pai fica zerado).
// Nunca fica negativo (o backend para em zero, utils/vendaSemEstoque).
// ============================================================

export const FOLGA_MS = 20_000;

export type ItemVendido = { product_id?: string | null; variant_id?: string | null; quantity?: number | string | null };

function arredondar(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Quanto saiu de cada produto (pai), separado em simples e por variante. */
function somarSaidas(itens: ItemVendido[]): Map<string, { simples: number; variantes: number }> {
  const saidas = new Map<string, { simples: number; variantes: number }>();
  for (const it of itens || []) {
    if (!it || !it.product_id) continue;
    const q = typeof it.quantity === "number" ? it.quantity : parseFloat(String(it.quantity ?? ""));
    if (!isFinite(q) || q <= 0) continue;
    const atual = saidas.get(it.product_id) || { simples: 0, variantes: 0 };
    if (it.variant_id) atual.variantes += q; else atual.simples += q;
    saidas.set(it.product_id, atual);
  }
  return saidas;
}

function baixar(valor: any, q: number): any {
  if (q <= 0 || valor === undefined || valor === null) return valor;
  const n = parseFloat(String(valor));
  if (!isFinite(n)) return valor;
  const novo = Math.max(0, arredondar(n - q));
  return typeof valor === "number" ? novo : String(novo);
}

/**
 * Devolve o valor do cache ["products", companyId] com o estoque dos itens
 * vendidos já baixado. Mantém o formato que veio ({ products }, { rows } ou
 * array) e não muda o objeto original. Sem nada para baixar, devolve o
 * mesmo objeto.
 */
export function baixarEstoqueNoCache(cached: any, itens: ItemVendido[]): any {
  if (!cached) return cached;
  const saidas = somarSaidas(itens);
  if (saidas.size === 0) return cached;

  const mapear = (arr: any[]): any[] => arr.map((p: any) => {
    const s = p && p.id ? saidas.get(p.id) : undefined;
    if (!s) return p;
    const novo = { ...p };
    if (s.simples > 0) novo.stock_qty = baixar(p.stock_qty, s.simples);
    if (s.variantes > 0) novo.variants_stock_total = baixar(p.variants_stock_total, s.variantes);
    return novo;
  });

  if (Array.isArray(cached)) return mapear(cached);
  if (Array.isArray(cached.products)) return { ...cached, products: mapear(cached.products) };
  if (Array.isArray(cached.rows)) return { ...cached, rows: mapear(cached.rows) };
  return cached;
}

/** Produtos (pai) com variante vendida: o cache do seletor de tamanho sai. */
export function produtosComVarianteVendida(itens: ItemVendido[]): string[] {
  const ids = new Set<string>();
  for (const it of itens || []) if (it && it.product_id && it.variant_id) ids.add(it.product_id);
  return [...ids];
}
