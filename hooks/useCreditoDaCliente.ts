// ============================================================
// AURA. — Saldo a favor da cliente no Caixa (INC-2026-11-17-03)
//
// Lê GET /companies/:id/pdv/clientes/:cid/credito, sempre da loja ativa:
// o crédito é da cliente NA loja (a mesma regra do saldo do crediário). A
// cliente pode ser de outra loja do mesmo dono — o seletor do Caixa lista a
// carteira do dono —, e o saldo continua sendo o desta loja.
//
// Sem loja, sem cliente ou na demonstração: não consulta e o saldo é 0.
// Erro na leitura também é 0: o Caixa vende como sempre, só sem a caixa do
// crédito (nunca trava a venda por causa dela).
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { pdvApi } from "@/services/pdvApi";

export const CHAVE_DO_CREDITO = "pdv-credito-da-cliente";

export function useCreditoDaCliente(companyId: string | null | undefined, customerId: string | null | undefined, ativo = true) {
  const ligado = !!(ativo && companyId && customerId);
  const q = useQuery({
    queryKey: [CHAVE_DO_CREDITO, companyId || null, customerId || null],
    queryFn: () => pdvApi.creditoDaCliente(companyId as string, customerId as string),
    enabled: ligado,
    staleTime: 0,
    retry: false,
  });
  const saldo = ligado && q.data ? Math.max(0, Number(q.data.saldo_a_favor) || 0) : 0;
  return { saldo, carregando: ligado && q.isLoading };
}
