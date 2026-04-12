import { Colors } from "@/constants/colors";

export type Employee = {
  id: string;
  name: string;
  role: string;
  salary: number;
  admDate: string;
  admission_date?: string | null;
  status: "active" | "vacation" | "dismissed" | "license";
  cpf?: string;
  pis?: string;
  phone?: string;
  email?: string;
  work_hours?: number;
  commission_enabled?: boolean;
  commission_rate?: number;
  user_id?: string | null;
  is_active?: boolean;
};

export type PayrollCalc = { inss: number; irrf: number; fgts: number; liquid: number };
export type PayslipType = "mensal" | "ferias" | "decimo_terceiro";

export type HistoryItem = { id: string; month: string; total: number; liquid: number; paidAt: string; employees: number };
export type RankingItem = { empId: string; name: string; role: string; sales: number; revenue: number; avgTicket: number; topProduct: string; trend: "up" | "down" };

export const TABS = ["Funcionarios", "Resumo mensal", "Historico", "Ranking"];

export const STATUS_MAP: Record<string, { l: string; c: string }> = {
  active: { l: "Ativo", c: Colors.green },
  vacation: { l: "Ferias", c: Colors.amber },
  dismissed: { l: "Desligado", c: Colors.red },
  license: { l: "Licenca", c: Colors.blue || "#3b82f6" },
};

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
export { fmt };

// INSS progressive table 2026
const INSS_FAIXAS = [
  { ate: 1412, aliq: 0.075 },
  { ate: 2666.68, aliq: 0.09 },
  { ate: 4000.03, aliq: 0.12 },
  { ate: 7786.02, aliq: 0.14 },
];

export function calcINSS(salary: number): number {
  let inss = 0, prev = 0;
  for (const f of INSS_FAIXAS) {
    const base = Math.min(salary, f.ate) - prev;
    if (base <= 0) break;
    inss += base * f.aliq;
    prev = f.ate;
  }
  return inss;
}

export function calcIRRF(salary: number, inss: number): number {
  const base = salary - inss;
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return base * 0.075 - 169.44;
  if (base <= 3751.05) return base * 0.15 - 381.44;
  if (base <= 4664.68) return base * 0.225 - 662.77;
  return base * 0.275 - 896;
}

export const FGTS_RATE = 0.08;

export function calcPayroll(emp: Employee): PayrollCalc {
  const inss = calcINSS(emp.salary);
  const irrf = Math.max(0, calcIRRF(emp.salary, inss));
  const fgts = emp.salary * FGTS_RATE;
  const liquid = emp.salary - inss - irrf;
  return { inss, irrf, fgts, liquid };
}

// Ferias: salario + 1/3 constitucional
export function calcFerias(emp: Employee) {
  const terco = emp.salary / 3;
  const bruto = emp.salary + terco;
  const inss = calcINSS(bruto);
  const irrf = Math.max(0, calcIRRF(bruto, inss));
  const fgts = bruto * FGTS_RATE;
  const liquid = bruto - inss - irrf;
  return { salary: emp.salary, terco, bruto, inss, irrf, fgts, liquid };
}

// 13o salario: integral ou proporcional
export function calc13(emp: Employee, mesesTrabalhados: number = 12) {
  const proporcional = Math.min(mesesTrabalhados, 12);
  const bruto = (emp.salary / 12) * proporcional;
  const inss = calcINSS(bruto);
  const irrf = Math.max(0, calcIRRF(bruto, inss));
  const fgts = bruto * FGTS_RATE;
  const liquid = bruto - inss - irrf;
  return { bruto, proporcional, inss, irrf, fgts, liquid };
}

// Mock data (fallback when API not available)
export const MOCK_EMPLOYEES: Employee[] = [
  { id: "1", name: "Ana Costa", role: "Atendente", salary: 1800, admDate: "15/03/2025", status: "active" },
  { id: "2", name: "Carlos Silva", role: "Barbeiro", salary: 2200, admDate: "01/06/2024", status: "active" },
  { id: "3", name: "Julia Santos", role: "Recepcionista", salary: 1600, admDate: "10/09/2025", status: "active" },
];

export const MOCK_HISTORY: HistoryItem[] = [
  { id: "h1", month: "Fevereiro/2026", total: 5600, liquid: 4612.40, paidAt: "05/03/2026", employees: 3 },
  { id: "h2", month: "Janeiro/2026", total: 5600, liquid: 4612.40, paidAt: "05/02/2026", employees: 3 },
  { id: "h3", month: "Dezembro/2025", total: 5600, liquid: 4612.40, paidAt: "05/01/2026", employees: 3 },
];

export const MOCK_RANKING: RankingItem[] = [
  { empId: "2", name: "Carlos Silva", role: "Barbeiro", sales: 47, revenue: 3290, avgTicket: 70, topProduct: "Corte + Barba", trend: "up" },
  { empId: "1", name: "Ana Costa", role: "Atendente", sales: 38, revenue: 2156, avgTicket: 56.7, topProduct: "Pomada Modeladora", trend: "up" },
  { empId: "3", name: "Julia Santos", role: "Recepcionista", sales: 22, revenue: 1045, avgTicket: 47.5, topProduct: "Shampoo Anticaspa", trend: "down" },
];

export const LOGO_CDN = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Aura.jpeg";
