// ============================================================
// Mockup na foto — as regras da ferramenta do painel
//
// Quais fotos a lojista pode marcar, onde o quadrilátero nasce, como a
// alça se move (e não sai da foto), quando dá para salvar (cantos
// cruzados não) e o que exatamente vai para mockup_foto.
// ============================================================
import {
  AREA_MINIMA_DO_QUAD,
  PASSO_DO_TECLADO,
  PASSO_GRANDE_DO_TECLADO,
  cantoEm,
  configComLado,
  fotosDoProduto,
  ladoParaGravar,
  mesmaMarcacao,
  moverCanto,
  passoDaTecla,
  quadDaFotoValido,
  quadInicial,
  rascunhoDoGravado,
} from "@/components/studio/visualEngine/marcacaoDaFoto";
import { specDaFotoDoProduto, vistaDaMarcacao } from "@/components/studio/visualEngine/specDaFotoDoProduto";
import { normalizeCustomizationConfig } from "@/components/studio/customizationConfig";

const Q = [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.6 }, { x: 0.3, y: 0.6 }] as any;

describe("fotos do produto", () => {
  it("capa + galeria, sem repetir e sem vazios", () => {
    expect(fotosDoProduto("a.jpg", ["a.jpg", "b.jpg", "", null, " c.jpg ", "b.jpg"])).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(fotosDoProduto(null, undefined)).toEqual([]);
    expect(fotosDoProduto(null, ["x.jpg"])).toEqual(["x.jpg"]);
  });
});

describe("quad inicial", () => {
  it("tem a proporção da área em cm na foto, não na tela", () => {
    // Foto 900×1100, área 28×32 cm: em px, h/w do quad = 32/28.
    const q = quadInicial("front", { w: 900, h: 1100 }, { width_cm: 28, height_cm: 32 });
    const wPx = (q[1].x - q[0].x) * 900;
    const hPx = (q[3].y - q[0].y) * 1100;
    expect(hPx / wPx).toBeCloseTo(32 / 28, 2);
    expect(quadDaFotoValido(q)).toBe(true);
    // Centrado na horizontal
    expect(q[0].x + q[1].x).toBeCloseTo(1, 3);
  });
  it("área muito alta cabe na foto (altura limitada)", () => {
    const q = quadInicial("back", { w: 1000, h: 500 }, { width_cm: 10, height_cm: 40 });
    expect(q[3].y).toBeLessThanOrEqual(0.95 + 1e-9);
    expect(q[3].y - q[0].y).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(quadDaFotoValido(q)).toBe(true);
  });
});

describe("arraste e teclado", () => {
  it("move só o canto pedido e não deixa sair da foto", () => {
    const q = moverCanto(Q, 2, 0.5, 0.5);
    expect(q[2]).toEqual({ x: 1, y: 1 });
    expect(q[0]).toEqual(Q[0]);
    expect(Q[2]).toEqual({ x: 0.7, y: 0.6 }); // o original não muda
    expect(cantoEm(Q, 0, { x: -3, y: 0.1 })[0]).toEqual({ x: 0, y: 0.1 });
  });
  it("setas movem o passo; Shift, o passo grande; outra tecla, nada", () => {
    expect(passoDaTecla("ArrowRight", false)).toEqual({ dx: PASSO_DO_TECLADO, dy: 0 });
    expect(passoDaTecla("ArrowUp", true)).toEqual({ dx: 0, dy: -PASSO_GRANDE_DO_TECLADO });
    expect(passoDaTecla("Enter", false)).toBeNull();
  });
});

describe("validação: cantos cruzados não salvam", () => {
  it("quad convexo vale", () => expect(quadDaFotoValido(Q)).toBe(true));
  it("cantos cruzados (gravata) não valem", () => {
    expect(quadDaFotoValido([Q[0], Q[2], Q[1], Q[3]])).toBe(false);
  });
  it("um canto arrastado para o outro lado não vale", () => {
    expect(quadDaFotoValido(cantoEm(Q, 0, { x: 0.8, y: 0.7 }))).toBe(false);
  });
  it("fora da foto, NaN ou área mínima não valem", () => {
    expect(quadDaFotoValido([{ x: -0.1, y: 0.3 }, Q[1], Q[2], Q[3]])).toBe(false);
    expect(quadDaFotoValido([{ x: NaN, y: 0.3 }, Q[1], Q[2], Q[3]])).toBe(false);
    const d = Math.sqrt(AREA_MINIMA_DO_QUAD) / 2;
    expect(quadDaFotoValido([{ x: 0.5, y: 0.5 }, { x: 0.5 + d, y: 0.5 }, { x: 0.5 + d, y: 0.5 + d }, { x: 0.5, y: 0.5 + d }])).toBe(false);
    expect(quadDaFotoValido(null)).toBe(false);
  });
});

describe("o que se grava", () => {
  it("quad com 4 casas, força 0..1, w/h inteiros", () => {
    const g = ladoParaGravar({
      photo_url: "https://r2/f.jpg",
      quad: [{ x: 0.300004, y: 0.3 }, { x: 0.7, y: 0.30006 }, { x: 0.7, y: 0.6 }, { x: 0.3, y: 0.6 }] as any,
      forca: 0.6, w: 900.4, h: 1100,
    });
    expect(g).toEqual({
      photo_url: "https://r2/f.jpg",
      quad: [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3001 }, { x: 0.7, y: 0.6 }, { x: 0.3, y: 0.6 }],
      shading: 0.6, w: 900, h: 1100,
    });
  });
  it("sem foto ou com cantos cruzados, nada a gravar", () => {
    expect(ladoParaGravar({ photo_url: null, quad: Q, forca: 0.6, w: 1, h: 1 })).toBeNull();
    expect(ladoParaGravar({ photo_url: "u", quad: [Q[0], Q[2], Q[1], Q[3]] as any, forca: 0.6, w: 1, h: 1 })).toBeNull();
  });
  it("sem medida da foto, grava sem w/h (a vitrine mede)", () => {
    const g = ladoParaGravar({ photo_url: "u", quad: Q, forca: 0, w: null, h: null })!;
    expect(g.w).toBeUndefined();
    expect(g.shading).toBe(0);
  });
  it("ida e volta: o gravado vira rascunho igual", () => {
    const g = ladoParaGravar({ photo_url: "u", quad: Q, forca: 0.35, w: 800, h: 1000 })!;
    const r = rascunhoDoGravado(g);
    expect(mesmaMarcacao(ladoParaGravar(r), g)).toBe(true);
    expect(rascunhoDoGravado(null)).toMatchObject({ photo_url: null, quad: null, forca: 0.6 });
  });
  it("configComLado troca só o lado salvo e passa pela normalização", () => {
    const frente = ladoParaGravar({ photo_url: "f", quad: Q, forca: 0.6, w: 900, h: 1100 })!;
    const verso = ladoParaGravar({ photo_url: "v", quad: Q, forca: 0.2, w: 900, h: 1100 })!;
    const base: any = {
      print_area: { width_cm: 28, height_cm: 32, position: "center" },
      has_back: true, back_print_area: { width_cm: 30, height_cm: 40, position: "center" },
      fields: [{ id: "text", type: "text", label: "Nome", required: false, side: "front", config: {} }],
      mockup_foto: { front: frente },
    };
    const cfg = normalizeCustomizationConfig(configComLado(base, "back", verso));
    expect((cfg as any).mockup_foto).toEqual({ front: frente, back: verso });
    // E a vitrine monta a spec com os dois lados
    expect(specDaFotoDoProduto(cfg)!.views!.map((v) => v.id)).toEqual(["front", "back"]);
  });
  it("vistaDaMarcacao: a prévia do painel usa a mesma vista da vitrine", () => {
    const v = vistaDaMarcacao("back", { photo_url: "v", quad: Q, shading: 0.2 }, { w: 900, h: 1100 }, { width_cm: 30, height_cm: 40 })!;
    expect(v.id).toBe("back");
    expect(v.shading_from_photo).toEqual({ strength: 0.2 });
    expect(v.areas[0].quad![1].x).toBeCloseTo(630, 9);
  });
});
