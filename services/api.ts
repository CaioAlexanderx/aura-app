import { Platform } from "react-native";

const BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

export class ApiError extends Error {
  status: number;
  data: any;
  isNetworkError: boolean;
  constructor(message: string, status: number, data?: any, isNetworkError = false) {
    super(message); this.name = "ApiError"; this.status = status; this.data = data; this.isNetworkError = isNetworkError;
  }
}

let _getToken: (() => string | null) | null = null;
export function setTokenGetter(fn: () => string | null) { _getToken = fn; }
let _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: () => void) { _onUnauthorized = fn; }

type RefreshResult = { status: "ok"; token: string } | { status: "invalid" } | { status: "network_error" };
type RequestOpts = { method?: string; body?: unknown; token?: string | null; retry?: number; timeout?: number };
let isRefreshing = false;
let refreshPromise: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  try {
    const { useAuthStore } = await import("@/stores/auth");
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return { status: "invalid" };
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
    const resp = await fetch(BASE_URL + "/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }), signal: controller?.signal });
    if (timer) clearTimeout(timer);
    if (!resp.ok) { return resp.status === 401 || resp.status === 403 ? { status: "invalid" } : { status: "network_error" }; }
    const data = await resp.json();
    useAuthStore.setState({ token: data.token });
    if (typeof window !== "undefined") localStorage.setItem("aura_token", data.token);
    return { status: "ok", token: data.token };
  } catch { return { status: "network_error" }; }
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
      const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller?.signal });
      if (timer) clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && !opts.token) {
        if (!isRefreshing) { isRefreshing = true; refreshPromise = refreshAccessToken(); }
        const result = await refreshPromise!; isRefreshing = false; refreshPromise = null;
        if (result.status === "ok") {
          const retryRes = await fetch(`${BASE_URL}${path}`, { method, headers: { ...headers, Authorization: "Bearer " + result.token }, body: body ? JSON.stringify(body) : undefined });
          const retryData = await retryRes.json().catch(() => ({}));
          if (retryRes.ok) return retryData as T;
          if (retryRes.status === 401 && _onUnauthorized) _onUnauthorized();
          throw new ApiError((retryData as any).error || "Sessao expirada", 401, retryData);
        }
        if (result.status === "invalid") { if (_onUnauthorized) _onUnauthorized(); throw new ApiError((data as any).error || "Sessao expirada", 401, data); }
        if (attempt < retry) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
        throw new ApiError("Falha de conexao. Verifique sua internet.", 0, null, true);
      }
      if (res.status === 401) throw new ApiError((data as any).error || "Nao autorizado", 401, data);
      if (res.status === 429 && attempt < retry) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
      if (!res.ok) throw new ApiError((data as any).error || `Erro HTTP ${res.status}`, res.status, data);
      return data as T;
    } catch (err: any) {
      lastError = err; if (err instanceof ApiError) throw err;
      if (attempt < retry) { await new Promise(r => setTimeout(r, 800 * (attempt + 1))); continue; }
    }
  }
  throw lastError || new ApiError("Erro de conexao. Verifique sua internet.", 0, null, true);
}

// ── Types ───────────────────────────────────────────────────
export type LoginResponse = {
  token: string;
  user: { id: string; name: string; email: string; role: string; is_staff?: boolean; email_verified?: boolean };
  company: { id: string; name: string; plan: string; onboarding_step: string; module_overrides?: Record<string, boolean>; trial_active?: boolean; trial_ends_at?: string } | null;
  code_applied?: { type: string; plan: string; discount_pct: number; trial_days: number } | null;
};
export type RegisterBody = { name: string; email: string; password: string; company_name: string; phone?: string; cnpj?: string; access_code?: string };
export type CodeValidation = { valid: boolean; type?: string; plan?: string; discount_pct?: number; trial_days?: number; error?: string };
export type VerificationResponse = { sent?: boolean; destination?: string; expires_in?: number; already_verified?: boolean; valid?: boolean; email_verified?: boolean; phone_verified?: boolean; error?: string };

// ── Auth API ────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => request<LoginResponse>("/auth/login", { method: "POST", body: { email, password }, retry: 1 }),
  register: (body: RegisterBody) => request<LoginResponse>("/auth/register", { method: "POST", body, retry: 1 }),
  me: (token: string) => request<Omit<LoginResponse, "token">>("/auth/me", { method: "POST", token, retry: 1 }),
  validateCode: (code: string) => request<CodeValidation>("/auth/validate-code", { method: "POST", body: { code }, retry: 0 }),
  forgotPassword: (email: string) => request<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email }, retry: 0 }),
  resetPassword: (token: string, password: string) => request<{ message: string }>("/auth/reset-password", { method: "POST", body: { token, password }, retry: 0 }),
  sendEmailVerification: () => request<VerificationResponse>("/auth/send-verification", { method: "POST", retry: 0 }),
  verifyEmail: (code: string) => request<VerificationResponse>("/auth/verify-email", { method: "POST", body: { code }, retry: 0 }),
  sendPhoneVerification: () => request<VerificationResponse>("/auth/send-phone-verification", { method: "POST", retry: 0 }),
  verifyPhone: (code: string) => request<VerificationResponse>("/auth/verify-phone", { method: "POST", body: { code }, retry: 0 }),
};

// ── Dashboard API ───────────────────────────────────────────
export const dashboardApi = {
  aggregate: (companyId: string, token?: string) => request<any>(`/companies/${companyId}/dashboard`, { token }),
  summary: (companyId: string, token?: string) => request<any>(`/companies/${companyId}/withdrawal/summary`, { token }),
  sparkline: (companyId: string, days?: number, token?: string) => request<any>(`/companies/${companyId}/dashboard/sparkline?days=${days || 7}`, { token }),
};

// ── Companies API ───────────────────────────────────────────
export const companiesApi = {
  get: (companyId: string) => request<any>(`/companies/${companyId}`),
  getProfile: (companyId: string) => request<any>(`/companies/${companyId}/profile`),
  updateProfile: (companyId: string, body: any) => request<any>(`/companies/${companyId}/profile`, { method: "PUT", body }),
  // Transactions
  transactions: (companyId: string, params?: string) => request<any>(`/companies/${companyId}/transactions${params ? "?" + params : ""}`),
  createTransaction: (companyId: string, body: any) => request<any>(`/companies/${companyId}/transactions`, { method: "POST", body }),
  updateTransaction: (companyId: string, txId: string, body: any) => request<any>(`/companies/${companyId}/transactions/${txId}`, { method: "PATCH", body }),
  deleteTransaction: (companyId: string, txId: string) => request<any>(`/companies/${companyId}/transactions/${txId}`, { method: "DELETE" }),
  // Fase 3: Categorize
  categorize: (companyId: string, descriptions: string[]) => request<any>(`/companies/${companyId}/transactions/categorize`, { method: "POST", body: { descriptions }, timeout: 15000 }),
  categorizeTransaction: (companyId: string, txId: string, apply = false) => request<any>(`/companies/${companyId}/transactions/${txId}/categorize`, { method: "POST", body: { apply }, timeout: 15000 }),
  // Products
  products: (companyId: string) => request<any>(`/companies/${companyId}/products`),
  createProduct: (companyId: string, body: any) => request<any>(`/companies/${companyId}/products`, { method: "POST", body }),
  updateProduct: (companyId: string, prodId: string, body: any) => request<any>(`/companies/${companyId}/products/${prodId}`, { method: "PATCH", body }),
  deleteProduct: (companyId: string, prodId: string) => request<any>(`/companies/${companyId}/products/${prodId}`, { method: "DELETE" }),
  // Fase 4: Variants
  variants: (companyId: string, productId: string) => request<any>(`/companies/${companyId}/products/${productId}/variants`),
  createVariant: (companyId: string, productId: string, body: any) => request<any>(`/companies/${companyId}/products/${productId}/variants`, { method: "POST", body }),
  updateVariant: (companyId: string, productId: string, variantId: string, body: any) => request<any>(`/companies/${companyId}/products/${productId}/variants/${variantId}`, { method: "PATCH", body }),
  deleteVariant: (companyId: string, productId: string, variantId: string) => request<any>(`/companies/${companyId}/products/${productId}/variants/${variantId}`, { method: "DELETE" }),
  // Customers
  customers: (companyId: string) => request<any>(`/companies/${companyId}/customers`),
  createCustomer: (companyId: string, body: any) => request<any>(`/companies/${companyId}/customers`, { method: "POST", body }),
  updateCustomer: (companyId: string, custId: string, body: any) => request<any>(`/companies/${companyId}/customers/${custId}`, { method: "PATCH", body }),
  deleteCustomer: (companyId: string, custId: string) => request<any>(`/companies/${companyId}/customers/${custId}`, { method: "DELETE" }),
  // Fase 5: Retention + Reviews
  retention: (companyId: string, period?: string) => request<any>(`/companies/${companyId}/customers/retention?period=${period || 'month'}`),
  reviews: (companyId: string, rating?: number) => request<any>(`/companies/${companyId}/reviews${rating ? '?rating=' + rating : ''}`),
  requestReview: (companyId: string, saleId: string, customerId?: string) => request<any>(`/companies/${companyId}/reviews/request`, { method: "POST", body: { sale_id: saleId, customer_id: customerId } }),
  // Accounting
  obligations: (companyId: string) => request<any>(`/companies/${companyId}/obligations`),
  payroll: (companyId: string, body: any) => request<any>(`/companies/${companyId}/payroll/calculate`, { method: "POST", body }),
  dre: (companyId: string, params?: string) => request<any>(`/companies/${companyId}/dre${params ? "?" + params : ""}`),
  checklist: (companyId: string) => request<any>(`/companies/${companyId}/checklist`),
  completeCheckpoint: (companyId: string, checkpointId: string) => request<any>(`/companies/${companyId}/checklist/${checkpointId}/complete`, { method: "POST" }),
  // Fase 2: Analytics
  salesAnalytics: (companyId: string, period?: string, groupBy?: string) => request<any>(`/companies/${companyId}/sales/analytics?period=${period || 'month'}&group_by=${groupBy || 'day'}`),
  productsRanking: (companyId: string, period?: string) => request<any>(`/companies/${companyId}/products/ranking?period=${period || 'month'}`),
  productsCategories: (companyId: string, period?: string) => request<any>(`/companies/${companyId}/products/categories?period=${period || 'month'}`),
};

// ── CNPJ API ────────────────────────────────────────────────
export const cnpjApi = { lookup: (cnpj: string) => request<any>("/onboarding/cnpj-lookup", { method: "POST", body: { cnpj }, retry: 1 }) };

// ── Onboarding API ──────────────────────────────────────────
export const onboardingApi = {
  get: (companyId: string) => request<any>(`/companies/${companyId}/onboarding`),
  stepCnpj: (companyId: string, cnpj: string) => request<any>(`/companies/${companyId}/onboarding/step/cnpj`, { method: "POST", body: { cnpj } }),
  stepRegime: (companyId: string, tax_regime: string) => request<any>(`/companies/${companyId}/onboarding/step/regime`, { method: "POST", body: { tax_regime } }),
  stepPerfil: (companyId: string, body: any) => request<any>(`/companies/${companyId}/onboarding/step/perfil`, { method: "POST", body }),
};

// ── Referrals API ───────────────────────────────────────────
export const referralsApi = {
  generate: () => request<{ code: string; existing: boolean }>("/referrals/generate", { method: "POST" }),
  mine: () => request<any>("/referrals/mine"),
};

// ── PDV / Sales API ─────────────────────────────────────────
export const pdvApi = { createSale: (companyId: string, body: any) => request<any>(`/companies/${companyId}/pdv/sales`, { method: "POST", body }) };

// ── Employees API ───────────────────────────────────────────
export const employeesApi = {
  list: (companyId: string, includeInactive?: boolean) => request<{ total: number; employees: any[] }>(`/companies/${companyId}/employees${includeInactive ? "?include_inactive=true" : ""}`),
  create: (companyId: string, body: any) => request<any>(`/companies/${companyId}/employees`, { method: "POST", body }),
  update: (companyId: string, eid: string, body: any) => request<any>(`/companies/${companyId}/employees/${eid}`, { method: "PATCH", body }),
  remove: (companyId: string, eid: string) => request<any>(`/companies/${companyId}/employees/${eid}`, { method: "DELETE" }),
};

// ── Billing API ─────────────────────────────────────────────
export type SubscribeResponse = { subscription_id?: string; payment_id?: string; plan: string; cycle: string; value: number; billing_type: string; next_due_date?: string; pix_qr_code?: string | null; pix_copy_paste?: string | null; pix_expiration?: string | null };
export const billingApi = {
  status: (companyId: string) => request<any>(`/companies/${companyId}/billing/status`),
  subscribe: (companyId: string, plan: string, billingType?: string, creditCardToken?: string, cycle?: string, holderName?: string, holderCpf?: string) =>
    request<SubscribeResponse>(`/companies/${companyId}/billing/subscribe`, { method: "POST", body: { plan, billing_type: billingType || "PIX", cycle: cycle || "monthly", credit_card_token: creditCardToken, credit_card_holder_name: holderName, credit_card_holder_cpf: holderCpf } }),
  cancel: (companyId: string) => request<any>(`/companies/${companyId}/billing/cancel`, { method: "POST" }),
  invoices: (companyId: string) => request<any>(`/companies/${companyId}/billing/invoices`),
  generatePix: (companyId: string, paymentId: string) => request<any>(`/companies/${companyId}/billing/generate-pix/${paymentId}`, { method: "POST" }),
  plans: () => request<any>(`/billing/plans`),
};

// ── Admin API ───────────────────────────────────────────────
export const adminApi = {
  dashboard: () => request<any>("/admin/dashboard"),
  clients: () => request<any>("/admin/clients"),
  clientModules: (companyId: string) => request<any>(`/admin/clients/${companyId}/modules`),
  updateModules: (companyId: string, overrides: Record<string, boolean>) => request<any>(`/admin/clients/${companyId}/modules`, { method: "PUT", body: { overrides } }),
};

// ── AI / Agentes API ─────────────────────────────────────────
export const aiApi = {
  chat: (companyId: string, message: string, context?: string, history?: any[]) =>
    request<any>(`/companies/${companyId}/ai/chat`, { method: "POST", body: { message, context: context || "geral", history: history || [] }, timeout: 30000 }),
  activity: (companyId: string, limit?: number) => request<any>(`/companies/${companyId}/ai/activity?limit=${limit || 20}`),
};

export { request, BASE_URL };
