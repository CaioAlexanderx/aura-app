import { request } from "./api";

// ─── Tipos ──────────────────────────────────────────────────────────────
// Espelha o objeto Category do contrato congelado (aura-backend
// docs/CONTRACT_CATEGORIES.md, secao 2, commit e1239d4b599b96617eeba37).
// slug/path/depth sao calculados por trigger no banco -- somente leitura
// aqui, nunca montados no cliente.
//
// F0 e product-only (contrato secao 0): todo endpoint NOVO opera fixo em
// type='product' e nao aceita o parametro. O campo `type` sobrevive no
// payload por retrocompatibilidade -- os hooks novos nunca o enviam.
export type Category = {
  id: string;
  company_id: string;
  type: "product";
  parent_id: string | null;
  name: string;
  slug: string;
  path: string;
  depth: 0 | 1 | 2;
  sort_order: number;
  color: string | null;
  image_url: string | null;
  banner_url: string | null;
  is_visible_storefront: boolean;
  seo_title: string | null;
  seo_description: string | null;
  product_count: number;
  // presentes apenas em GET /tree (contrato secao 4)
  product_count_total?: number;
  children?: Category[];
};

export type CategoryListResponse = { categories: Category[]; total: number; type: "product" };

// GAP DE CONTRATO: a secao 3 nao mostra o envelope JSON de GET /tree (so
// descreve "arvore aninhada, com product_count_total"). Assumido aqui como
// { categories: Category[] } por simetria com GET /, que tem shape
// explicito { categories, total, type }. Precisa confirmar com o B1 --
// ver corpo do PR.
export type CategoryTreeResponse = { categories: Category[] };

export type CreateCategoryBody = {
  name: string;
  parent_id?: string | null;
  color?: string | null;
  sort_order?: number;
};

export type AssignProductCategoriesBody = {
  primary_category_id: string;
  also_in: string[];
};

// PUT /products/:productId/categories -- shape confirmado contra o
// backend real (PRs #440/#441, ver revisao do orquestrador em 30/07).
export type AssignProductCategoriesResponse = {
  product_id: string;
  primary_category_id: string;
  also_in: string[];
};

// GAP DE CONTRATO: secao 4 nao define o shape de resposta de
// GET /products/unclassified alem de "orfaos paginados". Assumido um
// envelope { products, total } -- precisa confirmar com B1/B2.
export type UnclassifiedProduct = Record<string, any> & { id: string; name: string };
export type UnclassifiedProductsResponse = { products: UnclassifiedProduct[]; total: number };

export type UnclassifiedParams = {
  q?: string;
  has_stock?: boolean;
  limit?: number;
  offset?: number;
};

// POST /products/categories/bulk (contrato secao 4). Motor da atribuicao
// em lote da tela "A organizar" (Bloco C1). Mesma base implicita de
// /products/unclassified nesta tabela -- nao ha "Base:" redeclarada pro
// endpoint, entao segue o padrao dos vizinhos na mesma secao.
export type BulkAssignMode = "replace_primary" | "add_secondary";
export type BulkAssignCategoriesBody = {
  product_ids: string[];
  primary_category_id: string;
  mode: BulkAssignMode;
};
export type BulkAssignCategoriesResponse = {
  updated: number;
  mode: BulkAssignMode;
  primary_category_id: string;
};

// ─── Migracao (contrato secao 5) ───────────────────────────────────────
// Nenhuma logica de classificacao aqui -- so tipos + chamadas finas. Os
// hooks so transportam a decisao do lojista. Ver useCategoryMigration.ts.
export type MigrationStatus = {
  state: string;
  total: number;
  approved: number;
  applied: number;
  orphans: number;
};

// Nomes de campo confirmados contra o backend real: sao as colunas de
// category_migration_staging (product_count, sample_product_names), nao
// os nomes genericos que eu tinha assumido antes da revisao.
export type MigrationProposalItem = {
  id: string;
  raw_value: string;
  product_count: number;
  sample_product_names: string[];
  kind?: "existing" | "new" | "ignore" | null;
  target_path?: string | null;
  status?: string;
};
// O envelope tem `orphan` (a linha orfa do diagnostico, sem raw_value de
// categoria) alem de `items` -- confirmado contra o backend, necessario
// pro wizard do Bloco C2.
export type MigrationProposalResponse = {
  items: MigrationProposalItem[];
  orphan: MigrationProposalItem | null;
};

export type MigrationItemPatchBody = {
  kind: "existing" | "new" | "ignore";
  target_path?: string;
  status?: string;
};

// Nome de campo confirmado contra o backend real: product_count (mesmo
// padrao de MigrationProposalItem), nao `count`.
export type BrandCandidate = { token: string; product_count: number };
export type BrandCandidatesResponse = { candidates: BrandCandidate[] };

export type ApplyBrandBody = { assignments: Array<{ token: string; brand: string }> };
// POST /products/brand/apply -- shape confirmado contra o backend real.
export type ApplyBrandResponse = {
  results: Array<{ token: string; brand: string; updated: number }>;
};

const base = (companyId: string) => "/companies/" + companyId + "/product-categories";
const migrationBase = (companyId: string) => "/companies/" + companyId + "/categories/migration";

export const categoriesApi = {
  getTree: (companyId: string) => request<CategoryTreeResponse>(base(companyId) + "/tree"),

  // Rota legada, mas reutilizada pelo picker para busca server-side no
  // futuro. Nunca envia ?type= -- regra 6.1 do briefing B3. O hook filtra
  // type==='product' no cliente como defesa extra.
  getFlat: (companyId: string, params?: { q?: string; depth?: number; parent_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.depth !== undefined) qs.set("depth", String(params.depth));
    if (params?.parent_id) qs.set("parent_id", params.parent_id);
    const suffix = qs.toString() ? "?" + qs.toString() : "";
    return request<CategoryListResponse>(base(companyId) + suffix);
  },

  // type nao vai no body -- POST / tem default 'product' no backend
  // (contrato secao 1). Hooks novos nunca enviam type.
  create: (companyId: string, body: CreateCategoryBody) =>
    request<Category>(base(companyId), { method: "POST", body }),

  assignProductCategories: (companyId: string, productId: string, body: AssignProductCategoriesBody) =>
    request<AssignProductCategoriesResponse>("/companies/" + companyId + "/products/" + productId + "/categories", {
      method: "PUT",
      body,
    }),

  bulkAssignProductCategories: (companyId: string, body: BulkAssignCategoriesBody) =>
    request<BulkAssignCategoriesResponse>(base(companyId) + "/products/categories/bulk", {
      method: "POST",
      body,
    }),

  getUnclassifiedProducts: (companyId: string, params?: UnclassifiedParams) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.has_stock) qs.set("has_stock", "true");
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    if (params?.offset !== undefined) qs.set("offset", String(params.offset));
    const suffix = qs.toString() ? "?" + qs.toString() : "";
    return request<UnclassifiedProductsResponse>(base(companyId) + "/products/unclassified" + suffix);
  },

  // ── Migracao ──
  analyzeMigration: (companyId: string) =>
    request<{ ok: boolean }>(migrationBase(companyId) + "/analyze", { method: "POST" }),

  getMigrationProposal: (companyId: string) =>
    request<MigrationProposalResponse>(migrationBase(companyId) + "/proposal"),

  patchMigrationItem: (companyId: string, itemId: string, body: MigrationItemPatchBody) =>
    request<{ ok: boolean }>(migrationBase(companyId) + "/items/" + itemId, { method: "PATCH", body }),

  applyMigration: (companyId: string) =>
    request<{ ok: boolean }>(migrationBase(companyId) + "/apply", { method: "POST" }),

  getMigrationStatus: (companyId: string) =>
    request<MigrationStatus>(migrationBase(companyId) + "/status"),

  getBrandCandidates: (companyId: string) =>
    request<BrandCandidatesResponse>("/companies/" + companyId + "/products/brand-candidates"),

  applyBrandAssignments: (companyId: string, body: ApplyBrandBody) =>
    request<ApplyBrandResponse>("/companies/" + companyId + "/products/brand/apply", { method: "POST", body }),
};

export default categoriesApi;
