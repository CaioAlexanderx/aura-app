// ============================================================
// Personalizados na conta de teste (p-188): a flag do /auth/me chega ao
// store. stores/auth.ts guarda o company do /me inteiro (hydrate e
// refreshMe), então personalizados_teste entra sem mapeamento; este teste
// segura isso e a trava lida pelo store de verdade.
// ============================================================
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
const mockMe = jest.fn();
jest.mock("@/services/api", () => ({
  authApi: { me: (...a: any[]) => mockMe(...a) },
  setTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
}));
jest.mock("@/services/multicnpj", () => ({
  authMulticnpjApi: { companies: jest.fn(() => Promise.resolve({ companies: [] })) },
  userCompaniesApi: {},
}));

import { useAuthStore, JANELA_DO_ME_MS, __zerarControleDoMe } from "@/stores/auth";
import { travaGeral, personalizadosAtivo } from "@/utils/personalizados";

const me = (company: Record<string, any> | null, consolidated = false) => ({
  user: { id: "u1", email: "loja@exemplo.com" },
  company,
  consolidated_view: consolidated,
  company_count: 1,
});
const LOJA = { id: "empresa-1", plan: "expansao", vertical_active: null };

let agora = 1_000_000;
beforeEach(() => {
  agora = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
  mockMe.mockReset();
  __zerarControleDoMe();
  window.localStorage.clear();
  window.localStorage.setItem("aura_token", "tok-1");
  useAuthStore.setState({ token: null, isHydrated: false, company: null, user: null, consolidatedView: false } as any);
});
afterEach(() => { (Date.now as jest.Mock).mockRestore?.(); });

test("sem a flag no /me: a trava fica desligada", async () => {
  mockMe.mockResolvedValue(me(LOJA));
  await useAuthStore.getState().hydrate();
  expect(useAuthStore.getState().company).not.toHaveProperty("personalizados_teste");
  expect(travaGeral()).toBe(false);
  expect(personalizadosAtivo({ studio_enabled: true }, null)).toBe(false);
});

test("abertura: o /me com a flag liga a trava da empresa", async () => {
  mockMe.mockResolvedValue(me({ ...LOJA, personalizados_teste: true }));
  await useAuthStore.getState().hydrate();
  expect((useAuthStore.getState().company as any).personalizados_teste).toBe(true);
  expect(travaGeral()).toBe(true);
  expect(personalizadosAtivo({ studio_enabled: true }, null)).toBe(true);
});

test("refreshMe: a flag que chega depois entra no store, e a que sai também", async () => {
  mockMe.mockResolvedValue(me(LOJA));
  await useAuthStore.getState().hydrate();
  expect(travaGeral()).toBe(false);

  agora += JANELA_DO_ME_MS + 1;
  mockMe.mockResolvedValue(me({ ...LOJA, personalizados_teste: true }));
  await useAuthStore.getState().refreshMe();
  expect(travaGeral()).toBe(true);

  agora += JANELA_DO_ME_MS + 1;
  mockMe.mockResolvedValue(me(LOJA));
  await useAuthStore.getState().refreshMe();
  expect(useAuthStore.getState().company).not.toHaveProperty("personalizados_teste");
  expect(travaGeral()).toBe(false);
});

test("consolidado: o /me vem sem company e a trava fica desligada", async () => {
  mockMe.mockResolvedValue(me(null, true));
  await useAuthStore.getState().hydrate();
  expect(useAuthStore.getState().consolidatedView).toBe(true);
  expect(travaGeral()).toBe(false);
});
