// Aba Receitas — Faturamento, Custos, Lucro bruto e Despesas (p-82, 08/11/2026)
//
// Monta o ResultadoCards nos quatro cenários do mockup v3 (custo parcial,
// completo, nenhum custo, duas lojas) e o TabReceitas com e sem o resultado:
// sem resultado (backend antigo, 403 de quem não vê custo) a aba fica como era.

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: function (selector: any) {
    var state = { company: { id: "empresa-1" }, consolidatedView: false, token: "t", isDemo: true };
    return typeof selector === "function" ? selector(state) : state;
  },
}));
jest.mock("@/services/api", () => ({ request: jest.fn(async () => ({})) }));

import { ResultadoCards } from "@/components/screens/financeiro/v2/ResultadoCards";
import { TabReceitas } from "@/components/screens/financeiro/v2/TabReceitas";
import { variacao, textoDaCobertura, type ResultadoDoPeriodo } from "@/utils/resultadoDoPeriodo";

function base(over: Partial<ResultadoDoPeriodo> = {}): ResultadoDoPeriodo {
  return {
    periodo: { de: "2026-11-01", ate: "2026-11-30" },
    consolidado: false, empresas: 1,
    faturamento: 18420, vendas: 18300, vendas_qtd: 210,
    trocas: { entrou: 300, devolvido: 180 },
    custos: 6820, lucro_bruto: 6080, margem_pct: 47.1, receita_com_custo: 12900,
    cobertura: { pct: 70, receita_sem_custo: 5400, itens: 300, itens_com_custo: 210, produtos_sem_custo: 38 },
    despesas: 4310,
    compras_pagas: { total: 7800, lancamentos: 4 },
    produtos_sem_custo: [
      { product_id: "p1", nome: "Blusa listrada", receita: 1200, quantidade: 12 },
      { product_id: "p2", nome: "Meia", receita: 300, quantidade: 30 },
    ],
    anterior: {
      periodo: { de: "2026-10-01", ate: "2026-10-31" },
      faturamento: 16900, custos: 6420, lucro_bruto: 5600, margem_pct: 46, receita_com_custo: 12000,
      despesas: 4050, compras_pagas: { total: 5000, lancamentos: 3 },
    },
    ...over,
  };
}

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

async function montar(el: React.ReactElement) {
  var qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  var tree: any;
  await act(async function () {
    tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
  });
  return tree;
}
function porId(tree: any, id: string) {
  return tree.root.findAll(function (n: any) { return n.props && n.props.testID === id; }, { deep: false });
}
function soTexto(c: any): string {
  if (c == null || c === false) return "";
  if (typeof c === "string" || typeof c === "number") return String(c);
  if (Array.isArray(c)) return c.map(soTexto).join("");
  return "";
}
function texto(tree: any, id?: string) {
  if (!id) return flattenText(tree.toJSON());
  var achados = porId(tree, id);
  if (!achados.length) return "";
  return achados[0].findAll(function (n: any) { return typeof n.type === "string"; }).map(function (n: any) { return soTexto(n.props.children); }).join(" | ");
}

describe("regras puras", () => {
  it("custo e despesa que sobem são ruins; faturamento que sobe é bom", () => {
    expect(variacao(18420, 16900, false, "month")).toEqual({ texto: "▲ 9% sobre o mês passado", tom: "bom" });
    expect(variacao(4310, 4050, true, "month")).toEqual({ texto: "▲ 6% sobre o mês passado", tom: "ruim" });
    expect(variacao(3000, 4000, true, "week")).toEqual({ texto: "▼ 25% sobre a semana anterior", tom: "bom" });
    expect(variacao(100, 0, false, "month")).toBeNull();
    expect(variacao(100, null, false, "month")).toBeNull();
    expect(variacao(100, 100, false, "month")?.tom).toBe("neutro");
  });

  it("cobertura: parcial, completa, nenhuma, sem venda e duas lojas", () => {
    expect(textoDaCobertura(base(), "month")).toMatchObject({ tipo: "parcial", titulo: "30% do faturamento ficou fora do lucro bruto", detalhe: "porque 38 produtos vendidos não têm custo." });
    expect(textoDaCobertura(base({ cobertura: { pct: 100, receita_sem_custo: 0, itens: 3, itens_com_custo: 3, produtos_sem_custo: 0 } }), "month").tipo).toBe("completo");
    expect(textoDaCobertura(base({ lucro_bruto: null, margem_pct: null, cobertura: { pct: 0, receita_sem_custo: 18300, itens: 3, itens_com_custo: 0, produtos_sem_custo: 3 } }), "month").titulo)
      .toBe("Nenhum produto vendido neste mês tem custo cadastrado.");
    expect(textoDaCobertura(base({ vendas: 0, cobertura: { pct: null, receita_sem_custo: 0, itens: 0, itens_com_custo: 0, produtos_sem_custo: 0 } }), "month").tipo).toBe("sem_venda");
    var multi = base({ consolidado: true, empresas: 2, cobertura: { pct: 79, receita_sem_custo: 100, itens: 9, itens_com_custo: 7, produtos_sem_custo: 61, lojas_com_pouco_custo: 1, lojas_com_venda: 2 } });
    expect(textoDaCobertura(multi, "month").detalhe).toBe("porque 61 produtos vendidos não têm custo. Em 1 de 2 lojas falta custo na maior parte das vendas.");
  });
});

describe("ResultadoCards", () => {
  it("custo parcial: quatro cartões, variação, cobertura, compras e ressalva", async () => {
    var onVerCompras = jest.fn();
    var tree = await montar(<ResultadoCards resultado={base()} period="month" onVerCompras={onVerCompras} onCadastrarCustos={jest.fn()} />);
    var t = texto(tree);
    expect(texto(tree, "cartao-faturamento")).toContain("R$ 18.420,00");
    expect(texto(tree, "cartao-faturamento")).toContain("▲ 9% sobre o mês passado");
    expect(texto(tree, "cartao-custos")).toContain("R$ 6.820,00");
    expect(texto(tree, "cartao-lucro")).toContain("R$ 6.080,00");
    expect(texto(tree, "cartao-lucro")).toContain("47,1% de margem");
    expect(texto(tree, "cartao-lucro")).toContain("R$ 12.900,00 vendidos com custo − R$ 6.820,00");
    expect(texto(tree, "cartao-despesas")).toContain("R$ 4.310,00");
    expect(t).toContain("30% do faturamento ficou fora do lucro bruto");
    expect(t).toContain("Compras de mercadoria pagas");
    expect(t).toContain("R$ 7.800,00");
    expect(t).toContain("podem ser diferentes");
    expect(t).not.toContain("Blusa listrada");

    await act(async function () { porId(tree, "receitas-ver-produtos")[0].props.onPress(); });
    expect(texto(tree)).toContain("Blusa listrada");

    await act(async function () { porId(tree, "receitas-ver-compras")[0].props.onPress(); });
    expect(onVerCompras).toHaveBeenCalled();

    await act(async function () { porId(tree, "receitas-como-calcula")[0].props.onPress(); });
    expect(texto(tree)).toContain("A compra de mercadoria não conta aqui");
  });

  it("custo completo: faixa verde e nada de lista", async () => {
    var tree = await montar(<ResultadoCards resultado={base({ cobertura: { pct: 100, receita_sem_custo: 0, itens: 3, itens_com_custo: 3, produtos_sem_custo: 0 }, produtos_sem_custo: [] })} period="month" />);
    expect(texto(tree)).toContain("Todas as vendas neste mês têm custo cadastrado.");
    expect(porId(tree, "receitas-ver-produtos")).toHaveLength(0);
  });

  it("nenhum custo: cartões pedem o custo em vez de R$ 0", async () => {
    var onCadastrar = jest.fn();
    var tree = await montar(<ResultadoCards resultado={base({
      custos: 0, lucro_bruto: null, margem_pct: null, receita_com_custo: 0,
      cobertura: { pct: 0, receita_sem_custo: 18300, itens: 3, itens_com_custo: 0, produtos_sem_custo: 112 },
    })} period="month" onCadastrarCustos={onCadastrar} />);
    expect(texto(tree, "cartao-custos")).toContain("—");
    expect(texto(tree, "cartao-custos")).toContain("sem custo cadastrado");
    expect(texto(tree, "cartao-lucro")).toContain("precisa do custo");
    expect(texto(tree, "cartao-lucro")).not.toContain("R$ 0,00");
    await act(async function () { porId(tree, "receitas-cadastrar-custos")[0].props.onPress(); });
    expect(onCadastrar).toHaveBeenCalled();
  });

  it("duas lojas: diz quantas lojas têm pouco custo", async () => {
    var tree = await montar(<ResultadoCards resultado={base({
      consolidado: true, empresas: 2, faturamento: 31650,
      cobertura: { pct: 79, receita_sem_custo: 6750, itens: 9, itens_com_custo: 7, produtos_sem_custo: 61, lojas_com_pouco_custo: 1, lojas_com_venda: 2 },
    })} period="month" />);
    expect(texto(tree)).toContain("Em 1 de 2 lojas falta custo na maior parte das vendas.");
    expect(texto(tree, "cartao-faturamento")).toContain("R$ 31.650,00");
  });

  it("sem compra de fornecedor: a linha não aparece", async () => {
    var tree = await montar(<ResultadoCards resultado={base({ compras_pagas: { total: 0, lancamentos: 0 } })} period="month" />);
    expect(porId(tree, "receitas-compras")).toHaveLength(0);
  });
});

describe("TabReceitas", () => {
  var props = {
    transactions: [],
    summary: { income: 1000, expenses: 200, balance: 800 },
    previousSummary: null,
    period: "month",
    consolidated: false,
  };

  it("sem resultado (backend antigo ou sem custo): a aba fica como era", async () => {
    var tree = await montar(<TabReceitas {...props} resultado={null} />);
    expect(porId(tree, "receitas-resultado")).toHaveLength(0);
    expect(texto(tree)).toContain("Recebido no período");
  });

  it("com resultado: os quatro cartões em cima e o resto da aba igual", async () => {
    var tree = await montar(<TabReceitas {...props} resultado={base()} />);
    expect(porId(tree, "receitas-resultado")).toHaveLength(1);
    var t = texto(tree);
    expect(t.indexOf("Faturamento")).toBeLessThan(t.indexOf("Recebido no período"));
    expect(t).toContain("Valor médio por venda");
  });
});
