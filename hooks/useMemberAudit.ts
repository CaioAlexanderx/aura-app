import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// Sprint 4 da revisao UX da Equipe (06/05/2026)
// Historico de acoes pra um membro especifico.

export type AuditAction =
  | "invite_created"
  | "invite_resent"
  | "invite_email_changed"
  | "invite_extended"
  | "invite_accepted"
  | "invite_cancelled"
  | "member_suspended"
  | "permissions_updated"
  | "role_changed"
  | "companies_changed";

export type AuditEntry = {
  id: string;
  action: AuditAction;
  metadata: Record<string, any>;
  created_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
};

// Etiqueta amigavel pra cada acao
export const AUDIT_LABELS: Record<AuditAction, string> = {
  invite_created:        "Convite criado",
  invite_resent:         "Email reenviado",
  invite_email_changed:  "Email do convite alterado",
  invite_extended:       "Validade estendida em 7 dias",
  invite_accepted:       "Convite aceito — entrou na equipe",
  invite_cancelled:      "Convite cancelado",
  member_suspended:      "Membro suspenso",
  permissions_updated:   "Permissões alteradas",
  role_changed:          "Função alterada",
  companies_changed:     "Acesso a empresas alterado",
};

// Hook: passa memberId pra ativar a query (skip quando nao expandido)
export function useMemberAudit(memberId: string | null) {
  const { company } = useAuthStore();
  const cid = company?.id;

  return useQuery<{ total: number; entries: AuditEntry[] }>({
    queryKey: ["member-audit", cid, memberId],
    queryFn: () => request("/companies/" + cid + "/members/" + memberId + "/audit-log"),
    enabled: !!cid && !!memberId,
    staleTime: 30_000,
  });
}
