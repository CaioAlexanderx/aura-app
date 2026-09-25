// ============================================================
// AURA. — Testes: etiqueta "33x21mm com vão" (preset 105x21, desenho editorial)
// (25/09/2026, Divina D'Lux / Fabiany — rolo térmico 33x21, 3 colunas,
// vão vertical 2,5mm, papel 105mm; mockup docs/mockups/etiqueta-33x21-vao.html,
// desenho "C · Editorial")
//
// O que estes testes travam:
//   1. a geometria do rolo com vão (105 × 23,5mm, vãos de 3mm entre colunas)
//   2. a ordem da célula (loja → nome → selo/preço → código de barras) e o
//      código de barras IGUAL ao da Finesse (mesmo SVG, mesmas opts)
//   3. nome inteiro (sem o corte em 16 letras), selo "G · Branco", preço
//      sem ponto de milhar ("1000,00", decisão do Caio 25/09)
//   4. os presets antigos NÃO ganham nada do desenho editorial
// ============================================================
jest.mock("@/utils/colorNames", () => ({ hexToName: (h: string) => h }));

import { buildLabelHtml, LABEL_SIZE_PRESETS, LABEL_SIZE_KEYS } from "@/components/screens/estoque/labels/buildLabelHtml";

const NOME_LONGO = "Vestido Midi Tule Bordado Manga Longa Festa";
const item = { name: NOME_LONGO, price: 1000, barcode: "7891033948208", size: "G", color: "Branco", qty: 1 };
const opts = { mode: "barcode" as const, storeName: "Divina D'Lux", showStoreName: true, labelSize: "105x21" as const };

describe("preset 105x21 (33x21 com vão, editorial)", () => {
  test("números do preset e posição no seletor", () => {
    expect(LABEL_SIZE_KEYS).toEqual(["99x21", "105x21", "30x25", "58mm"]);
    const p = LABEL_SIZE_PRESETS["105x21"];
    expect(p).toEqual({
      pageWidthMm: 105, pageHeightMm: 23.5, cols: 3, cellWidthMm: 33, cellHeightMm: 21,
      colGapMm: 3, rowGapMm: 2.5, design: "editorial", uiLabel: "33x21mm com vão (3 colunas · papel 105mm)",
    });
  });

  test("geometria: página 105×23,5mm, vão de 3mm entre colunas e linha de 23,5mm", () => {
    const html = buildLabelHtml([item], opts);
    expect(html).toContain("@page{margin:0;size:105mm 23.5mm}");
    expect(html).toContain(".colgap{width:3mm;");
    expect(html).toContain("tr{height:23.5mm");
  });

  test("ordem da célula: loja → nome → selo/preço → código de barras", () => {
    const html = buildLabelHtml([item], opts);
    const cell = html.slice(html.indexOf('<div class="bc-inner ed'));
    const iStore = cell.indexOf('<div class="store">');
    const iName = cell.indexOf('<div class="name">');
    const iRow = cell.indexOf('<div class="row">');
    const iBc = cell.indexOf('<div class="bc-box">');
    expect(iStore).toBeGreaterThanOrEqual(0);
    expect(iStore).toBeLessThan(iName);
    expect(iName).toBeLessThan(iRow);
    expect(iRow).toBeLessThan(iBc);
    expect(cell).toContain("<div class=\"store\">DIVINA D'LUX</div>");
  });

  test("código de barras idêntico ao da Finesse (SVG e opts do JsBarcode)", () => {
    const html = buildLabelHtml([item], opts);
    expect(html).toContain('<div class="bc-box"><svg id="bc-0" data-code="7891033948208"></svg></div>');
    expect(html).toContain("var opts={width:1,height:24,margin:1,");
  });

  test("nome comprido sai inteiro, sem corte em 16 letras", () => {
    const html = buildLabelHtml([item], opts);
    expect(NOME_LONGO.length).toBeGreaterThan(16);
    expect(html).toContain('<div class="name">' + NOME_LONGO + "</div>");
    expect(html).not.toContain("...");
  });

  test("selo de tamanho e cor", () => {
    const html = buildLabelHtml([item], opts);
    expect(html).toContain('<span class="variant">G · Branco</span>');
  });

  test("sem tamanho nem cor não há selo", () => {
    const html = buildLabelHtml([{ ...item, size: "", color: "" }], opts);
    expect(html).not.toContain('class="variant"');
  });

  test("cor em hex vira nome (hexToName)", () => {
    const html = buildLabelHtml([{ ...item, size: "", color: "#1E3A8A" }], opts);
    // o mock devolve o próprio valor
    expect(html).toContain('<span class="variant">#1E3A8A</span>');
  });

  test("preço sem ponto de milhar, com o R$ pequeno", () => {
    expect(buildLabelHtml([item], opts)).toContain('<div class="price"><span class="cur">R$</span>1000,00</div>');
    expect(buildLabelHtml([{ ...item, price: 289.9 }], opts)).toContain('<span class="cur">R$</span>289,90</div>');
  });

  test("Montserrat e ajuste automático (com empilhamento) só neste desenho", () => {
    const html = buildLabelHtml([item], opts);
    expect(html).toContain('<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap" rel="stylesheet">');
    expect(html).toContain('b.classList.add("stack")');
    expect(html).toContain("document.fonts.ready.then(fit)");
    // o script de ajuste vem depois do script do JsBarcode
    expect(html.indexOf("fonts.ready")).toBeGreaterThan(html.indexOf("var opts={width:1"));
  });

  test("preço no cartão (loja Matcon): linha própria e classe ed-card, sem .price-wrap", () => {
    const html = buildLabelHtml([{ ...item, cardPrice: 1110 }], opts);
    expect(html).toContain('<div class="bc-inner ed ed-card">');
    expect(html).toContain('<div class="card-line">Cartão <b>R$ 1110,00</b></div>');
    expect(html).not.toContain('<div class="price-wrap">');
  });

  test("modo QR não quebra e não usa o desenho do código de barras", () => {
    let html = "";
    expect(() => { html = buildLabelHtml([item], { ...opts, mode: "qr" }); }).not.toThrow();
    expect(html).not.toContain("bc-inner ed");
    expect(html).toContain('<div class="name">' + NOME_LONGO + " - G - Branco</div>");
    expect(html).toContain(".qr-inner .name{font-weight:700;font-size:6pt}");
  });

  test.each(["99x21", "30x25", "58mm"] as const)("%s não herda nada do desenho editorial", (size) => {
    const html = buildLabelHtml([item], { ...opts, labelSize: size });
    expect(html).not.toContain("bc-inner ed");
    expect(html).not.toContain("Montserrat");
    expect(html).not.toContain('class="variant"');
    expect(html).not.toContain("card-line");
    expect(html).not.toContain("fonts.ready");
  });
});
