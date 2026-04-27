// ============================================================
// useDentalAiConsulta + useDentalAiUsage + useDentalAiSettings
// Hooks React Query pros endpoints da IA (PR19).
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import {
  dentalAiApi,
  type AiConsultaRequest, type AiConsultaResponse,
  type AiUsageResponse, type AiSettingsResponse,
} from "@/services/dentalAiApi";

export function useDentalAiConsulta() {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  return useMutation<AiConsultaResponse, any, AiConsultaRequest>({
    mutationFn: (req) => {
      if (!cid) throw new Error("Sem company_id");
      return dentalAiApi.consulta(cid, req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-ai-usage", cid] });
      qc.invalidateQueries({ queryKey: ["dental-ai-settings", cid] });
    },
  });
}

export function useDentalAiUsage(opts?: { enabled?: boolean }) {
  const cid = useAuthStore().company?.id;
  return useQuery<AiUsageResponse>({
    queryKey: ["dental-ai-usage", cid],
    queryFn: () => dentalAiApi.usage(cid!),
    enabled: !!cid && opts?.enabled !== false,
    staleTime: 60_000,
  });
}

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
