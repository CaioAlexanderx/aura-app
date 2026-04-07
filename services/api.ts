import { Platform } from "react-native";

// ── Base URL ────────────────────────────────────────────────
const BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

// ── Error class ─────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  data: any;
  isNetworkError: boolean;
  constructor(message: string, status: number, data?: any, isNetworkError = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

// ── Token manager (injected by auth store) ──────────────────
let _getToken: (() => string | null) | null = null;
export function setTokenGetter(fn: () => string | null) {
  _getToken = fn;
}

// REL-03: Global 401 handler — only called on confirmed auth rejection
let _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: () => void) {
  _onUnauthorized = fn;
}

// ── AUTH-02: Refresh result types ────────────────────────────
type RefreshResult =
  | { status: "ok"; token: string }
  | { status: "invalid" }      // session truly expired — logout
  | { status: "network_error" }; // transient failure — do NOT logout

// ── Core request with retry + timeout + auto-refresh ────────
type RequestOpts = {
  method?: string;
  body?: unknown;
  token?: string | null;
  retry?: number;
  timeout?: number;
};

let isRefreshing = false;
let refreshPromise: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  try {
    const { useAuthStore } = await import("@/stores/auth");
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return { status: "invalid" };

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;

    const resp = await fetch(BASE_URL + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: controller?.signal,
    });

    if (timer) clearTimeout(timer);

    if (!resp.ok) {
      // 401/403 from refresh = session truly invalid → logout
      if (resp.status === 401 || resp.status === 403) {
        return { status: "invalid" };
      }
      // 5xx or other = server issue, not auth rejection
      return { status: "network_error" };
    }

    const data = await resp.json();
    useAuthStore.setState({ token: data.token });
    if (typeof window !== "undefined") {
      localStorage.setItem("aura_token", data.token);
    }
    return { status: "ok", token: data.token };
  } catch (err: any) {
    // Network timeout, offline, DNS failure — NOT a session problem
    return { status: "network_error" };
  }
}

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

      // SEC-02 + AUTH-02: Smart 401 handling
      if (res.status === 401 && !opts.token) {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = refreshAccessToken();
        }

        const result = await refreshPromise!;
        isRefreshing = false;
        refreshPromise = null;

        if (result.status === "ok") {
          // Retry with new token
          const retryHeaders = { ...headers, Authorization: "Bearer " + result.token };
          const retryRes = await fetch(`${BASE_URL}${path}`, {
            method, headers: retryHeaders,
            body: body ? JSON.stringify(body) : undefined,
          });
          const retryData = await retryRes.json().catch(() => ({}));
          if (retryRes.ok) return retryData as T;
          // If retry also fails with 401, session is truly dead
          if (retryRes.status === 401 && _onUnauthorized) _onUnauthorized();
          throw new ApiError((retryData as any).error || "Sessao expirada", 401, retryData);
        }

        if (result.status === "invalid") {
          // AUTH-02: confirmed auth rejection — safe to logout
          if (_onUnauthorized) _onUnauthorized();
          throw new ApiError((data as any).error || "Sessao expirada", 401, data);
        }

        // AUTH-02: network_error — do NOT logout, let retry loop handle it
        if (attempt < retry) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new ApiError(
          "Falha de conexao. Verifique sua internet.",
          0,
          null,
          true
        );
      }

      // Explicit 401 with manual token (e.g. authApi.me) — just throw
      if (res.status === 401) {
        throw new ApiError((data as any).error || "Nao autorizado", 401, data);
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
      // AUTH-02: network errors retry silently, never trigger logout
      if (attempt < retry) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastError || new ApiError("Erro de conexao. Verifique sua internet.", 0, null, true);
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
  updateTransaction: (companyId: string, txId: string, body: any) =>
    request<any>(`/companies/${companyId}/transactions/${txId}`, { method: "PATCH", body }),
  deleteTransaction: (companyId: string, txId: string) =>
    request<any>(`/companies/${companyId}/transactions/${txId}`, { method: "DELETE" }),
  products: (companyId: string) => request<any>(`/companies/${companyId}/products`),
  createProduct: (companyId: string, body: any) =>
    request<any>(`/companies/${companyId}/products`, { method: "POST", body }),
  updateProduct: (companyId: string, prodId: string, body: any) =>
    request<any>(`/companies/${companyId}/products/${prodId}`, { method: "PATCH", body }),
  deleteProduct: (companyId: string, prodId: string) =>
    request<any>(`/companies/${companyId}/products/${prodId}`, { method: "DELETE" }),
  customers: (companyId: string) => request<any>(`/companies/${companyId}/customers`),
  createCustomer: (companyId: string, body: any) =>
    request<any>(`/companies/${companyId}/customers`, { method: "POST", body }),
  updateCustomer: (companyId: string, custId: string, body: any) =>
    request<any>(`/companies/${companyId}/customers/${custId}`, { method: "PATCH", body }),
  deleteCustomer: (companyId: string, custId: string) =>
    request<any>(`/companies/${companyId}/customers/${custId}`, { method: "DELETE" }),
  obligations: (companyId: string) => request<any>(`/companies/${companyId}/obligations`),
  payroll: (companyId: string, body: any) =>
    request<any>(`/companies/${companyId}/payroll/calculate`, { method: "POST", body }),
  dre: (companyId: string, params?: string) =>
    request<any>(`/companies/${companyId}/dre${params ? "?" + params : ""}`),
  checklist: (companyId: string) => request<any>(`/companies/${companyId}/checklist`),
  completeCheckpoint: (companyId: string, checkpointId: string) =>
    request<any>(`/companies/${companyId}/checklist/${checkpointId}/complete`, { method: "POST" }),
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

// ── Billing API (F6 — Asaas) ────────────────────────────────
export const billingApi = {
  status: (companyId: string) =>
    request<{ plan: string; billing_status: string; trial_active: boolean; trial_days_left: number; next_billing_date: string | null; has_payment_method: boolean }>(
      `/companies/${companyId}/billing/status`
    ),
  subscribe: (companyId: string, plan: string, billingType?: string) =>
    request<{ subscription_id: string; plan: string; value: number; next_due_date: string; payment_link: string | null }>(
      `/companies/${companyId}/billing/subscribe`,
      { method: "POST", body: { plan, billing_type: billingType || "UNDEFINED" } }
    ),
  cancel: (companyId: string) =>
    request<{ message: string; cancelled_at: string }>(
      `/companies/${companyId}/billing/cancel`,
      { method: "POST" }
    ),
  invoices: (companyId: string) =>
    request<{ total: number; invoices: any[] }>(
      `/companies/${companyId}/billing/invoices`
    ),
  generatePix: (companyId: string, paymentId: string) =>
    request<{ qr_code: string; copy_paste: string; expiration: string }>(
      `/companies/${companyId}/billing/generate-pix/${paymentId}`,
      { method: "POST" }
    ),
};

// ── Admin API ───────────────────────────────────────────────
export const adminApi = {
  dashboard: () => request<any>("/admin/dashboard"),
  clients: () => request<any>("/admin/clients"),
  toggleModule: (companyId: string, module: string, enabled: boolean) =>
    request<any>(`/admin/clients/${companyId}/modules`, { method: "PUT", body: { module, enabled } }),
};

// ── AI / Agentes API ─────────────────────────────────────────
export const aiApi = {
  chat: (companyId: string, message: string, context?: string, history?: any[]) =>
    request<{ response: string; context: string; model: string; usage?: any }>(
      `/companies/${companyId}/ai/chat`,
      { method: "POST", body: { message, context: context || "geral", history: history || [] }, timeout: 30000 }
    ),
  activity: (companyId: string, limit?: number) =>
    request<{ activity: any[]; summary: any[]; total: number }>(
      `/companies/${companyId}/ai/activity?limit=${limit || 20}`
    ),
};

export { request, BASE_URL };
