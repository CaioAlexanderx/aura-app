// ============================================================
// "Como você quer trazer seus produtos?" (19/10/2026, card tq-34).
//
// Quadro 2 do "caminho proposto" no mockup aprovado pelo Caio
// (claude.ai/artifact/WjWnEitYY49kPCapdY4hcV). O que este teste segura:
//   1. as três opções na tela, com os textos aprovados, e o destino certo
//      de cada uma (o WhatsApp abre no mesmo toque do "Quero ajuda");
//   2. a etiqueta "Sugerido para 51 a 300 produtos" só na faixa 51 a 300
//      ou com "Caderno";
//   3. chave de módulo própria nos dois mapas, no Essencial, sem item no NAV;
//   4. recarga direto na rota: nada navega antes da sessão e do navegador
//      raiz (mesma proteção do app#1110);
//   5. só tela e roteamento: nenhuma chamada de venda, estoque ou importação.
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockNavState: any = { key: "raiz" };
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: (...a: any[]) => mockReplace(...a), push: (...a: any[]) => mockPush(...a) }),
  router: { replace: (...a: any[]) => mockReplace(...a) },
  useRootNavigationState: () => mockNavState,
}));

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
const mockPut = jest.fn();
jest.mock("@/services/checkinApi", () => {
  const real = jest.requireActual("@/services/checkinApi");
  return {
    ...real,
    checkinApi: { get: (...a: any[]) => mockGet(...a), put: (...a: any[]) => mockPut(...a) },
  };
});

import { TrazerProdutos } from "@/components/onboarding/TrazerProdutos";
import { MOD_TRAZER_PRODUTOS, ROTA_TRAZER_PRODUTOS, TEXTOS_TRAZER_PRODUTOS } from "@/constants/trazerProdutos";
import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import { AURA_WHATSAPP_NUMERO } from "@/constants/suporteAura";
import { MODELO_PRODUTOS } from "@/components/screens/estoque/BaixarModelo";
import { acaoPlanilha, acaoQueroAjuda, acaoUmPorUm, mensagemQueroAjuda, mostrarSugerido } from "@/utils/trazerProdutos";

const raiz = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const LOJA = { id: "loja-1", name: "Loja da Lu", plan: "essencial", member_role: "owner", segment: "varejo" };
const RESPONDIDO = (respostas: Record<string, string>) => ({
  habilitado: true, respondido: true, pulou: false, versao: 1, respostas,
});

function resetar() {
  mockReplace.mockReset(); mockPush.mockReset(); mockGet.mockReset(); mockPut.mockReset();
  mockNavState = { key: "raiz" };
  mockAuth = { token: "t", isHydrated: true, isStaff: false, isDemo: false, consolidatedView: false, company: LOJA };
  mockModulos = computeVisibleModules("essencial", null, undefined);
  mockGet.mockResolvedValue(RESPONDIDO({ comeco: "estoque", onde_anota: "caderno", produtos_faixa: "de_51_a_300" }));
}

async function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => <QueryClientProvider client={client}><TrazerProdutos /></QueryClientProvider>;
  let tree: any;
  await act(async () => { tree = renderer.create(ui()); });
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const atualizar = async () => {
    await act(async () => { tree.update(ui()); });
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  };
  return { tree, atualizar };
}
const achar = (t: any, id: string) => t.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
const texto = (t: any) => JSON.stringify(t.toJSON());

// ── 1. pura ─────────────────────────────────────────────────
describe("regras", () => {
  test("etiqueta Sugerido: só 51 a 300 ou Caderno (no caminho do meio)", () => {
    expect(mostrarSugerido({ produtos_faixa: "de_51_a_300" })).toBe(true);
    expect(mostrarSugerido({ onde_anota: "caderno" })).toBe(true);
    expect(mostrarSugerido({ comeco: "estoque", onde_anota: "caderno", produtos_faixa: "ate_50" })).toBe(true);
    expect(mostrarSugerido({ onde_anota: "nao_anoto" })).toBe(false);
    expect(mostrarSugerido({ produtos_faixa: "ate_50" })).toBe(false);
    expect(mostrarSugerido({ onde_anota: "planilha", produtos_faixa: "de_51_a_300" })).toBe(false);
    // Caderno com mais de 1.000 é importação assistida, não a faixa do meio
    expect(mostrarSugerido({ onde_anota: "caderno", produtos_faixa: "mais_de_1000" })).toBe(false);
    expect(mostrarSugerido({})).toBe(false);
    expect(mostrarSugerido(null)).toBe(false);
  });

  test("destinos: um por um, quero ajuda e planilha", () => {
    const essencial = computeVisibleModules("essencial", null, undefined);
    expect(acaoUmPorUm(essencial)).toEqual({ rota: "/estoque?novo=produto&depois=pdv" });
    // sem Caixa no plano, o cadastro não segue ao Caixa
    expect(acaoUmPorUm(new Set(["estoque"]))).toEqual({ rota: "/estoque?novo=produto" });
    expect(acaoPlanilha()).toEqual({ rota: "/estoque?importar=planilha" });
    const ajuda = acaoQueroAjuda(essencial, "Loja da Lu", { onde_anota: "caderno", produtos_faixa: "de_51_a_300" });
    expect(ajuda.rota).toBe("/estoque?novo=produto&depois=pdv");
    expect(ajuda.whatsapp).toBe(
      "https://wa.me/" + AURA_WHATSAPP_NUMERO + "?text=" + encodeURIComponent(
        "Oi! Acabei de criar a conta da Loja da Lu na Aura e quero ajuda para trazer meus produtos"
        + " (tenho de 51 a 300 produtos e anoto no caderno). Vou mandar a foto do caderno ou a planilha por aqui.",
      ),
    );
    expect(mensagemQueroAjuda(null, null)).toBe(
      "Oi! Acabei de criar a conta da minha loja na Aura e quero ajuda para trazer meus produtos."
      + " Vou mandar a foto do caderno ou a planilha por aqui.",
    );
    // mesmo número e helper da importação assistida do check-in
    expect(raiz("utils/trazerProdutos.ts")).toContain('import { waAura } from "@/constants/suporteAura";');
  });
});

// ── 3. módulo próprio ───────────────────────────────────────
describe("módulo próprio (armadilha 3)", () => {
  test("chave nos dois mapas, no Essencial; sem item no NAV", () => {
    expect(MOD_TRAZER_PRODUTOS).toBe("onboarding.trazer_produtos");
    expect(MODULE_PLAN_MAP[MOD_TRAZER_PRODUTOS]).toBe("essencial");
    expect(PERM_TO_MODULES.configuracoes).toContain(MOD_TRAZER_PRODUTOS);
    expect(raiz("app/(tabs)/_layout.tsx")).not.toContain(MOD_TRAZER_PRODUTOS);
    expect(raiz("app/(tabs)/_layout.tsx")).not.toContain(ROTA_TRAZER_PRODUTOS);
  });

  test("o Essencial vê; override false esconde; membro sem configurações não", () => {
    expect(computeVisibleModules("essencial", null, undefined).has(MOD_TRAZER_PRODUTOS)).toBe(true);
    expect(computeVisibleModules("essencial", { [MOD_TRAZER_PRODUTOS]: false }, undefined).has(MOD_TRAZER_PRODUTOS)).toBe(false);
    const membro = computeVisibleModules("negocio", null, { is_owner: false, permissions: { pdv: true } });
    expect(membro.has(MOD_TRAZER_PRODUTOS)).toBe(false);
  });

  test("a rota existe e só monta a tela", () => {
    expect(raiz("app/trazer-produtos.tsx")).toContain("<TrazerProdutos />");
  });
});

// ── 1 e 2. a tela ───────────────────────────────────────────
describe("a tela", () => {
  beforeEach(resetar);

  test("mostra as três opções, o Baixar modelo e o texto de apoio", async () => {
    const { tree } = await montar();
    expect(achar(tree, "trazer-raiz").length).toBe(1);
    ["trazer-um-por-um", "trazer-ajuda", "trazer-planilha", "trazer-baixar-modelo", "trazer-apoio"].forEach((id) =>
      expect(achar(tree, id).length).toBe(1));
    const t = TEXTOS_TRAZER_PRODUTOS;
    const json = texto(tree);
    [t.titulo, t.umPorUm.titulo, t.umPorUm.sub, t.ajuda.titulo, t.ajuda.sub, t.planilha.titulo, t.planilha.sub, t.apoio, "Baixar modelo"]
      .forEach((s) => expect(json).toContain(s));
    expect(t).toMatchObject({
      titulo: "Como você quer trazer seus produtos?",
      umPorUm: { titulo: "Um por um", sub: "Nome e preço bastam. Leva 20 segundos cada." },
      ajuda: { titulo: "Quero ajuda", sub: "Mande a foto do caderno ou a planilha pelo WhatsApp.", sugerido: "Sugerido para 51 a 300 produtos" },
      planilha: { titulo: "Planilha", sub: "Baixe o modelo e envie preenchido." },
      apoio: "Começa pelo primeiro produto enquanto o resto chega.",
    });
    // o Baixar modelo é o link de download do app#1109
    const link = tree.root.findAll((n: any) => n.props && n.props.testID === "trazer-baixar-modelo" && n.props.href);
    expect(link.length).toBeGreaterThan(0);
    expect(link[0].props.href).toBe(MODELO_PRODUTOS.caminho);
    expect(mockReplace).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("Um por um: o cadastro de produto que segue ao Caixa", async () => {
    const { tree } = await montar();
    await act(async () => { achar(tree, "trazer-um-por-um")[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/estoque?novo=produto&depois=pdv");
    tree.unmount();
  });

  test("Quero ajuda: wa.me da Aura no mesmo toque e o cadastro um por um", async () => {
    const abrir = jest.spyOn(window, "open").mockImplementation(() => null);
    const { tree } = await montar();
    await act(async () => { achar(tree, "trazer-ajuda")[0].props.onPress(); });
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(String(abrir.mock.calls[0][0])).toMatch(new RegExp("^https://wa\\.me/" + AURA_WHATSAPP_NUMERO + "\\?text="));
    expect(decodeURIComponent(String(abrir.mock.calls[0][0]))).toContain("Loja da Lu");
    expect(mockPush).toHaveBeenCalledWith("/estoque?novo=produto&depois=pdv");
    abrir.mockRestore();
    tree.unmount();
  });

  test("Planilha: o convite Importar sua planilha do Estoque", async () => {
    const abrir = jest.spyOn(window, "open").mockImplementation(() => null);
    const { tree } = await montar();
    await act(async () => { achar(tree, "trazer-planilha")[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/estoque?importar=planilha");
    expect(abrir).not.toHaveBeenCalled();
    abrir.mockRestore();
    tree.unmount();
  });

  test("toque duplo não empilha duas telas", async () => {
    const { tree } = await montar();
    await act(async () => {
      achar(tree, "trazer-um-por-um")[0].props.onPress();
      achar(tree, "trazer-um-por-um")[0].props.onPress();
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test.each([
    ["51 a 300", { produtos_faixa: "de_51_a_300" }, true],
    ["Caderno", { onde_anota: "caderno" }, true],
    ["Ainda não anoto", { onde_anota: "nao_anoto" }, false],
    ["até 50", { produtos_faixa: "ate_50" }, false],
    ["nada respondido", {}, false],
  ])("etiqueta Sugerido com %s: %s", async (_n, respostas, aparece) => {
    mockGet.mockResolvedValue(RESPONDIDO(respostas as Record<string, string>));
    const { tree } = await montar();
    expect(achar(tree, "trazer-sugerido").length).toBe(aparece ? 1 : 0);
    expect(texto(tree).includes("Sugerido para 51 a 300 produtos")).toBe(aparece);
    tree.unmount();
  });

  test("sem resposta do check-in (rede ou 404): as três opções, sem etiqueta", async () => {
    mockGet.mockRejectedValue(new Error("rede"));
    const { tree } = await montar();
    expect(achar(tree, "trazer-raiz").length).toBe(1);
    expect(achar(tree, "trazer-sugerido").length).toBe(0);
    tree.unmount();
  });

  test("sem a chave da tela, sem Estoque ou no consolidado: Painel", async () => {
    mockModulos = computeVisibleModules("essencial", { [MOD_TRAZER_PRODUTOS]: false }, undefined);
    let m = await montar();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(achar(m.tree, "trazer-raiz").length).toBe(0);
    m.tree.unmount();

    resetar();
    mockModulos = new Set([MOD_TRAZER_PRODUTOS, "pdv"]);
    m = await montar();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    m.tree.unmount();

    resetar();
    mockAuth = { ...mockAuth, consolidatedView: true };
    m = await montar();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    m.tree.unmount();
  });

  test("plano velho no JWT: revalida o /auth/me antes de decidir", async () => {
    let soltar: () => void = () => {};
    const refreshMe = jest.fn(() => new Promise<void>((r) => { soltar = r; }));
    mockAuth = { ...mockAuth, refreshMe };
    mockModulos = computeVisibleModules("essencial", { [MOD_TRAZER_PRODUTOS]: false }, undefined);
    const m = await montar();
    expect(refreshMe).toHaveBeenCalledTimes(1);
    // ainda revalidando: não manda ao Painel
    expect(mockReplace).not.toHaveBeenCalled();
    // o /auth/me novo libera a tela
    mockModulos = computeVisibleModules("essencial", null, undefined);
    await act(async () => { soltar(); });
    await m.atualizar();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(achar(m.tree, "trazer-raiz").length).toBe(1);
    m.tree.unmount();
  });
});

// ── 4. recarga direto na rota (mesma proteção do app#1110) ──
describe("recarga direto em /trazer-produtos", () => {
  beforeEach(resetar);

  function antesDaSessao() {
    mockAuth = { ...mockAuth, isHydrated: false, token: null, company: null };
    mockNavState = undefined;
  }
  function sessaoRestaurada(company: any) {
    mockAuth = { ...mockAuth, isHydrated: true, token: "t", company };
    mockNavState = { key: "raiz" };
  }

  test("sessão ainda não restaurada: não navega, não consulta e mostra o carregando", async () => {
    antesDaSessao();
    const { tree } = await montar();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(achar(tree, "trazer-carregando").length).toBe(1);
    expect(achar(tree, "trazer-raiz").length).toBe(0);
    tree.unmount();
  });

  test("sessão restaurada mas navegador raiz ainda não montado: não navega", async () => {
    antesDaSessao();
    mockAuth = { ...mockAuth, isHydrated: true, token: "t", company: null };
    mockNavState = { key: undefined };
    const { tree } = await montar();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(achar(tree, "trazer-carregando").length).toBe(1);
    tree.unmount();
  });

  test("depois de restaurar: mostra as opções, com a etiqueta pelo GET do check-in", async () => {
    antesDaSessao();
    const m = await montar();
    expect(mockReplace).not.toHaveBeenCalled();
    sessaoRestaurada(LOJA);
    await m.atualizar();
    expect(mockGet).toHaveBeenCalledWith("loja-1");
    expect(achar(m.tree, "trazer-raiz").length).toBe(1);
    expect(achar(m.tree, "trazer-sugerido").length).toBe(1);
    expect(mockReplace).not.toHaveBeenCalled();
    m.tree.unmount();
  });

  test("depois de restaurar, sem empresa: Painel só depois de pronto", async () => {
    antesDaSessao();
    const m = await montar();
    expect(mockReplace).not.toHaveBeenCalled();
    sessaoRestaurada(null);
    await m.atualizar();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    m.tree.unmount();
  });

  test("sem sessão nenhuma: a tela não disputa a navegação com o login do layout raiz", async () => {
    mockAuth = { ...mockAuth, isHydrated: true, token: null, company: null };
    const { tree } = await montar();
    expect(mockReplace).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("o toque antes de pronto não navega", async () => {
    // a tela só aparece pronta; a guarda fica no fonte
    const src = raiz("components/onboarding/TrazerProdutos.tsx");
    expect(src).toContain("const pronta = !!isHydrated && navState?.key != null;");
    expect(src).toMatch(/function ir\(acao: AcaoTrazerProdutos\) \{\s*if \(!pronta/);
  });
});

// ── 5. só tela e roteamento ─────────────────────────────────
describe("escopo", () => {
  test("nenhuma chamada de venda, estoque, importação ou impressão", () => {
    const fontes = raiz("components/onboarding/TrazerProdutos.tsx") + raiz("utils/trazerProdutos.ts");
    expect(fontes).not.toMatch(/services\/(api|pdv|estoque|products|importacao)|labels|print|imprim/i);
    expect(fontes).not.toMatch(/request\(|fetch\(/);
  });
});
