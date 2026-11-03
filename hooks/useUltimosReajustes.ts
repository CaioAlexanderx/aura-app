import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/services/api";
import { priceAdjustmentsApi } from "@/services/priceAdjustmentsApi";

// "Últimos reajustes" no Estoque (03/11/2026): a entrada só aparece quando a
// lista existe no backend (Aura-backend#940) e a empresa ativa tem ao menos
// um reajuste. Rota ausente (404, backend antigo) ou qualquer falha = sem
// entrada: melhor esconder do que abrir uma tela que não carrega.
// Por empresa ativa (multi-CNPJ): trocou de empresa, confere de novo.
export function ultimosReajustesQueryKey(companyId: string | null | undefined) {
  return ["reajuste-preco-lotes", companyId];
}

export function useUltimosReajustes(companyId: string | null | undefined, ligado: boolean): boolean {
  var { data } = useQuery({
    queryKey: ultimosReajustesQueryKey(companyId),
    queryFn: function () {
      return priceAdjustmentsApi.lista(companyId as string, 1).then(function (r) {
        return (r && r.total) || 0;
      }).catch(function (err) {
        if (err instanceof ApiError && err.status === 404) return 0;
        throw err;
      });
    },
    enabled: !!companyId && ligado,
    staleTime: 5 * 60000,
    retry: 0,
  });
  return ligado && typeof data === "number" && data > 0;
}
