import { request } from "./api";

// ============================================================
// Oferta "vamos configurar juntos" (backend: routes/onboardingSetupCall.js)
//
//   GET  /companies/:companyId/onboarding/setup-call
//        → { disponivel, solicitado, dispensado }
//   POST /companies/:companyId/onboarding/setup-call  { acao }
//        → { registrado, acao, motivo? }
//
// `acao`: "solicitou" (tocou em "Marcar pelo WhatsApp") ou "dispensou"
// (tocou em "Agora não"). O backend grava os eventos
// onboarding.setup_call_requested / _dismissed em audit_log, uma vez por
// empresa, para o painel medir. Erro de rede ou 404 (backend sem a rota) =
// "não mostrar": o cartão nunca atrapalha o Painel.
// ============================================================

export type SetupCallEstado = {
  disponivel: boolean;
  solicitado: boolean;
  dispensado: boolean;
};

export type SetupCallAcao = "solicitou" | "dispensou";

export var setupCallApi = {
  get: function(companyId: string) {
    // retry 0: um GET que falha vira "não mostrar", sem segurar o Painel.
    return request<unknown>("/companies/" + companyId + "/onboarding/setup-call", { retry: 0, timeout: 6000 });
  },
  registrar: function(companyId: string, acao: SetupCallAcao) {
    return request<unknown>("/companies/" + companyId + "/onboarding/setup-call", {
      method: "POST", body: { acao: acao }, retry: 0,
    });
  },
};

/** Lê o GET com defesa: fora do formato vira null ("não mostrar"). */
export function lerSetupCall(raw: unknown): SetupCallEstado | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.disponivel !== "boolean") return null;
  return { disponivel: r.disponivel, solicitado: r.solicitado === true, dispensado: r.dispensado === true };
}

/** Chave do react-query: por empresa. */
export function setupCallQueryKey(companyId: string | null | undefined) {
  return ["setup-call", companyId || null];
}
