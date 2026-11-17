// ============================================================
// AURA. — Variações do seletor de cor e tamanho em cache (p-150, 17/11/2026)
//
// O VariantPickerModal buscava as variações no servidor a cada abertura
// (~0,2 a 0,5 s, us-west x São Paulo), com o seletor vazio girando. Agora a
// segunda abertura do mesmo produto mostra na hora o que veio da última vez
// e busca de novo por trás: preço e estoque se corrigem em seguida, e o
// servidor continua barrando na venda o que não tem saldo.
//
// Só memória da aba (some no recarregar). Teto de entradas para não crescer
// sem fim num catálogo grande.
// ============================================================

const TETO = 300;
const cache = new Map<string, any[]>();

function chave(companyId: string, productId: string): string {
  return companyId + ":" + productId;
}

export function variacoesEmCache(companyId: string | null | undefined, productId: string | null | undefined): any[] | null {
  if (!companyId || !productId) return null;
  const v = cache.get(chave(companyId, productId));
  return v ? v : null;
}

export function guardarVariacoes(companyId: string | null | undefined, productId: string | null | undefined, variants: any[]): void {
  if (!companyId || !productId || !Array.isArray(variants)) return;
  const k = chave(companyId, productId);
  cache.delete(k); // reinsere no fim: a mais antiga sai primeiro
  cache.set(k, variants);
  while (cache.size > TETO) {
    const primeira = cache.keys().next().value;
    if (primeira === undefined) break;
    cache.delete(primeira);
  }
}

export function esquecerVariacoes(companyId?: string | null, productId?: string | null): void {
  if (companyId && productId) { cache.delete(chave(companyId, productId)); return; }
  cache.clear();
}

/** Mesma lista? (evita remontar o seletor quando a busca de trás não trouxe nada novo) */
export function mesmasVariacoes(a: any[] | null | undefined, b: any[] | null | undefined): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}
