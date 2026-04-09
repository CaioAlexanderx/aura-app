import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type Member = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role_label: string;
  status: string;
  is_active: boolean;
  joined_at: string | null;
  permissions?: any;
};

export type MembersData = {
  total: number;
  active: number;
  pending: number;
  monthly_cost: number;
  members: Member[];
};

export function useMembers() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  const { data, isLoading } = useQuery<MembersData>({
    queryKey: ['members', cid],
    queryFn: () => companiesApi.members(cid!),
    enabled: !!cid,
    staleTime: 60_000,
  });

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role_label?: string }) => companiesApi.inviteMember(cid!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members', cid] }); toast.success('Convite enviado!'); },
    onError: (err: any) => toast.error(err?.message || 'Erro ao convidar'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ mid, body }: { mid: string; body: any }) => companiesApi.updateMember(cid!, mid, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members', cid] }); toast.success('Membro atualizado'); },
    onError: (err: any) => toast.error(err?.message || 'Erro ao atualizar'),
  });

  const removeMutation = useMutation({
    mutationFn: (mid: string) => companiesApi.removeMember(cid!, mid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members', cid] }); toast.success('Membro suspenso'); },
    onError: (err: any) => toast.error(err?.message || 'Erro ao remover'),
  });

  return {
    members: data?.members || [],
    total: data?.total || 0,
    active: data?.active || 0,
    pending: data?.pending || 0,
    monthlyCost: data?.monthly_cost || 0,
    isLoading,
    inviteMember: inviteMutation.mutateAsync,
    updateMember: (mid: string, body: any) => updateMutation.mutateAsync({ mid, body }),
    removeMember: removeMutation.mutateAsync,
  };
}
