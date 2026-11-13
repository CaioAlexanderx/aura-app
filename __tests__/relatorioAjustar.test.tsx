// Financeiro › Relatórios › Produtos — painel "Ajustar o relatório" e o
// último modelo lembrado (p-115b, 13/11/2026).

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true] }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/hooks/useCompanyProfile", () => ({ useCompanyProfile: () => ({ profile: { legal_name: "Loja Exemplo Ltda", trade_name: "Loja Exemplo", cnpj: "00000000000100", logo_url: "" } }) }));
jest.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    flattened: [
      { category: { id: "c-roupas", name: "Roupas" }, breadcrumb: [{ name: "Roupas" }] },
      { category: { id: "c-blusas", name: "Blusas" }, breadcrumb: [{ name: "Roupas" }, { name: "Blusas" }] },
    ],
  }),
}));

var mockLargura = 1200;
jest.mock("react-native", () => {
  var rn = jest.requireActual("react-native");
  return Object.assign({}, rn, { useWindowDimensions: () => ({ width: mockLargura, height: 800, scale: 1, fontScale: 1 }) });
});

var mockAuth: any = { company: { id: "empresa-1" }, user: { id: "u-1" }, consolidatedView: false, token: "t", isDemo: false, refreshMe: async () => {} };
jest.mock("@/stores/auth", () => ({
  useAuthStore: function (selector: any) { return typeof selector === "function" ? selector(mockAuth) : mockAuth; },
}));

var mockConsulta = { consulta: false, carregando: false, semCusto: false };
jest.mock("@/hooks/useEstoqueConsulta", () => ({ useEstoqueConsulta: () => mockConsulta }));

var mockUrls: string[] = [];
var mockResposta: any = null;
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any; code: string | null;
    constructor(m: string, s: number, d?: any) { super(m); this.status = s; this.data = d; this.code = null; }
  }
  return { ApiError, request: jest.fn(async (url: string) => { mockUrls.push(url); return mockResposta; }) };
});

import {
  MODELOS, estadoDoModelo, estadoInicial, estadoReducer, celula, limitarNumero,
  acoesDoEstoque, acoesDasVendas, acoesDoCusto, modoEstoque, modoVendas, estoqueMaxDeAbaixo, abaixoDeEstoqueMax,
  colunasDoPainel, podeDesmarcar, ordensDoPainel, textoDasVariantes, fraseResposta, textoDaFrase, kpisDoModelo,
  chaveDoModeloLembrado, lerModeloLembrado, guardarModeloLembrado, modeloDeAbertura,
  type LinhaRelatorio, type EstadoRelatorio, type AcaoRelatorio,
} from "@/utils/relatorioProdutos";
import { AjustarRelatorio } from "@/components/screens/financeiro/relatorios/AjustarRelatorio";
import { TabRelatorios } from "@/components/screens/financeiro/relatorios/TabRelatorios";

function linha(over: Partial<LinhaRelatorio> = {}): LinhaRelatorio {
  return {
    chave: "p1", product_id: "p1", variant_id: null, nome: "Camiseta", variante: null, nome_exibicao: "Camiseta",
    sku: "C1", codigo_barras: null, categoria_id: null, categoria: null, marca: null, unidade: "un", ativo: true,
    loja: null, compartilhado: false, estoque: 12, preco: 50, custo: 20, tem_custo: true, vendidos: 9, faturamento: 450,
    lucro: 270, margem: 60, ultima_venda: "2026-11-12", dias_sem_vender: 1, media_diaria: 1.2, dias_ate_acabar: 10,
    valor_parado: 240, valor_estoque_venda: 600, ...over,
  };
}

function aplicar(est: EstadoRelatorio, acoes: AcaoRelatorio[]) { return acoes.reduce(estadoReducer, est); }

describe("padrão de agrupar por modelo", () => {
  it("produto em Mais vendidos, Mais lucrativos, Margem baixa e Sem custo; item nos outros", () => {
    expect(["mais_vendidos", "mais_lucrativos", "margem_baixa", "sem_custo"].map((m: any) => estadoDoModelo(m).agrupar)).toEqual(["produto", "produto", "produto", "produto"]);
    expect(["estoque_acabando", "estoque_zerado", "parados_30"].map((m: any) => estadoDoModelo(m).agrupar)).toEqual(["item", "item", "item"]);
  });
});

describe("tamanhos e primeiro a acabar", () => {
  it("'N tamanhos' só agrupado e com mais de uma variante", () => {
    expect(textoDasVariantes({ variantes: 4 }, "produto")).toBe("4 tamanhos");
    expect(textoDasVariantes({ variantes: 1 }, "produto")).toBeNull();
    expect(textoDasVariantes({ variantes: 4 }, "item")).toBeNull();
  });
  it("dias até acabar diz qual variante acaba primeiro", () => {
    expect(celula(linha({ primeiro_a_acabar: { variant_id: "v1", rotulo: "M", dias: 6 } }), "dias_ate_acabar", "2026-11-13")).toEqual({ texto: "M em 6 dias", tom: "vermelho" });
    expect(celula(linha({ primeiro_a_acabar: { variant_id: "v1", rotulo: "G", dias: 1 } }), "dias_ate_acabar", "2026-11-13").texto).toBe("G em 1 dia");
    expect(celula(linha({ primeiro_a_acabar: { variant_id: "v1", rotulo: "P", dias: 12 } }), "dias_ate_acabar", "2026-11-13").tom).toBe("ambar");
    expect(celula(linha({ primeiro_a_acabar: null, dias_ate_acabar: 20 }), "dias_ate_acabar", "2026-11-13")).toEqual({ texto: "20 d", tom: "normal" });
  });
});

describe("limites 1–365", () => {
  it("limitarNumero", () => {
    expect(limitarNumero(0, 15)).toBe(1);
    expect(limitarNumero(999, 15)).toBe(365);
    expect(limitarNumero("12", 15)).toBe(12);
    expect(limitarNumero("", 15)).toBe(15);
    expect(limitarNumero("abc", 30)).toBe(30);
    expect(limitarNumero(-5, 30)).toBe(1);
  });
  it("os filtros do painel saem limitados", () => {
    var e = aplicar(estadoInicial(), acoesDoEstoque(estadoInicial().filtros, "acabando", 900));
    expect(e.filtros.acaba_em_dias).toBe(365);
    var v = aplicar(estadoInicial(), acoesDasVendas(estadoInicial().filtros, "parado", 0));
    expect(v.filtros.sem_vender_dias).toBe(1);
  });
});

describe("seletores do painel → filtros", () => {
  it("Estoque: acabando, zerado, abaixo de N e todos", () => {
    var base = estadoInicial();
    var ac = aplicar(base, acoesDoEstoque(base.filtros, "acabando", 10));
    expect(ac.filtros).toMatchObject({ com_estoque: true, acaba_em_dias: 10 });
    expect(ac.escolha).toBe("personalizado");
    var z = aplicar(ac, acoesDoEstoque(ac.filtros, "zerado"));
    expect(z.filtros).toMatchObject({ com_estoque: false, acaba_em_dias: null });
    var ab = aplicar(z, acoesDoEstoque(z.filtros, "abaixo", 5));
    expect(ab.filtros).toMatchObject({ com_estoque: null, estoque_max: 4.999 });
    expect(modoEstoque(ab.filtros)).toBe("abaixo");
    expect(abaixoDeEstoqueMax(estoqueMaxDeAbaixo(5))).toBe(5);
    var t = aplicar(ab, acoesDoEstoque(ab.filtros, "todos"));
    expect(t.filtros).toMatchObject({ com_estoque: null, estoque_max: null, acaba_em_dias: null });
  });
  it("Vendas: parado pede com estoque; sair dele tira", () => {
    var base = estadoInicial();
    var p = aplicar(base, acoesDasVendas(base.filtros, "parado", 45));
    expect(p.filtros).toMatchObject({ vendeu: null, sem_vender_dias: 45, com_estoque: true });
    expect(modoVendas(p.filtros)).toBe("parado");
    expect(modoEstoque(p.filtros)).toBe("todos");
    var q = aplicar(p, acoesDasVendas(p.filtros, "qualquer"));
    expect(q.filtros).toMatchObject({ vendeu: null, sem_vender_dias: null, com_estoque: null });
    var parados = estadoDoModelo("parados_30");
    var vend = aplicar(parados, acoesDasVendas(parados.filtros, "vendeu"));
    expect(vend.filtros).toMatchObject({ vendeu: true, sem_vender_dias: null, com_estoque: null });
  });
  it("Custo: Todos e Sem custo tiram a margem", () => {
    var mb = estadoDoModelo("margem_baixa");
    expect(aplicar(mb, acoesDoCusto("todos")).filtros).toMatchObject({ sem_custo: null, margem_max: null });
    expect(aplicar(mb, acoesDoCusto("com")).filtros).toMatchObject({ sem_custo: false, margem_max: 30 });
  });
  it("colunas e ordens sem custo; não desmarca a última", () => {
    expect(colunasDoPainel(false)).not.toContain("lucro");
    expect(colunasDoPainel(true)).toContain("lucro");
    expect(colunasDoPainel(true)).not.toContain("loja");
    expect(podeDesmarcar("estoque", ["loja", "estoque"])).toBe(false);
    expect(podeDesmarcar("estoque", ["estoque", "vendidos"])).toBe(true);
    expect(ordensDoPainel(["estoque", "comprar", "dias_ate_acabar"]).map((o) => o.ordem)).toEqual(["nome", "estoque", "dias_ate_acabar"]);
  });
});

describe("Personalizado: frase e KPIs", () => {
  it("N produtos com esses filtros / Relatório personalizado", () => {
    var c: any = { escolha: "personalizado", periodo: "semana", linhas: [linha()], total: 12, totais: { itens: 12, estoque: 80, valor_estoque_custo: 0, valor_estoque_venda: 0, vendidos: 30, faturamento: 900, lucro: 0, margem: null }, cobertura: null, filtros: estadoInicial().filtros, podeVerCusto: true };
    var f = fraseResposta(c);
    expect(textoDaFrase(f)).toBe("12 produtos com esses filtros.");
    expect(f.sub).toBe("Relatório personalizado.");
    expect(kpisDoModelo(c).map((k) => k.rotulo)).toEqual(["Produtos", "Unidades em estoque", "Faturamento"]);
  });
});

describe("modelo lembrado", () => {
  function armazem() {
    var m: Record<string, string> = {};
    return { getItem: (k: string) => (k in m ? m[k] : null), setItem: (k: string, v: string) => { m[k] = v; }, m };
  }
  it("por usuário e por empresa", () => {
    var a = armazem();
    var k1 = chaveDoModeloLembrado("u-1", "empresa-1");
    var k2 = chaveDoModeloLembrado("u-1", "empresa-2");
    var k3 = chaveDoModeloLembrado("u-2", "empresa-1");
    guardarModeloLembrado(k1, "parados_30", a);
    expect(lerModeloLembrado(k1, a)).toBe("parados_30");
    expect(lerModeloLembrado(k2, a)).toBeNull();
    expect(lerModeloLembrado(k3, a)).toBeNull();
    expect(chaveDoModeloLembrado(null, "empresa-1")).toBeNull();
  });
  it("valor estranho ou storage quebrado não derruba", () => {
    var a = armazem();
    a.setItem("x", "personalizado");
    expect(lerModeloLembrado("x", a)).toBeNull();
    var quebrado = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cheio"); } };
    expect(lerModeloLembrado("x", quebrado)).toBeNull();
    expect(() => guardarModeloLembrado("x", "mais_vendidos", quebrado)).not.toThrow();
  });
  it("modelo de custo lembrado cai em Mais vendidos para quem não vê custo", () => {
    expect(modeloDeAbertura("mais_lucrativos", false)).toBe("mais_vendidos");
    expect(modeloDeAbertura("mais_lucrativos", true)).toBe("mais_lucrativos");
    expect(modeloDeAbertura("parados_30", false)).toBe("parados_30");
    expect(modeloDeAbertura(null, true)).toBe("mais_vendidos");
  });
});

// ── montado ─────────────────────────────────────────────────────────────
function porId(tree: any, id: string) { return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false }); }
async function pressionar(tree: any, id: string) {
  await act(async () => { porId(tree, id)[0].props.onPress(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe("AjustarRelatorio despacha as ações", () => {
  function montar(est: EstadoRelatorio, extra: any = {}) {
    var acoes: AcaoRelatorio[] = [];
    var tree: any;
    act(() => {
      tree = renderer.create(
        <AjustarRelatorio
          estado={est}
          despachar={(a) => { acoes.push(a); }}
          colunasVisiveis={est.colunas}
          ordem={est.ordem}
          podeVerCusto
          consolidado={false}
          categorias={[{ id: "c-roupas", nome: "Roupas", nivel: 0, caminho: "Roupas" }, { id: "c-blusas", nome: "Blusas", nivel: 1, caminho: "Roupas › Blusas" }]}
          abertoNoInicio
          compacto={false}
          {...extra}
        />
      );
    });
    return { tree, acoes };
  }

  it("filtros, categoria, ordem, direção, agrupar e colunas", () => {
    var { tree, acoes } = montar(estadoInicial());
    act(() => { porId(tree, "relatorio-estoque-zerado")[0].props.onPress(); });
    expect(aplicar(estadoInicial(), acoes).filtros.com_estoque).toBe(false);
    acoes.length = 0;
    act(() => { porId(tree, "relatorio-categoria")[0].props.onPress(); });
    act(() => { porId(tree, "relatorio-categoria-c-blusas")[0].props.onPress(); });
    expect(acoes).toEqual([{ type: "filtro", campo: "categoria", valor: "c-blusas" }]);
    acoes.length = 0;
    act(() => { porId(tree, "relatorio-ordem-faturamento")[0].props.onPress(); });
    act(() => { porId(tree, "relatorio-direcao-asc")[0].props.onPress(); });
    act(() => { porId(tree, "relatorio-agrupar")[0].props.onPress(); });
    act(() => { porId(tree, "relatorio-coluna-lucro")[0].props.onPress(); });
    expect(acoes).toEqual([
      { type: "ordenar", ordem: "faturamento" },
      { type: "ordenar", ordem: "vendidos" },
      { type: "agrupar", agrupar: "item" },
      { type: "alternarColuna", coluna: "lucro" },
    ]);
    expect(aplicar(estadoInicial(), acoes).escolha).toBe("personalizado");
  });

  it("Maior/Menor primeiro inverte a ordem atual", () => {
    var est = estadoReducer(estadoInicial(), { type: "ordenar", ordem: "faturamento" });
    var { tree, acoes } = montar(est, { ordem: "faturamento" });
    act(() => { porId(tree, "relatorio-direcao-desc")[0].props.onPress(); }); // já é desc: nada
    act(() => { porId(tree, "relatorio-direcao-asc")[0].props.onPress(); });
    expect(acoes).toEqual([{ type: "ordenar", ordem: "faturamento" }]);
    expect(aplicar(est, acoes)).toMatchObject({ ordem: "faturamento", direcao: "asc" });
  });

  it("número do Acabando vai limitado a 365", () => {
    var est = estadoDoModelo("estoque_acabando");
    var { tree, acoes } = montar(est);
    var campo = tree.root.findAll((n: any) => n.props && n.props.testID === "relatorio-estoque-n" && typeof n.props.onChangeText === "function")[0];
    act(() => { campo.props.onChangeText("999"); });
    expect(aplicar(est, acoes).filtros.acaba_em_dias).toBe(365);
  });

  it("não deixa desmarcar a última coluna; Produto é fixo", () => {
    var est = estadoReducer(estadoInicial(), { type: "colunas", colunas: ["vendidos"] });
    var { tree } = montar(est);
    expect(porId(tree, "relatorio-coluna-vendidos")[0].props.disabled).toBe(true);
    expect(porId(tree, "relatorio-coluna-produto")[0].props.disabled).toBe(true);
  });

  it("quem não vê custo: sem filtro Custo nem colunas de custo", () => {
    var { tree } = montar(estadoInicial(), { podeVerCusto: false });
    expect(porId(tree, "relatorio-filtro-custo")).toHaveLength(0);
    expect(porId(tree, "relatorio-coluna-lucro")).toHaveLength(0);
    expect(porId(tree, "relatorio-coluna-valor_parado")).toHaveLength(0);
  });

  it("no consolidado a categoria vai pelo nome", () => {
    var { tree, acoes } = montar(estadoInicial(), { consolidado: true });
    act(() => { porId(tree, "relatorio-categoria")[0].props.onPress(); });
    act(() => { porId(tree, "relatorio-categoria-c-roupas")[0].props.onPress(); });
    expect(acoes).toEqual([{ type: "filtro", campo: "categoria", valor: "Roupas" }]);
  });
});

describe("TabRelatorios: painel e modelo lembrado", () => {
  var resp = {
    linhas: [linha({ variantes: 3 })], total_linhas: 1, truncado: false,
    totais: { itens: 1, estoque: 12, valor_estoque_custo: 240, valor_estoque_venda: 600, vendidos: 9, faturamento: 450, lucro: 270, margem: 60 },
    cobertura_custo: { com_custo: 1, sem_custo: 0, percentual: 100, faturamento_sem_custo: 0 },
    periodo: { de: "2026-11-07", ate: "2026-11-13", dias: 7, hoje: "2026-11-13" },
    modelo: "mais_vendidos", agrupar: "produto", escopo: "loja", empresas: ["empresa-1"], ordem: "vendidos", direcao: "desc",
    filtros: {}, paginacao: { limit: 50, offset: 0, todas: false }, pode_ver_custo: true,
  };
  async function montarTab() {
    var qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    var tree: any;
    await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><TabRelatorios hrefCustos={null} /></QueryClientProvider>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return tree;
  }
  beforeEach(() => {
    window.localStorage.clear();
    mockUrls = []; mockResposta = resp; mockLargura = 1200;
    mockConsulta = { consulta: false, carregando: false, semCusto: false };
  });

  it("primeira vez: Mais vendidos; escolher um modelo grava; ajuste não grava", async () => {
    var tree = await montarTab();
    expect(mockUrls[0]).toContain("modelo=mais_vendidos");
    expect(porId(tree, "relatorio-ajustar-corpo")).toHaveLength(1); // aberto no PC
    await pressionar(tree, "relatorio-modelo-parados_30");
    var chave = chaveDoModeloLembrado("u-1", "empresa-1")!;
    expect(window.localStorage.getItem(chave)).toBe("parados_30");
    await pressionar(tree, "relatorio-vendas-qualquer");
    expect(porId(tree, "relatorio-modelo-personalizado")[0].props.accessibilityState.selected).toBe(true);
    expect(window.localStorage.getItem(chave)).toBe("parados_30");
    tree.unmount();
    mockUrls = [];
    await montarTab();
    expect(mockUrls[0]).toContain("modelo=parados_30");
  });

  it("usuário chega depois do primeiro render (produção): abre no modelo lembrado", async () => {
    window.localStorage.setItem(chaveDoModeloLembrado("u-1", "empresa-1")!, "estoque_acabando");
    var original = mockAuth;
    mockAuth = { ...original, user: null };
    var qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    var el = () => <QueryClientProvider client={qc}><TabRelatorios hrefCustos={null} /></QueryClientProvider>;
    var tree: any;
    try {
      await act(async () => { tree = renderer.create(el()); });
      mockAuth = original;
      await act(async () => { tree.update(el()); });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(porId(tree, "relatorio-modelo-estoque_acabando")[0].props.accessibilityState.selected).toBe(true);
      expect(mockUrls[mockUrls.length - 1]).toContain("modelo=estoque_acabando");
    } finally {
      mockAuth = original;
    }
  });

  it("modelo de custo lembrado + quem não vê custo: abre em Mais vendidos", async () => {
    window.localStorage.setItem(chaveDoModeloLembrado("u-1", "empresa-1")!, "mais_lucrativos");
    mockConsulta = { consulta: false, carregando: false, semCusto: true };
    mockResposta = { ...resp, pode_ver_custo: false, cobertura_custo: null };
    var tree = await montarTab();
    expect(porId(tree, "relatorio-modelo-mais_vendidos")[0].props.accessibilityState.selected).toBe(true);
    expect(mockUrls.some((u) => u.includes("mais_lucrativos"))).toBe(false);
    expect(mockUrls[mockUrls.length - 1]).toContain("modelo=mais_vendidos");
  });

  it("375 px: painel fechado; linha agrupada mostra 'N tamanhos'", async () => {
    mockLargura = 375;
    var tree = await montarTab();
    expect(porId(tree, "relatorio-ajustar-corpo")).toHaveLength(0);
    await pressionar(tree, "relatorio-ajustar-abrir");
    expect(porId(tree, "relatorio-ajustar-corpo")).toHaveLength(1);
    var textos = tree.root.findAll((n: any) => typeof n.type === "string" && n.props.children === "3 tamanhos" || (typeof n.props.children === "string" && n.props.children.indexOf("3 tamanhos") >= 0));
    expect(textos.length).toBeGreaterThan(0);
  });
});

describe("definições", () => {
  it("todos os modelos têm agrupar definido", () => {
    Object.keys(MODELOS).forEach((m) => expect(["item", "produto"]).toContain((MODELOS as any)[m].agrupar));
  });
});
