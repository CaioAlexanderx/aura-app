import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { caixaApi, type CaixaStatus } from "@/services/caixaApi";

// ============================================================
// AURA. — useCaixa
//
// Hook central do módulo de caixa.
// Busca o status ao vivo (sessão aberta + totais) com refresh
// automático a cada 60s enquanto o componente está montado.
//
// Expõe `invalidate()` para forçar re-fetch imediato após
// operações de abrir/fechar.
//
// 08/05/2026: ajustes pra evitar "flash" de caixa fechado ao
// trocar de aba do navegador. Uso `placeholderData: keepPreviousData`
// pra manter o ultimo `sessaoAtiva` enquanto o refetch acontece +
// `refetchOnWindowFocus: false` pra nao disparar refetch agressivo.
// gcTime grande pra cache nao ser coletado em sessoes longas.
// ============================================================

const QUERY_KEY = "caixa-status";

export function useCaixa() {
  const { token, company } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: [QUERY_KEY, company?.id],
    queryFn: function() {
      if (!company?.id) throw new Error("no company");
      return caixaApi.status(company.id);
    },
    enabled: !!token && !!company?.id,
    staleTime: 30_000,                      // considera fresco por 30s
    gcTime: 30 * 60_000,                    // cache vive 30min em memoria
    refetchInterval: 60_000,                // re-fetch automatico a cada 60s
    refetchOnWindowFocus: false,            // trocar de aba NAO refetcha
    refetchOnReconnect: false,              // reconectar rede NAO refetcha
    placeholderData: keepPreviousData,      // mantem dados anteriores durante refetch
    retry: 1,
  });

  const sessaoAtiva = data?.sessao_ativa || null;

  return {
    sessaoAtiva,
    isAberto:  !!sessaoAtiva,
    isFechado: !sessaoAtiva,
    isLoading,
    isFetching,
    error: error as Error | null,
    invalidate: function() {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, company?.id] });
    },
  };
}
