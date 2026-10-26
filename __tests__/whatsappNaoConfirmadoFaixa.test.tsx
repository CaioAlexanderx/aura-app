// ============================================================
// Faixa "Seu WhatsApp ainda não foi confirmado" no Painel (tq-115, 26/10/2026)
//
// Contrato com o backend: POST /auth/me devolve `whatsapp_handshake`
// ({ codigo, estado: 'aguardando' | 'confirmado', ... }) só ao dono; null nos
// outros casos.
//
// O que este teste segura:
//   1. leitura defensiva do /me e o texto curto;
//   2. aguardando: faixa com o código e o botão que abre o wa.me da Aura;
//   3. confirmado, null, erro: nada;
//   4. consolidado, demo, staff: nada e nenhuma leitura;
//   5. uma leitura só, sem polling;
//   6. fonte: a faixa está no Painel, fora da visão consolidada.
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import { Linking } from "react-native";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) { return typeof selector === "function" ? selector(mockAuth) : mockAuth; },
    { getState: () => mockAuth },
  ),
}));

const mockMe = jest.fn();
jest.mock("@/services/api", () => ({ authApi: { meSession: (...a: any[]) => mockMe(...a) } }));

import { WhatsappNaoConfirmadoFaixa } from "@/components/onboarding/WhatsappNaoConfirmadoFaixa";
import { handshakeDoMe, TEXTOS_ZAP_NO_PAINEL } from "@/utils/whatsappDoCadastro";

const AGUARDANDO = { whatsapp_handshake: { codigo: "AURA-K7MQ", estado: "aguardando", link: "https://wa.me/x" } };

// ── 1. leitura e texto ───────────────────────────────────────
describe("handshakeDoMe", () => {
  test("aguardando e confirmado passam; o resto vira null", () => {
    expect(handshakeDoMe(AGUARDANDO)).toEqual({ codigo: "AURA-K7MQ", estado: "aguardando" });
    expect(handshakeDoMe({ whatsapp_handshake: { codigo: "AURA-K7MQ", estado: "confirmado" } }))
      .toEqual({ codigo: "AURA-K7MQ", estado: "confirmado" });
    expect(handshakeDoMe({ whatsapp_handshake: null })).toBeNull();
    expect(handshakeDoMe({})).toBeNull();
    expect(handshakeDoMe(null)).toBeNull();
    expect(handshakeDoMe({ whatsapp_handshake: { codigo: "AURA-K7MQ", estado: "outro" } })).toBeNull();
  });

  test("código fora do formato vira null, sem esconder a faixa", () => {
    expect(handshakeDoMe({ whatsapp_handshake: { codigo: "xx", estado: "aguardando" } }))
      .toEqual({ codigo: null, estado: "aguardando" });
  });

  test("texto curto, sem jargão", () => {
    expect(TEXTOS_ZAP_NO_PAINEL.titulo).toBe("Seu WhatsApp ainda não foi confirmado");
    expect(TEXTOS_ZAP_NO_PAINEL.sub("AURA-K7MQ")).toBe("Mande o código AURA-K7MQ para a Aura e a gente confirma por lá.");
    expect(TEXTOS_ZAP_NO_PAINEL.sub(null)).toBe("Mande um oi para a Aura e a gente confirma por lá.");
    const tudo = (TEXTOS_ZAP_NO_PAINEL.titulo + TEXTOS_ZAP_NO_PAINEL.sub("AURA-K7MQ") + TEXTOS_ZAP_NO_PAINEL.botao).toLowerCase();
    ["handshake", "token", "verificar", "upgrade"].forEach((j) => expect(tudo).not.toContain(j));
  });
});

// ── a faixa, com a rede simulada ─────────────────────────────
function resetar() {
  mockMe.mockReset();
  mockAuth = {
    token: "t", isStaff: false, isDemo: false, consolidatedView: false,
    company: { id: "loja-1", name: "Padaria Sol", plan: "negocio", member_role: "owner" },
  };
}

async function montar(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={client}><WhatsappNaoConfirmadoFaixa /></QueryClientProvider>);
  });
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return { tree, client };
}
const achar = (t: any, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}

describe("a faixa", () => {
  let openURL: jest.SpyInstance;
  let windowOpen: jest.SpyInstance;

  beforeEach(() => {
    resetar();
    openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true as any);
    windowOpen = jest.spyOn(window, "open").mockImplementation(() => null);
  });
  afterEach(() => { openURL.mockRestore(); windowOpen.mockRestore(); });

  test("aguardando: título, frase com o código e o botão", async () => {
    mockMe.mockResolvedValue(AGUARDANDO);
    const { tree } = await montar();
    expect(achar(tree, "zap-nao-confirmado").length).toBe(1);
    const txt = texto(tree.toJSON());
    expect(txt).toContain("Seu WhatsApp ainda não foi confirmado");
    expect(txt).toContain("AURA-K7MQ");
    expect(txt).toContain("Abrir WhatsApp");
    tree.unmount();
  });

  test("o botão abre o wa.me da Aura com o código escrito", async () => {
    mockMe.mockResolvedValue(AGUARDANDO);
    const { tree } = await montar();
    await act(async () => { achar(tree, "zap-nao-confirmado-abrir")[0].props.onPress(); });
    const chamadas = [...windowOpen.mock.calls, ...openURL.mock.calls].map((c) => String(c[0]));
    expect(chamadas.length).toBe(1);
    expect(chamadas[0].startsWith("https://wa.me/5511956305269?text=")).toBe(true);
    expect(decodeURIComponent(chamadas[0].split("?text=")[1])).toBe("Oi, Aura! Meu código é AURA-K7MQ");
    tree.unmount();
  });

  test("é uma faixa no fluxo: sem posição absoluta nem modal", async () => {
    mockMe.mockResolvedValue(AGUARDANDO);
    const { tree } = await montar();
    const estilo = JSON.stringify(achar(tree, "zap-nao-confirmado")[0].props.style);
    expect(estilo).not.toContain("absolute");
    expect(estilo).not.toContain("fixed");
    tree.unmount();
  });

  test("confirmado, sem handshake ou leitura com erro: não aparece", async () => {
    const respostas: Array<() => Promise<any>> = [
      () => Promise.resolve({ whatsapp_handshake: { codigo: "AURA-K7MQ", estado: "confirmado" } }),
      () => Promise.resolve({ whatsapp_handshake: null }),
      () => Promise.resolve({}),
      () => Promise.reject(new Error("rede")),
    ];
    for (const resposta of respostas) {
      resetar();
      mockMe.mockImplementation(resposta);
      const { tree } = await montar();
      expect(mockMe).toHaveBeenCalledTimes(1);
      expect(tree.toJSON()).toBeNull();
      tree.unmount();
    }
  });

  test("visão consolidada, demo, staff e sem empresa: não aparece e não lê o /me", async () => {
    for (const ajuste of [{ consolidatedView: true }, { isDemo: true }, { isStaff: true }, { company: null }]) {
      resetar();
      Object.assign(mockAuth, ajuste);
      mockMe.mockResolvedValue(AGUARDANDO);
      const { tree } = await montar();
      expect(tree.toJSON()).toBeNull();
      expect(mockMe).not.toHaveBeenCalled();
      tree.unmount();
    }
  });

  test("uma leitura só: abrir o Painel de novo com o mesmo cache não lê outra vez", async () => {
    mockMe.mockResolvedValue(AGUARDANDO);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    for (let n = 0; n < 2; n++) {
      const { tree } = await montar(client);
      tree.unmount();
    }
    expect(mockMe).toHaveBeenCalledTimes(1);
  });
});

// ── fonte: a faixa no Painel ─────────────────────────────────
describe("no Painel", () => {
  test("logo depois do aviso de e-mail, fora de demo e da visão consolidada", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "index.tsx"), "utf8");
    expect(src).toContain("{!isDemo && !consolidatedView && <WhatsappNaoConfirmadoFaixa />}");
    expect(src.indexOf("<VerifyEmailBanner />")).toBeLessThan(src.indexOf("<WhatsappNaoConfirmadoFaixa />"));
  });

  test("sem polling: nenhum refetchInterval na faixa", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "components", "onboarding", "WhatsappNaoConfirmadoFaixa.tsx"), "utf8");
    expect(src).not.toContain("refetchInterval");
    expect(src).toContain("staleTime: Infinity");
  });
});
