// ============================================================
// KarateFederationContext — Aura Karatê
//
// Track G (acesso real): federationId + papel vêm da company logada
// (useAuthStore). A federação É uma company (vertical karate_federation);
// o dojô é company karate_dojo com federation_id apontando ao pai — o
// backend (auth.js / resolveKarateContext) já resolve ambos e entrega em
// company.federation_id + company.karate_role.
//
// SEM MOCK: o federationId vem exclusivamente do JWT/company. O provider
// só é montado pelo (federation)/_layout quando company.federation_id
// existe (guard), então aqui federationId é sempre uma string real.
// ============================================================
import React, { createContext, useContext, ReactNode } from "react";
import { useAuthStore } from "@/stores/auth";

export interface KarateFederationContextValue {
  federationId: string;
  federationName: string;
  karateRole: string | null;
}

const KarateFederationContext = createContext<KarateFederationContextValue>({
  federationId: "",
  federationName: "",
  karateRole: null,
});

export function KarateFederationProvider({ children }: { children: ReactNode }) {
  const company = useAuthStore((s) => s.company) as any;

  const value: KarateFederationContextValue = {
    // Garantido pelo guard do (federation)/_layout (federation_id presente).
    federationId: company?.federation_id ?? "",
    federationName: company?.name || "Federação",
    karateRole: company?.karate_role ?? null,
  };

  return (
    <KarateFederationContext.Provider value={value}>
      {children}
    </KarateFederationContext.Provider>
  );
}

export function useKarateFederation(): KarateFederationContextValue {
  return useContext(KarateFederationContext);
}
