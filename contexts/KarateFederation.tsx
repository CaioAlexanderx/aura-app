// ============================================================
// KarateFederationContext — Aura Karatê
//
// Track G (acesso real): federationId + papel vêm da company logada
// (useAuthStore). A federação É uma company (vertical karate_federation);
// o dojô é company karate_dojo com federation_id apontando ao pai — o
// backend (auth.js / resolveKarateContext) já resolve ambos e entrega em
// company.federation_id + company.karate_role.
//
// Fase 0 Dojô (17/06/2026): adicionado dojoId.
// company.dojo_id é populado pelo JWT quando o usuário logado é membro
// de um karate_dojo (não é null para federação). Usado pelo shell do
// sensei e pelos endpoints Canal A (/dojo/*).
// ============================================================
import React, { createContext, useContext, ReactNode } from "react";
import { useAuthStore } from "@/stores/auth";

export interface KarateFederationContextValue {
  federationId: string;
  federationName: string;
  karateRole: string | null;
  dojoId: string | null;
}

const KarateFederationContext = createContext<KarateFederationContextValue>({
  federationId: "",
  federationName: "",
  karateRole: null,
  dojoId: null,
});

export function KarateFederationProvider({ children }: { children: ReactNode }) {
  const company = useAuthStore((s) => s.company) as any;

  const value: KarateFederationContextValue = {
    // Garantido pelo guard do (federation)/_layout (federation_id presente).
    federationId: company?.federation_id ?? "",
    federationName: company?.name || "Federação",
    karateRole: company?.karate_role ?? null,
    // dojo_id: presente quando company é karate_dojo; null para federação ou não-karatê.
    dojoId: company?.dojo_id ?? null,
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
