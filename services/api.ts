// ─── Infraestrutura HTTP ──────────────────────────────────────────────────────
// Este arquivo contém apenas o core de requisições (request, ApiError, auth helpers).
// Cada domínio de API fica em seu próprio arquivo em services/.
// Os re-exports abaixo mantêm compatibilidade com imports existentes de "@/services/api".

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

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
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

export { BASE_URL };

// ─── Re-exports de compatibilidade ───────────────────────────────────────────
// Imports existentes de "@/services/api" continuam funcionando sem alteração.
// Novos arquivos devem importar direto do domínio (ex: "@/services/salesApi").

export type { VerticalKey, LoginResponse, RegisterBody, CodeValidation, VerificationResponse, SidebarLayoutItem, SidebarLayout, PdvSettings } from "./authApi";
export { authApi, sidebarLayoutApi, pdvSettingsApi } from "./authApi";

export type { SaleStatus, SaleDetailsItem, SaleDetails, SalesListItem, SalesStats, SalesListResponse, SaleDetailFull, SalesFilters } from "./salesApi";
export { salesApi, transactionSaleApi } from "./salesApi";

export type { PdvScanResult } from "./pdvApi";
export { pdvApi } from "./pdvApi";

export type { CategoryType, ProductCategoryRow } from "./companiesApi";
export { companiesApi } from "./companiesApi";

export { employeesApi } from "./employeesApi";

export type { TokenizeResponse, SubscribeResponse } from "./billingApi";
export { billingApi } from "./billingApi";

export type { AccessCodeRow, CreateAccessCodeBody } from "./adminApi";
export { adminApi } from "./adminApi";

export { nfeApi } from "./nfeApi";

export type { CouponValidation } from "./couponsApi";
export { couponsApi } from "./couponsApi";

export type { BirthdayCustomer, BirthdayCouponDefaults, BirthdaySettings, BirthdaySentRow } from "./birthdayApi";
export { birthdayApi } from "./birthdayApi";

export { dashboardApi, aiApi } from "./dashboardApi";

export type { InviteDetails } from "./onboardingApi";
export { inviteApi, cnpjApi, onboardingApi, referralsApi } from "./onboardingApi";
