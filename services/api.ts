import { Platform } from "react-native";

var BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

export class ApiError extends Error {
  status: number; data: any; isNetworkError: boolean;
  constructor(message: string, status: number, data?: any, isNetworkError = false) {
    super(message); this.name = "ApiError"; this.status = status; this.data = data; this.isNetworkError = isNetworkError;
  }
}

var _getToken: (() => string | null) | null = null;
export function setTokenGetter(fn: () => string | null) { _getToken = fn; }
var _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: () => void) { _onUnauthorized = fn; }

type RefreshResult = { status: "ok"; token: string } | { status: "invalid" } | { status: "network_error" };
type RequestOpts = { method?: string; body?: unknown; token?: string | null; retry?: number; timeout?: number };
var isRefreshing = false;
var refreshPromise: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  try {
    var { useAuthStore } = await import("@/stores/auth");
    var refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return { status: "invalid" };
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function() { controller!.abort(); }, 8000) : null;
    var resp = await fetch(BASE_URL + "/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }), signal: controller?.signal });
    if (timer) clearTimeout(timer);
    if (!resp.ok) { return resp.status === 401 || resp.status === 403 ? { status: "invalid" } : { status: "network_error" }; }
    var data = await resp.json();
    useAuthStore.setState({ token: data.token });
    if (typeof window !== "undefined") localStorage.setItem("aura_token", data.token);
    return { status: "ok", token: data.token };
  } catch { return { status: "network_error" }; }
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  var { method = "GET", body, retry = 2, timeout = 10000 } = opts;
  var token = opts.token !== undefined ? opts.token : _getToken?.() || null;
  var headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  var lastError: Error | null = null;
  for (var attempt = 0; attempt <= retry; attempt++) {
    try {
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller ? setTimeout(function() { controller!.abort(); }, timeout) : null;
      var res = await fetch(BASE_URL + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: controller?.signal });
      if (timer) clearTimeout(timer);
      var data = await res.json().catch(function() { return {}; });
      if (res.status === 401 && !opts.token) {
        if (!isRefreshing) { isRefreshing = true; refreshPromise = refreshAccessToken(); }
        var result = await refreshPromise!; isRefreshing = false; refreshPromise = null;
        if (result.status === "ok") {
          var retryRes = await fetch(BASE_URL + path, { method: method, headers: { ...headers, Authorization: "Bearer " + result.token }, body: body ? JSON.stringify(body) : undefined });
          var retryData = await retryRes.json().catch(function() { return {}; });
          if (retryRes.ok) return retryData as T;
          if (retryRes.status === 401 && _onUnauthorized) _onUnauthorized();
          throw new ApiError((retryData as any).error || "Sessao expirada", 401, retryData);
        }
        if (result.status === "invalid") { if (_onUnauthorized) _onUnauthorized(); throw new ApiError((data as any).error || "Sessao expirada", 401, data); }
        if (attempt < retry) { await new Promise(function(r) { setTimeout(r, 1500 * (attempt + 1)); }); continue; }
        throw new ApiError("Falha de conexao. Verifique sua internet.", 0, null, true);
      }
      if (res.status === 401) throw new ApiError((data as any).error || "Nao autorizado", 401, data);
      if (res.status === 429 && attempt < retry) { await new Promise(function(r) { setTimeout(r, 1000 * (attempt + 1)); }); continue; }
      if (!res.ok) throw new ApiError((data as any).error || "Erro HTTP " + res.status, res.status, data);
      return data as T;
    } catch (err: any) {
      lastError = err; if (err instanceof ApiError) throw err;
      if (attempt < retry) { await new Promise(function(r) { setTimeout(r, 800 * (attempt + 1)); }); continue; }
    }
  }
  throw lastError || new ApiError("Erro de conexao. Verifique sua internet.", 0, null, true);
}

// Types
export type LoginResponse = {
  token: string;
  user: { id: string; name: string; email: string; role: string; is_staff?: boolean; email_verified?: boolean };
  company: { id: string; name: string; plan: string; onboarding_step: string; module_overrides?: Record<string, boolean>; trial_active?: boolean; trial_ends_at?: string } | null;
  code_applied?: { type: string; plan: string; discount_pct: number; trial_days: number } | null;
};
export type RegisterBody = { name: string; email: string; password: string; company_name?: string; phone?: string; cnpj?: string; access_code?: string };
export type CodeValidation = { valid: boolean; type?: string; plan?: string; discount_pct?: number; trial_days?: number; error?: string };
export type VerificationResponse = { sent?: boolean; destination?: string; expires_in?: number; already_verified?: boolean; valid?: boolean; email_verified?: boolean; phone_verified?: boolean; error?: string };

// Auth API
export var authApi = {
  login: function(email: string, password: string) { return request<LoginResponse>("/auth/login", { method: "POST", body: { email: email, password: password }, retry: 1 }); },
  register: function(body: RegisterBody) { return request<LoginResponse>("/auth/register", { method: "POST", body: body, retry: 1 }); },
  me: function(token: string) { return request<Omit<LoginResponse, "token">>("/auth/me", { method: "POST", token: token, retry: 1 }); },
  validateCode: function(code: string) { return request<CodeValidation>("/auth/validate-code", { method: "POST", body: { code: code }, retry: 0 }); },
  forgotPassword: function(email: string) { return request<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email: email }, retry: 0 }); },
  resetPassword: function(token: string, password: string) { return request<{ message: string }>("/auth/reset-password", { method: "POST", body: { token: token, password: password }, retry: 0 }); },
  sendEmailVerification: function() { return request<VerificationResponse>("/auth/send-verification", { method: "POST", retry: 0 }); },
  verifyEmail: function(code: string) { return request<VerificationResponse>("/auth/verify-email", { method: "POST", body: { code: code }, retry: 0 }); },
  sendPhoneVerification: function() { return request<VerificationResponse>("/auth/send-phone-verification", { method: "POST", retry: 0 }); },
  verifyPhone: function(code: string) { return request<VerificationResponse>("/auth/verify-phone", { method: "POST", body: { code: code }, retry: 0 }); },
};

// Invite API
export type InviteDetails = { company_name: string; role: string; email: string; masked_email: string; status: string };
export var inviteApi = {
  validate: function(inviteToken: string) { return request<InviteDetails>("/invite/" + inviteToken, { token: null, retry: 1 }); },
  accept: function(inviteToken: string) { return request<{ accepted: boolean; company_id: string; role: string; message: string }>("/invite/" + inviteToken + "/accept", { method: "POST", retry: 0 }); },
};

// Dashboard API
export var dashboardApi = {
  aggregate: function(companyId: string, token?: string) { return request<any>("/companies/" + companyId + "/dashboard", { token: token }); },
  summary: function(companyId: string, token?: string) { return request<any>("/companies/" + companyId + "/withdrawal/summary", { token: token }); },
  sparkline: function(companyId: string, days?: number, token?: string) { return request<any>("/companies/" + companyId + "/dashboard/sparkline?days=" + (days || 7), { token: token }); },
};

// Companies API
export var companiesApi = {
  get: function(companyId: string) { return request<any>("/companies/" + companyId); },
  getProfile: function(companyId: string) { return request<any>("/companies/" + companyId + "/profile"); },
  updateProfile: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/profile", { method: "PUT", body: body }); },
  transactions: function(companyId: string, params?: string) { return request<any>("/companies/" + companyId + "/transactions" + (params ? "?" + params : "")); },
  createTransaction: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/transactions", { method: "POST", body: body }); },
  updateTransaction: function(companyId: string, txId: string, body: any) { return request<any>("/companies/" + companyId + "/transactions/" + txId, { method: "PATCH", body: body }); },
  deleteTransaction: function(companyId: string, txId: string) { return request<any>("/companies/" + companyId + "/transactions/" + txId, { method: "DELETE" }); },
  categorize: function(companyId: string, descriptions: string[]) { return request<any>("/companies/" + companyId + "/transactions/categorize", { method: "POST", body: { descriptions: descriptions }, timeout: 15000 }); },
  categorizeTransaction: function(companyId: string, txId: string, apply?: boolean) { return request<any>("/companies/" + companyId + "/transactions/" + txId + "/categorize", { method: "POST", body: { apply: apply || false }, timeout: 15000 }); },
  products: function(companyId: string) { return request<any>("/companies/" + companyId + "/products"); },
  createProduct: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/products", { method: "POST", body: body }); },
  updateProduct: function(companyId: string, prodId: string, body: any) { return request<any>("/companies/" + companyId + "/products/" + prodId, { method: "PATCH", body: body }); },
  deleteProduct: function(companyId: string, prodId: string) { return request<any>("/companies/" + companyId + "/products/" + prodId, { method: "DELETE" }); },
  variants: function(companyId: string, productId: string) { return request<any>("/companies/" + companyId + "/products/" + productId + "/variants"); },
  createVariant: function(companyId: string, productId: string, body: any) { return request<any>("/companies/" + companyId + "/products/" + productId + "/variants", { method: "POST", body: body }); },
  updateVariant: function(companyId: string, productId: string, variantId: string, body: any) { return request<any>("/companies/" + companyId + "/products/" + productId + "/variants/" + variantId, { method: "PATCH", body: body }); },
  deleteVariant: function(companyId: string, productId: string, variantId: string) { return request<any>("/companies/" + companyId + "/products/" + productId + "/variants/" + variantId, { method: "DELETE" }); },
  customers: function(companyId: string) { return request<any>("/companies/" + companyId + "/customers"); },
  createCustomer: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/customers", { method: "POST", body: body }); },
  updateCustomer: function(companyId: string, custId: string, body: any) { return request<any>("/companies/" + companyId + "/customers/" + custId, { method: "PATCH", body: body }); },
  deleteCustomer: function(companyId: string, custId: string) { return request<any>("/companies/" + companyId + "/customers/" + custId, { method: "DELETE" }); },
  retention: function(companyId: string, period?: string) { return request<any>("/companies/" + companyId + "/customers/retention?period=" + (period || "month")); },
  reviews: function(companyId: string, rating?: number) { return request<any>("/companies/" + companyId + "/reviews" + (rating ? "?rating=" + rating : "")); },
  requestReview: function(companyId: string, saleId: string, customerId?: string) { return request<any>("/companies/" + companyId + "/reviews/request", { method: "POST", body: { sale_id: saleId, customer_id: customerId } }); },
  members: function(companyId: string) { return request<any>("/companies/" + companyId + "/members"); },
  inviteMember: async function(companyId: string, body: { email: string; role_label?: string }) {
    var normalizedRole = (body.role_label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    var payloads = [
      { invite_email: body.email }, { email: body.email },
      { invite_email: body.email, role_label: normalizedRole }, { email: body.email, role_label: normalizedRole },
      { invite_email: body.email, role: normalizedRole }, { email: body.email, role: normalizedRole },
    ];
    var lastErr: unknown;
    for (var i = 0; i < payloads.length; i++) {
      try { return await request<any>("/companies/" + companyId + "/members/invite", { method: "POST", body: payloads[i], retry: 0 }); }
      catch (err) { lastErr = err; if (!(err instanceof ApiError) || err.status !== 400) throw err; }
    }
    throw lastErr;
  },
  updateMember: function(companyId: string, mid: string, body: any) { return request<any>("/companies/" + companyId + "/members/" + mid, { method: "PATCH", body: body }); },
  removeMember: function(companyId: string, mid: string) { return request<any>("/companies/" + companyId + "/members/" + mid, { method: "DELETE" }); },
  membersBilling: function(companyId: string) { return request<any>("/companies/" + companyId + "/members/billing"); },
  appointments: function(companyId: string, start?: string, end?: string) { return request<any>("/companies/" + companyId + "/appointments?start=" + (start || "") + "&end=" + (end || "")); },
  createAppointment: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/appointments", { method: "POST", body: body }); },
  updateAppointment: function(companyId: string, aid: string, body: any) { return request<any>("/companies/" + companyId + "/appointments/" + aid, { method: "PATCH", body: body }); },
  cancelAppointment: function(companyId: string, aid: string) { return request<any>("/companies/" + companyId + "/appointments/" + aid, { method: "DELETE" }); },
  obligations: function(companyId: string) { return request<any>("/companies/" + companyId + "/obligations"); },
  payroll: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/payroll/calculate", { method: "POST", body: body }); },
  dre: function(companyId: string, params?: string) { return request<any>("/companies/" + companyId + "/dre" + (params ? "?" + params : "")); },
  checklist: function(companyId: string) { return request<any>("/companies/" + companyId + "/checklist"); },
  completeCheckpoint: function(companyId: string, checkpointId: string) { return request<any>("/companies/" + companyId + "/checklist/" + checkpointId + "/complete", { method: "POST" }); },
  salesAnalytics: function(companyId: string, period?: string, groupBy?: string) { return request<any>("/companies/" + companyId + "/sales/analytics?period=" + (period || "month") + "&group_by=" + (groupBy || "day")); },
  productsRanking: function(companyId: string, period?: string) { return request<any>("/companies/" + companyId + "/products/ranking?period=" + (period || "month")); },
  productsCategories: function(companyId: string, period?: string) { return request<any>("/companies/" + companyId + "/products/categories?period=" + (period || "month")); },
};

// CNPJ API
export var cnpjApi = { lookup: function(cnpj: string) { return request<any>("/onboarding/cnpj-lookup", { method: "POST", body: { cnpj: cnpj }, retry: 1 }); } };

// Onboarding API
export var onboardingApi = {
  get: function(companyId: string) { return request<any>("/companies/" + companyId + "/onboarding"); },
  stepCnpj: function(companyId: string, cnpj: string) { return request<any>("/companies/" + companyId + "/onboarding/step/cnpj", { method: "POST", body: { cnpj: cnpj } }); },
  stepRegime: function(companyId: string, tax_regime: string) { return request<any>("/companies/" + companyId + "/onboarding/step/regime", { method: "POST", body: { tax_regime: tax_regime } }); },
  stepPerfil: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/onboarding/step/perfil", { method: "POST", body: body }); },
};

// Referrals API
export var referralsApi = {
  generate: function() { return request<{ code: string; existing: boolean }>("/referrals/generate", { method: "POST" }); },
  mine: function() { return request<any>("/referrals/mine"); },
};

// PDV / Sales API
export var pdvApi = { createSale: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/pdv/sale", { method: "POST", body: body }); } };

// Coupons API
export type CouponValidation = { valid: boolean; coupon_id?: string; code?: string; discount_type?: string; discount_value?: number; discount_amount?: number; final_total?: number; error?: string };
export var couponsApi = {
  list: function(companyId: string) { return request<{ total: number; coupons: any[] }>("/companies/" + companyId + "/coupons"); },
  create: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/coupons", { method: "POST", body: body }); },
  validate: function(companyId: string, code: string, orderTotal: number) { return request<CouponValidation>("/companies/" + companyId + "/coupons/validate", { method: "POST", body: { code: code, order_total: orderTotal }, retry: 0 }); },
  update: function(companyId: string, couponId: string, body: any) { return request<any>("/companies/" + companyId + "/coupons/" + couponId, { method: "PATCH", body: body }); },
  remove: function(companyId: string, couponId: string) { return request<any>("/companies/" + companyId + "/coupons/" + couponId, { method: "DELETE" }); },
};

// NF-e API
export var nfeApi = {
  list: function(companyId: string, type?: string, status?: string) { return request<{ total: number; documents: any[] }>("/companies/" + companyId + "/nfe" + (type || status ? "?" + [type && "type=" + type, status && "status=" + status].filter(Boolean).join("&") : "")); },
  get: function(companyId: string, ref: string) { return request<any>("/companies/" + companyId + "/nfe/" + ref); },
  setup: function(companyId: string) { return request<any>("/companies/" + companyId + "/nfe/setup", { method: "POST", timeout: 15000 }); },
  uploadCertificate: function(companyId: string, body: { certificate: string; password: string }) { return request<any>("/companies/" + companyId + "/nfe/certificate", { method: "POST", body: body, timeout: 15000 }); },
  emitNfse: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/nfe/emit/nfse", { method: "POST", body: body, timeout: 20000 }); },
  emitNfce: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/nfe/emit/nfce", { method: "POST", body: body, timeout: 20000 }); },
  cancel: function(companyId: string, ref: string, justificativa?: string) { return request<any>("/companies/" + companyId + "/nfe/" + ref + "/cancel", { method: "POST", body: { justificativa: justificativa }, timeout: 15000 }); },
};

// Employees API
export var employeesApi = {
  list: function(companyId: string, includeInactive?: boolean) { return request<{ total: number; employees: any[] }>("/companies/" + companyId + "/employees" + (includeInactive ? "?include_inactive=true" : "")); },
  create: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/employees", { method: "POST", body: body }); },
  update: function(companyId: string, eid: string, body: any) { return request<any>("/companies/" + companyId + "/employees/" + eid, { method: "PATCH", body: body }); },
  remove: function(companyId: string, eid: string) { return request<any>("/companies/" + companyId + "/employees/" + eid, { method: "DELETE" }); },
};

// Billing API
export type TokenizeResponse = { credit_card_token: string; credit_card_brand: string | null; credit_card_last4: string | null };
export type SubscribeResponse = { subscription_id?: string; payment_id?: string; plan: string; cycle: string; value: number; billing_type: string; next_due_date?: string; pix_qr_code?: string | null; pix_copy_paste?: string | null; pix_expiration?: string | null };
export var billingApi = {
  status: function(companyId: string) { return request<any>("/companies/" + companyId + "/billing/status"); },
  tokenize: function(companyId: string, cardData: { card_number: string; card_expiry_month: string; card_expiry_year: string; card_ccv: string; holder_name: string; holder_cpf: string }) {
    return request<TokenizeResponse>("/companies/" + companyId + "/billing/tokenize", { method: "POST", body: cardData, retry: 0, timeout: 15000 });
  },
  subscribe: function(companyId: string, plan: string, billingType?: string, creditCardToken?: string, cycle?: string, holderName?: string, holderCpf?: string) {
    return request<SubscribeResponse>("/companies/" + companyId + "/billing/subscribe", { method: "POST", body: { plan: plan, billing_type: billingType || "PIX", cycle: cycle || "monthly", credit_card_token: creditCardToken, credit_card_holder_name: holderName, credit_card_holder_cpf: holderCpf } });
  },
  cancel: function(companyId: string) { return request<any>("/companies/" + companyId + "/billing/cancel", { method: "POST" }); },
  invoices: function(companyId: string) { return request<any>("/companies/" + companyId + "/billing/invoices"); },
  generatePix: function(companyId: string, paymentId: string) { return request<any>("/companies/" + companyId + "/billing/generate-pix/" + paymentId, { method: "POST" }); },
  plans: function() { return request<any>("/billing/plans"); },
};

// Admin API
export var adminApi = {
  dashboard: function() { return request<any>("/admin/dashboard"); },
  clients: function() { return request<any>("/admin/clients"); },
  clientModules: function(companyId: string) { return request<any>("/admin/clients/" + companyId + "/modules"); },
  updateModules: function(companyId: string, overrides: Record<string, boolean>) { return request<any>("/admin/clients/" + companyId + "/modules", { method: "PUT", body: { overrides: overrides } }); },
};

// AI / Agentes API
export var aiApi = {
  chat: function(companyId: string, message: string, context?: string, history?: any[]) {
    return request<any>("/companies/" + companyId + "/ai/chat", { method: "POST", body: { message: message, context: context || "geral", history: history || [] }, timeout: 30000 });
  },
  activity: function(companyId: string, limit?: number) { return request<any>("/companies/" + companyId + "/ai/activity?limit=" + (limit || 20)); },
};

export { request, BASE_URL };
