// ============================================================
// AURA Studio — 27/09/2026: a camiseta em GLB gerada do zero
//
// scripts/studio/gerar-camiseta-glb.mjs gera a camiseta-basica.glb sem
// asset de terceiros (camisetaParametrica.js). O que dá para provar sem
// olhar: a malha-base é fechada e manifold (as únicas arestas de borda
// são as bordas escondidas por dentro das bainhas e da ribana), os
// índices vêm em múltiplos de 3, as UVs ficam em [0,1], o painel da
// frente ocupa u < 0,5 e o das costas u ≥ 0,5 sem outra ilha por cima,
// a projeção dos painéis é isotrópica (um círculo de prova sai redondo),
// a contagem de triângulos fica na meta e o GLB lê de volta igual.
// ============================================================
/* eslint-disable @typescript-eslint/no-var-requires */
// Módulo (e não script): as constantes abaixo também existem em studioRefinarMalha.test.ts.
export {};
const {
  PARAMETROS, spline, construirCamiseta, areasDaSpec, gerarCamisetaGlb, ilhasDeUv,
} = require("../scripts/studio/camisetaParametrica.js");
const { lerGlb, soldar, estatisticasDeArestas, ilhasDeUv: ilhasDaMalha } = require("../scripts/studio/refinarMalha.js");

type V3 = [number, number, number];

// A camiseta é cara de gerar (≈1 s com o Loop): uma vez por arquivo.
const base = construirCamiseta({ ...PARAMETROS, _ilhas: ilhasDeUv(PARAMETROS) });
const ids = soldar(base.pos);
const gerada = gerarCamisetaGlb(PARAMETROS);

describe("spline — passa pelos pontos e não extrapola", () => {
  it("interpola exatamente nos nós e fica constante fora deles", () => {
    const pts = [[0, 7.5], [20, 8], [44, 9], [72, 6]];
    for (const [x, y] of pts) expect(spline(pts, x)).toBeCloseTo(y, 9);
    expect(spline(pts, -5)).toBe(7.5);
    expect(spline(pts, 100)).toBe(6);
    // entre 20 e 44 sobe sem passar de 9
    for (let x = 20; x <= 44; x += 2) { expect(spline(pts, x)).toBeGreaterThanOrEqual(8 - 1e-9); expect(spline(pts, x)).toBeLessThanOrEqual(9 + 0.1); }
  });
});

describe("construirCamiseta — a malha-base é fechada, manifold e do tamanho certo", () => {
  it("nenhuma aresta não-manifold; as bordas são só as escondidas (dentro das bainhas e da ribana)", () => {
    const ar = estatisticasDeArestas(base.tris, ids);
    expect(ar.naoManifold).toBe(0);
    expect(ar.borda).toBeGreaterThan(0);
    // toda aresta de borda liga dois vértices marcados como internos
    const uso = new Map<string, number>();
    for (const [a, b, c] of base.tris) {
      const w = [ids[a], ids[b], ids[c]];
      for (let e = 0; e < 3; e++) { const x = w[e], y = w[(e + 1) % 3]; const k = x < y ? x + "_" + y : y + "_" + x; uso.set(k, (uso.get(k) || 0) + 1); }
    }
    const internoPorId = new Map<number, boolean>();
    base.pos.forEach((_: V3, i: number) => { if (base.interno[i]) internoPorId.set(ids[i], true); });
    for (const [k, n] of uso) {
      if (n !== 1) continue;
      for (const s of k.split("_")) expect(internoPorId.get(+s)).toBe(true);
    }
  });

  it("índices em múltiplos de 3, todos válidos, sem triângulo degenerado", () => {
    expect((base.tris.length * 3) % 3).toBe(0);
    for (const t of base.tris) {
      expect(t.length).toBe(3);
      for (const i of t) { expect(Number.isInteger(i)).toBe(true); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(base.pos.length); }
      expect(new Set(t.map((i: number) => ids[i])).size).toBe(3);
    }
  });

  it("proporções reais: 70 cm de ombro à barra, 52 de peito, mangas caídas e abertas, gola com ribana", () => {
    const y = base.pos.map((p: V3) => p[1]), x = base.pos.map((p: V3) => p[0]), z = base.pos.map((p: V3) => p[2]);
    expect(Math.min(...y)).toBeCloseTo(0, 6);                                  // barra reta em y = 0
    expect(Math.max(...y)).toBeCloseTo(PARAMETROS.alturaDoCorpo + PARAMETROS.ribana, 0); // ribana acima do ponto do ombro
    const peito = base.pos.filter((p: V3, i: number) => base.grupos[i] === "frente" && Math.abs(p[1] - PARAMETROS.alturaDaCava) < 0.8);
    expect(Math.max(...peito.map((p: V3) => p[0])) - Math.min(...peito.map((p: V3) => p[0]))).toBeCloseTo(2 * PARAMETROS.meiaLarguraDoPeito, 0);
    expect(Math.max(...z) - Math.min(...z)).toBeGreaterThan(17);                // volume de torso ≈ 18 cm
    expect(Math.max(...z) - Math.min(...z)).toBeLessThan(19);
    // a manga cai abaixo da axila e termina fora do corpo
    const manga = base.pos.filter((_: V3, i: number) => base.grupos[i] === "mangaDireita");
    expect(Math.max(...manga.map((p: V3) => p[0]))).toBeGreaterThan(PARAMETROS.meiaLarguraDoPeito + 12);
    expect(Math.min(...manga.map((p: V3) => p[1]))).toBeLessThan(PARAMETROS.alturaDaCava - 3);
    expect(Math.max(...x) + Math.min(...x)).toBeCloseTo(0, 6);                 // simétrica em x
  });

  it("a barra tem o vinco da bainha e a ribana tem espessura (faixas próprias)", () => {
    const grupos = new Set(base.grupos);
    for (const g of ["frente", "costas", "mangaDireita", "mangaEsquerda", "ribana", "bainhaFrente", "bainhaCostas"]) expect(grupos.has(g)).toBe(true);
    const ribana = base.pos.filter((_: V3, i: number) => base.grupos[i] === "ribana");
    expect(Math.max(...ribana.map((p: V3) => p[1])) - PARAMETROS.alturaDoCorpo).toBeCloseTo(PARAMETROS.ribana, 0);
  });
});

describe("UV — ilhas retangulares limpas, painéis nas faixas de u, projeção isotrópica", () => {
  it("todas as UVs em [0,1]", () => {
    for (const [u, v] of base.uv) { expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });

  it("a frente fica em u < 0,5 e as costas em u ≥ 0,5; as outras ilhas ficam abaixo dos painéis sem sobrepor", () => {
    const caixa = (grupo: string) => {
      const q = base.uv.filter((_: number[], i: number) => base.grupos[i] === grupo);
      return { u0: Math.min(...q.map((a: number[]) => a[0])), u1: Math.max(...q.map((a: number[]) => a[0])), v0: Math.min(...q.map((a: number[]) => a[1])), v1: Math.max(...q.map((a: number[]) => a[1])) };
    };
    const frente = caixa("frente"), costas = caixa("costas");
    expect(frente.u0).toBeGreaterThanOrEqual(0); expect(frente.u1).toBeLessThan(0.5);
    expect(costas.u0).toBeGreaterThanOrEqual(0.5); expect(costas.u1).toBeLessThanOrEqual(1);
    // glTF: v cresce para baixo, então os painéis (topo da textura) têm v pequeno
    // e as demais ilhas v maior que o v máximo dos painéis
    const vMaxDosPaineis = Math.max(frente.v1, costas.v1);
    for (const g of ["mangaDireita", "mangaEsquerda", "ribana", "bainhaFrente", "bainhaCostas"]) {
      const c = caixa(g);
      expect(c.v0).toBeGreaterThan(vMaxDosPaineis);
      expect(c.u0).toBeGreaterThanOrEqual(0); expect(c.u1).toBeLessThanOrEqual(1);
    }
    // e as ilhas de baixo não se sobrepõem entre si
    const baixo = ["mangaDireita", "mangaEsquerda", "ribana", "bainhaFrente", "bainhaCostas"].map(caixa);
    for (let i = 0; i < baixo.length; i++) for (let j = i + 1; j < baixo.length; j++) {
      const a = baixo[i], b = baixo[j];
      const separadas = a.u1 <= b.u0 || b.u1 <= a.u0 || a.v1 <= b.v0 || b.v1 <= a.v0;
      expect(separadas).toBe(true);
    }
    // a malha tem exatamente 7 ilhas conexas em UV
    expect(ilhasDaMalha(base.pos, base.uv, base.tris).length).toBe(7);
  });

  it("um círculo de prova sai redondo: a mesma escala de cm por unidade de UV em u e em v", () => {
    // dois vértices da frente na mesma altura, afastados em x, e dois na
    // mesma coluna, afastados em y: a razão Δuv/Δcm é a mesma nos dois eixos
    const frente = base.pos.map((p: V3, i: number) => ({ p, uv: base.uv[i], i })).filter((v: any) => base.grupos[v.i] === "frente" && Math.abs(v.p[2]) > 6);
    const naAltura = frente.filter((v: any) => Math.abs(v.p[1] - 40) < 0.7);
    const a = naAltura.reduce((m: any, v: any) => (v.p[0] < m.p[0] ? v : m)), b = naAltura.reduce((m: any, v: any) => (v.p[0] > m.p[0] ? v : m));
    const escalaU = Math.abs(b.uv[0] - a.uv[0]) / Math.abs(b.p[0] - a.p[0]);
    const noCentro = frente.filter((v: any) => Math.abs(v.p[0]) < 0.3 && v.p[1] > 10 && v.p[1] < 50);
    const c = noCentro.reduce((m: any, v: any) => (v.p[1] < m.p[1] ? v : m)), d = noCentro.reduce((m: any, v: any) => (v.p[1] > m.p[1] ? v : m));
    const escalaV = Math.abs(d.uv[1] - c.uv[1]) / Math.abs(d.p[1] - c.p[1]);
    expect(escalaU).toBeCloseTo(1 / PARAMETROS.cmPorUv, 6);
    expect(escalaV).toBeCloseTo(1 / PARAMETROS.cmPorUv, 6);
  });

  it("a arte não sai espelhada: u cresce com x na frente e contra x nas costas (vista de trás)", () => {
    const par = (grupo: string) => {
      const q = base.pos.map((p: V3, i: number) => ({ p, uv: base.uv[i], i })).filter((v: any) => base.grupos[v.i] === grupo && Math.abs(v.p[1] - 30) < 0.7 && Math.abs(v.p[2]) > 6);
      const esq = q.reduce((m: any, v: any) => (v.p[0] < m.p[0] ? v : m)), dir = q.reduce((m: any, v: any) => (v.p[0] > m.p[0] ? v : m));
      return dir.uv[0] - esq.uv[0];
    };
    expect(par("frente")).toBeGreaterThan(0);
    expect(par("costas")).toBeLessThan(0);
  });
});

describe("areasDaSpec — a área imprimível real, coerente com width_cm/height_cm", () => {
  it("28×35 cm a partir de 8 cm abaixo da gola, centrada em cada painel, com a escala dos painéis", () => {
    const areas = areasDaSpec(PARAMETROS);
    expect(areas.map((a: any) => a.id)).toEqual(["front", "back"]);
    for (const a of areas) {
      expect(a.width_cm).toBe(28); expect(a.height_cm).toBe(35);
      expect((a.uv.u1 - a.uv.u0) * PARAMETROS.cmPorUv).toBeCloseTo(28, 1);
      expect((a.uv.v1 - a.uv.v0) * PARAMETROS.cmPorUv).toBeCloseTo(35, 1);
      for (const k of ["u0", "v0", "u1", "v1"]) { expect(a.uv[k]).toBeGreaterThanOrEqual(0); expect(a.uv[k]).toBeLessThanOrEqual(1); }
    }
    expect((areas[0].uv.u0 + areas[0].uv.u1) / 2).toBeCloseTo(0.25, 6);
    expect((areas[1].uv.u0 + areas[1].uv.u1) / 2).toBeCloseTo(0.75, 6);
    // o topo da área da frente fica 8 cm abaixo da linha da gola (70 − 7);
    // a UV vai arredondada a 4 casas, daí a tolerância de décimo de cm
    const topoFrenteCm = (areas[0].uv.v1 - PARAMETROS.vBaseDosPaineis) * PARAMETROS.cmPorUv;
    expect(topoFrenteCm).toBeCloseTo(PARAMETROS.alturaDoCorpo - PARAMETROS.profundidadeDaGolaFrente - PARAMETROS.folgaDaGola, 1);
  });

  it("a spec publicada traz exatamente essas áreas", () => {
    const spec = require("../docs/studio/visual-templates/camiseta-basica-3d.json");
    expect(spec.spec.areas).toEqual(areasDaSpec(PARAMETROS));
    expect(spec.spec.model.print_mesh).toBe("T-Shirt");
    expect(spec.spec.model.materials.customer_color_targets).toEqual(["T-Shirt"]);
    expect(spec.spec.model.texture).toEqual({ w: 2048, h: 2048 }); // quadrada: a isotropia depende disso
  });
});

describe("gerarCamisetaGlb — o arquivo publicado", () => {
  it("entre 40 e 80 mil triângulos, até 2,5 MB, malha continua manifold, mesh T-Shirt com COLOR_0", () => {
    const { refinada, glb } = gerada;
    expect(refinada.tris.length).toBeGreaterThanOrEqual(40000);
    expect(refinada.tris.length).toBeLessThanOrEqual(80000);
    expect(glb.length).toBeLessThanOrEqual(2.5 * 1024 * 1024);
    const ar = estatisticasDeArestas(refinada.tris, refinada.ids);
    expect(ar.naoManifold).toBe(0);
    const lido = lerGlb(glb);
    expect(lido.json.meshes.length).toBe(1);
    expect(lido.json.meshes[0].name).toBe("T-Shirt");
    expect(lido.json.nodes[0].name).toBe("T-Shirt");
    expect(lido.json.meshes[0].primitives[0].attributes.COLOR_0).toBeDefined();
    expect(lido.json.asset.extras.origem).toMatch(/gerar-camiseta-glb\.mjs/);
    expect(lido.json.asset.extras.origem).toMatch(/nenhum asset de terceiros/);
  });

  it("ida e volta: posições, UVs e índices iguais; origem no centro; altura em metros ≈ 0,72", () => {
    const { refinada, glb } = gerada;
    const lido = lerGlb(glb);
    expect(lido.tris).toEqual(refinada.tris);
    expect(lido.pos.length).toBe(refinada.pos.length);
    for (let i = 0; i < lido.pos.length; i += 997) {
      for (let c = 0; c < 3; c++) expect(lido.pos[i][c]).toBeCloseTo(refinada.pos[i][c], 5);
      expect(lido.uv[i][0]).toBeCloseTo(refinada.uv[i][0], 5);
      expect(lido.uv[i][1]).toBeCloseTo(refinada.uv[i][1], 5);
    }
    const acc = lido.json.accessors[lido.json.meshes[0].primitives[0].attributes.POSITION];
    // centrada antes das dobras: o ruído desloca a caixa por menos de 1 mm
    expect(acc.min[1] + acc.max[1]).toBeCloseTo(0, 2);
    expect(acc.min[0] + acc.max[0]).toBeCloseTo(0, 2);
    expect(acc.max[1] - acc.min[1]).toBeCloseTo((PARAMETROS.alturaDoCorpo + PARAMETROS.ribana) / 100, 1);
  });

  it("as dobras não mexem na barra: a borda de baixo continua reta", () => {
    const { refinada } = gerada;
    const yMin = Math.min(...refinada.pos.map((p: V3) => p[1]));
    const barra = refinada.pos.filter((p: V3) => p[1] < yMin + 0.002);
    expect(barra.length).toBeGreaterThan(50);
    // e o arquivo publicado no repo é este mesmo (regenerar quando mudar o gerador)
    const fs = require("fs");
    const publicado = fs.readFileSync(require("path").join(__dirname, "..", "public", "models", "camiseta-basica.glb"));
    expect(publicado.length).toBe(gerada.glb.length);
    expect(publicado.equals(gerada.glb)).toBe(true);
  });
});
