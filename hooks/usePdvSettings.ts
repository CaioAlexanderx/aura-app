import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA. — Hook de configuracoes do PDV/Caixa
//
// Le companies/:id/pdv-settings (cache infinito, invalida ao salvar).
// Default = require_customer:false, require_seller:false (nao bloqueia).
// ============================================================

const DEFAULT: PdvSettings = { require_customer: false, require_seller: false };

export function usePdvSettings() {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pdv-settings", company?.id],
    queryFn: function() { return pdvSettingsApi.get(company!.id); },
    enabled: !!company?.id,
    staleTime: Infinity,
    retry: 1,
  });

  return {
    settings: (data?.settings as PdvSettings) || DEFAULT,
    isLoading: isLoading,
    invalidate: function() { qc.invalidateQueries({ queryKey: ["pdv-settings", company?.id] }); },
  };
}

// Helper: valida se uma venda pode ser finalizada baseado nos settings.
// Retorna { ok: boolean, missing: string[] } — missing eh array de campos
// faltantes em formato amigavel pro toast.
export function validateSaleAgainstSettings(
  settings: PdvSettings,
  ctx: { customerId: string | null; sellerId: string | null; sellerName: string | null }
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (settings.require_customer && !ctx.customerId) {
    missing.push("cliente");
  }
  if (settings.require_seller && !ctx.sellerId && !(ctx.sellerName && ctx.sellerName.trim())) {
    missing.push("vendedora");
  }
  return { ok: missing.length === 0, missing: missing };
}
