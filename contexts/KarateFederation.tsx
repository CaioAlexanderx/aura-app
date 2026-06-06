// ============================================================
// KarateFederationContext — Aura Karatê
//
// Provê federationId ativo para todos os screens do grupo (karate).
// Por ora lê de EXPO_PUBLIC_KARATE_FEDERATION_ID (env) ou usa um
// ID mock para desenvolvimento. Quando o flow de login de federação
// for implementado, substituir pelo ID vindo do JWT/store.
// ============================================================
import React, { createContext, useContext, ReactNode } from "react";

export interface KarateFederationContextValue {
  federationId: string;
  federationName: string;
}

const MOCK_FEDERATION_ID =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_KARATE_FEDERATION_ID) ||
  "00000000-0000-0000-0000-000000000001"; // placeholder para dev/mock

const KarateFederationContext = createContext<KarateFederationContextValue>({
  federationId:   MOCK_FEDERATION_ID,
  federationName: "Federação Paulista de Karatê Tradicional",
});

export function KarateFederationProvider({ children }: { children: ReactNode }) {
  // TODO: ler do auth store quando o login de federação for implementado
  const value: KarateFederationContextValue = {
    federationId:   MOCK_FEDERATION_ID,
    federationName: "Federação Paulista de Karatê Tradicional",
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
