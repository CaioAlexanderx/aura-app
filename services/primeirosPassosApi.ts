import { request } from "./api";

// ============================================================
// Primeiros passos da frente (backend: routes/onboardingFirstSteps.js,
// Aura-backend #786). Por empresa (por CNPJ). O backend só devolve chaves
// estáveis; os textos moram em constants/primeirosPassos.ts.
// ============================================================

export type Segmento = "varejo" | "matcon" | "otica" | "assistencia" | "studio" | "outro";

export type FirstStepsResponse = {
  segment: Segmento | null;
  dismissed: boolean;
  steps: { key: string; done: boolean }[];
};

export var primeirosPassosApi = {
  get: function(companyId: string) {
    return request<FirstStepsResponse>("/companies/" + companyId + "/onboarding/first-steps", { retry: 1 });
  },
  dismiss: function(companyId: string) {
    return request<{ dismissed: true; dismissed_at: string }>(
      "/companies/" + companyId + "/onboarding/first-steps/dismiss", { method: "POST", retry: 0 }
    );
  },
};

/** Chave do react-query: por empresa. O PendingTourHost invalida o prefixo. */
export function firstStepsQueryKey(companyId: string | null | undefined) {
  return ["first-steps", companyId || null];
}
