import { useQuery } from "@tanstack/react-query";
import { promocoesApi, type ItemDaLista } from "@/services/promocoesApi";
import { CHAVE_PROMOCOES } from "@/hooks/usePromocoesDePor";
import { janelaDosVendidos, pedidoDaJanela, type JanelaDosVendidos } from "@/components/screens/blackfriday/dePor/janelaVendidos";

// ============================================================
// AURA. — Vendidos na promoção da empresa ativa (p-93, 08/11/2026)
//
// Uma consulta por bloco da seção (no ar ou encerrada). A chave fica sob
// CHAVE_PROMOCOES: o `recarregar` da seção (encerrar, aplicar) relê também
// os vendidos. O "agora" entra só na hora de pedir, nunca na chave.
// Qualquer erro (403 do perfil consulta ou do membro sem relatórios, 404,
// falha) = sem dados: os cartões somem, sem tela de erro.
// ============================================================

export function useVendidosNaPromocao(companyId: string | undefined, lista: ItemDaLista[], status: "ativa" | "encerrada") {
  var janela: JanelaDosVendidos | null = janelaDosVendidos(lista, status);
  var q = useQuery({
    queryKey: [CHAVE_PROMOCOES, companyId, "vendidos", status, janela && janela.desde, janela && janela.ate],
    queryFn: () => promocoesApi.vendidos(companyId!, pedidoDaJanela(janela!, new Date(Date.now()))),
    enabled: !!companyId && !!janela,
    staleTime: 60000,
    retry: false,
  });
  return {
    janela: janela,
    dados: q.isSuccess ? q.data : null,
  };
}
