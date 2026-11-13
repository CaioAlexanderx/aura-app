// ============================================================
// AURA. — Financeiro › Relatórios › Produtos (p-115a, 13/11/2026)
//
// Regras puras da aba (sem React nem store: o jest carrega direto).
// Desenho aprovado: artifact XgRj3CtckE9qrEquqKK5qH (protótipo com PRE,
// COLS, resposta(), kpis(), cell()). Contrato da API: aura-backend
// src/services/relatorioProdutos.js (GET /companies/:id/relatorios/produtos).
//
// ── ESTADO ─────────────────────────────────────────────────────────────
// Um modelo pronto só PREENCHE filtros, colunas, ordem e agrupamento
// (MODELOS, abaixo). Mexer em qualquer um deles (ordenar pelo cabeçalho
// hoje; o painel "Ajustar o relatório" no p-115b) passa o chip para
// "Personalizado". O estado mora em `estadoReducer`; o p-115b só despacha
// as ações `filtro`, `colunas`, `alternarColuna` e `agrupar`.
//
// ── QUERY ──────────────────────────────────────────────────────────────
// A tela manda SEMPRE os filtros explícitos (nunca depende do padrão do
// backend) e o `modelo` só quando um chip está escolhido. Quem não vê custo
// nunca manda modelo, filtro nem ordem de custo (o backend responderia 403
// RELATORIO_SEM_CUSTO).
// ============================================================

// Chave de módulo PRÓPRIA da aba (regra 3 do CLAUDE.md): MODULE_PLAN_MAP e
// PERM_TO_MODULES em hooks/useVisibleModules.ts. Aba, não item de menu: não
// entra no NAV (como 'crediario.config').
export var MOD_RELATORIOS = "financeiro.relatorios";

// ── tipos da resposta ──────────────────────────────────────────────────
export type LinhaRelatorio = {
  chave: string;
  product_id: string;
  variant_id: string | null;
  nome: string;
  variante: string | null;
  nome_exibicao: string;
  sku: string | null;
  codigo_barras: string | null;
  categoria_id: string | null;
  categoria: string | null;
  marca: string | null;
  unidade: string | null;
  ativo: boolean;
  loja: { company_id: string; nome: string } | null;
  compartilhado: boolean;
  estoque: number;
  preco: number | null;
  custo: number | null;
  tem_custo: boolean | null;
  vendidos: number;
  faturamento: number;
  lucro: number | null;
  margem: number | null;
  ultima_venda: string | null;
  dias_sem_vender: number | null;
  media_diaria: number | null;
  dias_ate_acabar: number | null;
  valor_parado: number | null;
  valor_estoque_venda: number | null;
  variantes?: number;
  primeiro_a_acabar?: { variant_id: string; rotulo: string; dias: number } | null;
};

export type TotaisRelatorio = {
  itens: number;
  estoque: number;
  valor_estoque_custo: number | null;
  valor_estoque_venda: number;
  vendidos: number;
  faturamento: number;
  lucro: number | null;
  margem: number | null;
};

export type CoberturaCusto = {
  com_custo: number;
  sem_custo: number;
  percentual: number | null;
  faturamento_sem_custo: number;
};

export type RespostaRelatorio = {
  linhas: LinhaRelatorio[];
  total_linhas: number;
  truncado: boolean;
  totais: TotaisRelatorio;
  cobertura_custo: CoberturaCusto | null;
  periodo: { de: string; ate: string; dias: number; hoje: string };
  modelo: ModeloId | null;
  agrupar: Agrupar;
  escopo: "loja" | "grupo";
  empresas: string[];
  ordem: OrdemApi;
  direcao: Direcao;
  filtros: Record<string, unknown>;
  paginacao: { limit: number; offset: number; todas: boolean };
  pode_ver_custo: boolean;
};

// ── modelos, colunas e ordens ──────────────────────────────────────────
export type ModeloId =
  | "estoque_acabando" | "mais_vendidos" | "parados_30" | "mais_lucrativos"
  | "margem_baixa" | "estoque_zerado" | "sem_custo";
export type Escolha = ModeloId | "personalizado";
export type Agrupar = "item" | "produto";
export type Direcao = "asc" | "desc";
export type OrdemApi =
  | "nome" | "estoque" | "preco" | "custo" | "vendidos" | "faturamento" | "lucro" | "margem"
  | "ultima_venda" | "dias_sem_vender" | "media_diaria" | "dias_ate_acabar" | "valor_parado" | "valor_estoque_venda";

export type ColunaId =
  | "codigo" | "categoria" | "loja" | "estoque" | "preco" | "vendidos" | "faturamento"
  | "custo" | "lucro" | "margem" | "ultima_venda" | "dias_sem_vender" | "media_diaria"
  | "dias_ate_acabar" | "comprar" | "valor_parado" | "valor_estoque_venda";

export type FiltrosRelatorio = {
  categoria: string | null;
  marca: string | null;
  busca: string | null;
  so_ativos: boolean;
  estoque_min: number | null;
  estoque_max: number | null;
  com_estoque: boolean | null;
  vendeu: boolean | null;
  sem_custo: boolean | null;
  margem_max: number | null;
  sem_vender_dias: number | null;
  acaba_em_dias: number | null;
};

export var FILTROS_VAZIOS: FiltrosRelatorio = {
  categoria: null, marca: null, busca: null, so_ativos: true,
  estoque_min: null, estoque_max: null, com_estoque: null, vendeu: null,
  sem_custo: null, margem_max: null, sem_vender_dias: null, acaba_em_dias: null,
};

export var COLUNAS: Record<ColunaId, { rotulo: string; ordem: OrdemApi | null; custo: boolean }> = {
  codigo: { rotulo: "Código", ordem: null, custo: false },
  categoria: { rotulo: "Categoria", ordem: null, custo: false },
  loja: { rotulo: "Loja", ordem: null, custo: false },
  estoque: { rotulo: "Estoque", ordem: "estoque", custo: false },
  preco: { rotulo: "Preço", ordem: "preco", custo: false },
  vendidos: { rotulo: "Vendidos", ordem: "vendidos", custo: false },
  faturamento: { rotulo: "Faturamento", ordem: "faturamento", custo: false },
  custo: { rotulo: "Custo", ordem: "custo", custo: true },
  lucro: { rotulo: "Lucro", ordem: "lucro", custo: true },
  margem: { rotulo: "Margem", ordem: "margem", custo: true },
  ultima_venda: { rotulo: "Última venda", ordem: "ultima_venda", custo: false },
  dias_sem_vender: { rotulo: "Dias parado", ordem: "dias_sem_vender", custo: false },
  media_diaria: { rotulo: "Venda por dia", ordem: "media_diaria", custo: false },
  dias_ate_acabar: { rotulo: "Dias até acabar", ordem: "dias_ate_acabar", custo: false },
  comprar: { rotulo: "Comprar", ordem: null, custo: false },
  valor_parado: { rotulo: "Parado a custo", ordem: "valor_parado", custo: true },
  valor_estoque_venda: { rotulo: "Estoque a preço de venda", ordem: "valor_estoque_venda", custo: false },
};

export var ORDENS_DE_CUSTO: OrdemApi[] = ["custo", "lucro", "margem", "valor_parado"];

export type DefinicaoModelo = {
  rotulo: string;
  custo: boolean; // só existe para quem vê custo
  agrupar: Agrupar;
  filtros: Partial<FiltrosRelatorio>;
  colunas: ColunaId[];
  ordem: OrdemApi;
  direcao: Direcao;
  // quem não vê custo: ordem quando a do modelo é de custo
  ordemSemCusto?: OrdemApi;
};

// Ordem dos chips = ordem do desenho. Filtros e colunas do protótipo; o
// agrupamento é o do backend (MODELOS em services/relatorioProdutos.js).
export var MODELOS: Record<ModeloId, DefinicaoModelo> = {
  estoque_acabando: {
    rotulo: "Estoque acabando", custo: false, agrupar: "item",
    filtros: { com_estoque: true, acaba_em_dias: 15 },
    colunas: ["estoque", "dias_ate_acabar", "comprar"], ordem: "dias_ate_acabar", direcao: "asc",
  },
  mais_vendidos: {
    rotulo: "Mais vendidos", custo: false, agrupar: "produto",
    filtros: { vendeu: true },
    colunas: ["estoque", "vendidos", "faturamento"], ordem: "vendidos", direcao: "desc",
  },
  parados_30: {
    rotulo: "Parados há 30 dias", custo: false, agrupar: "item",
    filtros: { com_estoque: true, sem_vender_dias: 30 },
    colunas: ["estoque", "ultima_venda", "dias_sem_vender", "valor_parado"], ordem: "valor_parado", direcao: "desc",
    ordemSemCusto: "dias_sem_vender",
  },
  mais_lucrativos: {
    rotulo: "Mais lucrativos", custo: true, agrupar: "produto",
    filtros: { vendeu: true, sem_custo: false },
    colunas: ["vendidos", "faturamento", "lucro", "margem"], ordem: "lucro", direcao: "desc",
  },
  margem_baixa: {
    rotulo: "Margem baixa", custo: true, agrupar: "produto",
    filtros: { vendeu: true, sem_custo: false, margem_max: 30 },
    colunas: ["vendidos", "faturamento", "custo", "margem"], ordem: "margem", direcao: "asc",
  },
  estoque_zerado: {
    rotulo: "Estoque zerado", custo: false, agrupar: "item",
    filtros: { com_estoque: false },
    colunas: ["vendidos", "ultima_venda", "dias_ate_acabar"], ordem: "vendidos", direcao: "desc",
  },
  sem_custo: {
    rotulo: "Sem custo", custo: true, agrupar: "produto",
    filtros: { sem_custo: true },
    colunas: ["estoque", "vendidos", "faturamento"], ordem: "vendidos", direcao: "desc",
  },
};

export var ORDEM_DOS_MODELOS = Object.keys(MODELOS) as ModeloId[];
export var MODELO_INICIAL: ModeloId = "mais_vendidos";

/** Modelos que a pessoa pode escolher. `semCusto` = lista do backend (403) ou dos modelos marcados. */
export function modelosVisiveis(podeVerCusto: boolean, modelosSemCusto?: readonly string[] | null): ModeloId[] {
  if (podeVerCusto) return ORDEM_DOS_MODELOS.slice();
  var fora = modelosSemCusto && modelosSemCusto.length ? modelosSemCusto : ORDEM_DOS_MODELOS.filter(function(m) { return MODELOS[m].custo; });
  return ORDEM_DOS_MODELOS.filter(function(m) { return fora.indexOf(m) < 0 && !MODELOS[m].custo; });
}

// ── estado e reducer (o p-115b pluga o painel aqui) ─────────────────────
export type EstadoRelatorio = {
  escolha: Escolha;
  agrupar: Agrupar;
  filtros: FiltrosRelatorio;
  colunas: ColunaId[];
  ordem: OrdemApi;
  direcao: Direcao;
};

export type AcaoRelatorio =
  | { type: "modelo"; modelo: ModeloId }
  | { type: "personalizado" }
  | { type: "filtro"; campo: keyof FiltrosRelatorio; valor: FiltrosRelatorio[keyof FiltrosRelatorio] }
  | { type: "colunas"; colunas: ColunaId[] }
  | { type: "alternarColuna"; coluna: ColunaId }
  | { type: "ordenar"; ordem: OrdemApi }
  | { type: "agrupar"; agrupar: Agrupar };

export function estadoDoModelo(modelo: ModeloId): EstadoRelatorio {
  var m = MODELOS[modelo];
  return {
    escolha: modelo,
    agrupar: m.agrupar,
    filtros: Object.assign({}, FILTROS_VAZIOS, m.filtros),
    colunas: m.colunas.slice(),
    ordem: m.ordem,
    direcao: m.direcao,
  };
}

export function estadoInicial(): EstadoRelatorio {
  return estadoDoModelo(MODELO_INICIAL);
}

export function estadoReducer(estado: EstadoRelatorio, acao: AcaoRelatorio): EstadoRelatorio {
  switch (acao.type) {
    case "modelo":
      return estadoDoModelo(acao.modelo);
    case "personalizado":
      return estado.escolha === "personalizado" ? estado : Object.assign({}, estado, { escolha: "personalizado" as Escolha });
    case "filtro": {
      var filtros = Object.assign({}, estado.filtros);
      (filtros as any)[acao.campo] = acao.valor;
      return Object.assign({}, estado, { filtros: filtros, escolha: "personalizado" as Escolha });
    }
    case "colunas":
      return Object.assign({}, estado, { colunas: acao.colunas.slice(), escolha: "personalizado" as Escolha });
    case "alternarColuna": {
      var tem = estado.colunas.indexOf(acao.coluna) >= 0;
      if (tem && estado.colunas.length <= 1) return estado; // sempre fica ao menos uma
      var colunas = tem ? estado.colunas.filter(function(c) { return c !== acao.coluna; }) : estado.colunas.concat([acao.coluna]);
      return Object.assign({}, estado, { colunas: colunas, escolha: "personalizado" as Escolha });
    }
    case "ordenar": {
      var direcao: Direcao = estado.ordem === acao.ordem
        ? (estado.direcao === "asc" ? "desc" : "asc")
        : (acao.ordem === "nome" ? "asc" : "desc");
      return Object.assign({}, estado, { ordem: acao.ordem, direcao: direcao, escolha: "personalizado" as Escolha });
    }
    case "agrupar":
      return Object.assign({}, estado, { agrupar: acao.agrupar, escolha: "personalizado" as Escolha });
  }
  return estado;
}

/** Colunas que a tabela mostra: sem custo para quem não vê; Loja na frente no consolidado. */
export function colunasVisiveis(estado: EstadoRelatorio, opts: { podeVerCusto: boolean; consolidado: boolean }): ColunaId[] {
  var cols = estado.colunas.filter(function(c) { return opts.podeVerCusto || !COLUNAS[c].custo; });
  cols = cols.filter(function(c) { return c !== "loja"; });
  if (opts.consolidado) cols.unshift("loja");
  return cols;
}

/** Ordem efetivamente pedida (quem não vê custo nunca ordena por custo). */
export function ordemEfetiva(estado: EstadoRelatorio, podeVerCusto: boolean): OrdemApi {
  if (podeVerCusto || ORDENS_DE_CUSTO.indexOf(estado.ordem) < 0) return estado.ordem;
  if (estado.escolha !== "personalizado" && MODELOS[estado.escolha].ordemSemCusto) return MODELOS[estado.escolha].ordemSemCusto as OrdemApi;
  return "nome";
}

// ── período ────────────────────────────────────────────────────────────
export type PeriodoRelatorio = "hoje" | "semana" | "mes" | "ano" | "personalizado";
export var PERIODOS: { key: PeriodoRelatorio; rotulo: string }[] = [
  { key: "hoje", rotulo: "Hoje" },
  { key: "semana", rotulo: "Semana" },
  { key: "mes", rotulo: "Mês" },
  { key: "ano", rotulo: "Ano" },
  { key: "personalizado", rotulo: "Personalizado" },
];
export var PERIODO_INICIAL: PeriodoRelatorio = "semana";
export var PERIODO_MAX_DIAS = 366;

/** Hoje em São Paulo (AAAA-MM-DD): o backend recusa `ate` depois do hoje dele. */
export function hojeSP(agora: number = Date.now()): string {
  try {
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(agora));
    var get = function(t: string) { return (p.find(function(x) { return x.type === t; }) || { value: "" }).value; };
    var s = get("year") + "-" + get("month") + "-" + get("day");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  } catch (_) { /* cai no relógio local */ }
  var d = new Date(agora);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function paraUTC(ymd: string): number { var a = ymd.split("-").map(Number); return Date.UTC(a[0], a[1] - 1, a[2]); }
export function somaDias(ymd: string, n: number): string { return new Date(paraUTC(ymd) + n * 86400000).toISOString().slice(0, 10); }
export function diasEntre(de: string, ate: string): number { return Math.round((paraUTC(ate) - paraUTC(de)) / 86400000); }

export type FaixaDoPeriodo = { de: string; ate: string } | { erro: string } | { incompleto: true };

/**
 * Datas que vão para a API. Semana = os últimos 7 dias; Mês e Ano = do dia 1
 * (de janeiro) até hoje, como no resto do Financeiro, mas sem passar de hoje.
 */
export function faixaDoPeriodo(p: PeriodoRelatorio, hoje: string, de?: string | null, ate?: string | null): FaixaDoPeriodo {
  switch (p) {
    case "hoje": return { de: hoje, ate: hoje };
    case "semana": return { de: somaDias(hoje, -6), ate: hoje };
    case "mes": return { de: hoje.slice(0, 8) + "01", ate: hoje };
    case "ano": return { de: hoje.slice(0, 5) + "01-01", ate: hoje };
    case "personalizado": {
      if (!de || !ate) return { incompleto: true };
      if (de > ate) return { erro: "A data inicial precisa vir antes da data final." };
      if (ate > hoje) return { erro: "A data final não pode passar de hoje." };
      if (diasEntre(de, ate) + 1 > PERIODO_MAX_DIAS) return { erro: "Escolha um período de até 1 ano." };
      return { de: de, ate: ate };
    }
  }
  return { incompleto: true };
}

export function frasePeriodo(p: PeriodoRelatorio): string {
  return p === "hoje" ? "hoje" : p === "semana" ? "na semana" : p === "mes" ? "no mês" : p === "ano" ? "no ano" : "no período";
}

// ── query ──────────────────────────────────────────────────────────────
export var LIMITE_PAGINA = 50;
// "Estoque acabando" soma o Comprar de todas as linhas: página maior para a
// soma cobrir a lista inteira na quase totalidade das lojas.
export var LIMITE_PAGINA_ACABANDO = 200;

export function limiteDaPagina(estado: EstadoRelatorio): number {
  return estado.escolha === "estoque_acabando" ? LIMITE_PAGINA_ACABANDO : LIMITE_PAGINA;
}

function bool(v: boolean): string { return v ? "1" : "0"; }

/** Parâmetros da query (em ordem estável, para a chave do cache). */
export function parametrosDaQuery(
  estado: EstadoRelatorio,
  opts: { de: string; ate: string; consolidado: boolean; podeVerCusto: boolean; offset?: number; limit?: number },
): [string, string][] {
  var out: [string, string][] = [];
  var custoOk = opts.podeVerCusto;
  if (estado.escolha !== "personalizado" && (custoOk || !MODELOS[estado.escolha].custo)) out.push(["modelo", estado.escolha]);
  out.push(["de", opts.de], ["ate", opts.ate]);
  out.push(["agrupar", estado.agrupar]);
  var f = estado.filtros;
  if (f.categoria) out.push(["categoria", f.categoria]);
  if (f.marca) out.push(["marca", f.marca]);
  if (f.busca) out.push(["busca", f.busca]);
  out.push(["so_ativos", bool(f.so_ativos)]);
  if (f.estoque_min !== null) out.push(["estoque_min", String(f.estoque_min)]);
  if (f.estoque_max !== null) out.push(["estoque_max", String(f.estoque_max)]);
  if (f.com_estoque !== null) out.push(["com_estoque", bool(f.com_estoque)]);
  if (f.vendeu !== null) out.push(["vendeu", bool(f.vendeu)]);
  if (custoOk && f.sem_custo !== null) out.push(["sem_custo", bool(f.sem_custo)]);
  if (custoOk && f.margem_max !== null) out.push(["margem_max", String(f.margem_max)]);
  if (f.sem_vender_dias !== null) out.push(["sem_vender_dias", String(f.sem_vender_dias)]);
  if (f.acaba_em_dias !== null) out.push(["acaba_em_dias", String(f.acaba_em_dias)]);
  out.push(["ordem", ordemEfetiva(estado, custoOk)], ["direcao", estado.direcao]);
  out.push(["limit", String(opts.limit || limiteDaPagina(estado))], ["offset", String(opts.offset || 0)]);
  out.push(["escopo", opts.consolidado ? "grupo" : "loja"]);
  return out;
}

export function queryString(pares: [string, string][]): string {
  return pares.map(function(p) { return encodeURIComponent(p[0]) + "=" + encodeURIComponent(p[1]); }).join("&");
}

// ── conta do app ───────────────────────────────────────────────────────
/** Comprar = o que repõe 30 dias de venda, com folga de 20%. */
export function sugestaoDeCompra(linha: Pick<LinhaRelatorio, "media_diaria" | "estoque">): number {
  var media = Number(linha.media_diaria) || 0;
  if (media <= 0) return 0;
  var estoque = Number(linha.estoque) || 0;
  return Math.max(0, Math.ceil(media * 30 * 1.2 - estoque));
}

// ── formatação ─────────────────────────────────────────────────────────
export function brl(n: number | null | undefined): string {
  var v = Math.round((Number(n) || 0) * 100) / 100;
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function qtd(n: number | null | undefined): string {
  var v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
function pct(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}
function dataCurta(iso: string, hoje: string): string {
  var a = String(iso).slice(0, 10).split("-");
  if (a.length < 3) return "";
  return a[2] + "/" + a[1] + (a[0] !== hoje.slice(0, 4) ? "/" + a[0].slice(2) : "");
}

export type Tom = "normal" | "apagado" | "vermelho" | "ambar";
export type Celula = { texto: string; tom: Tom };

export var MARGEM_DE_ALERTA = 30;

export function celula(linha: LinhaRelatorio, coluna: ColunaId, hoje: string): Celula {
  var c = function(texto: string, tom?: Tom): Celula { return { texto: texto, tom: tom || "normal" }; };
  var semCusto = c("sem custo", "apagado");
  switch (coluna) {
    case "codigo": return linha.sku || linha.codigo_barras ? c(String(linha.sku || linha.codigo_barras)) : c("—", "apagado");
    case "categoria": return linha.categoria ? c(linha.categoria) : c("—", "apagado");
    case "loja": return c(linha.compartilhado ? "Compartilhado" : (linha.loja && linha.loja.nome) || "—", linha.loja ? "normal" : "apagado");
    case "estoque": return c(qtd(linha.estoque), linha.estoque <= 0 ? "vermelho" : "normal");
    case "preco": return linha.preco === null ? c("—", "apagado") : c(brl(linha.preco));
    case "vendidos": return c(qtd(linha.vendidos));
    case "faturamento": return c(brl(linha.faturamento));
    case "custo": return linha.custo === null ? semCusto : c(brl(linha.custo));
    case "lucro": return linha.lucro === null ? semCusto : c(brl(linha.lucro));
    case "margem": return linha.margem === null ? semCusto : c(pct(linha.margem), linha.margem < MARGEM_DE_ALERTA ? "ambar" : "normal");
    case "ultima_venda":
      // null = não vendeu no último ano (o backend só olha 1 ano para trás)
      if (!linha.ultima_venda) return c("sem venda em 1 ano", "apagado");
      return c(linha.dias_sem_vender === 0 ? "hoje" : dataCurta(linha.ultima_venda, hoje));
    case "dias_sem_vender": return linha.dias_sem_vender === null ? c("mais de 1 ano", "apagado") : c(linha.dias_sem_vender + " d");
    case "media_diaria": return linha.media_diaria === null ? c("sem giro", "apagado") : c(qtd(linha.media_diaria) + "/dia");
    case "dias_ate_acabar": {
      var d = linha.dias_ate_acabar;
      if (linha.estoque <= 0) return c("acabou", "vermelho");
      if (d === null) return c("sem giro", "apagado");
      return c(d + " d", d <= 7 ? "vermelho" : d <= 15 ? "ambar" : "normal");
    }
    case "comprar": { var s = sugestaoDeCompra(linha); return s > 0 ? c(qtd(s) + " un") : c("—", "apagado"); }
    case "valor_parado": return linha.valor_parado === null ? semCusto : c(brl(linha.valor_parado));
    case "valor_estoque_venda": return linha.valor_estoque_venda === null ? c("—", "apagado") : c(brl(linha.valor_estoque_venda));
  }
  return c("");
}

/** Colunas do cartão no celular: a da ordem primeiro, depois as outras, até 3. */
export function colunasDoCartao(cols: ColunaId[], ordem: OrdemApi): ColunaId[] {
  var daOrdem = cols.filter(function(c) { return COLUNAS[c].ordem === ordem; });
  var resto = cols.filter(function(c) { return COLUNAS[c].ordem !== ordem && c !== "codigo"; });
  return daOrdem.concat(resto).slice(0, 3);
}

// ── frase-resposta e KPIs ──────────────────────────────────────────────
export type ContextoDaResposta = {
  escolha: Escolha;
  periodo: PeriodoRelatorio;
  linhas: LinhaRelatorio[]; // as que já vieram (na ordem do relatório)
  total: number;
  totais: TotaisRelatorio | null;
  cobertura: CoberturaCusto | null;
  filtros: FiltrosRelatorio;
  podeVerCusto: boolean;
};

export type Frase = { partes: { t: string; b?: boolean }[]; sub: string };

function nomes(linhas: LinhaRelatorio[]): { t: string; b?: boolean }[] {
  var top = linhas.slice(0, 3).map(function(l) { return l.nome_exibicao || l.nome; });
  var out: { t: string; b?: boolean }[] = [];
  top.forEach(function(n, i) {
    if (i > 0) out.push({ t: i === top.length - 1 ? " e " : ", " });
    out.push({ t: n, b: true });
  });
  return out;
}

function somaComprar(linhas: LinhaRelatorio[]): number {
  return linhas.reduce(function(a, l) { return a + sugestaoDeCompra(l); }, 0);
}

/** Texto plano da frase (testes, leitores de tela). */
export function textoDaFrase(f: Frase): string {
  return f.partes.map(function(p) { return p.t; }).join("");
}

export function fraseResposta(ctx: ContextoDaResposta): Frase {
  var n = ctx.total;
  var um = n === 1;
  var p = frasePeriodo(ctx.periodo);
  if (n === 0) return { partes: [{ t: "Nenhum produto encontrado com esses filtros." }], sub: "Tente afrouxar um filtro." };
  var qtdProdutos = um ? "1 produto" : n.toLocaleString("pt-BR") + " produtos";
  var completas = ctx.linhas.length >= n;
  switch (ctx.escolha) {
    case "estoque_acabando": {
      var dias = ctx.filtros.acaba_em_dias === null ? 30 : ctx.filtros.acaba_em_dias;
      var comprar = somaComprar(ctx.linhas);
      var partes = [
        { t: qtdProdutos + (um ? " deve" : " devem"), b: true }, { t: " acabar em até " },
        { t: dias + (dias === 1 ? " dia" : " dias"), b: true }, { t: "." },
      ];
      if (comprar > 0) {
        partes.push({ t: " Comprar " }, { t: qtd(comprar) + (comprar === 1 ? " unidade" : " unidades"), b: true });
        partes.push({ t: completas ? " repõe 30 dias, com folga de 20%." : " repõe 30 dias dos " + ctx.linhas.length + " primeiros, com folga de 20%." });
      }
      return { partes: partes, sub: "Pelo ritmo de venda " + p + ". Produto sem venda " + p + " não entra." };
    }
    case "mais_vendidos": {
      var t = ctx.totais;
      return {
        partes: [{ t: (um ? "O que mais saiu " : "Os que mais saíram ") + p + ": " }].concat(nomes(ctx.linhas)).concat([{ t: "." }]),
        sub: "Ao todo, " + qtd(t ? t.vendidos : 0) + " unidades de " + qtdProdutos + ".",
      };
    }
    case "parados_30": {
      var d30 = ctx.filtros.sem_vender_dias === null ? 30 : ctx.filtros.sem_vender_dias;
      var pp = [
        { t: qtdProdutos + (um ? " está" : " estão"), b: true }, { t: " sem vender há " },
        { t: d30 + " dias ou mais", b: true },
      ];
      var parado = ctx.totais ? ctx.totais.valor_estoque_custo : null;
      if (ctx.podeVerCusto && parado !== null) pp.push({ t: ", com " }, { t: brl(parado), b: true }, { t: " parados a custo." });
      else pp.push({ t: "." });
      var sc = ctx.cobertura ? ctx.cobertura.sem_custo : 0;
      return {
        partes: pp,
        sub: ctx.podeVerCusto && sc > 0
          ? (sc === 1 ? "1 sem custo cadastrado ficou fora dessa soma." : sc + " sem custo cadastrado ficaram fora dessa soma.")
          : "Produtos com estoque que não venderam desde então, ou nunca venderam.",
      };
    }
    case "mais_lucrativos":
      return {
        partes: [{ t: (um ? "O que mais deu lucro " : "Os que mais deram lucro ") + p + ": " }].concat(nomes(ctx.linhas)).concat([{ t: "." }]),
        sub: "Lucro é o preço de venda menos o custo cadastrado. Só entram itens com custo.",
      };
    case "margem_baixa": {
      var m = ctx.filtros.margem_max === null ? MARGEM_DE_ALERTA : ctx.filtros.margem_max;
      return {
        partes: [{ t: qtdProdutos + (um ? " vende e deixa" : " vendem e deixam"), b: true }, { t: " " }, { t: "menos de " + m + "%", b: true }, { t: " de margem." }],
        sub: "Vale rever o preço ou o custo desses itens.",
      };
    }
    case "estoque_zerado":
      return { partes: [{ t: qtdProdutos + (um ? " está" : " estão"), b: true }, { t: " com estoque zerado." }], sub: "Ordenados pelos que mais vendiam." };
    case "sem_custo":
      return { partes: [{ t: qtdProdutos + (um ? " não tem" : " não têm"), b: true }, { t: " custo cadastrado." }], sub: "Sem o custo, o lucro e a margem desses itens não aparecem." };
  }
  return { partes: [{ t: qtdProdutos, b: true }, { t: " com esses filtros." }], sub: "Relatório personalizado." };
}

export type Kpi = { rotulo: string; valor: string };

export function kpisDoModelo(ctx: ContextoDaResposta): Kpi[] {
  var t = ctx.totais;
  var k: Kpi[] = [{ rotulo: "Produtos", valor: ctx.total.toLocaleString("pt-BR") }];
  if (!t) return k;
  switch (ctx.escolha) {
    case "estoque_acabando": {
      var menor: number | null = null;
      ctx.linhas.forEach(function(l) { if (l.dias_ate_acabar !== null && (menor === null || l.dias_ate_acabar < menor)) menor = l.dias_ate_acabar; });
      k.push({ rotulo: "Unidades a comprar", valor: qtd(somaComprar(ctx.linhas)) });
      k.push({ rotulo: "Mais urgente", valor: menor === null ? "—" : menor === 1 ? "1 dia" : menor + " dias" });
      return k;
    }
    case "parados_30":
      k.push({ rotulo: "Unidades paradas", valor: qtd(t.estoque) });
      if (ctx.podeVerCusto && t.valor_estoque_custo !== null) k.push({ rotulo: "Parado a custo", valor: brl(t.valor_estoque_custo) });
      else k.push({ rotulo: "Parado a preço de venda", valor: brl(t.valor_estoque_venda) });
      return k;
    case "mais_vendidos":
      k.push({ rotulo: "Unidades vendidas", valor: qtd(t.vendidos) }, { rotulo: "Faturamento", valor: brl(t.faturamento) });
      return k;
    case "mais_lucrativos":
    case "margem_baixa":
      k.push({ rotulo: "Faturamento", valor: brl(t.faturamento) });
      k.push({ rotulo: "Lucro", valor: t.lucro === null ? "—" : brl(t.lucro) });
      return k;
  }
  k.push({ rotulo: "Unidades em estoque", valor: qtd(t.estoque) }, { rotulo: "Faturamento", valor: brl(t.faturamento) });
  return k;
}

/** Aviso de cobertura: só com coluna de custo na tela e item sem custo. */
export function avisoDeCobertura(cols: ColunaId[], cobertura: CoberturaCusto | null, total: number, podeVerCusto: boolean): string | null {
  if (!podeVerCusto || !cobertura || cobertura.sem_custo <= 0) return null;
  if (!cols.some(function(c) { return COLUNAS[c].custo; })) return null;
  var de = cobertura.sem_custo + " de " + total.toLocaleString("pt-BR");
  return de + (total === 1 ? " produto não tem" : cobertura.sem_custo === 1 ? " produtos não tem" : " produtos não têm")
    + " custo cadastrado e " + (cobertura.sem_custo === 1 ? "fica" : "ficam") + " fora das contas de custo, lucro e valor parado.";
}
