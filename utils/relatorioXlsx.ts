// ============================================================
// AURA. — Financeiro › Relatórios › Produtos: a planilha (p-116, 13/11/2026)
//
// SheetJS (xlsx 0.18.5, a que o app já usa) chega por parâmetro, como no
// "Vendas por produto e numeração" (require na hora do clique). A edição
// community grava formato de número (cell.z) mas não grava estilo (negrito,
// cor), então o cabeçalho vai em texto simples.
//   Aba "Produtos": cabeçalho em texto (loja, CNPJ, modelo, período,
//     filtros, emitido em e por), a tabela com filtro automático, números
//     como número (moeda e percentual formatados) e a linha de total.
//   Aba "Filtros": os parâmetros do relatório.
// Sem imagem na planilha.
// ============================================================
import { AVISO_TRUNCADO, RODAPE_LEGAL, dataBR, type DadosDoArquivo, type ValorDoArquivo } from "@/utils/relatorioArquivo";

export var FORMATO_MOEDA = '"R$" #,##0.00';
export var FORMATO_PCT = "0.0%";
export var FORMATO_QTD = "#,##0.###";
export var FORMATO_INTEIRO = "#,##0";

type Celula = { t: "s" | "n"; v: string | number; z?: string };

export function celulaDaPlanilha(v: ValorDoArquivo): Celula {
  if (v.numero === null) return { t: "s", v: v.texto };
  switch (v.formato) {
    case "moeda": return { t: "n", v: Math.round(v.numero * 100) / 100, z: FORMATO_MOEDA };
    // a API manda margem em % (62,7): na planilha vai 0,627 com formato de %
    case "pct": return { t: "n", v: Math.round(v.numero * 10) / 1000, z: FORMATO_PCT };
    case "inteiro": return { t: "n", v: v.numero, z: FORMATO_INTEIRO };
    case "qtd": return { t: "n", v: v.numero, z: Number.isInteger(v.numero) ? FORMATO_INTEIRO : FORMATO_QTD };
  }
  return { t: "s", v: v.texto };
}

function s(v: string): Celula { return { t: "s", v: v }; }

/** Linhas da aba "Produtos" (matriz de células) e onde a tabela começa. */
export function abaProdutos(d: DadosDoArquivo): { linhas: Celula[][]; inicioDaTabela: number; fimDaTabela: number } {
  var linhas: Celula[][] = [];
  linhas.push([s(d.titulo)]);
  linhas.push([s("Loja"), s(d.empresa.razaoSocial + (d.empresa.loja ? " · " + d.empresa.loja : ""))]);
  if (d.empresa.cnpj) linhas.push([s("CNPJ"), s(d.empresa.cnpj)]);
  linhas.push([s("Modelo"), s(d.modelo)]);
  linhas.push([s("Período"), s(d.periodo.de === d.periodo.ate ? dataBR(d.periodo.de) : dataBR(d.periodo.de) + " a " + dataBR(d.periodo.ate))]);
  linhas.push([s("Filtros"), s(d.filtros.join("; "))]);
  linhas.push([s("Emitido em"), s(d.emitidoEm)]);
  linhas.push([s("Emitido por"), s(d.emitidoPor)]);
  if (d.truncado) linhas.push([s("Atenção"), s(AVISO_TRUNCADO + " de " + d.totalDeLinhas.toLocaleString("pt-BR") + ".")]);
  linhas.push([]);
  var inicio = linhas.length;
  linhas.push(d.cabecalho.map(s));
  d.linhas.forEach(function(l) { linhas.push([s(l.produto)].concat(l.valores.map(celulaDaPlanilha))); });
  var fim = linhas.length - 1;
  linhas.push([s(d.total.rotulo)].concat(d.total.valores.map(function(v) { return v.texto === "" ? s("") : celulaDaPlanilha(v); })));
  linhas.push([]);
  linhas.push([s(RODAPE_LEGAL)]);
  return { linhas: linhas, inicioDaTabela: inicio, fimDaTabela: fim };
}

export function abaFiltros(d: DadosDoArquivo): Celula[][] {
  var out: Celula[][] = [[s("Parâmetro"), s("Valor")]];
  out.push([s("Relatório"), s(d.titulo)]);
  out.push([s("Período"), s(dataBR(d.periodo.de) + " a " + dataBR(d.periodo.ate))]);
  d.filtros.forEach(function(f, i) { out.push([s(i === 0 ? "Filtros" : ""), s(f)]); });
  out.push([s("Linhas"), { t: "n", v: d.totalDeLinhas, z: FORMATO_INTEIRO }]);
  if (d.truncado) out.push([s("Atenção"), s(AVISO_TRUNCADO)]);
  out.push([]);
  out.push([s("Parâmetros da consulta"), s("")]);
  d.parametros.forEach(function(p) { out.push([s(p[0]), s(p[1])]); });
  return out;
}

function letra(n: number): string {
  var t = ""; n += 1;
  while (n > 0) { var r = (n - 1) % 26; t = String.fromCharCode(65 + r) + t; n = Math.floor((n - 1) / 26); }
  return t;
}

function folha(XLSX: any, linhas: Celula[][]): any {
  var ws: any = {};
  var maxC = 0;
  linhas.forEach(function(l, r) {
    l.forEach(function(c, ci) { ws[XLSX.utils.encode_cell({ r: r, c: ci })] = c; });
    if (l.length > maxC) maxC = l.length;
  });
  ws["!ref"] = "A1:" + letra(Math.max(0, maxC - 1)) + Math.max(1, linhas.length);
  return ws;
}

/** Monta o livro (a tela chama XLSX.writeFile(wb, nome)). */
export function montarPlanilha(XLSX: any, d: DadosDoArquivo): any {
  var p = abaProdutos(d);
  var ws = folha(XLSX, p.linhas);
  var ultimaCol = letra(d.cabecalho.length - 1);
  ws["!autofilter"] = { ref: "A" + (p.inicioDaTabela + 1) + ":" + ultimaCol + (p.fimDaTabela + 1) };
  ws["!cols"] = [{ wch: 40 }].concat(d.colunas.map(function() { return { wch: 16 }; }));
  var wf = folha(XLSX, abaFiltros(d));
  wf["!cols"] = [{ wch: 24 }, { wch: 60 }];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.utils.book_append_sheet(wb, wf, "Filtros");
  return wb;
}
