// ============================================================================
// AURA. — Etiquetas: estilo "boutique" OPT-IN da Minha medida (28/10/2026)
//
// Opt-in (customLabel.ts, estilo: "boutique"), aprovado pelo Caio para a
// Lulume Baby & Kids (40x25 mm, 2 colunas). Sem o campo ligado, TODA etiqueta
// — fixos e Minha medida — sai byte a byte igual ao de antes (cobrado em
// etiquetasDouradas.test.ts, etiquetaMedidaLivreDourada.test.ts e
// etiquetaTagVertical.test.ts). Aqui: as fixtures do desenho novo + as regras.
// ============================================================================
import fs from "fs";
import path from "path";
import {
  buildLabelHtml, buildCustomLabelTestHtml, LABEL_SIZE_KEYS, type LabelItem,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import {
  customLabelPreset, sanitizarMedida, ehTagVertical, type CustomLabelSpec,
} from "@/components/screens/estoque/labels/customLabel";
import {
  casosBoutique, MEDIDA_LULUME, LOJA_LULUME, ITENS_MISTO, ITENS_SEM_VARIANTE, ITENS_COM_VARIANTE,
} from "./fixtures/etiquetas-boutique/casos";
import { ITENS_DOURADOS } from "./fixtures/etiquetas/casos";

const DIR = path.join(__dirname, "fixtures", "etiquetas-boutique");
const CASOS = casosBoutique();
const BASE = { mode: "barcode" as const, storeName: LOJA_LULUME, showStoreName: true };

function medida(p: Partial<CustomLabelSpec>): CustomLabelSpec {
  return { ...MEDIDA_LULUME, ...p };
}
function celulas(html: string): string[] {
  return html.split('<td class="cell">').slice(1).map((c) => c.slice(0, c.indexOf("</td>")));
}

describe("opt-in de verdade: sem o campo, nada muda", () => {
  test('sanitizarMedida só aceita exatamente "boutique"; outro valor some', () => {
    expect(sanitizarMedida({ ...MEDIDA_LULUME })!.estilo).toBe("boutique");
    expect(sanitizarMedida({ ...MEDIDA_LULUME, estilo: "editorial" } as any)!.estilo).toBeUndefined();
    expect(sanitizarMedida({ ...MEDIDA_LULUME, estilo: "" } as any)!.estilo).toBeUndefined();
    const semEstilo = { ...MEDIDA_LULUME } as any;
    delete semEstilo.estilo;
    expect("estilo" in (sanitizarMedida(semEstilo) as object)).toBe(false);
  });

  test("o campo estilo não muda um byte das etiquetas sem o opt-in (modelos fixos × desenhos × QR, e medida sem estilo)", () => {
    LABEL_SIZE_KEYS.forEach((k) => {
      [undefined, "classico", "editorial"].forEach((d) => {
        (["barcode", "qr"] as const).forEach((mode) => {
          const o = { mode: mode, storeName: "Loja", showStoreName: true, labelSize: k, design: d as any };
          const html = buildLabelHtml(ITENS_DOURADOS, o);
          expect(html).not.toContain("bc-inner bq");
          expect(html).not.toContain(".bc-inner.bq");
        });
      });
    });
    // Mesma medida, com e sem estilo boutique nos campos: só muda quando liga.
    const sem = { ...BASE, customSpec: medida({ estilo: undefined as any }) };
    const htmlSem = buildLabelHtml(ITENS_MISTO, sem);
    expect(htmlSem).not.toContain("bc-inner bq");
    expect(htmlSem).toContain('<div class="bc-inner ed'); // 40x25 sem opt-in = editorial
  });
});

describe("fixtures novas da boutique (byte a byte)", () => {
  test("12 fixtures, uma por caso", () => {
    expect(CASOS.length).toBe(12);
    const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".html")).sort();
    expect(arquivos).toEqual(CASOS.map((c) => c.nome + ".html").sort());
  });

  test.each(CASOS.map((c) => [c.nome, c] as const))("%s", (_nome, c) => {
    const esperado = fs.readFileSync(path.join(DIR, c.nome + ".html"), "utf-8");
    expect(c.gerar()).toBe(esperado);
  });
});

describe("o desenho boutique", () => {
  const html = buildLabelHtml(ITENS_MISTO, { ...BASE, customSpec: MEDIDA_LULUME });

  test("preset: estilo boutique vira design boutique e escalaTexto segue valendo", () => {
    const p = customLabelPreset(MEDIDA_LULUME);
    expect(p.design).toBe("boutique");
    expect(p.cellWidthMm).toBe(40);
    expect(p.cellHeightMm).toBe(25);
    expect(p.escalaTexto).toBeGreaterThanOrEqual(1);
  });

  test("ordem: faixa (loja vazada) -> nome -> cor/tam -> código de barras -> preço", () => {
    expect(celulas(html)[0]).toBe(
      '<div class="bc-inner bq"><div class="bq-band"><span class="bq-store">LULUME BABY &amp; KIDS</span></div>' +
      '<div class="bq-body"><div class="name">Vestido Floral Alcinha Infantil</div>' +
      '<div class="var">VM Chama • Tam 8</div>' +
      '<div class="bc-box"><svg id="bc-0" data-code="7891234567895"></svg></div>' +
      '<div class="price"><span class="cur">R$</span>89,90</div></div></div>',
    );
  });

  test("código de barras LOCKED: o MESMO .bc-box/SVG, o BARCODE_OPTS, e nenhuma regra que mexa no tamanho do SVG", () => {
    expect(html).toContain('<div class="bc-box"><svg id="bc-0" data-code="7891234567895"></svg></div>');
    expect(html).toContain("var opts={width:1,height:24,margin:1,displayValue:true,fontSize:7,textMargin:0,font:\"Arial\",fontOptions:\"bold\",background:\"#ffffff\",lineColor:\"#000000\"};");
    expect(html).toContain(".bc-inner .bc-box{flex:1 1 auto;width:100%;max-width:37mm;"); // 40 - 3 (LOCKED)
    // A boutique só acrescenta alinhamento/respiro ao .bc-box — nada de flex/max-width/overflow/svg.
    expect(html).toContain(".bc-inner.bq .bc-box{align-self:center;padding:0.3mm 0 0}");
    expect(html).not.toMatch(/\.bc-inner\.bq[^{]*svg\{/);
    expect(html).not.toMatch(/\.bc-inner\.bq \.bc-box\{[^}]*(flex|max-width|overflow)/);
  });

  test("faixa preta com a loja vazada (branco) e impressa (print-color-adjust)", () => {
    expect(html).toContain(".bc-inner.bq .bq-band{width:100%;background:#000;");
    expect(html).toContain("-webkit-print-color-adjust:exact;print-color-adjust:exact}");
    expect(html).toMatch(/\.bc-inner\.bq \.bq-store\{[^}]*color:#fff[^}]*text-transform:uppercase/);
  });

  test("tudo preto sólido sobre branco: sem cinza nem meio-tom no desenho boutique", () => {
    const bloco = html.slice(html.indexOf(".bc-inner.bq{"), html.indexOf(".qr-inner{"));
    // As únicas cores do bloco boutique são #000 e #fff (nada de cinza/meio-tom).
    const cores = (bloco.match(/#[0-9a-f]{3,6}/gi) || []).map((c) => c.toLowerCase());
    expect(cores.length).toBeGreaterThan(0);
    cores.forEach((c) => expect(["#000", "#fff"]).toContain(c));
    expect(bloco).not.toContain("rgba");
    expect(bloco).not.toContain("rgb(");
    expect(bloco).not.toContain("gray");
    expect(bloco).not.toContain("grey");
  });

  test("fonte condensada de sistema, sem fonte de rede (imprime offline)", () => {
    expect(html).toContain('font-family:"Arial Narrow",Arial,Helvetica,sans-serif');
    expect(html).not.toContain("fonts.googleapis.com"); // nada de Montserrat/Google Fonts na boutique
    expect(html).not.toContain("Montserrat");
  });

  test("auto-encolher: a faixa da loja numa linha só; nome em até 2 linhas; preço na largura", () => {
    expect(html).toContain('document.querySelectorAll(".bc-inner.bq")');
    expect(html).toMatch(/shrink\(q\("\.bq-store"\),[0-9.]+,[0-9.]+,over\)/);
    expect(html).toMatch(/shrink\(q\("\.name"\),[0-9.]+,[0-9.]+,tall\)/);
    expect(html).toMatch(/shrink\(q\("\.price"\),[0-9.]+,[0-9.]+,over\)/);
    expect(html).toContain('q(".bq-store").style.letterSpacing="0"');
  });

  test("cor em hex vira nome; só cor; só tamanho; nenhum -> a linha some", () => {
    // ITENS_MISTO[2] (Conjunto, só cor "Rosa") tem qty 2 -> ocupa c[2] e c[3];
    // o Macacão (só tam "M") é c[4].
    const c = celulas(buildLabelHtml(ITENS_MISTO, { ...BASE, customSpec: MEDIDA_LULUME }));
    expect(c[1]).toContain('<div class="var">Rosa claro • Tam P</div>'); // #ffc0cb -> Rosa claro
    expect(c[2]).toContain('<div class="var">Rosa</div>'); // só cor
    expect(c[4]).toContain('<div class="var">Tam M</div>'); // só tamanho
  });

  test("produtos sem cor/tam (importados da Lulume): a linha cor/tam some", () => {
    celulas(buildLabelHtml(ITENS_SEM_VARIANTE, { ...BASE, customSpec: MEDIDA_LULUME }))
      .forEach((x) => expect(x).not.toContain('class="var"'));
  });

  test("sem nome da loja: nenhuma faixa preta vazia", () => {
    const sem = buildLabelHtml(ITENS_MISTO, { ...BASE, showStoreName: false, customSpec: MEDIDA_LULUME });
    expect(sem).not.toContain('class="bq-band"');
    expect(sem).toContain('<div class="bc-inner bq"><div class="bq-body">');
  });

  test("preço no cartão: linha 'Cartão' abaixo do preço, também em preto", () => {
    const itens: LabelItem[] = [{ ...ITENS_COM_VARIANTE[0], cardPrice: 119.9 }];
    expect(celulas(buildLabelHtml(itens, { ...BASE, customSpec: MEDIDA_LULUME }))[0])
      .toContain('<div class="price"><span class="cur">R$</span>129,90</div><div class="card-line">Cartão <b>R$ 119,90</b></div>');
  });

  test("filete fino acima do preço", () => {
    expect(html).toMatch(/\.bc-inner\.bq \.price\{[^}]*border-top:0\.3mm solid #000/);
  });
});

describe("boutique vence a proporção; QR e teste de posição caem no editorial", () => {
  test("opt-in boutique numa medida em pé (35x60) vence a tag vertical", () => {
    const m = medida({ larguraMm: 35, alturaMm: 60, colunas: 3, espacoLadoMm: 0, espacoLinhaMm: 0 });
    expect(ehTagVertical(m)).toBe(true); // a proporção, sozinha, pediria tag vertical
    expect(customLabelPreset(m).design).toBe("boutique"); // o opt-in vence
    const h = buildLabelHtml(ITENS_MISTO, { ...BASE, customSpec: m });
    expect(h).toContain('<div class="bc-inner bq">');
    expect(h).not.toContain("bc-inner tv");
  });

  test("QR da medida boutique: sem a boutique, cai no editorial (como sem o opt-in)", () => {
    const qr = buildLabelHtml(ITENS_MISTO, { ...BASE, mode: "qr", customSpec: MEDIDA_LULUME });
    expect(qr).not.toContain("bc-inner bq");
    expect(qr).not.toContain(".bc-inner.bq");
    expect(qr).toContain('class="qr-inner"');
  });

  test("teste de posição (moldura) da medida boutique: sem a boutique", () => {
    const teste = buildCustomLabelTestHtml(MEDIDA_LULUME);
    expect(teste).not.toContain(".bc-inner.bq");
    expect(teste).toContain(".bc-inner.ed{");
  });
});
