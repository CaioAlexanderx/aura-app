// ─── Infraestrutura HTTP ──────────────────────────────────────────────────────
// Este arquivo contém apenas o core de requisições (request, ApiError, auth helpers).
// Cada domínio de API fica em seu próprio arquivo em services/.
// Os re-exports abaixo mantêm compatibilidade com imports existentes de "@/services/api".

var BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

export class ApiError extends Error {
  status: number; data: any; isNetworkError: boolean; code: string | null;
  constructor(message: string, status: number, data?: any, isNetworkError = false, code: string | null = null) {
    super(message); this.name = "ApiError"; this.status = status; this.data = data; this.isNetworkError = isNetworkError; this.code = code;
  }
}

var _getToken: (() => string | null) | null = null;
export function setTokenGetter(fn: () => string | null) { _getToken = fn; }
var _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: () => void) { _onUnauthorized = fn; }

type RefreshResult = { status: "ok"; token: string } | { status: "invalid" } | { status: "network_error" };
// A3-FE: headers?: Record<string, string> added so callers can pass Idempotency-Key
// without touching the Authorization flow. Spread happens BEFORE the token assignment
// so Authorization always wins (a caller cannot accidentally clobber Bearer).
type RequestOpts = { method?: string; body?: unknown; token?: string | null; retry?: number; timeout?: number; headers?: Record<string, string> };

// ─── Refresh JWT singleton (race-safe) ───────────────────────────────────────
// Múltiplas requisições paralelas que recebem 401 devem compartilhar a MESMA
// promise de refresh. O `finally` block garante cleanup das flags em TODOS os
// caminhos (sucesso, falha terminal, exceção, network error) — caso contrário
// um throw deixaria isRefreshing=true permanentemente, travando a sessão.
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

// Wrapper defensivo: garante que isRefreshing/refreshPromise SEMPRE são
// limpos via finally, mesmo se refreshAccessToken lançar exceção inesperada.
// Múltiplas chamadas concorrentes recebem a MESMA promise (singleton).
function ensureRefresh(): Promise<RefreshResult> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async function() {
    try {
      return await refreshAccessToken();
    } catch {
      return { status: "network_error" } as RefreshResult;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  var { method = "GET", body, retry = 2, timeout = 10000 } = opts;
  var explicitToken = opts.token !== undefined;
  var token = explicitToken ? opts.token : _getToken?.() || null;
  var lastError: Error | null = null;

  for (var attempt = 0; attempt <= retry; attempt++) {
    // Re-lê token do store a cada tentativa: após refresh, _getToken() já
    // devolve o token fresco (refreshAccessToken atualiza useAuthStore.setState).
    // Sem isso, o retry usaria o token antigo do closure e geraria 401 de novo.
    if (!explicitToken) token = _getToken?.() || null;
    // A3-FE: spread custom headers first so Authorization always overrides them.
    var headers: HeadersInit = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (token) headers["Authorization"] = "Bearer " + token;

    try {
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller ? setTimeout(function() { controller!.abort(); }, timeout) : null;
      var res = await fetch(BASE_URL + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: controller?.signal });
      if (timer) clearTimeout(timer);
      var data = await res.json().catch(function() { return {}; });

      if (res.status === 401 && !explicitToken) {
        // Só tenta refresh na PRIMEIRA tentativa (attempt === 0). Após isso,
        // se ainda voltar 401, é sessão terminalmente inválida.
        if (attempt === 0) {
          var result = await ensureRefresh();
          if (result.status === "ok") {
            // Token foi atualizado no store por refreshAccessToken; próxima
            // iteração do loop lê via _getToken() e refaz com Authorization fresco.
            continue;
          }
          if (result.status === "invalid") {
            // Falha terminal: refresh token expirado/revogado. Dispara logout
            // imediatamente — não continua pro retry loop (não adianta repetir).
            if (_onUnauthorized) _onUnauthorized();
            throw new ApiError((data as any).error || "Sessao expirada", 401, data, false, "session_expired");
          }
          // network_error no refresh: NÃO desloga o user (pode ser internet
          // intermitente). Lança ApiError de rede pro caller saber.
          throw new ApiError("Falha de conexao ao renovar sessao. Verifique sua internet.", 0, null, true, "network");
        }
        // 401 após retry: sessão realmente inválida.
        if (_onUnauthorized) _onUnauthorized();
        throw new ApiError((data as any).error || "Sessao expirada", 401, data, false, "session_expired");
      }
      if (res.status === 401) throw new ApiError((data as any).error || "Nao autorizado", 401, data, false, "unauthorized");
      if (res.status === 429 && attempt < retry) { await new Promise(function(r) { setTimeout(r, 1000 * (attempt + 1)); }); continue; }
      if (!res.ok) throw new ApiError((data as any).error || "Erro HTTP " + res.status, res.status, data);
      return data as T;
    } catch (err: any) {
      lastError = err;
      if (err instanceof ApiError) throw err;
      // AbortError = timeout do AbortController disparou. Não tem sentido
      // retentar (o próximo attempt também vai abortar no mesmo timeout).
      // Lança imediatamente com mensagem clara em vez de repetir N vezes.
      if (err && err.name === "AbortError") {
        throw new ApiError("Tempo limite excedido. Verifique sua conexao e tente novamente.", 0, null, true, "timeout");
      }
      if (attempt < retry) { await new Promise(function(r) { setTimeout(r, 800 * (attempt + 1)); }); continue; }
    }
  }
  throw lastError || new ApiError("Erro de conexao. Verifique sua internet.", 0, null, true, "network");
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

export type { TokenizeResponse, SubscribeResponse, KarateGateResponse } from "./billingApi";
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
