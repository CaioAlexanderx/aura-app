// ============================================================
// CarteirinhaLayout — orçamento vertical do cartão CR80 + fonte do Nome
//
// Nasceu do cartão FÍSICO de 13/08/2026 (faixa-preta): o nome
// "MARJORIE BARRAGAN REBELLO DA SILVA" quebrou em 2 linhas, empurrou o
// conteúdo e os campos "Faixa" e "Nº CBKT" saíram pela borda de baixo —
// os rótulos apareciam, os VALORES sumiam.
//
// O estouro de verdade só acontece dentro do motor de layout do navegador
// (.cr80 tem height:54mm fixo com overflow:hidden), e aqui não há DOM. O que
// DÁ para travar é a ARITMÉTICA: somar as alturas declaradas e falhar se o
// pior caso não couber. Mesmo espírito do orçamento de tempo que já existe em
// __tests__/components/ImportAlunosModal.test.ts (maior_parte × 0,6 < 60).
//
// Ponto importante: as alturas NÃO são redigitadas aqui. São extraídas do CSS
// realmente emitido por buildSingleCardHtml() — se alguém mexer em um gap, em
// um line-height ou na altura reservada do nome, a conta é refeita e o teste
// falha sozinho. É isso que impede a correção de ser desfeita sem querer.
//
// Modelo de caixa usado na soma (o mesmo do CSS):
//   .cr80 height fixa − padding vertical de .face-pad = área útil
//   − .head (min-height) − régua vermelha (margin+height)
//   − barra preta (só no Design 02) − margin-top do .body-row
//   = espaço disponível para a coluna .fields
// e .fields é um flex-column, então é a SOMA dos filhos + os gaps
// (nenhum filho encolhe: todos têm altura de texto ou height declarada).
// ============================================================

jest.mock("@/constants/karateTheme", () => ({
  resolveBeltKey: (s: string) =>
    /preta/i.test(String(s || "")) ? "preta" : "azul",
}));

// Os data URIs são rasters grandes e irrelevantes para a conta — mocka para o
// teste não carregar megabytes de base64 a cada import.
jest.mock("@/components/karate/carteirinha/fpktLogoDataUri", () => ({
  FPKT_LOGO_DATA_URI: "data:image/png;base64,AAAA",
}));
jest.mock("@/components/karate/carteirinha/dojoKunDataUri", () => ({
  DOJO_KUN_DATA_URI: "data:image/png;base64,BBBB",
}));

import {
  buildSingleCardHtml,
  pickNameFontPt,
  estimateNameLines,
  estimateTextWidthEm,
  NAME_FIELD_WIDTH_MM,
  NAME_FONT_STEPS_PT,
  NAME_MAX_LINES,
  NAME_RESERVED_H_MM,
} from "@/components/karate/carteirinha/buildCarteirinhaHtml";

const PT_TO_MM = 25.4 / 72;

// O nome do cartão impresso que originou tudo isto.
const MARJORIE = "MARJORIE BARRAGAN REBELLO DA SILVA";

function card(over: Record<string, unknown> = {}): any {
  return {
    student_name: "Ana Lima",
    belt_name: "Preta 1º Dan",
    birth_date: "2001-05-04",
    cpf: "11122233344",
    dojo_name: "Areikan Centro",
    card_number: "FPKT-000123",
    cbkt_number: "CBKT-98765",
    issued_at: "2026-08-13",
    verify_token: "tok",
    federation_name: "Federação Paulista de Karatê-Dô Tradicional",
    ...over,
  };
}

// ── extração do CSS realmente emitido ────────────────────────────────
// Só as regras de TELA (o bloco @media print só reforça peso/cor/tamanho de
// rótulo, e o cartão físico é cortado no mesmo tamanho nos dois casos).
function screenRules(html: string): Record<string, string> {
  const style = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (!style) throw new Error("nenhum <style> no HTML gerado");
  const screen = style[1].split("@media print{")[0];
  const rules: Record<string, string> = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(screen))) rules[m[1].trim()] = m[2];
  return rules;
}

function decl(rules: Record<string, string>, sel: string, prop: string): string {
  const block = rules[sel];
  if (block === undefined) throw new Error(`seletor ausente no CSS: "${sel}"`);
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(block);
  if (!m) throw new Error(`propriedade ausente: "${sel} { ${prop} }"`);
  return m[1].trim();
}

const num = (v: string) => parseFloat(v);
const mm = (rules: Record<string, string>, sel: string, prop: string) =>
  num(decl(rules, sel, prop));
/** Primeiro valor de um shorthand (padding/margin/gap: "a b c"). */
const first = (rules: Record<string, string>, sel: string, prop: string) =>
  num(decl(rules, sel, prop).split(/\s+/)[0]);
/** Altura de UMA linha de texto, em mm. */
const lineMm = (pt: number, lh: number) => pt * PT_TO_MM * lh;

/**
 * Soma o orçamento vertical de uma face frontal, lendo tudo do CSS emitido.
 * `preta` = Design 02 (tem barra preta + bloco Faixa/Nº CBKT).
 */
function verticalBudget(preta: boolean) {
  const html = buildSingleCardHtml(
    card({ belt_name: preta ? "Preta 1º Dan" : "Azul" }),
    "front"
  );
  const r = screenRules(html);

  const pad = decl(r, ".face-pad", "padding").split(/\s+/);
  const padTop = num(pad[0]);
  const padBottom = num(pad[2]);

  const cardH = mm(r, ".cr80", "height");
  const head = mm(r, ".head", "min-height");
  const ruler = first(r, ".ruler-red", "margin") + mm(r, ".ruler-red", "height");
  const bar = first(r, ".black-bar", "margin") + mm(r, ".black-bar", "height");
  const bodyMt = mm(r, preta ? ".is-preta .body-row" : ".body-row", "margin-top");

  const available =
    cardH - padTop - padBottom - head - ruler - (preta ? bar : 0) - bodyMt;

  // alturas de texto
  const labelH = lineMm(mm(r, ".flabel", "font-size"), mm(r, ".flabel", "line-height"));
  const valLh = mm(r, ".fvalue", "line-height");
  const valH = lineMm(mm(r, ".fvalue", "font-size"), valLh);
  const regH = lineMm(mm(r, ".reg-num", "font-size"), valLh);
  const cbktH = lineMm(mm(r, ".cbkt-num", "font-size"), valLh);

  // ⚠️ altura RESERVADA do nome — constante, não depende do conteúdo.
  const nameH = mm(r, ".fvalue.name", "height");

  const gap = mm(r, preta ? ".is-preta .fields" : ".fields", "gap");
  const rowGap = first(r, preta ? ".is-preta .grid2" : ".grid2", "gap");
  const valMt = mm(r, preta ? ".is-preta .fvalue" : ".fvalue", "margin-top");
  const dojoH = mm(r, preta ? ".is-preta .fvalue.dojo" : ".fvalue.dojo", "height");
  const nameMb = mm(r, preta ? ".is-preta .name-fld" : ".name-fld", "margin-bottom");

  const nameFld = labelH + valMt + nameH + nameMb;
  // .grid2 é 2 colunas: cada linha vale a célula MAIS ALTA.
  const row1 = Math.max(labelH + valMt + valH, labelH + valMt + dojoH); // nascimento | dojô
  const row2 = Math.max(labelH + valMt + valH, labelH + valMt + regH);  // CPF | nº registro FPKT
  let used = nameFld + gap + (row1 + rowGap + row2);

  let beltRow = 0;
  if (preta) {
    const beltMt = mm(r, ".is-preta .belt-line", "margin-top");
    const beltSq = mm(r, ".belt-sq", "height");
    const faixa = labelH + beltMt + Math.max(beltSq, valH);
    const cbkt = labelH + valMt + cbktH;
    beltRow = Math.max(faixa, cbkt);
    used += gap + mm(r, ".is-preta .reg-fld", "margin-top") + beltRow;
  }

  return { available, used, slack: available - used, nameH, beltRow, rules: r };
}

// ============================================================
// 1) A função pura que escolhe o tamanho da fonte do Nome
// ============================================================
describe("pickNameFontPt — degrau 2 da regra (fonte adaptativa)", () => {
  it("nome curto fica no maior degrau (9pt) e cabe em 1 linha", () => {
    expect(pickNameFontPt("Ana Lima")).toBe(9);
    expect(estimateNameLines("Ana Lima", 9)).toBe(1);
  });

  it("MARJORIE BARRAGAN REBELLO DA SILVA — o cartão real — cabe em 2 linhas a 9pt", () => {
    // 34 caracteres, ~57mm a 9pt: passa dos 47.2mm da coluna, então quebra.
    // Quebrar é OK; o que não pode é empurrar o resto do cartão. Por isso ela
    // permanece no maior degrau e quem resolve é a ALTURA RESERVADA (degrau 1).
    expect(estimateTextWidthEm(MARJORIE) * 9 * PT_TO_MM).toBeGreaterThan(NAME_FIELD_WIDTH_MM);
    expect(estimateNameLines(MARJORIE, 9)).toBe(2);
    expect(pickNameFontPt(MARJORIE)).toBe(9);
  });

  it("nome que não cabe a 9pt desce um degrau em vez de truncar", () => {
    const n = "MARIA DAS GRACAS ALBUQUERQUE CAVALCANTI DE MELO";
    expect(estimateNameLines(n, 9)).toBeGreaterThan(NAME_MAX_LINES);
    expect(pickNameFontPt(n)).toBe(8.2);
    expect(estimateNameLines(n, 8.2)).toBeLessThanOrEqual(NAME_MAX_LINES);
  });

  it("desce mais um degrau quando 8.2pt ainda não basta", () => {
    const n = "ANA BEATRIZ NASCIMENTO ALBUQUERQUE CAVALCANTI DE MELO";
    expect(estimateNameLines(n, 8.2)).toBeGreaterThan(NAME_MAX_LINES);
    expect(pickNameFontPt(n)).toBe(7.5);
  });

  it("nome absurdamente longo para no MENOR degrau — aí o clamp corta com reticências", () => {
    const n =
      "MARIA DAS GRACAS DO NASCIMENTO ALBUQUERQUE CAVALCANTI DE MELO SOBRINHA JUNIOR NETO FILHO";
    expect(pickNameFontPt(n)).toBe(7);
    // Degrau 3: nem a 7pt cabe em 2 linhas — quem produz as reticências é o
    // -webkit-line-clamp (o text-overflow:ellipsis de .fvalue é inerte aqui).
    expect(estimateNameLines(n, 7)).toBeGreaterThan(NAME_MAX_LINES);
  });

  it("palavra única maior que a coluna inteira não trava a conta", () => {
    const n = "W".repeat(90);
    expect(estimateNameLines(n, 9)).toBeGreaterThan(NAME_MAX_LINES);
    expect(pickNameFontPt(n)).toBe(7);
  });

  it("nome vazio/nulo não quebra e devolve o maior degrau", () => {
    expect(pickNameFontPt("")).toBe(NAME_FONT_STEPS_PT[0]);
    expect(pickNameFontPt(null)).toBe(NAME_FONT_STEPS_PT[0]);
    expect(pickNameFontPt(undefined)).toBe(NAME_FONT_STEPS_PT[0]);
  });

  it("o resultado é sempre um dos degraus declarados", () => {
    const nomes = [
      "Ana",
      MARJORIE,
      "JOSE",
      "MARIA DAS GRACAS ALBUQUERQUE CAVALCANTI DE MELO",
      "ANA BEATRIZ NASCIMENTO ALBUQUERQUE CAVALCANTI DE MELO",
      "A".repeat(200),
    ];
    for (const n of nomes) expect(NAME_FONT_STEPS_PT).toContain(pickNameFontPt(n));
  });

  it("a altura reservada comporta 2 linhas no MAIOR degrau", () => {
    const html = buildSingleCardHtml(card(), "front");
    const lh = mm(screenRules(html), ".fvalue.name", "line-height");
    const precisa = NAME_MAX_LINES * NAME_FONT_STEPS_PT[0] * PT_TO_MM * lh;
    expect(NAME_RESERVED_H_MM).toBeGreaterThanOrEqual(precisa);
    // e não pode ser folgada a ponto de desperdiçar meio milímetro de cartão
    expect(NAME_RESERVED_H_MM - precisa).toBeLessThan(0.2);
  });
});

// ============================================================
// 2) O orçamento vertical — o que realmente garante o encaixe
// ============================================================
describe("orçamento vertical do cartão CR80 (alturas somadas do CSS emitido)", () => {
  it("faixa-preta: com o nome ocupando as 2 linhas reservadas, TUDO cabe", () => {
    const b = verticalBudget(true);
    // Design 02 tem menos espaço (barra preta) e um bloco a mais (Faixa/CBKT).
    expect(b.available).toBeCloseTo(29.65, 2);
    expect(b.used).toBeLessThanOrEqual(b.available);
    // folga real, para o próximo que mexer saber quanto tem para gastar
    expect(b.slack).toBeGreaterThan(0.5);
    expect(b.slack).toBeCloseTo(0.704, 2);
  });

  it("faixa-preta: o bloco Faixa/Nº CBKT — o que sumia no cartão impresso — está dentro do total", () => {
    const b = verticalBudget(true);
    expect(b.beltRow).toBeGreaterThan(4); // ~4.7mm; não é um resíduo arredondado a zero
    // sem ele o cartão caberia de qualquer jeito — é justamente ele que
    // estourava, então tem que estar somado.
    expect(b.used - b.beltRow).toBeLessThan(b.available);
  });

  it("colorida (Design 01): mesma regra, e sobra mais folga", () => {
    const b = verticalBudget(false);
    expect(b.available).toBeCloseTo(29.6, 2);
    expect(b.used).toBeLessThanOrEqual(b.available);
    expect(b.slack).toBeCloseTo(1.526, 2);
  });

  it("a altura reservada do nome NÃO depende do conteúdo — é isso que garante o encaixe", () => {
    const curto = verticalBudget(true).nameH;
    const html = buildSingleCardHtml(
      card({ student_name: "A".repeat(300), belt_name: "Preta 3º Dan" }),
      "front"
    );
    const longo = mm(screenRules(html), ".fvalue.name", "height");
    expect(longo).toBe(curto);
    expect(longo).toBe(NAME_RESERVED_H_MM);
  });

  it("o clamp do nome bate com NAME_MAX_LINES (senão a reserva vira mentira)", () => {
    const r = screenRules(buildSingleCardHtml(card(), "front"));
    expect(mm(r, ".fvalue.name", "-webkit-line-clamp")).toBe(NAME_MAX_LINES);
    expect(decl(r, ".fvalue.name", "overflow")).toBe("hidden");
    // min-height reabriria o bug: a caixa voltaria a crescer com o conteúdo.
    expect(rulesHas(r, ".fvalue.name", "min-height")).toBe(false);
  });
});

function rulesHas(r: Record<string, string>, sel: string, prop: string): boolean {
  try {
    decl(r, sel, prop);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// 3) O HTML por cartão — só o font-size muda
// ============================================================
describe("renderFront — o tamanho do nome vai inline, o resto do cartão não muda", () => {
  it("emite o degrau escolhido como style inline no campo Nome", () => {
    const curto = buildSingleCardHtml(card({ student_name: "Ana Lima" }), "front");
    expect(curto).toContain('class="fvalue name" style="font-size:9pt"');

    const longo = buildSingleCardHtml(
      card({ student_name: "MARIA DAS GRACAS ALBUQUERQUE CAVALCANTI DE MELO" }),
      "front"
    );
    expect(longo).toContain('class="fvalue name" style="font-size:8.2pt"');
  });

  it("nome longo não altera UMA linha sequer do CSS do cartão", () => {
    const a = /<style>([\s\S]*?)<\/style>/.exec(
      buildSingleCardHtml(card({ student_name: "Ana Lima" }), "front")
    )![1];
    const b = /<style>([\s\S]*?)<\/style>/.exec(
      buildSingleCardHtml(card({ student_name: MARJORIE }), "front"), 
    )![1];
    expect(a).toBe(b);
  });

  it("os campos e a ordem da frente continuam os mesmos (Faixa e CBKT são distintos)", () => {
    const html = buildSingleCardHtml(card(), "front");
    const ordem = ["Nome", "Data de nascimento", "Dojô", "CPF", "Nº de registro FPKT", "Faixa", "Nº CBKT"];
    let pos = -1;
    for (const label of ordem) {
      const i = html.indexOf(`>${label}<`);
      expect(i).toBeGreaterThan(pos);
      pos = i;
    }
    // campos distintos: registro FPKT em vermelho, CBKT em mono
    expect(html).toContain('class="fvalue mono reg-num"');
    expect(html).toContain('class="fvalue mono cbkt-num"');
  });

  it("sem CBKT, o cartão faixa-preta mostra só a Faixa (e sobra ainda mais folga)", () => {
    const html = buildSingleCardHtml(card({ cbkt_number: null }), "front");
    expect(html).toContain(">Faixa<");
    expect(html).not.toContain(">Nº CBKT<");
  });

  it("a colorida não mostra Faixa nem CBKT", () => {
    const html = buildSingleCardHtml(card({ belt_name: "Azul" }), "front");
    expect(html).not.toContain(">Faixa<");
    expect(html).not.toContain(">Nº CBKT<");
  });
});

// ============================================================
// 4) Guarda de regressão — a aritmética de ANTES da correção
//
// Reproduz o cartão que foi impresso: .fvalue.name sem altura reservada e sem
// clamp, line-height "normal" do navegador (~1.2), .is-preta .fvalue com
// margin-top 0.7mm, .fields gap 1.1mm e .fvalue.dojo com 5.0mm.
// Serve para documentar o tamanho do estouro e para que ninguém "simplifique"
// a correção de volta ao estado anterior achando que era só 0.2mm.
// ============================================================
describe("regressão — por que o cartão impresso cortava", () => {
  const LH_NORMAL = 1.2; // o que o navegador aplicava quando não havia line-height
  const line = (pt: number) => pt * PT_TO_MM * LH_NORMAL;
  const L = line(3.9);      // .flabel
  const V = line(6.4);      // .fvalue
  const REG = line(7.6);    // .reg-num
  const CBKT = line(6.8);   // .cbkt-num
  const NAME_LINE = line(9); // .fvalue.name, 9pt fixo

  function antes(preta: boolean, linhasDoNome: number) {
    const available = 54 - 2.85 - 4.2 - 12.4 - (2.85 + 0.3) - (preta ? 0.2 + 1.05 : 0) - (preta ? 0.5 : 1.8);
    const gap = preta ? 1.1 : 2.4;
    const rowGap = preta ? 1.7 : 2.6;
    const valMt = 0.7;
    const dojoH = preta ? 5.0 : 6.2;
    const nameMb = preta ? 0 : 0.4;

    const nameFld = L + valMt + linhasDoNome * NAME_LINE + nameMb;
    const row1 = Math.max(L + valMt + V, L + valMt + dojoH);
    const row2 = Math.max(L + valMt + V, L + valMt + REG);
    let used = nameFld + gap + (row1 + rowGap + row2);
    if (preta) {
      const faixa = L + 0.5 + Math.max(1.9, V);
      const cbkt = L + valMt + CBKT;
      used += gap + 0.6 + Math.max(faixa, cbkt);
    }
    return { available, used, over: used - available };
  }

  it("faixa-preta: 1 linha passava raspando (~0.84mm de folga)", () => {
    const r = antes(true, 1);
    expect(r.over).toBeLessThan(0);
    expect(-r.over).toBeCloseTo(0.84, 1);
  });

  it("faixa-preta: 2 linhas estouravam ~2.97mm — mais que o bloco Faixa/CBKT inteiro", () => {
    const r = antes(true, 2);
    expect(r.over).toBeGreaterThan(0);
    expect(r.over).toBeCloseTo(2.97, 1);
    // o bloco que sumia mede ~4.9mm: o estouro comia o valor, sobrava o rótulo
    const blocoFaixaCbkt = Math.max(L + 0.5 + Math.max(1.9, V), L + 0.7 + CBKT);
    expect(blocoFaixaCbkt).toBeGreaterThan(4);
    expect(r.over).toBeGreaterThan(blocoFaixaCbkt - L - 1);
  });

  it("colorida: sobrevivia a 2 linhas raspando, mas cortava com 3", () => {
    expect(antes(false, 2).over).toBeLessThan(0);
    expect(-antes(false, 2).over).toBeLessThan(0.2); // ~0.11mm — margem nenhuma
    expect(antes(false, 3).over).toBeCloseTo(3.7, 1);
  });

  it("ancorar o rodapé não resolveria: o bloco do meio também não tem para onde ir", () => {
    // margin-top:auto empurraria Faixa/CBKT para o fim, mas o total continua o
    // mesmo — o estouro só migraria para o .grid2 (nascimento/dojô, CPF/registro).
    const r = antes(true, 2);
    const gridDoMeio = Math.max(L + 0.7 + V, L + 0.7 + 5.0) + 1.7 + Math.max(L + 0.7 + V, L + 0.7 + REG);
    expect(r.over).toBeGreaterThan(0);
    expect(r.over).toBeLessThan(gridDoMeio); // caberia "dentro" do grid = ele é quem seria cortado
  });
});
