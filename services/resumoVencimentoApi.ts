import { request } from "@/services/api";

// ============================================================
// AURA. -- Crediário: o que vence num período (p-91, 09/11/2026)
//
// Contrato com o backend (Aura-backend#967, card p-90):
//   GET /companies/:id/credit/installments/resumo-vencimento   uma empresa
//   GET /me/credit/installments/resumo-vencimento              consolidado
// Query `de` e `ate` (AAAA-MM-DD, inclusivos). Sem eles o servidor usa o
// janeiro do ano que vem; o app manda sempre os dois, porque em janeiro o
// resumo é do janeiro de AGORA (ver janeiroDoResumo).
//
// A fonte são as PARCELAS em aberto (credit_installments), não o razão.
// Só números: nenhum dado de cliente final sai daqui.
//   400 PERIODO_INVALIDO · 403 CREDIARIO_DISABLED ou plano · 404 rota antiga
// Qualquer erro esconde a seção (usePrimeiraParcelaEmJaneiro).
// ============================================================

export type SemanaDoResumo = { semana_inicio: string; parcelas: number; valor: number };

export type EmpresaDoResumo = {
  company_id: string;
  nome: string | null;
  parcelas: number;
  valor: number;
  clientes: number;
  carnes: number;
};

export type ResumoVencimento = {
  periodo: { de: string; ate: string };
  parcelas: number;
  valor: number;
  clientes: number;
  carnes: number;
  por_semana: SemanaDoResumo[];
  empresas: EmpresaDoResumo[];
  consolidated: boolean;
  company_count?: number;
};

export type PeriodoDoResumo = { de: string; ate: string };

function num(v: any): number {
  var n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function int(v: any): number {
  return Math.max(0, Math.round(num(v)));
}

/** Lê a resposta com tolerância: campo ausente vira zero, lista ausente vira []. */
export function lerResumoVencimento(r: any, periodo: PeriodoDoResumo): ResumoVencimento {
  var x = r || {};
  return {
    periodo: {
      de: String((x.periodo && x.periodo.de) || periodo.de),
      ate: String((x.periodo && x.periodo.ate) || periodo.ate),
    },
    parcelas: int(x.parcelas),
    valor: num(x.valor),
    clientes: int(x.clientes),
    carnes: int(x.carnes),
    por_semana: (Array.isArray(x.por_semana) ? x.por_semana : []).map(function (s: any) {
      return { semana_inicio: String(s.semana_inicio || "").slice(0, 10), parcelas: int(s.parcelas), valor: num(s.valor) };
    }),
    empresas: (Array.isArray(x.empresas) ? x.empresas : []).map(function (e: any) {
      return {
        company_id: String(e.company_id),
        nome: e.nome ? String(e.nome) : null,
        parcelas: int(e.parcelas),
        valor: num(e.valor),
        clientes: int(e.clientes),
        carnes: int(e.carnes),
      };
    }),
    consolidated: !!x.consolidated,
    company_count: x.company_count == null ? undefined : int(x.company_count),
  };
}

function query(p: PeriodoDoResumo) {
  return "?de=" + encodeURIComponent(p.de) + "&ate=" + encodeURIComponent(p.ate);
}

export var resumoVencimentoApi = {
  /** Uma empresa. */
  daEmpresa: function (companyId: string, periodo: PeriodoDoResumo) {
    return request<any>("/companies/" + companyId + "/credit/installments/resumo-vencimento" + query(periodo), { retry: 1 })
      .then(function (r) { return lerResumoVencimento(r, periodo); });
  },
  /** Todas as empresas do usuário (só as com crediário ligado). */
  consolidado: function (periodo: PeriodoDoResumo) {
    return request<any>("/me/credit/installments/resumo-vencimento" + query(periodo), { retry: 1 })
      .then(function (r) { return lerResumoVencimento(r, periodo); });
  },
};
