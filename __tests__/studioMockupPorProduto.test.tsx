// ============================================================
// AURA Studio — 28/09/2026: "Mockup por produto" na aba Aparência
//
// A fileira de ~13 chips por produto virou um seletor único com
// pré-visualizador (mockup aprovado:
// docs/mockups/studio-aparencia-seletor-de-mockup.html). Aqui:
//   1. as regras puras (selo, seletor fechado, grupos 3D/2D, digitar para
//      pular, busca/filtro, miniatura, abas da prévia);
//   2. a seção montada: selos na lista, abrir o seletor, passar o mouse
//      (prévia antes de gravar), escolher e salvar, falha com "Tentar de
//      novo", o caminho de toque ("Usar este modelo"), teclado, busca e
//      filtro com mais de 8 produtos e o estado sem modelos publicados.
//
// react-native vira componentes-string (padrão dos testes de tela); o
// viewer e a miniatura são trocados por dublês — o que se prova é a
// lógica da tela, não o canvas.
// ============================================================
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

let mockLargura = 1280;
jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  TextInput: "TextInput", Image: "Image", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s }, Platform: { OS: "web" },
  useWindowDimensions: () => ({ width: mockLargura, height: 800 }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ children, active }: any) => (active ? children : null),
}));
jest.mock("@/contexts/StudioThemeMode", () => ({
  useStudioTokens: () => ({
    primary: "#1E3A8A", primary2: "#3B82F6", primarySoft: "#DBEAFE", primaryGhost: "#EFF6FF",
    accent: "#EC4899", accentSoft: "#FCE7F3", accentInk: "#BE185D",
    bgSoft: "#EEF0F5", paperCard: "#F5F6FA", paperCardElev: "#FFF",
    ink: "#0F172A", ink2: "#334155", ink3: "#5E6A7A", ink4: "#94A3B8", ink5: "#CBD5E1",
    successSoft: "#D1FAE5", successInk: "#065F46", dangerSoft: "#FEE2E2", dangerInk: "#991B1B", infoInk: "#1E3A8A",
  }),
}));
const mockInvalidar = jest.fn();
jest.mock("@/components/studio/visualEngine/EnginePreview", () => ({
  invalidateProductTemplate: (...a: any[]) => mockInvalidar(...a),
}));
jest.mock("@/components/studio/mockupPorProduto/MiniaturaDoModelo", () => {
  const actual = jest.requireActual("@/components/studio/mockupPorProduto/MiniaturaDoModelo");
  return { ...actual, MiniaturaDoModelo: "MiniaturaDoModelo" };
});
// A prévia de verdade desenha em canvas/WebGL; o dublê mostra o que ela recebeu.
jest.mock("@/components/studio/mockupPorProduto/PreviaDoModelo", () => {
  const R = jest.requireActual("react");
  return {
    PreviaDoModelo: (p: any) => R.createElement("Text", { testID: p.testID || "previa" },
      p.produto.name + " | " + (p.template ? p.template.name : "sem") + (p.provisorio ? " | provisória" : "")),
  };
});

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
const mockListar = jest.fn();
const mockSpec = jest.fn();
const mockGravar = jest.fn();
jest.mock("@/services/studioVisualApi", () => ({
  studioVisualApi: {
    listVisualTemplates: (...a: any[]) => mockListar(...a),
    getVisualTemplate: (...a: any[]) => mockSpec(...a),
    setProductVisualTemplate: (...a: any[]) => mockGravar(...a),
  },
}));

import { SecaoMockupPorProduto } from "@/components/studio/mockupPorProduto/SecaoMockupPorProduto";
import {
  situacaoDoProduto, rotuloDoSeletor, opcoesDoSeletor, proximaPorDigitacao, filtrarProdutos,
  contarComModelo, lerProduto, abasDaPrevia, metaDoModelo,
} from "@/components/studio/mockupPorProduto/regras";
import { formaDaMiniaturaDoModelo } from "@/components/studio/mockupPorProduto/MiniaturaDoModelo";
import { limparCacheDeSpecs } from "@/components/studio/mockupPorProduto/useSpecsDosModelos";

// ── Dados de exemplo (conta aura-qa) ──────────────────────────
const MODELOS: any[] = [
  { key: "caneca-alca-coracao", name: "Caneca alça coração 355 ml", kind: "model3d", version: 1 },
  { key: "caneca-classica", name: "Caneca clássica 325 ml", kind: "model3d", version: 1 },
  { key: "caneca-chopp", name: "Caneca de chopp 475 ml", kind: "model3d", version: 1 },
  { key: "camiseta-basica", name: "Camiseta básica", kind: "model3d", version: 2 },
  { key: "camiseta-frente-verso", name: "Camiseta frente e verso", kind: "photo2d", version: 1 },
];
const QUAD = [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }];
const PRODUTOS: any[] = [
  { id: "p1", name: "CANECA ALÇA CORAÇÃO", is_personalizable: true, image_url: "https://r2/p1.jpg", visual_template_key: "caneca-alca-coracao", customization_config: {} },
  { id: "p2", name: "CANECA BRANCA", is_personalizable: true, image_url: "https://r2/p2.jpg", visual_template_key: "caneca-classica", customization_config: {} },
  { id: "p3", name: "CAMISA ALGODÃO Básico 2 (PENTEADO)", is_personalizable: true, image_url: "https://r2/p3.jpg", visual_template_key: "camiseta-basica", customization_config: {} },
  { id: "p4", name: "Garrafa termica 500ml", is_personalizable: true, image_url: null, visual_template_key: null, customization_config: {} },
  { id: "p5", name: "CAMISA A. POLO", is_personalizable: true, image_url: "https://r2/p5.jpg", visual_template_key: null,
    customization_config: { mockup_foto: { front: { photo_url: "https://r2/p5.jpg", quad: QUAD, w: 1000, h: 1000 } } } },
];
const MAIS = ["CANECA CHOPP 475ML", "CANECA MÁGICA PRETA", "AZULEJO 15X15 BRILHO", "ECOBAG CRU", "SQUEEZE ALUMÍNIO 600ML"]
  .map((name, i) => ({ id: "x" + i, name, is_personalizable: true, image_url: null, visual_template_key: null, customization_config: {} }));

// ── Utilitários ───────────────────────────────────────────────
function porTestID(r: TestRenderer.ReactTestRenderer, id: string) {
  return r.root.findAll((n) => typeof n.type === "string" && n.props.testID === id);
}
function um(r: TestRenderer.ReactTestRenderer, id: string) {
  const a = porTestID(r, id);
  if (!a.length) throw new Error("não achei testID " + id);
  return a[0];
}
function texto(n: any): string {
  if (n == null) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  return (n.children || []).map(texto).join("");
}
async function montar(produtos = PRODUTOS, modelos = MODELOS) {
  mockRequest.mockResolvedValue({ products: produtos });
  mockListar.mockResolvedValue({ templates: modelos });
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<SecaoMockupPorProduto companyId="c1" />); });
  await act(async () => { await Promise.resolve(); });
  return r;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockLargura = 1280;
  mockRequest.mockReset(); mockListar.mockReset(); mockSpec.mockReset(); mockGravar.mockReset(); mockInvalidar.mockReset();
  mockSpec.mockResolvedValue({ template: { spec: { schema: 1, areas: [] } } });
  limparCacheDeSpecs();
});
afterEach(() => { jest.useRealTimers(); });

// ═════════════════════════════════════════════════════════════
describe("regras", () => {
  const produtos = PRODUTOS.map(lerProduto);

  it("selo: modelo vinculado > Mockup na foto > sem mockup", () => {
    expect(situacaoDoProduto(produtos[0], "caneca-alca-coracao", MODELOS).rotulo).toBe("Vinculado · 3D");
    expect(situacaoDoProduto(produtos[4], "camiseta-frente-verso", MODELOS).rotulo).toBe("Vinculado · 2D");
    expect(situacaoDoProduto(produtos[4], null, MODELOS)).toEqual({ situacao: "foto", rotulo: "Mockup na foto" });
    expect(situacaoDoProduto(produtos[3], null, MODELOS)).toEqual({ situacao: "sem", rotulo: "Sem mockup" });
  });

  it("seletor fechado diz o modelo atual, a foto marcada ou o que a loja mostra sem nada", () => {
    expect(rotuloDoSeletor(produtos[0], "caneca-alca-coracao", MODELOS).nome).toBe("Caneca alça coração 355 ml");
    expect(rotuloDoSeletor(produtos[0], "caneca-alca-coracao", MODELOS).tipo).toBe("3D");
    expect(rotuloDoSeletor(produtos[4], null, MODELOS)).toMatchObject({ nome: "Mockup na foto", tipo: "FOTO" });
    expect(rotuloDoSeletor(produtos[3], null, MODELOS)).toMatchObject({ nome: "Sem mockup", meta: "A loja mostra só a arte" });
    // modelo que saiu da lista publicada continua aparecendo
    expect(rotuloDoSeletor(produtos[0], "caneca-arquivada", MODELOS).meta).toBe("Fora da lista de modelos publicados");
  });

  it("opções: Sem mockup primeiro, depois 3D e 2D", () => {
    const o = opcoesDoSeletor(MODELOS);
    expect(o.map((x) => x.grupo)).toEqual(["nenhum", "3D", "3D", "3D", "3D", "2D"]);
    expect(o[0]).toMatchObject({ key: null, nome: "Sem mockup" });
  });

  it("digitar pula pelo começo de qualquer palavra, sem acento", () => {
    const o = opcoesDoSeletor(MODELOS);
    expect(o[proximaPorDigitacao(o, 0, "ch")].key).toBe("caneca-chopp");
    expect(o[proximaPorDigitacao(o, 0, "alca")].key).toBe("caneca-alca-coracao");
    expect(o[proximaPorDigitacao(o, 0, "f")].key).toBe("camiseta-frente-verso");
    expect(proximaPorDigitacao(o, 0, "zz")).toBe(-1);
  });

  it("busca sem acento e filtro por vínculo", () => {
    const v = { p1: "a", p2: null, p3: "b", p4: null, p5: null } as any;
    expect(filtrarProdutos(produtos, v, "algodao", "todos").map((p) => p.id)).toEqual(["p3"]);
    expect(filtrarProdutos(produtos, v, "", "com").map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(filtrarProdutos(produtos, v, "caneca", "sem").map((p) => p.id)).toEqual(["p2"]);
    expect(contarComModelo(produtos, v)).toBe(2);
  });

  it("miniatura: foto do 2D, caneca, camiseta em GLB e quadro neutro no resto", () => {
    expect(formaDaMiniaturaDoModelo(MODELOS[0], undefined)).toBe("generica");
    expect(formaDaMiniaturaDoModelo(MODELOS[0], { schema: 1, model: { kind: "procedural-mug" } } as any)).toBe("caneca");
    expect(formaDaMiniaturaDoModelo(MODELOS[3], { schema: 1, model: { kind: "glb", url: "https://x/camiseta.glb" } } as any)).toBe("camiseta");
    expect(formaDaMiniaturaDoModelo({ kind: "model3d", key: "garrafa", name: "Garrafa" } as any, { schema: 1, model: { kind: "glb", url: "https://x/g.glb" } } as any)).toBe("generica");
    expect(formaDaMiniaturaDoModelo(MODELOS[4], { schema: 1, views: [{ id: "front", photo_url: "https://x/f.jpg" }] } as any)).toBe("foto");
  });

  it("abas da prévia e a linha de cada modelo", () => {
    const caneca: any = { schema: 1, areas: [{ id: "panel", width_cm: 9, height_cm: 8 }, { id: "wrap" }] };
    expect(abasDaPrevia(MODELOS[0], caneca).map((a) => a.rotulo)).toEqual(["Painel 9×8 cm", "Volta inteira"]);
    const foto: any = { schema: 1, views: [{ id: "front", label: "Frente" }, { id: "back", label: "Verso" }] };
    expect(abasDaPrevia(MODELOS[4], foto).map((a) => a.rotulo)).toEqual(["Frente", "Costas"]);
    expect(metaDoModelo(MODELOS[0], caneca)).toBe("Painel e volta inteira");
    expect(metaDoModelo(MODELOS[4], foto)).toBe("Foto de estúdio · frente e costas");
  });
});

// ═════════════════════════════════════════════════════════════
describe("seção montada", () => {
  it("lista com selos, contagem e o modelo atual no seletor fechado; sem busca com até 8 produtos", async () => {
    const r = await montar();
    expect(texto(um(r, "selo-p1"))).toBe("Vinculado · 3D");
    expect(texto(um(r, "selo-p4"))).toBe("Sem mockup");
    expect(texto(um(r, "selo-p5"))).toBe("Mockup na foto");
    expect(texto(um(r, "seletor-nome-p2"))).toBe("Caneca clássica 325 ml");
    expect(texto(um(r, "seletor-nome-p5"))).toBe("Mockup na foto");
    expect(texto(um(r, "contagem"))).toContain("3 de 5");
    expect(porTestID(r, "busca")).toHaveLength(0);
    // prévia no primeiro produto
    expect(texto(um(r, "previa"))).toBe("CANECA ALÇA CORAÇÃO | Caneca alça coração 355 ml");
  });

  it("abrir o seletor foca o produto; passar o mouse mostra o modelo antes de gravar; clique grava", async () => {
    const r = await montar();
    await act(async () => { um(r, "seletor-p2").props.onPress(); });
    expect(porTestID(r, "lista-de-modelos")).toHaveLength(1);
    expect(texto(um(r, "previa"))).toBe("CANECA BRANCA | Caneca clássica 325 ml");
    expect(um(r, "opcao-caneca-classica").props["aria-selected"]).toBe(true);

    await act(async () => { um(r, "opcao-caneca-chopp").props.onHoverIn(); });
    // a espera de 70 ms: ainda não trocou
    expect(texto(um(r, "previa"))).toBe("CANECA BRANCA | Caneca clássica 325 ml");
    await act(async () => { jest.advanceTimersByTime(80); });
    expect(texto(um(r, "previa"))).toBe("CANECA BRANCA | Caneca de chopp 475 ml | provisória");

    // sair da lista volta ao atual
    await act(async () => { um(r, "lista-de-modelos").props.onMouseLeave(); jest.advanceTimersByTime(130); });
    expect(texto(um(r, "previa"))).toBe("CANECA BRANCA | Caneca clássica 325 ml");

    let soltar!: (v: any) => void;
    mockGravar.mockReturnValue(new Promise((res) => { soltar = res; }));
    await act(async () => { um(r, "opcao-caneca-chopp").props.onPress(); });
    expect(mockGravar).toHaveBeenCalledWith("c1", "p2", "caneca-chopp");
    expect(porTestID(r, "lista-de-modelos")).toHaveLength(0);
    expect(texto(um(r, "seletor-meta-p2"))).toBe("Salvando…");
    expect(um(r, "seletor-p2").props.disabled).toBe(true);
    // só a linha que salva fica ocupada
    expect(um(r, "seletor-p1").props.disabled).toBe(false);

    await act(async () => { soltar({ ok: true }); });
    expect(texto(um(r, "salvo-p2"))).toBe("Modelo salvo");
    expect(texto(um(r, "seletor-nome-p2"))).toBe("Caneca de chopp 475 ml");
    expect(mockInvalidar).toHaveBeenCalledWith("c1", "p2");
    expect(texto(um(r, "anuncio"))).toBe("");
    await act(async () => { jest.advanceTimersByTime(40); });
    expect(texto(um(r, "anuncio"))).toBe("Modelo salvo para CANECA BRANCA");
    await act(async () => { jest.advanceTimersByTime(2600); });
    expect(porTestID(r, "salvo-p2")).toHaveLength(0);
  });

  it("falha: a escolha volta, a linha avisa e 'Tentar de novo' repete a mesma escolha", async () => {
    const r = await montar();
    mockGravar.mockRejectedValueOnce(new Error("rede"));
    await act(async () => { um(r, "seletor-p4").props.onPress(); });
    await act(async () => { um(r, "opcao-camiseta-frente-verso").props.onPress(); });
    await act(async () => { await Promise.resolve(); });
    expect(texto(um(r, "erro-p4"))).toContain("Não salvou, tente de novo.");
    expect(texto(um(r, "selo-p4"))).toBe("Sem mockup");
    expect(texto(um(r, "seletor-nome-p4"))).toBe("Sem mockup");

    mockGravar.mockResolvedValueOnce({ ok: true });
    await act(async () => { um(r, "tentar-p4").props.onPress(); });
    expect(mockGravar).toHaveBeenLastCalledWith("c1", "p4", "camiseta-frente-verso");
    expect(porTestID(r, "erro-p4")).toHaveLength(0);
    expect(texto(um(r, "selo-p4"))).toBe("Vinculado · 2D");
  });

  it("toque (tela de celular): tocar só troca a prévia; grava em 'Usar este modelo'", async () => {
    mockLargura = 390;
    const r = await montar();
    await act(async () => { um(r, "seletor-p1").props.onPress(); });
    expect(porTestID(r, "seletor-folha")).toHaveLength(1);
    expect(um(r, "seletor-usar").props.disabled).toBe(true);

    await act(async () => { um(r, "opcao-caneca-classica").props.onPress(); });
    expect(mockGravar).not.toHaveBeenCalled();
    expect(texto(um(r, "previa-folha"))).toBe("CANECA ALÇA CORAÇÃO | Caneca clássica 325 ml | provisória");
    expect(texto(um(r, "rodape-dica"))).toContain("Toque em Usar este modelo para gravar");

    mockGravar.mockResolvedValueOnce({ ok: true });
    await act(async () => { um(r, "seletor-usar").props.onPress(); });
    expect(mockGravar).toHaveBeenCalledWith("c1", "p1", "caneca-classica");
    expect(porTestID(r, "seletor-folha")).toHaveLength(0);
  });

  it("toque: Cancelar fecha sem gravar e a prévia volta ao atual", async () => {
    mockLargura = 390;
    const r = await montar();
    await act(async () => { um(r, "seletor-p1").props.onPress(); });
    await act(async () => { um(r, "opcao-nenhum").props.onPress(); });
    await act(async () => { um(r, "seletor-cancelar").props.onPress(); });
    expect(mockGravar).not.toHaveBeenCalled();
    expect(texto(um(r, "previa"))).toBe("CANECA ALÇA CORAÇÃO | Caneca alça coração 355 ml");
  });

  it("teclado: setas trocam a prévia, letras pulam, Esc fecha sem mudar, Enter grava", async () => {
    const r = await montar();
    const tecla = (key: string) => ({ key, preventDefault: jest.fn(), stopPropagation: jest.fn() });
    await act(async () => { um(r, "seletor-p2").props.onKeyDown(tecla("ArrowDown")); });
    expect(porTestID(r, "lista-de-modelos")).toHaveLength(1);
    await act(async () => { um(r, "lista-de-modelos").props.onKeyDown(tecla("ArrowDown")); });
    expect(texto(um(r, "previa"))).toBe("CANECA BRANCA | Caneca de chopp 475 ml | provisória");
    await act(async () => { um(r, "lista-de-modelos").props.onKeyDown(tecla("Escape")); });
    expect(porTestID(r, "lista-de-modelos")).toHaveLength(0);
    expect(texto(um(r, "previa"))).toBe("CANECA BRANCA | Caneca clássica 325 ml");
    expect(mockGravar).not.toHaveBeenCalled();

    mockGravar.mockResolvedValue({ ok: true });
    await act(async () => { um(r, "seletor-p2").props.onPress(); });
    await act(async () => { um(r, "lista-de-modelos").props.onKeyDown(tecla("b")); });
    expect(texto(um(r, "previa"))).toBe("CANECA BRANCA | Camiseta básica | provisória");
    await act(async () => { um(r, "lista-de-modelos").props.onKeyDown(tecla("Enter")); });
    expect(mockGravar).toHaveBeenCalledWith("c1", "p2", "camiseta-basica");
  });

  it("mais de 8 produtos: busca por nome e filtro por vínculo", async () => {
    const r = await montar([...PRODUTOS, ...MAIS]);
    expect(porTestID(r, "busca")).toHaveLength(1);
    expect(texto(um(r, "filtro-todos"))).toBe("Todos 10");
    expect(texto(um(r, "filtro-com"))).toBe("Com modelo 3");

    await act(async () => { um(r, "busca").props.onChangeText("polo"); });
    expect(porTestID(r, "linha-p5")).toHaveLength(1);
    expect(porTestID(r, "linha-p1")).toHaveLength(0);

    await act(async () => { um(r, "busca").props.onChangeText("xyz"); });
    expect(texto(um(r, "lista-vazia"))).toContain("Nenhum produto encontrado com “xyz”");

    await act(async () => { um(r, "busca").props.onChangeText(""); um(r, "filtro-com").props.onPress(); });
    const ids = r.root.findAll((n) => typeof n.type === "string" && /^linha-/.test(n.props.testID || "")).map((n) => n.props.testID);
    expect(ids).toEqual(["linha-p1", "linha-p2", "linha-p3"]);
  });

  it("nenhum modelo publicado: a mensagem da Aura, sem lista", async () => {
    const r = await montar(PRODUTOS, []);
    expect(texto(um(r, "mockup-vazio-titulo"))).toBe("Nenhum modelo publicado ainda. A Aura mantém esta lista.");
    expect(porTestID(r, "lista-de-produtos")).toHaveLength(0);
  });

  it("enquanto carrega: esqueleto, sem lista", async () => {
    mockRequest.mockReturnValue(new Promise(() => {}));
    mockListar.mockReturnValue(new Promise(() => {}));
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => { r = TestRenderer.create(<SecaoMockupPorProduto companyId="c1" />); });
    expect(porTestID(r, "mockup-carregando")).toHaveLength(1);
  });
});
