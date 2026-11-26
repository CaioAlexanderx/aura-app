// ============================================================
// AURA. — Nova condicional · as peças da loja escolhida (C6)
//
// GET /products da loja de onde as peças saem (no consolidado, a loja
// escolhida antes do passo 1) e as variantes sob demanda, com o mesmo cache
// do seletor de variante (utils/cacheDeVariacoes). Os campos de "com
// clientes" e reserva vêm crus no produto (livre.ts).
// ============================================================
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { pdvApi } from "@/services/pdvApi";
import { guardarVariacoes, variacoesEmCache } from "@/utils/cacheDeVariacoes";
import { produtosDaResposta, variantesDoProduto, type ProdutoDaBusca, type VarianteDaBusca } from "./busca";

export function usePecasDaLoja(lojaId: string | null | undefined, ativo: boolean) {
  const { data, isLoading } = useQuery({
    queryKey: ["condicional-pecas", lojaId],
    queryFn: () => companiesApi.products(lojaId as string),
    enabled: !!lojaId && ativo,
    staleTime: 30000,
    retry: 1,
  });

  const produtos: ProdutoDaBusca[] = useMemo(() => produtosDaResposta(data), [data]);

  const variantesDe = useCallback(async (produto: ProdutoDaBusca): Promise<VarianteDaBusca[]> => {
    if (!lojaId) return [];
    // Sempre o servidor (o estoque é o de agora); o cache só guarda para o seletor do Caixa.
    try {
      const res = await companiesApi.variants(lojaId, produto.id);
      const lista = res?.variants || [];
      guardarVariacoes(lojaId, produto.id, lista);
      return variantesDoProduto(produto, lista);
    } catch {
      const doCache = variacoesEmCache(lojaId, produto.id);
      return doCache ? variantesDoProduto(produto, doCache) : [];
    }
  }, [lojaId]);

  // O catálogo vem inteiro (até 20 mil itens); o que não está nele o servidor confere
  // com o mesmo bipe do Caixa (GET /pdv/scan/:code).
  const acharNoServidor = useCallback(async (codigo: string): Promise<{ produto: ProdutoDaBusca; variantId: string | null } | null> => {
    if (!lojaId) return null;
    const r: any = await pdvApi.scan(lojaId, codigo);
    if (r?.match !== "exact" || !r.product) return null;
    const local = produtos.find((p) => p.id === String(r.product.id));
    const produto = local || produtosDaResposta([r.product])[0];
    return produto ? { produto, variantId: r.variant_id ? String(r.variant_id) : null } : null;
  }, [lojaId, produtos]);

  return { produtos, carregando: isLoading, variantesDe, acharNoServidor };
}
