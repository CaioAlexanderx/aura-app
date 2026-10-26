// ============================================================
// "Corrigir meu e-mail" na tela de confirmação (26/10/2026)
//
// Quem criou a conta com o e-mail errado não tinha saída: o botão "Trocar
// de e-mail ou sair" só saía da conta. O que este teste segura:
//   1. a tela mostra o e-mail inteiro, o link "Corrigir meu e-mail" e o
//      botão "Sair" (sem o texto antigo);
//   2. o link abre o campo com o e-mail atual e "Salvar e reenviar";
//   3. ao salvar: chama POST /auth/corrigir-email com o e-mail limpo, troca o
//      e-mail no store e a tela mostra o e-mail novo e que o link foi
//      reenviado;
//   4. e-mail de outra conta: a mensagem clara + falar com a gente, nada muda;
//   5. formato incompleto: avisa sem ir ao servidor;
//   6. envio do link novo falhou: a troca vale e a tela oferece reenviar;
//   7. Cancelar volta sem mudar nada.
// Mesmo padrão de __tests__/loginPalco.test.tsx (react-test-renderer, testID).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/LGPDConsent", () => ({ useLgpdConsentInset: () => 0 }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/verifyLinkStatus", () => ({ consumeVerifyLinkError: () => null }));

const mockLogout = jest.fn();
let mockState: any = {};
jest.mock("@/stores/auth", () => {
  const useAuthStore: any = () => ({ user: mockState.user, logout: (...a: any[]) => mockLogout(...a) });
  useAuthStore.getState = () => mockState;
  useAuthStore.setState = (patch: any) => { mockState = { ...mockState, ...patch }; };
  return { useAuthStore };
});

const mockSend = jest.fn();
const mockCorrigir = jest.fn();
const mockMe = jest.fn();
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any; isNetworkError: boolean;
    constructor(message: string, status: number, data?: any, isNetworkError = false) {
      super(message); this.status = status; this.data = data; this.isNetworkError = isNetworkError;
    }
  }
  return {
    ApiError,
    authApi: {
      sendEmailVerification: (...a: any[]) => mockSend(...a),
      corrigirEmail: (...a: any[]) => mockCorrigir(...a),
      meSession: (...a: any[]) => mockMe(...a),
      verifyEmail: jest.fn(),
    },
  };
});

const mockOpenURL = jest.fn(() => Promise.resolve());

import { Linking } from "react-native";
import { ApiError } from "@/services/api";
import VerifyEmailScreen from "@/app/(auth)/verify-email";

function textos(node: any, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === "string") { out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((n) => textos(n, out)); return out; }
  textos(node.children, out);
  return out;
}
const tudo = (t: renderer.ReactTestRenderer) => textos(t.toJSON()).join("|");
const porId = (t: renderer.ReactTestRenderer, id: string, prop: string) =>
  t.root.findAll((n) => n.props.testID === id && typeof n.props[prop] !== "undefined")[0];
const existe = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props.testID === id).length > 0;

let telas: renderer.ReactTestRenderer[] = [];
async function montar() {
  let t!: renderer.ReactTestRenderer;
  await act(async () => { t = renderer.create(<VerifyEmailScreen />); });
  telas.push(t);
  return t;
}
async function abrirECorrigir(t: renderer.ReactTestRenderer, email: string) {
  act(() => { porId(t, "corrigir-email-abrir", "onPress").props.onPress(); });
  act(() => { porId(t, "corrigir-email-campo", "onChangeText").props.onChangeText(email); });
  await act(async () => { await porId(t, "corrigir-email-salvar", "onPress").props.onPress(); });
}

const ERRADO = "luciana@luciana.com";

beforeEach(() => {
  jest.clearAllMocks();
  mockState = { user: { id: "u1", name: "Luciana", email: ERRADO, email_verified: false } };
  mockSend.mockResolvedValue({ sent: true, retry_after: 60, otp_available: true });
  mockMe.mockResolvedValue({ user: { email_verified: false } });
  jest.spyOn(Linking, "openURL").mockImplementation(mockOpenURL as any);
});
afterEach(() => {
  telas.forEach((t) => act(() => t.unmount()));
  telas = [];
  jest.restoreAllMocks();
});

test("mostra o e-mail inteiro, 'Corrigir meu e-mail' e 'Sair'", async () => {
  const t = await montar();
  const s = tudo(t);
  expect(s).toContain("Confirme seu e-mail");
  expect(s).toContain(ERRADO);
  expect(s).toContain("Corrigir meu e-mail");
  expect(s).toContain("Sair");
  expect(s).not.toContain("Trocar de e-mail ou sair");
  act(() => { porId(t, "verify-sair", "onPress").props.onPress(); });
  expect(mockLogout).toHaveBeenCalledTimes(1);
});

test("o link abre o campo com o e-mail atual e 'Salvar e reenviar'", async () => {
  const t = await montar();
  act(() => { porId(t, "corrigir-email-abrir", "onPress").props.onPress(); });
  const s = tudo(t);
  expect(s).toContain("Corrigir meu e-mail");
  expect(s).toContain("Digite o e-mail certo. A gente manda um link novo para ele.");
  expect(s).toContain("Salvar e reenviar");
  expect(porId(t, "corrigir-email-campo", "onChangeText").props.value).toBe(ERRADO);
});

test("salvar: troca o e-mail, mostra o novo e diz que o link foi reenviado", async () => {
  mockCorrigir.mockResolvedValueOnce({
    ok: true, sent: true, retry_after: 60, otp_available: true,
    user: { id: "u1", name: "Luciana", email: "luciana@gmail.com", email_verified: false },
  });
  const t = await montar();
  await abrirECorrigir(t, "  Luciana@Gmail.com ");

  expect(mockCorrigir).toHaveBeenCalledWith("luciana@gmail.com");
  expect(mockState.user.email).toBe("luciana@gmail.com");
  expect(mockState.user.email_verified).toBe(false);
  const s = tudo(t);
  expect(s).toContain("Confirme seu e-mail");
  expect(s).toContain("luciana@gmail.com");
  expect(s).not.toContain(ERRADO);
  expect(s).toContain("E-mail corrigido. Reenviamos o link agora há pouco.");
  expect(existe(t, "corrigir-email-campo")).toBe(false);
});

test("e-mail de outra conta: mensagem clara, falar com a gente, nada muda", async () => {
  mockCorrigir.mockRejectedValueOnce(new (ApiError as any)("Esse e-mail já tem uma conta na Aura.", 409, { code: "EMAIL_EM_USO" }));
  const t = await montar();
  await abrirECorrigir(t, "outra@gmail.com");

  expect(tudo(t)).toContain("Esse e-mail já tem uma conta na Aura. Entre com ele ou fale com a gente.");
  expect(mockState.user.email).toBe(ERRADO);
  expect(existe(t, "corrigir-email-campo")).toBe(true);
  act(() => { porId(t, "corrigir-email-whatsapp", "onPress").props.onPress(); });
  expect(mockOpenURL).toHaveBeenCalledTimes(1);
  expect((mockOpenURL.mock.calls[0] as any[])[0]).toMatch(/^https:\/\/wa\.me\/5511956305269\?text=/);
  // Digitar de novo apaga o aviso.
  act(() => { porId(t, "corrigir-email-campo", "onChangeText").props.onChangeText("outra2@gmail.com"); });
  expect(existe(t, "corrigir-email-erro")).toBe(false);
});

test("e-mail incompleto: avisa sem ir ao servidor", async () => {
  const t = await montar();
  await abrirECorrigir(t, "luciana@gmail");
  expect(mockCorrigir).not.toHaveBeenCalled();
  expect(tudo(t)).toContain("Esse e-mail não parece completo. Confira e tente de novo.");
});

test("limite de tentativas: texto sem jargão e falar com a gente", async () => {
  mockCorrigir.mockRejectedValueOnce(new (ApiError as any)("x", 429, { code: "CORRIGIR_EMAIL_LIMITE" }));
  const t = await montar();
  await abrirECorrigir(t, "luciana@gmail.com");
  expect(tudo(t)).toContain("Você tentou trocar muitas vezes. Espere um pouco e tente de novo, ou fale com a gente.");
  expect(existe(t, "corrigir-email-whatsapp")).toBe(true);
});

test("envio do link novo falhou: o e-mail novo vale e a tela oferece reenviar", async () => {
  mockCorrigir.mockResolvedValueOnce({
    ok: true, sent: false, reason: "provider_error",
    user: { id: "u1", name: "Luciana", email: "luciana@gmail.com", email_verified: false },
  });
  const t = await montar();
  await abrirECorrigir(t, "luciana@gmail.com");
  const s = tudo(t);
  expect(mockState.user.email).toBe("luciana@gmail.com");
  expect(s).toContain("Não conseguimos enviar o e-mail");
  expect(s).toContain("luciana@gmail.com");
  expect(s).toContain("Tentar enviar de novo");
});

test("Cancelar volta sem mudar nada", async () => {
  const t = await montar();
  act(() => { porId(t, "corrigir-email-abrir", "onPress").props.onPress(); });
  act(() => { porId(t, "corrigir-email-campo", "onChangeText").props.onChangeText("outra@gmail.com"); });
  act(() => { porId(t, "corrigir-email-cancelar", "onPress").props.onPress(); });
  expect(mockCorrigir).not.toHaveBeenCalled();
  expect(existe(t, "corrigir-email-campo")).toBe(false);
  expect(tudo(t)).toContain(ERRADO);
  expect(mockState.user.email).toBe(ERRADO);
});
