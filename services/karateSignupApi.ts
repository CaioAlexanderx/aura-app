// ============================================================
// AURA DOJÔ — F11: dados públicos usados pela TELA DE CADASTRO
//
//   GET /public/karate/federations  ->  { federations: [{ id, name }] }
//
// Arquivo separado de propósito: services/karatePublicApi.ts é o portal
// público do praticante/sensei (lookup, roster, PIX) e todas as chamadas
// dele partem de um :slug/token de UMA federação já conhecida. Aqui é o
// oposto — quem chama ainda NÃO tem conta e precisa justamente descobrir
// quais federações existem para escolher a sua.
//
// Usa fetch direto (sem Authorization) pelo mesmo motivo de
// karatePublicApi.ts e do lookup de CNPJ em app/(auth)/register.tsx: no
// cadastro não há token nem store hidratada.
// ============================================================

function apiBase(): string {
  return (
    (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
    "https://aura-backend-production-f805.up.railway.app/api/v1"
  );
}

/** Uma federação no seletor do cadastro. O backend devolve SÓ id + nome. */
export interface SignupFederation {
  id: string;
  name: string;
}

export const karateSignupApi = {
  /**
   * Federações ativas disponíveis para o dojô escolher no cadastro.
   *
   * ⚠️ Escolher a federação aqui é DECLARAÇÃO DE INTENÇÃO, não filiação: a
   * conta nasce apontando para a federação (companies.federation_id, que é o
   * vínculo TÉCNICO de roteamento) mas com karate_dojo_linked_at NULO. Quem
   * filia é o ACEITE da federação, depois, via
   * POST /federation/:id/dojo/connection → inbox da federação.
   *
   * Lista vazia é resposta legítima (nunca lança por isso) — a tela deve
   * mostrar estado vazio em vez de erro. Timeout curto: é um seletor de
   * formulário, não pode travar o cadastro.
   */
  listFederations: async (timeoutMs = 8000): Promise<SignupFederation[]> => {
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      const res = await fetch(`${apiBase()}/public/karate/federations`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller?.signal,
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.federations) ? data.federations : [];
      return list
        .filter((f: any) => f && f.id && f.name)
        .map((f: any) => ({ id: String(f.id), name: String(f.name) }));
    } finally {
      if (timer) clearTimeout(timer);
    }
  },
};
