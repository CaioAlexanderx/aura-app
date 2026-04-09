import { useState, useEffect, useCallback } from "react";
import { employeesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Employee } from "@/components/screens/folha/types";

export function useEmployees() {
  const { company, isDemo } = useAuthStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!company?.id || isDemo) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await employeesApi.list(company.id);
      setEmployees(res.employees || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar funcionarios");
    } finally { setLoading(false); }
  }, [company?.id, isDemo]);

  useEffect(() => { fetch(); }, [fetch]);

  async function createEmployee(body: Partial<Employee>) {
    if (!company?.id) return;
    try {
      const created = await employeesApi.create(company.id, body);
      setEmployees(prev => [...prev, mapEmployee(created)]);
      toast.success("Funcionario cadastrado");
      return created;
    } catch (err: any) { toast.error(err.message || "Erro ao cadastrar"); }
  }

  async function updateEmployee(eid: string, body: Partial<Employee>) {
    if (!company?.id) return;
    try {
      const updated = await employeesApi.update(company.id, eid, body);
      setEmployees(prev => prev.map(e => e.id === eid ? mapEmployee(updated) : e));
      toast.success("Funcionario atualizado");
      return updated;
    } catch (err: any) { toast.error(err.message || "Erro ao atualizar"); }
  }

  async function deleteEmployee(eid: string) {
    if (!company?.id) return;
    try {
      await employeesApi.remove(company.id, eid);
      setEmployees(prev => prev.filter(e => e.id !== eid));
      toast.success("Funcionario removido");
    } catch (err: any) { toast.error(err.message || "Erro ao remover"); }
  }

  return { employees, loading, error, refresh: fetch, createEmployee, updateEmployee, deleteEmployee };
}

// Map backend response → frontend Employee type
function mapEmployee(raw: any): Employee {
  return {
    id: raw.id,
    name: raw.name || "",
    role: raw.role || "",
    salary: parseFloat(raw.salary) || 0,
    admDate: raw.admDate || (raw.admission_date ? new Date(raw.admission_date).toLocaleDateString("pt-BR") : ""),
    status: raw.status || "active",
  };
}
