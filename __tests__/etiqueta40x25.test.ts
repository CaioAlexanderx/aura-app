// ============================================================================
// AURA. — Etiqueta 40x25mm, 2 colunas, impressora térmica de cupom 80mm
// (14/10/2026, resma BC-2249, VT-8360)
//
// Modelo novo, aditivo. A geometria foi MEDIDA na loja: papel de ~82mm, mas a
// cabeça só alcança ~72mm (página de 80mm saía reduzida a 90%). Por isso a
// página é de 72mm, com 2 células de 35mm e 2mm de vão, em pé (3 linhas =
// 72x82,5mm) para o driver não girar a impressão.
//
// Os demais modelos (que clientes usam hoje) não mudam um byte: isso é coberto
// por etiquetaByteAByte.test.ts. Aqui só o modelo novo.
// ============================================================================
import {
  buildLabelHtml, LABEL_SIZE_KEYS, LABEL_SIZE_PRESETS, DEFAULT_LABEL_SIZE, labelSupportsCalibration,
} from "@/components/screens/estoque/labels/buildLabelHtml";

const ITENS = [
  { name: "Camiseta Basica Algodao", price: 59.9, barcode: "7891234567896", size: "M", color: "Azul", qty: 3 },
  { name: "Cimento CP II 50 kg", price: 38, barcode: "7891234567895", size: "", color: "", qty: 1 },
];
const base = { mode: "barcode" as const, storeName: "Loja Teste", showStoreName: true, labelSize: "40x25" as const };

describe("modelo 40x25 (2 colunas, impressora 80mm)", () => {
  test("números do modelo e posição no seletor", () => {
    expect(LABEL_SIZE_PRESETS["40x25"]).toEqual({
      pageWidthMm: 72, pageHeightMm: 27.5, cols: 2, cellWidthMm: 35, cellHeightMm: 25, colGapMm: 2, rowGapMm: 2.5, rowsPerPage: 3,
      design: "editorial", edCompact: true, calibratable: true, uiLabel: "40x25mm (2 colunas · impressora 80mm)",
    });
    expect(LABEL_SIZE_KEYS[LABEL_SIZE_KEYS.length - 1]).toBe("40x25");
  });

  test("a página soma exatamente a largura da cabeça: 2 células + 1 vão = 72mm", () => {
    const p = LABEL_SIZE_PRESETS["40x25"];
    expect(p.cols * p.cellWidthMm + (p.cols - 1) * (p.colGapMm || 0)).toBe(p.pageWidthMm);
  });

  test("o padrão continua sendo o 99x21; o 40x25 aceita a calibração por computador", () => {
    expect(DEFAULT_LABEL_SIZE).toBe("99x21");
    expect(labelSupportsCalibration("40x25")).toBe(true);
    // o 58mm (também de várias linhas por página) continua fora
    expect(labelSupportsCalibration("58mm")).toBe(false);
  });

  test("2 colunas: 4 etiquetas viram 2 linhas, com a coluna espaçadora entre elas", () => {
    const html = buildLabelHtml(ITENS, base);
    const tabela = html.slice(html.indexOf('<table id="labelsTable">'), html.indexOf("</table>"));
    expect((tabela.match(/<tr/g) || []).length).toBe(2);
    expect((tabela.match(/class="colgap"/g) || []).length).toBe(2); // 1 por linha
    expect(html).toContain("Etiqueta 35x25mm x 2 colunas");
  });

  test("página em pé de 72mm de largura: nunca mais larga que alta, nunca de 80 ou 82mm", () => {
    const html = buildLabelHtml(ITENS, base);
    const m = html.match(/@page\{margin:0;size:([0-9.]+)mm ([0-9.]+)mm\}/);
    expect(m).not.toBeNull();
    const largura = Number(m![1]);
    const altura = Number(m![2]);
    expect(largura).toBe(72);
    expect(altura).toBe(82.5);
    expect(altura).toBeGreaterThan(largura);
  });

  test("desenho editorial: loja no topo, nome, selo + preço, barcode no rodapé (Montserrat)", () => {
    const html = buildLabelHtml(ITENS, { ...base, storeName: "Toda Linda" });
    expect(html).toContain("fonts.googleapis.com/css2?family=Montserrat");
    expect(html).toContain('class="bc-inner ed');
    expect(html).toContain('<div class="store">TODA LINDA</div>');
    // ordem: store -> name -> row (selo + preço) -> bc-box
    const celula = html.slice(html.indexOf('<td class="cell">'), html.indexOf("</td>", html.indexOf('<td class="cell">')));
    expect(celula.indexOf('class="store"')).toBeLessThan(celula.indexOf('class="name"'));
    expect(celula.indexOf('class="name"')).toBeLessThan(celula.indexOf('class="row"'));
    expect(celula.indexOf('class="row"')).toBeLessThan(celula.indexOf('class="bc-box"'));
    // selo de tamanho/cor com contorno
    expect(celula).toContain('<span class="variant">M · Azul</span>');
  });

  test("editorial compacto: mais respiro e fontes menores só neste modelo; o barcode não é tocado", () => {
    const html = buildLabelHtml(ITENS, base);
    expect(html).toContain(".bc-inner.ed{padding:1.5mm 1.9mm 1.3mm}");
    expect(html).toContain(".bc-inner.ed .name{font-size:6pt}");
    expect(html).toContain("var pt=6;");
    // o barcode segue os parâmetros LOCKED (não é o preset termico bcModuleMm)
    expect(html).toContain("var opts={width:1,height:24,margin:1,displayValue:true,fontSize:7,textMargin:0");
    expect(html).not.toContain("marginLeft:2");
    // o 105x21 não ganha nenhum byte do compacto
    const outro = buildLabelHtml(ITENS, { ...base, labelSize: "105x21" });
    expect(outro).not.toContain("padding:1.5mm 1.9mm 1.3mm");
    expect(outro).toContain("var pt=6.5;");
  });

  test("sem deslocamento no padrão; com o ajuste da loja, desce e fica na folha", () => {
    const padrao = buildLabelHtml(ITENS, base);
    expect(padrao).not.toContain("transform:translate(");
    const comY = buildLabelHtml(ITENS, { ...base, offsetYMm: 2.5, offsetMm: -1.5 });
    expect(comY).toContain("transform:translate(-1.5mm,2.5mm)");
    // passo ajustado vale na altura da página e na altura das linhas
    const passo = buildLabelHtml(ITENS, { ...base, rowPitchMm: 27.8 });
    expect(passo).toMatch(/@page\{margin:0;size:72mm 83\.4mm\}/);
    expect(passo).toContain("tr{height:27.8mm");
  });

  test("modo contínuo nunca deixa a folha mais larga que alta (mínimo de 3 linhas)", () => {
    // 1 linha só (2 etiquetas): sem o mínimo seria 72 x 27,5 e o driver giraria
    const html = buildLabelHtml([ITENS[1]], { ...base, continuous: true });
    const m = html.match(/@page\{margin:0;size:([0-9.]+)mm ([0-9.]+)mm\}/);
    expect(m).not.toBeNull();
    expect(Number(m![2])).toBeGreaterThan(Number(m![1]));
    expect(Number(m![2])).toBe(82.5);
  });

  test("QR também sai com 2 colunas", () => {
    const html = buildLabelHtml(ITENS, { ...base, mode: "qr" });
    expect(html).toContain("Etiqueta 35x25mm x 2 colunas");
    expect(html).toContain("QR Code");
  });
});
