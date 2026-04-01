import { Platform } from "react-native";

// ── Base URL ────────────────────────────────────────────────
const BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

// ── Error class ─────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// ── Token manager (injected by auth store) ──────────────────
let _getToken: (() => string | null) | null = null;
export function setTokenGetter(fn: () => string | null) {
  _getToken = fn;
}

// REL-03: Global 401 handler
let _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: () => void) {
  _onUnauthorized = fn;
}

// ── Core request with retry + timeout ───────────────────────
type RequestOpts = {
  method?: string;
  body?: unknown;
  token?: string | null;
  retry?: number;
  timeout?: number;
};

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, retry = 2, timeout = 10000 } = opts;
  const token = opts.token !== undefined ? opts.token : _getToken?.() || null;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;

      const res = await fetch(`${BASE_URL}${path}`, {
        method, headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });

      if (timer) clearTimeout(timer);
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        if (_onUnauthorized) _onUnauthorized();
        throw new ApiError((data as any).error || "Sessao expirada", 401, data);
      }
      if (res.status === 429 && attempt < retry) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        throw new ApiError((data as any).error || `Erro HTTP ${res.status}`, res.status, data);
      }
      return data as T;
    } catch (err: any) {
      lastError = err;
      if (err instanceof ApiError) throw err;
      if (attempt < retry) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastError || new Error("Erro de rede desconhecido");
}

// ── Types ───────────────────────────────────────────────────
export type LoginResponse = {
  token: string;
  user: { id: string; name: string; email: string; role: string; is_staff?: boolean };
  company: { id: string; name: string; plan: string; onboarding_step: string; trial_active?: boolean; trial_ends_at?: string } | null;
  code_applied?: { type: string; plan: string; discount_pct: number; trial_days: number } | null;
};

export type RegisterBody = {
  name: string; email: string; password: string; company_name: string;
  phone?: string; cnpj?: string; access_code?: string;
};

export type CodeValidation = {
  valid: boolean; type?: string; plan?: string; discount_pct?: number; trial_days?: number; error?: string;
};

export type VerificationResponse = {
  sent?: boolean; destination?: string; expires_in?: number; already_verified?: boolean;
  valid?: boolean; email_verified?: boolean; phone_verified?: boolean; error?: string;
};

// ── Auth API ────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: { email, password }, retry: 1 }),
  register: (body: RegisterBody) =>
    request<LoginResponse>("/auth/register", { method: "POST", body, retry: 1 }),
  me: (token: string) =>
    request<Omit<LoginResponse, "token">>("/auth/me", { method: "POST", token, retry: 1 }),
  validateCode: (code: string) =>
    request<CodeValidation>("/auth/validate-code", { method: "POST", body: { code }, retry: 0 }),
  sendEmailVerification: () =>
    request<VerificationResponse>("/auth/send-verification", { method: "POST", retry: 0 }),
  verifyEmail: (code: string) =>
    request<VerificationResponse>("/auth/verify-email", { method: "POST", body: { code }, retry: 0 }),
  sendPhoneVerification: () =>
    request<VerificationResponse>("/auth/send-phone-verification", { method: "POST", retry: 0 }),
  verifyPhone: (code: string) =>
    request<VerificationResponse>("/auth/verify-phone", { method: "POST", body: { code }, retry: 0 }),
};

// ── Dashboard API ───────────────────────────────────────────
export const dashboardApi = {
  // PERF-01: Single aggregated endpoint (replaces 2-3 separate calls)
  aggregate: (companyId: string, token?: string) =>
    request<any>(`/companies/${companyId}/dashboard`, { token }),

  summary: (companyId: string, token?: string) =>
    request<any>(`/companies/${companyId}/withdrawal/summary`, { token }),

  sparkline: (companyId: string, days?: number, token?: string) =>
    request<any>(`/companies/${companyId}/dashboard/sparkline?days=${days || 7}`, { token }),
};

// ── Companies API ───────────────────────────────────────────
export const companiesApi = {
  get: (companyId: string) => request<any>(`/companies/${companyId}`),
  transactions: (companyId: string, params?: string) =>
    request<any>(`/companies/${companyId}/transactions${params ? "?" + params : ""}`),
  createTransaction: (companyId: string, body: any) =>
    request<any>(`/companies/${companyId}/transactions`, { method: "POST", body }),
  products: (companyId: string) => request<any>(`/companies/${companyId}/products`),
  customers: (companyId: string) => request<any>(`/companies/${companyId}/customers`),
  obligations: (companyId: string) => request<any>(`/companies/${companyId}/obligations`),
  payroll: (companyId: string, body: any) =>
    request<any>(`/companies/${companyId}/payroll/calculate`, { method: "POST", body }),
  dre: (companyId: string, params?: string) =>
    request<any>(`/companies/${companyId}/dre${params ? "?" + params : ""}`),
};

// ── CNPJ API ────────────────────────────────────────────────
export const cnpjApi = {
  lookup: (cnpj: string) =>
    request<any>("/onboarding/cnpj-lookup", { method: "POST", body: { cnpj }, retry: 1 }),
};

// ── Onboarding API ──────────────────────────────────────────
export const onboardingApi = {
  get: (companyId: string) => request<any>(`/companies/${companyId}/onboarding`),
  stepCnpj: (companyId: string, cnpj: string) =>
    request<any>(`/companies/${companyId}/onboarding/step/cnpj`, { method: "POST", body: { cnpj } }),
  stepRegime: (companyId: string, tax_regime: string) =>
    request<any>(`/companies/${companyId}/onboarding/step/regime`, { method: "POST", body: { tax_regime } }),
  stepPerfil: (companyId: string, body: any) =>
    request<any>(`/companies/${companyId}/onboarding/step/perfil`, { method: "POST", body }),
};

// ── Referrals API ───────────────────────────────────────────
export const referralsApi = {
  generate: () => request<{ code: string; existing: boolean }>("/referrals/generate", { method: "POST" }),
  mine: () => request<any>("/referrals/mine"),
};

// ── PDV / Sales API ─────────────────────────────────────────
export const pdvApi = {
  createSale: (companyId: string, body: any) =>
    request<any>(`/companies/${companyId}/pdv/sales`, { method: "POST", body }),
};

// ── Admin API ───────────────────────────────────────────────
export const adminApi = {
  dashboard: () => request<any>("/admin/dashboard"),
  clients: () => request<any>("/admin/clients"),
  toggleModule: (companyId: string, module: string, enabled: boolean) =>
    request<any>(`/admin/clients/${companyId}/modules`, { method: "PUT", body: { module, enabled } }),
};

export { request, BASE_URL };
