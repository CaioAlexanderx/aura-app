// ============================================================
// Mockup na foto — a seção no painel (StudioPersonalizacaoPanel)
//
// Monta o painel de verdade (API e motor em stub) e confere:
//   - a seção aparece com os textos do mockup aprovado;
//   - escolher outra foto e "Salvar posição" grava PELO SALVAMENTO DA
//     ABA (saveCustomizationConfig) com mockup_foto.front certo;
//   - sem fotos: o estado vazio; com modelo da Aura: o aviso;
//   - cantos cruzados: não deixa salvar.
// ============================================================
import React from "react";
import { render, screen, fireEvent, waitFor, configure, act } from "@testing-library/react-native";
import { Image } from "react-native";

// O Icon avisa em __DEV__ quando o painel pede um nome que não existe
// ("external-link", "share-2"); o jest não define a global.
(global as any).__DEV__ = false;

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return { __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"), Polygon: stub("Polygon") };
});
// StudioEmpty puxa o AuraStudioMark (reanimated); fora do assunto.
jest.mock("@/components/studio/StudioEmpty", () => ({ StudioEmpty: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/studio/visualEngine/EnginePreview", () => ({
  EnginePreview: () => null,
  invalidateProductTemplate: jest.fn(),
}));
jest.mock("@/components/studio/visualEngine/VisualTemplateThumb", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/studio/PreviewWhatsAppModal", () => ({ PreviewWhatsAppModal: () => null }));
jest.mock("@/components/studio/visualEngine/compose2d", () => ({
  ...jest.requireActual("@/components/studio/visualEngine/compose2d"),
  composeView: jest.fn(() => Promise.resolve()),
  blendDaVista: jest.fn(() => Promise.resolve({ modo: "multiply", alfa: 1 })),
}));

const mockGet = jest.fn();
const mockSave = jest.fn();
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    getCustomizationConfig: (...a: any[]) => mockGet(...a),
    saveCustomizationConfig: (...a: any[]) => mockSave(...a),
    togglePersonalizable: jest.fn(),
    suggestTemplates: jest.fn(),
  },
}));
const mockVinculo = jest.fn();
jest.mock("@/services/studioVisualApi", () => ({
  studioVisualApi: {
    getProductVisualTemplate: (...a: any[]) => mockVinculo(...a),
    listVisualTemplates: () => Promise.resolve({ templates: [], count: 0 }),
    setProductVisualTemplate: jest.fn(),
  },
}));

import { StudioPersonalizacaoPanel } from "@/components/studio/StudioPersonalizacaoPanel";

const AJUDA = "Marque na foto onde a arte cai. O cliente vê a arte dele exatamente aí, com a luz e as dobras da sua foto.";
const FOTO1 = "https://r2.example/camiseta-frente.jpg";
const FOTO2 = "https://r2.example/camiseta-lado.jpg";
const QUAD_GRAVADO = [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.6 }, { x: 0.3, y: 0.6 }];

function configBase(extra: Record<string, any> = {}) {
  return {
    print_area: { width_cm: 28, height_cm: 32, position: "center" },
    fields: [{ id: "text", type: "text", label: "Nome", required: false, side: "front", config: { max_chars: 20 } }],
    ...extra,
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockSave.mockReset();
  mockVinculo.mockReset();
  mockVinculo.mockResolvedValue({ product_id: "p1", visual_template_key: null, template: null });
  mockSave.mockImplementation((_c: string, _p: string, cfg: any) => Promise.resolve({ product_id: "p1", name: "x", is_personalizable: true, config: cfg }));
  // A foto 900×1100 (o jsdom não carrega imagem).
  jest.spyOn(Image, "getSize").mockImplementation(((_u: string, ok: (w: number, h: number) => void) => ok(900, 1100)) as any);
});
afterEach(() => { (Image.getSize as any).mockRestore?.(); });

async function montar(cfg: any, fotos = [FOTO1, FOTO2]) {
  mockGet.mockResolvedValue({ product_id: "p1", name: "Camiseta", is_personalizable: true, config: cfg });
  render(
    <StudioPersonalizacaoPanel productId="p1" companyId="c1" productName="Camiseta" productPrice={59.9} slug="aura-qa" fotos={fotos} />
  );
  await screen.findByText(AJUDA);
}

it("mostra a seção com os textos aprovados e, marcada, 'Posição salva'", async () => {
  await montar(configBase({ mockup_foto: { front: { photo_url: FOTO1, quad: QUAD_GRAVADO, shading: 0.6, w: 900, h: 1100 } } }));
  expect(screen.getByText("Posição salva")).toBeTruthy();
  expect(screen.getByText("Posição salva. A vitrine já mostra a arte do cliente nesta foto.")).toBeTruthy();
  expect(screen.getByLabelText("Ver a peça como cliente, na vitrine")).toBeTruthy();
});

it("escolher outra foto e salvar grava mockup_foto pelo salvamento da aba", async () => {
  await montar(configBase({ mockup_foto: { front: { photo_url: FOTO1, quad: QUAD_GRAVADO, shading: 0.6, w: 900, h: 1100 } } }));
  await act(async () => { fireEvent.press(screen.getByLabelText("Usar a foto 2")); });
  await waitFor(() => expect(screen.getByLabelText("Salvar posição")).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByLabelText("Salvar posição")); });
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  const [cid, pid, cfg] = mockSave.mock.calls[0];
  expect([cid, pid]).toEqual(["c1", "p1"]);
  const frente = cfg.mockup_foto.front;
  expect(frente.photo_url).toBe(FOTO2);
  expect(frente.w).toBe(900);
  expect(frente.h).toBe(1100);
  expect(frente.shading).toBe(0.6);
  expect(frente.quad).toHaveLength(4);
  frente.quad.forEach((p: any) => {
    expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1);
    expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(1);
  });
  // Proporção da área cadastrada (28×32 cm) na foto
  const wPx = (frente.quad[1].x - frente.quad[0].x) * 900;
  const hPx = (frente.quad[3].y - frente.quad[0].y) * 1100;
  expect(hPx / wPx).toBeCloseTo(32 / 28, 1);
  // O resto da config atravessa normalizado (mesmo caminho do "Salvar configuração")
  expect(cfg.fields[0].id).toBe("text");
  expect(cfg.print_area).toEqual({ width_cm: 28, height_cm: 32, position: "center" });
  await waitFor(() => expect(screen.getByText("Posição salva")).toBeTruthy());
});

it("primeira marcação: estado vazio, depois foto e salvar", async () => {
  await montar(configBase());
  expect(screen.getByText("Escolha uma foto da peça para começar")).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText("Usar a foto 1")); });
  await act(async () => { fireEvent.press(screen.getByLabelText("Salvar posição")); });
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  expect(mockSave.mock.calls[0][2].mockup_foto).toEqual({
    front: expect.objectContaining({ photo_url: FOTO1, shading: 0.6, w: 900, h: 1100 }),
  });
});

it("produto sem fotos: o estado vazio da aba Dados", async () => {
  await montar(configBase(), []);
  expect(screen.getByText("Este produto ainda não tem foto")).toBeTruthy();
  expect(screen.queryByLabelText("Salvar posição")).toBeNull();
});

it("com modelo da Aura vinculado: o aviso de precedência", async () => {
  mockVinculo.mockResolvedValue({ product_id: "p1", visual_template_key: "caneca-3d", template: null });
  await montar(configBase());
  await screen.findByText(/usa um modelo da Aura \(3D ou foto de estúdio\), e é ele que a vitrine mostra/);
});

it("cantos cruzados não deixam salvar", async () => {
  const cruzado = [QUAD_GRAVADO[0], QUAD_GRAVADO[2], QUAD_GRAVADO[1], QUAD_GRAVADO[3]];
  await montar(configBase({ mockup_foto: { front: { photo_url: FOTO1, quad: cruzado, shading: 0.6, w: 900, h: 1100 } } }));
  expect(screen.getByText("Os cantos se cruzaram. Arraste até formar um quadrilátero, cada canto no seu lado.")).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText("Salvar posição")); });
  expect(mockSave).not.toHaveBeenCalled();
});

// ── QA rodada 2 (28/09/2026): "Remover marcação" e nota de cor ──────────
it("'Remover marcação' só aparece com algo salvo, e grava mockup_foto sem o lado", async () => {
  await montar(configBase({ mockup_foto: { front: { photo_url: FOTO1, quad: QUAD_GRAVADO, shading: 0.6, w: 900, h: 1100 } } }));
  expect(screen.getByLabelText("Remover marcação")).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText("Remover marcação")); });
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  expect(mockSave.mock.calls[0][2].mockup_foto).toEqual({});
  // Depois de remover, volta ao estado vazio (sem foto marcada pro lado).
  await waitFor(() => expect(screen.getByText("Escolha uma foto da peça para começar")).toBeTruthy());
});

it("sem nada salvo, não tem 'Remover marcação'", async () => {
  await montar(configBase());
  expect(screen.queryByLabelText("Remover marcação")).toBeNull();
});

it("produto com campo de cor: nota de que a foto está na cor fotografada", async () => {
  await montar(configBase({
    fields: [{ id: "color", type: "color", label: "Cor", required: false, side: "front", config: { colors: ["#000", "#FFF"] } }],
    mockup_foto: { front: { photo_url: FOTO1, quad: QUAD_GRAVADO, shading: 0.6, w: 900, h: 1100 } },
  }));
  expect(screen.getByText("A foto mostra a peça na cor fotografada; a cor escolhida pela cliente vai na produção.")).toBeTruthy();
});

it("produto sem campo de cor: sem a nota", async () => {
  await montar(configBase({ mockup_foto: { front: { photo_url: FOTO1, quad: QUAD_GRAVADO, shading: 0.6, w: 900, h: 1100 } } }));
  expect(screen.queryByText(/cor fotografada/)).toBeNull();
});

it("abas só para os lados ligados", async () => {
  await montar(configBase({ has_back: true, back_print_area: { width_cm: 30, height_cm: 40, position: "center" } }));
  expect(screen.getByLabelText("Frente")).toBeTruthy();
  expect(screen.getByLabelText("Verso")).toBeTruthy();
  expect(screen.queryByLabelText("Meio")).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText("Verso")); });
  expect(screen.getByText("Foto do verso")).toBeTruthy();
});
