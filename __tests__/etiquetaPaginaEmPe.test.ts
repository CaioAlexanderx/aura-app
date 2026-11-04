// ============================================================================
// AURA. — Minha medida: página em pé (04/11/2026, Lulume Baby & Kids)
//
// A página da medida livre é UMA linha, mais larga que alta (82 x 27,5 mm), e
// o driver da LABEL-9X20 no Mac imprimia isso deitado: etiqueta de lado e
// código de barras borrado (reamostrado). O Chrome não deixa girar quando a
// página tem tamanho fixo. Com `paginaEmPe`, a Aura manda a menor quantidade
// de linhas que deixa a página mais alta que larga (3 linhas = 82,5 mm), o
// mesmo truque do modelo fixo 40x25 (rowsPerPage).
//
// O que este arquivo trava:
//   1. opt-in de verdade: sem a chave, a medida sai byte a byte como antes
//      (as fixtures douradas da medida livre não mudam);
//   2. a conta das linhas e a altura da página (impressão, prévia e teste de
//      posição);
//   3. o spec só ganha a chave quando vale exatamente true, e comPaginaEmPe
//      liga/desliga sem deixar lixo;
//   4. o wizard tem o checkbox e o resumo.
// ============================================================================
import * as fs from "fs";
import * as path from "path";
import {
  alturaDaPaginaMm, comPaginaEmPe, customLabelPreset, linhasDaPaginaEmPe, sanitizarMedida, type CustomLabelSpec,
} from "@/components/screens/estoque/labels/customLabel";
import { buildLabelHtml, buildCustomLabelTestHtml, labelPreviewGeometry } from "@/components/screens/estoque/labels/buildLabelHtml";

const LULUME: CustomLabelSpec = {
  id: "lulume-boutique", nome: "Boutique 40x25", estilo: "boutique", colunas: 2,
  larguraMm: 40, alturaMm: 25, espacoLadoMm: 2, espacoLinhaMm: 2.5, ajusteXMm: 0, ajusteYMm: 0,
};
const ITENS = [
  { name: "Vestido Floral", price: 89.9, barcode: "7891234567895", size: "8", color: "#EF4444", qty: 5 },
  { name: "Body Básico", price: 40, barcode: "7891234567901", size: "U", color: "#000000", qty: 2 },
];
const BASE = { mode: "barcode" as const, storeName: "Lulume Baby & Kids", showStoreName: true, labelSize: "40x25" as const };

describe("a conta das linhas", () => {
  it("82 x 27,5 vira 3 linhas (82,5 mm, mais alta que larga)", () => {
    expect(linhasDaPaginaEmPe(82, 27.5)).toBe(3);
    expect(linhasDaPaginaEmPe(105, 23.5)).toBe(5);
    expect(linhasDaPaginaEmPe(58, 28)).toBe(3);
  });
  it("página que já é mais alta que larga fica com 1 linha", () => {
    expect(linhasDaPaginaEmPe(35, 62)).toBe(1);
    expect(linhasDaPaginaEmPe(40, 40)).toBe(2); // quadrada: 2 linhas, senão o driver escolhe
    expect(linhasDaPaginaEmPe(82, 0)).toBe(1);
  });
});

describe("o preset", () => {
  it("sem a chave: uma linha por página, como antes", () => {
    const p = customLabelPreset(LULUME);
    expect(p.rowsPerPage).toBeUndefined();
    expect(alturaDaPaginaMm(p)).toBe(27.5);
  });
  it("com paginaEmPe: rowsPerPage 3 e página de 82 x 82,5; o desenho não muda", () => {
    const p = customLabelPreset({ ...LULUME, paginaEmPe: true });
    expect(p.pageWidthMm).toBe(82);
    expect(p.pageHeightMm).toBe(27.5);
    expect(p.rowsPerPage).toBe(3);
    expect(alturaDaPaginaMm(p)).toBe(82.5);
    expect(p.design).toBe("boutique");
    expect(p.cellWidthMm).toBe(40);
  });
  it("tag em pé (35x60) com a chave: 1 linha, sem rowsPerPage", () => {
    const p = customLabelPreset({ ...LULUME, estilo: undefined, larguraMm: 35, alturaMm: 60, colunas: 1, espacoLinhaMm: 0, paginaEmPe: true });
    expect(p.rowsPerPage).toBeUndefined();
  });
});

describe("o HTML", () => {
  it("sem a chave, byte a byte igual (opt-in de verdade)", () => {
    const sem = buildLabelHtml(ITENS, { ...BASE, customSpec: LULUME });
    const semChaveFalsa = buildLabelHtml(ITENS, { ...BASE, customSpec: sanitizarMedida({ ...LULUME, paginaEmPe: false })! });
    expect(semChaveFalsa).toBe(sem);
    expect(sem).toContain("@page{margin:0;size:82mm 27.5mm}");
  });
  it("com a chave: @page 82 x 82,5 e a barra de setup diz o papel certo", () => {
    const html = buildLabelHtml(ITENS, { ...BASE, customSpec: { ...LULUME, paginaEmPe: true } });
    expect(html).toContain("@page{margin:0;size:82mm 82.5mm}");
    expect(html).toContain("Papel <b>82&times;82.5mm</b>");
    // o resto da etiqueta (célula, código de barras) não muda
    const sem = buildLabelHtml(ITENS, { ...BASE, customSpec: LULUME });
    const corpo = (h: string) => h.split("<table")[1];
    expect(corpo(html)).toBe(corpo(sem));
  });
  it("o teste de posição também sai em pé", () => {
    const html = buildCustomLabelTestHtml({ ...LULUME, paginaEmPe: true });
    expect(html).toContain("size:82mm 82.5mm");
  });
  it("a prévia mostra 3 linhas de 82,5 mm", () => {
    const g = labelPreviewGeometry(ITENS, { ...BASE, customSpec: { ...LULUME, paginaEmPe: true } });
    expect(g.rows).toBe(3);
    expect(g.heightMm).toBe(82.5);
    expect(g.labels).toBe(6);
    const sem = labelPreviewGeometry(ITENS, { ...BASE, customSpec: LULUME });
    expect(sem.rows).toBe(1);
    expect(sem.heightMm).toBe(27.5);
  });
});

describe("o spec", () => {
  it("só true entra; false, 'sim' e 1 não deixam a chave", () => {
    expect(sanitizarMedida({ ...LULUME, paginaEmPe: true })!.paginaEmPe).toBe(true);
    for (const v of [false, "sim", 1, null, undefined]) {
      const s = sanitizarMedida({ ...LULUME, paginaEmPe: v as any })!;
      expect("paginaEmPe" in s).toBe(false);
    }
  });
  it("comPaginaEmPe liga e desliga sem deixar a chave", () => {
    const ligado = comPaginaEmPe(LULUME, true);
    expect(ligado.paginaEmPe).toBe(true);
    const desligado = comPaginaEmPe(ligado, false);
    expect("paginaEmPe" in desligado).toBe(false);
    expect(desligado).toEqual(LULUME);
  });
});

describe("o wizard", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "components", "screens", "estoque", "labels", "MinhaMedidaWizard.tsx"), "utf8");
  it("tem o checkbox no passo 1 e o resumo no fim", () => {
    expect(src).toMatch(/testID="medida-pagina-em-pe"/);
    expect(src).toMatch(/A etiqueta sai de lado\?/);
    expect(src).toMatch(/medidaDosCampos\(comPaginaEmPe\(base, emPe\), txt, colunas\)/);
    expect(src).toMatch(/linhaResumo\("Página"/);
  });
  it("a tela de impressão mostra a altura da página em pé no papel do Chrome", () => {
    const print = fs.readFileSync(path.join(__dirname, "..", "components", "PrintLabels.tsx"), "utf8");
    expect(print).toMatch(/mmTxt\(alturaDaPaginaMm\(customLabelPreset\(medidaAtiva\)\)\)/);
  });
});
