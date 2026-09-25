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
