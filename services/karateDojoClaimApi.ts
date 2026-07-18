// ============================================================
// AURA KARATÊ — API pública de CLAIM da conta do dojô (F0 / Canal B)
//
// O sensei recebe por e-mail um convite com link único:
//   https://app.getaura.com.br/karate/claim?t={token}
// e cria aqui a conta Aura PRÓPRIA do dojô (company karate_dojo).
//
// Rotas públicas (SEM auth) — contrato do Aura-backend #397:
//   POST /public/karate/dojo-claim/verify   {token}
//     → 200 { dojoName, federationName, email }  (email já mascarado)
//     → 404 (token desconhecido — resposta genérica)
//     → 409 (claim já realizado)
//     → 410 (convite expirado)
//   POST /public/karate/dojo-claim/complete {token, name, password}
//     → 200 (sem auto-login; a tela manda para o login)
//     → 409 CLAIM_JA_REALIZADO | 410 (expirado)
//
// De propósito NÃO usa o request() de services/api.ts: estas rotas nunca
// devem levar Authorization (mesmo padrão de services/karateDojoPortalApi.ts).
// ============================================================
const API = process.env.EXPO_PUBLIC_API_URL ?? "";
const BASE = `${API}/api/v1/public/karate/dojo-claim`;

export interface ClaimVerifyResult {
  dojoName: string;
  federationName: string;
  /** E-mail mascarado pelo backend (ex.: "c•••o@d•••.com.br") — nunca o completo. */
  email: string;
}

/** Erro com status HTTP exposto — a tela diferencia 404 (inválido) ≠ 409 (já usado) ≠ 410 (expirado). */
export class ClaimError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

async function handle<T>(r: Response): Promise<T> {
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && (data.error || data.message)) || `Erro ${r.status}`;
    throw new ClaimError(msg, r.status, data?.code);
  }
  return data as T;
}

function post(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const karateDojoClaimApi = {
  /** Valida o token do convite e devolve os dados para o card de confirmação. */
  verify: (token: string): Promise<ClaimVerifyResult> =>
    post("/verify", { token }).then(handle<ClaimVerifyResult>),

  /** Cria a conta do dojô. Não faz auto-login — a tela oferece "Ir para o login". */
  complete: (token: string, name: string, password: string): Promise<{ ok?: boolean }> =>
    post("/complete", { token, name, password }).then(handle<{ ok?: boolean }>),
};
