// ============================================================
// AURA. — Testes: etiqueta "Bobina 58mm" + gerar código na grade
// (24/09/2026, loja Essencial — térmica genérica 58mm Bluetooth)
//
// O que estes testes travam:
//   1. o preset 58mm é 1 etiqueta por linha, centralizada em 58mm, com
//      barcode próprio (módulo 0,375mm = 3 pontos da térmica de 203dpi)
//   2. os presets antigos NÃO ganham nada do 58mm (padl/cut/bcModule)
//   3. o "Gerar" da grade sai EAN-13 válido, prefixo 200, sem repetir
// ============================================================
jest.mock("@/utils/colorNames", () => ({ hexToName: (h: string) => h }));

import { novoCodigoDeBarras } from "@/components/screens/estoque/item-form/codigoDeBarras";
import { buildLabelHtml, isValidEAN13, LABEL_SIZE_PRESETS, LABEL_SIZE_KEYS } from "@/components/screens/estoque/labels/buildLabelHtml";

const item = { name: "Meia Arrastão", price: 20, barcode: "7891033948208", size: "M", color: "", qty: 2 };

describe("preset Bobina 58mm", () => {
  test("está na lista do seletor", () => {
    expect(LABEL_SIZE_KEYS).toEqual(["99x21", "30x25", "58mm"]);
    expect(LABEL_SIZE_PRESETS["58mm"].cols).toBe(1);
  });

  test("página 58mm, 1 por linha, centralizada e com corte", () => {
    const html = buildLabelHtml([item], { mode: "barcode", storeName: "Essencial", showStoreName: true, labelSize: "58mm" });
    expect(html).toContain("@page{margin:0;size:58mm 28mm}");
    expect(html).toContain(".padl{width:6mm;");
    expect(html).toContain(".padr{width:6mm;");
    expect((html.match(/<tr>/g) || []).length).toBe(2);
    expect(html).toContain("background-image:linear-gradient");
    // barcode em mm físicos: módulo 0,375 e altura 9mm (24 módulos)
    expect(html).toContain("opts={width:1,height:24,");
    expect(html).toContain("var m=0.375;");
  });

  test.each(["99x21", "30x25"] as const)("%s não herda nada do 58mm", (size) => {
    const html = buildLabelHtml([item], { mode: "barcode", storeName: "Essencial", showStoreName: true, labelSize: size });
    expect(html).not.toContain("padl");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("var m=");
  });
});

describe("Gerar código de barras na grade", () => {

  test("EAN-13 válido, prefixo 200, sem repetir", () => {
    const usados = new Set<string>();
    const codigos = Array.from({ length: 200 }, (_, i) => novoCodigoDeBarras("k" + (i % 4), usados));
    codigos.forEach((c: string) => { expect(isValidEAN13(c)).toBe(true); expect(c.startsWith("200")).toBe(true); });
    expect(new Set(codigos).size).toBe(200);
  });

  test("não devolve código já em uso", () => {
    const usados = new Set<string>();
    const a = novoCodigoDeBarras("x", usados);
    expect(usados.has(a)).toBe(true);
    const b = novoCodigoDeBarras("x", usados);
    expect(b).not.toBe(a);
  });
});
