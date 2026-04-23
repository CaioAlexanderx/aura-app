import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA. — Hook das configuracoes do PDV
//
// Cache infinito por sessao (so muda quando cliente edita).
// Retorna defaults seguros se ainda nao carregou.
// Hook expõe `invalidate()` pra forcar re-fetch apos save manual.
// ============================================================

const DEFAULT_SETTINGS: PdvSettings = {
  require_customer: false,
  require_seller: false,
};

export function usePdvSettings() {
  const { token, company } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["pdv-settings", company?.id],
    queryFn: function() {
      if (!company?.id) throw new Error("no company");
      return pdvSettingsApi.get(company.id);
    },
    enabled: !!token && !!company?.id,
    staleTime: Infinity,
    retry: 1,
  });

  return {
    settings: (data?.settings as PdvSettings | undefined) || DEFAULT_SETTINGS,
    isLoading: isLoading,
    error: error as Error | null,
    invalidate: function() { qc.invalidateQueries({ queryKey: ["pdv-settings", company?.id] }); },
  };
}
