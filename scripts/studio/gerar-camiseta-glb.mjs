#!/usr/bin/env node
// ============================================================
// scripts/studio/gerar-camiseta-glb.mjs — 27/09/2026
//
// Gera a public/models/camiseta-basica.glb do zero: um modelo original da
// Aura, sem asset de terceiros. A malha vem de camisetaParametrica.js
// (corpo por seções transversais suavizadas, mangas soldadas na cava,
// ribana e bainhas com espessura, UV em ilhas retangulares com os painéis
// da frente e das costas em projeção planar isotrópica) e o acabamento de
// refinarMalha.js (uma passada de Loop, normais suaves, dobras por ruído
// com semente fixa, oclusão por vértice em COLOR_0). Os parâmetros de
// molde ficam no topo de camisetaParametrica.js.
//
// Uso:
//   node scripts/studio/gerar-camiseta-glb.mjs [saida.glb] [--passadas=1] [--sem-dobras] [--sem-oclusao]
//   node scripts/studio/gerar-camiseta-glb.mjs --areas
//        (imprime as áreas `front`/`back` para a spec camiseta-basica-3d.json)
//
// Reproduzir a camiseta-basica.glb publicada:
//   node scripts/studio/gerar-camiseta-glb.mjs public/models/camiseta-basica.glb
// ============================================================
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { gerarCamisetaGlb, areasDaSpec, estatisticasDeArestas, PARAMETROS } = require("./camisetaParametrica.js");
const { soldar, ilhasDeUv, minmax } = require("./refinarMalha.js");

const args = process.argv.slice(2);
const saida = args.find((a) => !a.startsWith("--")) || "public/models/camiseta-basica.glb";
const opcao = (nome, padrao) => {
  const a = args.find((x) => x.startsWith("--" + nome + "="));
  if (!a) return padrao;
  const n = parseFloat(a.slice(nome.length + 3));
  return Number.isFinite(n) ? n : padrao;
};

if (args.includes("--areas")) {
  console.log(JSON.stringify(areasDaSpec(PARAMETROS), null, 2));
  process.exit(0);
}

const t0 = Date.now();
const { base, refinada, glb, nota } = gerarCamisetaGlb(PARAMETROS, {
  passadas: Math.max(0, Math.min(3, Math.round(opcao("passadas", PARAMETROS.passadasDeLoop)))),
  semDobras: args.includes("--sem-dobras"),
  semOclusao: args.includes("--sem-oclusao"),
});

function medir(rotulo, m) {
  const ar = estatisticasDeArestas(m.tris, m.ids || soldar(m.pos));
  const ilhas = ilhasDeUv(m.pos, m.uv, m.tris);
  const caixa = minmax(m.pos);
  console.log(
    rotulo + ": vértices " + m.pos.length + " · triângulos " + m.tris.length +
    " · arestas borda/interior/não-manifold " + ar.borda + "/" + ar.interior + "/" + ar.naoManifold +
    " · ilhas de UV " + ilhas.length +
    " · caixa " + caixa.min.map((x) => x.toFixed(3)).join(",") + " → " + caixa.max.map((x) => x.toFixed(3)).join(","),
  );
}

medir("base (cm)", base);
medir("refinada (m)", refinada);
fs.writeFileSync(saida, glb);
console.log("bytes", glb.length, "·", saida, "·", (Date.now() - t0) + " ms");
console.log(nota);
