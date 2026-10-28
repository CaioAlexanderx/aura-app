// ============================================================================
// AURA. — Etiquetas: tag vertical com linha de dobra (dobraMm) — 28/10/2026
//
// Opção B do mockup (https://claude.ai/artifact/7brLRCqJvVV5sLLUxmicAD),
// escolhida pelo Caio para a tag couchê 35x60 da Doce Encanto (dobra a
// ~43 mm do topo): em cima da linha, furo, loja, nome, Cód, C/T e o código
// de barras terminando 1,5 mm acima da linha; embaixo, o preço maior,
// centralizado na faixa, com a linha "Cartão" logo abaixo.
//
// Só liga com dobraMm > 0 numa medida em pé (ehTagVertical). Sem dobra, TODA
// etiqueta sai byte a byte como antes: fixtures douradas de
// etiquetasDouradas.test.ts, etiquetaMedidaLivreDourada.test.ts e
// etiquetaTagVertical.test.ts (intocadas) e a fixture
// "tag-35x60-sem-dobra-3-produtos", gravada a partir da main antes do código.
// ============================================================================
import fs from "fs";
import path from "path";
import { casosSemDobra } from "./fixtures/etiquetas-tag-dobra/casos";

const DIR = path.join(__dirname, "fixtures", "etiquetas-tag-dobra");
const ler = (nome: string) => fs.readFileSync(path.join(DIR, nome + ".html"), "utf-8");

describe("sem dobra: byte a byte como na main", () => {
  test.each(casosSemDobra().map((c) => [c.nome, c] as const))("%s", (_nome, c) => {
    expect(c.gerar()).toBe(ler(c.nome));
  });
});
