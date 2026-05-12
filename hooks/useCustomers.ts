import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi, ApiError } from "@/services/api";
import { meAggregatesApi } from "@/services/meAggregates";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Customer } from "@/components/screens/clientes/types";

// MULTICNPJ Sessao 2 Onda 2.3 (03/05/2026):
// Hook ramifica entre /me/customers (consolidated) e /companies/:id/customers
// (per-company). Backend ja retorna lista UNICA owner-scoped em ambos os
// endpoints -- vendedora membro so de Loja A ainda ve clientes registrados
// em Loja B do mesmo dono.
//
// Mutations (POST/PATCH/DELETE) em modo consolidated:
// resolvem automaticamente a primary do owner (do availableCompanies).
// User nao precisa trocar de empresa pra criar/editar/deletar.
//
// Crediario (mai/2026): backend retorna credit_balance via LEFT JOIN
// com customer_credit_balances. Mapeio pra Customer.creditBalance.
//
// 11/05/2026 -- PLAN-01: Clientes basico no Essencial. Limite por plano
// (1k/5k/ilimitado) controlado em customers.js. 403 do POST/PATCH agora
// significa LIMITE ATINGIDO (com body.limit, body.current), nao bloqueio
// de plano. Toasts contextualizados com upgrade path quando aplicavel.

// Processa deletes em lotes para nao sobrecarregar o servidor
async function deleteBatched(
  ids: string[],
  deleteFn: (id: string) => Promise<any>,
  batchSize = 10,
  onProgress?: (done: number, total: number) => void
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(id => deleteFn(id)));
    succeeded += results.filter(r => r.status === "fulfilled").length;
    failed    += results.filter(r => r.status === "rejected").length;
    onProgress?.(Math.min(i + batchSize, ids.length), ids.length);
  }
  return { succeeded, failed };
}

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
    // MULTICNPJ Onda 2.3: loja onde foi cadastrado
    company_id: c.company_id || null,
    company_name: c.company_name || null,
    // Crediario: saldo > 0 = cliente deve. Backend retorna 0 quando nao ha lancamentos.
    creditBalance: parseFloat(c.credit_balance ?? c.creditBalance) || 0,
  };
}

function parseBirthday(val: string): string | undefined {
  if (!val) return undefined;
  const parts = val.split("/");
  if (parts.length === 2) return `2000-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  return undefined;
}

// Plano → mensagem de upgrade contextual para 403 com body.limit.
// Como tirar o gate principal, 403 hoje so dispara quando atinge
// o limite do plano (customers.js).
function limitUpgradeMessage(plan: string, body: any): string {
  const limit = body?.limit;
  const current = body?.current;
  if (!limit) return body?.error || "Limite de clientes atingido.";
  switch ((plan || "").toLowerCase()) {
    case "essencial":
      return `Voce atingiu ${current ?? limit} de ${limit} clientes do Essencial. Faça upgrade pro Negocio (5.000 clientes) ou Expansao (ilimitado).`;
    case "negocio":
      return `Voce atingiu ${current ?? limit} de ${limit} clientes do Negocio. Faça upgrade pro Expansao (ilimitado).`;
    default:
      return body?.error || `Limite de ${limit} clientes atingido.`;
  }
}

export function useCustomers() {
  const { company, token, isDemo, consolidatedView, availableCompanies } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;
  const plan = company?.plan || "essencial";
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // MULTICNPJ Onda 2.3: em modo consolidated, mutations precisam de uma
  // empresa concreta. Resolve a primary do owner automaticamente.
  const mutationCompanyId = useMemo(function () {
    if (!consolidatedView) return companyId || null;
    const primary = (availableCompanies || []).find(function (c: any) { return c.is_primary; });
    return primary?.id || (availableCompanies?.[0]?.id ?? null);
  }, [consolidatedView, companyId, availableCompanies]);

  const { data: apiData, isLoading, error: fetchError } = useQuery({
    queryKey: consolidatedView ? ["customers", "me"] : ["customers", companyId],
    queryFn: function () {
      if (consolidatedView) {
        return meAggregatesApi.customers();
      }
      return companiesApi.customers(companyId!);
    },
    enabled: (consolidatedView || !!companyId) && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });

  // Apos PLAN-01, 403 no GET nao deveria mais ocorrer (gate removido em
  // private.js). Mantenho a flag por seguranca caso volte algum gate
  // futuro (ex: trial expirado bloqueando tudo).
  const planBlocked = (fetchError as any)?.status === 403;

  const customers: Customer[] = useMemo(function () {
    if (isDemo || planBlocked) return [];
    const arr = (apiData as any)?.customers || (apiData as any)?.rows || apiData;
    if (!(arr instanceof Array)) return [];
    return arr.map(mapApiCustomer);
  }, [apiData, isDemo, planBlocked]);

  // Companies count vem do response em consolidated (pra FE decidir mostrar badge)
  const companyCount = (apiData as any)?.company_count || (availableCompanies?.length || 1);
  // Limite do plano (vem do response do BE)
  const planLimit = (apiData as any)?.plan_limit || null;

  // Helper de invalidacao -- invalida ambos os keys pra cobrir os dois modos
  function invalidateCustomers() {
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  const addMutation = useMutation({
    mutationFn: function (body: any) {
      if (!mutationCompanyId) {
        return Promise.reject(new Error("Empresa nao identificada"));
      }
      return companiesApi.createCustomer(mutationCompanyId, body);
    },
    onSuccess: function () {
      invalidateCustomers();
      toast.success("Cliente cadastrado!");
    },
    onError: function (err: any) {
      // PLAN-01: 403 do POST agora indica LIMITE ATINGIDO (gate principal removido).
      // Backend retorna { error, limit, current } pra montar mensagem contextual.
      if (err instanceof ApiError && err.status === 403) {
        toast.error(limitUpgradeMessage(plan, err.body));
      } else {
        toast.error(err?.message || "Erro ao salvar cliente");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: function (params: { id: string; body: any; sourceCompanyId?: string | null }) {
      // Em consolidated, usa o company_id do proprio cliente (sourceCompanyId)
      // se disponivel -- mais correto que primary, pq o BE espera owner-scope.
      // Backend customers.js owner-scoped permite editar de qualquer loja
      // do mesmo dono, mas usar o original e mais explicito.
      const targetCid = params.sourceCompanyId || mutationCompanyId;
      if (!targetCid) return Promise.reject(new Error("Empresa nao identificada"));
      return companiesApi.updateCustomer(targetCid, params.id, params.body);
    },
    onSuccess: function () {
      invalidateCustomers();
      toast.success("Cliente atualizado!");
    },
    onError: function (err: any) {
      toast.error(err?.message || "Erro ao atualizar cliente");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: function (params: { custId: string; sourceCompanyId?: string | null }) {
      const targetCid = params.sourceCompanyId || mutationCompanyId;
      if (!targetCid) return Promise.reject(new Error("Empresa nao identificada"));
      return companiesApi.deleteCustomer(targetCid, params.custId);
    },
    onSuccess: function () {
      invalidateCustomers();
      toast.success("Cliente excluido");
    },
    onError: function (err: any) {
      toast.error(err?.message || "Erro ao excluir cliente");
    },
  });

  function addCustomer(c: Customer) {
    if (!mutationCompanyId) { toast.error("Empresa nao identificada"); return; }
    if (isDemo) return;
    addMutation.mutate({
      name: c.name,
      email: c.email || undefined,
      phone: c.phone || undefined,
      instagram_handle: c.instagram || undefined,
      birth_date: parseBirthday(c.birthday),
      notes: c.notes || undefined,
    });
  }

  function updateCustomer(id: string, c: Partial<Customer>) {
    if (!mutationCompanyId || isDemo) return;
    // Resolve a empresa de origem do cliente (se vem da lista) pra mandar
    // pro endpoint correto. Customer.company_id e preenchido pelo backend.
    const existing = customers.find(function (x) { return x.id === id; });
    const sourceCompanyId = existing?.company_id || null;
    updateMutation.mutate({
      id,
      sourceCompanyId,
      body: {
        name: c.name,
        email: c.email || undefined,
        phone: c.phone || undefined,
        instagram_handle: c.instagram || undefined,
        birth_date: c.birthday ? parseBirthday(c.birthday) : undefined,
        notes: c.notes || undefined,
      },
    });
  }

  function deleteCustomer(id: string) {
    if (!mutationCompanyId || isDemo) return;
    const existing = customers.find(function (x) { return x.id === id; });
    const sourceCompanyId = existing?.company_id || null;
    deleteMutation.mutate({ custId: id, sourceCompanyId });
  }

  // Bulk delete em lotes de 10 -- nao sobrecarrega o servidor
  async function bulkDeleteCustomers(ids: string[]) {
    if (!mutationCompanyId || isDemo || ids.length === 0) return;
    setBulkDeleting(true);
    if (ids.length > 20) toast.info(`Excluindo ${ids.length} clientes...`);
    try {
      // Pra cada id, resolve sourceCompanyId do customer.
      // Como o helper deleteBatched recebe so um deleteFn(id), encapsulamos.
      const customerById = new Map(customers.map(function (c) { return [c.id, c]; }));
      const { succeeded, failed } = await deleteBatched(
        ids,
        function (id) {
          const c = customerById.get(id);
          const targetCid = c?.company_id || mutationCompanyId;
          return companiesApi.deleteCustomer(targetCid!, id);
        },
        10
      );
      invalidateCustomers();
      if (failed === 0) {
        toast.success(`${succeeded} cliente${succeeded !== 1 ? "s" : ""} excluido${succeeded !== 1 ? "s" : ""}`);
      } else {
        toast.warning?.(`${succeeded} excluidos, ${failed} com erro`);
        if (!toast.warning) toast.error(`${failed} cliente${failed !== 1 ? "s" : ""} com erro ao excluir`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir clientes selecionados");
    } finally {
      setBulkDeleting(false);
    }
  }

  return {
    customers,
    isLoading: isLoading && !isDemo,
    isDemo,
    planBlocked,
    bulkDeleting,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers,
    // MULTICNPJ Onda 2.3: info pra UI condicionar badge da loja
    consolidatedView,
    companyCount,
    // PLAN-01: limite do plano (pra UI mostrar progress "X/Y clientes")
    planLimit,
    plan,
    // Helper pra UI invalidar saldo apos receber pagamento
    invalidateCustomers,
  };
}
