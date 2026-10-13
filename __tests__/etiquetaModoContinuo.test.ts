// ============================================================================
// AURA. — Testes: modo contínuo, passo, deslocamento vertical, linha de teste
// e pré-visualização das etiquetas (13/10/2026, Divina D'Lux / Elgin L42 Pro)
//
// O que estes testes travam:
//   1. opções novas no PADRÃO (ou num modelo que não as aceita) = fixture
//      byte a byte de origin/main
//   2. modo contínuo: uma página só, altura = passo × linhas, e as linhas
//      (o <table>) saem iguais às do modo de sempre
//   3. passo e deslocamento vertical só mexem na geometria da página/tabela
//   4. linha de teste: 1 linha de exemplo, marcas fora do código de barras
//   5. pré-visualização: só tela, mesma etiqueta da impressão
//   6. a calibração fica no navegador, por empresa e por modelo
// ============================================================================
import fs from "fs";
import path from "path";
import {
  buildLabelHtml, buildLabelTestHtml, buildLabelPreviewHtml, labelPreviewGeometry,
  labelSupportsCalibration, labelRowPitchMm, labelOffsetYMm, labelSheetHeightMm,
  isValidEAN13, LABEL_SIZE_KEYS, LABEL_SIZE_PRESETS, LABEL_PREVIEW_MAX_ROWS, CSS_PX_PER_MM,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import {
  loadLabelPrinterPrefs, saveLabelPrinterPrefs, defaultLabelPrinterPrefs, labelPrinterBuildOptions, sanitizeLabelPrinterPrefs,
} from "@/components/screens/estoque/labels/labelPrinterPrefs";

const FIX_DIR = path.join(__dirname, "__fixtures__", "labels", "byte-a-byte");
const fixture = (nome: string) => fs.readFileSync(path.join(FIX_DIR, nome + ".html"), "utf-8");

// Os MESMOS itens de __tests__/etiquetaByteAByte.test.ts ("com-variante").
const ITENS = [
  { name: "Camiseta Basica Algodao", price: 1234.56, barcode: "7891234567896", size: "M", color: "Azul", qty: 2 },
  { name: "Vestido Midi Tule Bordado Manga Longa Festa", price: 1000, barcode: "7891033948208", size: "G", color: "#ffffff", qty: 1 },
  { name: "Calça Jeans", price: 189.9, barcode: "SKU-00123", size: "42", color: "", qty: 2 },
  { name: "Blusa Canelada", price: 59.9, barcode: "7891234567899", size: "ÚNICO", color: "Verde militar", qty: 1 },
]; // 6 etiquetas = 2 linhas no rolo de 3 colunas
const base = (size: any, mode: "barcode" | "qr" = "barcode") => ({ mode, storeName: "Divina D'Lux", showStoreName: true, labelSize: size });

const tabela = (html: string) => html.slice(html.indexOf('<table id="labelsTable">'), html.indexOf("</table>") + 8);
const semPagina = (html: string) => html.replace(/@page\{[^}]*\}/, "@page{}").replace(/Papel <b>[^<]*<\/b>/, "Papel <b></b>");

describe("opções novas no padrão não mudam um byte", () => {
  test.each(LABEL_SIZE_KEYS.flatMap((s) => [[s, "barcode"], [s, "qr"]] as const))("%s %s — padrão explícito = fixture de origin/main", (size, mode) => {
    const html = buildLabelHtml(ITENS, {
      ...base(size, mode), continuous: false, rowPitchMm: LABEL_SIZE_PRESETS[size].pageHeightMm, offsetYMm: 0, calibrationMarks: false,
    });
    expect(html).toBe(fixture(size + "-" + mode + "-com-variante"));
  });

  test.each(["99x21", "58mm"] as const)("%s não aceita calibração: opções ligadas = fixture de origin/main", (size) => {
    expect(labelSupportsCalibration(size)).toBe(false);
    const html = buildLabelHtml(ITENS, { ...base(size), continuous: true, rowPitchMm: 20, offsetYMm: 1.5 });
    expect(html).toBe(fixture(size + "-barcode-com-variante"));
  });

  test("só os modelos com vão entre linhas aceitam", () => {
    expect(LABEL_SIZE_KEYS.filter(labelSupportsCalibration)).toEqual(["105x21", "30x25"]);
  });

  test("os números dos modelos continuam os mesmos", () => {
    expect(LABEL_SIZE_PRESETS["99x21"]).toEqual({ pageWidthMm: 99, pageHeightMm: 21, cols: 3, cellWidthMm: 33, cellHeightMm: 21, uiLabel: "33x21mm (3 colunas)" });
    expect(LABEL_SIZE_PRESETS["30x25"]).toEqual({ pageWidthMm: 94, pageHeightMm: 27, cols: 3, cellWidthMm: 30, cellHeightMm: 25, colGapMm: 2, rowGapMm: 2, uiLabel: "30x25mm (3 colunas)" });
  });
});

describe("modo contínuo (página única por trabalho)", () => {
  test.each([["105x21", 23.5], ["30x25", 27]] as const)("%s: altura da página = passo × linhas", (size, passo) => {
    const html = buildLabelHtml(ITENS, { ...base(size), continuous: true });
    const w = LABEL_SIZE_PRESETS[size].pageWidthMm;
    expect(html).toContain("@page{margin:0;size:" + w + "mm " + passo * 2 + "mm}");
    expect(html).toContain("Papel <b>" + w + "&times;" + passo * 2 + "mm</b>");
    // cada linha continua com o passo do modelo
    expect(html).toContain("tr{height:" + passo + "mm;page-break-inside:avoid}");
  });

  test("uma linha a mais = um passo a mais na página", () => {
    const sete = [{ ...ITENS[0], qty: 7 }]; // 3 linhas
    expect(buildLabelHtml(sete, { ...base("105x21"), continuous: true })).toContain("@page{margin:0;size:105mm 70.5mm}");
    const cem = [{ ...ITENS[0], qty: 100 }]; // 34 linhas
    expect(buildLabelHtml(cem, { ...base("105x21"), continuous: true })).toContain("@page{margin:0;size:105mm 799mm}");
  });

  test.each(["105x21", "30x25"] as const)("%s: o conteúdo das linhas é o mesmo do modo de sempre", (size) => {
    const normal = fixture(size + "-barcode-com-variante");
    const continuo = buildLabelHtml(ITENS, { ...base(size), continuous: true });
    expect(tabela(continuo)).toBe(tabela(normal));
    expect((continuo.match(/<tr>/g) || []).length).toBe(2);
    // a única diferença no documento: a altura da página e a folga da última linha
    const folga = "tr:last-child{height:" + (LABEL_SIZE_PRESETS[size].pageHeightMm - 0.3) + "mm}";
    expect(continuo).toContain(folga);
    expect(semPagina(continuo).replace(folga, "")).toBe(semPagina(normal));
  });

  test("a folga da última linha sai do vão, nunca da etiqueta", () => {
    (["105x21", "30x25"] as const).forEach((size) => {
      const p = LABEL_SIZE_PRESETS[size];
      expect(p.pageHeightMm - 0.3).toBeGreaterThan(p.cellHeightMm);
    });
    // passo no mínimo (= altura da etiqueta): a última linha não encolhe abaixo dela
    const html = buildLabelHtml(ITENS, { ...base("105x21"), continuous: true, rowPitchMm: 21 });
    expect(html).toContain("tr:last-child{height:21mm}");
  });

  test("QR também", () => {
    const html = buildLabelHtml(ITENS, { ...base("105x21", "qr"), continuous: true });
    expect(html).toContain("@page{margin:0;size:105mm 47mm}");
    expect(tabela(html)).toBe(tabela(fixture("105x21-qr-com-variante")));
  });
});

describe("passo entre linhas", () => {
  test("23,5 → 23,0: linha e página com o passo novo, nada mais muda", () => {
    const normal = fixture("105x21-barcode-com-variante");
    const html = buildLabelHtml(ITENS, { ...base("105x21"), rowPitchMm: 23 });
    expect(html).toContain("@page{margin:0;size:105mm 23mm}");
    expect(html).toContain("tr{height:23mm;page-break-inside:avoid}");
    expect(html.replace(/23mm/g, "23.5mm").replace("105&times;23mm", "105&times;23.5mm")).toBe(normal);
    // a etiqueta não muda de tamanho
    expect(html).toContain(".cell{width:33mm;height:21mm;");
  });

  test("com modo contínuo: página = passo ajustado × linhas", () => {
    const html = buildLabelHtml(ITENS, { ...base("105x21"), continuous: true, rowPitchMm: 23.2 });
    expect(html).toContain("@page{margin:0;size:105mm 46.4mm}");
    expect(html).toContain("tr{height:23.2mm;");
    expect(html).toContain("tr:last-child{height:22.9mm}");
  });

  test("faixa: décimos, nunca menor que a etiqueta, no máximo 3mm do padrão", () => {
    expect(labelRowPitchMm("105x21", 23.04)).toBe(23);
    expect(labelRowPitchMm("105x21", 10)).toBe(21);
    expect(labelRowPitchMm("105x21", 99)).toBe(26.5);
    expect(labelRowPitchMm("30x25", 10)).toBe(25);
    expect(labelRowPitchMm("105x21", NaN)).toBe(23.5);
    expect(labelRowPitchMm("105x21", undefined)).toBe(23.5);
    expect(labelRowPitchMm("99x21", 20)).toBe(21);
    expect(labelRowPitchMm("58mm", 20)).toBe(28);
  });
});

describe("deslocamento vertical", () => {
  test("só acrescenta o translate na tabela (e mantém no ajuste do slider)", () => {
    const normal = fixture("105x21-barcode-com-variante");
    const html = buildLabelHtml(ITENS, { ...base("105x21"), offsetYMm: -1.5 });
    expect(html).toContain("table-layout:fixed;transform:translate(0mm,-1.5mm)}");
    expect(html).toContain('tbl.style.transform="translate("+rng.value+"mm,-1.5mm)"');
    expect(
      html.replace(";transform:translate(0mm,-1.5mm)", "").replace('translate("+rng.value+"mm,-1.5mm)', 'translateX("+rng.value+"mm)'),
    ).toBe(normal);
  });

  test("junto com o deslocamento horizontal da loja", () => {
    const html = buildLabelHtml(ITENS, { ...base("105x21"), offsetMm: -1.5, offsetYMm: 0.7 });
    expect(html).toContain(";transform:translate(-1.5mm,0.7mm)}");
    expect(html).not.toContain("translateX(-1.5mm)");
    // sem o vertical, o horizontal sai como sempre saiu
    expect(buildLabelHtml(ITENS, { ...base("105x21"), offsetMm: -1.5 })).toBe(fixture("105x21-barcode-deslocamento-horizontal"));
  });

  test("no modo contínuo, descer estica a página; subir não", () => {
    expect(buildLabelHtml(ITENS, { ...base("105x21"), continuous: true, offsetYMm: 1.2 })).toContain("@page{margin:0;size:105mm 48.2mm}");
    expect(buildLabelHtml(ITENS, { ...base("105x21"), continuous: true, offsetYMm: -1.2 })).toContain("@page{margin:0;size:105mm 47mm}");
    expect(labelSheetHeightMm("105x21", 2, { continuous: true, offsetYMm: 1.2 })).toBe(48.2);
    expect(labelSheetHeightMm("105x21", 2, {})).toBe(23.5);
    expect(labelSheetHeightMm("58mm", 5, { continuous: true })).toBe(84);
  });

  test("faixa: décimos, de -10 a 10, zero fora dos modelos com vão", () => {
    expect(labelOffsetYMm("105x21", 0.44)).toBe(0.4);
    expect(labelOffsetYMm("105x21", -99)).toBe(-10);
    expect(labelOffsetYMm("105x21", 99)).toBe(10);
    expect(labelOffsetYMm("105x21", "x" as any)).toBe(0);
    expect(labelOffsetYMm("99x21", 2)).toBe(0);
  });
});

describe("linha de teste", () => {
  const opts = base("105x21");

  test("uma linha só: 3 etiquetas do produto de exemplo, numa página de um passo", () => {
    const html = buildLabelTestHtml(opts);
    expect((html.match(/<tr>/g) || []).length).toBe(1);
    expect((html.match(/<td class="cell">/g) || []).length).toBe(3);
    expect((html.match(/<div class="name">Produto de exemplo<\/div>/g) || []).length).toBe(3);
    expect(html).toContain("@page{margin:0;size:105mm 23.5mm}");
    expect(html).toContain("<title>Etiquetas Aura - 3 etiquetas</title>");
    const code = /data-code="(\d+)"/.exec(html)![1];
    expect(isValidEAN13(code)).toBe(true);
    expect(code.startsWith("200")).toBe(true); // código interno, não bate com produto real
  });

  test("2 linhas para conferir o passo; no máximo 3", () => {
    expect((buildLabelTestHtml({ ...opts, rows: 2 }).match(/<tr>/g) || []).length).toBe(2);
    expect((buildLabelTestHtml({ ...opts, rows: 50 }).match(/<tr>/g) || []).length).toBe(3);
    expect(buildLabelTestHtml({ ...opts, rows: 2, continuous: true, rowPitchMm: 23 })).toContain("@page{margin:0;size:105mm 46mm}");
  });

  test("é a etiqueta de verdade + marcas: tirando o CSS das marcas, igual ao buildLabelHtml", () => {
    const html = buildLabelTestHtml(opts);
    const code = /data-code="(\d+)"/.exec(html)![1];
    const semMarcas = buildLabelHtml([{ name: "Produto de exemplo", price: 99.9, barcode: code, size: "M", color: "Preto", qty: 3 }], opts);
    const a = html.indexOf(".cell{background-image:");
    const b = html.indexOf(".setup-guide{");
    expect(a).toBeGreaterThan(0);
    expect(html.slice(0, a) + html.slice(b)).toBe(semMarcas);
  });

  test("marcas ficam na borda da etiqueta, fora da área do código de barras", () => {
    const html = buildLabelTestHtml(opts);
    const css = html.slice(html.indexOf(".cell{background-image:"), html.indexOf(".setup-guide{"));
    // só fundo da célula: nenhuma regra toca no .bc-box, no SVG nem no tamanho da célula
    expect(css).not.toContain("bc-box");
    expect(css).not.toContain("svg");
    expect(css).not.toMatch(/[;{](width|height|padding|margin):/);
    expect(css).toContain("print-color-adjust:exact");
    // nada passa de 1,2mm da borda; o .bc-box começa a 1,5mm (largura - 3mm, centralizado)
    const larguras = (css.match(/([\d.]+)mm [\d.]+mm/g) || []).map((m) => parseFloat(m));
    expect(larguras.length).toBeGreaterThan(0);
    expect(Math.max.apply(null, larguras)).toBeLessThanOrEqual(1.2);
    expect(html).toContain("max-width:30mm");
    // régua de 0 a 20mm só na 1a coluna
    expect(css).toContain("tr td.cell:first-of-type{");
    expect(css).toContain("transparent 1mm)");
    expect(css).toContain("1.2mm 20.25mm,0.7mm 20.25mm");
  });

  test("etiquetas de verdade nunca saem com marcas", () => {
    expect(buildLabelHtml(ITENS, base("105x21"))).not.toContain(".cell{background-image:");
    expect(buildLabelHtml(ITENS, { ...base("105x21"), continuous: true, rowPitchMm: 23, offsetYMm: 1 })).not.toContain(".cell{background-image:");
  });

  test.each(LABEL_SIZE_KEYS)("%s: funciona em todos os modelos", (size) => {
    const html = buildLabelTestHtml(base(size));
    expect((html.match(/<td class="cell">/g) || []).length).toBe(LABEL_SIZE_PRESETS[size].cols);
  });
});

describe("pré-visualização em escala real", () => {
  const opts = base("105x21");

  test("mostra só a 1a página: uma linha no modo de sempre", () => {
    const geo = labelPreviewGeometry(ITENS, opts);
    expect(geo).toEqual({ rows: 1, labels: 3, widthMm: 105, heightMm: 23.5 });
    const html = buildLabelPreviewHtml(ITENS, opts);
    expect((html.match(/<tr>/g) || []).length).toBe(1);
  });

  test("no modo contínuo a página é o trabalho (até " + LABEL_PREVIEW_MAX_ROWS + " linhas na tela)", () => {
    expect(labelPreviewGeometry(ITENS, { ...opts, continuous: true })).toEqual({ rows: 2, labels: 6, widthMm: 105, heightMm: 47 });
    const cem = [{ ...ITENS[0], qty: 100 }];
    expect(labelPreviewGeometry(cem, { ...opts, continuous: true }).rows).toBe(LABEL_PREVIEW_MAX_ROWS);
  });

  test("58mm: a página de 3 linhas", () => {
    expect(labelPreviewGeometry([{ ...ITENS[0], qty: 10 }], base("58mm"))).toEqual({ rows: 3, labels: 3, widthMm: 58, heightMm: 84 });
  });

  test("é o HTML da impressão + contorno da página e réguas; barras de setup escondidas", () => {
    const html = buildLabelPreviewHtml(ITENS, opts);
    const impressao = buildLabelHtml([{ ...ITENS[0], qty: 2 }, { ...ITENS[1], qty: 1 }], opts);
    expect(tabela(html)).toBe(tabela(impressao));
    expect(html).toContain(".setup-guide,.preview-bar{display:none!important}");
    expect(html).toContain(".pv-page{position:absolute;left:10mm;top:10mm;width:105mm;height:23.5mm;");
    expect(html).toContain('<span style="left:100mm">100</span>');
    expect(html).toContain('<span style="top:20mm">20</span>');
    // tirando o que a prévia injeta, é a página de impressão
    const css = html.slice(html.indexOf(".setup-guide,.preview-bar{display:none"), html.indexOf("</style>"));
    const corpo = html.slice(html.indexOf('<div class="pv-page">'), html.indexOf('<div class="setup-guide"'));
    expect(html.replace(css, "").replace(corpo, "")).toBe(impressao);
  });

  test("escala: 96 px por polegada", () => {
    expect(CSS_PX_PER_MM * 25.4).toBeCloseTo(96, 10);
    expect(Math.round(105 * CSS_PX_PER_MM)).toBe(397);
  });
});

describe("calibração guardada no navegador, por empresa e por modelo", () => {
  beforeEach(() => { window.localStorage.clear(); });

  test("sem nada salvo: padrão, e nenhuma opção vai para o buildLabelHtml", () => {
    const prefs = loadLabelPrinterPrefs("empresa-1", "105x21");
    expect(prefs).toEqual({ continuous: false, rowPitchMm: 23.5, offsetYMm: 0 });
    expect(labelPrinterBuildOptions("105x21", prefs)).toEqual({});
    expect(buildLabelHtml(ITENS, { ...base("105x21"), ...labelPrinterBuildOptions("105x21", prefs) })).toBe(fixture("105x21-barcode-com-variante"));
  });

  test("salva e lê por empresa e por modelo", () => {
    saveLabelPrinterPrefs("empresa-1", "105x21", { continuous: true, rowPitchMm: 23, offsetYMm: -0.5 });
    expect(loadLabelPrinterPrefs("empresa-1", "105x21")).toEqual({ continuous: true, rowPitchMm: 23, offsetYMm: -0.5 });
    expect(loadLabelPrinterPrefs("empresa-1", "30x25")).toEqual(defaultLabelPrinterPrefs("30x25"));
    expect(loadLabelPrinterPrefs("empresa-2", "105x21")).toEqual(defaultLabelPrinterPrefs("105x21"));
    expect(JSON.parse(window.localStorage.getItem("aura_label_printer_empresa-1")!)).toEqual({ "105x21": { continuous: true, rowPitchMm: 23, offsetYMm: -0.5 } });
    expect(labelPrinterBuildOptions("105x21", loadLabelPrinterPrefs("empresa-1", "105x21"))).toEqual({ continuous: true, rowPitchMm: 23, offsetYMm: -0.5 });
  });

  test("voltar ao padrão apaga a chave", () => {
    saveLabelPrinterPrefs("empresa-1", "105x21", { continuous: true, rowPitchMm: 23, offsetYMm: 0 });
    saveLabelPrinterPrefs("empresa-1", "105x21", defaultLabelPrinterPrefs("105x21"));
    expect(window.localStorage.getItem("aura_label_printer_empresa-1")).toBeNull();
  });

  test("lixo no navegador vira padrão; modelo sem calibração ignora o que vier", () => {
    window.localStorage.setItem("aura_label_printer_empresa-1", "{nao e json");
    expect(loadLabelPrinterPrefs("empresa-1", "105x21")).toEqual(defaultLabelPrinterPrefs("105x21"));
    expect(sanitizeLabelPrinterPrefs("105x21", { continuous: "sim", rowPitchMm: 500, offsetYMm: "abc" })).toEqual({ continuous: false, rowPitchMm: 26.5, offsetYMm: 0 });
    expect(sanitizeLabelPrinterPrefs("99x21", { continuous: true, rowPitchMm: 20, offsetYMm: 3 })).toEqual({ continuous: false, rowPitchMm: 21, offsetYMm: 0 });
    expect(labelPrinterBuildOptions("99x21", { continuous: true, rowPitchMm: 20, offsetYMm: 3 })).toEqual({});
    expect(loadLabelPrinterPrefs(null, "105x21")).toEqual(defaultLabelPrinterPrefs("105x21"));
  });
});
