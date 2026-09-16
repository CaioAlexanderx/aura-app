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
//
// 16/09/2026 — federationLogoUrl (marca da federação logada):
// a criação da JKA Teste mostrou o app dizendo "FPKT" para quem não é
// FPKT. Diretriz do Caio: nenhuma identidade de federação escrita no
// código — tudo deriva do cadastro. Este contexto virou o lugar de onde
// o shell lê nome E logo, e o GET /federation/:id/identity
// (karateFederationIdentityApi) é o único fetch dessa identidade no app.
//
//   • federationName — company.name (JWT) como semente, corrigido pela
//     identidade quando ela responde. O fallback é NEUTRO ("Federação"),
//     nunca o nome de uma federação específica.
//   • federationLogoUrl — só da identidade, NUNCA do JWT: o auth store
//     não revalida o token, e uma logo trocada ficaria presa até o
//     próximo login. null → o FederationLogo desenha o monograma.
//
// FAIL-SOFT: o fetch engole qualquer erro (404 enquanto o backend não
// deployou a rota, 403, rede). Identidade visual não derruba o shell.
// ============================================================
import React, {
  createContext, useContext, useEffect, useState, ReactNode,
} from "react";
import { useAuthStore } from "@/stores/auth";
import {
  karateFederationIdentityApi,
  FederationIdentityBrand,
} from "@/services/karateFederationIdentityApi";

/** Fallback neutro: sem cadastro, o app diz "Federação" — nunca uma marca. */
export const FEDERATION_FALLBACK_NAME = "Federação";

export interface KarateFederationContextValue {
  federationId: string;
  federationName: string;
  /** Logo da federação logada (null → monograma no FederationLogo). */
  federationLogoUrl: string | null;
  karateRole: string | null;
  dojoId: string | null;
}

const KarateFederationContext = createContext<KarateFederationContextValue>({
  federationId: "",
  federationName: FEDERATION_FALLBACK_NAME,
  federationLogoUrl: null,
  karateRole: null,
  dojoId: null,
});

export function KarateFederationProvider({ children }: { children: ReactNode }) {
  const company = useAuthStore((s) => s.company) as any;
  // Garantido pelo guard do (federation)/_layout (federation_id presente).
  const federationId: string = company?.federation_id ?? "";

  const [identity, setIdentity] = useState<FederationIdentityBrand | null>(null);

  useEffect(() => {
    if (!federationId) {
      setIdentity(null);
      return;
    }
    // `cancelado` evita gravar a identidade da federação anterior depois de
    // uma troca de conta (o fetch antigo ainda pode estar no ar).
    let cancelado = false;
    (async () => {
      try {
        const brand = await karateFederationIdentityApi.getIdentity(federationId);
        if (!cancelado) setIdentity(brand);
      } catch {
        // Fail-soft deliberado — ver cabeçalho.
        if (!cancelado) setIdentity(null);
      }
    })();
    return () => { cancelado = true; };
  }, [federationId]);

  // ⚠️ company.name só é o nome da FEDERAÇÃO quando a company logada É a
  // federação. Este provider também monta no grupo (dojo), onde company é o
  // DOJÔ — usar company.name ali carimbaria o nome do dojô como nome da
  // federação. Lá a semente não existe: vale a identidade, ou o neutro.
  const companyIsDojo = Boolean(company?.dojo_id);

  const value: KarateFederationContextValue = {
    federationId,
    federationName:
      identity?.name ||
      (companyIsDojo ? null : company?.name) ||
      FEDERATION_FALLBACK_NAME,
    federationLogoUrl: identity?.logo_url ?? null,
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
