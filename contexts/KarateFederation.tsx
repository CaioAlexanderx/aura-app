// ============================================================
// KarateFederationContext — Aura Karatê
//
// Track G (acesso real): federationId + papel vêm da company logada
// (useAuthStore). A federação É uma company (vertical karate_federation);
// o dojô é company karate_dojo com federation_id apontando ao pai — o
// backend (auth.js / resolveKarateContext) já resolve ambos e entrega em
// company.federation_id + company.karate_role.
//
// Fallback de DEV: se a company não trouxer federation_id (ex. ainda não
// há federação criada no banco), usa EXPO_PUBLIC_KARATE_FEDERATION_ID ou um
// placeholder, para as telas seguirem renderizando com o mock-fallback dos
// Tracks A–F. karateRole fica null nesse caso (nav não restringe).
// ============================================================
import React, { createContext, useContext, ReactNode } from "react";
import { useAuthStore } from "@/stores/auth";

export interface KarateFederationContextValue {
  federationId: string;
  federationName: string;
  karateRole: string | null;
}

// Fallback de desenvolvimento (sem federação real no banco ainda).
const DEV_FALLBACK_FEDERATION_ID =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_KARATE_FEDERATION_ID) ||
  "00000000-0000-0000-0000-000000000001";

const DEFAULT_FEDERATION_NAME = "Federação Paulista de Karatê Tradicional";

const KarateFederationContext = createContext<KarateFederationContextValue>({
  federationId: DEV_FALLBACK_FEDERATION_ID,
  federationName: DEFAULT_FEDERATION_NAME,
  karateRole: null,
});

export function KarateFederationProvider({ children }: { children: ReactNode }) {
  const company = useAuthStore((s) => s.company) as any;

  const realFederationId: string | undefined = company?.federation_id || undefined;
  const value: KarateFederationContextValue = {
    federationId: realFederationId || DEV_FALLBACK_FEDERATION_ID,
    federationName: company?.name || DEFAULT_FEDERATION_NAME,
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
