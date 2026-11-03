import { useQuery } from "@tanstack/react-query";
import { priceAdjustmentsApi } from "@/services/priceAdjustmentsApi";

// p-52 (30/10/2026): o botão "Ajustar preço" só aparece com o backend do
// reajuste no ar (Aura-backend#939). Rota ausente (404) = escondido.
// Por empresa ativa (multi-CNPJ): trocou de empresa, confere de novo.
export function useReajusteDisponivel(companyId: string | null | undefined, ligado: boolean): boolean {
  var { data } = useQuery({
    queryKey: ["reajuste-preco-disponivel", companyId],
    queryFn: function () { return priceAdjustmentsApi.disponivel(companyId as string); },
    enabled: !!companyId && ligado,
    staleTime: 10 * 60000,
    retry: 0,
  });
  return data === true;
}
