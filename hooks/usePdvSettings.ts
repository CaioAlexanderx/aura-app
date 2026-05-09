import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA. — Hook das configuracoes do PDV
//
// Cache infinito por sessao (so muda quando cliente edita).
// Retorna defaults seguros se ainda nao carregou.
// Hook expõe `invalidate()` pra forcar re-fetch apos save manual.
//
// 09/05/2026: caixa_enabled e crediario_enabled passam a default=true.
// Antes default era false (gateava recursos), mas decisao do produto e
// que essas funcionalidades vem ativadas pra todas as empresas — quem
// nao usa simplesmente desliga em Configuracoes > PDV > Politicas do
// Caixa. Backend tambem atualizado (migration 106 + ALTER COLUMN DEFAULT).
// ============================================================

const DEFAULT_SETTINGS: PdvSettings = {
  require_customer:  false,
  require_seller:    false,
  caixa_enabled:     true,
  crediario_enabled: true,
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

// ============================================================
// validateSaleAgainstSettings — verifica se a venda atende as
// politicas configuradas (require_customer/require_seller).
//
// Usado pelo PDV antes de chamar finalizeSale(). Retorna lista
// de campos faltando em portugues pra mostrar mensagem amigavel.
//
// Considera vendedora preenchida se sellerId OU sellerName livre
// estiver setado (alguns clientes preenchem manual sem cadastrar
// funcionario formal).
// ============================================================

export type SaleContext = {
  customerId?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
};

export type SaleValidation = {
  ok: boolean;
  missing: string[]; // ex: ["cliente", "vendedora"]
};

export function validateSaleAgainstSettings(
  settings: PdvSettings | null | undefined,
  ctx: SaleContext
): SaleValidation {
  const missing: string[] = [];
  const s = settings || DEFAULT_SETTINGS;

  if (s.require_customer && !ctx.customerId) {
    missing.push("cliente");
  }
  if (s.require_seller && !ctx.sellerId && !(ctx.sellerName || "").trim()) {
    missing.push("vendedora");
  }

  return { ok: missing.length === 0, missing: missing };
}
