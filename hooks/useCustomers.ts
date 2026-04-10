import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, ApiError } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Customer } from "@/components/screens/clientes/types";

function mapApiCustomer(c: any): Customer {
  return {
    id: c.id || c.customer_id || String(Math.random()),
    name: c.name || c.customer_name || "Cliente",
    email: c.email || "",
    phone: c.phone || "",
    instagram: c.instagram || c.instagram_handle || "",
    birthday: c.birthday || (c.birth_date ? new Date(c.birth_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""),
    lastPurchase: c.last_purchase ? new Date(c.last_purchase).toLocaleDateString("pt-BR") : c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("pt-BR") : "---",
    totalSpent: parseFloat(c.total_spent ?? c.totalSpent ?? c.ltv) || 0,
    visits: parseInt(c.visit_count ?? c.visits ?? c.total_purchases) || 0,
    firstVisit: c.first_visit ? new Date(c.first_visit).toLocaleDateString("pt-BR") : c.first_purchase_at ? new Date(c.first_purchase_at).toLocaleDateString("pt-BR") : c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "---",
    notes: c.notes || "",
    rating: c.rating != null ? parseInt(c.rating) : null,
  };
}

function parseBirthday(val: string): string | undefined {
  if (!val) return undefined;
  const parts = val.split("/");
  if (parts.length === 2) return `2000-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  return undefined;
}

export function useCustomers() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

  const { data: apiData, isLoading, error: fetchError } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: () => companiesApi.customers(companyId!),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });

  const planBlocked = (fetchError as any)?.status === 403;

  const customers: Customer[] = useMemo(() => {
    if (isDemo || planBlocked) return [];
    const arr = apiData?.customers || apiData?.rows || apiData;
    if (!(arr instanceof Array)) return [];
    return arr.map(mapApiCustomer);
  }, [apiData, isDemo, planBlocked]);

  const addMutation = useMutation({
    mutationFn: (body: any) => companiesApi.createCustomer(companyId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers", companyId] }); toast.success("Cliente cadastrado!"); },
    onError: (err: any) => {
      if (err instanceof ApiError && err.status === 403) toast.error("Clientes disponivel a partir do plano Negocio.");
      else toast.error(err?.message || "Erro ao salvar cliente");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => companiesApi.updateCustomer(companyId!, id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers", companyId] }); toast.success("Cliente atualizado!"); },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar cliente"),
  });

  const deleteMutation = useMutation({
    mutationFn: (custId: string) => companiesApi.deleteCustomer(companyId!, custId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers", companyId] }); toast.success("Cliente excluido"); },
    onError: (err: any) => {
      if (err instanceof ApiError && err.status === 403) toast.error("Funcionalidade disponivel a partir do plano Negocio.");
      else toast.error("Erro ao excluir cliente");
    },
  });

  function addCustomer(c: Customer) {
    if (!companyId) { toast.error("Empresa nao identificada"); return; }
    if (isDemo) return;
    addMutation.mutate({ name: c.name, email: c.email || undefined, phone: c.phone || undefined, instagram_handle: c.instagram || undefined, birth_date: parseBirthday(c.birthday), notes: c.notes || undefined });
  }

  function updateCustomer(id: string, c: Partial<Customer>) {
    if (!companyId || isDemo) return;
    updateMutation.mutate({ id, body: { name: c.name, email: c.email || undefined, phone: c.phone || undefined, instagram_handle: c.instagram || undefined, birth_date: c.birthday ? parseBirthday(c.birthday) : undefined, notes: c.notes || undefined } });
  }

  function deleteCustomer(id: string) {
    if (companyId && !isDemo) deleteMutation.mutate(id);
  }

  async function bulkDeleteCustomers(ids: string[]) {
    if (!companyId || isDemo || ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => companiesApi.deleteCustomer(companyId!, id)));
      qc.invalidateQueries({ queryKey: ["customers", companyId] });
      toast.success(`${ids.length} cliente${ids.length > 1 ? "s" : ""} excluido${ids.length > 1 ? "s" : ""}`);
    } catch {
      toast.error("Erro ao excluir clientes selecionados");
    }
  }

  return { customers, isLoading: isLoading && !isDemo, isDemo, planBlocked, addCustomer, updateCustomer, deleteCustomer, bulkDeleteCustomers };
}
