// ============================================================================
// AURA. — Minha medida: código de barras da térmica (04/11/2026, Lulume)
//
// LABEL-9X20 de 203 dpi: com o código da Finesse (barra fina de 0,265 mm =
// 2,1 pontos) a impressora arredonda cada barra ora para 2, ora para 3
// pontos; as barras saem engordadas e a pistola não lê. Com `barrasTermicas`
// a medida usa o código próprio da térmica (bcModuleMm, o da bobina 58mm):
// barra fina em pontos exatos. O que este arquivo trava:
//   1. opt-in: sem a chave, byte a byte como antes;
//   2. o módulo escolhido: 0,375 mm (3 pontos) quando o EAN-13 cabe, senão
//      0,25 mm (2 pontos) com barra mais baixa;
//   3. o HTML: o script da térmica entra e o resto da etiqueta não muda;
//   4. o spec só ganha a chave com true; o wizard tem o checkbox.
// ============================================================================
import * as fs from "fs";
import * as path from "path";
import {
  comBarrasTermicas, customLabelPreset, moduloDasBarrasTermicas, sanitizarMedida, type CustomLabelSpec,
} from "@/components/screens/estoque/labels/customLabel";
import { buildLabelHtml } from "@/components/screens/estoque/labels/buildLabelHtml";

const LULUME: CustomLabelSpec = {
  id: "lulume-boutique", nome: "Boutique 40x25", estilo: "boutique", colunas: 2,
  larguraMm: 40, alturaMm: 25, espacoLadoMm: 2, espacoLinhaMm: 2.5, ajusteXMm: 2, ajusteYMm: 0, paginaEmPe: true,
};
const ITENS = [{ name: "Conjunto Camiseta Malha", price: 139.9, barcode: "2009795235398", size: "01", color: "#3B82F6", qty: 2 }];
const BASE = { mode: "barcode" as const, storeName: "Lulume Baby & Kids", showStoreName: true, labelSize: "40x25" as const };

describe("o módulo da barra", () => {
  // 2a rodada: 0,25 mm (76%) a pistola da Lulume nao leu; 0,375 mm e o que
  // leu na bobina 58mm. Com 2+3 modulos de branco no SVG, cabe em 40 mm.
  it("célula de 40 x 25: 0,375 mm (3 pontos), barra de 7 mm, zonas 2 e 3", () => {
    expect(moduloDasBarrasTermicas(40, 25)).toEqual({ bcModuleMm: 0.375, bcBarHeightMm: 7, bcMarginLeftMods: 2, bcMarginRightMods: 3 });
    expect(100 * 0.375).toBeLessThanOrEqual(40 - 2);
  });
  it("célula alta (30 mm ou mais): barra de 9 mm, como a bobina 58mm", () => {
    expect(moduloDasBarrasTermicas(46, 30).bcBarHeightMm).toBe(9);
    expect(moduloDasBarrasTermicas(46, 25).bcBarHeightMm).toBe(7);
  });
  it("célula estreita demais para 0,375 (menos de 39,5 mm): 0,25 mm (2 pontos)", () => {
    expect(moduloDasBarrasTermicas(39, 25).bcModuleMm).toBe(0.25);
    expect(moduloDasBarrasTermicas(35, 25).bcModuleMm).toBe(0.25);
  });
});

describe("o preset", () => {
  it("sem a chave: sem bcModuleMm (código LOCKED da Finesse)", () => {
    const p = customLabelPreset(LULUME);
    expect(p.bcModuleMm).toBeUndefined();
    expect(p.bcBarHeightMm).toBeUndefined();
  });
  it("com a chave: o código da térmica, e o resto do preset igual", () => {
    const sem = customLabelPreset(LULUME);
    const com = customLabelPreset({ ...LULUME, barrasTermicas: true });
    expect(com.bcModuleMm).toBe(0.375);
    expect(com.bcBarHeightMm).toBe(7);
    expect(com.bcMarginLeftMods).toBe(2);
    expect(com.bcMarginRightMods).toBe(3);
    const { bcModuleMm, bcBarHeightMm, bcMarginLeftMods, bcMarginRightMods, ...resto } = com;
    expect(resto).toEqual(sem);
  });
});

describe("o HTML", () => {
  it("sem a chave, byte a byte igual", () => {
    const a = buildLabelHtml(ITENS, { ...BASE, customSpec: LULUME });
    const b = buildLabelHtml(ITENS, { ...BASE, customSpec: sanitizarMedida({ ...LULUME, barrasTermicas: false })! });
    expect(b).toBe(a);
    expect(a).not.toContain("var m=");
  });
  it("com a chave: o script da térmica dimensiona o SVG em mm exatos; a página e o desenho não mudam", () => {
    const html = buildLabelHtml(ITENS, { ...BASE, customSpec: { ...LULUME, barrasTermicas: true } });
    expect(html).toContain("var m=0.375;");
    expect(html).toContain("opts={width:1,height:19,margin:0,marginLeft:2,marginRight:3,"); // 7 mm / 0,375 = 18,7
    expect(html).toContain(".bc-inner .bc-box{flex:0 0 auto;max-width:none;overflow:visible}");
    expect(html).toContain("@page{margin:0;size:82mm 82.5mm}");
    expect(html).toContain('<div class="bc-inner bq">');
    // o SVG e a dedupe do codigo continuam os mesmos
    const sem = buildLabelHtml(ITENS, { ...BASE, customSpec: LULUME });
    const svg = (h: string) => h.match(/<svg id="bc-0"[^>]*>/)![0];
    expect(svg(html)).toBe(svg(sem));
  });
  it("célula larga e alta (50x30): 0,375 mm com barra de 9 mm", () => {
    const html = buildLabelHtml(ITENS, { ...BASE, customSpec: { ...LULUME, estilo: undefined, larguraMm: 50, alturaMm: 30, colunas: 1, barrasTermicas: true } });
    expect(html).toContain("var m=0.375;");
    expect(html).toContain("opts={width:1,height:24,margin:0,marginLeft:2,marginRight:3,"); // 9 mm / 0,375
  });
  it("a bobina 58mm continua com as zonas de sempre (2 e 8): byte a byte", () => {
    const html = buildLabelHtml(ITENS, { mode: "barcode", storeName: "Loja", showStoreName: true, labelSize: "58mm" });
    expect(html).toContain("margin:0,marginLeft:2,marginRight:8,");
  });
});

describe("o spec e o wizard", () => {
  it("só true entra; comBarrasTermicas liga e desliga sem deixar lixo", () => {
    expect(sanitizarMedida({ ...LULUME, barrasTermicas: true })!.barrasTermicas).toBe(true);
    for (const v of [false, "true", 1, null]) {
      expect("barrasTermicas" in sanitizarMedida({ ...LULUME, barrasTermicas: v as any })!).toBe(false);
    }
    const ligado = comBarrasTermicas(LULUME, true);
    expect(ligado.barrasTermicas).toBe(true);
    expect(comBarrasTermicas(ligado, false)).toEqual(LULUME);
  });
  it("o wizard tem o checkbox no passo 1 e a linha no resumo", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "components", "screens", "estoque", "labels", "MinhaMedidaWizard.tsx"), "utf8");
    expect(src).toMatch(/testID="medida-barras-termicas"/);
    expect(src).toMatch(/Minha impressora é térmica de 203 dpi/);
    expect(src).toMatch(/comBarrasTermicas\(comPaginaEmPe\(base, emPe\), termica\)/);
    expect(src).toMatch(/linhaResumo\("Código de barras"/);
  });
});
