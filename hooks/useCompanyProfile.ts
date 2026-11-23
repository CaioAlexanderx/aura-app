import { nomeDaLojaDe } from "@/utils/nomeDaLoja";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";

/**
 * Shared hook for company profile data.
 * Syncs trade_name back to auth store so Dashboard header stays up to date.
 * Single source of truth for logo_url and plan.
 */
export function useCompanyProfile() {
  const { company, isDemo, updateCompany } = useAuthStore();
  const synced = useRef("");

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["company-profile", company?.id],
    queryFn: () => companiesApi.getProfile(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 30000, // Reduced from 60s to catch profile updates faster
  });

  // Sync do nome da loja para o auth store (uma vez por valor). 21/11/2026:
  // leva nome fantasia e razão social juntos, para a regra única
  // (utils/nomeDaLoja.ts) valer em quem lê o store — etiqueta, Caixa,
  // mensagens — e não só no topo.
  useEffect(() => {
    if (!profile) return;
    const newName = nomeDaLojaDe(profile);
    const atual = company as any;
    const mudou = newName !== nomeDaLojaDe(atual)
      || (atual && (atual.trade_name ?? null) !== (profile.trade_name || null))
      || (atual && (atual.legal_name ?? null) !== (profile.legal_name || null));
    if (newName && newName !== synced.current && mudou) {
      updateCompany({ name: newName, trade_name: profile.trade_name || null, legal_name: profile.legal_name || null } as any);
      synced.current = newName;
    }
  }, [profile?.trade_name, profile?.legal_name]);

  // Derive plan from profile (most up-to-date) or fallback to auth store
  const plan = (profile?.plan || company?.plan || "essencial").toLowerCase();

  return {
    profile,
    isLoading,
    refetch,
    tradeName: nomeDaLojaDe(profile) || nomeDaLojaDe(company),
    logoUrl: profile?.logo_url || null,
    plan,
  };
}
