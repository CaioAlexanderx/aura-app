// ============================================================================
// AURA. — Etiquetas: desenho "tag vertical" da Minha medida (22/10/2026)
//
// Regra (customLabel.ts): medida própria em pé, com altura >= 1,5 x largura,
// sai no desenho "tag vertical" (loja no topo, nome, Cód, C/T, código de
// barras e preço grande no rodapé). Qualquer outra medida e todos os modelos
// fixos continuam como antes — cobrados byte a byte em
// etiquetaMedidaLivreDourada.test.ts e etiquetasDouradas.test.ts.
// ============================================================================
import fs from "fs";
import path from "path";
import {
  buildLabelHtml, buildLabelPreviewHtml, buildCustomLabelTestHtml, LABEL_SIZE_KEYS, type LabelItem,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import {
  customLabelPreset, ehTagVertical, tagTopoMm, tagEscala, PROPORCAO_TAG_VERTICAL, type CustomLabelSpec,
} from "@/components/screens/estoque/labels/customLabel";
import { desenhoDoRolo } from "@/components/screens/estoque/labels/minhaMedidaRegras";
import {
  casosTag, MEDIDA_DOCE_ENCANTO, LOJA_TAG, ITENS_COM_VARIANTE, ITENS_SEM_VARIANTE, ITENS_PRECO_MILHAR,
} from "./fixtures/etiquetas-tag-vertical/casos";
import { ITENS_DOURADOS } from "./fixtures/etiquetas/casos";

const DIR = path.join(__dirname, "fixtures", "etiquetas-tag-vertical");
const CASOS = casosTag();
const BASE = { mode: "barcode" as const, storeName: LOJA_TAG, showStoreName: true };

function medida(p: Partial<CustomLabelSpec>): CustomLabelSpec {
  return { ...MEDIDA_DOCE_ENCANTO, ...p };
}
function celulas(html: string): string[] {
  return html.split('<td class="cell">').slice(1).map((c) => c.slice(0, c.indexOf("</td>")));
}

describe("regra de proporção: medida em pé (altura >= 1,5 x largura)", () => {
  test("35x60 (Doce Encanto) entra no desenho novo", () => {
    expect(PROPORCAO_TAG_VERTICAL).toBe(1.5);
    expect(ehTagVertical({ larguraMm: 35, alturaMm: 60 })).toBe(true);
    expect(customLabelPreset(MEDIDA_DOCE_ENCANTO).design).toBe("tagVertical");
  });

  test("50x30 e 40x40 continuam no editorial", () => {
    [[50, 30], [40, 40]].forEach(([w, h]) => {
      expect(ehTagVertical({ larguraMm: w, alturaMm: h })).toBe(false);
      const p = customLabelPreset(medida({ larguraMm: w, alturaMm: h }));
      expect(p.design).toBe("editorial");
      expect(p.tagTopoMm).toBeUndefined();
      expect(p.tagEscala).toBeUndefined();
    });
  });

  test("35x52,5 (exatamente 1,5x) entra; 35x52,4 e 35x52 não", () => {
    expect(ehTagVertical({ larguraMm: 35, alturaMm: 52.5 })).toBe(true);
    expect(customLabelPreset(medida({ alturaMm: 52.5 })).design).toBe("tagVertical");
    expect(ehTagVertical({ larguraMm: 35, alturaMm: 52.4 })).toBe(false);
    expect(customLabelPreset(medida({ alturaMm: 52 })).design).toBe("editorial");
    // Sem erro de ponto flutuante nos décimos: 33,3 x 1,5 = 49,95
    expect(ehTagVertical({ larguraMm: 33.3, alturaMm: 50 })).toBe(true);
    expect(ehTagVertical({ larguraMm: 33.3, alturaMm: 49.9 })).toBe(false);
  });

  test("geometria, edCompact e escalaTexto da medida em pé não mudam (só o desenho)", () => {
    const p = customLabelPreset(MEDIDA_DOCE_ENCANTO);
    expect(p).toMatchObject({ pageWidthMm: 105, pageHeightMm: 60, cols: 3, cellWidthMm: 35, cellHeightMm: 60, edCompact: true, escalaTexto: 1.05 });
    expect(p.colGapMm).toBeUndefined();
    expect(p.rowGapMm).toBeUndefined();
    expect(p.tagTopoMm).toBe(7);
    expect(p.tagEscala).toBe(1);
  });

  test("respiro do topo e escala do texto", () => {
    expect(tagTopoMm({ alturaMm: 60 })).toBe(7);
    expect(tagTopoMm({ alturaMm: 80 })).toBe(7);
    expect(tagTopoMm({ alturaMm: 52.5 })).toBe(6.3);
    expect(tagEscala({ larguraMm: 35 })).toBe(1);
    expect(tagEscala({ larguraMm: 50 })).toBe(1.45);
    expect(tagEscala({ larguraMm: 20 })).toBe(0.75);
  });
});

describe("fixtures novas da tag vertical (byte a byte)", () => {
  test("7 fixtures, uma por caso", () => {
    expect(CASOS.length).toBe(7);
    const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".html")).sort();
    expect(arquivos).toEqual(CASOS.map((c) => c.nome + ".html").sort());
  });

  test.each(CASOS.map((c) => [c.nome, c] as const))("%s", (_nome, c) => {
    const esperado = fs.readFileSync(path.join(DIR, c.nome + ".html"), "utf-8");
    expect(c.gerar()).toBe(esperado);
  });
});

describe("conteúdo da tag 35x60", () => {
  const html = buildLabelHtml(ITENS_COM_VARIANTE, { ...BASE, customSpec: MEDIDA_DOCE_ENCANTO });

  test("ordem: loja, nome, Cód, C/T, código de barras, preço", () => {
    const c = celulas(html)[0];
    expect(c).toBe(
      '<div class="bc-inner tv"><div class="store">DOCE ENCANTO</div><div class="name">Vestido Floral Alcinha</div>' +
      '<div class="cod">Cód: 221</div><div class="var"><span>C: Azul</span><span>T: M</span></div>' +
      '<div class="bc-box"><svg id="bc-0" data-code="7891234567895"></svg></div>' +
      '<div class="price"><span class="cur">R$</span>159,99</div></div>',
    );
  });

  test("código de barras: o MESMO .bc-box/SVG e o BARCODE_OPTS (LOCKED), sem regra que mexa no tamanho do SVG", () => {
    expect(html).toContain('<div class="bc-box"><svg id="bc-0" data-code="7891234567895"></svg></div>');
    expect(html).toContain("var opts={width:1,height:24,margin:1,displayValue:true,fontSize:7,textMargin:0,font:\"Arial\",fontOptions:\"bold\",background:\"#ffffff\",lineColor:\"#000000\"};");
    expect(html).toContain(".bc-inner .bc-box{flex:1 1 auto;width:100%;max-width:32mm;");
    expect(html).not.toMatch(/\.bc-inner\.tv \.bc-box/);
    expect(html).not.toMatch(/\.tv[^{]*svg\{/);
    expect((html.match(/data-code="/g) || []).length).toBe(6);
  });

  test("respiro de 7 mm no topo, laterais de 1,5 mm (32 mm úteis = largura do .bc-box) e preço grande", () => {
    expect(html).toContain(".bc-inner.tv{justify-content:flex-start;gap:0.6mm;padding:7mm 1.5mm 2.5mm;");
    expect(html).toContain(".bc-inner.tv .price{font-size:16pt;font-weight:900;");
    expect(html).toContain(".bc-inner.tv .store{font-size:10pt;font-weight:700;");
    expect(html).toContain(".bc-inner.tv .name{font-size:8.5pt;");
  });

  test("a loja sai MAIOR que o nome do produto: font-size da .store > máximo da .name, em toda escala", () => {
    const tam = (h: string, sel: string) => {
      const i = h.indexOf(".bc-inner.tv " + sel + "{font-size:");
      const m = i < 0 ? null : h.slice(i).match(/font-size:([0-9.]+)pt/);
      return m ? parseFloat(m[1]) : NaN;
    };
    expect(tam(html, ".store")).toBe(10);
    expect(tam(html, ".name")).toBe(8.5);
    expect(tam(html, ".store")).toBeGreaterThan(tam(html, ".name"));
    // Largura da tag muda a escala do texto (0,75x a 1,5x): a relação se mantém,
    // inclusive no piso do ajuste (loja nunca desce abaixo de 9pt contra 8,5pt do nome).
    [{ larguraMm: 30, alturaMm: 60 }, { larguraMm: 35, alturaMm: 60 }, { larguraMm: 50, alturaMm: 80 }, { larguraMm: 20, alturaMm: 45 }].forEach((d) => {
      const h = buildLabelHtml(ITENS_COM_VARIANTE, { ...BASE, customSpec: medida({ ...d, colunas: 1 }) });
      expect(tam(h, ".store")).toBeGreaterThan(tam(h, ".name"));
      const k = tagEscala(d);
      const loja = h.match(/shrink\(q\("\.store"\),([0-9.]+),([0-9.]+),over\)/);
      const nome = h.match(/shrink\(q\("\.name"\),([0-9.]+),([0-9.]+),tall\)/);
      expect(loja && nome).toBeTruthy();
      expect(parseFloat(loja![1])).toBe(Math.round(10 * k * 100) / 100);
      expect(parseFloat(loja![2])).toBeGreaterThan(parseFloat(nome![1])); // piso da loja > teto do nome
    });
  });

  test("loja em negrito, numa linha só, e o ajuste a encolhe para caber (sem tocar no .bc-box)", () => {
    expect(html).toMatch(/\.bc-inner\.tv \.store\{font-size:10pt;font-weight:700;line-height:1\.1;/);
    expect(html).toContain('shrink(q(".store"),10,9,over)');
    expect(html).toContain('q(".store").style.letterSpacing="0"');
    expect(html).not.toMatch(/\.bc-inner \.store\{[^}]*10pt/); // a .store dos outros desenhos não mudou
  });

  test("só o CSS da tag: nada do editorial nem do Finesse em cima dela", () => {
    expect(html).not.toContain('class="bc-inner ed');
    expect(html).not.toContain(".bc-inner.ed");
    expect(html).toContain("family=Montserrat:wght@700;900"); // mesma fonte da loja do editorial
    expect(html).toContain('document.querySelectorAll(".bc-inner.tv")');
  });

  test("cor em hex vira nome; só tamanho; só cor", () => {
    const c = celulas(html);
    expect(c[1]).toContain('<div class="var"><span>C: Rosa claro</span><span>T: P</span></div>');
    expect(c[4]).toContain('<div class="var"><span>C: Verde militar</span></div>');
    expect(c[5]).toContain('<div class="var"><span>T: ÚNICO</span></div>');
  });

  test("sem variante: a linha C/T some; SKU vazio ou placeholder (---) tira a linha Cód", () => {
    const c = celulas(buildLabelHtml(ITENS_SEM_VARIANTE, { ...BASE, customSpec: MEDIDA_DOCE_ENCANTO }));
    c.forEach((x) => expect(x).not.toContain('class="var"'));
    expect(c[0]).toContain('<div class="cod">Cód: 88</div>');
    expect(c[1]).not.toContain('class="cod"');
    expect(c[2]).not.toContain('class="cod"');
  });

  test("preço com milhar", () => {
    const c = celulas(buildLabelHtml(ITENS_PRECO_MILHAR, { ...BASE, customSpec: MEDIDA_DOCE_ENCANTO }));
    expect(c[0]).toContain('<span class="cur">R$</span>1.234,56</div>');
    expect(c[1]).toContain('<span class="cur">R$</span>12.345,60</div>');
    expect(c[2]).toContain('<span class="cur">R$</span>1.000,00</div>');
  });

  test("sem nome da loja: a linha da loja some, o respiro fica", () => {
    const sem = buildLabelHtml(ITENS_COM_VARIANTE, { ...BASE, showStoreName: false, customSpec: MEDIDA_DOCE_ENCANTO });
    expect(sem).not.toContain('<div class="store">');
    expect(sem).toContain("padding:7mm 1.5mm 2.5mm;");
  });

  test("preço no cartão: linha 'Cartão' embaixo do preço", () => {
    const itens: LabelItem[] = [{ ...ITENS_COM_VARIANTE[0], cardPrice: 1299.9 }];
    expect(celulas(buildLabelHtml(itens, { ...BASE, customSpec: MEDIDA_DOCE_ENCANTO }))[0])
      .toContain('<div class="price"><span class="cur">R$</span>159,99</div><div class="card-line">Cartão <b>R$ 1.299,90</b></div>');
  });

  test("3 colunas, sem vão: página 105 x 60 e 2 linhas para 6 etiquetas", () => {
    expect(html).toContain("@page{margin:0;size:105mm 60mm}");
    expect(html).toContain("tr{height:60mm;");
    expect(html).not.toContain('<td class="colgap">');
  });
});

describe("prévia em tamanho real e o que não muda", () => {
  test("a prévia da tela de etiquetas mostra o desenho novo", () => {
    const pv = buildLabelPreviewHtml(ITENS_COM_VARIANTE, { ...BASE, customSpec: MEDIDA_DOCE_ENCANTO });
    expect(pv).toContain('<div class="bc-inner tv">');
    expect(pv).toContain(".pv-page{position:absolute;left:10mm;top:10mm;width:105mm;height:60mm;");
  });

  test("QR e teste de posição da medida em pé seguem como antes (sem tag vertical)", () => {
    const qr = buildLabelHtml(ITENS_COM_VARIANTE, { ...BASE, mode: "qr", customSpec: MEDIDA_DOCE_ENCANTO });
    expect(qr).not.toContain("bc-inner tv");
    expect(qr).not.toContain(".bc-inner.tv");
    const teste = buildCustomLabelTestHtml(MEDIDA_DOCE_ENCANTO);
    expect(teste).not.toContain(".bc-inner.tv");
    expect(teste).toContain(".bc-inner.ed{");
  });

  test("50x30 e 40x40 continuam no editorial", () => {
    [medida({ larguraMm: 50, alturaMm: 30, colunas: 1 }), medida({ larguraMm: 40, alturaMm: 40, colunas: 1 })].forEach((m) => {
      const h = buildLabelHtml(ITENS_COM_VARIANTE, { ...BASE, customSpec: m });
      expect(h).toContain('<div class="bc-inner ed">');
      expect(h).not.toContain("bc-inner tv");
      expect(h).not.toContain(".bc-inner.tv");
      expect(h).not.toContain("Cód:");
    });
  });

  test("o campo sku não muda um byte fora da tag vertical (modelos fixos × desenhos × QR, e medida deitada)", () => {
    const semSku = ITENS_DOURADOS;
    const comSku = ITENS_DOURADOS.map((i, n) => ({ ...i, sku: "SKU" + n }));
    LABEL_SIZE_KEYS.forEach((k) => {
      [undefined, "classico", "editorial"].forEach((d) => {
        (["barcode", "qr"] as const).forEach((mode) => {
          const o = { mode: mode, storeName: "Loja", showStoreName: true, labelSize: k, design: d as any };
          const a = buildLabelHtml(comSku, o);
          expect(a).toBe(buildLabelHtml(semSku, o));
          expect(a).not.toContain("bc-inner tv");
        });
      });
    });
    const deitada = { ...BASE, customSpec: medida({ larguraMm: 50, alturaMm: 30, colunas: 1 }) };
    expect(buildLabelHtml(comSku, deitada)).toBe(buildLabelHtml(semSku, deitada));
  });

  test("ilustração do assistente da Minha medida acompanha o desenho (só tela)", () => {
    expect(desenhoDoRolo({ larguraMm: 35, alturaMm: 60, colunas: 3, espacoLadoMm: 0, espacoLinhaMm: 0 })).toContain(">SUA LOJA</text>");
    expect(desenhoDoRolo({ larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2 })).not.toContain("SUA LOJA");
  });
});
