// ============================================================
// AURA. — Conferência de estoque · contexto das telas de resultado (p-108, C)
//
// Diferenças e Histórico usam o mesmo contexto:
//   · refetch do /auth/me ao abrir (armadilha 1 do CLAUDE.md: plano stale);
//   · a loja da conferência: ?loja= da rota ou a empresa ativa (no
//     consolidado multi-CNPJ a tela pede a loja);
//   · quem edita o estoque (aplica, desfaz, transfere) e quem vê custo,
//     pela mesma query de /auth/my-permissions do Estoque (cache comum);
//   · as lojas da transferência, com o mesmo critério do Estoque
//     (lojasDaTransferencia: 2+ lojas, loja específica, fora do consulta).
// ============================================================
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { permissionsQueryKey } from "@/utils/permissionsQueryKey";
import { estaEmConsulta, podeVerCusto } from "@/utils/estoqueConsulta";
import { podeEditarEstoque } from "@/utils/conferenciaResultado";
import { lojasDaTransferencia, nomeDaLoja, type LojasDaTransferencia } from "@/utils/transferenciaEstoque";

export type LojaParaEscolher = { id: string; nome: string };

export type ContextoConferencia = {
  companyId: string | null;
  nomeDaLoja: string;
  consolidado: boolean;
  /** No consolidado: as lojas para a pessoa escolher (a tela decide se mostra). */
  lojasParaEscolher: LojaParaEscolher[];
  podeEditar: boolean;
  carregandoPermissao: boolean;
  semCusto: boolean;
  lojasTransferencia: LojasDaTransferencia | null;
};

export function useConferenciaContexto(lojaDaRota?: string | null): ContextoConferencia {
  var auth = useAuthStore() as any;
  var company = auth.company;
  var token = auth.token;
  var consolidado = !!auth.consolidatedView;
  var disponiveis: any[] = auth.availableCompanies || [];
  var refreshMe = auth.refreshMe;

  useEffect(function () {
    if (typeof refreshMe !== "function") return;
    try { Promise.resolve(refreshMe()).catch(function () { }); } catch { /* revalida no próximo mount */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  var perms = useQuery({
    queryKey: permissionsQueryKey(company?.id, consolidado),
    queryFn: function () { return request<any>("/auth/my-permissions"); },
    enabled: !!token,
    staleTime: 5 * 60000,
    retry: 1,
  });
  var papel = (company && company.member_role) || "owner";
  var carregando = !!perms.isLoading && papel !== "owner";
  var consulta = estaEmConsulta(perms.data);

  var companyId: string | null = lojaDaRota || (consolidado ? null : (company && company.id) || null);
  var atual = disponiveis.find(function (c) { return c && c.id === companyId; });
  var nome = atual ? nomeDaLoja(atual) : String((company && company.id === companyId && company.name) || "Esta loja");

  var lojas = lojasDaTransferencia(disponiveis, companyId, {
    consolidado: consolidado, consulta: consulta, demo: !!auth.isDemo, nomeAtual: nome,
  });

  return {
    companyId: companyId,
    nomeDaLoja: nome,
    consolidado: consolidado,
    lojasParaEscolher: consolidado
      ? disponiveis.filter(Boolean).map(function (c) { return { id: String(c.id), nome: nomeDaLoja(c) }; })
      : [],
    podeEditar: !carregando && !consulta && !auth.isDemo && podeEditarEstoque(perms.data),
    carregandoPermissao: carregando,
    semCusto: consulta || carregando || !podeVerCusto(perms.data),
    lojasTransferencia: lojas,
  };
}
