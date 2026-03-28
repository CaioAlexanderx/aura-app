import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { authApi, type LoginResponse } from "@/services/api";

const KEY = "aura_token";
const storage = {
  get: () => Platform.OS === "web" ? Promise.resolve(localStorage.getItem(KEY)) : SecureStore.getItemAsync(KEY),
  set: (v: string) => Platform.OS === "web" ? (localStorage.setItem(KEY, v), Promise.resolve()) : SecureStore.setItemAsync(KEY, v),
  del: () => Platform.OS === "web" ? (localStorage.removeItem(KEY), Promise.resolve()) : SecureStore.deleteItemAsync(KEY),
};

type User = LoginResponse["user"];
type Company = Exclude<LoginResponse["company"], null>;
type AuthState = {
  token: string | null; user: User | null; company: Company | null;
  isLoading: boolean; isHydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null, user: null, company: null, isLoading: false, isHydrated: false,

  hydrate: async () => {
    const token = await storage.get();
    if (!token) { set({ isHydrated: true }); return; }
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
      set({ token, user, company: company ?? null, isLoading: false });
    } catch (err) { set({ isLoading: false }); throw err; }
  },

  register: async (name, email, password, companyName) => {
    set({ isLoading: true });
    try {
      const { token, user, company } = await authApi.register({ name, email, password, company_name: companyName });
      await storage.set(token);
      set({ token, user, company: company ?? null, isLoading: false });
    } catch (err) { set({ isLoading: false }); throw err; }
  },

  logout: async () => { await storage.del(); set({ token: null, user: null, company: null }); },
}));
