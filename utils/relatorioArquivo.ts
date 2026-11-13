// ============================================================
// AURA. — Financeiro › Relatórios › Produtos: os arquivos (p-116, 13/11/2026)
//
// Regras puras do PDF e da planilha (sem React, sem jspdf, sem xlsx: o jest
// carrega direto). Os dois arquivos levam TODAS as linhas do filtro (a tela
// pede a mesma rota com todas=1, até 5.000), nas colunas da tela e na ordem
// da tela. Quem não vê custo não recebe colunas de custo e o cabeçalho não
// cita filtros de custo.
// ============================================================
import {
  COLUNAS, MODELOS, celula, sugestaoDeCompra, parametrosDaQuery, colunasVisiveis, ordemEfetiva,
  abaixoDeEstoqueMax, modoEstoque, modoVendas, modoCusto,
  type ColunaId, type Tom, type EstadoRelatorio, type LinhaRelatorio, type RespostaRelatorio, type TotaisRelatorio,
} from "@/utils/relatorioProdutos";

export var TETO_DO_ARQUIVO = 5000;
export var AVISO_TRUNCADO = "Mostrando as primeiras 5.000 linhas";
export var RODAPE_LEGAL = "Documento gerado pela Aura. Não substitui documento fiscal.";
export var SITE = "getaura.com.br";

/** Query do arquivo: a da tela, sem página, com todas=1. */
export function queryDoArquivo(
  estado: EstadoRelatorio,
  opts: { de: string; ate: string; consolidado: boolean; podeVerCusto: boolean },
): [string, string][] {
  return parametrosDaQuery(estado, opts)
    .filter(function(p) { return p[0] !== "limit" && p[0] !== "offset"; })
    .concat([["todas", "1"]]);
}

export function nomeDoModelo(estado: EstadoRelatorio): string {
  return estado.escolha === "personalizado" ? "Personalizado" : MODELOS[estado.escolha].rotulo;
}

/** relatorio-produtos-<modelo>-<AAAA-MM-DD>.pdf */
export function nomeDoArquivo(estado: EstadoRelatorio, hoje: string, ext: "pdf" | "xlsx"): string {
  var slug = String(estado.escolha).replace(/_/g, "-");
  return "relatorio-produtos-" + slug + "-" + hoje + "." + ext;
}

export function dataBR(iso: string): string {
  var a = String(iso || "").slice(0, 10).split("-");
  return a.length === 3 ? a[2] + "/" + a[1] + "/" + a[0] : "";
}

/** "13/11/2026, 14:32" em São Paulo. */
export function emitidoEm(agora: number = Date.now()): string {
  try {
    var p = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(agora));
    var g = function(t: string) { return (p.find(function(x) { return x.type === t; }) || { value: "" }).value; };
    return g("day") + "/" + g("month") + "/" + g("year") + ", " + g("hour") + ":" + g("minute");
  } catch (_) {
    var d = new Date(agora);
    return d.toLocaleDateString("pt-BR") + ", " + d.toTimeString().slice(0, 5);
  }
}

export function formatarCnpj(c: string | null | undefined): string {
  var d = String(c || "").replace(/\D/g, "");
  if (d.length !== 14) return String(c || "");
  return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12);
}

/** Filtros em linguagem de balcão. Sem os de custo para quem não vê custo. */
export function textoDosFiltros(
  estado: EstadoRelatorio,
  opts: { de: string; ate: string; podeVerCusto: boolean; nomeDaCategoria?: string | null },
): string[] {
  var f = estado.filtros;
  var out: string[] = [];
  out.push("Período: " + (opts.de === opts.ate ? dataBR(opts.de) : dataBR(opts.de) + " a " + dataBR(opts.ate)));
  var me = modoEstoque(f);
  if (me === "acabando") out.push("estoque acabando em até " + f.acaba_em_dias + (f.acaba_em_dias === 1 ? " dia" : " dias"));
  else if (me === "zerado") out.push("estoque zerado");
  else if (me === "abaixo" && f.estoque_max !== null) out.push("estoque abaixo de " + abaixoDeEstoqueMax(f.estoque_max) + " unidades");
  else if (f.com_estoque === true && modoVendas(f) !== "parado") out.push("com estoque");
  var mv = modoVendas(f);
  if (mv === "vendeu") out.push("vendeu no período");
  else if (mv === "parado") out.push("com estoque e sem vender há " + f.sem_vender_dias + " dias ou mais");
  if (opts.podeVerCusto) {
    var mc = modoCusto(f);
    if (mc === "com") out.push("com custo cadastrado");
    else if (mc === "sem") out.push("sem custo cadastrado");
    if (f.margem_max !== null) out.push("margem abaixo de " + String(f.margem_max).replace(".", ",") + "%");
  }
  if (f.categoria) out.push("categoria " + (opts.nomeDaCategoria || f.categoria));
  if (f.marca) out.push("marca " + f.marca);
  if (f.busca) out.push("busca \"" + f.busca + "\"");
  if (!f.so_ativos) out.push("inclui produtos inativos");
  out.push(estado.agrupar === "produto" ? "agrupado por produto" : "um tamanho por linha");
  var ordem = ordemEfetiva(estado, opts.podeVerCusto);
  var col = (Object.keys(COLUNAS) as ColunaId[]).find(function(c) { return COLUNAS[c].ordem === ordem; });
  var rotulo = ordem === "nome" ? "Produto" : col ? COLUNAS[col].rotulo : ordem;
  out.push("ordenado por " + rotulo + ", " + (estado.direcao === "desc" ? "maior primeiro" : "menor primeiro"));
  return out;
}

/** Colunas do arquivo: as da tela (sem custo para quem não vê; Loja no consolidado). */
export function colunasDoArquivo(estado: EstadoRelatorio, podeVerCusto: boolean, consolidado: boolean): ColunaId[] {
  return colunasVisiveis(estado, { podeVerCusto: podeVerCusto, consolidado: consolidado })
    .filter(function(c) { return podeVerCusto || !COLUNAS[c].custo; });
}

export type Formato = "texto" | "moeda" | "pct" | "qtd" | "inteiro";
export type ValorDoArquivo = { texto: string; numero: number | null; formato: Formato; tom?: Tom };

var FORMATO: Partial<Record<ColunaId, Formato>> = {
  estoque: "qtd", preco: "moeda", vendidos: "qtd", faturamento: "moeda", custo: "moeda", lucro: "moeda",
  margem: "pct", dias_sem_vender: "inteiro", media_diaria: "qtd", dias_ate_acabar: "inteiro", comprar: "inteiro",
  valor_parado: "moeda", valor_estoque_venda: "moeda",
};

/** Valor de uma célula para o arquivo: o texto da tela e, quando é número, o número. */
export function valorDoArquivo(linha: LinhaRelatorio, coluna: ColunaId, hoje: string): ValorDoArquivo {
  var cel = celula(linha, coluna, hoje);
  var formato = FORMATO[coluna] || "texto";
  var bruto: number | null = null;
  switch (coluna) {
    case "comprar": bruto = sugestaoDeCompra(linha); break;
    case "dias_ate_acabar":
      // "M em 6 dias" (agrupado) e "acabou" seguem como texto na planilha.
      bruto = linha.primeiro_a_acabar || linha.estoque <= 0 ? null : linha.dias_ate_acabar; break;
    case "ultima_venda": return { texto: linha.ultima_venda ? dataBR(linha.ultima_venda) : cel.texto, numero: null, formato: "texto", tom: cel.tom };
    case "codigo": case "categoria": case "loja": bruto = null; break;
    default: bruto = (linha as any)[coluna];
  }
  var numero = typeof bruto === "number" && Number.isFinite(bruto) ? bruto : null;
  return { texto: cel.texto, numero: formato === "texto" ? null : numero, formato: numero === null ? "texto" : formato, tom: cel.tom };
}

export function nomeDaLinha(linha: LinhaRelatorio): string {
  return linha.nome_exibicao || linha.nome;
}

/** Linha de total: as somas que fazem sentido, pelos totais da API (todo o filtro). */
export function totaisDoArquivo(cols: ColunaId[], totais: TotaisRelatorio, linhas: LinhaRelatorio[], podeVerCusto: boolean): ValorDoArquivo[] {
  var vazio: ValorDoArquivo = { texto: "", numero: null, formato: "texto" };
  var moeda = function(n: number | null): ValorDoArquivo { return n === null ? vazio : { texto: brlTexto(n), numero: n, formato: "moeda" }; };
  var qtd = function(n: number, f: Formato): ValorDoArquivo { return { texto: n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }), numero: n, formato: f }; };
  return cols.map(function(c) {
    switch (c) {
      case "estoque": return qtd(totais.estoque, "qtd");
      case "vendidos": return qtd(totais.vendidos, "qtd");
      case "faturamento": return moeda(totais.faturamento);
      case "lucro": return podeVerCusto ? moeda(totais.lucro) : vazio;
      case "margem": return podeVerCusto && totais.margem !== null ? { texto: totais.margem.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%", numero: totais.margem, formato: "pct" } : vazio;
      case "valor_parado": return podeVerCusto ? moeda(totais.valor_estoque_custo) : vazio;
      case "valor_estoque_venda": return moeda(totais.valor_estoque_venda);
      case "comprar": return qtd(linhas.reduce(function(a, l) { return a + sugestaoDeCompra(l); }, 0), "inteiro");
    }
    return vazio;
  });
}

function brlTexto(n: number): string {
  return "R$ " + (Math.round(n * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type Empresa = {
  razaoSocial: string;
  cnpj: string;
  loja: string;
  logoUrl: string | null;
};

export type DadosDoArquivo = {
  titulo: string;
  modelo: string;
  empresa: Empresa;
  emitidoEm: string;
  emitidoPor: string;
  filtros: string[];
  periodo: { de: string; ate: string };
  cabecalho: string[]; // "Produto" + colunas
  colunas: ColunaId[];
  linhas: { produto: string; valores: ValorDoArquivo[] }[];
  total: { rotulo: string; valores: ValorDoArquivo[] };
  totalDeLinhas: number;
  truncado: boolean;
  parametros: [string, string][];
};

/** Junta tudo o que o PDF e a planilha precisam a partir da resposta com todas=1. */
export function montarDadosDoArquivo(p: {
  estado: EstadoRelatorio;
  resposta: RespostaRelatorio;
  podeVerCusto: boolean;
  consolidado: boolean;
  empresa: Empresa;
  emitidoPor: string;
  agora?: number;
  nomeDaCategoria?: string | null;
}): DadosDoArquivo {
  var veCusto = p.podeVerCusto && p.resposta.pode_ver_custo !== false;
  var cols = colunasDoArquivo(p.estado, veCusto, p.consolidado);
  var hoje = p.resposta.periodo.hoje;
  var linhas = p.resposta.linhas.slice(0, TETO_DO_ARQUIVO);
  var modelo = nomeDoModelo(p.estado);
  var de = p.resposta.periodo.de;
  var ate = p.resposta.periodo.ate;
  return {
    titulo: "Relatório de Produtos · " + modelo,
    modelo: modelo,
    empresa: p.empresa,
    emitidoEm: emitidoEm(p.agora),
    emitidoPor: p.emitidoPor || "—",
    filtros: textoDosFiltros(p.estado, { de: de, ate: ate, podeVerCusto: veCusto, nomeDaCategoria: p.nomeDaCategoria }),
    periodo: { de: de, ate: ate },
    cabecalho: ["Produto"].concat(cols.map(function(c) { return COLUNAS[c].rotulo; })),
    colunas: cols,
    linhas: linhas.map(function(l) {
      return { produto: nomeDaLinha(l), valores: cols.map(function(c) { return valorDoArquivo(l, c, hoje); }) };
    }),
    total: { rotulo: "Total (" + p.resposta.total_linhas.toLocaleString("pt-BR") + ")", valores: totaisDoArquivo(cols, p.resposta.totais, linhas, veCusto) },
    totalDeLinhas: p.resposta.total_linhas,
    truncado: !!p.resposta.truncado,
    parametros: queryDoArquivo(p.estado, { de: de, ate: ate, consolidado: p.consolidado, podeVerCusto: veCusto })
      .filter(function(par) { return veCusto || (par[0] !== "sem_custo" && par[0] !== "margem_max"); }),
  };
}

// ── PDF: texto nas fontes padrão (WinAnsi) ──────────────────────────────
// As fontes padrão do jsPDF (Helvetica) cobrem o Latin-1: ç, ã, é, º, ·
// saem certos. O que fica fora (aspas curvas, travessão, seta) vira o
// equivalente simples, para não sair caractere trocado.
var TROCAS: Record<string, string> = {
  "‘": "'", "’": "'", "“": "\"", "”": "\"", "–": "-", "—": "-",
  "…": "...", "•": "·", "›": ">", "‹": "<", "▲": "", "▼": "", "→": ">", " ": " ",
  " ": " ",
};
export function paraWinAnsi(s: string): string {
  var out = "";
  for (var ch of String(s == null ? "" : s)) {
    if (TROCAS[ch] !== undefined) { out += TROCAS[ch]; continue; }
    var code = ch.codePointAt(0) || 0;
    out += code <= 0xff ? ch : "?";
  }
  return out;
}
