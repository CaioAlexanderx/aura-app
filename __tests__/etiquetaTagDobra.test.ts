// ============================================================================
// AURA. — Etiquetas: tag vertical com linha de dobra (dobraMm) — 28/10/2026
//
// Opção B do mockup (https://claude.ai/artifact/7brLRCqJvVV5sLLUxmicAD),
// escolhida pelo Caio para a tag couchê 35x60 da Doce Encanto (dobra a
// ~40 mm do topo pela foto; a loja confere com régua): em cima da linha,
// furo, loja, nome, Cód, C/T e o código de barras terminando 1,5 mm acima da
// linha; embaixo, o preço maior (20pt), centralizado na faixa, com a linha
// "Cartão" logo abaixo. Com dobra, a loja cabe em largura - 3 mm com mais
// 1 mm de folga e o ajuste a desce até 8pt (a ZD220 perde ~0,5 mm na borda
// de fora das colunas 1 e 3 do rolo de 105 mm).
//
// Só liga com dobraMm > 0 numa medida em pé (ehTagVertical). Sem dobra, TODA
// etiqueta sai byte a byte como antes: fixtures douradas de
// etiquetasDouradas.test.ts, etiquetaMedidaLivreDourada.test.ts e
// etiquetaTagVertical.test.ts (intocadas) e a fixture
// "tag-35x60-sem-dobra-3-produtos", gravada a partir da main antes do código.
// ============================================================================
import fs from "fs";
import path from "path";
import { buildLabelHtml, buildCustomLabelTestHtml } from "@/components/screens/estoque/labels/buildLabelHtml";
import { customLabelPreset, sanitizarMedida, tagDobraMm } from "@/components/screens/estoque/labels/customLabel";
import { sanitizarMinhasMedidas } from "@/components/screens/estoque/labels/customLabelStorage";
import { medidasDaConta, medidasParaConta } from "@/components/screens/estoque/labels/labelAccountSync";
import { medidaDosCampos, textosDaMedida } from "@/components/screens/estoque/labels/minhaMedidaRegras";
import {
  casosSemDobra, casosComDobra, ITENS_DOBRA, LOJA_DOBRA, MEDIDA_SEM_DOBRA, MEDIDA_DOBRA_40,
} from "./fixtures/etiquetas-tag-dobra/casos";
import { casosTag, ITENS_COM_VARIANTE, MEDIDA_DOCE_ENCANTO } from "./fixtures/etiquetas-tag-vertical/casos";

jest.mock("@/services/api", () => ({ request: jest.fn(() => Promise.resolve({ settings: {} })) }));

const DIR = path.join(__dirname, "fixtures", "etiquetas-tag-dobra");
const ler = (nome: string) => fs.readFileSync(path.join(DIR, nome + ".html"), "utf-8");
const BASE = { mode: "barcode" as const, storeName: LOJA_DOBRA, showStoreName: true };
const tem = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
function celulas(html: string): string[] {
  return html.split('<td class="cell">').slice(1).map((c) => c.slice(0, c.indexOf("</td>")));
}

describe("sem dobra: byte a byte como na main", () => {
  test.each(casosSemDobra().map((c) => [c.nome, c] as const))("%s", (_nome, c) => {
    expect(c.gerar()).toBe(ler(c.nome));
  });

  test.each([[0], [null], [undefined], [""], ["abc"], [-5], [60], [75], [7], [3]])(
    "dobraMm %p (ausente, zero, lixo, >= altura ou dentro do respiro do topo) = sem dobra",
    (d) => {
      const spec = { ...MEDIDA_SEM_DOBRA, dobraMm: d as any };
      expect(buildLabelHtml(ITENS_DOBRA, { ...BASE, customSpec: spec })).toBe(ler("tag-35x60-sem-dobra-3-produtos"));
      expect(tem(customLabelPreset(spec), "tagDobraMm")).toBe(false);
    },
  );

  test("a fixture da tag vertical de 22/10 sai igual com dobraMm 0", () => {
    const dirTag = path.join(__dirname, "fixtures", "etiquetas-tag-vertical");
    const c = casosTag()[0];
    expect(c.nome).toBe("tag-35x60-3col-com-variante");
    const esperado = fs.readFileSync(path.join(dirTag, c.nome + ".html"), "utf-8");
    expect(buildLabelHtml(ITENS_COM_VARIANTE, { ...BASE, customSpec: { ...MEDIDA_DOCE_ENCANTO, dobraMm: 0 } })).toBe(esperado);
  });

  test("medida deitada com dobra, QR e teste de posição: nada muda", () => {
    const deitada = { ...MEDIDA_SEM_DOBRA, larguraMm: 50, alturaMm: 30, colunas: 1 };
    expect(buildLabelHtml(ITENS_DOBRA, { ...BASE, customSpec: { ...deitada, dobraMm: 20 } }))
      .toBe(buildLabelHtml(ITENS_DOBRA, { ...BASE, customSpec: deitada }));
    expect(tem(customLabelPreset({ ...deitada, dobraMm: 20 }), "tagDobraMm")).toBe(false);
    expect(buildLabelHtml(ITENS_DOBRA, { ...BASE, mode: "qr", customSpec: MEDIDA_DOBRA_40 }))
      .toBe(buildLabelHtml(ITENS_DOBRA, { ...BASE, mode: "qr", customSpec: MEDIDA_SEM_DOBRA }));
    expect(buildCustomLabelTestHtml(MEDIDA_DOBRA_40)).toBe(buildCustomLabelTestHtml(MEDIDA_SEM_DOBRA));
  });
});

describe("com dobra: fixtures novas (byte a byte)", () => {
  test("uma fixture por caso", () => {
    const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".html")).sort();
    expect(arquivos).toEqual(casosSemDobra().concat(casosComDobra()).map((c) => c.nome + ".html").sort());
  });

  test.each(casosComDobra().map((c) => [c.nome, c] as const))("%s", (_nome, c) => {
    expect(c.gerar()).toBe(ler(c.nome));
  });
});

describe("medida: o campo dobraMm", () => {
  test("sanitizarMedida guarda a dobra (décimos, vírgula) e não cria a chave sem ela", () => {
    expect(sanitizarMedida({ ...MEDIDA_SEM_DOBRA, dobraMm: 40 })).toEqual({ ...MEDIDA_SEM_DOBRA, dobraMm: 40 });
    expect(sanitizarMedida({ ...MEDIDA_SEM_DOBRA, dobraMm: "42,96" })!.dobraMm).toBe(43);
    [undefined, null, 0, "", "abc", -1, 60, 80].forEach((d) => {
      const s = sanitizarMedida({ ...MEDIDA_SEM_DOBRA, dobraMm: d })!;
      expect(s).toEqual(MEDIDA_SEM_DOBRA);
      expect(tem(s, "dobraMm")).toBe(false);
    });
  });

  test("navegador (customLabelStorage) e conta (labelAccountSync) preservam a dobra", () => {
    expect(sanitizarMinhasMedidas({ medidas: [MEDIDA_DOBRA_40], escolhida: "mtag35x60v1" }).medidas).toEqual([MEDIDA_DOBRA_40]);
    expect(medidasDaConta({ label_custom_specs: [MEDIDA_DOBRA_40] })).toEqual([MEDIDA_DOBRA_40]);
    expect(medidasParaConta([MEDIDA_DOBRA_40])).toEqual([MEDIDA_DOBRA_40]);
    // Sem dobra, o que sobe para a conta é o mesmo JSON de antes.
    expect(JSON.stringify(medidasParaConta([MEDIDA_SEM_DOBRA]))).not.toContain("dobraMm");
  });

  test("assistente da Minha medida: editar os campos não perde a dobra", () => {
    const r = medidaDosCampos(MEDIDA_DOBRA_40, { ...textosDaMedida(MEDIDA_DOBRA_40), espacoLinha: "1" }, 3);
    expect(r.spec).toEqual({ ...MEDIDA_DOBRA_40, espacoLinhaMm: 1 });
  });

  test("preset: tagDobraMm só na tag vertical, entre o respiro do topo e a altura", () => {
    expect(customLabelPreset(MEDIDA_DOBRA_40).tagDobraMm).toBe(40);
    expect(customLabelPreset({ ...MEDIDA_SEM_DOBRA, dobraMm: 43 }).tagDobraMm).toBe(43);
    expect(tagDobraMm({ alturaMm: 60, dobraMm: 7.1 })).toBe(7.1);
    expect(tagDobraMm({ alturaMm: 60, dobraMm: 7 })).toBeUndefined();
    expect(tagDobraMm({ alturaMm: 60, dobraMm: 59.9 })).toBe(59.9);
    expect(tagDobraMm({ alturaMm: 60 })).toBeUndefined();
    // A geometria da página não muda com a dobra.
    const { tagDobraMm: _d, ...resto } = customLabelPreset(MEDIDA_DOBRA_40);
    expect(resto).toEqual(customLabelPreset(MEDIDA_SEM_DOBRA));
  });
});

describe("desenho com dobra (opção B)", () => {
  const html = buildLabelHtml(ITENS_DOBRA, { ...BASE, customSpec: MEDIDA_DOBRA_40 });

  test("em cima: loja, nome, Cód, C/T e código de barras; embaixo: preço e Cartão", () => {
    const c = celulas(html);
    expect(c[0]).toBe(
      '<div class="bc-inner tv dobra"><div class="tv-top"><div class="tv-blk"><div class="store">DOCE ENCANTO</div>' +
      '<div class="name">REGATA CETIM</div><div class="cod">Cód: 221</div><div class="var"><span>C: Branco</span><span>T: M</span></div>' +
      '<div class="bc-box"><svg id="bc-0" data-code="7891234567895"></svg></div></div></div>' +
      '<div class="tv-bot"><div class="price"><span class="cur">R$</span>49,90</div></div></div>',
    );
    expect(c[2]).toContain('<div class="tv-bot"><div class="price"><span class="cur">R$</span>159,99</div><div class="card-line">Cartão <b>R$ 169,90</b></div></div>');
  });

  test("duas zonas com altura em mm: dobra - topo (33) e altura - dobra (20); código termina 1,5 mm acima da linha", () => {
    expect(html).toContain(".bc-inner.tv.dobra{padding:7mm 1.5mm 0;gap:0}");
    expect(html).toContain(".bc-inner.tv.dobra .tv-top{height:33mm;width:100%;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:1.3mm;overflow:hidden}");
    expect(html).toContain(".bc-inner.tv.dobra .tv-bot{height:20mm;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;");
    const h43 = buildLabelHtml(ITENS_DOBRA, { ...BASE, customSpec: { ...MEDIDA_SEM_DOBRA, dobraMm: 43 } });
    expect(h43).toContain(".tv-top{height:36mm;");
    expect(h43).toContain(".tv-bot{height:17mm;");
  });

  test("código de barras: MESMO .bc-box/SVG, BARCODE_OPTS (LOCKED) e nenhuma regra nova para ele", () => {
    expect(html).toContain('<div class="bc-box"><svg id="bc-0" data-code="7891234567895"></svg></div>');
    expect(html).toContain("var opts={width:1,height:24,margin:1,displayValue:true,fontSize:7,textMargin:0,font:\"Arial\",fontOptions:\"bold\",background:\"#ffffff\",lineColor:\"#000000\"};");
    expect(html).toContain(".bc-inner .bc-box{flex:1 1 auto;width:100%;max-width:32mm;");
    expect(html).not.toMatch(/\.dobra[^{]*\.bc-box/);
    expect(html).not.toMatch(/\.tv[^{]*svg\{/);
    expect((html.match(/data-code="/g) || []).length).toBe(3);
  });

  test("preço maior (20pt x escala) e o ajuste parte de 20pt; loja desce até 8pt com 1 mm de folga", () => {
    expect(html).toContain(".bc-inner.tv.dobra .price{font-size:20pt;width:100%}");
    expect(html).toContain('shrink(q(".price"),20,10,over)');
    expect(html).toContain('shrink(q(".store"),10,8,over)');
    expect(html).toContain(".bc-inner.tv.dobra .tv-blk>.store{margin:0 0.5mm 1mm;width:auto}");
    // Sem dobra: os números de antes.
    const sem = buildLabelHtml(ITENS_DOBRA, { ...BASE, customSpec: MEDIDA_SEM_DOBRA });
    expect(sem).toContain('shrink(q(".price"),16,10,over)');
    expect(sem).toContain('shrink(q(".store"),10,9,over)');
    expect(sem).not.toContain("dobra");
    // Tag mais larga: tudo na escala do texto (50 mm = 1,45x).
    const larga = buildLabelHtml(ITENS_DOBRA, { ...BASE, customSpec: { ...MEDIDA_DOBRA_40, larguraMm: 50, alturaMm: 80, colunas: 1, dobraMm: 55 } });
    expect(larga).toContain(".bc-inner.tv.dobra .price{font-size:29pt;width:100%}");
    expect(larga).toContain('shrink(q(".price"),29,14.5,over)');
    expect(larga).toContain('shrink(q(".store"),14.5,11.6,over)');
  });

  test("sem nome da loja: a linha some e as zonas ficam", () => {
    const sem = buildLabelHtml(ITENS_DOBRA, { ...BASE, showStoreName: false, customSpec: MEDIDA_DOBRA_40 });
    expect(sem).not.toContain('<div class="store">');
    expect(sem).toContain(".tv-top{height:33mm;");
  });
});
