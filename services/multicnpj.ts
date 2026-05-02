// ============================================================
// AURA. — Multi-CNPJ services (M1-05)
// Wraps backend Multi-CNPJ endpoints (M1-02, M1-03, M1-04).
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

// ── APIs ───────────────────────────────────────────────────

// Endpoints user-level (lista detalhada + criação)
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
export var PLAN_PRICES: Record<string, number> = {
  essencial: 89,
  negocio: 169,
  expansao: 269,
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
