import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type Member = {
  id: string;
  user_id: string | null;
  name: string;        // mapeado de user_name
  email: string;       // mapeado de user_email ou invite_email
  role_label: string;
  status: "active" | "pending" | "suspended";
  is_active: boolean;
  permissions: Record<string, boolean>;
  invite_email?: string;
  invited_at?: string;
  accepted_at?: string;
};

export type LastInvite = {
  url: string;
  email: string;
  role: string;
};

export type MembersData = {
  total: number;
  active: number;
  pending: number;
  monthly_cost: number;
  members: Member[];
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
    invited_at:   raw.invited_at,
    accepted_at:  raw.accepted_at,
  };
}

export function useMembers() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;
  const [lastInvite, setLastInvite] = useState<LastInvite | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["members", cid],
    queryFn:  () => companiesApi.members(cid!),
    enabled:  !!cid,
    staleTime: 60_000,
  });

  const rawMembers: any[] = data?.members || [];
  const members: Member[] = rawMembers.map(mapMember);

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role_label?: string }) =>
      companiesApi.inviteMember(cid!, body),
    onSuccess: (response: any) => {
      qc.invalidateQueries({ queryKey: ["members", cid] });
      // Captura o link de convite retornado pela API
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", cid] });
      toast.success("Permissoes atualizadas");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar"),
  });

  const removeMutation = useMutation({
    mutationFn: (mid: string) => companiesApi.removeMember(cid!, mid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", cid] });
      toast.success("Membro suspenso");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao suspender"),
  });

  function clearLastInvite() { setLastInvite(null); }

  return {
    members,
    total:      data?.total       || 0,
    active:     data?.active      || 0,
    pending:    data?.pending     || 0,
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
  };
}
