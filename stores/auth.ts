import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  authApi,
  setTokenGetter,
  setOnUnauthorized,
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
  register: (body: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
  setCompanyLogo: (logo: string) => void;
  // Atualiza campos da company no store (usado apos salvar perfil)
  updateCompany: (partial: Partial<Company & { phone?: string; email?: string; address?: string; cnpj?: string }>) => void;
  // Multi-CNPJ actions (M1-05)
  loadCompanies: () => Promise<void>;
  switchCompany: (companyId: string | "all") => Promise<void>;
  addCompany: (body: CreateCompanyBody) => Promise<CreateCompanyResponse>;
};

// MULTICNPJ Sessao 1: helper centralizado pra reload pos-switch.
// Respeita `aura_post_switch_redirect` que o <RequireCompanyScope />
// salva antes de disparar o switch. Sem essa chave, comportamento
// default (volta pra "/") preservado.
function reloadAfterSwitch() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  setTimeout(() => {
    try {
      const redirectTo = window.sessionStorage.getItem("aura_post_switch_redirect");
      if (redirectTo && redirectTo !== "/") {
        window.sessionStorage.removeItem("aura_post_switch_redirect");
        window.location.href = redirectTo;
      } else {
        window.location.href = "/";
      }
    } catch {
      try { window.location.href = "/"; } catch {}
    }
  }, 200);
}

export const useAuthStore = create<AuthState>((set, get) => {
  setTokenGetter(() => get().token);

  setOnUnauthorized(() => {
    const state = get();
    if (state.token) {
      console.warn("[AUTH] Token expired, logging out");
      state.logout();
    }
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
      const token = await storage.get();
      const savedRefresh = await refreshStorage.get();

      if (!token) {
        set({ isHydrated: true });
        return;
      }

      try {
        const meRes: any = await authApi.me(token);
        const { user, company } = meRes;
        // MULTICNPJ Sessao 1: API agora devolve consolidated_view e company_count direto.
        // Quando consolidated_view=true, company vem como null e nao devemos tentar
        // popular nada relacionado a uma empresa especifica.
        const consolidatedFromApi = !!meRes.consolidated_view;
        const companyCount = meRes.company_count || 0;
        const trialEnd = (company as any)?.trial_ends_at;
        const trialActive = !!(trialEnd && new Date(trialEnd) > new Date());
        const staff = !!(user?.is_staff || (user?.email || "").endsWith("@getaura.com.br"));

        set({
          token,
          refreshToken: savedRefresh,
          user,
          company: consolidatedFromApi ? null : (company ?? null),
          isStaff: staff,
          isHydrated: true,
          isDemo: false,
          trialActive,
          trialEndsAt: trialEnd || null,
          consolidatedView: consolidatedFromApi,
          companyCount,
        });

        backgroundLoadCompanies();
      } catch {
        await storage.del();
        await refreshStorage.del();
        set({ isHydrated: true });
      }
    },

    login: async (email, password) => {
      set({ isLoading: true });
      try {
        const res: any = await authApi.login(email, password);
        const { token, user, company } = res;
        const refreshToken = res.refresh_token || null;
        const consolidatedFromApi = !!res.consolidated_view;
        const companyCount = res.company_count || 0;

        await storage.set(token);
        if (refreshToken) await refreshStorage.set(refreshToken);

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
      set({ isLoading: true });
      try {
        const res: any = await authApi.register(body);
        const { token, user, company } = res;
        const refreshToken = res.refresh_token || null;
        const consolidatedFromApi = !!res.consolidated_view;
        const companyCount = res.company_count || (company ? 1 : 0);

        await storage.set(token);
        if (refreshToken) await refreshStorage.set(refreshToken);

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

    logout: async () => {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try { localStorage.setItem("aura_theme", "dark"); } catch {}
      }
      await storage.del();
      await refreshStorage.del();
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

    // ── Multi-CNPJ actions (M1-05) ────────────────────────

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

        // No web, força reload (respeitando redirect do RequireCompanyScope se houver).
        // No mobile, o estado atualizado faz subscribers reagirem.
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
