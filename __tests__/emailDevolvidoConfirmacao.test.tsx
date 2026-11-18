// ============================================================
// Tela de confirmação: e-mail que voltou (18/11/2026)
//
// O backend (Aura-backend, services/emailDevolvido.js) passa o sinal da
// devolução no /auth/me (user.email_devolvido) e no reenvio que ele segurou
// ({sent:false, reason:"email_devolvido"}). O que este teste segura:
//   1. permanente pelo reenvio: o aviso "Esse e-mail voltou" com o texto
//      aprovado, "Corrigir meu e-mail" e o WhatsApp em destaque; sem
//      "Aguardando confirmação...";
//   2. permanente pelo /me (a espera vira o aviso no primeiro poll);
//   3. temporária pelo /me: a espera continua, com o aviso em cima;
//   4. sem sinal: a tela de sempre;
//   5. do aviso, corrigir o e-mail volta à espera sem o aviso;
//   6. o WhatsApp abre a conversa com a Aura.
// Mesmo harness de __tests__/corrigirEmail.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/LGPDConsent", () => ({ useLgpdConsentInset: () => 0 }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/verifyLinkStatus", () => ({ consumeVerifyLinkError: () => null }));

let mockState: any = {};
jest.mock("@/stores/auth", () => {
  const useAuthStore: any = () => ({ user: mockState.user, logout: jest.fn() });
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

import { Linking } from "react-native";
import VerifyEmailScreen from "@/app/(auth)/verify-email";
import { textoDaDevolucao, sinalDoEnvio, lerSinalDaDevolucao } from "@/utils/emailDevolvido";

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

const EMAIL = "luciana@lucina.com";
const PERMANENTE = "O e-mail que mandamos para " + EMAIL + " não chegou. Confira se está escrito certo e corrija, ou fale com a gente no WhatsApp.";
const TEMPORARIA = "Não conseguimos entregar agora em " + EMAIL + ". Tente reenviar daqui a pouco ou corrija o e-mail.";

let telas: renderer.ReactTestRenderer[] = [];
async function montar() {
  let t!: renderer.ReactTestRenderer;
  await act(async () => { t = renderer.create(<VerifyEmailScreen />); });
  telas.push(t);
  return t;
}
async function primeiroPoll() {
  await act(async () => { jest.advanceTimersByTime(5000); });
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockState = { user: { id: "u1", name: "Luciana", email: EMAIL, email_verified: false } };
  mockSend.mockResolvedValue({ sent: true, retry_after: 60, otp_available: true });
  mockMe.mockResolvedValue({ user: { email_verified: false } });
  jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve(true) as any);
});
afterEach(() => {
  telas.forEach((t) => act(() => t.unmount()));
  telas = [];
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("textos aprovados", () => {
  expect(textoDaDevolucao("permanente", EMAIL)).toBe(PERMANENTE);
  expect(textoDaDevolucao("temporaria", EMAIL)).toBe(TEMPORARIA);
  expect(sinalDoEnvio({ sent: false, reason: "email_devolvido" })).toEqual({ tipo: "permanente", em: null });
  expect(sinalDoEnvio({ sent: false, reason: "provider_error" })).toBeNull();
  expect(lerSinalDaDevolucao({ tipo: "outro" })).toBeNull();
});

test("permanente pelo reenvio: aviso, Corrigir e WhatsApp; sem a espera", async () => {
  mockSend.mockResolvedValueOnce({ sent: false, reason: "email_devolvido", email_devolvido: { tipo: "permanente", em: "2026-11-18T12:00:00Z" } });
  const t = await montar();
  const s = tudo(t);
  expect(s).toContain("Esse e-mail voltou");
  expect(s).toContain(PERMANENTE);
  expect(s).toContain("Corrigir meu e-mail");
  expect(s).toContain("Falar com a gente no WhatsApp");
  expect(s).not.toContain("Aguardando confirmação...");
  expect(s).not.toContain("Nosso servidor de e-mails não respondeu");
  act(() => { porId(t, "devolvido-whatsapp", "onPress").props.onPress(); });
  expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\//);
});

test("permanente pelo /me: a espera vira o aviso no primeiro poll", async () => {
  mockMe.mockResolvedValue({ user: { email_verified: false, email_devolvido: { tipo: "permanente" } } });
  const t = await montar();
  expect(tudo(t)).toContain("Aguardando confirmação...");
  await primeiroPoll();
  expect(existe(t, "devolvido-permanente")).toBe(true);
  expect(tudo(t)).not.toContain("Aguardando confirmação...");
});

test("temporária pelo /me: a espera continua, com o aviso em cima", async () => {
  mockMe.mockResolvedValue({ user: { email_verified: false, email_devolvido: { tipo: "temporaria" } } });
  const t = await montar();
  await primeiroPoll();
  const s = tudo(t);
  expect(existe(t, "devolvido-temporaria")).toBe(true);
  expect(s).toContain(TEMPORARIA);
  expect(s).toContain("Aguardando confirmação...");
  expect(s).toContain("Reenviar e-mail");
  expect(s).not.toContain("Esse e-mail voltou");
});

test("sem sinal: a tela de sempre", async () => {
  const t = await montar();
  await primeiroPoll();
  expect(existe(t, "devolvido-permanente")).toBe(false);
  expect(existe(t, "devolvido-temporaria")).toBe(false);
  expect(tudo(t)).toContain("Aguardando confirmação...");
});

test("do aviso, corrigir o e-mail volta à espera sem o aviso", async () => {
  mockSend.mockResolvedValueOnce({ sent: false, reason: "email_devolvido" });
  mockCorrigir.mockResolvedValueOnce({
    ok: true, sent: true, retry_after: 60, otp_available: true,
    user: { id: "u1", name: "Luciana", email: "luciana@luciana.com", email_verified: false },
  });
  const t = await montar();
  act(() => { porId(t, "devolvido-corrigir", "onPress").props.onPress(); });
  expect(porId(t, "corrigir-email-campo", "onChangeText").props.value).toBe(EMAIL);
  act(() => { porId(t, "corrigir-email-campo", "onChangeText").props.onChangeText("luciana@luciana.com"); });
  await act(async () => { await porId(t, "corrigir-email-salvar", "onPress").props.onPress(); });
  const s = tudo(t);
  expect(mockCorrigir).toHaveBeenCalledWith("luciana@luciana.com");
  expect(s).toContain("E-mail corrigido. Reenviamos o link agora há pouco.");
  expect(s).not.toContain("Esse e-mail voltou");
});
