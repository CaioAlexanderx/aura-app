// ============================================================
// AURA. — caixaApi.ts
// Tipos e funções de API do módulo de Abertura/Fechamento de Caixa
//
// 07/05/2026: abrir() ganha parâmetro opcional responsavel_employee_id
// (registra qual funcionário operacional está abrindo, separado do
// req.user que continua sendo gravado em opened_by). fechar() agora
// retorna métricas adicionais (sales_count, new_customers_count,
// sessao_label) usadas pelo PDF de fechamento.
//
// 08/05/2026 (bug Davi Villa Branca):
//   - listOperadores() — novo endpoint que substitui employeesApi.list
//     no fluxo de Abrir Caixa. Retorna a uniao de empregados ativos +
//     membros ativos com acesso a PDV (cobre owner/admin sem entrada
//     em employees + colaboradores convidados via Equipe).
//   - abrir() ganha parametro alternativo responsavel_user_id, usado
//     quando o operador escolhido vem de company_members em vez de
//     employees. Backend resolve pra employee_id se possivel; senao,
//     deixa null (display cai pro u.full_name via COALESCE).
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

/**
 * Operador autorizado a abrir caixa nesta empresa. Vem da uniao de
 * `employees` + `company_members` (com permissions.pdv ou role
 * owner/admin) computada pelo backend.
 */
export type CaixaOperador = {
  /** id estavel pra <ListItem key={...}> — 'emp:<id>' ou 'mem:<user_id>' */
  key:         string;
  /** employee_id quando source='employee'; user_id quando source='member' */
  id:          string;
  name:        string;
  role:        string | null;
  source:      "employee" | "member";
  employee_id: string | null;
  user_id:     string | null;
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
   * Lista de pessoas autorizadas a abrir o caixa nesta empresa.
   * Substitui employeesApi.list no fluxo de Abrir Caixa (pra cobrir
   * owner/admin sem employee row + colaboradores convidados via Equipe).
   */
  listOperadores: function(companyId: string) {
    return request<{ operadores: CaixaOperador[] }>(
      "/companies/" + companyId + "/caixa/operadores",
      { retry: 1 }
    );
  },

  /**
   * Abre nova sessão de caixa.
   * @param responsavelEmployeeId Funcionário operacional responsável pelo caixa.
   *                              Opcional — quando omitido, o backend grava só
   *                              o req.user. Quando presente, vira o "operador"
   *                              exibido no header e no PDF.
   * @param responsavelUserId     Alternativa quando o operador escolhido nao
   *                              tem entrada em `employees` (membro de
   *                              company_members sem registro de folha). O
   *                              backend resolve pra employee_id quando
   *                              possivel; senao deixa null.
   */
  abrir: function(
    companyId: string,
    troco_inicial: number,
    responsavelEmployeeId?: string | null,
    responsavelUserId?: string | null
  ) {
    const body: {
      troco_inicial: number;
      responsavel_employee_id?: string;
      responsavel_user_id?: string;
    } = { troco_inicial: troco_inicial };
    if (responsavelEmployeeId) body.responsavel_employee_id = responsavelEmployeeId;
    if (responsavelUserId)     body.responsavel_user_id     = responsavelUserId;
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
