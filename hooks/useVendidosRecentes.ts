// ============================================================
// AURA. — useVendidosRecentes (QA De/Por, 08/11/2026)
//
// Produtos que venderam nos últimos 60 dias na empresa ativa, para a opção
// "Parados há 60 dias ou mais" do assistente da Promoção em lote. A conta e
// as fontes estão em services/vendasRecentesApi.ts. Uma query por (empresa,
// dia): reabrir o assistente no mesmo dia responde do cache por 5 minutos.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { vendidosNosUltimos60Dias } from "@/services/vendasRecentesApi";

export function useVendidosRecentes(companyId: string | null | undefined, hoje: string) {
  var q = useQuery<Record<string, true>>({
    queryKey: ["de-por-vendidos-60d", companyId, hoje],
    queryFn: function () { return vendidosNosUltimos60Dias(companyId as string, hoje); },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return {
    vendidos: q.data || null,
    carregando: q.isLoading,
    erro: q.isError,
    refetch: q.refetch,
  };
}
