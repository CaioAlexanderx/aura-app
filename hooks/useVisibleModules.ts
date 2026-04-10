import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

const MODULE_PLAN_MAP: Record<string, string> = {
  painel: 'essencial', financeiro: 'essencial', nfe: 'essencial',
  contabilidade: 'essencial', suporte: 'essencial', pdv: 'essencial',
  estoque: 'essencial', configuracoes: 'essencial',
  folha: 'negocio', agendamento: 'negocio', clientes: 'negocio',
  canal: 'negocio', whatsapp: 'negocio',
  agentes: 'expansao',
};
const PLAN_LEVEL: Record<string, number> = { essencial: 0, negocio: 1, expansao: 2 };

// Mapeamento: chave de permissao do toggle → modulos do sidebar
const PERM_TO_MODULES: Record<string, string[]> = {
  pdv:           ['pdv'],
  estoque:       ['estoque'],
  clientes:      ['clientes', 'canal'],
  financeiro:    ['financeiro', 'nfe'],
  relatorios:    ['contabilidade', 'suporte'],
  folha:         ['folha', 'agendamento'],
  configuracoes: ['configuracoes'],
};

export function useVisibleModules(): Set<string> {
  const { company, token } = useAuthStore();

  const { data: permData } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: () => request<any>('/auth/my-permissions'),
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return useMemo(() => {
    const plan = company?.plan || 'essencial';
    const overrides = (company as any)?.module_overrides || {};
    const level = PLAN_LEVEL[plan] ?? 0;
    const visible = new Set<string>();

    // Step 1: plan-based visibility
    for (const [mod, minPlan] of Object.entries(MODULE_PLAN_MAP)) {
      const minLevel = PLAN_LEVEL[minPlan] ?? 0;
      const ov = overrides[mod];
      if (ov === false) continue;
      if (ov === true || level >= minLevel) visible.add(mod);
    }

    // Step 2: member permission filtering (non-owner only)
    if (permData && !permData.is_owner && permData.permissions) {
      const allowed = new Set<string>();
      allowed.add('painel'); // dashboard sempre visivel

      for (const [permKey, modules] of Object.entries(PERM_TO_MODULES)) {
        if (permData.permissions[permKey]) {
          modules.forEach(m => allowed.add(m));
        }
      }

      // Interseccao: modulo precisa passar no plano E na permissao
      for (const mod of visible) {
        if (!allowed.has(mod)) visible.delete(mod);
      }
    }

    return visible;
  }, [company?.plan, (company as any)?.module_overrides, permData]);
}

export { MODULE_PLAN_MAP, PLAN_LEVEL };
