import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

// Sprint 4 da revisao UX da Equipe (06/05/2026)
// Backend tem CRUD de role_templates em /companies/:id/members/roles.
// Templates 'global' (company_id=null) = built-in. Templates 'custom'
// (company_id=<id>) = criados pelo dono.

export type RoleTemplate = {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  is_default: boolean;
  type: "global" | "custom";
};

function mapTemplate(raw: any): RoleTemplate {
  return {
    id:          raw.id,
    name:        raw.name,
    description: raw.description,
    permissions: typeof raw.permissions === "string"
      ? JSON.parse(raw.permissions)
      : (raw.permissions || {}),
    is_default:  !!raw.is_default,
    type:        raw.type === "custom" ? "custom" : "global",
  };
}

export function useMemberTemplates() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  const { data, isLoading } = useQuery<any>({
    queryKey: ["role-templates", cid],
    queryFn:  () => request("/companies/" + cid + "/members/roles"),
    enabled:  !!cid,
    staleTime: 5 * 60_000,
  });

  const templates: RoleTemplate[] = (data?.templates || []).map(mapTemplate);
  const customTemplates = templates.filter(t => t.type === "custom");

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description?: string; permissions: Record<string, boolean> }) =>
      request("/companies/" + cid + "/members/roles", { method: "POST", body, retry: 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-templates", cid] });
      toast.success("Perfil salvo!");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar perfil"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      request("/companies/" + cid + "/members/roles/" + id, { method: "PATCH", body, retry: 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-templates", cid] });
      toast.success("Perfil atualizado");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar perfil"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      request("/companies/" + cid + "/members/roles/" + id, { method: "DELETE", retry: 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-templates", cid] });
      toast.success("Perfil removido");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover perfil"),
  });

  return {
    templates,
    customTemplates,
    isLoading,
    createTemplate:  createMutation.mutateAsync,
    isCreating:      createMutation.isPending,
    updateTemplate:  (id: string, body: any) => updateMutation.mutateAsync({ id, body }),
    isUpdating:      updateMutation.isPending,
    deleteTemplate:  deleteMutation.mutateAsync,
    isDeleting:      deleteMutation.isPending,
  };
}
