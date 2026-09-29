// ============================================================
// AURA Studio — 28/09/2026: retrato do modelo para as miniaturas
//
// A miniatura da ficha e da Aparência passa a ser uma foto do visualizador
// 3D atual. Guardado aqui: um retrato por vez (um contexto WebGL só), o
// viewer descartado depois, o cache por key@versão (memória e
// localStorage), a foto de estúdio no 2D e o null quando o 3D falha.
// ============================================================
let mockAbertos = 0;
let mockMaxAbertos = 0;
const mockCriar = jest.fn();
const mockTrocar = jest.fn();
jest.mock("@/components/studio/visualEngine/compose3dMug", () => ({
  createModelViewer: (...a: any[]) => mockCriar(...a),
}));
const mockCompose = jest.fn((..._a: any[]) => Promise.resolve({ luzDaFoto: "sem-foto" }));
jest.mock("@/components/studio/visualEngine/compose2d", () => ({
  composeView: (...a: any[]) => mockCompose(...a),
}));

import {
  chaveDoRetrato, pedirRetrato, retratoPronto, limparRetratos, specDoRetrato, LARGURA_DO_RETRATO, ALTURA_DO_RETRATO,
  caixaPorAlfa, conferirEnquadramento,
} from "@/components/studio/mockupPorProduto/retratoDoModelo";

const caneca: any = { schema: 1, model: { kind: "procedural-mug", texture: { w: 2048, h: 1024 } }, areas: [] };
const camiseta: any = { schema: 1, model: { kind: "glb", url: "https://x/camiseta.glb" }, areas: [] };

beforeAll(() => {
  // jsdom não desenha: o canvas 2D é um dublê que devolve um JPEG.
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: any, tipo: string) {
    if (tipo !== "2d") return null as any;
    const cv = this;
    return {
      fillRect: () => {}, drawImage: () => {}, set fillStyle(_v: string) {},
      set globalCompositeOperation(_v: string) {}, set imageSmoothingQuality(_v: string) {},
      getImageData: () => ({ data: new Uint8ClampedArray((cv.width || 1) * (cv.height || 1) * 4) }),
    } as any;
  });
  jest.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => "data:image/jpeg;base64,AAA");
});

beforeEach(() => {
  limparRetratos();
  localStorage.clear();
  mockAbertos = 0; mockMaxAbertos = 0;
  mockCriar.mockReset();
  mockCriar.mockImplementation(async (cv: HTMLCanvasElement, _spec: any, _v: any, opts: any) => {
    mockAbertos++; mockMaxAbertos = Math.max(mockMaxAbertos, mockAbertos);
    expect(opts).toMatchObject({ cenario: "nenhum", pixelRatio: 1, retrato: { margem: 0.22 } });
    expect(cv.width).toBe(LARGURA_DO_RETRATO * 2);
    expect(cv.height).toBe(ALTURA_DO_RETRATO * 2);
    expect(ALTURA_DO_RETRATO / LARGURA_DO_RETRATO).toBeCloseTo(67 / 88, 2);
    await new Promise((r) => setTimeout(r, 5));
    return {
      giroAutomatico: jest.fn(),
      resize: jest.fn(),
      trocarPeca: (...a: any[]) => mockTrocar(...a),
      snapshot: () => "data:image/png;base64,PNG",
      dispose: () => { mockAbertos--; },
    };
  });
  mockCompose.mockClear();
  mockTrocar.mockReset();
  mockTrocar.mockImplementation(async (_spec: any, _v: any, opts: any) => {
    expect(opts).toMatchObject({ cenario: "nenhum", pixelRatio: 1 });
  });
});

describe("retrato do modelo", () => {
  it("chave por key@versão", () => {
    expect(chaveDoRetrato({ key: "caneca", version: 3 })).toMatch(/caneca@3$/);
    expect(chaveDoRetrato({ key: "caneca", version: 3 })).not.toBe(chaveDoRetrato({ key: "caneca", version: 4 }));
  });

  it("textura pequena no retrato, sem mexer na spec original", () => {
    const r: any = specDoRetrato(camiseta);
    expect(r.model.texture).toEqual({ w: 512, h: 256 });
    expect(camiseta.model.texture).toBeUndefined();
    expect((specDoRetrato(caneca) as any).model.texture).toEqual({ w: 512, h: 256 });
  });

  it("um viewer só para a fila (peças por trocarPeca), descartado no fim, JPEG guardado", async () => {
    const [a, b] = await Promise.all([
      pedirRetrato({ key: "caneca", version: 1, kind: "model3d" }, caneca),
      pedirRetrato({ key: "camiseta", version: 1, kind: "model3d" }, camiseta),
    ]);
    expect(a).toBe("data:image/jpeg;base64,AAA");
    expect(b).toBe("data:image/jpeg;base64,AAA");
    expect(mockCriar).toHaveBeenCalledTimes(1);
    expect(mockTrocar).toHaveBeenCalledTimes(1);
    expect(mockTrocar.mock.calls[0][0].model.kind).toBe("glb");
    expect(mockMaxAbertos).toBe(1);
    expect(mockAbertos).toBe(0);
    // guardado: o mesmo pedido não abre outro viewer, nem depois de esquecer a memória
    limparRetratos();
    expect(retratoPronto({ key: "caneca", version: 1 })).toBe("data:image/jpeg;base64,AAA");
    await pedirRetrato({ key: "caneca", version: 1, kind: "model3d" }, caneca);
    expect(mockCriar).toHaveBeenCalledTimes(1);
  });

  it("versão antiga da chave sai do localStorage", () => {
    localStorage.setItem("aura:studio:retrato:r1/caneca@1", "data:image/jpeg;base64,VELHO");
    expect(retratoPronto({ key: "caneca", version: 1 })).toBeUndefined();
    expect(localStorage.getItem("aura:studio:retrato:r1/caneca@1")).toBeNull();
  });

  it("3D que falha (sem WebGL) dá null e não guarda nada", async () => {
    mockCriar.mockImplementationOnce(async () => { throw new Error("sem WebGL"); });
    const r = await pedirRetrato({ key: "garrafa", version: 1, kind: "model3d" }, camiseta);
    expect(r).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("GLB sem URL utilizável não vira retrato de caneca", async () => {
    const r = await pedirRetrato({ key: "camiseta-sem-url", version: 1, kind: "model3d" },
      { schema: 1, model: { kind: "glb", url: "/models/camiseta.glb" } } as any);
    expect(r).toBeNull();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it("2D com foto de estúdio usa a própria foto; sem foto, o composeView", async () => {
    const foto = await pedirRetrato({ key: "foto", version: 1, kind: "photo2d" },
      { schema: 1, views: [{ id: "front", photo_url: "https://x/f.jpg" }] } as any);
    expect(foto).toBe("https://x/f.jpg");
    expect(mockCompose).not.toHaveBeenCalled();
    const vetor = await pedirRetrato({ key: "vetor", version: 1, kind: "photo2d" },
      { schema: 1, views: [{ id: "front", base: { w: 1000, h: 1000 }, garment: { shape: "tshirt" } }] } as any);
    expect(vetor).toBe("data:image/jpeg;base64,AAA");
    expect(mockCompose).toHaveBeenCalledTimes(1);
  });

  it("conferência pelo resultado: caixa do alfa, margem ≥ 8% e centro a < 5% do meio", () => {
    const w = 176, h = 134;
    const imagem = (x0: number, y0: number, x1: number, y1: number) => {
      const d = new Uint8ClampedArray(w * h * 4);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d[(y * w + x) * 4 + 3] = 255;
      return d;
    };
    // Os números medidos nos retratos de verdade (caneca, xícara, camiseta).
    for (const [x0, y0, x1, y1] of [[36, 14, 139, 120], [18, 25, 157, 109], [37, 14, 138, 120]]) {
      const c = caixaPorAlfa(imagem(x0, y0, x1, y1), w, h)!;
      expect(c).toEqual({ x0, y0, x1, y1 });
      expect(conferirEnquadramento(c, w, h).ok).toBe(true);
    }
    // Encostada no topo, ou deslocada para a esquerda: reprova.
    expect(conferirEnquadramento(caixaPorAlfa(imagem(40, 0, 136, 110), w, h)!, w, h).ok).toBe(false);
    expect(conferirEnquadramento(caixaPorAlfa(imagem(15, 14, 120, 120), w, h)!, w, h).ok).toBe(false);
    expect(caixaPorAlfa(new Uint8ClampedArray(w * h * 4), w, h)).toBeNull();
  });
});
