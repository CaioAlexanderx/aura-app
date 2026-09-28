// Formatação da arte (28/09/2026): a área do produto dentro da área do
// motor, o ponteiro de volta (3D, 2D e quad da foto), o arquivo de
// impressão e o que a ficha de produção mostra.
import { subAreaNoRetangulo, pontoNaAreaDaArte } from "@/components/studio/visualEngine/layoutDaArte";
import { inversoNoQuad, pontoNaAreaDaVista } from "@/components/studio/visualEngine/pontoNaVista";
import { aplicarHomografia, homografiaDoQuadradoUnitario } from "@/components/studio/visualEngine/compose2d";
import { pixelsDaArea } from "@/components/studio/visualEngine/pngDeImpressao";
import { rotuloDaChave, valorDaChave, textoDoAjuste } from "@/components/studio/customizationConfig";

describe("área do produto no motor", () => {
  const rect = { x: 100, y: 50, w: 400, h: 200 };

  test("2D: escala física e encolhe para caber, centralizada", () => {
    // 10 × 5 cm no painel de 20 × 10 cm: metade, no meio
    expect(subAreaNoRetangulo(rect, { w: 10, h: 5 }, { w: 20, h: 10 })).toEqual({ x: 200, y: 100, w: 200, h: 100 });
    // 40 × 5 cm não cabe: encolhe mantendo a proporção
    const r = subAreaNoRetangulo(rect, { w: 40, h: 5 }, { w: 20, h: 10 });
    expect(r.w).toBeCloseTo(400);
    expect(r.h).toBeCloseTo(50);
  });

  test("3D: pode passar do retângulo (a textura continua em volta)", () => {
    expect(subAreaNoRetangulo(rect, { w: 40, h: 5 }, { w: 20, h: 10 }, false).w).toBeCloseTo(800);
  });

  test("caneca: pixel não quadrado — a escala vem da altura e a largura segue a peça", () => {
    // 10 cm de altura no motor = 200 px → 20 px/cm na vertical; pixel 0,5 → 10 px/cm na horizontal
    const r = subAreaNoRetangulo(rect, { w: 8, h: 8 }, { w: 999, h: 10 }, false, 0.5);
    expect(r.w).toBeCloseTo(80);
    expect(r.h).toBeCloseTo(160);
  });

  test("o ponteiro volta pelo mesmo caminho do pintor", () => {
    // área 10 × 5 no meio do painel 20 × 10 (aspecto 0,5): u = 0,5 é o centro
    const p = pontoNaAreaDaArte(0.5, 0.5, { areaCm: { w: 10, h: 5 } }, { w: 20, h: 10 }, 0.5);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(2.5);
    expect(p.porU).toBeCloseTo(20);
    // u = 0,25 é a borda esquerda da área do produto
    expect(pontoNaAreaDaArte(0.25, 0.5, { areaCm: { w: 10, h: 5 } }, { w: 20, h: 10 }, 0.5).x).toBeCloseTo(0);
  });
});

describe("ponto na vista 2D", () => {
  test("retângulo: fração da área e largura na vista", () => {
    const area: any = { id: "front", width_cm: 28, height_cm: 35, rect: { x: 100, y: 200, w: 280, h: 350 } };
    expect(pontoNaAreaDaVista(area, 240, 375)).toEqual({ u: 0.5, v: 0.5, aspecto: 1.25, areaCm: { w: 28, h: 35 }, larguraNaVista: 280 });
  });

  test("quad da foto: a homografia inversa devolve o ponto do quadrado unitário", () => {
    const q: any = [{ x: 100, y: 100 }, { x: 300, y: 120 }, { x: 320, y: 330 }, { x: 90, y: 300 }];
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.3, 0.7]]) {
      const pt = aplicarHomografia(homografiaDoQuadradoUnitario(q), u, v);
      const de = inversoNoQuad(q, pt.x, pt.y)!;
      expect(de.u).toBeCloseTo(u, 6);
      expect(de.v).toBeCloseTo(v, 6);
    }
  });
});

describe("arquivo de impressão e ficha", () => {
  test("300 dpi da área, com teto para o navegador não recusar o canvas", () => {
    expect(pixelsDaArea({ w: 20, h: 9 })).toEqual({ w: 2362, h: 1063, dpi: 300 });
    const grande = pixelsDaArea({ w: 100, h: 50 });
    expect(grande.w).toBeLessThanOrEqual(7100);
    expect(grande.dpi).toBeLessThan(300);
  });

  test("a oficina lê o ajuste em cm, não em JSON", () => {
    const porId = { image: { label: "Sua foto" }, text: { label: "Nome" } };
    expect(rotuloDaChave("image_ajuste", porId)).toBe("Posição na peça — Sua foto");
    expect(rotuloDaChave("text_fonte", porId)).toBe("Fonte — Nome");
    expect(rotuloDaChave("text_tam", porId)).toBe("Tamanho do texto — Nome");
    expect(rotuloDaChave("text_contorno", porId)).toBe("Contorno fino — Nome");
    expect(valorDaChave({ v: 1, cx: 0.5, cy: 0.5, rot: 90, dpi: 233, cm: { x: 4, y: 1.25, w: 8.4, h: 6.3 } }))
      .toBe("8,4 × 6,3 cm · a 4,0 cm da esquerda e 1,3 cm do topo da área · girada 90° · 233 dpi");
    expect(textoDoAjuste({ v: 1 } as any)).toBe("posicionada pela cliente");
  });
});
