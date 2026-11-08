import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { request, ApiError } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useEstoqueConsulta } from "@/hooks/useEstoqueConsulta";
import type { PeriodKey } from "@/components/screens/financeiro/types";
import { getPeriodRange, getPreviousPeriodRange } from "@/components/screens/financeiro/types";
import type { ResultadoDoPeriodo } from "@/utils/resultadoDoPeriodo";

function toISODate(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// 08/11/2026 (p-82): Faturamento, Custos, Lucro bruto e Despesas da aba
// Receitas. Mesmo período, empresa ativa e consolidado do useTransactionsApi
// (as datas saem do mesmo getPeriodRange/getPreviousPeriodRange).
//
// Devolve null — e a aba fica exatamente como era — quando:
//   - a pessoa não vê custo (estoque só consulta ou sem retaguarda);
//   - o backend ainda não tem a rota (404) ou respondeu erro;
//   - demonstração, sem token ou carregando.
export function useResultadoDoPeriodo(period: PeriodKey, customStart?: string, customEnd?: string): ResultadoDoPeriodo | null {
  var { company, token, isDemo, consolidatedView } = useAuthStore();
  var { semCusto } = useEstoqueConsulta();
  var companyId = company?.id;

  var faixa = useMemo(function() {
    var atual = getPeriodRange(period, customStart, customEnd);
    var ant = getPreviousPeriodRange(period, customStart, customEnd);
    return {
      de: toISODate(atual.start), ate: toISODate(atual.end),
      antDe: ant ? toISODate(ant.start) : null, antAte: ant ? toISODate(ant.end) : null,
    };
  }, [period, customStart, customEnd]);

  var { data } = useQuery({
    queryKey: ["financeiro-resultado", consolidatedView ? "all" : companyId, faixa.de, faixa.ate, faixa.antDe, faixa.antAte],
    queryFn: async function() {
      var qs = "de=" + faixa.de + "&ate=" + faixa.ate;
      if (faixa.antDe && faixa.antAte) qs += "&anterior_de=" + faixa.antDe + "&anterior_ate=" + faixa.antAte;
      var base = consolidatedView ? "/me/financeiro/resultado" : "/companies/" + companyId + "/financeiro/resultado";
      try {
        return await request<ResultadoDoPeriodo>(base + "?" + qs, { retry: 1 });
      } catch (err) {
        // 404 = backend antigo; 403 = sem custo. A aba segue como era.
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
        throw err;
      }
    },
    enabled: (consolidatedView || !!companyId) && !!token && !isDemo && !semCusto,
    retry: false,
    staleTime: 30000,
  });

  if (semCusto || !data || typeof data.faturamento !== "number") return null;
  return data;
}
