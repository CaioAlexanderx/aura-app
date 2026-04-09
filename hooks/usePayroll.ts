import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth";
import { useEmployees } from "@/hooks/useEmployees";
import type { Employee } from "@/components/screens/folha/types";
import { calcPayroll, FGTS_RATE } from "@/components/screens/folha/types";

export function usePayroll() {
  const { isDemo } = useAuthStore();
  const { employees: rawEmployees, loading, error, refresh, createEmployee, updateEmployee, deleteEmployee } = useEmployees();

  const result = useMemo(() => {
    const employees: Employee[] = rawEmployees.length > 0 ? rawEmployees : [];
    const active = employees.filter(e => e.status === "active");
    const totalBruto = active.reduce((s, e) => s + (e.salary || 0), 0);
    const totalFgts = active.reduce((s, e) => s + (e.salary || 0) * FGTS_RATE, 0);
    const totals = active.reduce((a, e) => {
      const p = calcPayroll(e);
      return { inss: a.inss + p.inss, irrf: a.irrf + p.irrf, fgts: a.fgts + p.fgts, liquid: a.liquid + p.liquid };
    }, { inss: 0, irrf: 0, fgts: 0, liquid: 0 });

    return { employees, active, totalBruto, totalFgts, totals, isDemo: isDemo || false };
  }, [rawEmployees, isDemo]);

  return { ...result, isLoading: loading, error, refresh, createEmployee, updateEmployee, deleteEmployee };
}
