// ============================================================
// Incidente 09/11/2026: o app instalado (PWA) deslogava.
//
// O sistema fecha o app o tempo todo; cada volta é uma abertura a frio, que
// passa pelo hydrate(). Antes, o hydrate chamava /auth/me com o access
// guardado (1 h de vida) e, em QUALQUER erro, apagava token e refresh: abrir
// o app 1 h depois (401 do access vencido) ou sem rede deslogava a pessoa
// com o refresh token válido por dias. Este teste segura a abertura.
// ============================================================
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
const mockMe = jest.fn();
const mockRenovar = jest.fn();
const mockEncerrar = jest.fn();
jest.mock("@/services/api", () => ({
  authApi: { me: (...a: any[]) => mockMe(...a) },
  renovarToken: (...a: any[]) => mockRenovar(...a),
  encerrarSessaoNoServidor: (...a: any[]) => mockEncerrar(...a),
  setTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
}));
jest.mock("@/services/multicnpj", () => ({
  authMulticnpjApi: { companies: jest.fn(() => Promise.resolve({ companies: [] })) },
  userCompaniesApi: {},
}));

import { useAuthStore, __zerarControleDoMe } from "@/stores/auth";

const erro = (status: number) => Object.assign(new Error("x"), { status });
const jwtDe = (id: string) => "h." + btoa(JSON.stringify({ id })) + ".s";
const VELHO = jwtDe("u1") + "velho";
const NOVO = jwtDe("u1") + "novo";
const ME = {
  user: { id: "u1", email: "loja@exemplo.com", email_verified: true },
  company: { id: "empresa-1", plan: "negocio" },
  consolidated_view: false,
  company_count: 1,
};

beforeEach(() => {
  jest.useFakeTimers();
  mockMe.mockReset();
  mockRenovar.mockReset();
  mockEncerrar.mockReset();
  __zerarControleDoMe();
  window.localStorage.clear();
  window.localStorage.setItem("aura_token", VELHO);
  window.localStorage.setItem("aura_refresh_token", "refresh-1");
  useAuthStore.setState({ token: null, refreshToken: null, isHydrated: false, company: null, user: null } as any);
});
afterEach(() => { jest.useRealTimers(); });

async function abrir() {
  const p = useAuthStore.getState().hydrate();
  // a espera curta entre tentativas do /me
  await jest.advanceTimersByTimeAsync(2000);
  await p;
}

test("access vencido (401) na abertura: renova pelo refresh e entra, sem deslogar", async () => {
  mockMe.mockImplementation((tk: string) => (tk === VELHO ? Promise.reject(erro(401)) : Promise.resolve(ME)));
  mockRenovar.mockResolvedValue({ status: "ok", token: NOVO });
  await abrir();
  const s = useAuthStore.getState();
  expect(mockRenovar).toHaveBeenCalledTimes(1);
  expect(s.token).toBe(NOVO);
  expect(s.refreshToken).toBe("refresh-1");
  expect(s.company).toMatchObject({ id: "empresa-1" });
  expect(window.localStorage.getItem("aura_token")).toBe(NOVO);
  expect(window.localStorage.getItem("aura_refresh_token")).toBe("refresh-1");
});

test("cold start sem corrida: o refresh já está no estado antes do /me voltar", async () => {
  let refreshNoEstadoDuranteOMe: string | null = null;
  mockMe.mockImplementation(() => {
    refreshNoEstadoDuranteOMe = useAuthStore.getState().refreshToken;
    return Promise.resolve(ME);
  });
  await abrir();
  expect(refreshNoEstadoDuranteOMe).toBe("refresh-1");
});

test("refresh inválido de verdade (401 do /auth/refresh): aí sim a sessão termina", async () => {
  mockMe.mockRejectedValue(erro(401));
  mockRenovar.mockResolvedValue({ status: "invalid" });
  await abrir();
  expect(useAuthStore.getState().token).toBeNull();
  expect(window.localStorage.getItem("aura_token")).toBeNull();
  expect(window.localStorage.getItem("aura_refresh_token")).toBeNull();
});

test.each([
  ["sem rede", Object.assign(new Error("rede"), { status: 0, isNetworkError: true })],
  ["servidor 503", erro(503)],
  ["servidor 500", erro(500)],
])("%s na abertura: a sessão fica e abre com o último /me", async (_n, falha) => {
  window.localStorage.setItem("aura_ultimo_me", JSON.stringify(ME));
  mockMe.mockRejectedValue(falha);
  await abrir();
  const s = useAuthStore.getState();
  expect(mockMe).toHaveBeenCalledTimes(2); // tentou de novo antes de desistir
  expect(s.token).toBe(VELHO);
  expect(s.isHydrated).toBe(true);
  expect(s.company).toMatchObject({ id: "empresa-1" });
  expect(window.localStorage.getItem("aura_token")).toBe(VELHO);
  expect(window.localStorage.getItem("aura_refresh_token")).toBe("refresh-1");
});

test("refresh sem resposta (rede) na abertura: não desloga", async () => {
  mockMe.mockRejectedValue(erro(401));
  mockRenovar.mockResolvedValue({ status: "network_error" });
  await abrir();
  expect(useAuthStore.getState().token).toBe(VELHO);
  expect(window.localStorage.getItem("aura_refresh_token")).toBe("refresh-1");
});

test("o último /me de OUTRA conta nunca é usado", async () => {
  window.localStorage.setItem("aura_ultimo_me", JSON.stringify({ ...ME, user: { id: "outra-pessoa" }, company: { id: "empresa-teste" } }));
  mockMe.mockRejectedValue(erro(503));
  await abrir();
  const s = useAuthStore.getState();
  expect(s.token).toBe(VELHO);
  expect(s.company).toBeNull();
  expect(s.user).toBeNull();
});

test("abertura que deu certo guarda o /me; logout apaga e avisa o servidor", async () => {
  mockMe.mockResolvedValue(ME);
  await abrir();
  expect(JSON.parse(window.localStorage.getItem("aura_ultimo_me") || "{}").user.id).toBe("u1");
  const p = useAuthStore.getState().logout();
  await jest.advanceTimersByTimeAsync(200);
  await p;
  expect(mockEncerrar).toHaveBeenCalledWith("refresh-1");
  expect(window.localStorage.getItem("aura_ultimo_me")).toBeNull();
  expect(window.localStorage.getItem("aura_refresh_token")).toBeNull();
});

test("refreshMe com access vencido renova e revalida, sem deslogar", async () => {
  useAuthStore.setState({ token: VELHO, refreshToken: "refresh-1" } as any);
  mockMe.mockImplementation((tk: string) => (tk === VELHO ? Promise.reject(erro(401)) : Promise.resolve(ME)));
  mockRenovar.mockResolvedValue({ status: "ok", token: NOVO });
  await useAuthStore.getState().refreshMe();
  expect(useAuthStore.getState().company).toMatchObject({ id: "empresa-1" });
  expect(useAuthStore.getState().refreshToken).toBe("refresh-1");
});
