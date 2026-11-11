// ============================================================
// AURA. — Estoque entre lojas do grupo (10/11/2026)
//
// Lojas com mais de um CNPJ, cada uma com o seu estoque:
//   - POST /companies/:id/estoque/transferencias   (:id = loja de origem)
//   - GET  /companies/:id/estoque/transferencias   (histórico)
//   - GET  /me/estoque/por-loja                     (um produto, uma linha)
//   - GET  /me/estoque/por-loja/variantes?chave=    (rótulo × lojas)
//
// O backend só devolve as lojas que o usuário acessa (multi-CNPJ).
// Erros chegam como { error, code } — `codigoDoErro` lê o code do ApiError.
// ============================================================
import { request } from "@/services/api";

// ── Transferência ──────────────────────────────────────────

export type ItemParaTransferir = {
  product_id: string;
  variant_id: string | null;
  quantidade: number;
};

export type PedidoTransferencia = {
  destino_company_id: string;
  itens: ItemParaTransferir[];
  observacao?: string | null;
  /** p-108: transferência feita a partir de uma conferência da loja de origem. */
  stock_count_id?: string | null;
};

export type ItemTransferido = {
  product_id: string;
  variant_id: string | null;
  destino_product_id: string;
  destino_variant_id: string | null;
  quantidade: number;
  criado_no_destino: boolean;
  // Opcionais: o histórico pode trazer o nome para o detalhe.
  nome?: string | null;
  rotulo?: string | null;
};

export type Transferencia = {
  id: string;
  numero: number | string;
  origem_company_id: string;
  destino_company_id: string;
  criada_em: string;
  itens?: ItemTransferido[];
  // Opcionais no histórico (o app cai nas lojas do switcher quando faltam).
  origem_nome?: string | null;
  destino_nome?: string | null;
  total_pecas?: number | null;
  total_itens?: number | null;
  observacao?: string | null;
  usuario_nome?: string | null;
  criada_por?: string | null;
  /** Só no GET (Aura-backend#994): sentido do ponto de vista da loja consultada. */
  sentido?: "saida" | "entrada" | null;
};

export type RespostaTransferencia = { transferencia: Transferencia };
export type RespostaHistorico = { transferencias: Transferencia[]; total?: number; limit?: number; offset?: number };

export type CodigoErroTransferencia =
  | "NAO_E_DO_GRUPO"
  | "ESTOQUE_INSUFICIENTE"
  | "QUANTIDADE_INVALIDA"
  | "MESMA_LOJA"
  | "ITEM_NAO_ENCONTRADO"
  | "GRADE_DIFERENTE"
  | "TENTE_DE_NOVO"
  | "SCHEMA_PENDENTE";

// ── Estoque por loja ───────────────────────────────────────

export type LojaDoGrupo = { id: string; nome: string };

// Aura-backend#995: produto do catálogo do grupo (is_group_shared) aparece na
// loja dona com o estoque; nas outras lojas vem `compartilhado: true`,
// `estoque: null` e `dona_company_id`. O total já vem só com estoque real.
export type EstoqueNaLoja = {
  company_id: string;
  product_id: string | null;
  estoque: number | null;
  compartilhado?: boolean;
  dona_company_id?: string | null;
};

export type ItemPorLoja = {
  chave: string;
  nome: string;
  sku: string | null;
  barcode: string | null;
  imagem_url: string | null;
  /** null para quem só consulta o estoque (sem Caixa): o preço some. */
  preco: number | null;
  por_loja: EstoqueNaLoja[];
  total: number;
  tem_variantes: boolean;
};

export type RespostaPorLoja = { lojas: LojaDoGrupo[]; itens: ItemPorLoja[]; total_itens: number };

export type VarianteNaLoja = {
  company_id: string;
  variant_id: string | null;
  estoque: number | null;
  compartilhado?: boolean;
  dona_company_id?: string | null;
};

export type VariantePorLoja = {
  rotulo: string;
  sku: string | null;
  barcode: string | null;
  por_loja: VarianteNaLoja[];
  total: number;
};

export type RespostaVariantesPorLoja = { lojas: LojaDoGrupo[]; variantes: VariantePorLoja[] };

/** limit: padrão 50, teto 200 no backend. */
export type FiltroPorLoja = { q?: string; categoria?: string; limit?: number; offset?: number };

function qs(params: Record<string, string | number | undefined | null>): string {
  var partes: string[] = [];
  Object.keys(params).forEach(function (k) {
    var v = params[k];
    if (v === undefined || v === null || v === "") return;
    partes.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
  });
  return partes.length ? "?" + partes.join("&") : "";
}

export const estoqueTransferenciasApi = {
  /** Um lote (até 1.000 itens). Sem retry: um POST repetido duplicaria a transferência. */
  criar: function (origemCompanyId: string, pedido: PedidoTransferencia) {
    return request<RespostaTransferencia>("/companies/" + origemCompanyId + "/estoque/transferencias", {
      method: "POST", body: pedido, retry: 0, timeout: 60000,
    });
  },
  historico: function (companyId: string, limit: number, offset: number) {
    return request<RespostaHistorico>("/companies/" + companyId + "/estoque/transferencias" + qs({ limit: limit, offset: offset }));
  },
  porLoja: function (filtro: FiltroPorLoja) {
    return request<RespostaPorLoja>("/me/estoque/por-loja" + qs({
      q: filtro.q, categoria: filtro.categoria, limit: filtro.limit, offset: filtro.offset,
    }), { timeout: 20000 });
  },
  /** A chave vai como veio (pode terminar em "#2": cadastro repetido na mesma loja). */
  variantesPorLoja: function (chave: string) {
    return request<RespostaVariantesPorLoja>("/me/estoque/por-loja/variantes" + qs({ chave: chave }));
  },
};

/** `code` do corpo do erro ({ error, code }); null quando não veio. */
export function codigoDoErro(e: any): string | null {
  return (e && e.data && e.data.code) || null;
}
