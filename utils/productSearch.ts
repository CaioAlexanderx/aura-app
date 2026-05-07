// utils/productSearch.ts
//
// Busca textual sobre produtos — paridade entre Estoque e PDV.
//
// Histórico: até 07/05/2026 cada tela tinha sua própria lógica de busca:
//   - Estoque: substring literal lowercase em [name, code, barcode, sku].
//   - PDV: normalizeText (NFD + strip diacritics) + haystack consolidado
//     com name/barcode/sku/code/category/color/size + tokenização AND.
//
// Bug reportado pelo Davi (07/05/2026): Estoque não achava produtos
// digitando palavras contidas no nome quando havia (a) acentos no nome
// e query sem acento ("tenis" vs "Tênis"), (b) ordem invertida das
// palavras ("preto activita" vs "Activita ... Preto"), ou (c) palavras
// que o usuário esperava bater mas estavam em outros campos (cor,
// tamanho, categoria, marca). PDV achava normalmente.
//
// Este módulo extrai a lógica do PDV (que funciona) pra ambos consumirem.
// Adicionalmente, o haystack agora inclui `brand` — se o backend devolver
// marca separada do nome, ainda assim a busca encontra.

export function normalizeText(s: any): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export type SearchableProduct = {
  name?: string | null;
  barcode?: string | null;
  sku?: string | null;
  code?: string | null;
  category?: string | null;
  color?: string | null;
  size?: string | null;
  brand?: string | null;
};

// Constrói uma string única (já normalizada) com todos os campos
// pesquisáveis do produto. Útil quando o consumidor quer cachear via
// useMemo (ex.: PDV monta um Map<id, haystack> pra evitar reprocessar
// a cada digitação).
export function buildProductHaystack(p: SearchableProduct | any): string {
  return normalizeText(
    [
      p?.name,
      p?.barcode,
      p?.sku,
      p?.code,
      p?.category,
      p?.color,
      p?.size,
      p?.brand,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

// Tokeniza a query e exige que TODAS as palavras estejam no haystack
// (AND), em qualquer ordem. Casos cobertos:
//   - "nike" → ["nike"] em "tenis nike air max" → match
//   - "nike air" → ["nike", "air"] → match
//   - "air nike" → ["air", "nike"] → match (ordem invertida; includes
//     literal falharia)
//   - "tenis preto" → match em haystack que junta name+color
//   - "tênis" → match em produto "Tenis ..." (acentos normalizados)
//
// Importante: o `query` recebido aqui pode estar bruto (com acentos /
// maiúsculas). Normalizamos internamente.
export function matchesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  for (const t of terms) {
    if (!haystack.includes(t)) return false;
  }
  return true;
}

// Helper de conveniência: dado um produto e uma query, devolve true/false.
// Útil pra `.filter` direto sem precisar pré-construir o haystack. Em
// listas grandes, prefira `buildProductHaystack` cacheado por id +
// `matchesQuery` pra não normalizar o produto a cada keystroke.
export function productMatchesSearch(
  p: SearchableProduct | any,
  query: string
): boolean {
  if (!query) return true;
  return matchesQuery(buildProductHaystack(p), query);
}
