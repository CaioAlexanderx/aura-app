// ============================================================
// AURA. — useCheckin / useCheckinGate (14/10/2026, cartão t1-12 parte 2)
//
// useCheckin: GET /companies/:id/checkin, uma vez por sessão, sem retry.
// Erro de rede, 404 (backend ainda sem a rota) ou resposta fora do formato
// viram `null` — "não mostrar". O check-in nunca bloqueia a entrada.
//
// useCheckinGate: montado no Painel (app/(tabs)/index.tsx). Se a loja deve
// ver o check-in, leva a /checkin UMA vez por sessão (depois da escolha de
// frente, antes do Painel). O Painel renderiza normalmente enquanto o GET
// não volta: nada espera por ele.
// ============================================================
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { MOD_CHECKIN } from "@/constants/checkin";
import { checkinApi, checkinQueryKey, type CheckinEstado } from "@/services/checkinApi";
import { deveMostrarCheckin, lerCheckin } from "@/utils/checkinRegras";

export const ROTA_CHECKIN = "/checkin";

// Uma vez por aba/sessão: voltar ao Painel não reabre a tela (nem se o
// backend demorar a refletir "respondido").
let jaLevou = false;
/** Só para testes. */
export function __zerarCheckinDaSessao(): void { jaLevou = false; }

export function useCheckin(companyId: string | null | undefined, enabled: boolean) {
  return useQuery<CheckinEstado | null>({
    queryKey: checkinQueryKey(companyId),
    enabled: enabled && !!companyId,
    retry: false,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        return lerCheckin(await checkinApi.get(companyId as string));
      } catch {
        return null;
      }
    },
  });
}

export function useCheckinGate(): void {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const company = useAuthStore((s) => s.company);
  const isStaff = useAuthStore((s) => s.isStaff);
  const isDemo = useAuthStore((s) => s.isDemo);
  const consolidado = useAuthStore((s) => s.consolidatedView);
  const modulos = useVisibleModules();

  const ctx = {
    temEmpresa: !!company?.id,
    isStaff: !!isStaff,
    isDemo: !!isDemo,
    consolidado: !!consolidado,
    papel: (company as any)?.member_role as string | undefined,
    moduloVisivel: modulos.has(MOD_CHECKIN),
  };
  // Só consulta quando o contexto já permite mostrar: conta interna, demo,
  // consolidado ou membro comum nem fazem a chamada.
  const pode = !!token && deveMostrarCheckin(
    { habilitado: true, respondido: false, pulou: false, versao: null, respostas: {} }, ctx,
  );

  const { data } = useCheckin(company?.id, pode);
  const mostrar = pode && deveMostrarCheckin(data, ctx);

  useEffect(() => {
    if (!mostrar || jaLevou) return;
    jaLevou = true;
    router.replace(ROTA_CHECKIN as any);
  }, [mostrar, router]);
}
