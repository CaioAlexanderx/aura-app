// Financeiro › Relatórios › Produtos — "Baixar PDF" e "Baixar planilha"
// (p-116, 13/11/2026). jspdf e xlsx são falsos: a geração real não entra no
// jest. Confere a montagem das linhas e colunas, o corte de custo, o texto
// dos filtros, o nome do arquivo, o plano B da logo e o aviso de truncado.

import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

var mockResposta: any = null;
var mockFalha = false;
var mockUrls: string[] = [];
jest.mock("@/services/api", () => {
  class ApiError extends Error { status = 0; data: any = null; code: string | null = null; }
  return {
    ApiError,
    request: jest.fn(async (url: string) => { mockUrls.push(url); if (mockFalha) throw new Error("rede"); return mockResposta; }),
  };
});

import { estadoDoModelo, estadoInicial, estadoReducer, type LinhaRelatorio, type RespostaRelatorio } from "@/utils/relatorioProdutos";
import {
  montarDadosDoArquivo, textoDosFiltros, nomeDoArquivo, queryDoArquivo, colunasDoArquivo, paraWinAnsi, valorDoArquivo,
  AVISO_TRUNCADO, RODAPE_LEGAL, type Empresa,
} from "@/utils/relatorioArquivo";
import { carregarImagem, gerarPdf } from "@/utils/relatorioPdf";
import { montarPlanilha, abaProdutos, celulaDaPlanilha, FORMATO_MOEDA, FORMATO_PCT } from "@/utils/relatorioXlsx";
import { BaixarRelatorio, MSG_ERRO_ARQUIVO } from "@/components/screens/financeiro/relatorios/BaixarRelatorio";

function linha(over: Partial<LinhaRelatorio> = {}): LinhaRelatorio {
  return {
    chave: "p1", product_id: "p1", variant_id: null, nome: "Camiseta", variante: null, nome_exibicao: "Camiseta básica",
    sku: "C1", codigo_barras: null, categoria_id: null, categoria: "Roupas", marca: null, unidade: "un", ativo: true,
    loja: { company_id: "e1", nome: "Loja Centro" }, compartilhado: false, estoque: 12, preco: 59, custo: 22, tem_custo: true,
    vendidos: 40, faturamento: 2360, lucro: 1480, margem: 62.7, ultima_venda: "2026-11-12", dias_sem_vender: 1,
    media_diaria: 2, dias_ate_acabar: 6, valor_parado: 264, valor_estoque_venda: 708, ...over,
  };
}
function resposta(over: Partial<RespostaRelatorio> = {}): RespostaRelatorio {
  return {
    linhas: [linha(), linha({ chave: "p2", nome_exibicao: "Chinelo slide", vendidos: 31, custo: null, lucro: null, margem: null, valor_parado: null, tem_custo: false })],
    total_linhas: 2, truncado: false,
    totais: { itens: 2, estoque: 24, valor_estoque_custo: 264, valor_estoque_venda: 1416, vendidos: 71, faturamento: 4720, lucro: 1480, margem: 62.7 },
    cobertura_custo: { com_custo: 1, sem_custo: 1, percentual: 50, faturamento_sem_custo: 2360 },
    periodo: { de: "2026-11-07", ate: "2026-11-13", dias: 7, hoje: "2026-11-13" },
    modelo: "mais_lucrativos", agrupar: "produto", escopo: "loja", empresas: ["e1"], ordem: "lucro", direcao: "desc",
    filtros: {}, paginacao: { limit: 5000, offset: 0, todas: true }, pode_ver_custo: true, ...over,
  };
}
var EMPRESA: Empresa = { razaoSocial: "Loja Exemplo Ltda", cnpj: "00.000.000/0001-00", loja: "Loja Exemplo", logoUrl: null };
var AGORA = Date.UTC(2026, 10, 13, 17, 32); // 14:32 em São Paulo

describe("linhas e colunas do arquivo", () => {
  it("Produto primeiro, depois as colunas da tela, na ordem da resposta", () => {
    var est = estadoDoModelo("mais_lucrativos");
    var d = montarDadosDoArquivo({ estado: est, resposta: resposta(), podeVerCusto: true, consolidado: false, empresa: EMPRESA, emitidoPor: "Ana", agora: AGORA });
    expect(d.titulo).toBe("Relatório de Produtos · Mais lucrativos");
    expect(d.cabecalho).toEqual(["Produto", "Vendidos", "Faturamento", "Lucro", "Margem"]);
    expect(d.linhas.map((l) => l.produto)).toEqual(["Camiseta básica", "Chinelo slide"]);
    expect(d.linhas[0].valores.map((v) => v.numero)).toEqual([40, 2360, 1480, 62.7]);
    expect(d.linhas[1].valores[2]).toEqual({ texto: "sem custo", numero: null, formato: "texto", tom: "apagado" });
    expect(d.total.rotulo).toBe("Total (2)");
    expect(d.total.valores.map((v) => v.numero)).toEqual([71, 4720, 1480, 62.7]);
    expect(d.emitidoEm).toBe("13/11/2026, 14:32");
  });

  it("consolidado: a coluna Loja entra na frente", () => {
    var cols = colunasDoArquivo(estadoInicial(), true, true);
    expect(cols[0]).toBe("loja");
  });

  it("a query do arquivo é a da tela, sem página e com todas=1", () => {
    var q = Object.fromEntries(queryDoArquivo(estadoInicial(), { de: "2026-11-07", ate: "2026-11-13", consolidado: false, podeVerCusto: true }));
    expect(q.todas).toBe("1");
    expect(q.limit).toBeUndefined();
    expect(q.offset).toBeUndefined();
    expect(q.ordem).toBe("vendidos");
  });

  it("Comprar e dias até acabar viram número; 'M em 6 dias' segue texto", () => {
    expect(valorDoArquivo(linha({ media_diaria: 2, estoque: 10 }), "comprar", "2026-11-13").numero).toBe(62);
    expect(valorDoArquivo(linha(), "dias_ate_acabar", "2026-11-13").numero).toBe(6);
    var ag = valorDoArquivo(linha({ primeiro_a_acabar: { variant_id: "v", rotulo: "M", dias: 6 } }), "dias_ate_acabar", "2026-11-13");
    expect(ag).toEqual({ texto: "M em 6 dias", numero: null, formato: "texto", tom: "vermelho" });
    expect(valorDoArquivo(linha(), "ultima_venda", "2026-11-13").texto).toBe("12/11/2026");
  });
});

describe("corte de custo", () => {
  it("quem não vê custo: sem colunas, filtros nem parâmetros de custo", () => {
    var est = estadoReducer(estadoDoModelo("margem_baixa"), { type: "colunas", colunas: ["vendidos", "custo", "margem", "valor_parado"] });
    var d = montarDadosDoArquivo({ estado: est, resposta: resposta({ pode_ver_custo: false }), podeVerCusto: false, consolidado: false, empresa: EMPRESA, emitidoPor: "Ana" });
    expect(d.cabecalho).toEqual(["Produto", "Vendidos"]);
    expect(d.filtros.join(" ")).not.toMatch(/custo|margem/);
    expect(d.parametros.map((p) => p[0])).not.toContain("margem_max");
    expect(d.parametros.map((p) => p[0])).not.toContain("sem_custo");
  });
  it("pode_ver_custo:false da resposta também corta", () => {
    var d = montarDadosDoArquivo({ estado: estadoDoModelo("parados_30"), resposta: resposta({ pode_ver_custo: false }), podeVerCusto: true, consolidado: false, empresa: EMPRESA, emitidoPor: "Ana" });
    expect(d.cabecalho).not.toContain("Parado a custo");
  });
});

describe("texto dos filtros", () => {
  it("em linguagem de balcão", () => {
    var f = textoDosFiltros(estadoDoModelo("estoque_acabando"), { de: "2026-11-07", ate: "2026-11-13", podeVerCusto: true });
    expect(f).toEqual(["Período: 07/11/2026 a 13/11/2026", "estoque acabando em até 15 dias", "um tamanho por linha", "ordenado por Dias até acabar, menor primeiro"]);
    var p = textoDosFiltros(estadoDoModelo("parados_30"), { de: "2026-11-13", ate: "2026-11-13", podeVerCusto: true });
    expect(p).toContain("com estoque e sem vender há 30 dias ou mais");
    expect(p[0]).toBe("Período: 13/11/2026");
    var mb = textoDosFiltros(estadoDoModelo("margem_baixa"), { de: "2026-11-07", ate: "2026-11-13", podeVerCusto: true });
    expect(mb).toEqual(expect.arrayContaining(["vendeu no período", "com custo cadastrado", "margem abaixo de 30%", "agrupado por produto"]));
    var cat = estadoReducer(estadoInicial(), { type: "filtro", campo: "categoria", valor: "c-1" });
    expect(textoDosFiltros(cat, { de: "2026-11-07", ate: "2026-11-13", podeVerCusto: true, nomeDaCategoria: "Roupas › Blusas" })).toContain("categoria Roupas › Blusas");
  });
  it("nome do arquivo", () => {
    expect(nomeDoArquivo(estadoInicial(), "2026-11-13", "pdf")).toBe("relatorio-produtos-mais-vendidos-2026-11-13.pdf");
    expect(nomeDoArquivo(estadoReducer(estadoInicial(), { type: "ordenar", ordem: "nome" }), "2026-11-13", "xlsx")).toBe("relatorio-produtos-personalizado-2026-11-13.xlsx");
  });
  it("acentos ficam (WinAnsi); o que não cabe vira o equivalente", () => {
    expect(paraWinAnsi("Relatório · ação é º")).toBe("Relatório · ação é º");
    expect(paraWinAnsi("Roupas › Blusas – “x”…")).toBe("Roupas > Blusas - \"x\"...");
    expect(paraWinAnsi("Ok ✓")).toBe("Ok ?");
  });
});

// ── jsPDF falso ─────────────────────────────────────────────────────────
function jsPdfFalso() {
  var registro: { textos: string[]; imagens: number; salvo: string | null; tabela: any } = { textos: [], imagens: 0, salvo: null, tabela: null };
  class Doc {
    internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
    text(t: any) { (Array.isArray(t) ? t : [t]).forEach((x) => registro.textos.push(String(x))); return this; }
    addImage() { registro.imagens++; return this; }
    getTextWidth(t: string) { return String(t).length * 1.6; }
    splitTextToSize(t: string) { return [t]; }
    getNumberOfPages() { return 2; }
    save(n: string) { registro.salvo = n; }
    setFont() { return this; } setFontSize() { return this; } setTextColor() { return this; }
    setDrawColor() { return this; } setLineWidth() { return this; } line() { return this; } setPage() { return this; }
  }
  return { registro, deps: { jsPDF: Doc as any, autoTable: (_d: any, o: any) => { registro.tabela = o; o.didDrawPage({ pageNumber: 2 }); } } };
}

describe("PDF", () => {
  var dadosBase = () => montarDadosDoArquivo({ estado: estadoDoModelo("mais_lucrativos"), resposta: resposta(), podeVerCusto: true, consolidado: false, empresa: EMPRESA, emitidoPor: "Ana", agora: AGORA });

  it("faixa, título, quem emitiu, tabela com cabeçalho em toda página, total e rodapé", () => {
    var f = jsPdfFalso();
    gerarPdf(dadosBase(), f.deps, { aura: { dataUrl: "data:image/png;base64,AA", largura: 192, altura: 192 }, loja: null });
    expect(f.registro.textos).toEqual(expect.arrayContaining(["Aura", ".", "Loja Exemplo Ltda", "CNPJ 00.000.000/0001-00 · Loja Exemplo", "Relatório de Produtos · Mais lucrativos", "13/11/2026, 14:32", "Ana"]));
    expect(f.registro.tabela.showHead).toBe("everyPage");
    expect(f.registro.tabela.head[0][0]).toBe("Produto");
    expect(f.registro.tabela.foot[0][0]).toBe("Total (2)");
    expect(f.registro.tabela.alternateRowStyles.fillColor).toBeDefined();
    // cores da tela no corpo: "sem custo" apagado; margem normal sem cor
    var semCusto: any = { section: "body", column: { index: 4 }, row: { index: 1 }, cell: { styles: {} } };
    f.registro.tabela.didParseCell(semCusto);
    expect(semCusto.cell.styles.textColor).toEqual([138, 134, 166]);
    var normal: any = { section: "body", column: { index: 4 }, row: { index: 0 }, cell: { styles: {} } };
    f.registro.tabela.didParseCell(normal);
    expect(normal.cell.styles.textColor).toBeUndefined();
    expect(f.registro.textos).toContain(RODAPE_LEGAL);
    expect(f.registro.textos).toContain("getaura.com.br · Página 1 de 2");
    expect(f.registro.textos).toContain("getaura.com.br · Página 2 de 2");
  });

  it("plano B: sem logo do lojista, só o nome (nenhuma imagem a mais)", () => {
    var f = jsPdfFalso();
    gerarPdf(dadosBase(), f.deps, { aura: null, loja: null });
    expect(f.registro.imagens).toBe(0);
    expect(f.registro.textos).toContain("Loja Exemplo Ltda");
    var g = jsPdfFalso();
    gerarPdf(dadosBase(), g.deps, { aura: null, loja: { dataUrl: "data:image/png;base64,AA", largura: 300, altura: 100 } });
    // a página 2 redesenha a faixa
    expect(g.registro.imagens).toBe(2);
  });

  it("truncado: aviso no topo e no rodapé", () => {
    var d = montarDadosDoArquivo({ estado: estadoInicial(), resposta: resposta({ truncado: true, total_linhas: 7400 }), podeVerCusto: true, consolidado: false, empresa: EMPRESA, emitidoPor: "Ana" });
    var f = jsPdfFalso();
    gerarPdf(d, f.deps, { aura: null, loja: null });
    expect(f.registro.textos).toContain(AVISO_TRUNCADO + " de 7.400.");
    expect(f.registro.textos).toContain(RODAPE_LEGAL + " " + AVISO_TRUNCADO + ".");
  });

  it("carregarImagem: qualquer falha vira null (plano B)", async () => {
    var ok = { fetch: async () => ({ ok: true, blob: async () => new Blob(["x"]) }), paraDataUrl: async () => ({ dataUrl: "data:image/png;base64,AA", largura: 10, altura: 10 }) };
    expect(await carregarImagem("https://r2.getaura.com.br/logo.png", ok)).toEqual({ dataUrl: "data:image/png;base64,AA", largura: 10, altura: 10 });
    expect(await carregarImagem(null, ok)).toBeNull();
    expect(await carregarImagem("x", { ...ok, fetch: async () => { throw new TypeError("Failed to fetch (CORS)"); } })).toBeNull();
    expect(await carregarImagem("x", { ...ok, fetch: async () => ({ ok: false, blob: async () => new Blob([]) }) })).toBeNull();
    expect(await carregarImagem("x", { ...ok, paraDataUrl: async () => null })).toBeNull();
    expect(await carregarImagem("x", { ...ok, fetch: () => new Promise(() => {}), limiteMs: 20 } as any)).toBeNull();
  });
});

// ── SheetJS falsa ───────────────────────────────────────────────────────
var XLSXFalso = {
  utils: {
    encode_cell: (a: { r: number; c: number }) => String.fromCharCode(65 + a.c) + (a.r + 1),
    book_new: () => ({ SheetNames: [] as string[], Sheets: {} as any }),
    book_append_sheet: (wb: any, ws: any, nome: string) => { wb.SheetNames.push(nome); wb.Sheets[nome] = ws; },
  },
  writeFile: jest.fn(),
};

describe("planilha", () => {
  it("abas Produtos e Filtros; números como número, moeda e %; filtro automático; total", () => {
    var d = montarDadosDoArquivo({ estado: estadoDoModelo("mais_lucrativos"), resposta: resposta(), podeVerCusto: true, consolidado: false, empresa: EMPRESA, emitidoPor: "Ana", agora: AGORA });
    var wb = montarPlanilha(XLSXFalso, d);
    expect(wb.SheetNames).toEqual(["Produtos", "Filtros"]);
    var ws = wb.Sheets.Produtos;
    var p = abaProdutos(d);
    var cab = p.inicioDaTabela + 1;
    expect(ws["A" + cab]).toEqual({ t: "s", v: "Produto" });
    expect(ws["B" + (cab + 1)]).toEqual({ t: "n", v: 40, z: "#,##0" });
    expect(ws["C" + (cab + 1)]).toEqual({ t: "n", v: 2360, z: FORMATO_MOEDA });
    expect(ws["E" + (cab + 1)]).toEqual({ t: "n", v: 0.627, z: FORMATO_PCT });
    expect(ws["D" + (cab + 2)]).toEqual({ t: "s", v: "sem custo" });
    expect(ws["!autofilter"]).toEqual({ ref: "A" + cab + ":E" + (cab + 2) });
    expect(ws["A" + (cab + 3)]).toEqual({ t: "s", v: "Total (2)" });
    expect(ws["C" + (cab + 3)].t).toBe("n");
    expect(ws.A2.v).toBe("Loja");
    expect(JSON.stringify(wb.Sheets.Filtros)).toContain("Parâmetros da consulta");
  });
  it("célula sem número fica texto", () => {
    expect(celulaDaPlanilha({ texto: "—", numero: null, formato: "texto" })).toEqual({ t: "s", v: "—" });
  });
});

// ── os botões ───────────────────────────────────────────────────────────
describe("BaixarRelatorio", () => {
  function montar(extra: any = {}) {
    var f = jsPdfFalso();
    var tree: any;
    act(() => {
      tree = renderer.create(
        <BaixarRelatorio
          companyId="e1" estado={estadoInicial()} faixa={{ de: "2026-11-07", ate: "2026-11-13" }}
          podeVerCusto consolidado={false} empresa={EMPRESA} emitidoPor="Ana" hoje="2026-11-13"
          bibliotecas={{ pdf: async () => f.deps, xlsx: () => XLSXFalso }}
          {...extra}
        />
      );
    });
    return { tree, f };
  }
  function porId(tree: any, id: string) { return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false }); }
  function texto(tree: any, id: string) {
    var n = porId(tree, id)[0]; if (!n) return "";
    return n.findAll((x: any) => typeof x.type === "string").map((x: any) => (typeof x.props.children === "string" ? x.props.children : "")).join("");
  }
  beforeEach(() => { mockUrls = []; mockFalha = false; mockResposta = resposta(); (global as any).fetch = jest.fn(async () => ({ ok: false })); XLSXFalso.writeFile.mockClear(); });

  it("PDF: pede todas=1, gera e salva com o nome certo", async () => {
    var { tree, f } = montar();
    await act(async () => { await porId(tree, "relatorio-baixar-pdf")[0].props.onPress(); });
    expect(mockUrls[0]).toContain("todas=1");
    expect(mockUrls[0]).not.toContain("limit=");
    expect(f.registro.salvo).toBe("relatorio-produtos-mais-vendidos-2026-11-13.pdf");
    expect(porId(tree, "relatorio-baixar-erro")).toHaveLength(0);
  });

  it("planilha: escreve o .xlsx", async () => {
    var { tree } = montar();
    await act(async () => { await porId(tree, "relatorio-baixar-xlsx")[0].props.onPress(); });
    expect(XLSXFalso.writeFile).toHaveBeenCalledWith(expect.anything(), "relatorio-produtos-mais-vendidos-2026-11-13.xlsx");
  });

  it("enquanto gera, desabilita e diz 'Gerando'", async () => {
    var solta: any;
    mockResposta = resposta();
    var { tree } = montar({ bibliotecas: { pdf: () => new Promise((r) => { solta = r; }), xlsx: () => XLSXFalso } });
    var promessa: any;
    await act(async () => { promessa = porId(tree, "relatorio-baixar-pdf")[0].props.onPress(); await new Promise((r) => setTimeout(r, 0)); });
    expect(texto(tree, "relatorio-baixar-pdf")).toBe("Gerando o PDF…");
    expect(porId(tree, "relatorio-baixar-xlsx")[0].props.disabled).toBe(true);
    await act(async () => { solta(jsPdfFalso().deps); await promessa; });
    expect(texto(tree, "relatorio-baixar-pdf")).toBe("Baixar PDF");
  });

  it("truncado: avisa na tela", async () => {
    mockResposta = resposta({ truncado: true, total_linhas: 7400 });
    var { tree } = montar();
    await act(async () => { await porId(tree, "relatorio-baixar-xlsx")[0].props.onPress(); });
    expect(texto(tree, "relatorio-baixar-aviso")).toContain("Mostrando as primeiras 5.000 linhas de 7.400");
  });

  it("erro: mensagem gentil", async () => {
    mockFalha = true;
    var aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    var { tree } = montar();
    await act(async () => { await porId(tree, "relatorio-baixar-pdf")[0].props.onPress(); });
    expect(texto(tree, "relatorio-baixar-erro")).toBe(MSG_ERRO_ARQUIVO);
    aviso.mockRestore();
  });
});
