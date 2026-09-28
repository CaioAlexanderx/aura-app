// ============================================================
// Mockup na foto real da peça — quem o LivePreview da vitrine desenha
//
// Monta o LivePreview de verdade (só o motor e o SVG em stub) e confere
// a precedência na tela: template do banco > mockup na foto > SVG, e
// que as miniaturas da sacola/checkout (sem slug/productId) desenham a
// mesma foto marcada, pelo mesmo composeView.
// ============================================================
import React from "react";
import { render, waitFor, configure } from "@testing-library/react-native";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return { __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path") };
});
const mockCompose = jest.fn((..._a: any[]) => Promise.resolve());
jest.mock("@/components/studio/visualEngine/compose2d", () => ({
  ...jest.requireActual("@/components/studio/visualEngine/compose2d"),
  composeView: (...a: any[]) => mockCompose(...a),
}));
const mockBuscarTemplate = jest.fn();
jest.mock("@/components/studio/storefront/visualTemplatePublic", () => ({
  fetchStorefrontVisualTemplate: (...a: any[]) => mockBuscarTemplate(...a),
}));
jest.mock("@/components/studio/visualEngine/Mug3DPreview", () => ({ Mug3DPreview: () => null }));
jest.mock("@/components/studio/PersonalizationPreview", () => {
  const R = require("react");
  return { PersonalizationPreviewBase: () => R.createElement("div", { "data-testid": "svg" }, "svg") };
});

import { LivePreview } from "@/components/studio/storefront/LivePreview";

const QUAD_N = [{ x: 0.3, y: 0.25 }, { x: 0.7, y: 0.26 }, { x: 0.68, y: 0.62 }, { x: 0.32, y: 0.6 }];
const CFG: any = {
  print_area: { width_cm: 28, height_cm: 32, position: "center" },
  fields: [{ id: "text", type: "text", label: "Nome", required: false, side: "front", config: {} }],
  mockup_foto: { front: { photo_url: "https://r2/frente.jpg", quad: QUAD_N, w: 1000, h: 1250, shading: 0.5 } },
};
const BANCO = {
  key: "camiseta-estudio", name: "Camiseta", kind: "photo2d", version: 2,
  spec: { schema: 1, views: [{ id: "front", label: "Frente", base: { w: 1000, h: 1000 }, photo_url: "https://r2/estudio.jpg", areas: [] }] },
};

// O test renderer não tem DOM: o ref do <canvas> precisa de um nó.
const comCanvas = { createNodeMock: () => ({ width: 0, height: 0 }) };

function vistaDesenhada() {
  const ultima = mockCompose.mock.calls[mockCompose.mock.calls.length - 1];
  return ultima ? ultima[1] : null;
}

beforeEach(() => {
  mockCompose.mockClear();
  mockBuscarTemplate.mockReset();
});

it("miniatura da sacola (sem slug): desenha a foto marcada pelo composeView", async () => {
  render(<LivePreview config={CFG} values={{ text: "Ana" }} size={56} productName="Camiseta" showLabel={false} />, comCanvas);
  await waitFor(() => expect(mockCompose).toHaveBeenCalled());
  const v = vistaDesenhada();
  expect(v.photo_url).toBe("https://r2/frente.jpg");
  expect(v.areas[0].quad).toHaveLength(4);
  expect(v.shading_from_photo).toEqual({ strength: 0.5 });
  expect(mockBuscarTemplate).not.toHaveBeenCalled();
});

it("página do produto sem template no banco: a foto marcada", async () => {
  mockBuscarTemplate.mockResolvedValue(null);
  render(<LivePreview config={CFG} values={{ text: "Ana" }} size={300} productName="Camiseta" showLabel={false} slug="aura-qa" productId="p1" />, comCanvas);
  await waitFor(() => expect(mockCompose).toHaveBeenCalled());
  expect(vistaDesenhada().photo_url).toBe("https://r2/frente.jpg");
});

it("template do banco vinculado manda sobre a foto marcada", async () => {
  mockBuscarTemplate.mockResolvedValue(BANCO);
  render(<LivePreview config={CFG} values={{ text: "Ana" }} size={300} productName="Camiseta" showLabel={false} slug="aura-qa" productId="p1" />, comCanvas);
  await waitFor(() => expect(mockCompose).toHaveBeenCalled());
  expect(mockCompose.mock.calls.every((c) => c[1].photo_url === "https://r2/estudio.jpg")).toBe(true);
});

it("sem template e sem foto marcada: o SVG de sempre", async () => {
  mockBuscarTemplate.mockResolvedValue(null);
  const { mockup_foto: _fora, ...semFoto } = CFG;
  const tela = render(<LivePreview config={semFoto} values={{ text: "Ana" }} size={300} productName="Camiseta" showLabel={false} slug="aura-qa" productId="p1" />, comCanvas);
  await waitFor(() => expect(mockBuscarTemplate).toHaveBeenCalled());
  expect(tela.toJSON()).toBeTruthy();
  expect(JSON.stringify(tela.toJSON())).toContain("svg");
  expect(mockCompose).not.toHaveBeenCalled();
});
