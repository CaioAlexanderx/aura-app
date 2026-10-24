// ============================================================
// Login novo sobre o palco compartilhado (tq-67, 21/10/2026)
//
// O que este teste segura:
//   1. textos do mockup "Porta de entrada v4" e a saudação viva com o
//      primeiro nome guardado no aparelho;
//   2. a lógica de antes: e-mail pela URL, convite por link (título
//      próprio + aceite depois do login), Karatê → Shoji + /karate,
//      demais → /(tabs), erro que não é do servidor no toast;
//   3. senha errada (401) na linha pêssego do cartão, sem toast;
//   4. no acerto, só o primeiro nome vai para o localStorage.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/LGPDConsent", () => ({ useLgpdConsentInset: () => 0 }));

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock("@/components/Toast", () => ({
  toast: { error: (...a: any[]) => mockToastError(...a), success: (...a: any[]) => mockToastSuccess(...a), info: jest.fn() },
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  Link: ({ children }: any) => children,
  router: { replace: (...a: any[]) => mockReplace(...a), push: (...a: any[]) => mockPush(...a) },
  useLocalSearchParams: () => mockParams,
}));

const mockLogin = jest.fn();
let mockState: any = { user: null, company: null };
jest.mock("@/stores/auth", () => {
  const useAuthStore: any = () => ({ login: (...a: any[]) => mockLogin(...a), isLoading: false });
  useAuthStore.getState = () => mockState;
  return { useAuthStore };
});

const mockTrigger = jest.fn();
jest.mock("@/stores/karateIntro", () => ({ useKarateIntro: { getState: () => ({ trigger: () => mockTrigger() }) } }));

const mockAccept = jest.fn();
jest.mock("@/services/inviteApi", () => ({ inviteApi: { accept: (...a: any[]) => mockAccept(...a) } }));
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any;
    constructor(message: string, status: number, data?: any) { super(message); this.status = status; this.data = data; }
  }
  return { ApiError };
});

import { ApiError } from "@/services/api";
import { CHAVE_PRIMEIRO_NOME } from "@/utils/primeiroNomeNoAparelho";
import LoginScreen from "@/app/(auth)/login";
import { guardarDestino, lerDestino, __zerarDestino } from "@/utils/destinoDepoisDoLogin";

function textos(node: any, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === "string") { out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((n) => textos(n, out)); return out; }
  textos(node.children, out);
  return out;
}
const textoDe = (inst: any): string =>
  (inst.children || []).map((c: any) => (typeof c === "string" ? c : textoDe(c))).join("");
const tudo = (t: renderer.ReactTestRenderer) => textos(t.toJSON()).join("|");
const porId = (t: renderer.ReactTestRenderer, id: string, prop: string) =>
  t.root.findAll((n) => n.props.testID === id && typeof n.props[prop] !== "undefined")[0];

function montar() {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<LoginScreen />); });
  return t;
}
async function digitarEEntrar(t: renderer.ReactTestRenderer, email: string, senha: string) {
  act(() => { porId(t, "login-email", "onChangeText").props.onChangeText(email); });
  act(() => { porId(t, "login-senha", "onChangeText").props.onChangeText(senha); });
  await act(async () => { await porId(t, "login-entrar", "onPress").props.onPress(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockState = { user: null, company: null };
  localStorage.removeItem(CHAVE_PRIMEIRO_NOME);
  __zerarDestino();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test("textos do mockup e saudação com o primeiro nome guardado", () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 21, 14, 0) }); // quarta, 14h
  jest.spyOn(Math, "random").mockReturnValue(0);
  localStorage.setItem(CHAVE_PRIMEIRO_NOME, "Caio");
  const t = montar();
  const s = tudo(t);
  expect(s).toContain("ENTRAR");
  expect(textoDe(t.root.findAll((n) => n.props.testID === "login-say")[0])).toBe("Boa tarde, Caio.");
  expect(s).toContain("Hora de ver o que já saiu.");
  for (const txt of ["E-mail", "Senha", "Ver", "Esqueci minha senha", "Entrar", "ou", "Primeira vez por aqui?", "Criar conta grátis", "Aura. · Tecnologia para negócios"]) {
    expect(s).toContain(txt);
  }
  expect(s).not.toContain("Essa senha não bateu");
});

test("e-mail que veio pela URL já entra preenchido", () => {
  mockParams = { email: "loja@exemplo.com" };
  const t = montar();
  expect(porId(t, "login-email", "onChangeText").props.value).toBe("loja@exemplo.com");
});

test("senha errada (401): linha pêssego no cartão, sem toast; digitar apaga", async () => {
  mockLogin.mockRejectedValueOnce(new (ApiError as any)("Credenciais invalidas", 401));
  const t = montar();
  await digitarEEntrar(t, "a@b.com", "errada");
  expect(tudo(t)).toContain("Essa senha não bateu. Quer tentar de novo ou |redefinir|?");
  expect(mockToastError).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  act(() => { porId(t, "login-senha", "onChangeText").props.onChangeText("outra"); });
  expect(tudo(t)).not.toContain("Essa senha não bateu");
});

test("erro que não veio do servidor segue no toast de sempre", async () => {
  mockLogin.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  const t = montar();
  await digitarEEntrar(t, "a@b.com", "x");
  expect(mockToastError).toHaveBeenCalledWith("Não foi possível entrar. Tente novamente.");
  expect(tudo(t)).not.toContain("Essa senha não bateu");
});

test("acerto: guarda só o primeiro nome e vai para o painel", async () => {
  mockLogin.mockImplementationOnce(async () => { mockState = { user: { name: "Caroline Souza", email: "carol@loja.com" }, company: { vertical: "varejo" } }; });
  const t = montar();
  await digitarEEntrar(t, " Carol@Loja.com ", "Certa123");
  expect(mockLogin).toHaveBeenCalledWith("carol@loja.com", "Certa123");
  expect(localStorage.getItem(CHAVE_PRIMEIRO_NOME)).toBe("Caroline");
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  expect(mockTrigger).not.toHaveBeenCalled();
});

test("Karatê: dispara a abertura Shoji e vai para /karate", async () => {
  mockLogin.mockImplementationOnce(async () => { mockState = { user: { name: "Sensei" }, company: { vertical_active: "karate_dojo" } }; });
  const t = montar();
  await digitarEEntrar(t, "dojo@x.com", "Certa123");
  expect(mockTrigger).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith("/karate");
});

test("convite por link: título próprio e aceite depois do login", async () => {
  mockParams = { invite_token: "tok-1" };
  mockLogin.mockImplementationOnce(async () => { mockState = { user: { name: "Bia" }, company: {} }; });
  const t = montar();
  const s = tudo(t);
  expect(s).toContain("Entrar para aceitar convite");
  expect(s).toContain("Entrar e aceitar convite");
  await digitarEEntrar(t, "bia@x.com", "Certa123");
  expect(mockAccept).toHaveBeenCalledWith("tok-1");
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
});

test("campos vazios: toast de sempre e nenhuma chamada", async () => {
  const t = montar();
  await act(async () => { await porId(t, "login-entrar", "onPress").props.onPress(); });
  expect(mockToastError).toHaveBeenCalledWith("Preencha e-mail e senha");
  expect(mockLogin).not.toHaveBeenCalled();
});

// 24/10/2026 (tq-91): link aberto sem sessão volta para a tela pedida.
test("link aberto sem sessão: depois do login volta para a tela do link, com a query", async () => {
  guardarDestino("/crediario?filtro=atraso&empresa=abc");
  mockLogin.mockImplementationOnce(async () => { mockState = { user: { name: "Carol" }, company: { vertical: "varejo" } }; });
  const t = montar();
  await digitarEEntrar(t, "carol@loja.com", "Certa123");
  expect(mockReplace).toHaveBeenCalledWith("/crediario?filtro=atraso&empresa=abc");
  expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)");
});

test("destino lido antes de entrar: vale mesmo se o AuthGuard já consumiu durante o login", async () => {
  guardarDestino("/financeiro");
  mockLogin.mockImplementationOnce(async () => { __zerarDestino(); mockState = { user: { name: "Carol" }, company: {} }; });
  const t = montar();
  await digitarEEntrar(t, "carol@loja.com", "Certa123");
  expect(mockReplace).toHaveBeenCalledWith("/financeiro");
});

test("Karatê mantém a entrada Shoji em /karate, mesmo com destino guardado", async () => {
  guardarDestino("/financeiro");
  mockLogin.mockImplementationOnce(async () => { mockState = { user: { name: "Sensei" }, company: { vertical_active: "karate_dojo" } }; });
  const t = montar();
  await digitarEEntrar(t, "dojo@x.com", "Certa123");
  expect(mockTrigger).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith("/karate");
  expect(mockReplace).not.toHaveBeenCalledWith("/financeiro");
});

test("convite mantém o caminho dele e apaga destino velho", async () => {
  guardarDestino("/financeiro");
  mockParams = { invite_token: "tok-1" };
  mockLogin.mockImplementationOnce(async () => { mockState = { user: { name: "Bia" }, company: {} }; });
  const t = montar();
  await digitarEEntrar(t, "bia@x.com", "Certa123");
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  expect(lerDestino()).toBeNull();
});
