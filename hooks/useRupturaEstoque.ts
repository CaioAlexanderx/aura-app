// ============================================================
// AURA. — useRupturaEstoque (13/10/2026) — "O que vai faltar"
//
// Uma query por (loja ou grupo, data-alvo, janela). A chave leva os três,
// então voltar para uma janela já vista na sessão responde do cache na
// hora, e trocar de loja nunca mostra a conta da anterior.
//
// Multi-CNPJ desde o desenho (regra 2 do CLAUDE.md): no consolidado
// (`consolidatedView`) `company` é null — a chamada vai pela loja
// principal do dono com `escopo=grupo`, e o backend soma as lojas que o
// usuário alcança. Estoque compartilhado entra uma vez só (decisão do
// backend, não refeita aqui).
//
// staleTime curto de propósito: é uma tela de decisão de compra, e estoque
// de ontem engana. O cache serve para a troca de janela, não para
// reabrir a tela uma hora depois.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { estoqueRupturaApi, type RupturaResposta } from "@/services/estoqueRupturaApi";

export const RUPTURA_STALE_MS = 60_000;

export function useRupturaEstoque(params: { ate: string; janela: number }) {
  const { company, token, isDemo, consolidatedView, availableCompanies } = useAuthStore();

  // Consolidado: qualquer loja do grupo serve de :id; a principal é a
  // mesma que as mutações do app usam (hooks/useCustomers.ts).
  let companyId: string | null = company?.id || null;
  if (consolidatedView) {
    const lista = (availableCompanies || []) as any[];
    const principal = lista.find((c) => c.is_primary) || lista[0];
    companyId = principal?.id || null;
  }
  const escopo = consolidatedView ? ("grupo" as const) : undefined;

  const query = useQuery<RupturaResposta>({
    queryKey: ["estoque-ruptura", escopo ? "grupo:" + companyId : companyId, params.ate, params.janela],
    queryFn: () => estoqueRupturaApi.get(companyId as string, { ate: params.ate, janela: params.janela, escopo }),
    enabled: !!token && !!companyId && !isDemo,
    staleTime: RUPTURA_STALE_MS,
    gcTime: 30 * 60_000,
    // request() já tenta duas vezes antes de falhar; repetir aqui só
    // seguraria o spinner por segundos antes do "tentar de novo".
    retry: false,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    consolidatedView,
    isDemo,
  };
}
