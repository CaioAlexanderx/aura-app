// ============================================================
// useAiAccess — gating de IA por plano.
//
// Padrao alinhado com o restante do app (pdv.tsx, configuracoes.tsx,
// AIFinancialInsights.tsx etc): IA disponivel em planos Negocio+
// (negocio | expansao | personalizado).
//
// Usado pelo Modo Consulta pra mostrar painel IA real ou placeholder
// gated. Quando backend de IA do consulta sair (PR18), este hook
// continua sendo a fonte unica da verdade.
//
// PLANO_IA_PLANO_EXPANSAO.md descreve a feature completa.
// ============================================================

import { useAuthStore } from "@/stores/auth";

export type AiAccessReason = "ok" | "no_company" | "plan_below_required" | "feature_disabled";

const PLANS_WITH_AI = ["negocio", "expansao", "personalizado"] as const;
type PlanWithAi = (typeof PLANS_WITH_AI)[number];

function isPlanWithAi(plan: string): plan is PlanWithAi {
  return (PLANS_WITH_AI as readonly string[]).indexOf(plan) >= 0;
}

export function useAiAccess() {
  const company = useAuthStore((s) => s.company) as any;
  const plan = String(company?.plan || "essencial").toLowerCase();
  const planAllows = isPlanWithAi(plan);

  // Futuramente, quando companies.ai_enabled existir (migration 071),
  // somar essa checagem aqui. Hoje so o plano gateia.
  const aiEnabled = planAllows;

  let reason: AiAccessReason = "ok";
  if (!company) reason = "no_company";
  else if (!planAllows) reason = "plan_below_required";
  else if (!aiEnabled) reason = "feature_disabled";

  return {
    canUseAi: reason === "ok",
    plan,
    requiredPlan: "negocio" as const,
    requiredPlanLabel: "Negócio",
    reason,
    upgradeHref: "/(tabs)/configuracoes" as const,
  };
}
