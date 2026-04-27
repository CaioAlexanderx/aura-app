// ============================================================
// useDentalAiConsulta + useDentalAiUsage + useDentalAiSettings
// Hooks React Query pros endpoints da IA (PR19).
//
// useDentalAiConsulta -> mutation por intent
// useDentalAiUsage    -> query do uso/custo do mes
// useDentalAiSettings -> query do estado + mutations de toggle/consent
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import {
  dentalAiApi,
  type AiConsultaRequest, type AiConsultaResponse,
  type AiUsageResponse, type AiSettingsResponse,
} from "@/services/dentalAiApi";

// ──────────────────────────────────────────────────────────────
// Mutation: chamar a IA com um intent.
// Usar uma instancia por componente que precisa (cada modal,
// cada botao). React Query nao cacheia mutations.
// ──────────────────────────────────────────────────────────────
export function useDentalAiConsulta() {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  return useMutation<AiConsultaResponse, any, AiConsultaRequest>({
    mutationFn: (req) => {
      if (!cid) throw new Error("Sem company_id");
      return dentalAiApi.consulta(cid, req);
    },
    onSuccess: () => {
      // Atualiza badge de uso/custo no settings card
      qc.invalidateQueries({ queryKey: ["dental-ai-usage", cid] });
      qc.invalidateQueries({ queryKey: ["dental-ai-settings", cid] });
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Query: estatisticas do mes corrente
// ──────────────────────────────────────────────────────────────
export function useDentalAiUsage(opts?: { enabled?: boolean }) {
  const cid = useAuthStore().company?.id;
  return useQuery<AiUsageResponse>({
    queryKey: ["dental-ai-usage", cid],
    queryFn: () => dentalAiApi.usage(cid!),
    enabled: !!cid && opts?.enabled !== false,
    staleTime: 60_000, // 1 min — uso nao muda freneticamente
  });
}

// ──────────────────────────────────────────────────────────────
// Query + mutations de settings (tela /clinica)
// ──────────────────────────────────────────────────────────────
export function useDentalAiSettings(opts?: { enabled?: boolean }) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const query = useQuery<AiSettingsResponse>({
    queryKey: ["dental-ai-settings", cid],
    queryFn: () => dentalAiApi.settings(cid!),
    enabled: !!cid && opts?.enabled !== false,
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: (body: { ai_enabled: boolean; accept_consent?: boolean }) =>
      dentalAiApi.toggle(cid!, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["dental-ai-settings", cid] });
      // Atualiza o auth store pra useAiAccess refletir imediatamente
      const auth = useAuthStore.getState();
      if (auth.company) {
        useAuthStore.setState({
          company: {
            ...auth.company,
            ai_enabled: variables.ai_enabled,
            ai_consent_at: variables.accept_consent
              ? new Date().toISOString()
              : (auth.company as any).ai_consent_at,
          } as any,
        });
      }
    },
  });

  const acceptConsent = useMutation({
    mutationFn: () => dentalAiApi.acceptConsent(cid!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["dental-ai-settings", cid] });
      const auth = useAuthStore.getState();
      if (auth.company) {
        useAuthStore.setState({
          company: { ...auth.company, ai_consent_at: data.consent_at } as any,
        });
      }
    },
  });

  return { ...query, toggle, acceptConsent };
}
