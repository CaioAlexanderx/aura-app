// ============================================================================
// AURA. — Etiquetas: "Minha medida" (medida livre em mm) — motor, 15/10/2026
//
// O spec vira um preset equivalente e passa pelo MESMO buildLabelHtml. Aqui:
// geometria em mm, limites e arredondamento, ajuste X/Y como translate (só no
// spec), desenho escolhido por proporção, teste de posição e o armazenamento
// por computador. Os modelos fixos são cobrados byte a byte em
// etiquetasDouradas.test.ts.
// ============================================================================
import {
  buildLabelHtml, buildCustomLabelTestHtml, labelPreviewGeometry, buildLabelPreviewHtml, LABEL_SIZE_PRESETS, LABEL_SIZE_KEYS,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import {
  customLabelPreset, sanitizarMedida, etiquetaPequenaDemais, nomeDaMedida, escalaTexto, naFaixa, MEDIDA_LIMITES, MEDIDA_PADRAO,
  type CustomLabelSpec,
} from "@/components/screens/estoque/labels/customLabel";
import {
  lerMinhasMedidas, listarMedidas, salvarMedida, apagarMedida, escolherMedida, medidaEscolhida, MINHAS_MEDIDAS_PREFIXO,
} from "@/components/screens/estoque/labels/customLabelStorage";

function spec(p: Partial<CustomLabelSpec> = {}): CustomLabelSpec {
  return { id: "m1", larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0, ...p };
}
const ITENS = [
  { name: "Camiseta Algodão Básica", price: 59.9, barcode: "7891234567895", size: "M", color: "Azul", qty: 3 },
  { name: "Blusa", price: 1234.56, barcode: "SKU-00123", size: "", color: "", qty: 1 },
];
const BASE = { mode: "barcode" as const, storeName: "Toda Linda", showStoreName: true };

function pagina(html: string): [number, number] {
  const m = html.match(/@page\{margin:0;size:([0-9.]+)mm ([0-9.]+)mm\}/);
  if (!m) throw new Error("sem @page");
  return [Number(m[1]), Number(m[2])];
}
function tabela(html: string): string {
  return html.slice(html.indexOf('<table id="labelsTable">'), html.indexOf("</table>"));
}

describe("spec → preset (geometria em mm)", () => {
  test("1 por linha: página = largura; linha = altura + espaço de cima para baixo; sem vão lateral", () => {
    const p = customLabelPreset(spec({ larguraMm: 50, alturaMm: 30, espacoLadoMm: 3, espacoLinhaMm: 2 }));
    expect(p).toMatchObject({ pageWidthMm: 50, pageHeightMm: 32, cols: 1, cellWidthMm: 50, cellHeightMm: 30, rowGapMm: 2, design: "editorial" });
    expect(p.colGapMm).toBeUndefined();
    expect(p.rowsPerPage).toBeUndefined();
  });

  test("3 lado a lado de 33 x 21 com 3 mm e 2,5 mm: a mesma geometria do modelo fixo 105x21", () => {
    const p = customLabelPreset(spec({ larguraMm: 33, alturaMm: 21, colunas: 3, espacoLadoMm: 3, espacoLinhaMm: 2.5 }));
    const fixo = LABEL_SIZE_PRESETS["105x21"];
    expect([p.pageWidthMm, p.pageHeightMm, p.cols, p.cellWidthMm, p.cellHeightMm, p.colGapMm, p.rowGapMm])
      .toEqual([fixo.pageWidthMm, fixo.pageHeightMm, fixo.cols, fixo.cellWidthMm, fixo.cellHeightMm, fixo.colGapMm, fixo.rowGapMm]);
  });

  test("décimos não viram dízima: 3 x 33,3 + 2 x 2,5 = 104,9", () => {
    const p = customLabelPreset(spec({ larguraMm: 33.3, alturaMm: 20.1, colunas: 3, espacoLadoMm: 2.5, espacoLinhaMm: 1.9 }));
    expect(p.pageWidthMm).toBe(104.9);
    expect(p.pageHeightMm).toBe(22);
  });

  test("espaço zero: sem vão nenhum (etiquetas coladas)", () => {
    const p = customLabelPreset(spec({ colunas: 2, espacoLadoMm: 0, espacoLinhaMm: 0 }));
    expect(p.pageWidthMm).toBe(100);
    expect(p.pageHeightMm).toBe(30);
    expect(p.colGapMm).toBeUndefined();
    expect(p.rowGapMm).toBeUndefined();
  });

  test("desenho por proporção: compacto só com 35 mm ou mais de largura e 25 mm ou mais de altura", () => {
    expect(customLabelPreset(spec({ larguraMm: 40, alturaMm: 25 })).edCompact).toBe(true);
    expect(customLabelPreset(spec({ larguraMm: 30, alturaMm: 25 })).edCompact).toBeUndefined();
    expect(customLabelPreset(spec({ larguraMm: 105, alturaMm: 21 })).edCompact).toBeUndefined();
  });

  test("texto proporcional: 33x21 e 105x21 = 1; 40x25 = 1,2; 60x40 = 1,8 (teto)", () => {
    expect(escalaTexto({ larguraMm: 33, alturaMm: 21 })).toBe(1);
    expect(escalaTexto({ larguraMm: 105, alturaMm: 21 })).toBe(1);
    expect(escalaTexto({ larguraMm: 20, alturaMm: 15 })).toBe(1);
    expect(escalaTexto({ larguraMm: 40, alturaMm: 25 })).toBe(1.2);
    expect(escalaTexto({ larguraMm: 60, alturaMm: 40 })).toBe(1.8);
  });

  test("nome no seletor com vírgula decimal", () => {
    expect(nomeDaMedida({ larguraMm: 50, alturaMm: 30 })).toBe("Minha etiqueta 50 x 30 mm");
    expect(nomeDaMedida({ larguraMm: 33.5, alturaMm: 21 })).toBe("Minha etiqueta 33,5 x 21 mm");
    expect(customLabelPreset(spec({ larguraMm: 33.5, alturaMm: 21 })).uiLabel).toBe("Minha etiqueta 33,5 x 21 mm");
  });
});

describe("limites e arredondamento", () => {
  test("limites do brief", () => {
    expect(MEDIDA_LIMITES).toEqual({ larguraMm: [15, 110], alturaMm: [10, 80], colunas: [1, 3], espacoMm: [0, 10], ajusteMm: 8 });
    expect(MEDIDA_PADRAO).toEqual({ larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0 });
  });

  test("fora da faixa volta ao limite; décimos; vírgula aceita", () => {
    const s = sanitizarMedida({ id: "x", larguraMm: 140, alturaMm: 5, colunas: 7, espacoLadoMm: 12, espacoLinhaMm: -1, ajusteXMm: 9, ajusteYMm: -9.3 })!;
    expect(s).toEqual({ id: "x", larguraMm: 110, alturaMm: 10, colunas: 3, espacoLadoMm: 10, espacoLinhaMm: 0, ajusteXMm: 8, ajusteYMm: -8 });
    const t = sanitizarMedida({ id: "y", larguraMm: "33,46", alturaMm: 21.04, colunas: 2.4, espacoLadoMm: "2,55", espacoLinhaMm: 2, ajusteXMm: -0.04, ajusteYMm: 0.25 })!;
    expect(t).toEqual({ id: "y", larguraMm: 33.5, alturaMm: 21, colunas: 2, espacoLadoMm: 2.6, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0.3 });
    expect(Object.is(t.ajusteXMm, -0)).toBe(false);
    expect(naFaixa("abc", 0, 10, 3)).toBe(3);
  });

  test("campos opcionais com lixo voltam ao padrão; lixo de verdade é descartado", () => {
    expect(sanitizarMedida({ id: "z", larguraMm: 40, alturaMm: 25, colunas: "x", espacoLadoMm: null, ajusteXMm: {} })).toEqual(
      { id: "z", larguraMm: 40, alturaMm: 25, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0 });
    [null, undefined, 42, "50x30", [], { larguraMm: 50, alturaMm: 30 }, { id: "", larguraMm: 50, alturaMm: 30 },
      { id: "a", larguraMm: "cinquenta", alturaMm: 30 }, { id: "a", larguraMm: 50 }].forEach((lixo) => {
      expect(sanitizarMedida(lixo)).toBeNull();
    });
  });

  test("aviso de etiqueta estreita abaixo de 25 mm de largura", () => {
    expect(etiquetaPequenaDemais({ larguraMm: 24.9 })).toBe(true);
    expect(etiquetaPequenaDemais({ larguraMm: 25 })).toBe(false);
    expect(etiquetaPequenaDemais({ larguraMm: 15 })).toBe(true);
  });
});

describe("HTML da medida livre (mesmo renderizador)", () => {
  test("página, linha, célula e vão saem da medida; labelSize é ignorado", () => {
    const html = buildLabelHtml(ITENS, { ...BASE, labelSize: "58mm", customSpec: spec({ larguraMm: 40, alturaMm: 25, colunas: 2, espacoLadoMm: 3, espacoLinhaMm: 2 }) });
    expect(pagina(html)).toEqual([83, 27]);
    expect(html).toContain("table{border-collapse:collapse;width:83mm;table-layout:fixed}tr{height:27mm;page-break-inside:avoid}");
    expect(html).toContain(".cell{width:40mm;height:25mm;");
    expect(html).toContain(".colgap{width:3mm;height:25mm;");
    expect(html).not.toContain("padl"); // nada do 58mm
    expect(html).toContain("Etiqueta 40x25mm x 2 colunas");
    expect((tabela(html).match(/<tr>/g) || []).length).toBe(2); // 4 etiquetas, 2 por linha
  });

  test("conteúdo: desenho editorial com o MESMO .bc-box/SVG e o BARCODE_OPTS (LOCKED)", () => {
    const html = buildLabelHtml(ITENS, { ...BASE, customSpec: spec() });
    expect(html).toContain('<div class="bc-inner ed">');
    expect(html).toContain('<div class="bc-box"><svg id="bc-0" data-code="7891234567895"></svg></div>');
    expect(html).toContain("var opts={width:1,height:24,margin:1,displayValue:true,fontSize:7,textMargin:0,");
    expect(html).toContain('<span class="variant">M · Azul</span>');
  });

  test("ajuste X/Y vira translate na tabela (+ direita/baixo), e o slider da loja não aparece", () => {
    const xy = buildLabelHtml(ITENS, { ...BASE, offsetMm: 3, customSpec: spec({ ajusteXMm: 1.5, ajusteYMm: -0.5 }) });
    expect(xy).toContain("table-layout:fixed;transform:translate(1.5mm,-0.5mm)}");
    expect(xy).not.toContain('id="offsetRange"');
    expect(xy).toContain("Ajuste desta medida: horizontal 1,5 mm, vertical -0,5 mm.");
    const soX = buildLabelHtml(ITENS, { ...BASE, customSpec: spec({ ajusteXMm: -2 }) });
    expect(soX).toContain("table-layout:fixed;transform:translateX(-2mm)}");
    // offsetMm da loja (pdv_settings) não vale para a medida livre
    const zero = buildLabelHtml(ITENS, { ...BASE, offsetMm: 3, customSpec: spec() });
    expect(zero).not.toContain("transform:translate");
  });

  test("modo contínuo, passo e deslocamento vertical por computador não valem para a medida livre", () => {
    const html = buildLabelHtml(ITENS, { ...BASE, customSpec: spec(), continuous: true, rowPitchMm: 40, offsetYMm: 3 });
    expect(pagina(html)).toEqual([50, 32]);
    expect(html).toContain("tr{height:32mm;");
    expect(html).not.toContain("tr:last-child");
    expect(html).not.toContain("transform:translate");
  });

  test("os modelos fixos não ganham translate, nem o texto do ajuste da medida, e seguem com o slider", () => {
    LABEL_SIZE_KEYS.forEach((k) => {
      const html = buildLabelHtml(ITENS, { ...BASE, labelSize: k });
      expect(html).not.toContain("transform:translate");
      expect(html).not.toContain("Ajuste desta medida");
      expect(html).toContain('id="offsetRange"');
    });
  });

  test("texto proporcional só na medida maior: 60x40 (compacto, 1,8x)", () => {
    const html = buildLabelHtml(ITENS, { ...BASE, customSpec: spec({ larguraMm: 60, alturaMm: 40 }) });
    expect(html).toContain(".bc-inner.ed .name{font-size:10.8pt}");
    expect(html).toContain(".bc-inner.ed .price{font-size:16.2pt}");
    expect(html).toContain("var pt=10.8;n.style.fontSize=pt");
    expect(html).toContain("var vp=7.9;");
    const pequena = buildLabelHtml(ITENS, { ...BASE, customSpec: spec({ larguraMm: 33, alturaMm: 21 }) });
    expect(pequena).toContain("var pt=6.5;n.style.fontSize=pt");
    expect(pequena).toContain("var vp=4.4;");
    expect(pequena).not.toMatch(/\.bc-inner\.ed \.name\{font-size:[0-9.]+pt\}/);
  });

  test("QR também respeita a medida", () => {
    const html = buildLabelHtml(ITENS, { ...BASE, mode: "qr", customSpec: spec({ larguraMm: 40, alturaMm: 30 }) });
    expect(html).toContain(".qr-inner .qr{width:26mm;height:26mm;");
    expect(html).not.toContain("JsBarcode.all.min.js");
  });
});

describe("teste de posição da medida (moldura, cruz e setas)", () => {
  test("uma linha, uma moldura por coluna, sem produto e sem código de barras", () => {
    const html = buildCustomLabelTestHtml(spec({ larguraMm: 33, alturaMm: 21, colunas: 3, espacoLadoMm: 3, espacoLinhaMm: 2.5 }));
    expect(html).toContain("<title>Teste de posição da etiqueta</title>");
    expect((html.match(/<svg class="tf"/g) || []).length).toBe(3);
    expect((tabela(html).match(/<tr>/g) || []).length).toBe(1);
    expect(html).not.toContain("data-code=");
    expect(pagina(html)).toEqual([105, 23.5]);
    // moldura 1 mm para dentro, cruz no centro, 4 setas
    expect(html).toContain('<rect x="1" y="1" width="31" height="19" rx="0.6"/>');
    expect(html).toContain('<line x1="12.93" y1="10.5" x2="20.07" y2="10.5"/>');
    expect((html.match(/<polygon/g) || []).length).toBe(3 * 4);
    expect(html).toContain('width="33mm" height="21mm" viewBox="0 0 33 21"');
  });

  test("o teste leva o MESMO ajuste da etiqueta real", () => {
    const s = spec({ ajusteXMm: 2, ajusteYMm: 1 });
    expect(buildCustomLabelTestHtml(s)).toContain("transform:translate(2mm,1mm)}");
    expect(buildLabelHtml(ITENS, { ...BASE, customSpec: s })).toContain("transform:translate(2mm,1mm)}");
    expect(pagina(buildCustomLabelTestHtml(s))).toEqual(pagina(buildLabelHtml(ITENS, { ...BASE, customSpec: s })));
  });
});

describe("pré-visualização com a medida", () => {
  test("geometria da 1a página: largura do rolo e 1 linha", () => {
    const geo = labelPreviewGeometry(ITENS, { ...BASE, customSpec: spec({ colunas: 2 }) });
    expect(geo).toEqual({ rows: 1, labels: 2, widthMm: 103, heightMm: 32 });
    expect(buildLabelPreviewHtml(ITENS, { ...BASE, customSpec: spec({ colunas: 2 }) })).toContain(".pv-page{position:absolute;left:10mm;top:10mm;width:103mm;height:32mm;");
  });
});

describe("armazenamento por computador (localStorage por empresa)", () => {
  beforeEach(() => window.localStorage.clear());

  test("lista vazia; salvar, editar pelo id, escolher e apagar", () => {
    expect(lerMinhasMedidas("emp-1")).toEqual({ medidas: [], escolhida: null });
    expect(salvarMedida("emp-1", spec({ id: "a" })).guardou).toBe(true);
    expect(salvarMedida("emp-1", spec({ id: "b", larguraMm: 40, alturaMm: 25 })).guardou).toBe(true);
    expect(listarMedidas("emp-1").map((m) => m.id)).toEqual(["a", "b"]);

    const ed = salvarMedida("emp-1", spec({ id: "a", ajusteXMm: 12 }));
    expect(ed.medida!.ajusteXMm).toBe(8);
    expect(listarMedidas("emp-1")).toHaveLength(2);
    expect(listarMedidas("emp-1")[0].ajusteXMm).toBe(8);

    expect(escolherMedida("emp-1", "b")).toBe(true);
    expect(medidaEscolhida("emp-1")!.larguraMm).toBe(40);
    expect(escolherMedida("emp-1", "nao-existe")).toBe(false);

    expect(apagarMedida("emp-1", "b")).toBe(true);
    expect(medidaEscolhida("emp-1")).toBeNull();
    expect(listarMedidas("emp-1").map((m) => m.id)).toEqual(["a"]);
    apagarMedida("emp-1", "a");
    expect(window.localStorage.getItem(MINHAS_MEDIDAS_PREFIXO + "emp-1")).toBeNull();
  });

  test("multi-CNPJ: cada empresa ativa tem a sua lista", () => {
    salvarMedida("emp-1", spec({ id: "a" }));
    salvarMedida("emp-2", spec({ id: "c", larguraMm: 60, alturaMm: 40 }));
    expect(listarMedidas("emp-1").map((m) => m.id)).toEqual(["a"]);
    expect(listarMedidas("emp-2").map((m) => m.id)).toEqual(["c"]);
    expect(listarMedidas(null)).toEqual([]);
    expect(salvarMedida(null, spec()).guardou).toBe(false);
  });

  test("lixo no navegador é descartado e fora da faixa volta ao limite", () => {
    window.localStorage.setItem(MINHAS_MEDIDAS_PREFIXO + "emp-1", "{não é json");
    expect(lerMinhasMedidas("emp-1")).toEqual({ medidas: [], escolhida: null });

    window.localStorage.setItem(MINHAS_MEDIDAS_PREFIXO + "emp-1", JSON.stringify({
      medidas: [null, 7, { id: "a", larguraMm: 500, alturaMm: 30 }, { id: "a", larguraMm: 20, alturaMm: 20 }, { larguraMm: 50 }, { id: "b", larguraMm: "x", alturaMm: 20 }],
      escolhida: "fantasma",
    }));
    const lido = lerMinhasMedidas("emp-1");
    expect(lido.medidas).toHaveLength(1);
    expect(lido.medidas[0]).toMatchObject({ id: "a", larguraMm: 110, alturaMm: 30 });
    expect(lido.escolhida).toBeNull();

    window.localStorage.setItem(MINHAS_MEDIDAS_PREFIXO + "emp-1", JSON.stringify({ medidas: "x", escolhida: 3 }));
    expect(lerMinhasMedidas("emp-1")).toEqual({ medidas: [], escolhida: null });
  });

  test("navegador bloqueando o storage: lê vazio e avisa que não guardou, sem quebrar", () => {
    const desc = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
    try {
      expect(lerMinhasMedidas("emp-1")).toEqual({ medidas: [], escolhida: null });
      const r = salvarMedida("emp-1", spec());
      expect(r.guardou).toBe(false);
      expect(r.medida).toMatchObject({ id: "m1", larguraMm: 50 });
      expect(apagarMedida("emp-1", "m1")).toBe(false);
      expect(medidaEscolhida("emp-1")).toBeNull();
    } finally {
      if (desc) Object.defineProperty(window, "localStorage", desc);
      else delete (window as any).localStorage;
    }
  });

  test("setItem estourando (cota cheia): guardou false", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new Error("QuotaExceededError"); };
    try {
      expect(salvarMedida("emp-1", spec()).guardou).toBe(false);
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});
