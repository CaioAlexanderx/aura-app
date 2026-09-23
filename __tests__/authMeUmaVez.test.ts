// ============================================================
// QA 23/09/2026: abrir o app chamava /auth/me duas vezes — hydrate() e,
// logo depois, o refreshMe() do layout das abas (armadilha 1: revalidar o
// plano no mount). stores/auth.ts agora compartilha a chamada em voo e não
// repete um /me que acabou de voltar com o mesmo token.
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

const RESPOSTA = {
  user: { id: "u1", email: "loja@exemplo.com" },
  company: { id: "empresa-1", plan: "negocio" },
  consolidated_view: false,
  company_count: 1,
};

let agora = 1_000_000;
beforeEach(() => {
  agora = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
  mockMe.mockReset();
  mockMe.mockImplementation(() => Promise.resolve(RESPOSTA));
  __zerarControleDoMe();
  window.localStorage.clear();
  window.localStorage.setItem("aura_token", "tok-1");
  useAuthStore.setState({ token: null, isHydrated: false, company: null, user: null } as any);
});
afterEach(() => { (Date.now as jest.Mock).mockRestore?.(); });

test("abrir o app: hydrate + refreshMe do layout = UMA chamada ao /auth/me", async () => {
  await useAuthStore.getState().hydrate();
  expect(useAuthStore.getState().token).toBe("tok-1");
  expect(useAuthStore.getState().company).toMatchObject({ id: "empresa-1" });

  // O layout das abas monta com o token e revalida.
  agora += 50;
  await useAuthStore.getState().refreshMe();
  expect(mockMe).toHaveBeenCalledTimes(1);
});

test("dois refreshMe ao mesmo tempo compartilham a mesma chamada", async () => {
  useAuthStore.setState({ token: "tok-1" } as any);
  await Promise.all([useAuthStore.getState().refreshMe(), useAuthStore.getState().refreshMe()]);
  expect(mockMe).toHaveBeenCalledTimes(1);
});

test("passada a janela, refreshMe volta a revalidar o plano (armadilha 1)", async () => {
  await useAuthStore.getState().hydrate();
  agora += JANELA_DO_ME_MS + 1;
  mockMe.mockImplementation(() => Promise.resolve({ ...RESPOSTA, company: { id: "empresa-1", plan: "empresa" } }));
  await useAuthStore.getState().refreshMe();
  expect(mockMe).toHaveBeenCalledTimes(2);
  expect(useAuthStore.getState().company).toMatchObject({ plan: "empresa" });
});

test("outro token não aproveita o /me do anterior", async () => {
  await useAuthStore.getState().hydrate();
  useAuthStore.setState({ token: "tok-2" } as any);
  await useAuthStore.getState().refreshMe();
  expect(mockMe).toHaveBeenCalledTimes(2);
  expect(mockMe).toHaveBeenLastCalledWith("tok-2");
});

test("/me que falhou não conta como recente: o próximo tenta de novo", async () => {
  useAuthStore.setState({ token: "tok-1" } as any);
  const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
  mockMe.mockImplementationOnce(() => Promise.reject(new Error("rede")));
  await useAuthStore.getState().refreshMe();
  await useAuthStore.getState().refreshMe();
  expect(mockMe).toHaveBeenCalledTimes(2);
  aviso.mockRestore();
});
