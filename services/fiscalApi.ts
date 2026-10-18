// ============================================================
// AURA. — Consulta de NCM na tabela da Receita (18/10/2026, t3-05)
//
//   GET /fiscal/ncm/:codigo → { ncm, formato_ok, existe, descricao, mensagem, tabela }
//
// `existe` é true/false, ou null quando o servidor não sabe dizer (formato
// errado, tabela indisponível). É dado público e não grava nada.
// ============================================================

import { request } from "./api";

export type NcmConsulta = {
  ncm: string;
  formato_ok: boolean;
  existe: boolean | null;
  descricao: string | null;
  mensagem: string | null;
  tabela: { vigente_em: string; ato: string | null; fonte: string; total: number } | null;
};

export var fiscalApi = {
  ncm: function (codigo: string) {
    return request<NcmConsulta>("/fiscal/ncm/" + encodeURIComponent(codigo), { timeout: 8000 });
  },
};
