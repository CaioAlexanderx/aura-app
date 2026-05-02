// ============================================================
// AURA. — Multi-CNPJ services (M1-05 + M2-03 + M2-04)
// Wraps backend Multi-CNPJ endpoints (M1-02, M1-03, M1-04,
// M2-03 transfer-primary, M2-04 DELETE + billing-preview).
// Importa o helper `request` do api.ts existente para reusar
// retry, refresh-token, timeout, etc.
// ============================================================
import { request } from "@/services/api";

// ── Tipos ──────────────────────────────────────────────────

export type CompanyPlan = "essencial" | "negocio" | "expansao" | "personalizado";
export type BillingStatus = "active" | "inactive" | "trial" | "overdue" | "cancelled" | string;

// Item do switcher (resposta enxuta de GET /auth/companies)
export type SwitcherCompany = {
  id: string;
  name: string;
  legal_name: string;
  trade_name: string;
  cnpj: string;
  plan: CompanyPlan | string;
  is_primary: boolean;
  vertical: string | null;
  logo_url: string | null;
  billing_status: BillingStatus | null;
  trial_active: boolean;
  role: string;
  is_current: boolean;
};

export type SwitcherListResponse = {
  companies: SwitcherCompany[];
  current_company_id: string | null;
  consolidated_view: boolean;
  total: number;
};

// Item completo (resposta de GET /me/companies)
export type FullCompany = {
  id: string;
  name: string;
  legal_name: string;
  trade_name: string;
  cnpj: string;
  vertical: string | null;
  plan: CompanyPlan | string;
  is_primary: boolean;
  billing_owner_company_id: string | null;
  billing_status: BillingStatus | null;
  logo_url: string | null;
  role: string;
  created_at: string;
};

export type FullListResponse = {
  companies: FullCompany[];
};

// Body pra criar empresa adicional
export type CreateCompanyBody = {
  legal_name: string;
  trade_name?: string;
  cnpj?: string;
  vertical?: string | null;
  tax_regime?: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type BillingPreview = {
  total_companies: number;
  included_in_plan: number;
  extra_cnpjs: number;
  plan_base_price: number;
  extra_unit_price: number;
  extras_price: number;
  new_total_monthly: number;
  note: string;
  // M2-02: status do sync com Asaas
  asaas_synced?: boolean;
  asaas_reason?: string | null;
};

export type CreateCompanyResponse = {
  company: FullCompany;
  billing_preview: BillingPreview;
  message: string;
};

// Erro estruturado de bloqueio por plano (Essencial = 1 CNPJ)
export type PlanLimitError = {
  error: "PLAN_LIMIT_REACHED";
  message: string;
  current_plan: string;
  suggested_plan: string;
  suggested_plan_price: number;
  upgrade_savings_note: string;
};

// Resposta do switch-company (modo empresa específica)
export type SwitchCompanyResponse = {
  token: string;
  token_expires_in: string;
  current_company: {
    id: string;
    name: string;
    legal_name: string;
    trade_name: string;
    cnpj: string;
    plan: CompanyPlan | string;
    vertical: string | null;
    is_primary: boolean;
    module_overrides: Record<string, boolean>;
    billing_status: BillingStatus | null;
    trial_active: boolean;
    trial_ends_at: string | null;
    ai_enabled: boolean;
    ai_consent_at: string | null;
    access_code_used: boolean;
    logo_url: string | null;
    onboarding_step: string | null;
    member_role: string;
  } | null;
  consolidated_view: boolean;
  companies_count?: number;
  message?: string;
};

// M2-04: GET /me/companies/billing-preview — usado antes de criar
// pra mostrar "sua mensalidade vai de R$X pra R$Y"
export type BillingPreviewResponse = {
  current: {
    primary_id: string;
    plan: string;
    base_price: number;
    extra_unit_price: number;
    included_in_plan: number;
    total_companies: number;
    extra_cnpjs: number;
    extras_value: number;
    total_monthly: number;
  };
  if_add_one: {
    total_companies: number;
    extra_cnpjs: number;
    new_total_monthly: number;
    delta_monthly: number;
  };
  can_add: boolean;
  block_reason: string | null;
};

// M2-04: DELETE /me/companies/:id
export type RemoveCompanyResponse = {
  removed: boolean;
  company_id: string;
  company_name: string;
  billing_after: {
    total_companies: number;
    new_total_monthly: number;
  } | null;
  note: string;
};

// M2-03: POST /me/companies/:id/transfer-primary
export type TransferPrimaryResponse = {
  transferred: boolean;
  old_primary: { id: string; name: string };
  new_primary: { id: string; name: string };
  asaas_customer_moved: boolean;
  asaas_subscription_moved: boolean;
  message: string;
  next_step: string;
};

// ── APIs ───────────────────────────────────────────────────

// Endpoints user-level (lista detalhada + criação + remoção + transfer)
export var userCompaniesApi = {
  list: function () {
    return request<FullListResponse>("/me/companies", { retry: 1 });
  },
  create: function (body: CreateCompanyBody) {
    return request<CreateCompanyResponse>("/me/companies", {
      method: "POST",
      body: body,
      retry: 0,
      timeout: 15000,
    });
  },
  // M2-04: preview antes de criar
  billingPreview: function () {
    return request<BillingPreviewResponse>("/me/companies/billing-preview", { retry: 1 });
  },
  // M2-04: soft-delete + sync Asaas
  remove: function (companyId: string) {
    return request<RemoveCompanyResponse>("/me/companies/" + companyId, {
      method: "DELETE",
      retry: 0,
      timeout: 15000,
    });
  },
  // M2-03: torna outra empresa a principal (atômico no backend)
  transferPrimary: function (companyId: string) {
    return request<TransferPrimaryResponse>(
      "/me/companies/" + companyId + "/transfer-primary",
      { method: "POST", retry: 0, timeout: 15000 }
    );
  },
};

// Endpoints auth-level (switcher + troca de contexto)
export var authMulticnpjApi = {
  // GET /auth/companies — alimenta o switcher
  companies: function () {
    return request<SwitcherListResponse>("/auth/companies", { retry: 1 });
  },
  // POST /auth/switch-company — troca contexto e devolve novo access token
  // Passar `null` ou `"all"` ativa o modo consolidado.
  switchCompany: function (companyId: string | null | "all") {
    return request<SwitchCompanyResponse>("/auth/switch-company", {
      method: "POST",
      body: { company_id: companyId },
      retry: 0,
      timeout: 10000,
    });
  },
};

// ── Helpers de pricing (espelha tabela do backend) ────────
// IMPORTANTE: valores idênticos ao billing.js + multicnpjBilling.js
// no backend. Se mudar aqui, mudar lá.
export var PLAN_PRICES: Record<string, number> = {
  essencial: 89,
  negocio: 169.90,
  expansao: 269.90,
};
export var EXTRA_PRICES: Record<string, number> = {
  essencial: 45,
  negocio: 85,
  expansao: 135,
};
export var INCLUDED_CNPJS: Record<string, number> = {
  essencial: 1,
  negocio: 2,
  expansao: 2,
  personalizado: 999,
};

export function planLabel(plan: string): string {
  switch ((plan || "").toLowerCase()) {
    case "essencial":
      return "Essencial";
    case "negocio":
      return "Negócio";
    case "expansao":
      return "Expansão";
    case "personalizado":
      return "Personalizado";
    default:
      return plan || "—";
  }
}

export function maskCnpj(raw: string | null | undefined): string {
  if (!raw) return "";
  var nums = String(raw).replace(/\D/g, "");
  if (nums.length !== 14) return raw;
  return (
    nums.slice(0, 2) +
    "." +
    nums.slice(2, 5) +
    "." +
    nums.slice(5, 8) +
    "/" +
    nums.slice(8, 12) +
    "-" +
    nums.slice(12, 14)
  );
}

// Helper: formata BRL
export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return "R$ " + value.toFixed(2).replace(".", ",");
}
