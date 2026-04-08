import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { Employee, PayrollCalc } from "@/components/screens/folha/types";
import { calcPayroll, FGTS_RATE, MOCK_EMPLOYEES } from "@/components/screens/folha/types";

export function usePayroll() {
  const { company, token, isDemo } = useAuthStore();
  const companyId = company?.id;

  // Fetch members from API
  const { data: membersData, isLoading } = useQuery({
    queryKey: ["members", companyId],
    queryFn: () => companiesApi.members?.(companyId!) || Promise.resolve(null),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 60000,
  });

  const result = useMemo(() => {
    // Parse API members or fallback to mock
    let employees: Employee[];
    const apiMembers = membersData?.members || membersData;
    if (apiMembers instanceof Array && apiMembers.length > 0) {
      employees = apiMembers.map((m: any) => ({
        id: m.id || m.user_id,
        name: m.full_name || m.name || "Funcionario",
        role: m.role_name || m.role || "Membro",
        salary: parseFloat(m.salary || m.base_salary) || 1412,
        admDate: m.joined_at ? new Date(m.joined_at).toLocaleDateString("pt-BR") : m.admDate || "---",
        status: m.status === "active" ? "active" as const : m.status === "vacation" ? "vacation" as const : "dismissed" as const,
      }));
    } else {
      employees = MOCK_EMPLOYEES;
    }

    const active = employees.filter(e => e.status === "active");
    const totalBruto = active.reduce((s, e) => s + e.salary, 0);
    const totalFgts = active.reduce((s, e) => s + e.salary * FGTS_RATE, 0);
    const totals = active.reduce((a, e) => {
      const p = calcPayroll(e);
      return { inss: a.inss + p.inss, irrf: a.irrf + p.irrf, fgts: a.fgts + p.fgts, liquid: a.liquid + p.liquid };
    }, { inss: 0, irrf: 0, fgts: 0, liquid: 0 });

    return { employees, active, totalBruto, totalFgts, totals, isDemo: isDemo || false };
  }, [membersData, isDemo]);

  return { ...result, isLoading };
}
