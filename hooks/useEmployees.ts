import { useState, useEffect, useCallback } from "react";
import { employeesApi, ApiError } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Employee } from "@/components/screens/folha/types";

// 12/05/2026 -- PLAN-02: Hook agora expoe planLimit (vem do response BE).
// 403 no POST = limite atingido (gate removido em private.js); mensagem
// contextual de upgrade montada com body.limit / body.current.
//
// 19/06/2026 -- TEAM-RM: fluxo Suspender + Apagar (report Davi).
//   - fetch agora traz desligados (include_inactive) pra permitir Reativar/Apagar.
//   - suspendEmployee/reactivateEmployee via PATCH { status, is_active }.
//   - deleteEmployee = remocao REAL; trata 409 (HAS_HISTORY) com aviso de suspender.
export function useEmployees() {
  const { company, isDemo } = useAuthStore();
  const plan = company?.plan || 'essencial';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [planLimit, setPlanLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!company?.id || isDemo) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      // TEAM-RM: inclui desligados pra UI poder Reativar/Apagar (badge "Desligado").
      const res = await employeesApi.list(company.id, true);
      setEmployees((res.employees || []).map(mapEmployee));
      setPlanLimit(res.plan_limit ?? null);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar funcionarios");
    } finally { setLoading(false); }
  }, [company?.id, isDemo]);

  useEffect(() => { fetch(); }, [fetch]);

  // PLAN-02: mensagem de upgrade contextual quando atinge limite.
  function limitUpgradeMessage(body: any): string {
    const limit = body?.limit;
    const current = body?.current;
    if (!limit) return body?.error || "Limite de funcionarios atingido.";
    switch ((plan || "").toLowerCase()) {
      case "essencial":
        return `Voce atingiu ${current ?? limit} de ${limit} funcionarios do Essencial. Faca upgrade pro Negocio (50) ou Expansao (ilimitado).`;
      case "negocio":
        return `Voce atingiu ${current ?? limit} de ${limit} funcionarios do Negocio. Faca upgrade pro Expansao (ilimitado).`;
      default:
        return body?.error || `Limite de ${limit} funcionarios atingido.`;
    }
  }

  async function createEmployee(body: Partial<Employee>): Promise<Employee | null> {
    if (!company?.id) return null;
    try {
      const created = await employeesApi.create(company.id, body);
      const mapped = mapEmployee(created);
      setEmployees(prev => [...prev, mapped]);
      toast.success("Funcionario cadastrado");
      return mapped;
    } catch (err: any) {
      // PLAN-02: 403 com body.limit = limite do plano atingido
      if (err instanceof ApiError && err.status === 403) {
        toast.error(limitUpgradeMessage(err.data));
      } else {
        toast.error(err.message || "Erro ao cadastrar");
      }
      throw err;
    }
  }

  async function updateEmployee(eid: string, body: Partial<Employee>): Promise<Employee | null> {
    if (!company?.id) return null;
    try {
      const updated = await employeesApi.update(company.id, eid, body);
      const mapped = mapEmployee(updated);
      setEmployees(prev => prev.map(e => e.id === eid ? mapped : e));
      toast.success("Funcionario atualizado");
      return mapped;
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
      throw err;
    }
  }

  // TEAM-RM: Suspender = soft (vira Desligado, reversivel). Mantem historico.
  async function suspendEmployee(eid: string) {
    if (!company?.id) return;
    try {
      const updated = await employeesApi.update(company.id, eid, { status: "dismissed", is_active: false } as any);
      const mapped = mapEmployee(updated);
      setEmployees(prev => prev.map(e => e.id === eid ? mapped : e));
      toast.success("Funcionario suspenso");
    } catch (err: any) {
      toast.error(err.message || "Erro ao suspender");
      throw err;
    }
  }

  // TEAM-RM: Reativar = volta pra ativo.
  async function reactivateEmployee(eid: string) {
    if (!company?.id) return;
    try {
      const updated = await employeesApi.update(company.id, eid, { status: "active", is_active: true } as any);
      const mapped = mapEmployee(updated);
      setEmployees(prev => prev.map(e => e.id === eid ? mapped : e));
      toast.success("Funcionario reativado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao reativar");
      throw err;
    }
  }

  // TEAM-RM: Apagar = remocao REAL. 409 (HAS_HISTORY) => orienta suspender.
  async function deleteEmployee(eid: string) {
    if (!company?.id) return;
    try {
      await employeesApi.remove(company.id, eid);
      setEmployees(prev => prev.filter(e => e.id !== eid));
      toast.success("Funcionario apagado");
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message || "Funcionario tem historico. Use Suspender.");
      } else {
        toast.error(err.message || "Erro ao apagar");
      }
      throw err;
    }
  }

  return {
    employees, loading, error, refresh: fetch,
    createEmployee, updateEmployee, deleteEmployee,
    suspendEmployee, reactivateEmployee,
    planLimit, plan,
  };
}

// Map backend response to frontend Employee type (all fields)
function mapEmployee(raw: any): Employee {
  return {
    id: raw.id,
    name: raw.name || "",
    role: raw.role || "",
    salary: parseFloat(raw.salary) || 0,
    admDate: raw.admDate || (raw.admission_date ? new Date(raw.admission_date).toLocaleDateString("pt-BR") : ""),
    admission_date: raw.admission_date || null,
    status: raw.status || "active",
    cpf: raw.cpf || "",
    pis: raw.pis || "",
    phone: raw.phone || "",
    email: raw.email || "",
    work_hours: parseInt(raw.work_hours) || 220,
    commission_enabled: raw.commission_enabled || false,
    commission_rate: parseFloat(raw.commission_rate) || 0,
    user_id: raw.user_id || null,
    is_active: raw.is_active !== false,
  };
}
