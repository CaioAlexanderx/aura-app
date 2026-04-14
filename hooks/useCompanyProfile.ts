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

  // Sync trade_name to auth store (once per unique value)
  useEffect(() => {
    if (!profile) return;
    const newName = profile.trade_name || profile.legal_name;
    if (newName && newName !== synced.current && newName !== company?.name) {
      updateCompany({ name: newName } as any);
      synced.current = newName;
    }
  }, [profile?.trade_name, profile?.legal_name]);

  // Derive plan from profile (most up-to-date) or fallback to auth store
  const plan = (profile?.plan || company?.plan || "essencial").toLowerCase();

  return {
    profile,
    isLoading,
    refetch,
    tradeName: profile?.trade_name || profile?.legal_name || company?.name || "",
    logoUrl: profile?.logo_url || null,
    plan,
  };
}
