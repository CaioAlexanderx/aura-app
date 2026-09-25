// ============================================================
// AURA. — Filtros da tela de Etiquetas (25/09/2026)
//
// Antes só havia a busca. O caso que motivou: mercadoria nova chegou,
// foi cadastrada, e a lojista quer imprimir SÓ as etiquetas dela —
// "Cadastrados hoje" + "Selecionar todos" resolve sem caçar produto por
// produto.
//
//   · ordem: a mesma do Estoque (utils/productSort), padrão "mais recentes";
//   · cadastrados: hoje / 7 dias / 30 dias / todos (dia civil de São Paulo
//     para "hoje", não 24 horas corridas);
//   · categoria;
//   · só com estoque.
// Função pura: o Icon quebra o Jest, e a regra fica testável aqui.
// ============================================================
import { ordenarProdutos, type OrdemEstoque } from "@/utils/productSort";

export type PeriodoCadastro = "todos" | "hoje" | "7d" | "30d";

export type FiltroEtiquetas = {
  busca: string;
  ordem: OrdemEstoque;
  periodo: PeriodoCadastro;
  categoria: string | null;
  soComEstoque: boolean;
};

export const FILTRO_PADRAO: FiltroEtiquetas = {
  busca: "", ordem: "recent", periodo: "todos", categoria: null, soComEstoque: false,
};

export const ORDENS_ETIQUETAS: { key: OrdemEstoque; label: string }[] = [
  { key: "recent", label: "Mais recentes" },
  { key: "name_asc", label: "Nome A–Z" },
  { key: "name_desc", label: "Nome Z–A" },
  { key: "price_desc", label: "Maior preço" },
  { key: "price_asc", label: "Menor preço" },
  { key: "low_stock", label: "Menor estoque" },
];

export const PERIODOS: { key: PeriodoCadastro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
];

export type ProdutoEtiqueta = {
  id: string;
  name: string;
  code?: string | null;
  barcode?: string | null;
  category?: string | null;
  price?: number | null;
  stock?: number | null;
  created_at?: string | null;
};

const DIA = 86400000;

/** "AAAA-MM-DD" do instante no fuso de São Paulo. */
function diaEmSaoPaulo(ms: number): string {
  // SP é UTC-3 o ano todo desde 2019 (sem horário de verão).
  return new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
}

export function dentroDoPeriodo(createdAt: string | null | undefined, periodo: PeriodoCadastro, agora: number): boolean {
  if (periodo === "todos") return true;
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  if (periodo === "hoje") return diaEmSaoPaulo(t) === diaEmSaoPaulo(agora);
  const dias = periodo === "7d" ? 7 : 30;
  return agora - t <= dias * DIA;
}

export function filtrarEtiquetas<T extends ProdutoEtiqueta>(produtos: readonly T[], f: FiltroEtiquetas, agora: number = Date.now()): T[] {
  const q = f.busca.toLowerCase().trim();
  const lista = produtos.filter((p) =>
    (!q || p.name.toLowerCase().includes(q) || (p.barcode || p.code || "").toLowerCase().includes(q))
    && (!f.categoria || (p.category || "") === f.categoria)
    && (!f.soComEstoque || (Number(p.stock) || 0) > 0)
    && dentroDoPeriodo(p.created_at, f.periodo, agora));
  return ordenarProdutos(lista, f.ordem);
}

export function categoriasDe(produtos: readonly ProdutoEtiqueta[]): string[] {
  const set = new Set<string>();
  produtos.forEach((p) => { if (p.category) set.add(p.category); });
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

/** Quantos filtros (além da busca e da ordem) estão ativos — para o "Limpar filtros". */
export function filtrosAtivos(f: FiltroEtiquetas): number {
  return (f.periodo !== "todos" ? 1 : 0) + (f.categoria ? 1 : 0) + (f.soComEstoque ? 1 : 0);
}

// ── Ordem lembrada no navegador (só desta tela) ─────────────
export const CHAVE_ORDEM_ETIQUETAS = "aura:etiquetas:ordenar";

export function lerOrdemEtiquetas(): OrdemEstoque {
  try {
    if (typeof window === "undefined" || !window.localStorage) return FILTRO_PADRAO.ordem;
    const v = window.localStorage.getItem(CHAVE_ORDEM_ETIQUETAS);
    return ORDENS_ETIQUETAS.some((o) => o.key === v) ? (v as OrdemEstoque) : FILTRO_PADRAO.ordem;
  } catch {
    return FILTRO_PADRAO.ordem;
  }
}

export function salvarOrdemEtiquetas(ordem: OrdemEstoque): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(CHAVE_ORDEM_ETIQUETAS, ordem);
  } catch {
    // sem armazenamento: vale até fechar a tela
  }
}
