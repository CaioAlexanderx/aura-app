#!/usr/bin/env node
// ============================================================
// scripts/studio/encurtar-mangas-glb.mjs — 27/09/2026
//
// Corta as mangas de um GLB de camiseta por dois planos verticais
// (x = ±corte), dividindo os triângulos que cruzam o plano e interpolando
// posição, normal e UV — a abertura fica limpa, como uma manga curta com
// bainha. Serviu para transformar o "T Shirt" do Nour (Poly Pizza,
// CC BY 3.0, manga longa com punho) na camiseta-basica.glb de manga
// curta. Sem dependências: lê e escreve o GLB à mão.
//
// Uso:
//   node scripts/studio/encurtar-mangas-glb.mjs entrada.glb saida.glb --corte=0.235
//   node scripts/studio/encurtar-mangas-glb.mjs entrada.glb --histograma
//     (lista quantos vértices há em cada faixa de |x| — a costura da manga
//      é um pico; cortar um pouco depois dela deixa a bainha do modelo)
//
// Só trata GLB com um mesh de uma primitiva indexada, com POSITION,
// NORMAL e TEXCOORD_0 em float32 — é o caso do modelo de origem.
// ============================================================
import fs from "node:fs";

const args = process.argv.slice(2);
const entrada = args[0];
const saida = args.find((a, i) => i > 0 && !a.startsWith("--"));
const corte = parseFloat((args.find((a) => a.startsWith("--corte=")) || "--corte=NaN").slice(8));
const histograma = args.includes("--histograma");
if (!entrada || (!histograma && (!saida || !Number.isFinite(corte)))) {
  console.error("Uso: encurtar-mangas-glb.mjs entrada.glb saida.glb --corte=<x>  |  entrada.glb --histograma");
  process.exit(2);
}

const buf = fs.readFileSync(entrada);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
const bin = buf.subarray(20 + jsonLen + 8);

function ler(i) {
  const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
  const comp = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
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
}

const prim = json.meshes[0].primitives[0];
const pos = ler(prim.attributes.POSITION);
const nrm = ler(prim.attributes.NORMAL);
const uv = ler(prim.attributes.TEXCOORD_0);
const idx = ler(prim.indices).map((r) => r[0]);

if (histograma) {
  const faixas = new Map();
  for (const p of pos) {
    const f = (Math.floor(Math.abs(p[0]) / 0.01) * 0.01).toFixed(2);
    faixas.set(f, (faixas.get(f) || 0) + 1);
  }
  for (const [f, n] of [...faixas.entries()].sort((a, b) => a[0] - b[0])) console.log(f, n);
  process.exit(0);
}

// ── Recorte ──────────────────────────────────────────────────
// Mantém o que está entre -corte e +corte. Cada plano é tratado por vez.
const V = { pos: pos.map((p) => p.slice()), nrm: nrm.map((p) => p.slice()), uv: uv.map((p) => p.slice()) };
let tris = [];
for (let t = 0; t < idx.length; t += 3) tris.push([idx[t], idx[t + 1], idx[t + 2]]);

function novoVertice(a, b, ta) {
  const lerp = (u, v) => u.map((x, i) => x + (v[i] - x) * ta);
  V.pos.push(lerp(V.pos[a], V.pos[b]));
  const n = lerp(V.nrm[a], V.nrm[b]);
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  V.nrm.push(n.map((x) => x / len));
  V.uv.push(lerp(V.uv[a], V.uv[b]));
  return V.pos.length - 1;
}

function recortar(triangulos, dentro, cruzamento) {
  const saida = [];
  for (const tri of triangulos) {
    const d = tri.map((i) => dentro(V.pos[i]));
    const nDentro = d.filter(Boolean).length;
    if (nDentro === 3) { saida.push(tri); continue; }
    if (nDentro === 0) continue;
    // gira o triângulo para o(s) vértice(s) de dentro virem primeiro,
    // preservando a orientação
    let [a, b, c] = tri, [da, db, dc] = d;
    while (!(nDentro === 1 ? da && !db && !dc : da && db && !dc)) {
      [a, b, c] = [b, c, a]; [da, db, dc] = [db, dc, da];
    }
    if (nDentro === 1) {
      const ab = novoVertice(a, b, cruzamento(V.pos[a], V.pos[b]));
      const ac = novoVertice(a, c, cruzamento(V.pos[a], V.pos[c]));
      saida.push([a, ab, ac]);
    } else {
      const bc = novoVertice(b, c, cruzamento(V.pos[b], V.pos[c]));
      const ac = novoVertice(a, c, cruzamento(V.pos[a], V.pos[c]));
      saida.push([a, b, bc], [a, bc, ac]);
    }
  }
  return saida;
}

// fração de a→b onde x cruza o plano
const cruzaEm = (x0) => (pa, pb) => (x0 - pa[0]) / (pb[0] - pa[0]);
tris = recortar(tris, (p) => p[0] <= corte, cruzaEm(corte));
tris = recortar(tris, (p) => p[0] >= -corte, cruzaEm(-corte));

// Compacta: só os vértices ainda usados.
const usados = new Map();
const novoIdx = [];
for (const tri of tris) for (const i of tri) {
  if (!usados.has(i)) usados.set(i, usados.size);
  novoIdx.push(usados.get(i));
}
const ordem = [...usados.keys()];
const P = ordem.map((i) => V.pos[i]), N = ordem.map((i) => V.nrm[i]), T = ordem.map((i) => V.uv[i]);

// ── Escreve o GLB ────────────────────────────────────────────
function f32(rows) {
  const b = Buffer.alloc(rows.length * rows[0].length * 4);
  let o = 0;
  for (const r of rows) for (const x of r) { b.writeFloatLE(x, o); o += 4; }
  return b;
}
const idxBuf = Buffer.alloc(novoIdx.length * 4);
novoIdx.forEach((i, k) => idxBuf.writeUInt32LE(i, k * 4));
const partes = [f32(P), f32(N), f32(T), idxBuf];
const pad4 = (n) => (4 - (n % 4)) % 4;
let offset = 0;
const bufferViews = partes.map((p, i) => {
  const bv = { buffer: 0, byteOffset: offset, byteLength: p.length, target: i === 3 ? 34963 : 34962 };
  offset += p.length + pad4(p.length);
  return bv;
});
const binNovo = Buffer.concat(partes.flatMap((p) => [p, Buffer.alloc(pad4(p.length))]));
const minmax = (rows) => ({
  min: rows[0].map((_, c) => Math.min(...rows.map((r) => r[c]))),
  max: rows[0].map((_, c) => Math.max(...rows.map((r) => r[c]))),
});
const accessors = [
  { bufferView: 0, componentType: 5126, count: P.length, type: "VEC3", ...minmax(P) },
  { bufferView: 1, componentType: 5126, count: N.length, type: "VEC3" },
  { bufferView: 2, componentType: 5126, count: T.length, type: "VEC2" },
  { bufferView: 3, componentType: 5125, count: novoIdx.length, type: "SCALAR" },
];
const jsonNovo = {
  asset: { ...(json.asset || {}), version: "2.0", extras: { ...(json.asset && json.asset.extras || {}), modificado: "mangas cortadas em x = ±" + corte + " por scripts/studio/encurtar-mangas-glb.mjs" } },
  scene: json.scene, scenes: json.scenes, nodes: json.nodes, materials: json.materials,
  meshes: [{ name: json.meshes[0].name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: prim.material, mode: 4 }] }],
  accessors, bufferViews, buffers: [{ byteLength: binNovo.length }],
};
let jsonBuf = Buffer.from(JSON.stringify(jsonNovo), "utf8");
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length), 0x20)]);
const total = 12 + 8 + jsonBuf.length + 8 + binNovo.length;
const cab = Buffer.alloc(12); cab.write("glTF", 0); cab.writeUInt32LE(2, 4); cab.writeUInt32LE(total, 8);
const cj = Buffer.alloc(8); cj.writeUInt32LE(jsonBuf.length, 0); cj.write("JSON", 4);
const cb = Buffer.alloc(8); cb.writeUInt32LE(binNovo.length, 0); cb.write("BIN\0", 4);
fs.writeFileSync(saida, Buffer.concat([cab, cj, jsonBuf, cb, binNovo]));
console.log("vértices", pos.length, "→", P.length, "· triângulos", idx.length / 3, "→", tris.length, "· bytes", fs.statSync(saida).size);
