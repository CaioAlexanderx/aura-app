// ============================================================
// AURA. — Cliente no Caixa: quem pode vincular cliente à venda
//
// Criado: 13/10/2026 (INC-2026-10-13-01)
//
// O botão "Cliente" (F3) do Caixa ficava desabilitado no Essencial, com a
// dica "Disponível no plano Negócio". Causa: usePdvState decidia por conta
// própria (`isModuleEnabled("clientes", isNegocioPlus)`), enquanto o resto do
// produto já tinha Clientes no Essencial desde 11/05/2026 (MODULE_PLAN_MAP no
// app; GET e POST /customers sem requirePlan no backend, limite de 1.000).
//
// Agora a decisão sai da MESMA fonte do menu: MODULE_PLAN_MAP + override da
// empresa (computeVisibleModules). Se o plano mínimo de `clientes` mudar no
// mapa, o Caixa acompanha sozinho, sem segunda lista para esquecer.
//
// Só plano e override: permissão de membro NÃO entra aqui (o Caixa nunca
// filtrou por ela, e este arquivo não muda esse comportamento).
// ============================================================
import { computeVisibleModules } from "@/hooks/useVisibleModules";

export function clientesNoCaixaHabilitado(
  plan: string | null | undefined,
  overrides: Record<string, boolean> | null | undefined
): boolean {
  return computeVisibleModules(plan, overrides, null).has("clientes");
}
