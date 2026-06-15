// ============================================================
// karateSettingsApi — shim de compatibilidade (Track H)
//
// configuracoes/index.tsx importa karateSettingsApi com uma assinatura
// ligeiramente diferente da nomenclatura do karateApi principal.
// Este módulo faz o bridge, delegando tudo para karateApi.
// ============================================================
import {
  karateApi,
  FederationMember,
  InviteMemberResult,
  KarateFlags,
  FederationIdentity,
  KarateRole,
} from "@/services/karateApi";

export const karateSettingsApi = {
  // Equipe FPKT
  listMembers: (
    federationId: string
  ): Promise<{ members: FederationMember[] }> =>
    karateApi.listFederationMembers(federationId),

  /** Assinatura usada no configuracoes/index.tsx: (fedId, email, role) */
  inviteMember: (
    federationId: string,
    email: string,
    role: KarateRole
  ): Promise<InviteMemberResult> =>
    karateApi.inviteFederationMember(federationId, { email, role }),

  updateMemberRole: (
    federationId: string,
    memberId: string,
    role: string
  ): Promise<{ id: string; role: string; role_label: string }> =>
    karateApi.updateFederationMemberRole(federationId, memberId, role as KarateRole),

  removeMember: (
    federationId: string,
    memberId: string
  ): Promise<{ removed: boolean }> =>
    karateApi.removeFederationMember(federationId, memberId),

  // Feature flags
  getFlags: (
    federationId: string
  ): Promise<{ flags: KarateFlags }> =>
    karateApi.getFederationFlags(federationId),

  updateFlags: (
    federationId: string,
    flags: Partial<KarateFlags>
  ): Promise<{ flags: KarateFlags }> =>
    karateApi.updateFederationFlags(federationId, flags),

  // Identidade + Fiscal
  getIdentity: (
    federationId: string
  ): Promise<FederationIdentity> =>
    karateApi.getFederationIdentity(federationId),

  updateIdentity: (
    federationId: string,
    body: Partial<FederationIdentity>
  ): Promise<{ updated: boolean }> =>
    karateApi.updateFederationIdentity(federationId, body),
};
