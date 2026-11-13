// Financeiro › Relatórios › Produtos (p-115a, 13/11/2026)
//
// Regras puras (frase-resposta com 0, 1 e N; modelo → query; Comprar;
// custo oculto) e a aba montada contra uma API falsa: com custo, sem custo
// (pode_ver_custo:false) e no celular (375 px vira cartões).

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true] }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/hooks/useCompanyProfile", () => ({ useCompanyProfile: () => ({ profile: { legal_name: "Loja Exemplo Ltda", trade_name: "Loja Exemplo", cnpj: "00000000000100", logo_url: "" } }) }));
jest.mock("@/hooks/useCategories", () => ({ useCategories: () => ({ flattened: [] }) }));

var mockLargura = 1200;
jest.mock("react-native", () => {
  var rn = jest.requireActual("react-native");
  return Object.assign({}, rn, { useWindowDimensions: () => ({ width: mockLargura, height: 800, scale: 1, fontScale: 1 }) });
});

var mockRefreshMe = jest.fn(async () => {});
jest.mock("@/stores/auth", () => ({
  useAuthStore: function (selector: any) {
    var state = { company: { id: "empresa-1" }, consolidatedView: false, token: "t", isDemo: false, refreshMe: mockRefreshMe };
    return typeof selector === "function" ? selector(state) : state;
  },
}));

var mockConsulta = { consulta: false, carregando: false, semCusto: false };
jest.mock("@/hooks/useEstoqueConsulta", () => ({ useEstoqueConsulta: () => mockConsulta }));

var mockResposta: any = null;
var mockUrls: string[] = [];
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any; code: string | null;
    constructor(m: string, s: number, d?: any) { super(m); this.status = s; this.data = d; this.code = null; }
  }
  return {
    ApiError,
    request: jest.fn(async (url: string) => { mockUrls.push(url); return typeof mockResposta === "function" ? mockResposta(url) : mockResposta; }),
  };
});

import {
  MODELOS, estadoDoModelo, estadoInicial, estadoReducer, parametrosDaQuery, sugestaoDeCompra,
  fraseResposta, textoDaFrase, kpisDoModelo, colunasVisiveis, modelosVisiveis, ordemEfetiva,
  faixaDoPeriodo, celula, colunasDoCartao, avisoDeCobertura,
  type LinhaRelatorio, type ContextoDaResposta, type RespostaRelatorio,
} from "@/utils/relatorioProdutos";
import { TabRelatorios } from "@/components/screens/financeiro/relatorios/TabRelatorios";

function linha(over: Partial<LinhaRelatorio> = {}): LinhaRelatorio {
  return {
    chave: "p1", product_id: "p1", variant_id: null, nome: "Camiseta básica", variante: null,
    nome_exibicao: "Camiseta básica", sku: "CAM-01", codigo_barras: null, categoria_id: null, categoria: "Roupas",
    marca: null, unidade: "un", ativo: true, loja: { company_id: "empresa-1", nome: "Loja Centro" }, compartilhado: false,
    estoque: 10, preco: 59, custo: 22, tem_custo: true, vendidos: 40, faturamento: 2360, lucro: 1480, margem: 62.7,
    ultima_venda: "2026-11-12", dias_sem_vender: 1, media_diaria: 2, dias_ate_acabar: 5, valor_parado: 220, valor_estoque_venda: 590,
    ...over,
  };
}

function ctx(over: Partial<ContextoDaResposta> = {}): ContextoDaResposta {
  var est = estadoDoModelo("mais_vendidos");
  return {
    escolha: "mais_vendidos", periodo: "semana", linhas: [], total: 0,
    totais: { itens: 0, estoque: 0, valor_estoque_custo: 0, valor_estoque_venda: 0, vendidos: 0, faturamento: 0, lucro: 0, margem: null },
    cobertura: { com_custo: 0, sem_custo: 0, percentual: null, faturamento_sem_custo: 0 },
    filtros: est.filtros, podeVerCusto: true,
    ...over,
  };
}

describe("frase-resposta", () => {
  it("0 resultado: diz que não achou e sugere afrouxar", () => {
    var f = fraseResposta(ctx());
    expect(textoDaFrase(f)).toBe("Nenhum produto encontrado com esses filtros.");
    expect(f.sub).toBe("Tente afrouxar um filtro.");
  });

  it("mais vendidos com 1 e com N", () => {
    var um = fraseResposta(ctx({ linhas: [linha()], total: 1, totais: { ...ctx().totais!, vendidos: 40 } }));
    expect(textoDaFrase(um)).toBe("O que mais saiu na semana: Camiseta básica.");
    expect(um.sub).toBe("Ao todo, 40 unidades de 1 produto.");
    var tres = [linha(), linha({ chave: "p2", nome_exibicao: "Chinelo slide" }), linha({ chave: "p3", nome_exibicao: "Blusa cropped" }), linha({ chave: "p4", nome_exibicao: "Meia" })];
    var n = fraseResposta(ctx({ linhas: tres, total: 28, periodo: "mes" }));
    expect(textoDaFrase(n)).toBe("Os que mais saíram no mês: Camiseta básica, Chinelo slide e Blusa cropped.");
  });

  it("estoque acabando: soma o Comprar e usa os dias do filtro", () => {
    var est = estadoDoModelo("estoque_acabando");
    var linhas = [linha({ media_diaria: 2, estoque: 10 }), linha({ chave: "p2", media_diaria: 1, estoque: 30 })];
    var f = fraseResposta(ctx({ escolha: "estoque_acabando", filtros: est.filtros, linhas: linhas, total: 2 }));
    // 2×30×1,2 − 10 = 62; 1×30×1,2 − 30 = 6
    expect(textoDaFrase(f)).toBe("2 produtos devem acabar em até 15 dias. Comprar 68 unidades repõe 30 dias, com folga de 20%.");
    var um = fraseResposta(ctx({ escolha: "estoque_acabando", filtros: est.filtros, linhas: [linhas[0]], total: 1 }));
    expect(textoDaFrase(um)).toMatch(/^1 produto deve acabar em até 15 dias\. Comprar 62 unidades/);
  });

  it("parados: valor a custo só para quem vê custo", () => {
    var est = estadoDoModelo("parados_30");
    var t = { ...ctx().totais!, valor_estoque_custo: 1520.5 };
    var com = fraseResposta(ctx({ escolha: "parados_30", filtros: est.filtros, linhas: [linha()], total: 3, totais: t, cobertura: { com_custo: 2, sem_custo: 1, percentual: 66.7, faturamento_sem_custo: 0 } }));
    expect(textoDaFrase(com)).toBe("3 produtos estão sem vender há 30 dias ou mais, com R$ 1.520,50 parados a custo.");
    expect(com.sub).toBe("1 sem custo cadastrado ficou fora dessa soma.");
    var sem = fraseResposta(ctx({ escolha: "parados_30", filtros: est.filtros, linhas: [linha()], total: 1, totais: { ...t, valor_estoque_custo: null }, cobertura: null, podeVerCusto: false }));
    expect(textoDaFrase(sem)).toBe("1 produto está sem vender há 30 dias ou mais.");
  });

  it("margem baixa, zerado, sem custo e personalizado no singular", () => {
    var mb = estadoDoModelo("margem_baixa");
    expect(textoDaFrase(fraseResposta(ctx({ escolha: "margem_baixa", filtros: mb.filtros, linhas: [linha()], total: 1 })))).toBe("1 produto vende e deixa menos de 30% de margem.");
    expect(textoDaFrase(fraseResposta(ctx({ escolha: "estoque_zerado", linhas: [linha()], total: 1 })))).toBe("1 produto está com estoque zerado.");
    expect(textoDaFrase(fraseResposta(ctx({ escolha: "sem_custo", linhas: [linha()], total: 4 })))).toBe("4 produtos não têm custo cadastrado.");
    expect(textoDaFrase(fraseResposta(ctx({ escolha: "personalizado", linhas: [linha()], total: 1 })))).toBe("1 produto com esses filtros.");
  });

  it("KPIs usam os totais da API (todo o filtro)", () => {
    var k = kpisDoModelo(ctx({ linhas: [linha()], total: 120, totais: { ...ctx().totais!, vendidos: 830, faturamento: 41250 } }));
    expect(k.map((x) => x.rotulo)).toEqual(["Produtos", "Unidades vendidas", "Faturamento"]);
    expect(k.map((x) => x.valor)).toEqual(["120", "830", "R$ 41.250,00"]);
  });
});

describe("modelo → query", () => {
  var opts = { de: "2026-11-07", ate: "2026-11-13", consolidado: false, podeVerCusto: true };
  function q(est: any, o: any = opts) { return Object.fromEntries(parametrosDaQuery(est, o)); }

  it("abre em Mais vendidos, agrupado por produto", () => {
    expect(q(estadoInicial())).toEqual({
      modelo: "mais_vendidos", de: "2026-11-07", ate: "2026-11-13", agrupar: "produto", so_ativos: "1", vendeu: "1",
      ordem: "vendidos", direcao: "desc", limit: "50", offset: "0", escopo: "loja",
    });
  });

  it("cada modelo manda os filtros explícitos", () => {
    expect(q(estadoDoModelo("estoque_acabando"))).toMatchObject({ modelo: "estoque_acabando", agrupar: "item", com_estoque: "1", acaba_em_dias: "15", ordem: "dias_ate_acabar", direcao: "asc", limit: "200" });
    expect(q(estadoDoModelo("parados_30"))).toMatchObject({ com_estoque: "1", sem_vender_dias: "30", ordem: "valor_parado" });
    expect(q(estadoDoModelo("margem_baixa"))).toMatchObject({ vendeu: "1", sem_custo: "0", margem_max: "30", ordem: "margem", direcao: "asc" });
    expect(q(estadoDoModelo("estoque_zerado"))).toMatchObject({ com_estoque: "0", agrupar: "item" });
    expect(q(estadoDoModelo("sem_custo"))).toMatchObject({ sem_custo: "1" });
  });

  it("consolidado pede escopo=grupo", () => {
    expect(q(estadoInicial(), { ...opts, consolidado: true }).escopo).toBe("grupo");
  });

  it("quem não vê custo nunca manda modelo, filtro ou ordem de custo", () => {
    var sem = { ...opts, podeVerCusto: false };
    var parados = q(estadoDoModelo("parados_30"), sem);
    expect(parados.ordem).toBe("dias_sem_vender");
    var mb = q(estadoDoModelo("margem_baixa"), sem);
    expect(mb.modelo).toBeUndefined();
    expect(mb.sem_custo).toBeUndefined();
    expect(mb.margem_max).toBeUndefined();
    expect(mb.ordem).toBe("nome");
  });

  it("ordenar pelo cabeçalho vira Personalizado e não manda modelo", () => {
    var est = estadoReducer(estadoInicial(), { type: "ordenar", ordem: "faturamento" });
    expect(est.escolha).toBe("personalizado");
    expect(est.direcao).toBe("desc");
    expect(estadoReducer(est, { type: "ordenar", ordem: "faturamento" }).direcao).toBe("asc");
    var qs = q(est);
    expect(qs.modelo).toBeUndefined();
    expect(qs.vendeu).toBe("1"); // os filtros do modelo continuam
    expect(estadoReducer(est, { type: "modelo", modelo: "mais_vendidos" })).toEqual(estadoInicial());
  });

  it("filtro e colunas (p-115b) também viram Personalizado; sobra ao menos uma coluna", () => {
    var e1 = estadoReducer(estadoInicial(), { type: "filtro", campo: "categoria", valor: "Roupas" });
    expect(e1.escolha).toBe("personalizado");
    expect(q(e1).categoria).toBe("Roupas");
    var e2 = estadoReducer(estadoInicial(), { type: "colunas", colunas: ["estoque"] });
    expect(estadoReducer(e2, { type: "alternarColuna", coluna: "estoque" }).colunas).toEqual(["estoque"]);
  });
});

describe("Comprar, custo oculto e células", () => {
  it("Comprar = max(0, ceil(média × 30 × 1,2 − estoque))", () => {
    expect(sugestaoDeCompra({ media_diaria: 2, estoque: 10 })).toBe(62);
    expect(sugestaoDeCompra({ media_diaria: 0.1, estoque: 0 })).toBe(4);
    expect(sugestaoDeCompra({ media_diaria: 1, estoque: 100 })).toBe(0);
    expect(sugestaoDeCompra({ media_diaria: null, estoque: 3 })).toBe(0);
  });

  it("sem custo: somem as colunas e os modelos de custo", () => {
    var est = estadoDoModelo("parados_30");
    expect(colunasVisiveis(est, { podeVerCusto: false, consolidado: false })).toEqual(["estoque", "ultima_venda", "dias_sem_vender"]);
    expect(colunasVisiveis(est, { podeVerCusto: true, consolidado: true })[0]).toBe("loja");
    expect(modelosVisiveis(false)).toEqual(["estoque_acabando", "mais_vendidos", "parados_30", "estoque_zerado"]);
    expect(modelosVisiveis(true)).toHaveLength(7);
    expect(ordemEfetiva(est, false)).toBe("dias_sem_vender");
  });

  it("custo nulo é 'sem custo', nunca R$ 0; cores dos alertas", () => {
    var l = linha({ custo: null, lucro: null, margem: null, valor_parado: null, tem_custo: false });
    expect(celula(l, "custo", "2026-11-13")).toEqual({ texto: "sem custo", tom: "apagado" });
    expect(celula(l, "lucro", "2026-11-13").texto).toBe("sem custo");
    expect(celula(linha({ dias_ate_acabar: 6 }), "dias_ate_acabar", "2026-11-13").tom).toBe("vermelho");
    expect(celula(linha({ dias_ate_acabar: 12 }), "dias_ate_acabar", "2026-11-13").tom).toBe("ambar");
    expect(celula(linha({ dias_ate_acabar: null }), "dias_ate_acabar", "2026-11-13").texto).toBe("sem giro");
    expect(celula(linha({ estoque: 0 }), "estoque", "2026-11-13").tom).toBe("vermelho");
    expect(celula(linha({ margem: 18.5 }), "margem", "2026-11-13")).toEqual({ texto: "18,5%", tom: "ambar" });
    expect(celula(linha({ ultima_venda: null, dias_sem_vender: null }), "ultima_venda", "2026-11-13").tom).toBe("apagado");
  });

  it("aviso de cobertura só com coluna de custo visível", () => {
    var cob = { com_custo: 8, sem_custo: 2, percentual: 80, faturamento_sem_custo: 0 };
    expect(avisoDeCobertura(["estoque", "vendidos"], cob, 10, true)).toBeNull();
    expect(avisoDeCobertura(["lucro"], cob, 10, true)).toBe("2 de 10 produtos não têm custo cadastrado e ficam fora das contas de custo, lucro e valor parado.");
    expect(avisoDeCobertura(["lucro"], cob, 10, false)).toBeNull();
  });

  it("cartão: a coluna da ordem primeiro, até 3", () => {
    expect(colunasDoCartao(["estoque", "ultima_venda", "dias_sem_vender", "valor_parado"], "valor_parado")).toEqual(["valor_parado", "estoque", "ultima_venda"]);
  });

  it("período: semana de 7 dias, mês desde o dia 1, personalizado validado", () => {
    expect(faixaDoPeriodo("semana", "2026-11-13")).toEqual({ de: "2026-11-07", ate: "2026-11-13" });
    expect(faixaDoPeriodo("mes", "2026-11-13")).toEqual({ de: "2026-11-01", ate: "2026-11-13" });
    expect(faixaDoPeriodo("ano", "2026-11-13")).toEqual({ de: "2026-01-01", ate: "2026-11-13" });
    expect(faixaDoPeriodo("personalizado", "2026-11-13", "2026-11-10", "2026-11-01")).toHaveProperty("erro");
    expect(faixaDoPeriodo("personalizado", "2026-11-13", "2026-11-01", "2026-11-20")).toHaveProperty("erro");
    expect(faixaDoPeriodo("personalizado", "2026-11-13", "2026-11-01", null)).toEqual({ incompleto: true });
  });
});

// ── a aba montada ─────────────────────────────────────────────────────
function resposta(over: Partial<RespostaRelatorio> = {}): RespostaRelatorio {
  return {
    linhas: [linha(), linha({ chave: "p2", nome_exibicao: "Chinelo slide", vendidos: 31 })],
    total_linhas: 2, truncado: false,
    totais: { itens: 2, estoque: 20, valor_estoque_custo: 440, valor_estoque_venda: 1180, vendidos: 71, faturamento: 4720, lucro: 2960, margem: 62.7 },
    cobertura_custo: { com_custo: 2, sem_custo: 0, percentual: 100, faturamento_sem_custo: 0 },
    periodo: { de: "2026-11-07", ate: "2026-11-13", dias: 7, hoje: "2026-11-13" },
    modelo: "mais_vendidos", agrupar: "produto", escopo: "loja", empresas: ["empresa-1"],
    ordem: "vendidos", direcao: "desc", filtros: {}, paginacao: { limit: 50, offset: 0, todas: false }, pode_ver_custo: true,
    ...over,
  };
}

async function montar() {
  var qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  var tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><TabRelatorios hrefCustos="/conferencia-estoque/custos" /></QueryClientProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}
function porId(tree: any, id: string) {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
function textoDe(tree: any, id: string): string {
  var achados = porId(tree, id);
  if (!achados.length) return "";
  var partes: string[] = [];
  achados[0].findAll((n: any) => typeof n.type === "string").forEach((n: any) => {
    var c = n.props.children;
    (Array.isArray(c) ? c : [c]).forEach((x: any) => { if (typeof x === "string" || typeof x === "number") partes.push(String(x)); });
  });
  return partes.join("");
}

describe("TabRelatorios", () => {
  beforeEach(() => {
    mockLargura = 1200; mockUrls = []; mockRefreshMe.mockClear();
    mockConsulta = { consulta: false, carregando: false, semCusto: false };
  });

  it("abre em Mais vendidos na semana, relê o /auth/me e mostra a frase", async () => {
    mockResposta = resposta();
    var tree = await montar();
    expect(mockRefreshMe).toHaveBeenCalled();
    expect(mockUrls[0]).toMatch(/^\/companies\/empresa-1\/relatorios\/produtos\?modelo=mais_vendidos&/);
    expect(mockUrls[0]).toContain("escopo=loja");
    expect(textoDe(tree, "relatorio-frase")).toBe("Os que mais saíram na semana: Camiseta básica e Chinelo slide.Ao todo, 71 unidades de 2 produtos.");
    expect(porId(tree, "relatorio-modelo-mais_lucrativos")).toHaveLength(1);
    expect(porId(tree, "relatorio-tabela")).toHaveLength(1);
    expect(textoDe(tree, "relatorio-mostrando")).toBe("Mostrando 2 de 2");
  });

  it("quem não vê custo: sem modelos nem colunas de custo", async () => {
    mockConsulta = { consulta: false, carregando: false, semCusto: true };
    mockResposta = resposta({ pode_ver_custo: false, cobertura_custo: null });
    var tree = await montar();
    expect(porId(tree, "relatorio-modelo-mais_lucrativos")).toHaveLength(0);
    expect(porId(tree, "relatorio-modelo-margem_baixa")).toHaveLength(0);
    expect(porId(tree, "relatorio-modelo-sem_custo")).toHaveLength(0);
    await act(async () => { porId(tree, "relatorio-modelo-parados_30")[0].props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    var ultima = mockUrls[mockUrls.length - 1];
    expect(ultima).toContain("ordem=dias_sem_vender");
    expect(ultima).not.toContain("valor_parado");
    expect(porId(tree, "relatorio-ordenar-valor_parado")).toHaveLength(0);
    expect(porId(tree, "relatorio-ordenar-dias_sem_vender")).toHaveLength(1);
  });

  it("aviso de custo com o link para cadastrar", async () => {
    mockResposta = (url: string) => url.includes("mais_lucrativos")
      ? resposta({ cobertura_custo: { com_custo: 1, sem_custo: 1, percentual: 50, faturamento_sem_custo: 59 } })
      : resposta();
    var tree = await montar();
    expect(porId(tree, "relatorio-aviso-custo")).toHaveLength(0);
    await act(async () => { porId(tree, "relatorio-modelo-mais_lucrativos")[0].props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(textoDe(tree, "relatorio-aviso-custo")).toContain("1 de 2 produtos não tem custo cadastrado");
    expect(porId(tree, "relatorio-cadastrar-custos")).toHaveLength(1);
  });

  it("375 px: a tabela vira cartões com 3 colunas, a da ordem primeiro", async () => {
    mockLargura = 375;
    mockResposta = resposta();
    var tree = await montar();
    expect(porId(tree, "relatorio-tabela")).toHaveLength(0);
    expect(porId(tree, "relatorio-cartao")).toHaveLength(2);
    var primeiro = porId(tree, "relatorio-cartao")[0];
    var cols = primeiro.findAll((n: any) => typeof n.props.testID === "string" && n.props.testID.indexOf("relatorio-cartao-") === 0, { deep: false })
      .map((n: any) => n.props.testID.replace("relatorio-cartao-", ""));
    expect(cols).toEqual(["vendidos", "estoque", "faturamento"]);
  });

  it("consolidado: a coluna Loja entra", async () => {
    mockResposta = resposta({ escopo: "grupo", empresas: ["empresa-1", "empresa-2"] });
    var tree = await montar();
    var cabecalhos = textoDe(tree, "relatorio-tabela");
    expect(cabecalhos).toContain("Loja");
  });
});

describe("chave de módulo da aba", () => {
  it("financeiro.relatorios: Essencial, pela permissão do Financeiro", () => {
    var { MODULE_PLAN_MAP, PERM_TO_MODULES, computeVisibleModules } = jest.requireActual("@/hooks/useVisibleModules");
    expect(MODULE_PLAN_MAP["financeiro.relatorios"]).toBe("essencial");
    expect(PERM_TO_MODULES.financeiro).toContain("financeiro.relatorios");
    expect(computeVisibleModules("essencial", null, null).has("financeiro.relatorios")).toBe(true);
    var membro = { is_owner: false, role: "member", permissions: { pdv: true } };
    expect(computeVisibleModules("negocio", null, membro).has("financeiro.relatorios")).toBe(false);
    var comFinanceiro = { is_owner: false, role: "member", permissions: { financeiro: true } };
    expect(computeVisibleModules("negocio", null, comFinanceiro).has("financeiro.relatorios")).toBe(true);
    expect(computeVisibleModules("essencial", { "financeiro.relatorios": false }, null).has("financeiro.relatorios")).toBe(false);
  });
});

describe("definições", () => {
  it("modelos de custo marcados", () => {
    expect(Object.keys(MODELOS).filter((m) => (MODELOS as any)[m].custo)).toEqual(["mais_lucrativos", "margem_baixa", "sem_custo"]);
  });
});
