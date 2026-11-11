// ============================================================
// AURA. — Conferência de estoque · resultado (p-108, entrega C, 11/11/2026)
//
// Diferenças, aplicar o ajuste, desfazer e histórico. O começo e a contagem
// (criar, registrar item, descartar) ficam em services/conferenciaEstoqueApi.ts
// (entrega B). O cabeçalho da conferência (GET /:countId) também é lido
// daqui, para esta entrega não depender do cliente da B.
//
// Prefixo: /companies/:id/estoque/conferencias (:id = a loja da conferência).
// Antes da migration 446 rodar, as rotas respondem 503 MIGRATION_PENDING;
// com o backend antigo, 404. `mensagemDaConferencia` dá o texto gentil.
//
// A transferência feita a partir da conferência usa a rota que já existe
// (estoqueTransferenciasApi.criar) com `stock_count_id`.
// ============================================================
import { request } from "@/services/api";
import { MSG_DEMOROU_DEMAIS, MSG_ERRO_NOSSO, MSG_SEM_CONEXAO } from "@/utils/mensagensDoApp";

export type StatusConferencia = "rascunho" | "aplicada" | "desfeita" | "descartada";

export type EscopoConferencia = {
  tipo: "loja_toda" | "categoria" | "com_estoque";
  category_ids?: string[];
  /** Opcional: o backend pode mandar os nomes das categorias. */
  category_names?: string[];
};

export type Conferencia = {
  id: string;
  numero: number;
  status: StatusConferencia;
  escopo: EscopoConferencia | null;
  as_cegas?: boolean;
  motivo?: string | null;
  criada_em?: string | null;
  created_at?: string | null;
  aplicada_em?: string | null;
  desfeita_em?: string | null;
  pode_desfazer_ate?: string | null;
  /** Aura-backend#1001: pronto do servidor (aplicada e dentro dos 7 dias). */
  pode_desfazer?: boolean;
  zerou_nao_contados?: boolean;
  criada_por_nome?: string | null;
  aplicada_por_nome?: string | null;
};

export type TransferenciaDaConferencia = {
  id: string;
  numero: number | string;
  destino_company_id?: string | null;
  destino_nome?: string | null;
  total_pecas?: number | null;
  criada_em?: string | null;
};

export type RespostaConferencia = {
  conferencia: Conferencia;
  itens?: any[];
  escopo_total?: number | null;
  transferencias?: TransferenciaDaConferencia[];
};

export type GrupoDiferenca = "faltam" | "sobram" | "batem";

export type ItemDiferenca = {
  item_id: string;
  product_id: string;
  variant_id: string | null;
  nome: string;
  variante: string | null;
  codigo: string | null;
  contado: number;
  estoque_no_bipe: number;
  estoque_atual: number;
  diferenca: number;
  /** Quanto fica depois do ajuste (estoque atual + diferença, piso 0). */
  estoque_depois: number | null;
  /**
   * Depois de ajustada: quanto o ajuste mexeu de fato (com o piso 0). Nulo
   * quando o item não foi ajustado (desmarcado) ou a conferência não foi
   * aplicada.
   */
  diferenca_aplicada?: number | null;
  custo: number | null;
  valor: number | null;
  grupo: GrupoDiferenca;
  /** Opcional: "un", "kg"... Sem ela, conta como peça. */
  unidade?: string | null;
};

export type NaoContado = {
  product_id: string;
  variant_id: string | null;
  nome: string;
  variante: string | null;
  estoque_atual: number;
  custo: number | null;
};

export type ResumoDiferencas = {
  faltam: number;
  sobram: number;
  batem: number;
  nao_contados: number;
  valor_faltam: number | null;
  valor_sobram: number | null;
  itens_sem_custo: number;
};

export type RespostaDiferencas = {
  resumo: ResumoDiferencas;
  itens: ItemDiferenca[];
  nao_contados: NaoContado[];
  /** Quem não vê custo: custo/valor/valor_* chegam nulos. */
  custos_ocultos: boolean;
};

export type ConferenciaNoHistorico = Conferencia & {
  itens_contados?: number | null;
  faltam?: number | null;
  sobram?: number | null;
  batem?: number | null;
  valor_faltam?: number | null;
  valor_sobram?: number | null;
};

export type RespostaHistoricoConferencias = {
  conferencias: ConferenciaNoHistorico[];
  /** Próxima página: `before` = criada_em do último item (null = acabou). */
  proximo: string | null;
};

export type PedidoAplicar = {
  zerar_nao_contados: boolean;
  /** Itens desmarcados na tela: ficam como estão. */
  ignorar_item_ids?: string[];
  /** Texto curto (até 200); vazio apaga o motivo gravado ao começar. */
  motivo?: string | null;
};

export type RespostaAplicar = {
  conferencia?: Conferencia;
  ajustados?: number | null;
  sem_mudanca?: number | null;
  zerados?: number | null;
  ignorados?: Array<{ item_id: string; motivo?: string | null }>;
  movimentos?: number | null;
  /** 409 JA_APLICADA (segundo clique, outro aparelho): tratado como sucesso. */
  ja_aplicada?: boolean;
};
export type RespostaDesfazer = { conferencia?: Conferencia };

/** Limite do motivo no backend (MOTIVO_MAX). */
export var MOTIVO_MAX = 200;

function base(companyId: string): string {
  return "/companies/" + encodeURIComponent(companyId) + "/estoque/conferencias";
}

function qs(params: Record<string, string | number | undefined | null>): string {
  var partes: string[] = [];
  Object.keys(params).forEach(function (k) {
    var v = params[k];
    if (v === undefined || v === null || v === "") return;
    partes.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
  });
  return partes.length ? "?" + partes.join("&") : "";
}

function num(v: any): number {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}
function numOuNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}

/** numeric do Postgres chega como string: normaliza os números. */
export function normalizarDiferencas(r: any): RespostaDiferencas {
  var resumo = (r && r.resumo) || {};
  var itens: any[] = Array.isArray(r && r.itens) ? r.itens : [];
  var nao: any[] = Array.isArray(r && r.nao_contados) ? r.nao_contados : [];
  return {
    resumo: {
      faltam: num(resumo.faltam),
      sobram: num(resumo.sobram),
      batem: num(resumo.batem),
      nao_contados: resumo.nao_contados != null ? num(resumo.nao_contados) : nao.length,
      valor_faltam: numOuNull(resumo.valor_faltam),
      valor_sobram: numOuNull(resumo.valor_sobram),
      itens_sem_custo: num(resumo.itens_sem_custo),
    },
    itens: itens.filter(Boolean).map(function (it) {
      var diferenca = num(it.diferenca);
      var grupo: GrupoDiferenca = it.grupo === "faltam" || it.grupo === "sobram" || it.grupo === "batem"
        ? it.grupo
        : diferenca < 0 ? "faltam" : diferenca > 0 ? "sobram" : "batem";
      return {
        item_id: String(it.item_id || it.id || ""),
        product_id: String(it.product_id),
        variant_id: it.variant_id ? String(it.variant_id) : null,
        nome: String(it.nome || "Produto"),
        variante: it.variante ? String(it.variante) : null,
        codigo: it.codigo ? String(it.codigo) : null,
        contado: num(it.contado),
        estoque_no_bipe: num(it.estoque_no_bipe),
        estoque_atual: num(it.estoque_atual),
        diferenca: diferenca,
        estoque_depois: numOuNull(it.estoque_depois),
        diferenca_aplicada: numOuNull(it.diferenca_aplicada),
        custo: numOuNull(it.custo),
        valor: numOuNull(it.valor),
        grupo: grupo,
        unidade: it.unidade ? String(it.unidade) : null,
      };
    }),
    nao_contados: nao.filter(Boolean).map(function (it) {
      return {
        product_id: String(it.product_id),
        variant_id: it.variant_id ? String(it.variant_id) : null,
        nome: String(it.nome || "Produto"),
        variante: it.variante ? String(it.variante) : null,
        estoque_atual: num(it.estoque_atual),
        custo: numOuNull(it.custo),
      };
    }),
    custos_ocultos: !!(r && r.custos_ocultos),
  };
}

export const conferenciaEstoqueResultadoApi = {
  /** Cabeçalho + itens + transferências ligadas (GET /:countId). */
  obter: function (companyId: string, countId: string) {
    return request<RespostaConferencia>(base(companyId) + "/" + encodeURIComponent(countId), { retry: 1 });
  },
  diferencas: function (companyId: string, countId: string) {
    return request<any>(base(companyId) + "/" + encodeURIComponent(countId) + "/diferencas", { retry: 1, timeout: 20000 })
      .then(normalizarDiferencas);
  },
  /**
   * Sem retry: o backend é idempotente, mas a tela não repete sozinha.
   * 409 JA_APLICADA com `conferencia` no corpo = já foi (clique duplo,
   * outro aparelho): resolve como sucesso, com ja_aplicada.
   */
  aplicar: function (companyId: string, countId: string, pedido: PedidoAplicar) {
    var corpo: Record<string, any> = { zerar_nao_contados: !!pedido.zerar_nao_contados };
    if (pedido.ignorar_item_ids && pedido.ignorar_item_ids.length > 0) corpo.ignorar_item_ids = pedido.ignorar_item_ids.slice();
    if (pedido.motivo !== undefined) corpo.motivo = pedido.motivo === null ? null : String(pedido.motivo).trim().slice(0, MOTIVO_MAX);
    return request<RespostaAplicar>(base(companyId) + "/" + encodeURIComponent(countId) + "/aplicar", {
      method: "POST", body: corpo, retry: 0, timeout: 60000,
    }).catch(function (e: any): RespostaAplicar {
      if (e && e.status === 409 && codigoDaConferencia(e) === "JA_APLICADA" && e.data && e.data.conferencia) {
        return { conferencia: e.data.conferencia, ja_aplicada: true };
      }
      throw e;
    });
  },
  desfazer: function (companyId: string, countId: string) {
    return request<RespostaDesfazer>(base(companyId) + "/" + encodeURIComponent(countId) + "/desfazer", {
      method: "POST", retry: 0, timeout: 60000,
    });
  },
  /**
   * Mais recentes primeiro; o backend devolve um array puro. A próxima
   * página vai com `before` = criada_em do último item; página com menos
   * de `limit` itens é a última.
   */
  historico: function (companyId: string, opcoes: { limit?: number; before?: string | null } = {}) {
    return request<any>(base(companyId) + qs({ limit: opcoes.limit, before: opcoes.before }), { retry: 1 })
      .then(function (r): RespostaHistoricoConferencias {
        var lista: any[] = (Array.isArray(r) ? r : Array.isArray(r && r.conferencias) ? r.conferencias : []).filter(Boolean);
        var ultimo = lista[lista.length - 1];
        var cheia = !opcoes.limit || lista.length >= opcoes.limit;
        return { conferencias: lista, proximo: cheia && ultimo ? (ultimo.criada_em || ultimo.created_at || null) : null };
      });
  },
};

/** `code` do corpo do erro ({ error, code }); null quando não veio. */
export function codigoDaConferencia(e: any): string | null {
  return (e && e.data && e.data.code) || null;
}

export var MSG_CONFERENCIA_CHEGANDO =
  "A conferência de estoque está chegando para a sua loja. Nada foi perdido: tente de novo daqui a alguns minutos.";
export var MSG_CONFERENCIA_NAO_ACHADA =
  "Não encontramos esta conferência nesta loja. Ela pode ter sido descartada ou ser de outra loja.";
export var MSG_SO_QUEM_EDITA =
  "Só quem pode editar o estoque aplica o ajuste, desfaz ou transfere. A contagem fica guardada para essa pessoa.";

export type ContextoDoErro = "carregar" | "lista" | "aplicar" | "desfazer";

/**
 * Texto gentil para a tela. 503 MIGRATION_PENDING e o 404 de rota que ainda
 * não existe (lista) viram "está chegando"; 404 de uma conferência é "não
 * encontramos"; 409 usa o texto do backend (prazo, status).
 */
export function mensagemDaConferencia(e: any, contexto: ContextoDoErro): string {
  var status = e && typeof e.status === "number" ? e.status : 0;
  var code = codigoDaConferencia(e);
  var msgBackend = e && e.data && typeof e.data.error === "string" ? e.data.error : null;
  if (code === "MIGRATION_PENDING") return MSG_CONFERENCIA_CHEGANDO;
  if (status === 404) return contexto === "lista" ? MSG_CONFERENCIA_CHEGANDO : MSG_CONFERENCIA_NAO_ACHADA;
  if (status === 403) return MSG_SO_QUEM_EDITA;
  if (status === 409) {
    if (code === "JA_DESFEITA") return "Esta conferência já foi desfeita. Atualizamos a tela.";
    if (code === "NAO_APLICADA") return "Só dá para desfazer uma conferência que já ajustou o estoque. Atualizamos a tela.";
    if (code === "PRAZO_ENCERRADO") return msgBackend || "O prazo de 7 dias para desfazer esta conferência terminou. Se algo ficou errado, faça uma nova conferência desses itens.";
    if (msgBackend) return msgBackend;
    return contexto === "desfazer"
      ? "Esta conferência não pode mais ser desfeita (passou o prazo ou já foi desfeita). Atualizamos a tela."
      : "Esta conferência já foi ajustada ou desfeita. Atualizamos a tela.";
  }
  if (e && e.isNetworkError) return e.code === "timeout" ? MSG_DEMOROU_DEMAIS : MSG_SEM_CONEXAO;
  if (status >= 500) return MSG_ERRO_NOSSO;
  return msgBackend || "Não deu certo desta vez. Tente de novo em instantes.";
}
