// ============================================================
// AURA. — caixaApi.ts
// Tipos e funções de API do módulo de Abertura/Fechamento de Caixa
//
// 07/05/2026: abrir() ganha parâmetro opcional responsavel_employee_id
// (registra qual funcionário operacional está abrindo, separado do
// req.user que continua sendo gravado em opened_by). fechar() agora
// retorna métricas adicionais (sales_count, new_customers_count,
// sessao_label) usadas pelo PDF de fechamento.
// ============================================================

import { request } from "@/services/api";

// ── Tipos ──────────────────────────────────────────────────────────────

export type CaixaTotais = {
  pix:            number;
  cartao_debito:  number;
  cartao_credito: number;
  dinheiro:       number;
  fiado:          number;
  outros:         number;
  geral:          number;
};

export type CaixaSessaoAtiva = {
  id:            string;
  opened_at:     string;
  troco_inicial: number;
  opened_by: {
    id:   string;
    name: string;
  };
  totais_ao_vivo: CaixaTotais;
};

export type CaixaStatus = {
  sessao_ativa: CaixaSessaoAtiva | null;
};

/**
 * Snapshot completo retornado pelo /fechar.
 * Inclui as métricas extras necessárias pro PDF de fechamento
 * (sales_count, new_customers_count, sessao_label, closed_at).
 */
export type CaixaFechamentoFull = {
  id:                   string;
  sessao_id:            string;
  closed_at?:           string | null;
  sessao_label?:        string | null;

  // Confronto
  dinheiro_esperado:    number;
  dinheiro_contado:     number;
  diferenca:            number;

  // Totais por forma de pagamento
  total_pix:            number;
  total_cartao_debito:  number;
  total_cartao_credito: number;
  total_fiado:          number;
  total_dinheiro:       number;
  total_outros:         number;
  total_geral:          number;

  observacao:           string | null;

  // Métricas adicionais (preenchidas pelo backend ao fechar)
  sales_count?:         number;
  new_customers_count?: number;
};

export type CaixaSessaoHistorico = {
  id:               string;
  opened_at:        string;
  closed_at:        string | null;
  troco_inicial:    number;
  status:           "aberta" | "fechada";
  obs_sessao:       string | null;
  opened_by_name:   string;
  closed_by_name:   string | null;
  // campos do fechamento (null se sessão ainda aberta)
  dinheiro_esperado:    number | null;
  dinheiro_contado:     number | null;
  diferenca:            number | null;
  total_pix:            number | null;
  total_cartao_debito:  number | null;
  total_cartao_credito: number | null;
  total_fiado:          number | null;
  total_dinheiro:       number | null;
  total_outros:         number | null;
  total_geral:          number | null;
  obs_fechamento:       string | null;
};

export type CaixaHistoricoResponse = {
  sessoes: CaixaSessaoHistorico[];
  total:   number;
};

export type CaixaHistoricoParams = {
  limit?:  number;
  offset?: number;
  de?:     string;
  ate?:    string;
};

// ── API ────────────────────────────────────────────────────────────────

export var caixaApi = {
  /** Status ao vivo — sessão aberta com totais em tempo real, ou null */
  status: function(companyId: string) {
    return request<CaixaStatus>(
      "/companies/" + companyId + "/caixa/status",
      { retry: 1 }
    );
  },

  /**
   * Abre nova sessão de caixa.
   * @param responsavelEmployeeId Funcionário operacional responsável pelo caixa.
   *                              Opcional — quando omitido, o backend grava só
   *                              o req.user. Quando presente, vira o "operador"
   *                              exibido no header e no PDF.
   */
  abrir: function(
    companyId: string,
    troco_inicial: number,
    responsavelEmployeeId?: string | null
  ) {
    const body: { troco_inicial: number; responsavel_employee_id?: string } = {
      troco_inicial: troco_inicial,
    };
    if (responsavelEmployeeId) body.responsavel_employee_id = responsavelEmployeeId;
    return request<{ sessao: any }>(
      "/companies/" + companyId + "/caixa/abrir",
      { method: "POST", body, retry: 0 }
    );
  },

  /** Fecha a sessão ativa — cria snapshot + retorna métricas pro PDF */
  fechar: function(companyId: string, dinheiro_contado: number, observacao?: string) {
    return request<{ fechamento: CaixaFechamentoFull }>(
      "/companies/" + companyId + "/caixa/fechar",
      {
        method: "POST",
        body: { dinheiro_contado: dinheiro_contado, observacao: observacao || null },
        retry: 0,
        timeout: 15000,
      }
    );
  },

  /** Histórico de sessões fechadas com paginação */
  historico: function(companyId: string, params?: CaixaHistoricoParams) {
    var qs: string[] = [];
    if (params?.limit)  qs.push("limit="  + params.limit);
    if (params?.offset) qs.push("offset=" + params.offset);
    if (params?.de)     qs.push("de="     + encodeURIComponent(params.de));
    if (params?.ate)    qs.push("ate="    + encodeURIComponent(params.ate));
    var suffix = qs.length ? "?" + qs.join("&") : "";
    return request<CaixaHistoricoResponse>(
      "/companies/" + companyId + "/caixa/historico" + suffix,
      { retry: 1 }
    );
  },

  /** Detalhe de uma sessão específica */
  sessao: function(companyId: string, sessaoId: string) {
    return request<{ sessao: CaixaSessaoHistorico }>(
      "/companies/" + companyId + "/caixa/sessao/" + sessaoId,
      { retry: 1 }
    );
  },
};
