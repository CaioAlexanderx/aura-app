// ============================================================
// AURA. — Fornecedores (backend src/routes/suppliers.js, migration 342)
//
// 25/09/2026: primeira tela do app para fornecedores (/fornecedores).
// O backend existia desde a Fase 1 (16/09) sem nenhum cliente no app.
// ============================================================
import { request } from "@/services/api";

export type Supplier = {
  id: string;
  company_id: string;
  name: string;
  cnpj: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  product_count?: number;
  created_at?: string;
};

export type SupplierDetail = Supplier & {
  products: Array<{ id: string; name: string; sku: string | null; stock_qty: number | string; price: number | string; is_active: boolean }>;
};

export type SupplierBody = {
  name: string;
  cnpj?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

/** GET /suppliers/cnpj/:cnpj — `existing` preenchido quando o CNPJ já está cadastrado no grupo. */
export type CnpjLookup = {
  cnpj: string;
  existing: { id: string; name: string } | null;
  name?: string;
  legal_name?: string;
  trade_name?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  is_active?: boolean;
  situation?: string;
};

const base = (cid: string) => "/companies/" + cid + "/suppliers";

export const suppliersApi = {
  list: (cid: string) => request<{ suppliers: Supplier[]; total: number }>(base(cid) + "?active=true", { retry: 1 }),
  get: (cid: string, sid: string) => request<SupplierDetail>(base(cid) + "/" + sid, { retry: 1 }),
  create: (cid: string, body: SupplierBody) => request<Supplier>(base(cid), { method: "POST", body, retry: 0 }),
  update: (cid: string, sid: string, body: Partial<SupplierBody> & { is_active?: boolean }) =>
    request<Supplier>(base(cid) + "/" + sid, { method: "PATCH", body, retry: 0 }),
  remove: (cid: string, sid: string) => request<any>(base(cid) + "/" + sid, { method: "DELETE", retry: 0 }),
  lookupCnpj: (cid: string, cnpj: string) =>
    request<CnpjLookup>(base(cid) + "/cnpj/" + cnpj.replace(/\D/g, ""), { retry: 0, timeout: 12000 }),
  linkProducts: (cid: string, sid: string, productIds: string[], unlink = false) =>
    request<{ updated: number; unlink: boolean }>(base(cid) + "/" + sid + "/products", {
      method: "POST", body: { product_ids: productIds, unlink }, retry: 0, timeout: 20000,
    }),
};

// ============================================================
// 03/11/2026 — Fornecedores do produto e entrada de mercadoria
// (Aura-backend#950, migration 424; utils/entradaDeMercadoria.ts).
// ============================================================

export type FornecedorDoProduto = {
  supplier_id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  /** Some para quem não vê custo (o backend corta). */
  cost?: number | null;
  supplier_code: string | null;
  is_main: boolean;
  last_purchase_at: string | null;
};

export type ComprasDoProduto = {
  por_fornecedor: Array<{
    supplier_id: string; supplier_name: string; quantity: number | null;
    unit_cost?: number | null; avg_cost?: number | null; last_purchase_at: string | null;
  }>;
  entradas: Array<{
    id: string; created_at: string; quantity: number | null; unit_cost?: number | null; notes: string | null;
    variant_id: string | null; supplier_id: string | null; supplier_name: string | null;
    company_id: string; company_name: string | null;
  }>;
  product: { id: string; stock_qty: number | null; cost_price?: number | null; avg_cost?: number | null } | null;
  indisponivel?: boolean;
};

export type ResultadoDaEntrada = {
  supplier: { id: string; name: string; created: boolean } | null;
  quantity: number;
  unit_cost?: number | null;
  before: { stock_qty: number; avg_cost?: number | null };
  after: { stock_qty: number; avg_cost?: number | null };
};

const doProduto = (cid: string, pid: string) => "/companies/" + cid + "/products/" + pid;

export const fornecedoresDoProdutoApi = {
  list: (cid: string, pid: string) =>
    request<{ suppliers: FornecedorDoProduto[]; indisponivel?: boolean }>(doProduto(cid, pid) + "/suppliers", { retry: 1 }),
  save: (cid: string, pid: string, body: { suppliers: Array<Record<string, unknown>> }) =>
    request<{ suppliers: FornecedorDoProduto[] }>(doProduto(cid, pid) + "/suppliers", { method: "PUT", body, retry: 0 }),
  compras: (cid: string, pid: string) =>
    request<ComprasDoProduto>(doProduto(cid, pid) + "/stock-entries", { retry: 1 }),
  darEntrada: (cid: string, pid: string, body: Record<string, unknown>) =>
    request<ResultadoDaEntrada>(doProduto(cid, pid) + "/stock-entries", { method: "POST", body, retry: 0 }),
  /** Vínculo em lote (tela 9). is_main padrão true (o de sempre). */
  vincularEmLote: (cid: string, sid: string, productIds: string[], opts: { is_main?: boolean; cost?: number | null } = {}) =>
    request<{ updated: number }>("/companies/" + cid + "/suppliers/" + sid + "/products", {
      method: "POST",
      body: { product_ids: productIds, ...(opts.is_main === false ? { is_main: false } : {}), ...(opts.cost ? { cost: opts.cost } : {}) },
      retry: 0, timeout: 20000,
    }),
};
