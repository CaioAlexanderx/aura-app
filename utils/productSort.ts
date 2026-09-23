// ============================================================
// AURA. — Ordenação "Últimos adicionados" (Estoque)
//
// 23/09/2026 (QA producao, item 10): "Últimos adicionados" ordenava em
// ordem alfabética — produto recém-criado/importado não vinha para o
// topo. Causa: GET /products já devolvia created_at, mas
// hooks/useProducts.ts (mapApiProduct) nunca mapeava esse campo pro
// Product — os dois lados do comparador liam undefined e o sort caía na
// ordem que veio do backend (ORDER BY name ASC).
//
// Função pura, sem React: desc por created_at, desempate por id (produto
// importado em lote grava no mesmo timestamp; sem desempate a ordem
// ficava instável entre re-renders).
// ============================================================

export type ProdutoComCriacao = {
  id: string;
  created_at?: string | null;
};

export function compareByRecent(a: ProdutoComCriacao, b: ProdutoComCriacao): number {
  const diff = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  if (diff !== 0) return diff;
  return String(a.id).localeCompare(String(b.id));
}

// ============================================================
// 23/09/2026: ordem alfabética (A–Z / Z–A) + a escolha do lojista fica
// lembrada no navegador.
//
// Nome comparado com Intl.Collator pt-BR (mesmo resultado de
// localeCompare('pt-BR', { sensitivity: 'base', numeric: true })):
//   - "Piso 10" vem depois de "Piso 9" (numeric);
//   - "Água", "agua" e "AGUA" contam como iguais (sensitivity base), então
//     acento e maiúscula não jogam o produto para o fim da lista.
// Empate de nome: o mais recente primeiro (compareByRecent), para a ordem
// não pular entre re-renders.
// ============================================================

export type OrdemEstoque =
  | "recent"
  | "name_asc"
  | "name_desc"
  | "price_desc"
  | "price_asc"
  | "low_stock";

export const ORDENS_ESTOQUE: readonly OrdemEstoque[] = [
  "recent",
  "name_asc",
  "name_desc",
  "price_desc",
  "price_asc",
  "low_stock",
];

export const ROTULOS_ORDEM: Record<OrdemEstoque, string> = {
  recent: "🕐 Últimos adicionados",
  name_asc: "🔤 A–Z",
  name_desc: "🔤 Z–A",
  price_desc: "↑ Maior preço",
  price_asc: "↓ Menor preço",
  low_stock: "⚠ Menor estoque",
};

export const ORDEM_PADRAO: OrdemEstoque = "recent";

export type ProdutoOrdenavel = ProdutoComCriacao & {
  name?: string | null;
  price?: number | null;
  stock?: number | null;
};

const colacaoNome =
  typeof Intl !== "undefined" && typeof Intl.Collator === "function"
    ? new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true })
    : null;

function nomeDe(p: ProdutoOrdenavel): string {
  return String(p.name ?? "").trim();
}

function compararSoNome(a: ProdutoOrdenavel, b: ProdutoOrdenavel): number {
  const na = nomeDe(a);
  const nb = nomeDe(b);
  return colacaoNome
    ? colacaoNome.compare(na, nb)
    : na.localeCompare(nb, "pt-BR", { sensitivity: "base", numeric: true });
}

export function compareByName(a: ProdutoOrdenavel, b: ProdutoOrdenavel): number {
  return compararSoNome(a, b) || compareByRecent(a, b);
}

/** Z–A: só o nome inverte; no empate continua o mais recente primeiro. */
export function compareByNameDesc(a: ProdutoOrdenavel, b: ProdutoOrdenavel): number {
  return compararSoNome(b, a) || compareByRecent(a, b);
}

function comparadorDe(ordem: OrdemEstoque): ((a: ProdutoOrdenavel, b: ProdutoOrdenavel) => number) | null {
  switch (ordem) {
    case "recent":
      return compareByRecent;
    case "name_asc":
      return compareByName;
    case "name_desc":
      return compareByNameDesc;
    case "price_desc":
      return (a, b) => (b.price ?? 0) - (a.price ?? 0);
    case "price_asc":
      return (a, b) => (a.price ?? 0) - (b.price ?? 0);
    case "low_stock":
      return (a, b) => (a.stock ?? 0) - (b.stock ?? 0);
    default:
      return null;
  }
}

/**
 * Devolve uma cópia ordenada. `campos` traduz itens com outro formato
 * (ex.: grupo do estoque consolidado multi-CNPJ, que tem avg_price e
 * total_stock) para os campos usados na comparação.
 */
export function ordenarProdutos<T>(
  lista: readonly T[],
  ordem: OrdemEstoque,
  campos?: (item: T) => ProdutoOrdenavel,
): T[] {
  const arr = [...lista];
  const cmp = comparadorDe(ordem);
  if (!cmp) return arr;
  if (!campos) return arr.sort(cmp as unknown as (a: T, b: T) => number);
  return arr.sort((a, b) => cmp(campos(a), campos(b)));
}

// ── Preferência lembrada (só desta tela) ─────────────────────
// localStorage pode não existir (celular nativo) ou jogar erro (aba
// anônima, site bloqueado): qualquer falha cai no padrão, sem quebrar a tela.
export const CHAVE_ORDEM_ESTOQUE = "aura:estoque:ordenar";

function ehOrdem(v: unknown): v is OrdemEstoque {
  return typeof v === "string" && (ORDENS_ESTOQUE as readonly string[]).includes(v);
}

export function lerOrdemSalva(): OrdemEstoque {
  try {
    if (typeof window === "undefined" || !window.localStorage) return ORDEM_PADRAO;
    const v = window.localStorage.getItem(CHAVE_ORDEM_ESTOQUE);
    return ehOrdem(v) ? v : ORDEM_PADRAO;
  } catch {
    return ORDEM_PADRAO;
  }
}

export function salvarOrdem(ordem: OrdemEstoque): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(CHAVE_ORDEM_ESTOQUE, ordem);
  } catch {
    // sem armazenamento: a escolha vale só até fechar a tela
  }
}
