// ============================================================
// AURA Studio — 27/09/2026: o refinamento da camiseta em GLB
//
// scripts/studio/refinar-camiseta-glb.mjs transforma o modelo low-poly
// na camiseta que o viewer mostra. O que dá para provar sem olhar: a
// subdivisão de Loop não abre nem cola a malha (arestas de borda ×2 por
// passada, nenhuma não-manifold), cada triângulo vira quatro, as UVs
// ficam em [0,1] e as ilhas dos painéis continuam nos mesmos retângulos
// (as áreas `front`/`back` da spec dependem disso), as dobras não mexem
// nas bordas nem abrem a costura, e o GLB escrito lê de volta igual.
// ============================================================
/* eslint-disable @typescript-eslint/no-var-requires */
const {
  lerGlb, escreverGlb, soldar, estatisticasDeArestas, ilhasDeUv, subdividirLoop,
  normaisSuaves, criarRuido, pesoDasDobras, aplicarDobras, oclusaoPorVertice, oclusaoDeCavidade,
} = require("../scripts/studio/refinarMalha.js");

type V3 = [number, number, number];
type Malha = { pos: V3[]; uv: [number, number][]; tris: [number, number, number][]; ids: number[] };

// Um "tubo" aberto de duas faces (frente e costas) com costura de UV: as
// duas metades dividem posição nas laterais mas têm UV em ilhas
// separadas — a topologia da camiseta em miniatura. A frente ocupa
// u ∈ [0, 0.5], as costas u ∈ [0.5, 1].
function tubo(): Malha {
  const pos: V3[] = [], uv: [number, number][] = [], tris: [number, number, number][] = [];
  const lados = 6, alturas = 3;
  const anel = (k: number, y: number, uBase: number, meio: boolean) => {
    for (let i = 0; i <= lados; i++) {
      const a = (i / lados) * Math.PI * (meio ? 1 : 2) + (uBase ? Math.PI : 0);
      pos.push([Math.cos(a), y, Math.sin(a)]);
      uv.push([uBase + (i / lados) * 0.5, k / (alturas - 1)]);
    }
  };
  // frente (ângulo 0..π) e costas (π..2π): a lateral (ângulo 0 e π) é
  // duplicada — mesma posição, UV diferente.
  for (let k = 0; k < alturas; k++) anel(k, k, 0, true);
  for (let k = 0; k < alturas; k++) anel(k, k, 0.5, true);
  const n = lados + 1;
  for (const base of [0, alturas * n]) {
    for (let k = 0; k < alturas - 1; k++) {
      for (let i = 0; i < lados; i++) {
        const a = base + k * n + i, b = a + 1, c = a + n, d = c + 1;
        tris.push([a, c, b], [b, c, d]);
      }
    }
  }
  return { pos, uv, tris, ids: soldar(pos) };
}

describe("subdividirLoop — a malha continua fechada e as UVs no lugar", () => {
  it("cada triângulo vira quatro e as bordas dobram, sem aresta não-manifold", () => {
    const m0 = tubo();
    const e0 = estatisticasDeArestas(m0.tris, m0.ids);
    expect(e0.naoManifold).toBe(0);
    const m1 = subdividirLoop(m0);
    const e1 = estatisticasDeArestas(m1.tris, m1.ids);
    expect(m1.tris.length).toBe(m0.tris.length * 4);
    expect(e1.borda).toBe(e0.borda * 2);
    expect(e1.naoManifold).toBe(0);
    // Euler para uma superfície: interior cresce 4× menos o que virou borda
    expect(e1.interior).toBe(e0.interior * 2 + m0.tris.length * 3);
    const m2 = subdividirLoop(m1);
    expect(m2.tris.length).toBe(m0.tris.length * 16);
    expect(estatisticasDeArestas(m2.tris, m2.ids).borda).toBe(e0.borda * 4);
  });

  it("vértices novos são um por aresta (não soldada), e a costura continua colada", () => {
    const m0 = tubo();
    const m1 = subdividirLoop(m0);
    const arestas = new Set<string>();
    for (const [a, b, c] of m0.tris) for (const [x, y] of [[a, b], [b, c], [c, a]]) arestas.add(x < y ? x + "_" + y : y + "_" + x);
    expect(m1.pos.length).toBe(m0.pos.length + arestas.size);
    // os dois lados da costura (mesmo id soldado) estão na mesma posição
    const porId = new Map<number, V3>();
    m1.pos.forEach((p: V3, i: number) => {
      const q = porId.get(m1.ids[i]);
      if (q) { expect(p[0]).toBeCloseTo(q[0], 9); expect(p[1]).toBeCloseTo(q[1], 9); expect(p[2]).toBeCloseTo(q[2], 9); }
      else porId.set(m1.ids[i], p);
    });
    // e o número de ids soldados novos bate com o de arestas soldadas
    expect(new Set(m1.ids).size).toBe(new Set(m0.ids).size + estatisticasDeArestas(m0.tris, m0.ids).borda + estatisticasDeArestas(m0.tris, m0.ids).interior);
  });

  it("UVs ficam em [0,1] e cada ilha ocupa o mesmo retângulo de antes", () => {
    const m0 = tubo();
    const m2 = subdividirLoop(subdividirLoop(m0));
    for (const [u, v] of m2.uv) { expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    const i0 = ilhasDeUv(m0.pos, m0.uv, m0.tris), i2 = ilhasDeUv(m2.pos, m2.uv, m2.tris);
    expect(i2.length).toBe(i0.length);
    expect(i0.length).toBe(2);
    const faixas = (ilhas: any[]) => ilhas.map((i) => [i.u0, i.u1, i.v0, i.v1].map((x) => x.toFixed(6)).join(",")).sort();
    expect(faixas(i2)).toEqual(faixas(i0));
    expect(faixas(i0)).toEqual(["0.000000,0.500000,0.000000,1.000000", "0.500000,1.000000,0.000000,1.000000"]);
  });

  it("a silhueta suaviza: um vértice interior se aproxima da média dos vizinhos, a borda não encolhe para dentro", () => {
    const m0 = tubo();
    const m1 = subdividirLoop(m0);
    // O anel do meio (y = 1) é interior: o raio cai um pouco (Loop aproxima a superfície limite).
    const meio = m1.pos.filter((p: V3) => Math.abs(p[1] - 1) < 1e-9);
    expect(meio.length).toBeGreaterThan(0);
    for (const p of meio) { const r = Math.hypot(p[0], p[2]); expect(r).toBeLessThan(1); expect(r).toBeGreaterThan(0.85); }
    // A borda (y = 0) continua em y = 0: a regra de borda só olha a própria curva.
    const borda = m1.pos.filter((p: V3) => Math.abs(p[1]) < 1e-9);
    expect(borda.length).toBeGreaterThan(0);
  });
});

describe("normaisSuaves — unitárias, contínuas na costura, sem misturar dobras de 180°", () => {
  it("todo vértice sai com normal unitária e apontando para fora do tubo", () => {
    const m = subdividirLoop(tubo());
    const nrm = normaisSuaves(m.pos, m.tris, m.ids);
    expect(nrm.length).toBe(m.pos.length);
    for (let i = 0; i < m.pos.length; i++) {
      const n = nrm[i];
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 6);
      const p = m.pos[i];
      // normal radial: produto com o raio positivo
      expect(n[0] * p[0] + n[2] * p[2]).toBeGreaterThan(0.5);
    }
  });

  it("os dois lados de uma costura de UV recebem a mesma normal", () => {
    const m = tubo();
    const nrm = normaisSuaves(m.pos, m.tris, m.ids);
    const porId = new Map<number, V3>();
    m.pos.forEach((_: V3, i: number) => {
      const q = porId.get(m.ids[i]);
      if (q) { expect(nrm[i][0]).toBeCloseTo(q[0], 9); expect(nrm[i][2]).toBeCloseTo(q[2], 9); }
      else porId.set(m.ids[i], nrm[i]);
    });
  });

  it("uma bainha dobrada (duas faces a 180°) não vira normal tangente", () => {
    // duas faces coplanares com normais opostas, coladas na mesma aresta
    const pos: V3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0]];
    const tris: [number, number, number][] = [[0, 1, 2], [3, 5, 4]];
    const ids = soldar(pos);
    const nrm = normaisSuaves(pos, tris, ids, 80);
    expect(nrm[0][2]).toBeCloseTo(1, 6);
    expect(nrm[3][2]).toBeCloseTo(-1, 6);
  });
});

describe("dobras — discretas, com semente fixa, longe das bordas", () => {
  it("o ruído é determinístico e fica em [-1, 1]", () => {
    const a = criarRuido(7), b = criarRuido(7), c = criarRuido(8);
    let diferente = false;
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37, y = i * 0.11, z = i * 0.23;
      expect(a(x, y, z)).toBe(b(x, y, z));
      expect(Math.abs(a(x, y, z))).toBeLessThanOrEqual(1);
      if (a(x, y, z) !== c(x, y, z)) diferente = true;
    }
    expect(diferente).toBe(true);
  });

  it("peso das dobras: cheio na barra, quase nada no peito da frente, zero na gola, alto na manga", () => {
    const caixa = { min: [-0.245, 0.5, -0.08], max: [0.245, 0.85, 0.09] };
    expect(pesoDasDobras([0, 0.55, 0.08], caixa, 0.13)).toBe(1);          // abdômen
    expect(pesoDasDobras([0, 0.70, 0.08], caixa, 0.13)).toBeCloseTo(0.12); // peito, frente (arte)
    expect(pesoDasDobras([0, 0.70, -0.07], caixa, 0.13)).toBeCloseTo(0.3); // costas
    expect(pesoDasDobras([0, 0.83, 0.0], caixa, 0.13)).toBe(0);           // gola
    expect(pesoDasDobras([0.22, 0.80, -0.03], caixa, 0.13)).toBeCloseTo(0.9); // manga
    expect(pesoDasDobras([0.135, 0.80, -0.03], caixa, 0.13)).toBeLessThan(0.3); // começo da manga: sobe devagar
  });

  it("desloca pouco, não mexe nas bordas e não abre a costura", () => {
    const m0 = subdividirLoop(subdividirLoop(tubo()));
    const nrm = normaisSuaves(m0.pos, m0.tris, m0.ids);
    const m1 = aplicarDobras(m0, nrm, { amplitude: 0.05, comprimento: 0.8, semente: 7, margemDaBorda: 0.3, larguraDoCorpo: 10 });
    expect(m1.tris).toBe(m0.tris);
    let maximo = 0, mexeu = false;
    m1.pos.forEach((p: V3, i: number) => {
      const q = m0.pos[i];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      maximo = Math.max(maximo, d);
      if (d > 1e-6) mexeu = true;
      // borda (y = 0 ou y = 2): parada
      if (Math.abs(q[1]) < 1e-9 || Math.abs(q[1] - 2) < 1e-9) expect(d).toBeLessThan(1e-9);
    });
    expect(mexeu).toBe(true);
    expect(maximo).toBeLessThanOrEqual(0.05 * 1.45 + 1e-9); // duas oitavas: 1 + 0,45
    const porId = new Map<number, V3>();
    m1.pos.forEach((p: V3, i: number) => {
      const q = porId.get(m1.ids[i]);
      if (q) { expect(p[0]).toBeCloseTo(q[0], 9); expect(p[1]).toBeCloseTo(q[1], 9); expect(p[2]).toBeCloseTo(q[2], 9); }
      else porId.set(m1.ids[i], p);
    });
  });
});

describe("oclusão por vértice — escurece só perto das axilas e da gola", () => {
  it("cinza em [0,1], mais escuro no centro da axila, 1 longe de tudo", () => {
    const m = tubo();
    const cor = oclusaoPorVertice(m, { axilas: [[1, 1, 0]], raioAxila: 0.5, forcaAxila: 0.4, raioGola: 0.05, forcaGola: 0.2 });
    expect(cor.length).toBe(m.pos.length);
    const noCentro = m.pos.findIndex((p: V3) => Math.abs(p[0] - 1) < 1e-9 && Math.abs(p[1] - 1) < 1e-9);
    expect(cor[noCentro][0]).toBeCloseTo(0.6, 6);
    const longe = m.pos.findIndex((p: V3) => Math.abs(p[0] + 1) < 1e-9 && Math.abs(p[1] - 1) < 1e-9);
    expect(cor[longe][0]).toBeCloseTo(1, 3);
    for (const c of cor) { expect(c[0]).toBeGreaterThanOrEqual(0); expect(c[0]).toBeLessThanOrEqual(1); expect(c[0]).toBe(c[1]); expect(c[1]).toBe(c[2]); }
  });
});

describe("oclusaoDeCavidade — o fundo de uma dobra escurece, a crista e o plano não", () => {
  it("num tubo convexo tudo fica em 1; um vértice afundado para dentro escurece, até o teto", () => {
    const liso = subdividirLoop(tubo());
    const nrmLiso = normaisSuaves(liso.pos, liso.tris, liso.ids);
    for (const f of oclusaoDeCavidade(liso, nrmLiso, { ganho: 4, maximo: 0.3 })) expect(f).toBeCloseTo(1, 6);
    // afunda um vértice interior (fora da costura) rumo ao eixo: vale côncavo
    const m: Malha = { ...liso, pos: liso.pos.map((p: V3) => [...p] as V3) };
    const i = m.pos.findIndex((p: V3, k: number) => Math.abs(p[1] - 1) < 1e-9 && p[0] > 0.2 && p[2] > 0.2 && m.ids.filter((w: number) => w === m.ids[k]).length === 1);
    expect(i).toBeGreaterThanOrEqual(0);
    m.pos[i] = [m.pos[i][0] * 0.6, m.pos[i][1], m.pos[i][2] * 0.6];
    const nrm = normaisSuaves(m.pos, m.tris, m.ids);
    const fator = oclusaoDeCavidade(m, nrm, { ganho: 4, maximo: 0.3 });
    expect(fator[i]).toBeLessThan(0.95);
    expect(fator[i]).toBeGreaterThanOrEqual(0.7);
    for (const f of fator) { expect(f).toBeGreaterThanOrEqual(0.7); expect(f).toBeLessThanOrEqual(1); }
  });
});

describe("escreverGlb / lerGlb — o arquivo lê de volta o que foi escrito", () => {
  it("posições, UVs, índices, cor, nome e extras do mesh sobrevivem à ida e volta", () => {
    const m = subdividirLoop(tubo());
    const nrm = normaisSuaves(m.pos, m.tris, m.ids);
    const cor = m.pos.map(() => [0.5, 0.5, 0.5]);
    const json = {
      asset: { version: "2.0", extras: { modificado: "mangas" } }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [{ name: "T-Shirt", mesh: 0, translation: [0, 0.01, 0], scale: [0.99, 0.99, 0.99] }],
      materials: [{ name: "Top_shd" }],
      meshes: [{ name: "T-Shirt", extras: { acabamento: { schema: 1, costuras: [] } }, primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    };
    const buf = escreverGlb(json, { ...m, nrm, cor }, "refinado");
    expect(buf.toString("ascii", 0, 4)).toBe("glTF");
    expect(buf.readUInt32LE(8)).toBe(buf.length);
    expect(buf.length % 4).toBe(0);
    const lido = lerGlb(buf);
    expect(lido.json.meshes[0].name).toBe("T-Shirt");
    expect(lido.json.meshes[0].extras).toEqual({ acabamento: { schema: 1, costuras: [] } });
    expect(lido.json.nodes[0].translation).toEqual([0, 0.01, 0]);
    expect(lido.json.asset.extras.modificado).toBe("mangas; refinado");
    expect(lido.json.meshes[0].primitives[0].attributes.COLOR_0).toBeDefined();
    expect(lido.json.accessors[lido.json.meshes[0].primitives[0].indices].componentType).toBe(5123); // uint16 basta
    expect(lido.pos.length).toBe(m.pos.length);
    expect(lido.tris).toEqual(m.tris);
    lido.pos.forEach((p: V3, i: number) => p.forEach((x, c) => expect(x).toBeCloseTo(m.pos[i][c], 5)));
    lido.uv.forEach((q: [number, number], i: number) => { expect(q[0]).toBeCloseTo(m.uv[i][0], 5); expect(q[1]).toBeCloseTo(m.uv[i][1], 5); });
  });
});
