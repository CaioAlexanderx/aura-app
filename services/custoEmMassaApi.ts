// ============================================================
// AURA. — Preencher custos em massa (conferência de estoque, 12/11/2026)
//
// Cliente das rotas de Aura-backend (migration 448):
//   GET  /companies/:id/products/cost-fills/contagem?count_id
//   GET  /companies/:id/products/cost-fills/pendentes?filtro&count_id&busca&limit&offset
//   POST /companies/:id/products/cost-fills          prévia (dry_run) ou gravar
//   GET  /companies/:id/products/cost-fills          últimos preenchimentos
//   GET  /companies/:id/products/cost-fills/:fillId
//   POST /companies/:id/products/cost-fills/:fillId/undo
//
// :id = a loja (multi-CNPJ: um preenchimento é sempre de uma loja; o
// produto compartilhado da própria loja vale nas N lojas do grupo).
// Antes da migration: 503 MIGRATION_PENDING. Quem não edita o estoque ou
// não vê custo: 403 (o app nem mostra a tela).
// ============================================================
import { request } from "@/services/api";
import { MSG_DEMOROU_DEMAIS, MSG_ERRO_NOSSO, MSG_SEM_CONEXAO } from "@/utils/mensagensDoApp";

export type OrigemDoCusto = "digitado" | "sugerido" | "mesmo";
export type ModoDoAtalho = "markup" | "margem";
export type FiltroDosSemCusto = "todos" | "conferencia" | "sem_preco";

export type Contagens = {
  todos: number;
  desta_conferencia: number | null;
  sem_preco: number;
  /** Ativos da loja que entram na conta (sem serviço). */
  produtos?: number;
};

export type ProdutoSemCusto = {
  product_id: string;
  nome: string;
  codigo: string | null;
  /** null = sem preço de venda (o atalho não tem de onde sugerir). */
  preco: number | null;
  /** Só quando as variantes têm preços diferentes. */
  preco_min: number | null;
  preco_max: number | null;
  variantes: number;
  compartilhado: boolean;
  /** Em quantas lojas o custo vale (compartilhado no grupo). */
  lojas: number;
};

export type RespostaPendentes = {
  itens: ProdutoSemCusto[];
  total: number;
  limit: number;
  offset: number;
  filtro: FiltroDosSemCusto;
  contagens: Contagens;
  lojas_do_grupo: number;
  /** O último atalho usado na loja (a Aura lembra). */
  ultimo_atalho: { modo: ModoDoAtalho; percentual: number } | null;
};

export type ItemDoPedido = { product_id: string; custo: number; origem: OrigemDoCusto };

export type PedidoDeCusto = {
  itens: ItemDoPedido[];
  atalho?: { modo: ModoDoAtalho; percentual: number } | null;
  count_id?: string | null;
  dry_run?: boolean;
};

export type StatusDoItem = "grava" | "mudou_no_meio" | "servico" | "nao_encontrado";

export type ItemDaResposta = {
  product_id: string;
  nome: string | null;
  status: StatusDoItem;
  preco?: number | null;
  origem?: OrigemDoCusto;
  compartilhado?: boolean;
  lojas?: number;
  custo_antes?: number | null;
  custo_depois?: number;
  custo_atual?: number | null;
  acima_do_preco?: boolean;
};

export type ResumoDoPreenchimento = {
  gravar: number;
  digitados: number;
  sugeridos: number;
  mesmo: number;
  compartilhados: number;
  lojas_do_grupo: number;
  acima_do_preco: number;
  mudou_no_meio: number;
  servicos: number;
  nao_encontrados: number;
};

export type RespostaGravar = {
  dry_run: boolean;
  fill_id: string | null;
  resumo: ResumoDoPreenchimento;
  itens: ItemDaResposta[];
  created_at?: string;
  undo_deadline?: string;
  itens_de_conferencia_atualizados?: number;
};

export type Preenchimento = {
  id: string;
  criado_em: string;
  por: { id: string; nome: string | null } | null;
  atalho: { modo: ModoDoAtalho; percentual: number } | null;
  conferencia: { id: string; numero: number } | null;
  produtos: number;
  digitados: number;
  sugeridos: number;
  mesmo: number;
  compartilhados: number;
  mudou_no_meio: number;
  itens_de_conferencia_atualizados: number;
  desfazer_ate: string;
  pode_desfazer: boolean;
  desfeito_em: string | null;
  desfeito_por: { id: string; nome: string | null } | null;
  desfeitos: number | null;
  mudaram_depois: number | null;
};

export type ItemDoPreenchimento = {
  product_id: string;
  nome: string | null;
  origem: OrigemDoCusto;
  compartilhado: boolean;
  preco: number | null;
  custo_antes: number | null;
  custo_depois: number;
  custo_agora: number | null;
  desfazer: "desfeito" | "mudou_depois" | null;
};

export type RespostaDesfazer = {
  fill_id: string;
  desfeito_em: string;
  desfeitos: number;
  mudaram_depois: number;
  voltaram: Array<{ product_id: string; nome: string | null }>;
  mudou_depois: Array<{ product_id: string; nome: string | null; custo_gravado: number | null; custo_agora: number | null; motivo: string }>;
};

function base(companyId: string): string {
  return "/companies/" + encodeURIComponent(companyId) + "/products/cost-fills";
}

function qs(p: Record<string, string | number | null | undefined>): string {
  var partes: string[] = [];
  Object.keys(p).forEach(function (k) {
    var v = p[k];
    if (v === null || v === undefined || v === "") return;
    partes.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
  });
  return partes.length ? "?" + partes.join("&") : "";
}

export const custoEmMassaApi = {
  contagem: function (companyId: string, countId?: string | null) {
    return request<Contagens>(base(companyId) + "/contagem" + qs({ count_id: countId }), { retry: 1 });
  },
  pendentes: function (companyId: string, opcoes: {
    filtro?: FiltroDosSemCusto; countId?: string | null; busca?: string; limit?: number; offset?: number;
  } = {}) {
    return request<RespostaPendentes>(base(companyId) + "/pendentes" + qs({
      filtro: opcoes.filtro && opcoes.filtro !== "todos" ? opcoes.filtro : null,
      count_id: opcoes.countId,
      busca: opcoes.busca ? opcoes.busca.trim() : null,
      limit: opcoes.limit,
      offset: opcoes.offset,
    }), { retry: 1, timeout: 20000 });
  },
  /** Sem retry: gravar não se repete sozinho (o servidor aguenta, mas a tela decide). */
  gravar: function (companyId: string, pedido: PedidoDeCusto) {
    return request<RespostaGravar>(base(companyId), {
      method: "POST",
      body: {
        itens: pedido.itens,
        atalho: pedido.atalho || null,
        count_id: pedido.count_id || null,
        dry_run: pedido.dry_run === true,
      },
      retry: 0,
      timeout: 60000,
    });
  },
  historico: function (companyId: string, opcoes: { limit?: number; offset?: number } = {}) {
    return request<{ preenchimentos: Preenchimento[]; total: number }>(
      base(companyId) + qs({ limit: opcoes.limit, offset: opcoes.offset }), { retry: 1 });
  },
  detalhe: function (companyId: string, fillId: string) {
    return request<Preenchimento & { itens: ItemDoPreenchimento[] }>(base(companyId) + "/" + encodeURIComponent(fillId), { retry: 1 });
  },
  desfazer: function (companyId: string, fillId: string) {
    return request<RespostaDesfazer>(base(companyId) + "/" + encodeURIComponent(fillId) + "/undo", {
      method: "POST", retry: 0, timeout: 60000,
    });
  },
};

export function codigoDoCusto(e: any): string | null {
  return (e && e.data && e.data.code) || null;
}

export var MSG_CUSTO_CHEGANDO =
  "O preenchimento de custos está chegando para a sua loja. Nada foi perdido: tente de novo daqui a alguns minutos.";
export var MSG_CUSTO_SEM_PERMISSAO =
  "Só quem edita o estoque e vê o custo preenche custos. Peça ao dono da loja.";

export type ContextoDoErroDeCusto = "lista" | "gravar" | "historico" | "desfazer";

/** Texto gentil para a tela. */
export function mensagemDoCusto(e: any, contexto: ContextoDoErroDeCusto): string {
  var status = e && typeof e.status === "number" ? e.status : 0;
  var code = codigoDoCusto(e);
  var msgBackend = e && e.data && typeof e.data.error === "string" ? e.data.error : null;
  if (code === "MIGRATION_PENDING" || (status === 404 && contexto !== "desfazer")) return MSG_CUSTO_CHEGANDO;
  if (status === 403) return MSG_CUSTO_SEM_PERMISSAO;
  if (status === 404) return "Não achamos esse preenchimento nesta loja. Atualizamos a lista.";
  if (status === 409 && code === "JA_DESFEITO") return "Este preenchimento já foi desfeito. Atualizamos a lista.";
  if (status === 410) return "O prazo de 7 dias para desfazer este preenchimento terminou. Se algum custo ficou errado, mude no produto.";
  if (status === 409 && code === "TENTE_DE_NOVO") return "Os produtos mudaram enquanto os custos eram gravados. Nenhum custo foi alterado: tente de novo.";
  if (e && e.isNetworkError) return e.code === "timeout" ? MSG_DEMOROU_DEMAIS : MSG_SEM_CONEXAO;
  if (status >= 500) return MSG_ERRO_NOSSO;
  if (status === 400 && msgBackend) return msgBackend;
  return msgBackend || "Não deu certo desta vez. Tente de novo em instantes.";
}
