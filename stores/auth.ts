import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  authApi,
  setTokenGetter,
  setOnUnauthorized,
  setSessaoDoRefresh,
  renovarToken,
  encerrarSessaoNoServidor,
  type LoginResponse,
  type RegisterBody,
} from "@/services/api";
import {
  authMulticnpjApi,
  userCompaniesApi,
  type SwitcherCompany,
  type CreateCompanyBody,
  type CreateCompanyResponse,
} from "@/services/multicnpj";
import { apagarTodasAsVendasGuardadas, apagarVendasDeOutrosUsuarios } from "@/utils/vendaGuardada";
import { marcarLogin, limparMarcaDeLogin } from "@/services/aberturaAposLogin";
import { marcarSaidaVoluntaria } from "@/utils/destinoDepoisDoLogin";
import { MSG_SESSAO_TERMINOU } from "@/utils/mensagensDoApp";

const KEY = "aura_token";
const REFRESH_KEY = "aura_refresh_token";

const storage = {
  get: (): Promise<string | null> =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem(KEY))
      : SecureStore.getItemAsync(KEY),
  set: (v: string): Promise<void> =>
    Platform.OS === "web"
      ? (localStorage.setItem(KEY, v), Promise.resolve())
      : SecureStore.setItemAsync(KEY, v),
  del: (): Promise<void> =>
    Platform.OS === "web"
      ? (localStorage.removeItem(KEY), Promise.resolve())
      : SecureStore.deleteItemAsync(KEY),
};

const refreshStorage = {
  get: (): Promise<string | null> =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem(REFRESH_KEY))
      : SecureStore.getItemAsync(REFRESH_KEY),
  set: (v: string): Promise<void> =>
    Platform.OS === "web"
      ? (localStorage.setItem(REFRESH_KEY, v), Promise.resolve())
      : SecureStore.setItemAsync(REFRESH_KEY, v),
  del: (): Promise<void> =>
    Platform.OS === "web"
      ? (localStorage.removeItem(REFRESH_KEY), Promise.resolve())
      : SecureStore.deleteItemAsync(REFRESH_KEY),
};

type User = LoginResponse["user"];
type Company = Exclude<LoginResponse["company"], null>;

// Nota: campo `isDemo` mantido no state (sempre false) para nao quebrar
// destructurings em ~38 arquivos que ainda referenciam ele. O modo demo foi
// removido do UI (botao no login + loginDemo + DEMO_TOKEN). O campo ficara
// sempre false e sera limpo dos consumers numa passada de refactor futura.
type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  company: Company | null;
  isLoading: boolean;
  isHydrated: boolean;
  isStaff: boolean;
  isDemo: boolean;
  companyLogo: string | null;
  trialActive: boolean;
  trialEndsAt: string | null;
  // Multi-CNPJ (M1-05 + Sessao 1 consolidated-default)
  availableCompanies: SwitcherCompany[];
  companiesLoading: boolean;
  consolidatedView: boolean;
  companyCount: number;
  switching: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** Devolve a resposta do cadastro (tq-69: whatsapp_handshake com o código AURA-XXXX). */
  register: (body: RegisterBody) => Promise<any>;
  // 14/10/2026: o logout apaga a venda do Caixa guardada neste navegador
  // (tem cliente e CPF). Sessão que EXPIROU (401) mantém: a chave é por
  // usuário, e quem volta a entrar retoma o carrinho em vez de perdê-lo.
  logout: (opcoes?: { manterVendaGuardada?: boolean }) => Promise<void>;
  setCompanyLogo: (logo: string) => void;
  // Atualiza campos da company no store (usado apos salvar perfil)
  updateCompany: (partial: Partial<Company & { phone?: string; email?: string; address?: string; cnpj?: string }>) => void;
  // 2026-05-21 (F6 do polish pre-Fase 7): combate armadilha_plano_stale_jwt.
  // Refaz /auth/me e atualiza company.plan / module_overrides / vertical sem
  // perder token nem outras claims. Toda tela com gate condicional (ex:
  // FoodShell) deve chamar refreshMe no mount.
  refreshMe: () => Promise<void>;
  // Multi-CNPJ actions (M1-05)
  loadCompanies: () => Promise<void>;
  switchCompany: (companyId: string | "all") => Promise<void>;
  addCompany: (body: CreateCompanyBody) => Promise<CreateCompanyResponse>;
};

// MULTICNPJ Sessao 1: helper centralizado pra reload pos-switch.
//
// FIX 2026-05-03: ordem de prioridade do redirect:
//   1. `aura_post_switch_redirect` (set pelo <RequireCompanyScope />): gate quer
//      voltar pra URL especifica
//   2. URL atual via window.location.reload(): preserva onde o user estava
//      (caso ele use o switcher do header em qualquer tela)
//
// Antes era hardcoded "/" — sempre voltava pro Painel mesmo se o user troca
// de empresa enquanto esta no Estoque, Financeiro etc.
function reloadAfterSwitch() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  setTimeout(() => {
    try {
      const explicitRedirect = window.sessionStorage.getItem("aura_post_switch_redirect");
      if (explicitRedirect && explicitRedirect !== "/") {
        window.sessionStorage.removeItem("aura_post_switch_redirect");
        window.location.href = explicitRedirect;
        return;
      }
      // Default: preserva URL atual (reload na mesma pagina)
      window.location.reload();
    } catch {
      try { window.location.reload(); } catch {}
    }
  }, 200);
}

// Guard contra disparos múltiplos do _onUnauthorized handler. Quando várias
// requisições em paralelo recebem 401 (ex: dashboard com 8 widgets), todas
// chamam _onUnauthorized — sem guard, o logout() roda múltiplas vezes e o
// redirect (window.location.href = "/") pode atropelar a si mesmo. O guard
// é resetado no início do login/register/hydrate (próxima sessão limpa).
let _logoutInProgress = false;

// ── /auth/me: uma chamada por vez, e nada de repetir logo em seguida ──
// QA 23/09/2026: abrir o app chamava /auth/me DUAS vezes. hydrate() lê o
// token do storage e chama /me; quando termina, grava o token no estado, o
// layout das abas reage ao token e o seu "refetch no mount" (armadilha 1 do
// CLAUDE.md — plano stale no JWT) chama refreshMe(): outra ida ao servidor,
// milissegundos depois, com a mesma resposta. Agora:
//   · a mesma chamada em voo é compartilhada (mesmo token = mesma promise);
//   · refreshMe() não repete um /me que TERMINOU há menos de JANELA_DO_ME_MS
//     com o mesmo token — o estado acabou de ser gravado com ele.
// Todo refreshMe() do app é "revalidar no mount"; nenhum depende de pular
// essa janela (pagamento/upgrade recarregam a página ou esperam o backend
// por outro caminho).
export const JANELA_DO_ME_MS = 3000;
let _meEmVoo: { token: string; promessa: Promise<any> } | null = null;
let _ultimoMe: { token: string; em: number } | null = null;

function buscarMe(token: string): Promise<any> {
  if (_meEmVoo && _meEmVoo.token === token) return _meEmVoo.promessa;
  const promessa: Promise<any> = authApi.me(token)
    .then((res: any) => { _ultimoMe = { token, em: Date.now() }; return res; })
    .finally(() => { if (_meEmVoo && _meEmVoo.promessa === promessa) _meEmVoo = null; });
  _meEmVoo = { token, promessa };
  return promessa;
}

function meAcabouDeVoltar(token: string): boolean {
  return !!_ultimoMe && _ultimoMe.token === token && Date.now() - _ultimoMe.em < JANELA_DO_ME_MS;
}

// Campos que o /auth/me preenche: o que difere do estado atual (objetos
// comparados por conteúdo, primitivos por valor). Vazio = nada a gravar.
function mudancasDoMe(atual: Record<string, any>, proximo: Record<string, any>): Record<string, any> {
  const patch: Record<string, any> = {};
  for (const k of Object.keys(proximo)) {
    const a = atual[k];
    const b = proximo[k];
    if (a === b) continue;
    if (a && b && typeof a === "object" && typeof b === "object") {
      try { if (JSON.stringify(a) === JSON.stringify(b)) continue; } catch { /* grava */ }
    }
    patch[k] = b;
  }
  return patch;
}

// ── Abertura do app sem derrubar a sessão (incidente 09/11/2026) ──
// O app instalado (PWA) é fechado pelo sistema o tempo todo; cada volta é
// uma abertura a frio, que passa pelo hydrate(). Antes, o hydrate chamava
// /auth/me com o access token guardado (1 h de vida) e, em QUALQUER erro,
// apagava token E refresh token: abrir o app mais de 1 h depois do último
// uso (401 do access vencido, sem tentar o refresh) ou sem rede/servidor
// lento deslogava a pessoa, com o refresh token ainda válido por dias.
// Agora: 401 → renova pelo refresh e tenta de novo; só "refresh inválido"
// (401 do /auth/refresh) ou 404 do /me apagam a sessão. Rede, 5xx e
// timeout mantêm a sessão e abrem com o último /me guardado.
type ResultadoDaAbertura =
  | { tipo: "ok"; token: string; me: any }
  | { tipo: "expirou" }
  | { tipo: "sem_resposta"; token: string | null };

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Renovação que nunca lança: qualquer exceção vira "sem resposta" (a
// sessão fica), nunca "expirou".
async function renovarSemLancar(): Promise<{ status: "ok"; token: string } | { status: "invalid" } | { status: "network_error" }> {
  try {
    const r = await renovarToken();
    return r && (r as any).status ? r : { status: "network_error" };
  } catch {
    return { status: "network_error" };
  }
}
export const ESPERA_ANTES_DE_REPETIR_O_ME_MS = 1500;

async function meComRenovacao(tokenInicial: string | null): Promise<ResultadoDaAbertura> {
  let tk = tokenInicial;
  let renovou = false;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (!tk) {
      if (renovou) return { tipo: "sem_resposta", token: tokenInicial };
      renovou = true;
      const r = await renovarSemLancar();
      if (r.status === "ok") tk = r.token;
      else if (r.status === "invalid") return { tipo: "expirou" };
      else return { tipo: "sem_resposta", token: tokenInicial };
    }
    try {
      const me = await buscarMe(tk);
      return { tipo: "ok", token: tk, me };
    } catch (err: any) {
      const status = err && typeof err.status === "number" ? err.status : 0;
      if (status === 401) { tk = null; continue; } // access vencido: renova
      if (status === 404) return { tipo: "expirou" }; // usuário não existe mais
      // Rede, timeout, 5xx: uma segunda tentativa curta e, depois, segue
      // com a sessão guardada.
      if (tentativa === 0) { await esperar(ESPERA_ANTES_DE_REPETIR_O_ME_MS); continue; }
      return { tipo: "sem_resposta", token: tk };
    }
  }
  return { tipo: "sem_resposta", token: tk };
}

async function meSemRenovacao(token: string | null): Promise<ResultadoDaAbertura> {
  if (!token) return { tipo: "expirou" };
  try {
    return { tipo: "ok", token, me: await buscarMe(token) };
  } catch (err: any) {
    const status = err && typeof err.status === "number" ? err.status : 0;
    if (status === 401 || status === 404) return { tipo: "expirou" };
    return { tipo: "sem_resposta", token };
  }
}

// Último /auth/me deste aparelho, para abrir sem rede. Só no web, só os
// campos que o estado usa, apagado no logout e trocado a cada login.
const CHAVE_DO_ULTIMO_ME = "aura_ultimo_me";
type UltimoMe = { user: any; company: any; consolidated_view: boolean; company_count: number };

function guardarUltimoMe(me: any): void {
  if (Platform.OS !== "web" || !me || !me.user) return;
  try {
    const v: UltimoMe = {
      user: me.user,
      company: me.company ?? null,
      consolidated_view: !!me.consolidated_view,
      company_count: me.company_count || 0,
    };
    localStorage.setItem(CHAVE_DO_ULTIMO_ME, JSON.stringify(v));
  } catch { /* sem storage */ }
}

function idDoToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const parte = token.split(".")[1];
    if (!parte || typeof atob !== "function") return null;
    const json = atob(parte.replace(/-/g, "+").replace(/_/g, "/"));
    const id = JSON.parse(json)?.id;
    return typeof id === "string" ? id : null;
  } catch { return null; }
}

function lerUltimoMe(token: string | null): UltimoMe | null {
  if (Platform.OS !== "web") return null;
  try {
    const raw = localStorage.getItem(CHAVE_DO_ULTIMO_ME);
    if (!raw) return null;
    const v = JSON.parse(raw) as UltimoMe;
    if (!v || !v.user) return null;
    // Nunca abre com os dados de outra pessoa (troca de conta no aparelho).
    const id = idDoToken(token);
    if (id && v.user.id && v.user.id !== id) return null;
    return v;
  } catch { return null; }
}

function apagarUltimoMe(): void {
  if (Platform.OS !== "web") return;
  try { localStorage.removeItem(CHAVE_DO_ULTIMO_ME); } catch { /* sem storage */ }
}

// Estado que o /auth/me preenche (hydrate, refreshMe e a abertura sem rede).
function estadoDoMe(meRes: any, companyCountAtual = 0) {
  const { user, company } = meRes;
  const consolidatedFromApi = !!meRes.consolidated_view;
  const trialEnd = (company as any)?.trial_ends_at;
  return {
    user,
    company: consolidatedFromApi ? null : (company ?? null),
    isStaff: !!(user?.is_staff || (user?.email || "").endsWith("@getaura.com.br")),
    trialActive: !!(trialEnd && new Date(trialEnd) > new Date()),
    trialEndsAt: trialEnd || null,
    consolidatedView: consolidatedFromApi,
    companyCount: meRes.company_count || companyCountAtual || 0,
  };
}

/** Só para testes: zera o controle do /auth/me entre casos. */
export function __zerarControleDoMe(): void {
  _meEmVoo = null;
  _ultimoMe = null;
}

export const useAuthStore = create<AuthState>((set, get) => {
  setTokenGetter(() => get().token);
  // Mocks antigos de @/services/api não têm esta função: só registra se houver.
  if (typeof setSessaoDoRefresh === "function") setSessaoDoRefresh({ getState: get, setState: set });

  setOnUnauthorized(() => {
    // Idempotente: só dispara logout uma vez por "rajada" de 401s paralelos.
    if (_logoutInProgress) return;
    const state = get();
    if (!state.token) return; // já deslogado, nada a fazer
    _logoutInProgress = true;
    console.warn("[AUTH] Token expired, logging out");
    // Mensagem ao user antes do redirect (web). Toast lib não está
    // integrada — usa alert nativo como fallback visível. Quando o
    // sistema de toast canônico chegar, trocar aqui.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          "aura_session_expired_msg",
          MSG_SESSAO_TERMINOU
        );
      } catch {}
    }
    // logout() já: limpa storage (token + refreshToken), reseta state,
    // redireciona pra "/" após 100ms. Reset do guard no finally pra não
    // travar caso logout() lance.
    state.logout({ manterVendaGuardada: true }).finally(() => {
      // Mantém true até o redirect acontecer; o reload destrói o módulo.
      // Em mobile (sem reload), libera após pequeno delay pra evitar
      // re-trigger imediato por requests em fila.
      if (Platform.OS !== "web") {
        setTimeout(() => { _logoutInProgress = false; }, 1000);
      }
    });
  });

  // Helper: dispara loadCompanies em background sem bloquear o caller.
  // Usado em hydrate/login/register para popular o switcher.
  function backgroundLoadCompanies() {
    setTimeout(() => {
      get()
        .loadCompanies()
        .catch((err) => {
          console.warn("[AUTH] background loadCompanies failed:", err?.message || err);
        });
    }, 0);
  }

  return {
    token: null,
    refreshToken: null,
    user: null,
    company: null,
    isLoading: false,
    isHydrated: false,
    isStaff: false,
    isDemo: false,
    companyLogo: null,
    trialActive: false,
    trialEndsAt: null,
    availableCompanies: [],
    companiesLoading: false,
    consolidatedView: false,
    companyCount: 0,
    switching: false,

    hydrate: async () => {
      // Nova sessão: libera o guard de logout (caso o módulo tenha sido
      // recarregado mas a flag ficado true em algum edge case).
      _logoutInProgress = false;
      const token = await storage.get();
      const savedRefresh = await refreshStorage.get();

      if (!token && !savedRefresh) {
        set({ isHydrated: true });
        return;
      }

      // O refresh vai para o estado ANTES de qualquer chamada: um 401 de
      // outra requisição que saia durante a abertura já acha com o que
      // renovar (antes ele só entrava no estado depois do /me).
      set({ refreshToken: savedRefresh });

      // Sem refresh guardado (sessão antiga) não há como renovar: o
      // comportamento é o de antes, com o access que houver.
      const r = savedRefresh
        ? await meComRenovacao(token)
        : await meSemRenovacao(token);

      if (r.tipo === "expirou") {
        // Sessão terminou de verdade (refresh inválido/expirado/revogado).
        await storage.del();
        await refreshStorage.del();
        apagarUltimoMe();
        set({ token: null, refreshToken: null, isHydrated: true });
        return;
      }

      if (r.tipo === "ok") {
        // MULTICNPJ Sessao 1: API devolve consolidated_view e company_count;
        // com consolidated_view=true, company vem null.
        if (r.token !== token) await storage.set(r.token);
        guardarUltimoMe(r.me);
        set({
          token: r.token,
          refreshToken: get().refreshToken || savedRefresh,
          ...estadoDoMe(r.me),
          isHydrated: true,
          isDemo: false,
        });
        backgroundLoadCompanies();
        return;
      }

      // Sem resposta do servidor (rede, timeout, 5xx): a sessão FICA. Abre
      // com o último /me deste aparelho e revalida assim que der. Se o
      // access estiver vencido, o 401 da próxima requisição renova.
      const tokenDaSessao = r.token || token;
      const ultimo = lerUltimoMe(tokenDaSessao);
      set({
        token: tokenDaSessao,
        refreshToken: get().refreshToken || savedRefresh,
        ...(ultimo ? estadoDoMe(ultimo) : {}),
        isHydrated: true,
        isDemo: false,
      });
      setTimeout(() => { get().refreshMe().catch(() => {}); }, 4000);
    },

    login: async (email, password) => {
      _logoutInProgress = false;
      set({ isLoading: true });
      try {
        const res: any = await authApi.login(email, password);
        const { token, user, company } = res;
        const refreshToken = res.refresh_token || null;
        const consolidatedFromApi = !!res.consolidated_view;
        const companyCount = res.company_count || 0;

        await storage.set(token);
        if (refreshToken) await refreshStorage.set(refreshToken);
        // 09/11/2026: o último /me guardado passa a ser o desta conta.
        guardarUltimoMe(res);
        // 17/10/2026 (t2-14): a 1ª tela depois do login é abertura de login,
        // não retorno (services/registroDeTelas separa as duas).
        marcarLogin();
        // 14/10/2026: troca de usuário no navegador — a venda guardada de
        // outro usuário (sessão expirada) não fica para este.
        apagarVendasDeOutrosUsuarios(user?.id);

        const trialEnd = (company as any)?.trial_ends_at;
        const staff = !!(user?.is_staff || (user?.email || "").endsWith("@getaura.com.br"));

        set({
          token,
          refreshToken,
          user,
          company: consolidatedFromApi ? null : (company ?? null),
          isLoading: false,
          isDemo: false,
          isStaff: staff,
          trialActive: !!(trialEnd && new Date(trialEnd) > new Date()),
          trialEndsAt: trialEnd || null,
          availableCompanies: [],
          consolidatedView: consolidatedFromApi,
          companyCount,
        });

        backgroundLoadCompanies();
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    register: async (body: RegisterBody) => {
      _logoutInProgress = false;
      set({ isLoading: true });
      try {
        const res: any = await authApi.register(body);
        const { token, user, company } = res;
        const refreshToken = res.refresh_token || null;
        const consolidatedFromApi = !!res.consolidated_view;
        const companyCount = res.company_count || (company ? 1 : 0);

        await storage.set(token);
        if (refreshToken) await refreshStorage.set(refreshToken);
        guardarUltimoMe(res);
        // 17/10/2026 (t2-14): a 1ª tela depois do cadastro é abertura de login.
        marcarLogin();

        const trialEnd = (company as any)?.trial_ends_at;

        set({
          token,
          refreshToken,
          user,
          company: consolidatedFromApi ? null : (company ?? null),
          isLoading: false,
          isDemo: false,
          isStaff: !!(user?.is_staff || (user?.email || "").endsWith("@getaura.com.br")),
          trialActive: !!(trialEnd && new Date(trialEnd) > new Date()),
          trialEndsAt: trialEnd || null,
          availableCompanies: [],
          consolidatedView: consolidatedFromApi,
          companyCount,
        });

        backgroundLoadCompanies();
        return res;
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    setCompanyLogo: (logo) => set({ companyLogo: logo }),

    updateCompany: (partial) => {
      const current = get().company;
      if (!current) return;
      set({ company: { ...current, ...partial } });
    },

    // 2026-05-21 (F6): refetch /auth/me sem perder token nem refresh. Re-cria
    // company com claims atuais (plan, module_overrides, vertical_active,
    // billing_status). Best-effort: erro nao desloga; apenas loga e segue
    // com state atual.
    refreshMe: async () => {
      const tk = get().token;
      if (!tk) return;
      // Acabou de voltar um /me com este token (o do hydrate, na abertura):
      // o estado já está fresco. Se houver um em voo, espera o mesmo.
      if (!_meEmVoo && meAcabouDeVoltar(tk)) return;
      try {
        let meRes: any;
        try {
          meRes = await buscarMe(tk);
        } catch (err: any) {
          // 09/11/2026: access vencido (app voltou do segundo plano) renova e
          // tenta de novo, em vez de ficar com o estado velho até o próximo 401.
          if (!(err && err.status === 401)) throw err;
          const r = await renovarSemLancar();
          if (r.status !== "ok") throw err;
          meRes = await buscarMe(r.token);
        }
        guardarUltimoMe(meRes);
        const { user, company } = meRes;
        const consolidatedFromApi = !!meRes.consolidated_view;
        const companyCount = meRes.company_count || get().companyCount || 0;
        const trialEnd = (company as any)?.trial_ends_at;
        const trialActive = !!(trialEnd && new Date(trialEnd) > new Date());
        const staff = !!(user?.is_staff || (user?.email || "").endsWith("@getaura.com.br"));
        // 14/10/2026 (t2-16): a revalidação agora roda em segundo plano
        // (useRevalidarMe), com a loja usando o app. Só grava o que mudou:
        // resposta igual não troca a referência de `company`/`user`, então
        // nenhuma tela re-renderiza nem refaz efeito que dependa dela.
        const atual = get();
        const proximo: Partial<AuthState> = {
          user,
          company: consolidatedFromApi ? null : (company ?? null),
          isStaff: staff,
          trialActive,
          trialEndsAt: trialEnd || null,
          consolidatedView: consolidatedFromApi,
          companyCount,
        };
        const patch = mudancasDoMe(atual, proximo);
        if (Object.keys(patch).length > 0) set(patch);
      } catch (err: any) {
        console.warn("[AUTH] refreshMe failed:", err?.message || err);
      }
    },

    logout: async (opcoes) => {
      limparMarcaDeLogin();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try { localStorage.setItem("aura_theme", "dark"); } catch {}
      }
      // Saída de verdade: a venda guardada do Caixa não fica para o próximo
      // a entrar neste navegador (utils/vendaGuardada). O botão chama
      // logout() sem argumento — ou com o evento do clique —, então só o
      // valor exato true mantém.
      if (!(opcoes && (opcoes as any).manterVendaGuardada === true)) {
        apagarTodasAsVendasGuardadas();
        // tq-91: no Sair, a tela de onde a pessoa saiu não vira destino do
        // próximo login. Sessão expirada (401) guarda: quem entra de novo
        // volta para onde estava.
        marcarSaidaVoluntaria();
      }
      // 09/11/2026: o refresh token deste aparelho morre no servidor também
      // (antes o "Sair" só apagava daqui). Melhor esforço, sem esperar.
      let refreshDaSessao: string | null = get().refreshToken;
      if (!refreshDaSessao) { try { refreshDaSessao = await refreshStorage.get(); } catch { refreshDaSessao = null; } }
      try { encerrarSessaoNoServidor(refreshDaSessao); } catch { /* melhor esforço */ }
      // Limpa storage ANTES de resetar state, garantindo que mesmo se o
      // redirect falhar, o próximo boot não rehidrata sessão expirada.
      await storage.del();
      await refreshStorage.del();
      apagarUltimoMe();
      set({
        token: null,
        refreshToken: null,
        user: null,
        company: null,
        isStaff: false,
        isDemo: false,
        companyLogo: null,
        trialActive: false,
        trialEndsAt: null,
        availableCompanies: [],
        companiesLoading: false,
        consolidatedView: false,
        companyCount: 0,
        switching: false,
      });
      if (Platform.OS === "web" && typeof window !== "undefined") {
        setTimeout(() => {
          try { window.location.href = "/"; } catch {}
        }, 100);
      }
    },

    // ── Multi-CNPJ actions (M1-05) ──────────────────────

    loadCompanies: async () => {
      if (!get().token) return;
      set({ companiesLoading: true });
      try {
        const res = await authMulticnpjApi.companies();
        set({
          availableCompanies: res.companies || [],
          consolidatedView: !!res.consolidated_view,
          companyCount: res.companies?.length || 0,
          companiesLoading: false,
        });
      } catch (err) {
        console.warn("[AUTH] loadCompanies error:", err);
        set({ companiesLoading: false });
      }
    },

    switchCompany: async (companyId: string | "all") => {
      const state = get();
      if (!state.token) throw new Error("Não autenticado");

      if (
        companyId !== "all" &&
        state.company?.id === companyId &&
        !state.consolidatedView
      ) {
        return;
      }

      set({ switching: true });
      try {
        const res = await authMulticnpjApi.switchCompany(companyId);
        const newToken = res.token;

        await storage.set(newToken);

        if (res.consolidated_view) {
          set({
            token: newToken,
            company: null,
            consolidatedView: true,
            switching: false,
            availableCompanies: state.availableCompanies.map((c) => ({
              ...c,
              is_current: false,
            })),
          });
        } else {
          const cc = res.current_company;
          if (!cc) throw new Error("Resposta inválida do servidor");

          const newCompany: any = {
            id: cc.id,
            name: cc.name,
            // 24/10/2026: a etiqueta usa o nome fantasia no topo.
            trade_name: cc.trade_name ?? null,
            legal_name: cc.legal_name ?? null,
            plan: cc.plan,
            onboarding_step: cc.onboarding_step || "",
            module_overrides: cc.module_overrides || {},
            trial_active: cc.trial_active,
            trial_ends_at: cc.trial_ends_at || undefined,
            vertical_active: cc.vertical || null,
            member_role: cc.member_role,
            billing_status: cc.billing_status,
            access_code_used: cc.access_code_used,
          };
          // tq-86: datas do atraso só quando o backend manda (campo ausente =
          // backend anterior, e o muro mantém o comportamento de antes).
          for (const k of ["billing_overdue_since", "billing_pause_screens_on", "billing_pause_caixa_on"] as const) {
            if (k in cc) newCompany[k] = (cc as any)[k] ?? null;
          }

          set({
            token: newToken,
            company: newCompany,
            consolidatedView: false,
            trialActive: cc.trial_active,
            trialEndsAt: cc.trial_ends_at || null,
            companyLogo: cc.logo_url || null,
            switching: false,
            availableCompanies: state.availableCompanies.map((c) => ({
              ...c,
              is_current: c.id === cc.id,
            })),
          });
        }

        // No web, força reload (preserva URL atual a menos que aura_post_switch_redirect
        // tenha sido salvo pelo RequireCompanyScope). No mobile, o estado atualizado
        // faz subscribers reagirem.
        reloadAfterSwitch();
      } catch (err) {
        set({ switching: false });
        throw err;
      }
    },

    addCompany: async (body: CreateCompanyBody) => {
      const res = await userCompaniesApi.create(body);
      get().loadCompanies().catch(() => {});
      return res;
    },
  };
});
