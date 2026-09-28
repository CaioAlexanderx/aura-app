// ============================================================
// Mockup na foto real da peça — o motor (compose2d)
//
// A matemática que decide onde cada pixel da arte cai na foto:
//   - homografia: os quatro cantos batem e o centro vai ao cruzamento
//     das diagonais (propriedade projetiva, não "a média dos cantos");
//   - malha 12×12 de triângulos afins que aproxima a homografia;
//   - quad torcido ou degenerado não é desenhado (cai no rect);
//   - mistura pela luz da peça: multiply na clara, normal na escura;
//   - sombreado da própria foto;
//   - determinismo: mesmo payload, mesma sequência de desenho (a
//     aprovação usa o render HD e ele tem de bater com o preview).
// ============================================================
import {
  ALFA_ARTE_PECA_ESCURA,
  CELULAS_DA_MALHA,
  LIMIAR_PECA_CLARA,
  afimDoTriangulo,
  aplicarHomografia,
  blendDaArte,
  caixaDoQuad,
  composeView,
  homografiaDoQuadradoUnitario,
  luminanciaMediaNoQuad,
  malhaDoQuad,
  mapaDeSombreado,
  medidasDoQuad,
  pontoNoQuad,
  quadValido,
} from "@/components/studio/visualEngine/compose2d";
import type { VisualQuad, VisualView } from "@/services/studioVisualApi";

// Um quad em perspectiva de verdade (a peça fotografada de lado).
const QUAD: VisualQuad = [
  { x: 310, y: 240 },
  { x: 690, y: 262 },
  { x: 660, y: 700 },
  { x: 330, y: 668 },
];

function cruzamentoDasDiagonais(q: VisualQuad) {
  // p0 + t·(p2 − p0) = p1 + s·(p3 − p1)
  const [p0, p1, p2, p3] = q;
  const d1 = { x: p2.x - p0.x, y: p2.y - p0.y };
  const d2 = { x: p3.x - p1.x, y: p3.y - p1.y };
  const den = d1.x * d2.y - d1.y * d2.x;
  const t = ((p1.x - p0.x) * d2.y - (p1.y - p0.y) * d2.x) / den;
  return { x: p0.x + t * d1.x, y: p0.y + t * d1.y };
}

describe("homografia do quadrado unitário ao quad", () => {
  it("os quatro cantos batem", () => {
    const H = homografiaDoQuadradoUnitario(QUAD);
    const cantos = [[0, 0], [1, 0], [1, 1], [0, 1]];
    cantos.forEach(([u, v], i) => {
      const p = aplicarHomografia(H, u, v);
      expect(p.x).toBeCloseTo(QUAD[i].x, 9);
      expect(p.y).toBeCloseTo(QUAD[i].y, 9);
    });
  });

  it("o centro da arte vai ao cruzamento das diagonais", () => {
    const H = homografiaDoQuadradoUnitario(QUAD);
    const c = aplicarHomografia(H, 0.5, 0.5);
    const esperado = cruzamentoDasDiagonais(QUAD);
    expect(c.x).toBeCloseTo(esperado.x, 9);
    expect(c.y).toBeCloseTo(esperado.y, 9);
    // E NÃO é a média dos cantos: a perspectiva desloca o centro.
    const media = { x: QUAD.reduce((s, p) => s + p.x, 0) / 4, y: QUAD.reduce((s, p) => s + p.y, 0) / 4 };
    expect(Math.hypot(c.x - media.x, c.y - media.y)).toBeGreaterThan(0.5);
  });

  it("paralelogramo degenera em afim (g = h = 0) e continua batendo", () => {
    const par: VisualQuad = [{ x: 100, y: 100 }, { x: 300, y: 120 }, { x: 320, y: 320 }, { x: 120, y: 300 }];
    const H = homografiaDoQuadradoUnitario(par);
    expect(H[6]).toBe(0);
    expect(H[7]).toBe(0);
    const p = aplicarHomografia(H, 1, 1);
    expect(p.x).toBeCloseTo(320, 9);
    expect(p.y).toBeCloseTo(320, 9);
  });

  it("pontoNoQuad leva o retângulo da arte (w×h) ao quad", () => {
    const p = pontoNoQuad(QUAD, 400, 300, 400, 300);
    expect(p.x).toBeCloseTo(660, 9);
    expect(p.y).toBeCloseTo(700, 9);
    const c = pontoNoQuad(QUAD, 400, 300, 200, 150);
    const esperado = cruzamentoDasDiagonais(QUAD);
    expect(c.x).toBeCloseTo(esperado.x, 9);
  });
});

describe("malha 12×12", () => {
  const malha = malhaDoQuad(QUAD, 400, 300);

  it("tem 2 triângulos por célula", () => {
    expect(CELULAS_DA_MALHA).toBe(12);
    expect(malha).toHaveLength(12 * 12 * 2);
  });

  it("todo vértice de destino está sobre a homografia exata", () => {
    const H = homografiaDoQuadradoUnitario(QUAD);
    for (const t of malha) {
      t.origem.forEach((o, i) => {
        const exato = aplicarHomografia(H, o.x / 400, o.y / 300);
        expect(t.destino[i].x).toBeCloseTo(exato.x, 9);
        expect(t.destino[i].y).toBeCloseTo(exato.y, 9);
      });
    }
  });

  it("a afim de cada triângulo leva a origem exatamente ao destino", () => {
    for (const t of [malha[0], malha[143], malha[287]]) {
      const m = afimDoTriangulo(t.origem, t.destino)!;
      t.origem.forEach((o, i) => {
        expect(m[0] * o.x + m[2] * o.y + m[4]).toBeCloseTo(t.destino[i].x, 9);
        expect(m[1] * o.x + m[3] * o.y + m[5]).toBeCloseTo(t.destino[i].y, 9);
      });
    }
  });

  it("triângulo degenerado não tem afim", () => {
    const p = { x: 1, y: 1 };
    expect(afimDoTriangulo([p, p, { x: 2, y: 2 }], [p, p, p])).toBeNull();
  });
});

describe("validade do quad", () => {
  it("aceita o quad convexo, nos dois sentidos", () => {
    expect(quadValido(QUAD)).toBe(true);
    expect(quadValido([...QUAD].reverse())).toBe(true);
  });
  it("recusa quad torcido (alça arrastada por cima da outra)", () => {
    expect(quadValido([QUAD[0], QUAD[2], QUAD[1], QUAD[3]])).toBe(false);
  });
  it("recusa pontos colineares, NaN e forma errada", () => {
    expect(quadValido([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }])).toBe(false);
    expect(quadValido([{ x: NaN, y: 0 }, QUAD[1], QUAD[2], QUAD[3]])).toBe(false);
    expect(quadValido([QUAD[0], QUAD[1], QUAD[2]])).toBe(false);
    expect(quadValido(null)).toBe(false);
  });
  it("caixa e medidas", () => {
    expect(caixaDoQuad(QUAD)).toEqual({ x: 310, y: 240, w: 380, h: 460 });
    const m = medidasDoQuad([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }]);
    expect(m).toEqual({ w: 100, h: 50 });
  });
});

// Imagem RGBA sintética
function imagem(w: number, h: number, cor: (x: number, y: number) => number) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = cor(x, y), k = (y * w + x) * 4;
    d[k] = v; d[k + 1] = v; d[k + 2] = v; d[k + 3] = 255;
  }
  return d;
}

describe("mistura da arte pela luz da peça", () => {
  it("peça clara: multiply opaco (a luz da foto atravessa a tinta)", () => {
    expect(blendDaArte(0.82)).toEqual({ modo: "multiply", alfa: 1 });
    expect(blendDaArte(LIMIAR_PECA_CLARA)).toEqual({ modo: "multiply", alfa: 1 });
  });
  it("peça escura: normal com leve transparência (multiply sobre preto some)", () => {
    expect(blendDaArte(0.12)).toEqual({ modo: "normal", alfa: ALFA_ARTE_PECA_ESCURA });
    expect(ALFA_ARTE_PECA_ESCURA).toBeLessThan(1);
    expect(ALFA_ARTE_PECA_ESCURA).toBeGreaterThan(0.8);
  });
  it("sem leitura da foto: normal opaco", () => {
    expect(blendDaArte(null)).toEqual({ modo: "normal", alfa: 1 });
  });
  it("art_blend explícito manda", () => {
    expect(blendDaArte(0.1, "multiply")).toEqual({ modo: "multiply", alfa: 1 });
    expect(blendDaArte(0.9, "normal")).toEqual({ modo: "normal", alfa: 1 });
  });
  it("a luz média é medida só dentro do quad", () => {
    // Metade esquerda branca, direita preta; quad na metade esquerda.
    const rgba = imagem(20, 10, (x) => (x < 10 ? 255 : 0));
    const esquerda: VisualQuad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(luminanciaMediaNoQuad(rgba, 20, 10, esquerda)).toBeCloseTo(1, 6);
    const direita: VisualQuad = [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }];
    expect(luminanciaMediaNoQuad(rgba, 20, 10, direita)).toBeCloseTo(0, 6);
  });
});

describe("sombreado tirado da foto", () => {
  it("tecido liso não sombreia (tudo 255)", () => {
    const m = mapaDeSombreado(imagem(40, 40, () => 200), 40, 40, 1);
    expect(Array.from(new Set(Array.from(m.filter((_, i) => i % 4 === 0))))).toEqual([255]);
  });
  it("a dobra escurece, e a força doseia", () => {
    const dobra = imagem(60, 60, (x) => (x >= 28 && x < 32 ? 90 : 220));
    const forte = mapaDeSombreado(dobra, 60, 60, 1);
    const fraca = mapaDeSombreado(dobra, 60, 60, 0.3);
    const px = (m: Uint8ClampedArray, x: number, y: number) => m[(y * 60 + x) * 4];
    expect(px(forte, 30, 30)).toBeLessThan(px(forte, 5, 30));
    expect(px(fraca, 30, 30)).toBeGreaterThan(px(forte, 30, 30));
    expect(px(forte, 5, 30)).toBe(255);
  });
  it("força zero não sombreia", () => {
    const dobra = imagem(30, 30, (x) => (x === 15 ? 20 : 220));
    const m = mapaDeSombreado(dobra, 30, 30, 0);
    expect(m.every((v) => v === 255)).toBe(true);
  });
  it("camiseta escura tem dobra tão legível quanto a clara (luz relativa)", () => {
    const clara = mapaDeSombreado(imagem(60, 60, (x) => (x >= 28 && x < 32 ? 110 : 240)), 60, 60, 1);
    const escura = mapaDeSombreado(imagem(60, 60, (x) => (x >= 28 && x < 32 ? 18 : 40)), 60, 60, 1);
    const i = (30 * 60 + 30) * 4;
    expect(Math.abs(clara[i] - escura[i])).toBeLessThan(20);
  });
  it("é determinístico", () => {
    const f = imagem(50, 50, (x, y) => (x * 7 + y * 13) % 256);
    expect(mapaDeSombreado(f, 50, 50, 0.6)).toEqual(mapaDeSombreado(f, 50, 50, 0.6));
  });
});

// ── Composição com canvas de mentira (grava a sequência de desenho) ──
type Op = [string, ...any[]];
function canvasFalso(registro: Op[], nome: string) {
  const cv: any = { width: 0, height: 0, nome };
  const ctx: any = new Proxy(
    { canvas: cv },
    {
      get(alvo: any, prop: string) {
        if (prop in alvo) return alvo[prop];
        if (prop === "measureText") return (t: string) => ({ width: t.length * 10 });
        if (prop === "getImageData") return (_x: number, _y: number, w: number, h: number) => ({
          data: imagem(w, h, (x) => (x % 17 === 0 ? 120 : 230)), width: w, height: h,
        });
        if (prop === "createImageData") return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
        return (...args: any[]) => {
          registro.push([nome + "." + prop, ...args.map((a) => (a && a.nome ? "<" + a.nome + ">" : a && a.src ? "<img " + a.src + ">" : a))]);
        };
      },
      set(alvo: any, prop: string, valor: any) {
        registro.push([nome + "." + prop + "=", valor]);
        alvo[prop] = valor;
        return true;
      },
    }
  );
  cv.getContext = () => ctx;
  cv.toDataURL = () => "data:image/png;base64,AAAA";
  return cv;
}

const FOTO = "https://r2.example/camiseta.jpg";
const VISTA: VisualView = {
  id: "front",
  label: "Frente",
  base: { w: 1000, h: 1200 },
  photo_url: FOTO,
  shading_url: null,
  shading_from_photo: { strength: 0.6 },
  garment: null,
  areas: [{ id: "front", width_cm: 28, height_cm: 32, quad: QUAD, rect: caixaDoQuad(QUAD) }],
};

describe("composeView com quad", () => {
  const ImageOriginal = (global as any).Image;
  let criados = 0;
  let registro: Op[] = [];
  beforeAll(() => {
    (global as any).Image = class {
      onload: any; onerror: any; width = 800; height = 960; naturalWidth = 800; naturalHeight = 960; crossOrigin = "";
      private _src = "";
      get src() { return this._src; }
      set src(v: string) { this._src = v; setTimeout(() => this.onload && this.onload(), 0); }
    };
    jest.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "canvas") return canvasFalso(registro, "c" + ++criados);
      throw new Error("inesperado: " + tag);
    }) as any);
  });
  afterAll(() => {
    (global as any).Image = ImageOriginal;
    (document.createElement as any).mockRestore();
  });

  async function compor(values: Record<string, any>, pixelWidth = 800) {
    registro = [];
    criados = 0;
    const alvo = canvasFalso(registro, "alvo");
    await composeView(alvo as any, VISTA, values, { pixelWidth });
    return { registro, alvo };
  }

  it("desenha a arte triângulo a triângulo (288 drawImage da arte na camada)", async () => {
    const { registro: r } = await compor({ text: "Maria", image: "https://r2.example/arte.png" });
    const arteNaCamada = r.filter((op) => op[0].endsWith(".drawImage") && op[1] === "<c1>" && op[0] !== "alvo.drawImage");
    expect(arteNaCamada).toHaveLength(288);
    // E a camada entra na foto com a mistura da peça clara (multiply).
    const i = r.findIndex((op) => op[0] === "alvo.globalCompositeOperation=" && op[1] === "multiply");
    expect(i).toBeGreaterThan(-1);
  });

  it("mesmo payload, mesma sequência de desenho", async () => {
    const a = (await compor({ text: "Maria", image: "https://r2.example/arte.png" })).registro;
    const b = (await compor({ text: "Maria", image: "https://r2.example/arte.png" })).registro;
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("sem arte nem texto, só a foto", async () => {
    const { registro: r } = await compor({});
    expect(r.filter((op) => op[0] === "alvo.drawImage")).toEqual([["alvo.drawImage", "<img " + FOTO + ">", 0, 0, 1000, 1200]]);
  });

  it("quad inválido cai no rect de sempre", async () => {
    registro = [];
    criados = 0;
    const alvo = canvasFalso(registro, "alvo");
    const torcido: VisualView = {
      ...VISTA,
      areas: [{ ...VISTA.areas[0], quad: [QUAD[0], QUAD[2], QUAD[1], QUAD[3]] }],
    };
    await composeView(alvo as any, torcido, { text: "Maria" }, { pixelWidth: 800 });
    // Nenhuma camada intermediária: o texto vai direto no canvas.
    expect(criados).toBe(0);
    expect(registro.some((op) => op[0] === "alvo.fillText" && op[1] === "Maria")).toBe(true);
  });
});
