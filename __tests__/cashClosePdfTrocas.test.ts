// ============================================================
// AURA. — Fechamento de caixa com as trocas da sessão (16/11/2026)
// Mockup aprovado: docs/mockups/fechamento-trocas.html.
//
//   1. REGRA DE OURO: sessão sem troca sai byte a byte igual ao HTML de
//      antes (fixtures gravados com o cashClosePdf.ts de origin/main, ANTES
//      da mudança — nunca regravar). Vale também com `trocas: []`.
//   2. Com troca: a conta Vendas → Entradas abaixo dos KPIs, o rodapé novo
//      e a seção "Trocas e devoluções da sessão (N)", nomes escapados.
//   3. A conta SEMPRE fecha em Entradas: o resto vira "± Crediário e
//      outros ajustes".
// ============================================================
import fs from "fs";
import path from "path";
import { buildCashClosePdfHtml, type CashCloseData } from "@/utils/cashClosePdf";
import { contaDoFechamento, type TrocaDoFechamento } from "@/utils/trocasDoFechamento";
import { ENTRADAS_SEM_TROCA } from "./__fixtures__/cashClose/entradasSemTroca";

const FIX_DIR = path.join(__dirname, "__fixtures__", "cashClose");

function fixture(nome: string): string {
  return fs.readFileSync(path.join(FIX_DIR, nome + ".html"), "utf8");
}

describe("regra de ouro: sem troca, byte a byte igual", () => {
  ENTRADAS_SEM_TROCA.forEach(({ nome, data }) => {
    test(nome, () => {
      expect(buildCashClosePdfHtml(data)).toBe(fixture(nome));
    });
    test(nome + " com trocas: [] (backend novo, sessão sem troca)", () => {
      const comVazio: CashCloseData = {
        ...data,
        trocas: [],
        trocasResumo: { quantidade: 0, pecas_devolvidas: 0, pecas_levadas: 0, diferenca_recebida: 0, devolvido_cliente: 0 },
      };
      expect(buildCashClosePdfHtml(comVazio)).toBe(fixture(nome));
    });
  });
});

const VAZIO = { total: 0, metodos: [] };

// Caso de 14/11 (valores reais, nomes fictícios): devolveu 139,90; levou
// 79,90 + 119,90; pagou 59,90 de diferença no débito.
const TROCA_REAL: TrocaDoFechamento = {
  id: "t1",
  created_at: "2026-11-14T15:33:00.000Z",
  tipo: "troca",
  devolvidos: [{ product_name_snapshot: "Conjunto de linho <Azul · M>", quantity: 1, unit_price: 139.9 }],
  levados: [
    { product_name: "Blusa com strass & brilho", quantity: 1, unit_price: 79.9, total_price: 79.9 },
    { product_name: "Blusa casual (Branca · P)", quantity: 1, unit_price: 119.9, total_price: 119.9 },
  ],
  recebido: { total: 59.9, metodos: [{ method: "debito", amount: 59.9 }] },
  devolvido_cliente: VAZIO,
  credito_carteira: 0,
};

const BASE = ENTRADAS_SEM_TROCA[0].data;

function comTrocas(over: Partial<CashCloseData>): CashCloseData {
  return { ...BASE, ...over };
}

describe("com troca", () => {
  const html = buildCashClosePdfHtml(comTrocas({
    salesCount: 43, grossRevenue: 10525.08, entradasTotal: 10584.98,
    trocas: [TROCA_REAL],
    trocasResumo: { quantidade: 1, pecas_devolvidas: 139.9, pecas_levadas: 199.8, diferenca_recebida: 59.9, devolvido_cliente: 0 },
  }));

  test("a conta liga Vendas do período a Entradas no caixa", () => {
    expect(html).toContain(
      '<div class="conta">' +
      '<div class="row"><span class="lab">Vendas do período</span><span class="val">R$ 10.525,08</span></div>' +
      '<div class="row"><span class="lab">+ Diferença paga em trocas <span class="obs">· 1 troca</span></span><span class="val">R$ 59,90</span></div>' +
      '<div class="row tot"><span class="lab">= Entradas no caixa</span><span class="val">R$ 10.584,98</span></div>' +
      "</div>"
    );
    // sem devolução ao cliente, a linha não aparece; nem o ajuste (fecha exato)
    expect(html).not.toContain("− Devolvido ao cliente");
    expect(html).not.toContain("Crediário e outros ajustes");
    // a conta vem logo abaixo dos KPIs, antes da Conferência
    expect(html.indexOf('<div class="conta">')).toBeGreaterThan(html.indexOf("Ticket medio"));
    expect(html.indexOf('<div class="conta">')).toBeLessThan(html.indexOf("Conferencia de caixa"));
  });

  test("o rodapé dos KPIs troca para o texto do mockup", () => {
    expect(html).toContain("A troca não entra em Vendas: a peça devolvida já tinha sido vendida antes. Crediário e venda com data anterior paga nesta sessão também fazem os dois números diferirem — isso não e falta no caixa.");
    expect(html).not.toContain("Trocas, crediário e venda com data anterior paga nesta sessão fazem os dois números diferirem");
  });

  test("a seção das trocas vem depois das formas de pagamento, com os 4 totais", () => {
    const sec = html.indexOf("Trocas e devoluções da sessão (1)");
    expect(sec).toBeGreaterThan(html.indexOf("Total de entradas"));
    expect(sec).toBeLessThan(html.indexOf('<div class="foot">'));
    expect(html).toContain('<div class="troca-h"><span class="k">Troca</span><span class="t">12:33</span></div>');
    expect(html).toContain("<h4>Devolveu</h4>");
    expect(html).toContain('<div class="it sub"><span>Total</span><span>R$ 199,80</span></div>');
    expect(html).toContain('<div class="dif in"><span>Cliente pagou a diferença no débito</span><b>+ R$ 59,90</b></div>');
    expect(html).toContain("<div>Peças devolvidas<b>R$ 139,90</b></div>");
    expect(html).toContain("<div>Peças levadas<b>R$ 199,80</b></div>");
    expect(html).toContain("<div>Diferença recebida<b>R$ 59,90</b></div>");
    expect(html).toContain("<div>Devolvido ao cliente<b>R$ 0,00</b></div>");
  });

  test("nome de produto escapado", () => {
    expect(html).toContain("<span>Conjunto de linho &lt;Azul · M&gt;</span>");
    expect(html).toContain("<span>Blusa com strass &amp; brilho</span>");
    expect(html).not.toContain("<Azul");
  });

  test("cabe na térmica: colunas empilham e os totais vão para 2 colunas em tela estreita", () => {
    expect(html).toContain("@media (max-width: 620px) { .cols { grid-template-columns: minmax(0, 1fr); } .tot-trocas { grid-template-columns: repeat(2, minmax(0, 1fr)); } }");
  });
});

describe("os outros tipos de troca", () => {
  const trocas: TrocaDoFechamento[] = [
    { id: "a", created_at: "2026-11-15T14:06:00.000Z", tipo: "troca",
      devolvidos: [{ product_name_snapshot: "Blusa casual (Branca · P)", quantity: 1, unit_price: 119.9 }],
      levados: [{ product_name: "Blusa decote quadrado", quantity: 2, unit_price: 59.9, total_price: 119.8 }],
      recebido: VAZIO, devolvido_cliente: { total: 0.1, metodos: [{ method: "dinheiro", amount: 0.1 }] }, credito_carteira: 0 },
    { id: "b", created_at: "2026-11-15T14:42:00.000Z", tipo: "troca",
      devolvidos: [{ product_name_snapshot: "Cropped regata (Azul)", quantity: 1, unit_price: 49.9 }],
      levados: [{ product_name: "Cropped regata", quantity: 1, unit_price: 49.9, total_price: 49.9 }],
      recebido: VAZIO, devolvido_cliente: VAZIO, credito_carteira: 0 },
    { id: "c", created_at: "2026-11-15T18:20:00.000Z", tipo: "troca",
      devolvidos: [{ product_name_snapshot: "Vestido longo estampado", quantity: 1, unit_price: 129.9 }],
      levados: [{ product_name: "Blusa casual", quantity: 1, unit_price: 119.9, total_price: 119.9 }],
      recebido: VAZIO, devolvido_cliente: VAZIO, credito_carteira: 10 },
    { id: "d", created_at: "2026-11-15T20:05:00.000Z", tipo: "devolucao",
      devolvidos: [{ product_name_snapshot: "Short jeans (42)", quantity: 1, unit_price: 119.9 }],
      levados: [],
      recebido: VAZIO, devolvido_cliente: { total: 10, metodos: [{ method: "pix", amount: 10 }] }, credito_carteira: 0 },
  ];
  // KPIs do mockup: 4.890,50 − 10,10 = 4.880,40 (sem resumo do backend:
  // os totais saem da soma das trocas).
  const html = buildCashClosePdfHtml(comTrocas({ grossRevenue: 4890.5, entradasTotal: 4880.4, trocas }));

  test("devolvido ao cliente entra na conta com sinal de menos", () => {
    expect(html).toContain('<div class="row"><span class="lab">+ Diferença paga em trocas <span class="obs">· nenhuma</span></span><span class="val">R$ 0,00</span></div>');
    expect(html).toContain('<div class="row"><span class="lab">− Devolvido ao cliente <span class="obs">· 2 trocas</span></span><span class="val">− R$ 10,10</span></div>');
    expect(html).not.toContain("Crediário e outros ajustes");
  });

  test("a linha da diferença de cada tipo", () => {
    expect(html).toContain('<div class="dif out"><span>Devolvido ao cliente em dinheiro</span><b>− R$ 0,10</b></div>');
    expect(html).toContain('<div class="dif zero"><span>Sem diferença</span><b>R$ 0,00</b></div>');
    expect(html).toContain('<div class="dif zero"><span>R$ 10,00 em crédito na carteira do cliente (não saiu da gaveta)</span><b></b></div>');
    expect(html).toContain('<div class="dif out"><span>Devolvido ao cliente no Pix</span><b>− R$ 10,00</b></div>');
  });

  test("devolução sem peça: Levou = Nada; quantidade aparece no nome", () => {
    expect(html).toContain('<span class="k">Devolução</span>');
    expect(html).toContain('<div class="it nada"><span>Nada</span><span></span></div>');
    expect(html).toContain("<span>2× Blusa decote quadrado</span><span>R$ 119,80</span>");
    expect(html).toContain("Trocas e devoluções da sessão (4)");
    expect(html).toContain("<div>Peças devolvidas<b>R$ 419,60</b></div>");
    expect(html).toContain("<div>Devolvido ao cliente<b>R$ 10,10</b></div>");
  });
});

describe("a conta sempre fecha em Entradas", () => {
  test("resíduo positivo vira a linha de crediário e outros ajustes", () => {
    const html = buildCashClosePdfHtml(comTrocas({ grossRevenue: 1000, entradasTotal: 1100, trocas: [TROCA_REAL] }));
    expect(html).toContain('<div class="row"><span class="lab">± Crediário e outros ajustes</span><span class="val">+ R$ 40,10</span></div>');
  });

  test("resíduo negativo também", () => {
    const html = buildCashClosePdfHtml(comTrocas({ grossRevenue: 1000, entradasTotal: 900, trocas: [TROCA_REAL] }));
    expect(html).toContain('<div class="row"><span class="lab">± Crediário e outros ajustes</span><span class="val">− R$ 159,90</span></div>');
  });

  test("resíduo abaixo de R$ 0,01 não vira linha", () => {
    const { linhas } = contaDoFechamento({ vendas: 100, entradas: 159.904, trocas: [TROCA_REAL] });
    expect(linhas.map((l) => l.chave)).toEqual(["vendas", "diferenca"]);
  });

  test.each([
    [10525.08, 10584.98],
    [1000, 1100],
    [1000, 900],
    [0, 59.9],
    [333.33, 0.01],
    [4890.5, 4880.4],
  ])("vendas %p, entradas %p: as linhas somam Entradas", (vendas, entradas) => {
    const devolveu: TrocaDoFechamento = { ...TROCA_REAL, id: "t2", devolvido_cliente: { total: 12.34, metodos: [{ method: "dinheiro", amount: 12.34 }] } };
    const { linhas, entradas: total } = contaDoFechamento({ vendas, entradas, trocas: [TROCA_REAL, devolveu] });
    const soma = Math.round(linhas.reduce((a, l) => a + l.valor, 0) * 100) / 100;
    expect(soma).toBe(entradas);
    expect(total).toBe(entradas);
  });
});
