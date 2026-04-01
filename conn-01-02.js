// conn-01-02.js
// Run from aura-app root: node conn-01-02.js
// CONN-01: api.ts upgrade (retry, error handling, all endpoints)
// CONN-02: auth.ts upgrade (real auth flow, is_staff, trial, code_applied)

const fs = require('fs');
const p = require('path');

// ============================================================
// CONN-01: services/api.ts — Full upgrade
// ============================================================

const apiContent = `import { Platform } from "react-native";

// ── Base URL ────────────────────────────────────────────────
// Em desenvolvimento: aponta para o Railway de producao
// Em producao: usar env var EXPO_PUBLIC_API_URL
const BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

// ── Error class ─────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// ── Token manager (injected by auth store) ──────────────────
let _getToken: (() => string | null) | null = null;
export function setTokenGetter(fn: () => string | null) {
  _getToken = fn;
}

// ── Core request with retry + timeout ───────────────────────
type RequestOpts = {
  method?: string;
  body?: unknown;
  token?: string | null;
  retry?: number;
  timeout?: number;
};

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, retry = 2, timeout = 10000 } = opts;

  // Resolve token: explicit > injected > none
  const token = opts.token !== undefined ? opts.token : _getToken?.() || null;

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = \`Bearer \${token}\`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;

      const res = await fetch(\`\${BASE_URL}\${path}\`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });

      if (timer) clearTimeout(timer);

      // Parse response
      const data = await res.json().catch(() => ({}));

      // 401: token expirado — nao faz retry
      if (res.status === 401) {
        throw new ApiError((data as any).error || "Sessao expirada", 401, data);
      }

      // 429: rate limit — espera e retenta
      if (res.status === 429 && attempt < retry) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      // Outros erros
      if (!res.ok) {
        throw new ApiError(
          (data as any).error || \`Erro HTTP \${res.status}\`,
          res.status,
          data
        );
      }

      return data as T;
    } catch (err: any) {
      lastError = err;

      // Nao retentar ApiErrors (exceto 429 tratado acima)
      if (err instanceof ApiError) throw err;

      // Network error: retentar
      if (attempt < retry) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new Error("Erro de rede desconhecido");
}

// ── Types ───────────────────────────────────────────────────
export type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    is_staff?: boolean;
  };
  company: {
    id: string;
    name: string;
    plan: string;
    onboarding_step: string;
    trial_active?: boolean;
    trial_ends_at?: string;
  } | null;
  code_applied?: {
    type: string;
    plan: string;
    discount_pct: number;
    trial_days: number;
  } | null;
};

export type RegisterBody = {
  name: string;
  email: string;
  password: string;
  company_name: string;
  phone?: string;
  cnpj?: string;
  access_code?: string;
};

export type CodeValidation = {
  valid: boolean;
  type?: string;
  plan?: string;
  discount_pct?: number;
  trial_days?: number;
  error?: string;
};

export type VerificationResponse = {
  sent?: boolean;
  destination?: string;
  expires_in?: number;
  already_verified?: boolean;
  valid?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  error?: string;
};

// ── Auth API ────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: { email, password }, retry: 1 }),

  register: (body: RegisterBody) =>
    request<LoginResponse>("/auth/register", { method: "POST", body, retry: 1 }),

  me: (token: string) =>
    request<Omit<LoginResponse, "token">>("/auth/me", { method: "POST", token, retry: 1 }),

  validateCode: (code: string) =>
    request<CodeValidation>("/auth/validate-code", { method: "POST", body: { code }, retry: 0 }),

  // Verification
  sendEmailVerification: () =>
    request<VerificationResponse>("/auth/send-verification", { method: "POST", retry: 0 }),

  verifyEmail: (code: string) =>
    request<VerificationResponse>("/auth/verify-email", { method: "POST", body: { code }, retry: 0 }),

  sendPhoneVerification: () =>
    request<VerificationResponse>("/auth/send-phone-verification", { method: "POST", retry: 0 }),

  verifyPhone: (code: string) =>
    request<VerificationResponse>("/auth/verify-phone", { method: "POST", body: { code }, retry: 0 }),
};

// ── Dashboard API ───────────────────────────────────────────
export const dashboardApi = {
  summary: (companyId: string, token?: string) =>
    request<any>(\`/companies/\${companyId}/withdrawal/summary\`, { token }),

  sparkline: (companyId: string, days?: number, token?: string) =>
    request<any>(\`/companies/\${companyId}/dashboard/sparkline?days=\${days || 7}\`, { token }),
};

// ── Companies API ───────────────────────────────────────────
export const companiesApi = {
  get: (companyId: string) =>
    request<any>(\`/companies/\${companyId}\`),

  transactions: (companyId: string, params?: string) =>
    request<any>(\`/companies/\${companyId}/transactions\${params ? "?" + params : ""}\`),

  createTransaction: (companyId: string, body: any) =>
    request<any>(\`/companies/\${companyId}/transactions\`, { method: "POST", body }),

  products: (companyId: string) =>
    request<any>(\`/companies/\${companyId}/products\`),

  customers: (companyId: string) =>
    request<any>(\`/companies/\${companyId}/customers\`),

  obligations: (companyId: string) =>
    request<any>(\`/companies/\${companyId}/obligations\`),

  payroll: (companyId: string, body: any) =>
    request<any>(\`/companies/\${companyId}/payroll/calculate\`, { method: "POST", body }),

  dre: (companyId: string, params?: string) =>
    request<any>(\`/companies/\${companyId}/dre\${params ? "?" + params : ""}\`),
};

// ── CNPJ API ────────────────────────────────────────────────
export const cnpjApi = {
  lookup: (cnpj: string) =>
    request<any>("/onboarding/cnpj-lookup", { method: "POST", body: { cnpj }, retry: 1 }),
};

// ── Onboarding API ──────────────────────────────────────────
export const onboardingApi = {
  get: (companyId: string) =>
    request<any>(\`/companies/\${companyId}/onboarding\`),

  stepCnpj: (companyId: string, cnpj: string) =>
    request<any>(\`/companies/\${companyId}/onboarding/step/cnpj\`, { method: "POST", body: { cnpj } }),

  stepRegime: (companyId: string, tax_regime: string) =>
    request<any>(\`/companies/\${companyId}/onboarding/step/regime\`, { method: "POST", body: { tax_regime } }),

  stepPerfil: (companyId: string, body: any) =>
    request<any>(\`/companies/\${companyId}/onboarding/step/perfil\`, { method: "POST", body }),
};

// ── Referrals API ───────────────────────────────────────────
export const referralsApi = {
  generate: () =>
    request<{ code: string; existing: boolean }>("/referrals/generate", { method: "POST" }),

  mine: () =>
    request<any>("/referrals/mine"),
};

// ── PDV / Sales API ─────────────────────────────────────────
export const pdvApi = {
  createSale: (companyId: string, body: any) =>
    request<any>(\`/companies/\${companyId}/pdv/sales\`, { method: "POST", body }),
};

// ── Admin API ───────────────────────────────────────────────
export const adminApi = {
  dashboard: () =>
    request<any>("/admin/dashboard"),

  clients: () =>
    request<any>("/admin/clients"),

  toggleModule: (companyId: string, module: string, enabled: boolean) =>
    request<any>(\`/admin/clients/\${companyId}/modules\`, {
      method: "PUT",
      body: { module, enabled },
    }),
};

export { request, BASE_URL };
`;

// ============================================================
// CONN-02: stores/auth.ts — Real auth flow upgrade
// ============================================================

const authContent = `import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  authApi,
  setTokenGetter,
  type LoginResponse,
  type RegisterBody,
} from "@/services/api";

const KEY = "aura_token";
const OB_KEY = "aura_onboarding";
const DEMO_TOKEN = "demo-token-aura-2026";

// ── Storage abstraction ─────────────────────────────────────
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

// ── Demo data ───────────────────────────────────────────────
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

// ── Types ───────────────────────────────────────────────────
type User = LoginResponse["user"];
type Company = Exclude<LoginResponse["company"], null>;

type AuthState = {
  token: string | null;
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
  // Inject token getter into api.ts so all requests auto-attach JWT
  setTokenGetter(() => get().token);

  return {
    token: null,
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
      const obDone = obStorage.get() === "complete";

      if (!token) {
        set({ isHydrated: true });
        return;
      }

      if (token === DEMO_TOKEN) {
        set({
          token,
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

        set({
          token,
          user,
          company: company ?? null,
          isStaff: user?.is_staff || (user?.email || "").endsWith("@getaura.com.br"),
          isHydrated: true,
          isDemo: false,
          onboardingComplete: obDone || step === "complete" || step === "done",
          trialActive,
          trialEndsAt: trialEnd || null,
        });
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
        const trialEnd = (company as any)?.trial_ends_at;

        set({
          token,
          user,
          company: company ?? null,
          isLoading: false,
          isDemo: false,
          isStaff: user?.is_staff || (user?.email || "").endsWith("@getaura.com.br"),
          onboardingComplete: obDone || step === "complete" || step === "done" || step === undefined,
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
        const { token, user, company } = await authApi.register(body);
        await storage.set(token);
        obStorage.del();

        const trialEnd = (company as any)?.trial_ends_at;

        set({
          token,
          user,
          company: company ?? null,
          isLoading: false,
          isDemo: false,
          isStaff: user?.is_staff || (user?.email || "").endsWith("@getaura.com.br"),
          onboardingComplete: false, // New user -> onboarding
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
      obStorage.del();
      set({
        token: null,
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
`;

// ============================================================
// WRITE FILES
// ============================================================

fs.writeFileSync(p.join('services', 'api.ts'), apiContent, 'utf-8');
console.log('OK: services/api.ts rewritten (' + apiContent.length + ' chars)');

fs.writeFileSync(p.join('stores', 'auth.ts'), authContent, 'utf-8');
console.log('OK: stores/auth.ts rewritten (' + authContent.length + ' chars)');

// Also update register.tsx to use new RegisterBody type
const regPath = p.join('app', '(auth)', 'register.tsx');
if (fs.existsSync(regPath)) {
  let reg = fs.readFileSync(regPath, 'utf-8');

  // Update register call to pass all fields
  if (reg.includes('await register(nome.trim(), email.trim().toLowerCase(), senha, empresa.trim())')) {
    reg = reg.replace(
      'await register(nome.trim(), email.trim().toLowerCase(), senha, empresa.trim())',
      `await register({
        name: nome.trim(),
        email: email.trim().toLowerCase(),
        password: senha,
        company_name: empresa.trim(),
        phone: telefone.replace(/\\D/g, ""),
        cnpj: cnpj.replace(/\\D/g, "") || undefined,
        access_code: codigo.trim() || undefined,
      })`
    );
    console.log('OK: register.tsx updated to pass all fields to register()');
    fs.writeFileSync(regPath, reg, 'utf-8');
  }
}

console.log('\\nRun:');
console.log('  git add -A && git commit -m "feat: CONN-01 + CONN-02 - api.ts full upgrade + auth store real flow" && git push');
