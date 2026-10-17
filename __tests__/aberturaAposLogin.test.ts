// ============================================================
// Telas visitadas: a abertura que vem do login (17/10/2026, card t2-14)
//
// Quem só entra e sai inflava as visitas do Painel. O store marca "acabei de
// entrar" no login e no cadastro; o registro de telas consome a marca na
// primeira tela e a envia como apos_login. Sessão restaurada NÃO marca.
// ============================================================
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
const mockLogin = jest.fn();
const mockRegister = jest.fn();
jest.mock("@/services/api", () => ({
  authApi: { login: (...a: any[]) => mockLogin(...a), register: (...a: any[]) => mockRegister(...a), me: jest.fn() },
  setTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
}));
jest.mock("@/services/multicnpj", () => ({
  authMulticnpjApi: { companies: jest.fn(() => Promise.resolve({ companies: [] })) },
  userCompaniesApi: {},
}));

import { useAuthStore } from "@/stores/auth";
import {
  marcarLogin,
  consumirMarcaDeLogin,
  limparMarcaDeLogin,
  JANELA_DO_LOGIN_MS,
} from "@/services/aberturaAposLogin";

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  limparMarcaDeLogin();
});
afterEach(() => { jest.useRealTimers(); });

describe("marca de login", () => {
  test("sem login, nada a consumir", () => {
    expect(consumirMarcaDeLogin()).toBe(false);
  });

  test("consome uma única vez por login", () => {
    marcarLogin(1000);
    expect(consumirMarcaDeLogin(2000)).toBe(true);
    expect(consumirMarcaDeLogin(2001)).toBe(false);
  });

  test("vale dentro da janela e expira depois dela", () => {
    marcarLogin(0);
    expect(consumirMarcaDeLogin(JANELA_DO_LOGIN_MS)).toBe(true);
    marcarLogin(0);
    expect(consumirMarcaDeLogin(JANELA_DO_LOGIN_MS + 1)).toBe(false);
  });

  test("marca vencida é descartada: não sobra para uma tela aberta depois", () => {
    marcarLogin(0);
    expect(consumirMarcaDeLogin(JANELA_DO_LOGIN_MS + 5000)).toBe(false);
    expect(consumirMarcaDeLogin(JANELA_DO_LOGIN_MS + 5001)).toBe(false);
  });

  test("limpar tira a marca", () => {
    marcarLogin();
    limparMarcaDeLogin();
    expect(consumirMarcaDeLogin()).toBe(false);
  });
});

describe("store de auth", () => {
  test("login marca a abertura como vinda do login", async () => {
    mockLogin.mockResolvedValueOnce({ token: "t1", user: { id: "u1", email: "a@b.c" }, company: { id: "e1" } });
    await useAuthStore.getState().login("a@b.c", "x");
    expect(consumirMarcaDeLogin()).toBe(true);
  });

  test("login com erro não marca", async () => {
    mockLogin.mockRejectedValueOnce(new Error("401"));
    await expect(useAuthStore.getState().login("a@b.c", "errada")).rejects.toThrow();
    expect(consumirMarcaDeLogin()).toBe(false);
  });

  test("cadastro concluído marca", async () => {
    mockRegister.mockResolvedValueOnce({ token: "t2", user: { id: "u2", email: "d@e.f" }, company: { id: "e2" } });
    await useAuthStore.getState().register({} as any);
    expect(consumirMarcaDeLogin()).toBe(true);
  });

  test("restaurar sessão salva (retorno) não marca", () => {
    useAuthStore.setState({ token: "tok-salvo", user: { id: "u1" }, company: { id: "e1" } } as any);
    expect(consumirMarcaDeLogin()).toBe(false);
  });

  test("logout limpa a marca que sobrou", async () => {
    marcarLogin();
    await useAuthStore.getState().logout();
    expect(consumirMarcaDeLogin()).toBe(false);
  });
});
