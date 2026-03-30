import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { authApi, type LoginResponse } from "@/services/api";

const KEY = "aura_token";
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

const DEMO_USER = { id: "demo-user", name: "Caio", email: "demo@getaura.com.br", role: "client" } as const;
const DEMO_COMPANY = { id: "demo-company", name: "Aura Demo", plan: "negocio", onboarding_step: "complete" } as const;

type User    = LoginResponse["user"];
type Company = Exclude<LoginResponse["company"], null>;

type AuthState = {
  token:      string | null;
  user:       User | null;
  company:    Company | null;
  isLoading:  boolean;
  isHydrated: boolean;
  isDemo:     boolean;
  onboardingComplete: boolean;
  companyLogo: string | null;
  hydrate:    () => Promise<void>;
  login:      (email: string, password: string) => Promise<void>;
  loginDemo:  () => Promise<void>;
  register:   (name: string, email: string, password: string, companyName: string) => Promise<void>;
  logout:     () => Promise<void>;
  completeOnboarding: (data?: { logo?: string; cnpj?: string; businessType?: string }) => void;
  setCompanyLogo: (logo: string) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null, user: null, company: null, isLoading: false, isHydrated: false, isDemo: false,
  onboardingComplete: true, companyLogo: null,

  hydrate: async () => {
    const token = await storage.get();
    const obDone = obStorage.get() === "complete";
    if (!token) { set({ isHydrated: true }); return; }
    if (token === DEMO_TOKEN) {
      set({ token, user: DEMO_USER as User, company: DEMO_COMPANY as Company, isDemo: true, isHydrated: true, onboardingComplete: true });
      return;
    }
    try {
      const { user, company } = await authApi.me(token);
      const step = (company as any)?.onboarding_step;
      set({ token, user, company: company ?? null, isHydrated: true, onboardingComplete: obDone || step === "complete" });
    } catch {
      await storage.del();
      set({ isHydrated: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { token, user, company } = await authApi.login(email, password);
      await storage.set(token);
      const step = (company as any)?.onboarding_step;
      const obDone = obStorage.get() === "complete";
      set({ token, user, company: company ?? null, isLoading: false, isDemo: false, onboardingComplete: obDone || step === "complete" || step === undefined });
    } catch (err) { set({ isLoading: false }); throw err; }
  },

  loginDemo: async () => {
    set({ isLoading: true });
    await storage.set(DEMO_TOKEN);
    set({
      token: DEMO_TOKEN,
      user: DEMO_USER as User,
      company: DEMO_COMPANY as Company,
      isLoading: false,
      isDemo: true,
      onboardingComplete: true,
    });
  },

  register: async (name, email, password, companyName) => {
    set({ isLoading: true });
    try {
      const { token, user, company } = await authApi.register({
        name, email, password, company_name: companyName,
      });
      await storage.set(token);
      obStorage.del(); // Reset onboarding flag for new registration
      set({ token, user, company: company ?? null, isLoading: false, isDemo: false, onboardingComplete: false });
    } catch (err) { set({ isLoading: false }); throw err; }
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
    obStorage.del();
    set({ token: null, user: null, company: null, isDemo: false, onboardingComplete: true, companyLogo: null });
  },
}));
