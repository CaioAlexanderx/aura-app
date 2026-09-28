#!/usr/bin/env node
// ============================================================
// scripts/studio/refinar-camiseta-glb.mjs — 27/09/2026
//
// Transforma a camiseta low-poly (saída de encurtar-mangas-glb.mjs) na
// camiseta-basica.glb que o viewer mostra: subdivisão de Loop (uma ou
// duas passadas) para a silhueta perder as facetas, normais suaves,
// dobras discretas por ruído de baixa frequência com semente fixa (mais
// no abdômen e nas mangas, quase nada no peito onde a arte vai) e
// oclusão por vértice nas axilas e sob a gola. Nome do mesh, origem,
// escala e material ficam como no original; as UVs são interpoladas, e
// por isso as áreas `front`/`back` da spec continuam valendo.
// Sem dependências: lê e escreve o GLB à mão (refinarMalha.js).
//
// Uso:
//   node scripts/studio/refinar-camiseta-glb.mjs entrada.glb saida.glb [--passadas=2]
//        [--amplitude=0.0022] [--comprimento=0.05] [--semente=7] [--sem-dobras] [--sem-oclusao]
//   node scripts/studio/refinar-camiseta-glb.mjs entrada.glb --relatorio
//        (só mede: vértices, triângulos, arestas, ilhas de UV)
//
// Reproduzir a camiseta-basica.glb publicada:
//   node scripts/studio/encurtar-mangas-glb.mjs original.glb mangas-curtas.glb --corte=0.245
//   node scripts/studio/refinar-camiseta-glb.mjs mangas-curtas.glb public/models/camiseta-basica.glb
// ============================================================
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  lerGlb, escreverGlb, soldar, estatisticasDeArestas, ilhasDeUv, subdividirLoop,
  normaisSuaves, aplicarDobras, oclusaoPorVertice, minmax,
} = require("./refinarMalha.js");

const args = process.argv.slice(2);
const entrada = args[0];
const saida = args.find((a, i) => i > 0 && !a.startsWith("--"));
const opcao = (nome, padrao) => {
  const a = args.find((x) => x.startsWith("--" + nome + "="));
  if (!a) return padrao;
  const n = parseFloat(a.slice(nome.length + 3));
  return Number.isFinite(n) ? n : padrao;
};
const relatorio = args.includes("--relatorio");
if (!entrada || (!relatorio && !saida)) {
  console.error("Uso: refinar-camiseta-glb.mjs entrada.glb saida.glb [--passadas=2] [--amplitude=0.0022] [--comprimento=0.05] [--semente=7] [--sem-dobras] [--sem-oclusao]  |  entrada.glb --relatorio");
  process.exit(2);
}

// Números afinados para o "T Shirt" do Nour depois do corte das mangas
// (altura 0,346 ≈ 70 cm, logo 1 cm ≈ 0,005): dobras de ~4 mm com onda de
// ~10 cm; o tronco acaba em |x| = 0,13; as axilas ficam onde a manga
// encontra o tronco por baixo.
const PASSADAS = Math.max(0, Math.min(3, Math.round(opcao("passadas", 2))));
const AMPLITUDE = opcao("amplitude", 0.0022);
const COMPRIMENTO = opcao("comprimento", 0.05);
const SEMENTE = Math.round(opcao("semente", 7));
const LARGURA_DO_CORPO = 0.13;
const AXILAS = [[-0.128, 0.766, -0.03], [0.128, 0.766, -0.03]];

const buf = fs.readFileSync(entrada);
const lido = lerGlb(buf);
let malha = { pos: lido.pos, uv: lido.uv, tris: lido.tris, ids: soldar(lido.pos) };

function medir(rotulo, m) {
  const ar = estatisticasDeArestas(m.tris, m.ids);
  const ilhas = ilhasDeUv(m.pos, m.uv, m.tris);
  const caixa = minmax(m.pos);
  console.log(
    rotulo + ": vértices " + m.pos.length + " · triângulos " + m.tris.length +
    " · arestas borda/interior/não-manifold " + ar.borda + "/" + ar.interior + "/" + ar.naoManifold +
    " · ilhas de UV " + ilhas.length +
    " · caixa " + caixa.min.map((x) => x.toFixed(3)).join(",") + " → " + caixa.max.map((x) => x.toFixed(3)).join(","),
  );
  return ilhas;
}

const ilhasAntes = medir("entrada", malha);
if (relatorio) {
  for (const [i, il] of ilhasAntes.entries()) {
    console.log("  ilha", i, "vértices", il.vertices, "u", il.u0.toFixed(3), "→", il.u1.toFixed(3), "v", il.v0.toFixed(3), "→", il.v1.toFixed(3));
  }
  process.exit(0);
}

for (let p = 0; p < PASSADAS; p++) malha = subdividirLoop(malha);
let nrm = normaisSuaves(malha.pos, malha.tris, malha.ids);
if (!args.includes("--sem-dobras") && AMPLITUDE > 0) {
  malha = aplicarDobras(malha, nrm, { amplitude: AMPLITUDE, comprimento: COMPRIMENTO, semente: SEMENTE, larguraDoCorpo: LARGURA_DO_CORPO });
  nrm = normaisSuaves(malha.pos, malha.tris, malha.ids);
}
const cor = args.includes("--sem-oclusao") ? null : oclusaoPorVertice(malha, { axilas: AXILAS });

const nota = "refinado por scripts/studio/refinar-camiseta-glb.mjs (Loop x" + PASSADAS + ", normais suaves" +
  (AMPLITUDE > 0 && !args.includes("--sem-dobras") ? ", dobras amplitude " + AMPLITUDE + " comprimento " + COMPRIMENTO + " semente " + SEMENTE : "") +
  (cor ? ", oclusão por vértice" : "") + ")";
fs.writeFileSync(saida, escreverGlb(lido.json, { ...malha, nrm, cor }, nota));
medir("saída", malha);
console.log("bytes", fs.statSync(saida).size, "·", nota);
