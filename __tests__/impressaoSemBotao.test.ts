// ============================================================
// O botão "Imprimir / Salvar PDF" não pode sair no papel.
//
// 07/10/2026 — saiu no orçamento impresso pelo Caixa (Matcon): a regra
// `@media print { .no-print { display: none } }` vinha antes de
// `.actions { display: flex }`, mesma especificidade, e a última vencia.
// Reproduzido no Chrome headless em todos os cenários (com/sem preço no
// cartão, com/sem logo). Ver utils/printBar.ts.
//
// Com AURA_HTML_OUT=<pasta>, os HTMLs gerados aqui são gravados nessa
// pasta — é o que scripts/conferir-impressao-pdf.js usa para imprimir de
// verdade no Chrome headless (fora do CI).
// ============================================================
import * as fs from "fs";
import * as path from "path";
import { buildQuoteHtml, type QuoteData } from "@/utils/quotePdf";
import { buildCashClosePdfHtml, type CashCloseData } from "@/utils/cashClosePdf";

const ITEM_ESTRANHO = 'Vergalhão 3/8 "CA-50" } <b>&</b> d\'água';
const MARCAS = ["Casa & Construção", "José", "Rua A", "Entrega", "Vergalhão", "Cimento", "Porcelanato"];

const itens = [
  { name: "Cimento CP-II 50kg", qty: 10, unit: "sc", unitPrice: 38.9, cardUnitPrice: 40.9 },
  { name: "Porcelanato 60x60", qty: 12.5, unit: "m²", unitPrice: 59.9, cardUnitPrice: 62.9 },
  { name: ITEM_ESTRANHO, qty: 7.35, unit: "kg", unitPrice: 9.5, cardUnitPrice: 9.99 },
  { name: "Tijolo 8 furos", qty: 1.5, unit: "mlh", unitPrice: 890, cardUnitPrice: 930 },
];
const base: QuoteData = {
  items: itens.map(i => ({ name: i.name, qty: i.qty, unit: i.unit, unitPrice: i.unitPrice })),
  companyName: 'Casa & Construção "Silva" }',
  companyPhone: "(11) 99999-0000",
  companyAddress: "Rua A, 1 <fundos> }",
  customerName: "José O'Neil",
  sellerName: "Ana",
  notes: "Entrega } em 3 dias </style>",
  total: 1000,
};
const cenarios: Record<string, QuoteData> = {
  orcamento_simples_sem_logo: base,
  orcamento_simples_com_logo: { ...base, companyLogoUrl: "https://example.com/logo.png" },
  orcamento_cartao_sem_logo: { ...base, items: itens, discount: 50, totalAfterDiscount: 950, card: { total: 1100, totalAfterDiscount: 1050, discount: 50 } },
  orcamento_cartao_com_logo: { ...base, items: itens, companyLogoUrl: "https://example.com/logo.png", card: { total: 1100 } },
};

const caixa = {
  companyName: "Casa & Construção }", operatorName: "José", openedAtIso: "2026-10-07T08:00:00Z",
  closedAtIso: "2026-10-07T18:00:00Z", salesCount: 3, newCustomersCount: 0, grossRevenue: 100,
  paymentMix: [{ method: "Dinheiro", amount: 100 }], trocoInicial: 50, vendasEmDinheiro: 100,
  dinheiroEsperado: 150, dinheiroContado: 150, diferenca: 0, observacao: "Entrega } ok",
} as unknown as CashCloseData;

/** Com AURA_HTML_OUT, grava o HTML (antes de conferir, pra o script
 *  imprimir mesmo quando o teste falha). */
function grava(nome: string, html: string) {
  const out = process.env.AURA_HTML_OUT;
  if (out) fs.writeFileSync(path.join(out, nome + ".html"), html);
}

/** Conteúdo do único <style> do documento. */
function estilo(html: string): string {
  expect(html.split("<style>").length - 1).toBe(1);
  expect(html.split("</style>").length - 1).toBe(1);
  return html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
}

/** A CSS sem os blocos `@media screen { ... }` (casando as chaves). */
function semMediaScreen(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const ini = css.indexOf("@media screen", i);
    if (ini < 0) { out += css.slice(i); break; }
    out += css.slice(i, ini);
    let j = css.indexOf("{", ini);
    let prof = 0;
    for (; j < css.length; j++) {
      if (css[j] === "{") prof++;
      else if (css[j] === "}" && --prof === 0) break;
    }
    i = j + 1;
  }
  return out;
}

function confere(html: string, seletorBarra: string) {
  const css = estilo(html);
  // (i) nada que o usuário digitou entra na CSS
  for (const m of MARCAS) expect(css).not.toContain(m);
  // as chaves da CSS fecham (nenhum conteúdo quebrou o bloco)
  expect(css.split("{").length).toBe(css.split("}").length);
  // (ii) @media print esconde .no-print com !important
  expect(css.replace(/\s+/g, "")).toMatch(/@mediaprint\{\.no-print\{display:none!important/);
  // a aparência da barra (onde entra display) só existe na tela
  expect(semMediaScreen(css)).not.toMatch(new RegExp("\\" + seletorBarra + "\s*[{,]"));
  // (iii) o botão está dentro de .no-print, fora do fluxo de impressão
  expect(html).toMatch(/<div class="[^"]*\bno-print\b[^"]*">\s*<button type="button" onclick="auraImprimir\(this\)">Imprimir \/ Salvar PDF<\/button>\s*<\/div>/);
  expect(html).toContain("function auraImprimir(btn)");
}

describe("orçamento impresso: botão fora do papel", () => {
  for (const [nome, dados] of Object.entries(cenarios)) {
    test(nome, () => {
      const html = buildQuoteHtml(dados);
      grava(nome, html);
      confere(html, ".actions");
      // o nome com aspas, } e < entra escapado no corpo
      expect(html).toContain("Vergalhão 3/8 &quot;CA-50&quot; } &lt;b&gt;&amp;&lt;/b&gt; d&#39;água");
      expect(html).toContain("Entrega } em 3 dias &lt;/style&gt;");
    });
  }
});

describe("fechamento de caixa: botão fora do papel", () => {
  test("barra só na tela e escondida na impressão", () => {
    const html = buildCashClosePdfHtml(caixa);
    grava("fechamento_caixa", html);
    confere(html, ".actions");
  });
});

describe("orçamento: valores com duas casas", () => {
  test("7,35 × 9,50 imprime R$ 69,83, não R$ 69,825", () => {
    const html = buildQuoteHtml({ ...base, items: [{ name: "Vergalhão", qty: 7.35, unit: "kg", unitPrice: 9.5 }] });
    expect(html).toContain("R$ 69,83");
    expect(html).not.toContain("69,825");
  });
});
