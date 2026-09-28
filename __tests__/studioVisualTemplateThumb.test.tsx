// ============================================================
// AURA Studio — 27/09/2026: a miniatura do template visual
//
// VisualTemplateThumb desenhava uma caneca para todo `model3d`; a camiseta
// em GLB aparecia como caneca na lista de mockups. Com a spec em mãos, a
// peça em GLB ganha a camiseta neutra 2D (a silhueta do compose2d). Aqui:
// a regra pura (formaDaMiniatura) e a montagem — a camiseta passa pelo
// composeView com a vista da camiseta vetorial; a caneca não.
// ============================================================
import React from "react";
import { act, create } from "react-test-renderer";

const mockComposeView = jest.fn((..._args: any[]) => Promise.resolve());
jest.mock("@/components/studio/visualEngine/compose2d", () => ({
  composeView: (...args: any[]) => mockComposeView(...args),
}));

import VisualTemplateThumb, { formaDaMiniatura } from "@/components/studio/visualEngine/VisualTemplateThumb";

const specGlb: any = { schema: 1, model: { kind: "glb", url: "https://app.getaura.com.br/models/camiseta-basica.glb", texture: { w: 2048, h: 2048 } }, areas: [] };
const specCaneca: any = { schema: 1, model: { kind: "procedural-mug", texture: { w: 2048, h: 1024 } }, areas: [] };

describe("formaDaMiniatura — caneca × camiseta", () => {
  it("photo2d é sempre a camiseta; sem kind, nada", () => {
    expect(formaDaMiniatura("photo2d")).toBe("camiseta");
    expect(formaDaMiniatura("photo2d", specGlb)).toBe("camiseta");
    expect(formaDaMiniatura(null)).toBeNull();
    expect(formaDaMiniatura(undefined, specGlb)).toBeNull();
  });

  it("model3d é caneca — salvo quando a spec diz que a peça é um GLB", () => {
    expect(formaDaMiniatura("model3d")).toBe("caneca");
    expect(formaDaMiniatura("model3d", null)).toBe("caneca");
    expect(formaDaMiniatura("model3d", specCaneca)).toBe("caneca");
    expect(formaDaMiniatura("model3d", specGlb)).toBe("camiseta");
    // spec sem model (lista que só traz kind) continua caneca: não inventa camiseta
    expect(formaDaMiniatura("model3d", { schema: 1 } as any)).toBe("caneca");
  });
});

describe("VisualTemplateThumb — o GLB desenha a camiseta neutra", () => {
  // O jsdom não implementa canvas 2D e avisa no console a cada getContext;
  // a caneca sai cedo com contexto null, que é o que interessa aqui.
  beforeAll(() => { (HTMLCanvasElement.prototype as any).getContext = () => null; });
  beforeEach(() => mockComposeView.mockClear());

  // Uma ref de canvas real: o react-test-renderer não cria nós DOM, então
  // o efeito precisa receber o canvas por createNodeMock.
  const montar = (props: any) => {
    let arvore: any;
    act(() => {
      arvore = create(<VisualTemplateThumb {...props} />, {
        createNodeMock: () => document.createElement("canvas"),
      });
    });
    return arvore;
  };

  it("com spec de GLB, a camiseta passa pelo composeView com a vista vetorial da frente", () => {
    montar({ kind: "model3d", spec: specGlb, size: 88 });
    expect(mockComposeView).toHaveBeenCalledTimes(1);
    const [canvas, view, values, opcoes] = mockComposeView.mock.calls[0] as any[];
    expect(canvas.tagName).toBe("CANVAS");
    expect(view.id).toBe("front");
    expect(view.garment).toEqual({ shape: "tshirt" });
    expect(values).toEqual({});
    expect(opcoes).toMatchObject({ showAreas: true, pixelWidth: 176 });
  });

  it("a caneca procedural continua não passando pelo composeView", () => {
    montar({ kind: "model3d", spec: specCaneca, size: 88 });
    expect(mockComposeView).not.toHaveBeenCalled();
    montar({ kind: "model3d", size: 88 });
    expect(mockComposeView).not.toHaveBeenCalled();
  });

  it("photo2d segue como antes: camiseta", () => {
    montar({ kind: "photo2d", size: 48 });
    expect(mockComposeView).toHaveBeenCalledTimes(1);
    expect((mockComposeView.mock.calls[0] as any[])[3]).toMatchObject({ pixelWidth: 96 });
  });

  it("sem kind não monta canvas", () => {
    const arvore = montar({ kind: null });
    expect(arvore.toJSON()).toBeNull();
  });
});
