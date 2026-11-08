// Aba Receitas: os quatro cartões (Faturamento, Custos, Lucro bruto, Despesas).
// Contrato da rota em Aura-backend src/routes/resultadoDoPeriodo.js (p-81).
// Regras de texto e de cor puras aqui, para o teste não carregar a store.

export type ResultadoNumeros = {
  faturamento: number;
  custos: number;
  lucro_bruto: number | null;
  margem_pct: number | null;
  receita_com_custo: number;
  despesas: number;
  compras_pagas: { total: number; lancamentos: number };
};

export type ProdutoSemCusto = { product_id: string | null; nome: string; receita: number; quantidade: number };

export type ResultadoDoPeriodo = ResultadoNumeros & {
  periodo: { de: string; ate: string };
  consolidado: boolean;
  empresas: number;
  vendas: number;
  vendas_qtd: number;
  trocas: { entrou: number; devolvido: number };
  cobertura: {
    pct: number | null;
    receita_sem_custo: number;
    itens: number;
    itens_com_custo: number;
    produtos_sem_custo: number;
    lojas_com_pouco_custo?: number;
    lojas_com_venda?: number;
  };
  produtos_sem_custo: ProdutoSemCusto[];
  por_empresa?: (ResultadoNumeros & { company_id: string; nome: string })[];
  anterior: (ResultadoNumeros & { periodo: { de: string; ate: string } }) | null;
};

/** Pedaço do texto que diz de quando é o número ("neste mês"). */
export var FRASE_DO_PERIODO: Record<string, string> = {
  today: "hoje",
  week: "nesta semana",
  month: "neste mês",
  year: "neste ano",
  prev_year: "no ano passado",
  all: "em todo o histórico",
  custom: "no período escolhido",
};

/** "sobre o mês passado" etc.: com o que a variação compara. */
var COMPARA_COM: Record<string, string> = {
  today: "sobre ontem",
  week: "sobre a semana anterior",
  month: "sobre o mês passado",
  year: "sobre o ano passado",
  prev_year: "sobre o ano retrasado",
  custom: "sobre o período anterior",
};

export type Variacao = { texto: string; tom: "bom" | "ruim" | "neutro" } | null;

/**
 * Variação contra o período anterior. `subirEhRuim`: custo e despesa que
 * sobem ficam em vermelho; faturamento e lucro que sobem, em verde.
 * Sem base (anterior ausente ou zero) não há variação: nada aparece.
 */
export function variacao(atual: number | null, anterior: number | null | undefined, subirEhRuim: boolean, period: string): Variacao {
  if (atual == null || anterior == null || !(Math.abs(anterior) > 0)) return null;
  var p = Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
  if (p === 0) return { texto: "igual ao período anterior", tom: "neutro" };
  var subiu = p > 0;
  var ruim = subiu === subirEhRuim;
  return {
    texto: (subiu ? "▲ " : "▼ ") + Math.abs(p) + "% " + (COMPARA_COM[period] || "sobre o período anterior"),
    tom: ruim ? "ruim" : "bom",
  };
}

export type Cobertura = { tipo: "nenhum" | "parcial" | "completo" | "sem_venda"; titulo: string; detalhe: string };

export function textoDaCobertura(r: ResultadoDoPeriodo, period: string): Cobertura {
  var quando = FRASE_DO_PERIODO[period] || "no período";
  var c = r.cobertura;
  if (c.pct == null || r.vendas <= 0) {
    return { tipo: "sem_venda", titulo: "Ainda não há venda " + quando + ".", detalhe: "Quando vender, o lucro bruto aparece aqui." };
  }
  if (r.lucro_bruto == null || c.pct === 0) {
    return {
      tipo: "nenhum",
      titulo: "Nenhum produto vendido " + quando + " tem custo cadastrado.",
      detalhe: "Com o custo, o lucro bruto e a margem aparecem sozinhos.",
    };
  }
  if (c.pct >= 100 || c.produtos_sem_custo === 0) {
    return { tipo: "completo", titulo: "Todas as vendas " + quando + " têm custo cadastrado.", detalhe: "O lucro bruto está completo." };
  }
  var fora = 100 - c.pct;
  var produtos = c.produtos_sem_custo === 1 ? "1 produto vendido não tem custo" : c.produtos_sem_custo + " produtos vendidos não têm custo";
  var lojas = "";
  if (r.consolidado && c.lojas_com_pouco_custo && c.lojas_com_venda) {
    lojas = " Em " + c.lojas_com_pouco_custo + " de " + c.lojas_com_venda + (c.lojas_com_venda === 1 ? " loja" : " lojas") + " falta custo na maior parte das vendas.";
  }
  return {
    tipo: "parcial",
    titulo: fora + "% do faturamento ficou fora do lucro bruto",
    detalhe: "porque " + produtos + "." + lojas,
  };
}
