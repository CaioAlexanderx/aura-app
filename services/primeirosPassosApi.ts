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

// 07/10/2026 — o cliente (dono/admin) troca a própria frente em
// Configurações: PATCH /companies/:id/segment (routes/companySegment.js).
//   extras ausente = não mexe na Ordem de Serviço; [] = desliga; ["os"] = liga.
//   400 SEGMENT_INVALID · 403 (membro comum) · 409 STUDIO_PLAN_REQUIRED
//
// 19/10/2026 (tq-33): o check-in manda `only_if_empty: true` — grava só se a
// conta ainda não tem frente. O suporte no backend vem em PR à parte; até lá
// o campo é ignorado. Com ele, frente já existente volta
// { applied: false, segment } (a gravada, sem mudar nada). O cartão
// "Sua frente" de Configurações NÃO manda o campo: lá a troca é consciente.
export type TrocarFrenteBody = { segment: Segmento; extras?: "os"[]; only_if_empty?: boolean };
export type TrocarFrenteResponse = {
  /** Só com only_if_empty: false = a conta já tinha frente e nada mudou. */
  applied?: boolean;
  segment: Segmento | null;
  segment_source: "cnae" | "landing" | "user" | "staff" | null;
  vertical_active: string | null;
  flags: { matcon_enabled: boolean; otica_enabled: boolean; os_enabled: boolean; studio_enabled: boolean };
};

export var frenteApi = {
  trocar: function(companyId: string, body: TrocarFrenteBody) {
    return request<TrocarFrenteResponse>(
      "/companies/" + companyId + "/segment", { method: "PATCH", body: body, retry: 0 }
    );
  },
};

/** Chave do react-query: por empresa. O PendingTourHost invalida o prefixo. */
export function firstStepsQueryKey(companyId: string | null | undefined) {
  return ["first-steps", companyId || null];
}
