// ============================================================
// AURA Studio — 04/09/2026: a cena "foto de estúdio" do mockup 3D
//
// O mockup era um cilindro sobre um fundo chapado. Ganhou fundo em
// gradiente, chão com sombra, câmera que recua para o modelo alto e
// vidro com arte opaca. A parte three.js só dá para conferir olhando
// (CDN, web); estes testes cobrem a aritmética que decide onde cada
// coisa fica — que é onde um número errado passa despercebido.
// ============================================================
import {
  hexToRgb, mixHex, hexToRgba, backdropPalette,
  cameraDistance, floorLevel, contactShadowRadius, alturaDaCena,
  CAMERA_DISTANCIA_PADRAO,
} from "@/components/studio/visualEngine/mugScene";
import { MUG_GEOMETRY_PADRAO, readMugGeometry } from "@/components/studio/visualEngine/mugGeometry";

const SEM_ACESSORIO = { spoon: false, saucer: false };

describe("cores do fundo", () => {
  it("lê #RGB e #RRGGBB; recusa o resto", () => {
    expect(hexToRgb("#FFF")).toEqual([255, 255, 255]);
    expect(hexToRgb("#fbf8f3")).toEqual([251, 248, 243]);
    expect(hexToRgb("papel")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
  });

  it("mistura na proporção pedida e devolve hex", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mixHex("#000000", "#FFFFFF", 1)).toBe("#ffffff");
  });

  it("cor inválida na mistura devolve a primeira, sem lançar", () => {
    expect(mixHex("#ABCDEF", "azul", 0.5)).toBe("#ABCDEF");
  });

  // O vidro pinta o fundo da textura com alfa e a arte opaca por cima.
  it("hexToRgba embute o alfa, limitado a 0–1", () => {
    expect(hexToRgba("#FFFFFF", 0.34)).toBe("rgba(255,255,255,0.34)");
    expect(hexToRgba("#000", 7)).toBe("rgba(0,0,0,1)");
    expect(hexToRgba("vidro", 0.5)).toBe("vidro");
  });

  it("a paleta clareia em cima e escurece embaixo a partir da base", () => {
    const p = backdropPalette("#FBF8F3");
    const base = hexToRgb("#FBF8F3")!;
    expect(hexToRgb(p.top)![0]).toBeGreaterThanOrEqual(base[0]);
    expect(hexToRgb(p.bottom)![0]).toBeLessThan(base[0]);
  });

  it("base inválida cai no papel da vitrine em vez de quebrar a cena", () => {
    expect(backdropPalette("qualquer")).toEqual(backdropPalette("#FBF8F3"));
  });
});

describe("câmera — a distância de sempre, e mais longe só quando precisa", () => {
  it("a caneca padrão fica na distância que sempre teve", () => {
    expect(cameraDistance(MUG_GEOMETRY_PADRAO, SEM_ACESSORIO)).toBe(CAMERA_DISTANCIA_PADRAO);
  });

  it("modelo baixo (xícara) NÃO aproxima a câmera", () => {
    const xicara = readMugGeometry({ model: { geometry: { body: { height: 1.6 } } } });
    expect(cameraDistance(xicara, SEM_ACESSORIO)).toBe(CAMERA_DISTANCIA_PADRAO);
  });

  // Chopp: altura 3.3 não cabia no enquadramento fixo.
  it("modelo alto afasta a câmera na proporção da altura", () => {
    const chopp = readMugGeometry({ model: { geometry: { body: { height: 3.3 } } } });
    const d = cameraDistance(chopp, SEM_ACESSORIO);
    expect(d).toBeGreaterThan(CAMERA_DISTANCIA_PADRAO);
    expect(d).toBeCloseTo(CAMERA_DISTANCIA_PADRAO * (3.3 / 2.3), 1);
  });

  it("colher e pires contam na altura da cena", () => {
    const g = MUG_GEOMETRY_PADRAO;
    expect(alturaDaCena(g, { spoon: true, saucer: false })).toBeGreaterThan(alturaDaCena(g, SEM_ACESSORIO));
    expect(alturaDaCena(g, { spoon: false, saucer: true })).toBeGreaterThan(alturaDaCena(g, SEM_ACESSORIO));
  });
});

describe("chão e sombra de contato", () => {
  it("o chão é a base da caneca", () => {
    expect(floorLevel(MUG_GEOMETRY_PADRAO, SEM_ACESSORIO)).toBeCloseTo(-1.15, 6);
  });

  it("com pires, o chão desce para a base do pires", () => {
    expect(floorLevel(MUG_GEOMETRY_PADRAO, { spoon: false, saucer: true })).toBeLessThan(-1.15);
  });

  it("a mancha é maior que a base, e segue o pires quando existe", () => {
    const semPires = contactShadowRadius(MUG_GEOMETRY_PADRAO, SEM_ACESSORIO);
    expect(semPires).toBeGreaterThan(MUG_GEOMETRY_PADRAO.body.bottomRadius);
    expect(contactShadowRadius(MUG_GEOMETRY_PADRAO, { spoon: false, saucer: true })).toBeGreaterThan(semPires);
  });
});
