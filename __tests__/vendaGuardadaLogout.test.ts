// ============================================================
// 14/10/2026: a venda guardada do Caixa tem cliente e CPF. O logout apaga
// todas as vendas guardadas neste navegador; a sessão que EXPIROU (401) mantém
// a do próprio usuário (a chave leva o id dele). Entrar como outro usuário
// apaga a que ficou do anterior.
// ============================================================
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
const mockLogin = jest.fn();
jest.mock("@/services/api", () => ({
  authApi: { login: (...a: any[]) => mockLogin(...a), me: jest.fn() },
  setTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
}));
jest.mock("@/services/multicnpj", () => ({
  authMulticnpjApi: { companies: jest.fn(() => Promise.resolve({ companies: [] })) },
  userCompaniesApi: {},
}));

import { useAuthStore } from "@/stores/auth";
import { guardarVenda, recuperarVenda } from "@/utils/vendaGuardada";

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  window.localStorage.setItem("aura_token", "tok-1");
  useAuthStore.setState({ token: "tok-1", user: { id: "user-1" }, company: { id: "empresa-1" } } as any);
  guardarVenda("empresa-1", "user-1", { cart: [{ productId: "cim" }] });
  guardarVenda("empresa-2", "user-1", { cart: [{ productId: "arg" }] });
});
afterEach(() => { jest.useRealTimers(); });

test("logout apaga as vendas guardadas de todas as empresas", async () => {
  await useAuthStore.getState().logout();
  expect(recuperarVenda("empresa-1", "user-1")).toBeNull();
  expect(recuperarVenda("empresa-2", "user-1")).toBeNull();
});

test("logout chamado por um clique (evento como argumento) também apaga", async () => {
  await (useAuthStore.getState().logout as any)({ type: "click" });
  expect(recuperarVenda("empresa-1", "user-1")).toBeNull();
});

test("sessão expirada mantém a venda do próprio usuário para quando ele voltar", async () => {
  await useAuthStore.getState().logout({ manterVendaGuardada: true });
  expect(recuperarVenda("empresa-1", "user-1")).toEqual({ cart: [{ productId: "cim" }] });
  expect(useAuthStore.getState().token).toBeNull();
});

test("entrar como outro usuário apaga a venda que ficou do anterior; o mesmo usuário mantém", async () => {
  await useAuthStore.getState().logout({ manterVendaGuardada: true });
  mockLogin.mockResolvedValueOnce({ token: "t2", user: { id: "user-1", email: "a@b.c" }, company: { id: "empresa-1" } });
  await useAuthStore.getState().login("a@b.c", "x");
  expect(recuperarVenda("empresa-1", "user-1")).not.toBeNull();

  mockLogin.mockResolvedValueOnce({ token: "t3", user: { id: "user-2", email: "d@e.f" }, company: { id: "empresa-1" } });
  await useAuthStore.getState().login("d@e.f", "x");
  expect(recuperarVenda("empresa-1", "user-1")).toBeNull();
  expect(recuperarVenda("empresa-1", "user-2")).toBeNull();
});
