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
      setEmployees((res.employees || []).map(mapEmployee));
    } catch (err: any) {
      setError(err.message || "Erro ao carregar funcionarios");
    } finally { setLoading(false); }
  }, [company?.id, isDemo]);

  useEffect(() => { fetch(); }, [fetch]);

  async function createEmployee(body: Partial<Employee>): Promise<Employee | null> {
    if (!company?.id) return null;
    try {
      const created = await employeesApi.create(company.id, body);
      const mapped = mapEmployee(created);
      setEmployees(prev => [...prev, mapped]);
      toast.success("Funcionario cadastrado");
      return mapped;
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar");
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

  async function deleteEmployee(eid: string) {
    if (!company?.id) return;
    try {
      await employeesApi.remove(company.id, eid);
      setEmployees(prev => prev.filter(e => e.id !== eid));
      toast.success("Funcionario removido");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
      throw err;
    }
  }

  return { employees, loading, error, refresh: fetch, createEmployee, updateEmployee, deleteEmployee };
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
