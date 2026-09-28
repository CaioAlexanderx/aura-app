// ============================================================
// scripts/studio/refinarMalha.js — 27/09/2026
//
// A aritmética do refinamento de uma malha de roupa em GLB, sem three.js
// e sem dependência: leitura/escrita do glTF binário, solda de vértices,
// subdivisão de Loop preservando as ilhas de UV, normais suaves por
// ângulo, dobras por ruído de baixa frequência e oclusão por vértice.
//
// POR QUE UM .js CommonJS separado da CLI (.mjs): o Jest deste repo só
// transforma .ts/.tsx/.js, e estas funções precisam de teste (malha
// continua fechada, UVs em [0,1], contagem de triângulos, ilhas dos
// painéis nas mesmas faixas). A CLI refinar-camiseta-glb.mjs importa
// daqui com createRequire e só cuida de argumentos e arquivos.
//
// Convenções: `pos` = [[x,y,z]...], `uv` = [[u,v]...], `tris` = [[a,b,c]...]
// com índices nos vértices NÃO soldados (o glTF duplica vértice na costura
// de UV e nas arestas duras). `ids` = id soldado por vértice: vértices na
// mesma posição têm o mesmo id, e é por esse id que a superfície é
// contínua para a subdivisão, as normais e as dobras.
// ============================================================
"use strict";

// ── GLB ──────────────────────────────────────────────────────

const TAMANHO = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENTES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** Lê o GLB: JSON, BIN e a primeira primitiva do primeiro mesh (o caso do modelo). */
function lerGlb(buf) {
  if (buf.toString("ascii", 0, 4) !== "glTF") throw new Error("Não é um GLB (magic)");
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const bin = buf.subarray(20 + jsonLen + 8);
  const ler = (i) => {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
    const comp = TAMANHO[a.componentType], n = COMPONENTES[a.type];
    const stride = bv.byteStride || comp * n, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const out = [];
    for (let k = 0; k < a.count; k++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        const off = base + k * stride + c * comp;
        row.push(a.componentType === 5126 ? bin.readFloatLE(off)
          : a.componentType === 5125 ? bin.readUInt32LE(off)
          : a.componentType === 5123 ? bin.readUInt16LE(off) : bin.readUInt8(off));
      }
      out.push(row);
    }
    return out;
  };
  const prim = json.meshes[0].primitives[0];
  const idx = ler(prim.indices).map((r) => r[0]);
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) tris.push([idx[t], idx[t + 1], idx[t + 2]]);
  return {
    json,
    pos: ler(prim.attributes.POSITION),
    nrm: ler(prim.attributes.NORMAL),
    uv: ler(prim.attributes.TEXCOORD_0),
    tris,
  };
}

const pad4 = (n) => (4 - (n % 4)) % 4;

function f32(rows) {
  const n = rows.length ? rows[0].length : 0;
  const b = Buffer.alloc(rows.length * n * 4);
  let o = 0;
  for (const r of rows) for (const x of r) { b.writeFloatLE(x, o); o += 4; }
  return b;
}

const minmax = (rows) => ({
  min: rows[0].map((_, c) => rows.reduce((m, r) => Math.min(m, r[c]), Infinity)),
  max: rows[0].map((_, c) => rows.reduce((m, r) => Math.max(m, r[c]), -Infinity)),
});

/**
 * Escreve o GLB com uma primitiva indexada: POSITION, NORMAL, TEXCOORD_0
 * e, se vier `cor`, COLOR_0 em RGB de 8 bits normalizado (um quarto do
 * tamanho de float e o GLTFLoader lê igual). Os índices vão em uint16
 * quando cabem. Nós, materiais e cena vêm do JSON original — a origem, a
 * escala e o nome do mesh ficam como estavam.
 */
function escreverGlb(json, malha, notaDeModificacao) {
  const { pos, nrm, uv, tris, cor } = malha;
  const idx = tris.flat();
  const idx16 = pos.length <= 65535;
  const idxBuf = Buffer.alloc(idx.length * (idx16 ? 2 : 4));
  idx.forEach((i, k) => (idx16 ? idxBuf.writeUInt16LE(i, k * 2) : idxBuf.writeUInt32LE(i, k * 4)));
  const partes = [f32(pos), f32(nrm), f32(uv)];
  if (cor) {
    // 3 bytes por vértice; o stride de 4 mantém o alinhamento que o glTF exige.
    const cb = Buffer.alloc(cor.length * 4);
    cor.forEach((c, k) => { for (let j = 0; j < 3; j++) cb.writeUInt8(Math.round(Math.max(0, Math.min(1, c[j])) * 255), k * 4 + j); });
    partes.push(cb);
  }
  partes.push(idxBuf);
  let offset = 0;
  const bufferViews = partes.map((p, i) => {
    const bv = { buffer: 0, byteOffset: offset, byteLength: p.length, target: i === partes.length - 1 ? 34963 : 34962 };
    if (cor && i === 3) bv.byteStride = 4;
    offset += p.length + pad4(p.length);
    return bv;
  });
  const binNovo = Buffer.concat(partes.flatMap((p) => [p, Buffer.alloc(pad4(p.length))]));
  const accessors = [
    { bufferView: 0, componentType: 5126, count: pos.length, type: "VEC3", ...minmax(pos) },
    { bufferView: 1, componentType: 5126, count: nrm.length, type: "VEC3" },
    { bufferView: 2, componentType: 5126, count: uv.length, type: "VEC2" },
  ];
  const attributes = { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 };
  if (cor) {
    accessors.push({ bufferView: 3, componentType: 5121, normalized: true, count: cor.length, type: "VEC3" });
    attributes.COLOR_0 = 3;
  }
  accessors.push({ bufferView: partes.length - 1, componentType: idx16 ? 5123 : 5125, count: idx.length, type: "SCALAR" });
  const prim = json.meshes[0].primitives[0];
  const extrasAntigos = (json.asset && json.asset.extras) || {};
  const jsonNovo = {
    asset: {
      ...(json.asset || {}), version: "2.0",
      extras: { ...extrasAntigos, modificado: [extrasAntigos.modificado, notaDeModificacao].filter(Boolean).join("; ") },
    },
    scene: json.scene, scenes: json.scenes, nodes: json.nodes, materials: json.materials,
    meshes: [{ name: json.meshes[0].name, primitives: [{ attributes, indices: accessors.length - 1, material: prim.material, mode: 4 }] }],
    accessors, bufferViews, buffers: [{ byteLength: binNovo.length }],
  };
  let jsonBuf = Buffer.from(JSON.stringify(jsonNovo), "utf8");
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length), 0x20)]);
  const total = 12 + 8 + jsonBuf.length + 8 + binNovo.length;
  const cab = Buffer.alloc(12); cab.write("glTF", 0); cab.writeUInt32LE(2, 4); cab.writeUInt32LE(total, 8);
  const cj = Buffer.alloc(8); cj.writeUInt32LE(jsonBuf.length, 0); cj.write("JSON", 4);
  const cb = Buffer.alloc(8); cb.writeUInt32LE(binNovo.length, 0); cb.write("BIN\0", 4);
  return Buffer.concat([cab, cj, jsonBuf, cb, binNovo]);
}

// ── Topologia ────────────────────────────────────────────────

/**
 * Id soldado por vértice: quem está na mesma posição (a `eps`) é o mesmo
 * ponto da superfície, mesmo que o glTF tenha duplicado o vértice para a
 * costura de UV ou para uma aresta dura.
 */
function soldar(pos, eps = 1e-5) {
  const chave = (p) => p.map((x) => Math.round(x / eps)).join(",");
  const mapa = new Map();
  const ids = new Array(pos.length);
  for (let i = 0; i < pos.length; i++) {
    const k = chave(pos[i]);
    if (!mapa.has(k)) mapa.set(k, mapa.size);
    ids[i] = mapa.get(k);
  }
  return ids;
}

const chaveAresta = (a, b) => (a < b ? a + "_" + b : b + "_" + a);

/**
 * Arestas da malha SOLDADA com quantos triângulos usam cada uma: 1 =
 * borda (gola, mangas, barra), 2 = interior, 3+ = não-manifold. Serve de
 * teste de que a subdivisão não abriu nem colou nada.
 */
function estatisticasDeArestas(tris, ids) {
  const uso = new Map();
  for (const [a, b, c] of tris) {
    const w = [ids[a], ids[b], ids[c]];
    for (let e = 0; e < 3; e++) {
      const k = chaveAresta(w[e], w[(e + 1) % 3]);
      uso.set(k, (uso.get(k) || 0) + 1);
    }
  }
  const r = { borda: 0, interior: 0, naoManifold: 0 };
  for (const n of uso.values()) {
    if (n === 1) r.borda++;
    else if (n === 2) r.interior++;
    else r.naoManifold++;
  }
  return r;
}

/** Ilhas de UV: componentes conexas pelos índices NÃO soldados (a costura separa). */
function ilhasDeUv(pos, uv, tris) {
  const adj = Array.from({ length: pos.length }, () => []);
  for (const [a, b, c] of tris) {
    adj[a].push(b, c); adj[b].push(a, c); adj[c].push(a, b);
  }
  const comp = new Int32Array(pos.length).fill(-1);
  const ilhas = [];
  for (let i = 0; i < pos.length; i++) {
    if (comp[i] >= 0) continue;
    const ilha = { vertices: 0, u0: Infinity, v0: Infinity, u1: -Infinity, v1: -Infinity };
    const pilha = [i];
    comp[i] = ilhas.length;
    while (pilha.length) {
      const v = pilha.pop();
      ilha.vertices++;
      ilha.u0 = Math.min(ilha.u0, uv[v][0]); ilha.u1 = Math.max(ilha.u1, uv[v][0]);
      ilha.v0 = Math.min(ilha.v0, uv[v][1]); ilha.v1 = Math.max(ilha.v1, uv[v][1]);
      for (const w of adj[v]) if (comp[w] < 0) { comp[w] = ilhas.length; pilha.push(w); }
    }
    ilhas.push(ilha);
  }
  return ilhas;
}

// ── Subdivisão de Loop ───────────────────────────────────────

const soma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const escala = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/**
 * Uma passada de Loop. As posições seguem a topologia SOLDADA (a
 * silhueta fica lisa através das costuras de UV); as UVs seguem a
 * topologia original e os vértices antigos não mudam de UV — assim cada
 * ilha continua ocupando exatamente o retângulo de antes e as áreas
 * `front`/`back` da spec seguem valendo. Na borda (gola, barra, boca da
 * manga) vale a regra de borda de Loop: a curva fica suave e não encolhe
 * para dentro da superfície.
 *
 * O vértice novo de cada aresta ganha a UV com OS MESMOS PESOS da
 * posição (3/8 das pontas + 1/8 dos opostos), não o ponto médio: a malha
 * de origem tem leques ao longo da linha central do peito em que os dois
 * opostos de uma aresta horizontal estão na própria linha central, e a
 * posição de Loop é puxada para lá. Com a UV no meio da aresta, a arte
 * ficava beliscada numa faixa de 1 cm no centro da estampa (o "u" de
 * "Aura" com um bico). Na costura, onde só uma das faces está na ilha,
 * fica o ponto médio.
 */
function subdividirLoop(malha) {
  const { pos, uv, tris, ids } = malha;
  const nIds = ids.reduce((m, i) => Math.max(m, i), -1) + 1;
  const posSoldada = new Array(nIds);
  for (let i = 0; i < pos.length; i++) if (!posSoldada[ids[i]]) posSoldada[ids[i]] = pos[i];

  // Arestas soldadas: faces que as usam e o vértice oposto em cada uma.
  // E as arestas NÃO soldadas com os seus opostos, para a UV.
  const arestas = new Map(); // chave → { a, b, opostos: [] }
  const opostosUv = new Map(); // chave não soldada → [índices opostos]
  const vizinhos = Array.from({ length: nIds }, () => new Set());
  for (const tri of tris) {
    const w = tri.map((i) => ids[i]);
    for (let e = 0; e < 3; e++) {
      const a = w[e], b = w[(e + 1) % 3], c = w[(e + 2) % 3];
      const k = chaveAresta(a, b);
      if (!arestas.has(k)) arestas.set(k, { a, b, opostos: [] });
      arestas.get(k).opostos.push(c);
      vizinhos[a].add(b); vizinhos[b].add(a);
      const ku = chaveAresta(tri[e], tri[(e + 1) % 3]);
      if (!opostosUv.has(ku)) opostosUv.set(ku, []);
      opostosUv.get(ku).push(tri[(e + 2) % 3]);
    }
  }
  const naBorda = Array.from({ length: nIds }, () => []);
  for (const ar of arestas.values()) {
    if (ar.opostos.length === 1) { naBorda[ar.a].push(ar.b); naBorda[ar.b].push(ar.a); }
  }

  // Vértices antigos ("pares"): posição nova por id soldado.
  const posParNova = new Array(nIds);
  for (let w = 0; w < nIds; w++) {
    const P = posSoldada[w];
    if (!P) continue;
    if (naBorda[w].length === 2) {
      // borda: 3/4 do próprio + 1/8 de cada vizinho de borda
      posParNova[w] = soma(escala(P, 0.75), escala(soma(posSoldada[naBorda[w][0]], posSoldada[naBorda[w][1]]), 0.125));
    } else if (naBorda[w].length > 2) {
      posParNova[w] = P; // canto onde várias bordas se tocam: fica onde está
    } else {
      const viz = [...vizinhos[w]];
      const n = viz.length;
      if (n < 3) { posParNova[w] = P; continue; }
      const t = 3 / 8 + Math.cos((2 * Math.PI) / n) / 4;
      const beta = (1 / n) * (5 / 8 - t * t);
      let acc = [0, 0, 0];
      for (const v of viz) acc = soma(acc, posSoldada[v]);
      posParNova[w] = soma(escala(P, 1 - n * beta), escala(acc, beta));
    }
  }

  // Vértices novos ("ímpares"): um por aresta NÃO soldada (para ter UV
  // própria de cada lado da costura), com a posição da aresta soldada
  // (igual dos dois lados — a costura continua fechada).
  const posImpar = new Map(); // chave soldada → posição
  const idImpar = new Map();  // chave soldada → id soldado novo
  for (const [k, ar] of arestas) {
    const A = posSoldada[ar.a], B = posSoldada[ar.b];
    let p;
    if (ar.opostos.length === 2) {
      p = soma(escala(soma(A, B), 3 / 8), escala(soma(posSoldada[ar.opostos[0]], posSoldada[ar.opostos[1]]), 1 / 8));
    } else {
      p = escala(soma(A, B), 0.5);
    }
    posImpar.set(k, p);
    idImpar.set(k, nIds + idImpar.size);
  }

  const posNova = pos.map((_, i) => posParNova[ids[i]] || pos[i]);
  const uvNova = uv.map((q) => q.slice());
  const idsNovos = ids.slice();
  const meio = new Map(); // chave não soldada → índice do vértice novo
  const vertice = (a, b) => {
    const k = chaveAresta(a, b);
    let i = meio.get(k);
    if (i === undefined) {
      const ks = chaveAresta(ids[a], ids[b]);
      i = posNova.length;
      posNova.push(posImpar.get(ks));
      const op = opostosUv.get(k) || [];
      if (op.length === 2) {
        const [c, d] = op;
        uvNova.push([
          (uv[a][0] + uv[b][0]) * 3 / 8 + (uv[c][0] + uv[d][0]) / 8,
          (uv[a][1] + uv[b][1]) * 3 / 8 + (uv[c][1] + uv[d][1]) / 8,
        ]);
      } else {
        uvNova.push([(uv[a][0] + uv[b][0]) / 2, (uv[a][1] + uv[b][1]) / 2]);
      }
      idsNovos.push(idImpar.get(ks));
      meio.set(k, i);
    }
    return i;
  };
  const trisNovos = [];
  for (const [a, b, c] of tris) {
    const ab = vertice(a, b), bc = vertice(b, c), ca = vertice(c, a);
    trisNovos.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
  }
  return { pos: posNova, uv: uvNova, tris: trisNovos, ids: idsNovos };
}

// ── Normais ──────────────────────────────────────────────────

function normalDaFace(pos, [a, b, c]) {
  const A = pos[a], B = pos[b], C = pos[c];
  const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  // Sem normalizar: o comprimento é 2× a área, e é o peso que a normal do vértice quer.
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}

function normalizar(n) {
  const l = Math.hypot(n[0], n[1], n[2]);
  return l > 0 ? [n[0] / l, n[1] / l, n[2] / l] : [0, 0, 1];
}

/**
 * Normais suaves pela topologia soldada, ponderadas por área, mas só
 * entre faces com menos de `anguloGraus` entre si: a bainha da barra dobra
 * 180° sobre si mesma e, misturada, viraria uma faixa escura tangente.
 * Cada vértice do glTF recebe a média das faces do seu ponto soldado
 * que estão no "grupo de suavização" da própria face média dele.
 */
function normaisSuaves(pos, tris, ids, anguloGraus = 80) {
  const nIds = ids.reduce((m, i) => Math.max(m, i), -1) + 1;
  const facesPorId = Array.from({ length: nIds }, () => []);
  const facesPorVertice = Array.from({ length: pos.length }, () => []);
  const nf = tris.map((t) => normalDaFace(pos, t));
  tris.forEach((t, f) => t.forEach((i) => { facesPorId[ids[i]].push(f); facesPorVertice[i].push(f); }));
  const limite = Math.cos((anguloGraus * Math.PI) / 180);
  return pos.map((_, i) => {
    let propria = [0, 0, 0];
    for (const f of facesPorVertice[i]) propria = soma(propria, nf[f]);
    propria = normalizar(propria);
    let acc = [0, 0, 0];
    for (const f of facesPorId[ids[i]]) {
      const n = normalizar(nf[f]);
      if (n[0] * propria[0] + n[1] * propria[1] + n[2] * propria[2] >= limite) acc = soma(acc, nf[f]);
    }
    return normalizar(acc[0] || acc[1] || acc[2] ? acc : propria);
  });
}

// ── Dobras ───────────────────────────────────────────────────

/** Gerador determinístico (LCG): a mesma semente dá sempre a mesma camiseta. */
function criarRnd(semente) {
  let s = semente >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Ruído de valor 3D com interpolação suave, em [-1, 1], de uma tabela de
 * permutação semeada. Baixa frequência por construção: quem chama escolhe
 * o comprimento de onda e soma no máximo duas oitavas.
 */
function criarRuido(semente) {
  const rnd = criarRnd(semente);
  const perm = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const valor = (x, y, z) => perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 127.5 - 1;
  const suave = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const tx = suave(x - xi), ty = suave(y - yi), tz = suave(z - zi);
    const c = (dx, dy, dz) => valor(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), tx), lerp(c(0, 1, 0), c(1, 1, 0), tx), ty),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), tx), lerp(c(0, 1, 1), c(1, 1, 1), tx), ty),
      tz,
    );
  };
}

/** Vértices soldados que estão numa aresta de borda (gola, barra, boca das mangas). */
function idsDeBorda(tris, ids) {
  const uso = new Map();
  for (const [a, b, c] of tris) {
    const w = [ids[a], ids[b], ids[c]];
    for (let e = 0; e < 3; e++) {
      const k = chaveAresta(w[e], w[(e + 1) % 3]);
      uso.set(k, (uso.get(k) || 0) + 1);
    }
  }
  const borda = new Set();
  for (const [k, n] of uso) if (n === 1) k.split("_").forEach((i) => borda.add(+i));
  return borda;
}

/**
 * Onde a camiseta pode enrugar, de 0 a 1, dado o ponto e a caixa do modelo.
 *   - barra e abdômen (terço de baixo do corpo): 1
 *   - faixa do peito, onde a arte vai: quase nada na frente (0,12),
 *     um pouco mais nas costas (0,3)
 *   - ombros e gola: 0
 *   - mangas (fora da largura do corpo): 0,9
 * `larguraDoCorpo` é o |x| onde o tronco acaba e a manga começa.
 */
function pesoDasDobras(p, caixa, larguraDoCorpo) {
  const t = (p[1] - caixa.min[1]) / (caixa.max[1] - caixa.min[1]); // 0 = barra, 1 = gola
  const x = Math.abs(p[0]);
  if (x > larguraDoCorpo) {
    // manga: cheia, mas cai a zero antes da costura do ombro para não puxar o tronco
    const k = Math.min(1, (x - larguraDoCorpo) / (larguraDoCorpo * 0.15));
    return 0.9 * k;
  }
  if (t > 0.9) return 0;
  const frente = p[2] > (caixa.min[2] + caixa.max[2]) / 2;
  const peito = frente ? 0.12 : 0.3;
  if (t < 0.28) return 1;
  if (t < 0.38) return 1 + (peito - 1) * ((t - 0.28) / 0.1);
  if (t < 0.78) return peito;
  return peito * (1 - (t - 0.78) / 0.12);
}

/**
 * Desloca cada vértice ao longo da sua normal por ruído de baixa
 * frequência, com a mesma amplitude para todos os vértices de um mesmo
 * ponto soldado (a costura não abre). O ruído é alongado em y (dobras de
 * roupa pendurada correm na vertical), some perto das bordas (a gola e as
 * bainhas continuam limpas) e é pesado por região (pesoDasDobras).
 *
 *   amplitude       em unidades do modelo (a camiseta tem 0,35 de altura ≈ 70 cm)
 *   comprimento     comprimento de onda em unidades do modelo
 *   margemDaBorda   distância em que o deslocamento cai a zero perto de uma borda
 *   peso            opcional, (ponto, caixa) → 0..1 no lugar de pesoDasDobras
 */
function aplicarDobras(malha, nrm, opcoes) {
  const { pos, tris, ids } = malha;
  const { amplitude, comprimento, semente = 7, margemDaBorda = 0.02, larguraDoCorpo, peso } = opcoes;
  // `peso` (ponto, caixa) → 0..1 deixa quem chama somar as próprias regiões
  // (a camiseta gerada zera a barra e as bocas); sem ele vale pesoDasDobras.
  const pesoEm = typeof peso === "function" ? peso : (p, cx) => pesoDasDobras(p, cx, larguraDoCorpo);
  const caixa = minmax(pos);
  const ruido = criarRuido(semente);
  const ruido2 = criarRuido(semente + 101);
  const borda = idsDeBorda(tris, ids);
  const pontosDeBorda = [];
  const visto = new Set();
  pos.forEach((p, i) => { if (borda.has(ids[i]) && !visto.has(ids[i])) { visto.add(ids[i]); pontosDeBorda.push(p); } });
  const distBorda = (p) => {
    let m = Infinity;
    for (const q of pontosDeBorda) {
      const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      if (d < m) m = d;
    }
    return Math.sqrt(m);
  };
  // Normal média por id soldado: deslocar por ela (e não pela normal de
  // cada cópia) é o que mantém as cópias juntas.
  const nIds = ids.reduce((m, i) => Math.max(m, i), -1) + 1;
  const normalPorId = new Array(nIds).fill(null).map(() => [0, 0, 0]);
  pos.forEach((_, i) => { normalPorId[ids[i]] = soma(normalPorId[ids[i]], nrm[i]); });
  const deslocamentoPorId = new Array(nIds);
  const posNova = pos.map((p, i) => {
    const w = ids[i];
    if (deslocamentoPorId[w] === undefined) {
      const n = normalizar(normalPorId[w]);
      const peso = pesoEm(p, caixa) * Math.min(1, distBorda(p) / margemDaBorda);
      const r = ruido(p[0] / comprimento, p[1] / (comprimento * 2.2), p[2] / comprimento)
        + 0.45 * ruido2(p[0] / (comprimento * 0.5), p[1] / (comprimento * 1.1), p[2] / (comprimento * 0.5));
      deslocamentoPorId[w] = escala(n, amplitude * peso * r);
    }
    return soma(p, deslocamentoPorId[w]);
  });
  return { ...malha, pos: posNova };
}

// ── Oclusão ──────────────────────────────────────────────────

/**
 * Oclusão por vértice (COLOR_0, multiplica a textura no viewer): sombra
 * macia nas axilas e sob a gola — onde uma foto de manequim fantasma
 * escurece e um render liso não. Geometria em vez de UV chutada: os
 * pontos das axilas são onde a manga encontra o tronco por baixo.
 *
 *   axilas    [[x,y,z], ...]  centro de cada axila
 *   raioAxila alcance da sombra da axila (unidades do modelo)
 *   forcaAxila / forcaGola   quanto escurece no centro (0–1)
 */
function oclusaoPorVertice(malha, opcoes) {
  const { pos, tris, ids } = malha;
  const { axilas = [], raioAxila = 0.05, forcaAxila = 0.4, raioGola = 0.03, forcaGola = 0.2 } = opcoes;
  const caixa = minmax(pos);
  const borda = idsDeBorda(tris, ids);
  // A gola é a borda mais alta: pontos de borda no quarto de cima do modelo.
  const limiteGola = caixa.min[1] + (caixa.max[1] - caixa.min[1]) * 0.75;
  const gola = [];
  const visto = new Set();
  pos.forEach((p, i) => {
    if (borda.has(ids[i]) && p[1] > limiteGola && Math.abs(p[0]) < (caixa.max[0] - caixa.min[0]) * 0.2 && !visto.has(ids[i])) {
      visto.add(ids[i]); gola.push(p);
    }
  });
  return pos.map((p) => {
    let escuro = 0;
    for (const a of axilas) {
      const d = Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) / raioAxila;
      escuro = Math.max(escuro, forcaAxila * Math.exp(-d * d));
    }
    if (gola.length && p[1] > limiteGola) {
      let m = Infinity;
      for (const q of gola) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < m) m = d; }
      const d = Math.sqrt(m) / raioGola;
      escuro = Math.max(escuro, forcaGola * Math.exp(-d * d));
    }
    const b = 1 - escuro;
    return [b, b, b];
  });
}

module.exports = {
  lerGlb, escreverGlb, soldar, estatisticasDeArestas, ilhasDeUv, subdividirLoop,
  normaisSuaves, criarRuido, pesoDasDobras, aplicarDobras, oclusaoPorVertice, minmax,
};
