import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type MemberCompany = {
  company_id: string;
  company_name: string;
  is_primary: boolean;
  member_id: string;
};

export type Member = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  role_label: string;
  status: "active" | "pending" | "suspended";
  is_active: boolean;
  permissions: Record<string, boolean>;
  invite_email?: string;
  invite_token?: string | null;
  invite_url?: string | null;
  invited_at?: string;
  accepted_at?: string;
  companies: MemberCompany[];
};

export type SiblingCompany = {
  id: string;
  name: string;
  is_primary: boolean;
};

export type LastInvite = {
  url: string;
  email: string;
  role: string;
};

function mapMember(raw: any): Member {
  return {
    id:          raw.id,
    user_id:     raw.user_id || null,
    name:        raw.user_name || raw.name || raw.invite_email || "Pendente",
    email:       raw.user_email || raw.email || raw.invite_email || "",
    role_label:  raw.role_label || "funcionario",
    status:      raw.status || "pending",
    is_active:   raw.is_active || false,
    permissions: typeof raw.permissions === "string"
      ? JSON.parse(raw.permissions)
      : (raw.permissions || {}),
    invite_email: raw.invite_email,
    invite_token: raw.invite_token || null,
    invite_url:   raw.invite_url   || null,
    invited_at:   raw.invited_at,
    accepted_at:  raw.accepted_at,
    companies:    raw.companies || [],
  };
}

export function useMembers() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;
  const [lastInvite, setLastInvite] = useState<LastInvite | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["members-unified", cid],
    queryFn:  () => companiesApi.membersUnified(cid!),
    enabled:  !!cid,
    staleTime: 60_000,
  });

  const rawMembers: any[] = data?.members || [];
  const members: Member[] = rawMembers.map(mapMember);
  const siblings: SiblingCompany[] = data?.siblings || [];

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role_label?: string; company_ids?: string[]; permissions?: Record<string, boolean> }) =>
      companiesApi.inviteMember(cid!, body),
    onSuccess: (response: any) => {
      qc.invalidateQueries({ queryKey: ["members-unified", cid] });
      if (response?.invite_url) {
        setLastInvite({
          url:   response.invite_url,
          email: response.invite_email || "",
          role:  response.role_label || "",
        });
      } else {
        toast.success("Convite criado!");
      }
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao convidar"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ mid, body }: { mid: string; body: any }) =>
      companiesApi.updateMember(cid!, mid, body),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["members-unified", cid] });
      qc.invalidateQueries({ queryKey: ["member-audit", cid, vars.mid] });
      toast.success("Permissoes atualizadas");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar"),
  });

  const removeMutation = useMutation({
    mutationFn: (memberIds: string[]) =>
      Promise.all(memberIds.map(mid => companiesApi.removeMember(cid!, mid))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members-unified", cid] });
      toast.success("Membro suspenso");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao suspender"),
  });

  const resendEmailMutation = useMutation({
    mutationFn: (mid: string) =>
      request<{ message: string; invite_email: string; invite_url: string }>(
        "/companies/" + cid + "/members/" + mid + "/resend-email",
        { method: "POST", retry: 0, timeout: 15000 }
      ),
    onSuccess: (_res, mid) => {
      qc.invalidateQueries({ queryKey: ["member-audit", cid, mid] });
      toast.success("Email reenviado");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao reenviar email"),
  });

  const updateInviteEmailMutation = useMutation({
    mutationFn: ({ mid, email }: { mid: string; email: string }) =>
      request<{ message: string; invite_email: string; invite_url: string; warning?: string }>(
        "/companies/" + cid + "/members/" + mid + "/invite-email",
        { method: "PATCH", body: { invite_email: email }, retry: 0, timeout: 15000 }
      ),
    onSuccess: (res: any, vars) => {
      qc.invalidateQueries({ queryKey: ["members-unified", cid] });
      qc.invalidateQueries({ queryKey: ["member-audit", cid, vars.mid] });
      if (res?.warning === "send_failed") {
        toast.error("Email atualizado, mas envio falhou. Tente reenviar.");
      } else {
        toast.success("Email atualizado e reenviado");
      }
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar email"),
  });

  // Sprint 4 (06/05/2026): renova validade do convite
  const extendMutation = useMutation({
    mutationFn: (mid: string) =>
      request<{ message: string; invited_at: string; invite_url: string }>(
        "/companies/" + cid + "/members/" + mid + "/extend",
        { method: "POST", retry: 0 }
      ),
    onSuccess: (_res, mid) => {
      qc.invalidateQueries({ queryKey: ["members-unified", cid] });
      qc.invalidateQueries({ queryKey: ["member-audit", cid, mid] });
      toast.success("Validade estendida em 7 dias");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao estender validade"),
  });

  function clearLastInvite() { setLastInvite(null); }

  return {
    members,
    siblings,
    total:       data?.total        || 0,
    active:      data?.active       || 0,
    pending:     data?.pending      || 0,
    monthlyCost: data?.monthly_cost || 0,
    isLoading,
    lastInvite,
    clearLastInvite,
    inviteMember:  inviteMutation.mutateAsync,
    isInviting:    inviteMutation.isPending,
    updateMember:  (mid: string, body: any) => updateMutation.mutateAsync({ mid, body }),
    isUpdating:    updateMutation.isPending,
    removeMember:  removeMutation.mutateAsync,
    isRemoving:    removeMutation.isPending,
    resendInviteEmail:  resendEmailMutation.mutateAsync,
    isResending:        resendEmailMutation.isPending,
    updateInviteEmail:  (mid: string, email: string) => updateInviteEmailMutation.mutateAsync({ mid, email }),
    isUpdatingEmail:    updateInviteEmailMutation.isPending,
    // Sprint 4
    extendInvite:       extendMutation.mutateAsync,
    isExtending:        extendMutation.isPending,
  };
}
