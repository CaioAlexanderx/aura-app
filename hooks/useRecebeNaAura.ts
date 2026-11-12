// ============================================================
// useRecebeNaAura — quem vê as telas do Recebe na Aura (RA-06, 12/11/2026)
//
// Regra do Caio: com RECEBE_NA_AURA_ENABLED desligada, NENHUM lojista vê
// item de menu, rota, botão nem aviso novo, e a rota direta não abre.
//
//  - Lojista: a tela só existe se o backend responder 200 em
//    GET /companies/:id/recebe/status (flag ligada E dono/admin) E o módulo
//    recebe.status estiver visível. 404 (flag desligada), 403 (não é dono
//    nem admin) ou erro de rede: a tela some e a rota manda embora.
//  - Equipe: conta com is_staff GRAVADO no usuário (veio do JWT / do
//    /auth/me) entra em modo prévia quando o servidor recusa, com dados de
//    exemplo marcados. NUNCA pelo domínio do e-mail e NUNCA pelo plano.
//    Por isso não usa o `isStaff` do store, que ainda olha o domínio.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { recebeApi, type RecebeStatus } from "@/services/recebeApi";

export const RECEBE_STATUS_QUERY_KEY = "recebe-status";

/** Só o que está gravado no usuário. Domínio do e-mail não conta. */
export function ehContaDaEquipe(user: any): boolean {
  return !!user && user.is_staff === true;
}

export type AcessoAoRecebe =
  | { estado: "carregando" }
  | { estado: "fora" }
  | { estado: "liberado"; status: RecebeStatus }
  | { estado: "previa_da_equipe"; motivo: string };

export function useRecebeNaAura() {
  const { user, company } = useAuthStore() as any;
  const equipe = ehContaDaEquipe(user);
  const modulos = useVisibleModules();
  const modulosProntos = useVisibleModulesProntos();
  const companyId: string | undefined = company?.id;

  const q = useQuery({
    queryKey: [RECEBE_STATUS_QUERY_KEY, companyId],
    queryFn: () => recebeApi.getStatus(companyId as string),
    enabled: !!companyId,
    retry: false,
    staleTime: 30_000,
  });

  let acesso: AcessoAoRecebe;
  if (!companyId) {
    acesso = { estado: equipe ? "previa_da_equipe" : "fora", motivo: "sem empresa" } as AcessoAoRecebe;
  } else if (q.isLoading || (!equipe && !modulosProntos)) {
    acesso = { estado: "carregando" };
  } else if (q.isSuccess && q.data && (equipe || modulos.has("recebe.status"))) {
    acesso = { estado: "liberado", status: q.data };
  } else if (equipe) {
    const err: any = q.error;
    const motivo = err?.status === 404
      ? "RECEBE_NA_AURA_ENABLED desligada no servidor"
      : err?.status === 403
        ? "esta conta não é dona nem admin desta empresa"
        : "o servidor não respondeu";
    acesso = { estado: "previa_da_equipe", motivo };
  } else {
    acesso = { estado: "fora" };
  }

  return { acesso, equipe, query: q, companyId };
}
