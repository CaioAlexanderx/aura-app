// ============================================================
// AURA. — A loja já tem produto? (19/10/2026, cards tq-31 e tq-32)
//
// "Fazer a primeira venda" leva ao cadastro do primeiro produto só quando a
// loja ainda não tem nenhum; com produto, direto ao Caixa. Pergunta barata:
// GET /companies/:id/products?limit=1 devolve { products, total } — o total
// é o COUNT do servidor, sem trazer a lista inteira (o Estoque usa
// limit=20000 com outra chave de cache).
//
// Erro de rede = null ("não sei"): quem decide trata como sem produto, e o
// cadastro segue para o Caixa depois de salvar — nunca um beco sem saída.
// Por empresa (por CNPJ): a chave muda com a empresa ativa.
// ============================================================
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { temProdutoNaResposta } from "@/utils/checkinDestino";

export function temProdutoQueryKey(companyId: string | null | undefined) {
  return ["tem-produto", companyId || null];
}

async function buscar(companyId: string): Promise<boolean | null> {
  try {
    return temProdutoNaResposta(await request<unknown>("/companies/" + companyId + "/products?limit=1", { retry: 0, timeout: 6000 }));
  } catch {
    return null;
  }
}

const OPCOES = { retry: false as const, staleTime: 30_000, gcTime: 10 * 60_000 };

export function useTemProduto(companyId: string | null | undefined, enabled: boolean) {
  return useQuery<boolean | null>({
    queryKey: temProdutoQueryKey(companyId),
    enabled: enabled && !!companyId,
    refetchOnWindowFocus: false,
    ...OPCOES,
    queryFn: () => buscar(companyId as string),
  });
}

/** Para o toque: usa o cache se houver, senão busca (com o mesmo fallback). */
export function garantirTemProduto(qc: QueryClient, companyId: string): Promise<boolean | null> {
  return qc.fetchQuery<boolean | null>({
    queryKey: temProdutoQueryKey(companyId),
    ...OPCOES,
    queryFn: () => buscar(companyId),
  }).catch(() => null);
}
