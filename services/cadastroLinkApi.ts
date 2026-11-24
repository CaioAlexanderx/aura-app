// ============================================================
// AURA. — Cadastro do cliente por link: chamadas (p-210 e p-211)
//
// Público (sem login, token: null — nem o token do lojista que abrir o
// link no próprio navegador vai junto):
//   GET  /public/cadastro/:token  → { store: {name, logo_url}, expires_at }
//   POST /public/cadastro/:token  → { ok, store: {name} }
// Lojista (autenticado):
//   POST /companies/:id/customer-signup-links            → link + token
//   GET  /companies/:id/customer-signup-links?customer_id → estado e pendências
//   POST /companies/:id/customer-signup-links/:id/resolve → aceitar/manter
// Contrato: Aura-backend, src/routes/customerSignupLinks.js.
// ============================================================
import { request } from "@/services/api";
import type { EstadoDoLink, Pendencia } from "@/utils/cadastroPorLink";

export type LojaDoLink = { name: string; logo_url: string | null };

export type LinkDoCadastro = {
  id: string;
  status: EstadoDoLink;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  filled_fields: string[];
};

export type EstadoDoCadastro = {
  available: boolean;
  link: LinkDoCadastro | null;
  pending: Pendencia[];
  pending_link_id: string | null;
};

export type LinkCriado = {
  link: LinkDoCadastro;
  token: string;
  path: string;
  customer: { id: string; name: string; phone: string | null };
  customer_created: boolean;
};

const publico = (token: string) => "/public/cadastro/" + encodeURIComponent(token);
const base = (companyId: string) => `/companies/${companyId}/customer-signup-links`;

export const cadastroLinkApi = {
  lojaDoLink: (token: string) =>
    request<{ store: LojaDoLink; expires_at: string }>(publico(token), { retry: 1, timeout: 10000, token: null } as any),
  enviar: (token: string, body: Record<string, unknown>) =>
    request<{ ok: true; store: { name: string } }>(publico(token), { method: "POST", body, retry: 0, timeout: 15000, token: null } as any),

  criar: (companyId: string, body: { customer_id: string } | { phone: string; name?: string }) =>
    request<LinkCriado>(base(companyId), { method: "POST", body, retry: 0 }),
  estado: (companyId: string, customerId: string) =>
    request<EstadoDoCadastro>(base(companyId) + "?customer_id=" + encodeURIComponent(customerId), { retry: 1 }),
  resolver: (companyId: string, linkId: string, body: { accept: string[]; keep: string[] }) =>
    request<{ pending: Pendencia[] }>(base(companyId) + "/" + linkId + "/resolve", { method: "POST", body, retry: 0 }),
};
