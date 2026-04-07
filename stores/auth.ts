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

const KEY = "aura_token";
const REFRESH_KEY = "aura_refresh_token";
const OB_KEY = "aura_onboarding";
const DEMO_TOKEN = "demo-token-aura-2026";

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

const obStorage = {
  get: (): string | null =>
    Platform.OS === "web" ? localStorage.getItem(OB_KEY) : null,
  set: (v: string): void => {
    if (Platform.OS === "web") localStorage.setItem(OB_KEY, v);
  },
  del: (): void => {
    if (Platform.OS === "web") localStorage.removeItem(OB_KEY);
  },
};

const DEMO_USER = {
  id: "demo-user",
  name: "Caio",
  email: "demo@getaura.com.br",
  role: "client",
  is_staff: false,
} as const;

const DEMO_COMPANY = {
  id: "demo-company",
  name: "Aura Demo",
  plan: "negocio",
  onboarding_step: "complete",
  trial_active: false,
  trial_ends_at: null,
} as const;

type User = LoginResponse["user"];
type Company = Exclude<LoginResponse["company"], null>;

function isObComplete(step: string | undefined, obDone: boolean, staff: boolean): boolean {
  return obDone || staff || step === "complete" || step === "done" || step === undefined;
}

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  company: Company | null;
  isLoading: boolean;
  isHydrated: boolean;
  isStaff: boolean;
  isDemo: boolean;
  onboardingComplete: boolean;
  companyLogo: string | null;
  trialActive: boolean;
  trialEndsAt: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: (data?: { logo?: string; cnpj?: string; businessType?: string }) => void;
  setCompanyLogo: (logo: string) => void;
};

export const useAuthStore = create<AuthState>((set, get) => {
  setTokenGetter(() => get().token);

  setOnUnauthorized(() => {
    const state = get();
    if (state.token && !state.isDemo) {
      console.warn("[AUTH] Token expired, logging out");
      state.logout();
    }
  });

  return {
    token: null,
    refreshToken: null,
    user: null,
    company: null,
    isLoading: false,
    isHydrated: false,
    isStaff: false,
    isDemo: false,
    onboardingComplete: true,
    companyLogo: null,
    trialActive: false,
    trialEndsAt: null,

    hydrate: async () => {
      const token = await storage.get();
      const savedRefresh = await refreshStorage.get();
      const obDone = obStorage.get() === "complete";

      if (!token) {
        set({ isHydrated: true });
        return;
      }

      if (token === DEMO_TOKEN) {
        set({
          token,
          refreshToken: null,
          user: DEMO_USER as User,
          company: DEMO_COMPANY as Company,
          isDemo: true,
          isStaff: false,
          isHydrated: true,
          onboardingComplete: true,
          trialActive: false,
        });
        return;
      }

      try {
        const { user, company } = await authApi.me(token);
        const step = (company as any)?.onboarding_step;
        const trialEnd = (company as any)?.trial_ends_at;
        const trialActive = !!(trialEnd && new Date(trialEnd) > new Date());
        const staff = !!(user?.is_staff || (user?.email || "").endsWith("@getaura.com.br"));

        set({
          token,
          refreshToken: savedRefresh,
          user,
          company: company ?? null,
          isStaff: staff,
          isHydrated: true,
          isDemo: false,
          onboardingComplete: isObComplete(step, obDone, staff),
          trialActive,
          trialEndsAt: trialEnd || null,
        });
      } catch {
        await storage.del();
        await refreshStorage.del();
        set({ isHydrated: true });
      }
    },

    login: async (email, password) => {
      set({ isLoading: true });
      try {
        const res = await authApi.login(email, password);
        const { token, user, company } = res;
        const refreshToken = (res as any).refresh_token || null;

        await storage.set(token);
        if (refreshToken) await refreshStorage.set(refreshToken);

        const step = (company as any)?.onboarding_step;
        const obDone = obStorage.get() === "complete";
        const trialEnd = (company as any)?.trial_ends_at;
        const staff = !!(user?.is_staff || (user?.email || "").endsWith("@getaura.com.br"));

        set({
          token,
          refreshToken,
          user,
          company: company ?? null,
          isLoading: false,
          isDemo: false,
          isStaff: staff,
          onboardingComplete: isObComplete(step, obDone, staff),
          trialActive: !!(trialEnd && new Date(trialEnd) > new Date()),
          trialEndsAt: trialEnd || null,
        });
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    loginDemo: async () => {
      set({ isLoading: true });
      await storage.set(DEMO_TOKEN);
      set({
        token: DEMO_TOKEN,
        refreshToken: null,
        user: DEMO_USER as User,
        company: DEMO_COMPANY as Company,
        isLoading: false,
        isDemo: true,
        isStaff: false,
        onboardingComplete: true,
        trialActive: false,
      });
    },

    register: async (body: RegisterBody) => {
      set({ isLoading: true });
      try {
        const res = await authApi.register(body);
        const { token, user, company } = res;
        const refreshToken = (res as any).refresh_token || null;

        await storage.set(token);
        if (refreshToken) await refreshStorage.set(refreshToken);
        obStorage.del();

        const trialEnd = (company as any)?.trial_ends_at;

        set({
          token,
          refreshToken,
          user,
          company: company ?? null,
          isLoading: false,
          isDemo: false,
          isStaff: !!(user?.is_staff || (user?.email || "").endsWith("@getaura.com.br")),
          onboardingComplete: false,
          trialActive: !!(trialEnd && new Date(trialEnd) > new Date()),
          trialEndsAt: trialEnd || null,
        });
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    completeOnboarding: (data) => {
      obStorage.set("complete");
      const current = get().company;
      if (current && data) {
        set({
          onboardingComplete: true,
          companyLogo: data.logo || get().companyLogo,
          company: { ...current, ...(data.cnpj ? { cnpj: data.cnpj } as any : {}) },
        });
      } else {
        set({ onboardingComplete: true });
      }
    },

    setCompanyLogo: (logo) => set({ companyLogo: logo }),

    logout: async () => {
      await storage.del();
      await refreshStorage.del();
      obStorage.del();
      set({
        token: null,
        refreshToken: null,
        user: null,
        company: null,
        isStaff: false,
        isDemo: false,
        onboardingComplete: true,
        companyLogo: null,
        trialActive: false,
        trialEndsAt: null,
      });
    },
  };
});
