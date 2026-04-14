import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";

/**
 * Shared hook for company profile data.
 * Syncs trade_name back to auth store so Dashboard header stays up to date.
 */
export function useCompanyProfile() {
  const { company, isDemo, updateCompany } = useAuthStore();
  const synced = useRef(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["company-profile", company?.id],
    queryFn: () => companiesApi.getProfile(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 60000,
  });

  // Sync trade_name to auth store (once per query result)
  useEffect(() => {
    if (!profile || synced.current) return;
    const newName = profile.trade_name || profile.legal_name;
    if (newName && newName !== company?.name) {
      updateCompany({ name: newName } as any);
      synced.current = true;
    }
  }, [profile]);

  // Reset sync flag when profile data changes (e.g. after save in settings)
  useEffect(() => { synced.current = false; }, [profile?.trade_name, profile?.legal_name]);

  return {
    profile,
    isLoading,
    tradeName: profile?.trade_name || profile?.legal_name || company?.name || "",
    logoUrl: profile?.logo_url || null,
    plan: (company?.plan || "essencial").toLowerCase(),
  };
}
