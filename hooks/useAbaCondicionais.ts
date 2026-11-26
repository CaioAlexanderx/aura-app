// ============================================================
// AURA. — A aba Condicionais existe? (C4, 25/11/2026)
//
// Trava CONDICIONAL_LIBERADA + módulo vendas.condicionais (plano, override e
// permissão do membro), no mesmo desenho de useAbaPedidos (hooks/usePedidos).
// Com a trava desligada, nenhuma consulta sai daqui e o /auth/me não é
// chamado a mais: a tela de Vendas fica a de hoje. Ligada, o /auth/me é
// revalidado ao montar (plano stale no JWT, armadilha 1 do CLAUDE.md).
// ============================================================
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { computeVisibleModules } from "@/hooks/useVisibleModules";
import { permissionsQueryKey } from "@/utils/permissionsQueryKey";
import { condicionalLiberada, MODULO_CONDICIONAIS } from "@/utils/condicionalLiberada";

export function useAbaCondicionais(): { visivel: boolean } {
  const { user, company, token, consolidatedView, isHydrated, refreshMe } = useAuthStore() as any;
  const liberada = condicionalLiberada(user);

  // A mesma consulta (e a mesma chave) de useVisibleModules, só LIGADA com a
  // trava liberada.
  const permissoes = useQuery({
    queryKey: permissionsQueryKey(company?.id, consolidatedView),
    queryFn: function() { return request<any>("/auth/my-permissions"); },
    enabled: liberada && !!token,
    staleTime: 5 * 60000,
    retry: 1,
  });

  useEffect(() => {
    if (!liberada) return;
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [liberada, refreshMe]);

  const visivel = useMemo(() => {
    if (!liberada || !isHydrated || !token || permissoes.isPending) return false;
    return computeVisibleModules(company?.plan, company?.module_overrides, permissoes.data).has(MODULO_CONDICIONAIS);
  }, [liberada, isHydrated, token, permissoes.isPending, permissoes.data, company?.plan, company?.module_overrides]);
  return { visivel };
}
