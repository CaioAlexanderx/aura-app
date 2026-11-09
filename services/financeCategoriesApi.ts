// ============================================================
// AURA. — Categorias e subcategorias do Financeiro (09/11/2026)
//
// Aura-backend: src/routes/financeCategories.js (migration 434).
//   GET    /companies/:id/finance-categories
//   POST   /companies/:id/finance-categories
//   PATCH  /companies/:id/finance-categories/:catId
//   POST   /companies/:id/finance-categories/:catId/merge
//
// Por loja (decisão 1 do Caio): tudo pela empresa da URL. "Em todas as minhas
// lojas" vai em `todas_as_lojas` no POST.
// ============================================================
import { request } from "@/services/api";

export type KindDaCategoria = "income" | "expense";

export type Subcategoria = {
  id: string;
  kind: KindDaCategoria;
  parent_id: string;
  name: string;
  color: string | null;
  is_system: boolean;
  manual: boolean;
  sort_order: number;
  archived_at: string | null;
  count: number;
};

export type CategoriaFinanceira = {
  id: string;
  kind: KindDaCategoria;
  parent_id: null;
  name: string;
  color: string | null;
  dre_line: string | null;
  dre_label: string | null;
  /** "usada pela Aura": não renomeia nem arquiva; aceita subcategoria. */
  is_system: boolean;
  /** false = só o sistema grava (troca, taxa da maquininha): fora da escolha. */
  manual: boolean;
  sort_order: number;
  archived_at: string | null;
  /** Lançamentos do ano, somando as subcategorias. */
  count: number;
  /** Lançamentos do ano sem subcategoria. */
  count_direct: number;
  subcategories: Subcategoria[];
};

export type LinhaDoDre = { key: string; label: string };

export type ListaDeCategorias = {
  categories: CategoriaFinanceira[];
  ano: number;
  lojas: number;
  pode_todas_as_lojas: boolean;
  dre_lines: Record<KindDaCategoria, LinhaDoDre[]>;
};

export type NovaCategoria = {
  kind?: KindDaCategoria;
  name: string;
  parent_id?: string;
  color?: string | null;
  dre_line?: string;
  subcategories?: string[];
  todas_as_lojas?: boolean;
};

export type ResultadoDaCriacao = {
  category: CategoriaFinanceira | Subcategoria;
  criadas_em: string[];
  ja_existia_em: string[];
};

export var financeCategoriesApi = {
  listar: function(cid: string, opts?: { incluirArquivadas?: boolean }) {
    return request<ListaDeCategorias>(
      "/companies/" + cid + "/finance-categories" + (opts && opts.incluirArquivadas ? "?include_archived=1" : ""),
      { retry: 1 },
    );
  },
  criar: function(cid: string, body: NovaCategoria) {
    return request<ResultadoDaCriacao>("/companies/" + cid + "/finance-categories", { method: "POST", body: body, retry: 0 });
  },
  atualizar: function(cid: string, catId: string, body: { name?: string; color?: string | null; dre_line?: string; archived?: boolean }) {
    return request<{ category: CategoriaFinanceira; lancamentos_renomeados: number }>(
      "/companies/" + cid + "/finance-categories/" + catId, { method: "PATCH", body: body, retry: 0 },
    );
  },
  juntar: function(cid: string, catId: string, targetId: string) {
    return request<{ moved: number }>(
      "/companies/" + cid + "/finance-categories/" + catId + "/merge", { method: "POST", body: { target_id: targetId }, retry: 0 },
    );
  },
};
