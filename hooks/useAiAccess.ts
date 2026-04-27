// ============================================================
// useAiAccess — gating de IA por plano + opt-in da empresa.
//
// Alinhado ao backend PR18 (src/routes/dentalConsultaAi.js):
//   - plano = 'expansao' (estrito, igual aiChat/dentalAi do servidor)
//   - companies.ai_enabled = true (opt-in via tela de configuracoes)
//   - companies.ai_consent_at preenchido (LGPD)
//
// O backend ainda re-checa tudo no DB; este hook apenas decide
// se o frontend mostra o painel IA real, o placeholder gated, ou
// o card "ative nas configuracoes".
//
// Doc: PLANO_IA_PLANO_EXPANSAO.md
// ============================================================

import { useAuthStore } from "@/stores/auth";

export type AiAccessReason =
  | "ok"
  | "no_company"
  | "plan_below_required"
  | "ai_not_enabled"
  | "consent_required";

export function useAiAccess() {
  const company = useAuthStore((s) => s.company) as any;
  const plan = String(company?.plan || "essencial").toLowerCase();

  // Backend hoje exige strict 'expansao' (vide requireConsultaAi
  // em src/routes/dentalConsultaAi.js). Mantemos a mesma logica
  // pra nao mostrar IA "disponivel" e backend recusar com 403.
  const planAllows = plan === "expansao";
  const aiEnabled  = !!company?.ai_enabled;
  const consented  = !!company?.ai_consent_at;

  let reason: AiAccessReason = "ok";
  if (!company)        reason = "no_company";
  else if (!planAllows) reason = "plan_below_required";
  else if (!aiEnabled)  reason = "ai_not_enabled";
  else if (!consented)  reason = "consent_required";

  return {
    canUseAi: reason === "ok",
    plan,
    requiredPlan: "expansao" as const,
    requiredPlanLabel: "Expansão",
    reason,
    aiEnabled,
    consented,
    upgradeHref: "/(tabs)/configuracoes" as const,
    aiSettingsHref: "/dental/(clinic)/clinica" as const, // tela de settings IA mora aqui
  };
}
