import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

var MODULE_PLAN_MAP: Record<string, string> = {
  painel: 'essencial', financeiro: 'essencial', nfe: 'essencial',
  contabilidade: 'essencial', suporte: 'essencial', pdv: 'essencial',
  estoque: 'essencial', configuracoes: 'essencial',
  folha: 'negocio', agendamento: 'negocio', clientes: 'negocio',
  canal: 'negocio', whatsapp: 'negocio',
  agentes: 'expansao',
};
var PLAN_LEVEL: Record<string, number> = { essencial: 0, negocio: 1, expansao: 2 };

// Mapeamento: chave de permissao do toggle -> modulos do sidebar
var PERM_TO_MODULES: Record<string, string[]> = {
  painel:        ['painel'],
  pdv:           ['pdv'],
  estoque:       ['estoque'],
  clientes:      ['clientes', 'canal'],
  financeiro:    ['financeiro', 'nfe'],
  relatorios:    ['contabilidade', 'suporte'],
  folha:         ['folha', 'agendamento'],
  configuracoes: ['configuracoes'],
};

export function useVisibleModules(): Set<string> {
  var { company, token } = useAuthStore();

  var { data: permData } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: function() { return request<any>('/auth/my-permissions'); },
    enabled: !!token,
    staleTime: 5 * 60000,
    retry: 1,
  });

  return useMemo(function() {
    var plan = company?.plan || 'essencial';
    var overrides = (company as any)?.module_overrides || {};
    var level = PLAN_LEVEL[plan] ?? 0;
    var visible = new Set<string>();

    // Step 1: plan-based visibility
    for (var mod of Object.keys(MODULE_PLAN_MAP)) {
      var minPlan = MODULE_PLAN_MAP[mod];
      var minLevel = PLAN_LEVEL[minPlan] ?? 0;
      var ov = overrides[mod];
      if (ov === false) continue;
      if (ov === true || level >= minLevel) visible.add(mod);
    }

    // Step 2: member permission filtering (non-owner only)
    if (permData && !permData.is_owner && permData.permissions) {
      var allowed = new Set<string>();

      // FIX: painel is NO LONGER hardcoded — controlled by permissions.painel
      // If painel permission is not explicitly set, default to true for backward compat
      var painelPerm = permData.permissions.painel;
      if (painelPerm === undefined || painelPerm === true) {
        allowed.add('painel');
      }

      for (var permKey of Object.keys(PERM_TO_MODULES)) {
        if (permKey === 'painel') continue; // already handled above
        if (permData.permissions[permKey]) {
          var modules = PERM_TO_MODULES[permKey];
          modules.forEach(function(m) { allowed.add(m); });
        }
      }

      // Intersection: modulo precisa passar no plano E na permissao
      for (var m of visible) {
        if (!allowed.has(m)) visible.delete(m);
      }
    }

    return visible;
  }, [company?.plan, (company as any)?.module_overrides, permData]);
}

export { MODULE_PLAN_MAP, PLAN_LEVEL };
