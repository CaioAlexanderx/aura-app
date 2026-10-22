// ============================================================================
// AURA. — Etiquetas: "Minha medida" byte a byte (22/10/2026)
//
// Fixtures gravadas de origin/main (7d7d05a0) ANTES do desenho "tag
// vertical". Toda medida que não é "em pé" (altura < 1,5 x largura) tem de
// imprimir EXATAMENTE o mesmo HTML de antes; na medida em pé, QR e o teste
// de posição também. Matriz em fixtures/etiquetas-medida/casos.ts.
//
// NUNCA regravar fixture para o teste passar.
// ============================================================================
import fs from "fs";
import path from "path";
import { casosMedida } from "./fixtures/etiquetas-medida/casos";

const DIR = path.join(__dirname, "fixtures", "etiquetas-medida");
const CASOS = casosMedida();

describe("Minha medida fora da regra da tag vertical: byte a byte igual ao de antes", () => {
  test("16 fixtures, uma por caso", () => {
    expect(CASOS.length).toBe(16);
    const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".html")).sort();
    expect(arquivos).toEqual(CASOS.map((c) => c.nome + ".html").sort());
  });

  test.each(CASOS.map((c) => [c.nome, c] as const))("%s", (_nome, c) => {
    const esperado = fs.readFileSync(path.join(DIR, c.nome + ".html"), "utf-8");
    expect(c.gerar()).toBe(esperado);
  });
});
