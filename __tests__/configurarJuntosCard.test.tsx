// ============================================================
// Oferta "vamos configurar juntos" (card f2-04; 18/10/2026).
//
// Cartão no Painel de quem acabou de se cadastrar: conversa de 20 minutos pelo
// WhatsApp. Contrato com o backend:
//   GET  /companies/:id/onboarding/setup-call → { disponivel, solicitado, dispensado }
//   POST /companies/:id/onboarding/setup-call { acao: "solicitou" | "dispensou" }
//
// O que este teste segura:
//   1. texto e link: número da Aura, mensagem pronta com o nome da loja;
//   2. quando mostrar e quando esconder (staff, demo, consolidado, módulo,
//      servidor diz não, erro de rede / 404 / formato estranho);
//   3. "Marcar pelo WhatsApp" abre o wa.me e registra "solicitou";
//   4. "Agora não" some com o cartão e registra "dispensou";
//   5. módulo próprio nos mapas e funcionando no Essencial;
//   6. fonte: o cartão está no Painel, depois dos primeiros passos.
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import { Linking, Platform } from "react-native";
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

let mockModulos: Set<string> = new Set();
jest.mock("@/hooks/useVisibleModules", () => {
  const real = jest.requireActual("@/hooks/useVisibleModules");
  return { ...real, useVisibleModules: () => mockModulos };
});

const mockGet = jest.fn();
const mockRegistrar = jest.fn();
jest.mock("@/services/setupCallApi", () => {
  const real = jest.requireActual("@/services/setupCallApi");
  return {
    ...real,
    setupCallApi: { get: (...a: any[]) => mockGet(...a), registrar: (...a: any[]) => mockRegistrar(...a) },
  };
});

import { ConfigurarJuntosCard } from "@/components/onboarding/ConfigurarJuntosCard";
import {
  MOD_CONFIGURAR_JUNTOS, TEXTOS_CONFIGURAR_JUNTOS, linkConfigurarJuntos, mensagemConfigurarJuntos,
} from "@/constants/configurarJuntos";
import { AURA_WHATSAPP_NUMERO } from "@/constants/suporteAura";
import { lerSetupCall } from "@/services/setupCallApi";
import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";

const DISPONIVEL = { disponivel: true, solicitado: false, dispensado: false };

// ── 1. texto e link ──────────────────────────────────────────
describe("texto e link", () => {
  test("a mensagem pronta cita a loja e os 20 minutos", () => {
    expect(mensagemConfigurarJuntos("Padaria Sol"))
      .toBe("Oi! Acabei de criar a conta da Padaria Sol na Aura e quero marcar os 20 minutos para configurar juntos.");
  });

  test("sem nome da loja, vira 'minha loja'", () => {
    expect(mensagemConfigurarJuntos("  ")).toContain("conta da minha loja na Aura");
    expect(mensagemConfigurarJuntos(null)).toContain("conta da minha loja na Aura");
  });

  test("o link usa o número único da Aura (11 95630-5269) e codifica o texto", () => {
    expect(AURA_WHATSAPP_NUMERO).toBe("5511956305269");
    const link = linkConfigurarJuntos("Padaria Sol");
    expect(link.startsWith("https://wa.me/5511956305269?text=")).toBe(true);
    expect(decodeURIComponent(link.split("?text=")[1])).toBe(mensagemConfigurarJuntos("Padaria Sol"));
  });

  test("textos em linguagem simples, sem jargão", () => {
    expect(TEXTOS_CONFIGURAR_JUNTOS.titulo).toBe("Quer configurar junto com a gente?");
    expect(TEXTOS_CONFIGURAR_JUNTOS.sub).toBe("Uma conversa de 20 minutos para deixar o Caixa e o estoque prontos.");
    expect(TEXTOS_CONFIGURAR_JUNTOS.marcar).toBe("Marcar pelo WhatsApp");
    expect(TEXTOS_CONFIGURAR_JUNTOS.agoraNao).toBe("Agora não");
    const tudo = JSON.stringify(TEXTOS_CONFIGURAR_JUNTOS).toLowerCase();
    ["onboarding", "setup", "call", "upgrade"].forEach((j) => expect(tudo).not.toContain(j));
  });
});

// ── 2. leitura defensiva do GET ──────────────────────────────
describe("lerSetupCall", () => {
  test("formato certo passa; fora do formato vira null (não mostrar)", () => {
    expect(lerSetupCall(DISPONIVEL)).toEqual(DISPONIVEL);
    expect(lerSetupCall({ disponivel: false })).toEqual({ disponivel: false, solicitado: false, dispensado: false });
    expect(lerSetupCall(null)).toBeNull();
    expect(lerSetupCall("ok")).toBeNull();
    expect(lerSetupCall({})).toBeNull();
    expect(lerSetupCall({ disponivel: "sim" })).toBeNull();
  });
});

// ── 5. módulo próprio ────────────────────────────────────────
describe("módulo próprio (armadilha 3)", () => {
  test("chave nos dois mapas, no Essencial", () => {
    expect(MOD_CONFIGURAR_JUNTOS).toBe("onboarding.configurar_juntos");
    expect(MODULE_PLAN_MAP[MOD_CONFIGURAR_JUNTOS]).toBe("essencial");
    expect(PERM_TO_MODULES.configuracoes).toContain(MOD_CONFIGURAR_JUNTOS);
  });

  test("o Essencial vê o módulo; override false esconde; membro sem configurações não", () => {
    expect(computeVisibleModules("essencial", null, undefined).has(MOD_CONFIGURAR_JUNTOS)).toBe(true);
    expect(computeVisibleModules("essencial", { [MOD_CONFIGURAR_JUNTOS]: false }, undefined).has(MOD_CONFIGURAR_JUNTOS)).toBe(false);
    const membro = computeVisibleModules("negocio", null, { is_owner: false, permissions: { pdv: true } });
    expect(membro.has(MOD_CONFIGURAR_JUNTOS)).toBe(false);
  });
});

// ── o cartão, com a rede simulada ────────────────────────────
function resetar() {
  mockGet.mockReset(); mockRegistrar.mockReset();
  mockRegistrar.mockResolvedValue({ registrado: true });
  mockAuth = {
    token: "t", isStaff: false, isDemo: false, consolidatedView: false,
    company: { id: "loja-1", name: "Padaria Sol", plan: "essencial", member_role: "owner" },
  };
  mockModulos = new Set(["painel", "pdv", "estoque", MOD_CONFIGURAR_JUNTOS]);
}

async function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={client}><ConfigurarJuntosCard /></QueryClientProvider>);
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
async function tocar(tree: any, id: string) {
  await act(async () => { achar(tree, id)[0].props.onPress(); });
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe("o cartão", () => {
  let openURL: jest.SpyInstance;
  let windowOpen: jest.SpyInstance;
  const plataformaOriginal = Platform.OS;

  beforeEach(() => {
    resetar();
    openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true as any);
    windowOpen = jest.spyOn(window, "open").mockImplementation(() => null);
  });
  afterEach(() => {
    openURL.mockRestore(); windowOpen.mockRestore();
    (Platform as any).OS = plataformaOriginal;
  });

  test("disponível: mostra título, frase, os dois botões, e a leitura é da empresa ativa", async () => {
    mockGet.mockResolvedValue(DISPONIVEL);
    const { tree } = await montar();
    expect(mockGet).toHaveBeenCalledWith("loja-1");
    expect(achar(tree, "configurar-juntos").length).toBe(1);
    const txt = texto(tree.toJSON());
    expect(txt).toContain("Quer configurar junto com a gente?");
    expect(txt).toContain("Uma conversa de 20 minutos para deixar o Caixa e o estoque prontos.");
    expect(txt).toContain("Marcar pelo WhatsApp");
    expect(txt).toContain("Agora não");
    tree.unmount();
  });

  test("é um cartão no fluxo: sem posição absoluta nem modal", async () => {
    mockGet.mockResolvedValue(DISPONIVEL);
    const { tree } = await montar();
    const estilo = JSON.stringify(achar(tree, "configurar-juntos")[0].props.style);
    expect(estilo).not.toContain("absolute");
    expect(estilo).not.toContain("fixed");
    tree.unmount();
  });

  test("servidor diz indisponível, já pediu ou já dispensou: não aparece", async () => {
    for (const estado of [
      { disponivel: false, solicitado: false, dispensado: false },
      { disponivel: false, solicitado: true, dispensado: false },
      { disponivel: false, solicitado: false, dispensado: true },
    ]) {
      resetar();
      mockGet.mockResolvedValue(estado);
      const { tree } = await montar();
      expect(achar(tree, "configurar-juntos").length).toBe(0);
      expect(tree.toJSON()).toBeNull();
      tree.unmount();
    }
  });

  test("erro de rede, 404 ou formato estranho: não aparece (nunca atrapalha o Painel)", async () => {
    for (const falha of [() => Promise.reject(new Error("rede")), () => Promise.resolve(null), () => Promise.resolve({ ok: 1 })]) {
      resetar();
      mockGet.mockImplementation(falha);
      const { tree } = await montar();
      expect(tree.toJSON()).toBeNull();
      tree.unmount();
    }
  });

  test("staff, demo, visão consolidada, sem módulo visível ou sem sessão: nem consulta a rede", async () => {
    const casos: Array<(a: any) => void> = [
      (a) => { a.isStaff = true; },
      (a) => { a.isDemo = true; },
      (a) => { a.consolidatedView = true; },
      (a) => { a.company = null; },
      (a) => { a.token = null; },
    ];
    for (const mexer of casos) {
      resetar();
      mockGet.mockResolvedValue(DISPONIVEL);
      mexer(mockAuth);
      const { tree } = await montar();
      expect(tree.toJSON()).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
      tree.unmount();
    }
    resetar();
    mockGet.mockResolvedValue(DISPONIVEL);
    mockModulos = new Set(["painel", "pdv"]);
    const { tree } = await montar();
    expect(tree.toJSON()).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("Marcar pelo WhatsApp (celular): abre o wa.me da Aura com o texto da loja e registra 'solicitou'", async () => {
    (Platform as any).OS = "android";
    mockGet.mockResolvedValue(DISPONIVEL);
    const { tree } = await montar();
    await tocar(tree, "configurar-juntos-marcar");
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(linkConfigurarJuntos("Padaria Sol"));
    expect(String(openURL.mock.calls[0][0])).toContain("wa.me/5511956305269");
    expect(mockRegistrar).toHaveBeenCalledWith("loja-1", "solicitou");
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("Marcar pelo WhatsApp (web): abre numa aba nova, no mesmo toque, antes do registro", async () => {
    (Platform as any).OS = "web";
    mockGet.mockResolvedValue(DISPONIVEL);
    const ordem: string[] = [];
    windowOpen.mockImplementation((() => { ordem.push("abriu"); return null; }) as any);
    mockRegistrar.mockImplementation(() => { ordem.push("registrou"); return Promise.resolve({}); });
    const { tree } = await montar();
    await tocar(tree, "configurar-juntos-marcar");
    expect(windowOpen).toHaveBeenCalledWith(linkConfigurarJuntos("Padaria Sol"), "_blank", "noopener");
    expect(openURL).not.toHaveBeenCalled();
    expect(ordem).toEqual(["abriu", "registrou"]);
    tree.unmount();
  });

  test("depois de marcar: mostra o aviso curto (sem os botões) e 'Fechar' tira o cartão", async () => {
    (Platform as any).OS = "android";
    mockGet.mockResolvedValue(DISPONIVEL);
    const { tree } = await montar();
    await tocar(tree, "configurar-juntos-marcar");
    expect(achar(tree, "configurar-juntos").length).toBe(0);
    expect(achar(tree, "configurar-juntos-aberto").length).toBe(1);
    expect(texto(tree.toJSON())).toContain("É só combinar com a gente o melhor horário.");
    await tocar(tree, "configurar-juntos-fechar");
    expect(tree.toJSON()).toBeNull();
    // Fechar o aviso não é um segundo evento.
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("falha ao registrar não impede nada: o WhatsApp já abriu e o aviso aparece", async () => {
    (Platform as any).OS = "android";
    mockGet.mockResolvedValue(DISPONIVEL);
    mockRegistrar.mockRejectedValue(new Error("rede"));
    const { tree } = await montar();
    await tocar(tree, "configurar-juntos-marcar");
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(achar(tree, "configurar-juntos-aberto").length).toBe(1);
    tree.unmount();
  });

  test("Agora não: some na hora, registra 'dispensou' e não abre o WhatsApp", async () => {
    mockGet.mockResolvedValue(DISPONIVEL);
    const { tree } = await montar();
    await tocar(tree, "configurar-juntos-agora-nao");
    expect(tree.toJSON()).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledWith("loja-1", "dispensou");
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(openURL).not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("Agora não com a rede fora: o cartão some do mesmo jeito", async () => {
    mockGet.mockResolvedValue(DISPONIVEL);
    mockRegistrar.mockRejectedValue(new Error("rede"));
    const { tree } = await montar();
    await tocar(tree, "configurar-juntos-agora-nao");
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  test("voltar ao Painel na mesma sessão não reabre o cartão (cache reflete a escolha)", async () => {
    mockGet.mockResolvedValue(DISPONIVEL);
    const { tree, client } = await montar();
    await tocar(tree, "configurar-juntos-agora-nao");
    tree.unmount();
    let nova: any;
    await act(async () => {
      nova = renderer.create(<QueryClientProvider client={client}><ConfigurarJuntosCard /></QueryClientProvider>);
    });
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(nova.toJSON()).toBeNull();
    nova.unmount();
  });
});

// ── 6. fonte ─────────────────────────────────────────────────
describe("fonte", () => {
  const raiz = path.resolve(__dirname, "..");
  const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

  test("o Painel monta o cartão logo depois dos primeiros passos, fora de demo e do consolidado", () => {
    const src = ler("app/(tabs)/index.tsx");
    const passos = src.indexOf("<PrimeirosPassosCard />");
    const juntos = src.indexOf("<ConfigurarJuntosCard />");
    expect(passos).toBeGreaterThan(-1);
    expect(juntos).toBeGreaterThan(passos);
    expect(src).toMatch(/!isDemo && !consolidatedView && <ConfigurarJuntosCard \/>/);
  });

  test("as rotas e o corpo seguem o contrato com o backend", () => {
    const src = ler("services/setupCallApi.ts");
    expect(src).toContain('"/onboarding/setup-call"');
    expect(src).toContain("method: \"POST\"");
    expect(src).toContain("body: { acao: acao }");
  });

  test("o cartão não é banner flutuante nem usa hover", () => {
    const src = ler("components/onboarding/ConfigurarJuntosCard.tsx");
    expect(src).not.toMatch(/position:\s*"(absolute|fixed)"/);
    expect(src).not.toMatch(/onHover|:hover|onMouse/);
    expect(src).not.toMatch(/Modal/);
  });
});
