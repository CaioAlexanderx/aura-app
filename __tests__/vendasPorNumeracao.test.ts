// 03/11/2026 — Vendas por produto e numeração (utils/vendasPorNumeracao.ts).
// Números do mockup docs/mockups/relatorio-vendas-por-numeracao.html.
import {
  periodoDoLink, classeDeCalor, reporDaNumeracao, giroPct, textoDura, duraPouco, textoEstoque,
  textoVariacao, dataDoCampo, mascaraData, totaisDaGrade, linhasDaPlanilha, nomeDaPlanilha,
  montarPedidos, linkDoWhatsapp, SEM_NUMERACAO,
} from "@/utils/vendasPorNumeracao";
import { queryDoRelatorio, type ModeloVendido } from "@/services/relatoriosApi";

const RUNNER: ModeloVendido = {
  product_id: "p1", nome: "Tênis Runner Branco", sku: "TR-100", tipo: "Tênis", cor: null,
  vendidos: 48, receita: 9595, estoque: 11, giro_pct: 81, dura_dias: 7, repor: 37,
  fornecedor: { id: "f1", nome: "Distribuidora Alfa", telefone: "(11) 99876-5432" },
  numeracoes: [
    { numeracao: "34", vendidos: 3, estoque: 2 }, { numeracao: "35", vendidos: 5, estoque: 1 },
    { numeracao: "36", vendidos: 9, estoque: 2 }, { numeracao: "37", vendidos: 12, estoque: 3 },
    { numeracao: "38", vendidos: 10, estoque: 1 }, { numeracao: "39", vendidos: 6, estoque: 0 },
    { numeracao: "40", vendidos: 3, estoque: 2 },
  ],
};
const SANDALIA: ModeloVendido = {
  product_id: "p2", nome: "Sandália Flat Nude", sku: null, tipo: "Sandália", cor: null,
  vendidos: 35, receita: 3465, estoque: 40, giro_pct: 47, dura_dias: 35, repor: 0,
  fornecedor: null, numeracoes: [{ numeracao: "35", vendidos: 20, estoque: 30 }, { numeracao: "36", vendidos: 15, estoque: 10 }],
};

test("período do link: o e-mail manda week; inválido vira este mês", () => {
  expect(periodoDoLink("week")).toBe("week");
  expect(periodoDoLink(["d90"])).toBe("d90");
  expect(periodoDoLink("custom")).toBe("month");
  expect(periodoDoLink(undefined)).toBe("month");
});

test("query: datas só no custom; filtros opcionais", () => {
  expect(queryDoRelatorio({ period: "month", start_date: "2026-10-01", q: " runner ", por_cor: true, category: "Tênis" }))
    .toBe("period=month&category=T%C3%AAnis&q=runner&por_cor=1");
  expect(queryDoRelatorio({ period: "custom", start_date: "2026-10-01", end_date: "2026-10-31" }))
    .toBe("period=custom&start_date=2026-10-01&end_date=2026-10-31");
});

test("calor da grade em 5 níveis pela fração do máximo", () => {
  expect([0, 1, 3, 6, 9, 12].map((v) => classeDeCalor(v, 12))).toEqual([0, 1, 2, 3, 4, 4]);
  expect(classeDeCalor(5, 0)).toBe(0);
});

test("contas de balcão do mockup", () => {
  expect(RUNNER.numeracoes.reduce((s, n) => s + reporDaNumeracao(n.vendidos, n.estoque), 0)).toBe(37);
  expect(giroPct(48, 11)).toBe(81);
  expect(giroPct(0, 0)).toBeNull();
  expect([textoDura(7), textoDura(0), textoDura(null), textoDura(1)]).toEqual(["~7 dias", "acabou", "—", "~1 dia"]);
  expect([duraPouco(7), duraPouco(35), duraPouco(null)]).toEqual([true, false, false]);
  expect([textoEstoque(3), textoEstoque(0)]).toEqual(["tem 3", "acabou"]);
  expect([textoVariacao(18), textoVariacao(-5), textoVariacao(0), textoVariacao(null)])
    .toEqual(["+18% que o período anterior", "-5% que o período anterior", "igual ao período anterior", null]);
});

test("datas dd/mm/aaaa", () => {
  expect(dataDoCampo("01/10/2026")).toBe("2026-10-01");
  expect(dataDoCampo("31/02/2026")).toBeNull();
  expect(dataDoCampo("2026-10-01")).toBeNull();
  expect(mascaraData("01102026")).toBe("01/10/2026");
  expect(mascaraData("0110")).toBe("01/10");
});

test("grade: total por numeração e % (tela 2)", () => {
  const t = totaisDaGrade([RUNNER, SANDALIA], ["34", "35", "36", "37"]);
  expect(t.porColuna).toEqual([3, 25, 24, 12]);
  expect(t.total).toBe(64);
  expect(t.pct).toEqual([5, 39, 38, 19]);
  expect(t.maximoCelula).toBe(20);
});

test("planilha: uma linha por modelo × numeração, números como número", () => {
  const linhas = linhasDaPlanilha({ modelos: [RUNNER, { ...SANDALIA, numeracoes: [] }] });
  expect(linhas).toHaveLength(8);
  expect(linhas[3]).toEqual({
    "Modelo": "Tênis Runner Branco", "Tipo": "Tênis", "Cor": "", "Numeração": "37", "Vendidos": 12,
    "Receita": null, "Estoque hoje": 3, "Giro %": 80, "Comprar p/ repor": 9,
  });
  expect(linhas[7]).toMatchObject({ "Numeração": SEM_NUMERACAO, "Vendidos": 35, "Receita": 3465, "Estoque hoje": 40 });
  expect(nomeDaPlanilha({ inicio: "2026-10-01", fim: "2026-10-31" })).toBe("vendas-por-numeracao-2026-10-01-a-2026-10-31.xlsx");
});

test("montar pedido: por fornecedor, só o que falta, WhatsApp com DDI", () => {
  const pedidos = montarPedidos([RUNNER, SANDALIA, { ...SANDALIA, product_id: "p3", nome: "Bota Preta", numeracoes: [{ numeracao: "37", vendidos: 4, estoque: 1 }] }], "pares");
  expect(pedidos.map((p) => p.fornecedor)).toEqual(["Distribuidora Alfa", "Sem fornecedor"]);
  expect(pedidos[0].texto).toBe(
    "Pedido — Distribuidora Alfa\n• Tênis Runner Branco: 34 ×1, 35 ×4, 36 ×7, 37 ×9, 38 ×9, 39 ×6, 40 ×1\nTotal: 37 pares",
  );
  expect(pedidos[0].whatsapp).toMatch(/^https:\/\/wa\.me\/5511998765432\?text=Pedido/);
  expect(pedidos[1]).toMatchObject({ total: 8, whatsapp: null });
  expect(pedidos[1].texto).toContain("• Sandália Flat Nude: 36 ×5");
  expect(pedidos[1].texto).toContain("• Bota Preta: 37 ×3");
});

test("WhatsApp: sem número ou curto demais não gera link", () => {
  expect(linkDoWhatsapp(null, "x")).toBeNull();
  expect(linkDoWhatsapp("12345", "x")).toBeNull();
  expect(linkDoWhatsapp("+55 11 99876-5432", "a b")).toBe("https://wa.me/5511998765432?text=a%20b");
});
