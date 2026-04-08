import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
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
    birthday: c.birthday || c.birth_date || "",
    lastPurchase: c.last_purchase ? new Date(c.last_purchase).toLocaleDateString("pt-BR") : "---",
    totalSpent: parseFloat(c.total_spent ?? c.totalSpent ?? c.ltv) || 0,
    visits: parseInt(c.visit_count ?? c.visits) || 0,
    firstVisit: c.first_visit ? new Date(c.first_visit).toLocaleDateString("pt-BR") : c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "---",
    notes: c.notes || "",
    rating: c.rating != null ? parseInt(c.rating) : null,
  };
}

export function useCustomers() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

  const { data: apiData, isLoading } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: () => companiesApi.customers(companyId!),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });

  const customers: Customer[] = useMemo(() => {
    if (isDemo) return [];
    const arr = apiData?.customers || apiData?.rows || apiData;
    if (!(arr instanceof Array)) return [];
    return arr.map(mapApiCustomer);
  }, [apiData, isDemo]);

  const addMutation = useMutation({
    mutationFn: (body: any) => {
      console.log("[useCustomers] addMutation called", { companyId, body });
      return companiesApi.createCustomer(companyId!, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", companyId] });
      toast.success("Cliente cadastrado!");
    },
    onError: (err) => {
      console.error("[useCustomers] addMutation ERROR", err);
      toast.error("Erro ao salvar cliente");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (custId: string) => companiesApi.deleteCustomer(companyId!, custId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", companyId] });
      toast.success("Cliente excluido");
    },
    onError: () => toast.error("Erro ao excluir cliente"),
  });

  function addCustomer(c: Customer) {
    console.log("[useCustomers] addCustomer", { companyId, isDemo, name: c.name });
    if (!companyId) { toast.error("Empresa nao identificada"); return; }
    if (isDemo) return;
    addMutation.mutate({
      name: c.name,
      email: c.email || undefined,
      phone: c.phone || undefined,
      instagram_handle: c.instagram || undefined,
      birth_date: c.birthday || undefined,
      notes: c.notes || undefined,
    });
  }

  function deleteCustomer(id: string) {
    if (companyId && !isDemo) deleteMutation.mutate(id);
  }

  return { customers, isLoading: isLoading && !isDemo, isDemo, addCustomer, deleteCustomer };
}
