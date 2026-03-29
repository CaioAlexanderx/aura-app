import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { authApi, type LoginResponse } from "@/services/api";

const KEY = "aura_token";
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
  hydrate:    () => Promise<void>;
  login:      (email: string, password: string) => Promise<void>;
  loginDemo:  () => Promise<void>;
  register:   (name: string, email: string, password: string, companyName: string) => Promise<void>;
  logout:     () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null, user: null, company: null, isLoading: false, isHydrated: false, isDemo: false,

  hydrate: async () => {
    const token = await storage.get();
    if (!token) { set({ isHydrated: true }); return; }
    // Demo mode — skip API call
    if (token === DEMO_TOKEN) {
      set({ token, user: DEMO_USER as User, company: DEMO_COMPANY as Company, isDemo: true, isHydrated: true });
      return;
    }
    try {
      const { user, company } = await authApi.me(token);
      set({ token, user, company: company ?? null, isHydrated: true });
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
      set({ token, user, company: company ?? null, isLoading: false, isDemo: false });
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
    });
  },

  register: async (name, email, password, companyName) => {
    set({ isLoading: true });
    try {
      const { token, user, company } = await authApi.register({
        name, email, password, company_name: companyName,
      });
      await storage.set(token);
      set({ token, user, company: company ?? null, isLoading: false, isDemo: false });
    } catch (err) { set({ isLoading: false }); throw err; }
  },

  logout: async () => {
    await storage.del();
    set({ token: null, user: null, company: null, isDemo: false });
  },
}));
