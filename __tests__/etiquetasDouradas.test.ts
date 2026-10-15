// ============================================================================
// AURA. — Etiquetas: fixtures douradas dos modelos fixos (15/10/2026)
//
// Gravadas de origin/main (48f5bf59) ANTES da "Minha medida" (medida livre
// em mm). Cobrem os 5 modelos fixos (99x21, 105x21, 30x25, 58mm, 40x25) ×
// etiqueta (EAN-13 com ajuste 0 e -2 mm, sem nome da loja, QR), impressão de
// teste (1 linha sem ajuste, 2 linhas com ajuste), pré-visualização e, nos
// modelos com calibração por computador, modo contínuo, deslocamento
// vertical e teste contínuo. Matriz em fixtures/etiquetas/casos.ts.
//
// Quem não usa a medida livre tem de imprimir EXATAMENTE o mesmo HTML.
// NUNCA regravar fixture para o teste passar.
// ============================================================================
import fs from "fs";
import path from "path";
import { casosDourados, MODELOS_FIXOS } from "./fixtures/etiquetas/casos";

const DIR = path.join(__dirname, "fixtures", "etiquetas");
const CASOS = casosDourados();

describe("etiquetas dos modelos fixos: byte a byte igual ao de antes da medida livre", () => {
  test("44 fixtures: 7 por modelo e mais 3 nos modelos com calibração", () => {
    expect(MODELOS_FIXOS).toEqual(["99x21", "105x21", "30x25", "58mm", "40x25"]);
    expect(CASOS.length).toBe(44);
    const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".html")).sort();
    expect(arquivos).toEqual(CASOS.map((c) => c.nome + ".html").sort());
  });

  test.each(CASOS.map((c) => [c.nome, c] as const))("%s", (_nome, c) => {
    const esperado = fs.readFileSync(path.join(DIR, c.nome + ".html"), "utf-8");
    expect(c.gerar()).toBe(esperado);
  });
});
