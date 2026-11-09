// ─── Infraestrutura HTTP ──────────────────────────────────────────────────────
// Este arquivo contém apenas o core de requisições (request, ApiError, auth helpers).
// Cada domínio de API fica em seu próprio arquivo em services/.
// Os re-exports abaixo mantêm compatibilidade com imports existentes de "@/services/api".

// 22/09/2026 (PWA Fase 2): o app instalado se identifica em toda requisicao
// (cabecalho X-Aura-App). Sem react-native em instalarApp.ts, este import
// e seguro aqui, que e carregado antes de tudo.
import { estaInstalado } from "@/services/instalarApp";
import {
  MSG_SEM_CONEXAO, MSG_SEM_CONEXAO_NA_SESSAO, MSG_SESSAO_TERMINOU, MSG_ERRO_NOSSO, MSG_DEMOROU_DEMAIS, MSG_ERRO_SEM_EXPLICACAO,
} from "@/utils/mensagensDoApp";

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
// 09/11/2026: o store de auth se registra aqui (como o setTokenGetter). Sem
// registro, o refresh cai no import dinâmico de antes.
type SessaoDoRefresh = { getState: () => any; setState: (p: any) => void };
var _sessao: SessaoDoRefresh | null = null;
export function setSessaoDoRefresh(s: SessaoDoRefresh) { _sessao = s; }

type RefreshResult = { status: "ok"; token: string } | { status: "invalid" } | { status: "network_error" };
// A3-FE: headers?: Record<string, string> added so callers can pass Idempotency-Key
// without touching the Authorization flow. Spread happens BEFORE the token assignment
// so Authorization always wins (a caller cannot accidentally clobber Bearer).
export type RequestOpts = { method?: string; body?: unknown; token?: string | null; retry?: number; timeout?: number; headers?: Record<string, string> };

// ─── Refresh JWT singleton (race-safe) ───────────────────────────────────────
// Múltiplas requisições paralelas que recebem 401 devem compartilhar a MESMA
// promise de refresh. O `finally` block garante cleanup das flags em TODOS os
// caminhos (sucesso, falha terminal, exceção, network error) — caso contrário
// um throw deixaria isRefreshing=true permanentemente, travando a sessão.
var isRefreshing = false;
var refreshPromise: Promise<RefreshResult> | null = null;

// 09/11/2026 (incidente: o app instalado deslogava): localStorage com
// try/catch -- no app nativo ele nao existe, e um throw aqui virava
// "network_error" sem motivo.
function lerLocal(chave: string): string | null {
  try { return typeof localStorage !== "undefined" ? localStorage.getItem(chave) : null; } catch { return null; }
}
function gravarLocal(chave: string, valor: string): void {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(chave, valor); } catch { /* sem storage */ }
}

async function pedirRefresh(refreshToken: string): Promise<Response> {
  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = controller ? setTimeout(function() { controller!.abort(); }, 8000) : null;
  var headers: Record<string, string> = { "Content-Type": "application/json" };
  // O backend usa o X-Aura-App para dar ao app instalado o prazo deslizante.
  if (estaInstalado()) headers["X-Aura-App"] = "standalone";
  try {
    return await fetch(BASE_URL + "/auth/refresh", { method: "POST", headers: headers, body: JSON.stringify({ refresh_token: refreshToken }), signal: controller?.signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// 09/11/2026: so 401 do /auth/refresh e "sessao terminou" (token invalido,
// expirado, revogado ou usuario desativado -- o backend garante isso desde
// o fix/pwa-sessao). 5xx, 403 de borda, timeout e rede = "network_error":
// a sessao fica, e a proxima requisicao tenta de novo.
async function refreshAccessToken(): Promise<RefreshResult> {
  try {
    var useAuthStore: SessaoDoRefresh = _sessao || (await import("@/stores/auth")).useAuthStore;
    // Abertura a frio: o hydrate pode nao ter posto o refresh no estado
    // ainda. O storage e a fonte de verdade.
    var refreshToken = useAuthStore.getState().refreshToken || lerLocal("aura_refresh_token");
    if (!refreshToken) return { status: "invalid" };
    var resp = await pedirRefresh(refreshToken);
    if (resp.status === 401) {
      // Outra aba (ou o app e o navegador no mesmo aparelho) pode ter
      // gravado um refresh token mais novo: tenta com ele uma vez.
      var maisNovo = lerLocal("aura_refresh_token");
      if (!maisNovo || maisNovo === refreshToken) return { status: "invalid" };
      refreshToken = maisNovo;
      resp = await pedirRefresh(refreshToken);
      if (resp.status === 401) return { status: "invalid" };
    }
    if (!resp.ok) return { status: "network_error" };
    var data = await resp.json();
    if (!data || typeof data.token !== "string") return { status: "network_error" };
    var patch: Record<string, any> = { token: data.token };
    gravarLocal("aura_token", data.token);
    // App instalado: o backend pode mandar um refresh token novo (prazo
    // deslizante). O antigo continua valendo ate o exp dele, entao perder
    // esta resposta nao desloga.
    if (typeof data.refresh_token === "string" && data.refresh_token) {
      patch.refreshToken = data.refresh_token;
      gravarLocal("aura_refresh_token", data.refresh_token);
    } else if (!useAuthStore.getState().refreshToken) {
      patch.refreshToken = refreshToken;
    }
    useAuthStore.setState(patch);
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

// tq-113 (26/10/2026): token novo sob demanda (mesmo singleton do 401).
// Usado ao confirmar o e-mail: a empresa reaberta pelo backend só entra na
// sessão com um JWT novo (utils/empresaAoConfirmar).
export function renovarToken(): Promise<RefreshResult> { return ensureRefresh(); }

// 09/11/2026: o "Sair" nunca avisava o servidor -- audit_log tinha 0
// 'logout' em 14 dias e nenhum refresh token era revogado. Com o prazo
// deslizante do app instalado (30 dias sem uso), o token que sai deste
// aparelho precisa morrer no servidor também. Melhor esforço: sem rede, o
// logout local segue igual.
export function encerrarSessaoNoServidor(refreshToken: string | null | undefined): void {
  if (!refreshToken || typeof fetch === "undefined") return;
  try {
    fetch(BASE_URL + "/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      keepalive: true,
    } as RequestInit).catch(function() { /* melhor esforço */ });
  } catch { /* melhor esforço */ }
}

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  var { method = "GET", body, retry = 2, timeout = 10000 } = opts;
  var explicitToken = opts.token !== undefined;
  var token = explicitToken ? opts.token : _getToken?.() || null;
  var lastError: Error | null = null;
  var jaRenovou = false;

  for (var attempt = 0; attempt <= retry; attempt++) {
    // Re-lê token do store a cada tentativa: após refresh, _getToken() já
    // devolve o token fresco (refreshAccessToken atualiza useAuthStore.setState).
    // Sem isso, o retry usaria o token antigo do closure e geraria 401 de novo.
    if (!explicitToken) token = _getToken?.() || null;
    // A3-FE: spread custom headers first so Authorization always overrides them.
    var headers: HeadersInit = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (token) headers["Authorization"] = "Bearer " + token;
    // 22/09/2026 (PWA Fase 2): quem abriu pelo icone do app instalado avisa o
    // backend, que grava no login (refresh_tokens.app_mode, migration 349)
    // para medir o uso pelo app. So vai quando e standalone: no navegador
    // comum nao ha cabecalho extra nem preflight a mais. DEPENDE do backend
    // aceitar X-Aura-App em allowedHeaders (src/app.js) -- sem isso, o
    // preflight recusa e nada funciona pelo app. Backend primeiro.
    if (estaInstalado()) (headers as Record<string, string>)["X-Aura-App"] = "standalone";

    try {
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller ? setTimeout(function() { controller!.abort(); }, timeout) : null;
      var res = await fetch(BASE_URL + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: controller?.signal });
      if (timer) clearTimeout(timer);
      var data = await res.json().catch(function() { return {}; });

      if (res.status === 401 && !explicitToken) {
        // Um refresh por chamada (antes: só na tentativa 0 -- um 401 depois
        // de uma falha de rede nem tentava renovar). A volta com o token
        // novo não gasta tentativa: com retry 0, o `continue` saía do laço e
        // a tela recebia "sem conexão" com a sessão já renovada.
        if (!jaRenovou) {
          jaRenovou = true;
          var result = await ensureRefresh();
          if (result.status === "ok") {
            attempt--;
            // Token foi atualizado no store por refreshAccessToken; próxima
            // iteração do loop lê via _getToken() e refaz com Authorization fresco.
            continue;
          }
          if (result.status === "invalid") {
            // Falha terminal: refresh token expirado/revogado. Dispara logout
            // imediatamente — não continua pro retry loop (não adianta repetir).
            if (_onUnauthorized) _onUnauthorized();
            throw new ApiError((data as any).error || MSG_SESSAO_TERMINOU, 401, data, false, "session_expired");
          }
          // network_error no refresh: NÃO desloga o user (pode ser internet
          // intermitente). Lança ApiError de rede pro caller saber.
          throw new ApiError(MSG_SEM_CONEXAO_NA_SESSAO, 0, null, true, "network");
        }
        // 09/11/2026: 401 DEPOIS de um refresh que deu certo não é sessão
        // vencida -- o token acabou de ser renovado. É um 401 da rota
        // (permissão, empresa trocada, rota que recusa o token novo). Antes
        // isto deslogava a pessoa; agora a sessão fica e o erro vai para a
        // tela. Sessão vencida de verdade sai pelo "invalid" acima.
        throw new ApiError((data as any).error || "Não autorizado", 401, data, false, "unauthorized");
      }
      if (res.status === 401) throw new ApiError((data as any).error || "Não autorizado", 401, data, false, "unauthorized");
      if (res.status === 429 && attempt < retry) { await new Promise(function(r) { setTimeout(r, 1000 * (attempt + 1)); }); continue; }
      if (res.status >= 500) {
        // Erro do NOSSO servidor (bug, instabilidade, timeout interno etc.) —
        // nunca da conexão do operador. A mensagem não pode sugerir que ele
        // depure a internet dele quando quem falhou fomos nós. Achado de QA
        // (11/08/2026): a tela de aprovação de filiação mostrava "verifique
        // sua conexão" para um 500 real do backend, mandando o operador
        // investigar o lugar errado.
        throw new ApiError((data as any).error || MSG_ERRO_NOSSO, res.status, data, false, "server_error");
      }
      if (!res.ok) {
        // O código HTTP não vai para a lojista: fica em ApiError.status e no console.
        if (!(data as any).error) console.warn("[api] resposta " + res.status + " sem texto em " + path);
        throw new ApiError((data as any).error || MSG_ERRO_SEM_EXPLICACAO, res.status, data);
      }
      return data as T;
    } catch (err: any) {
      lastError = err;
      if (err instanceof ApiError) throw err;
      // AbortError = o NOSSO AbortController abortou porque o `timeout`
      // configurado estourou. É um timeout de verdade do lado do cliente
      // (não é um 5xx mal classificado — aquele caminho está tratado acima,
      // antes deste catch, e nunca lança AbortError). Mas isso NÃO significa
      // que a operação falhou: o servidor pode ter recebido a requisição e
      // concluído normalmente depois que desistimos de esperar a resposta.
      // Por isso a mensagem não incentiva repetir sem checar antes —
      // especialmente crítico em ações sem desfazer pela tela.
      if (err && err.name === "AbortError") {
        throw new ApiError(MSG_DEMOROU_DEMAIS, 0, null, true, "timeout");
      }
      if (attempt < retry) { await new Promise(function(r) { setTimeout(r, 800 * (attempt + 1)); }); continue; }
    }
  }
  // Só chega aqui quem esgotou as tentativas sem resposta do servidor (o fetch
  // rejeitou: sem internet, DNS, rede bloqueando o backend). Relançar o
  // TypeError cru fazia as telas caírem no texto padrão delas: o login dizia
  // "E-mail ou senha incorretos." para um cliente cuja requisição nem chegou
  // ao backend (17/09/2026). Sai sempre como ApiError de rede.
  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(MSG_SEM_CONEXAO, 0, null, true, "network");
}

export { BASE_URL };

// ─── `api`: açúcar verbal sobre request() ────────────────────────────────────
// 17/08/2026 — POR QUE ISSO EXISTE:
// Vários módulos faziam `import { api } from "@/services/api"` e chamavam
// `api.post(...)` / `api.get(...)`. Esse símbolo NUNCA foi exportado daqui.
// Como o Metro não faz type-check no bundle, o import resolvia para `undefined`
// silenciosamente e só estourava em runtime como
//   TypeError: Cannot read properties of undefined (reading 'post')
// — engolido pelo `catch` da tela (virava um toast genérico) ou pelo React Query
// (virava lista vazia). Dois efeitos confirmados:
//   1. Canal Digital: o botão de aprovar/rejeitar Pix nunca funcionou desde
//      03/05/2026. Nenhum pedido na história do produto chegou a `confirmed`.
//   2. hooks/useModules.ts: a query sempre falhava -> `[]` -> hasModule() === false.
// A correção é fazer o contrato virar real, em vez de caçar call sites um a um
// (o Metro não avisaria os que sobrassem).
//
// ATENÇÃO ao editar: `scripts/check-source-integrity.mjs` (o mesmo check do CI)
// parseia TODO arquivo com @babel/parser usando plugins ["typescript", "jsx"] —
// os dois ligados, inclusive em `.ts`. Com o plugin `jsx` ativo, uma arrow
// genérica `<T = any>(...) => ...` é lida como abertura de tag JSX e quebra o
// parse. Por isso estes métodos usam `function <T = any>(...)`, que não é
// ambíguo. Mesma armadilha vale pra qualquer arrow genérica nova no repo.
export const api = {
  get: function <T = any>(path: string, opts: Omit<RequestOpts, "method" | "body"> = {}) {
    return request<T>(path, { ...opts, method: "GET" });
  },
  post: function <T = any>(path: string, body?: unknown, opts: Omit<RequestOpts, "method" | "body"> = {}) {
    return request<T>(path, { ...opts, method: "POST", body });
  },
  put: function <T = any>(path: string, body?: unknown, opts: Omit<RequestOpts, "method" | "body"> = {}) {
    return request<T>(path, { ...opts, method: "PUT", body });
  },
  patch: function <T = any>(path: string, body?: unknown, opts: Omit<RequestOpts, "method" | "body"> = {}) {
    return request<T>(path, { ...opts, method: "PATCH", body });
  },
  delete: function <T = any>(path: string, opts: Omit<RequestOpts, "method" | "body"> = {}) {
    return request<T>(path, { ...opts, method: "DELETE" });
  },
};

// ─── Re-exports de compatibilidade ───────────────────────────────────────────
// Imports existentes de "@/services/api" continuam funcionando sem alteração.
// Novos arquivos devem importar direto do domínio (ex: "@/services/salesApi").

export type { VerticalKey, LoginResponse, RegisterBody, CodeValidation, VerificationResponse, SidebarLayoutItem, SidebarLayout, PdvSettings } from "./authApi";
export { authApi, sidebarLayoutApi, pdvSettingsApi } from "./authApi";

export type { SaleStatus, SaleDetailsItem, SaleDetails, RemoveSaleItemResult, SalesListItem, SalesStats, SalesListResponse, SaleDetailFull, SalesFilters, UpdateSellerResponse } from "./salesApi";
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
