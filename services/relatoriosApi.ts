// ============================================================
// AURA. — Relatório "Vendas por produto e numeração" (03/11/2026)
//
// GET /companies/:id/reports/vendas-por-numeracao (Aura-backend, mesmo
// nome). Mockup: docs/mockups/relatorio-vendas-por-numeracao.html.
// Quantidade exata vendida no período por modelo, tipo e numeração, com
// estoque de hoje, giro, quanto o estoque dura e quanto comprar para repor.
// Custo nunca sai deste relatório.
// ============================================================
import { request } from "@/services/api";

export type PeriodoDoRelatorio = "week" | "month" | "last_month" | "d90" | "custom";

export type NumeracaoDoModelo = {
  numeracao: string;
  vendidos: number;
  estoque: number;
  /** Opcional: o backend pode mandar a receita da numeração (planilha). */
  receita?: number | null;
};

export type FornecedorDoModelo = { id: string; nome: string; telefone: string | null } | null;

export type ModeloVendido = {
  product_id: string;
  nome: string;
  sku: string | null;
  tipo: string | null;
  cor: string | null;
  vendidos: number;
  receita: number;
  estoque: number;
  giro_pct: number | null;
  dura_dias: number | null;
  repor: number;
  fornecedor: FornecedorDoModelo;
  numeracoes: NumeracaoDoModelo[];
};

export type LinhaPorNumeracao = { numeracao: string; vendidos: number; pct: number; estoque: number; repor: number };

export type VendasPorNumeracao = {
  periodo: { inicio: string; fim: string; dias: number; rotulo: string };
  unidade: "pares" | "peças" | "itens";
  kpis: {
    vendidos: number; receita: number; ticket_medio: number;
    modelos_venderam: number; modelos_total: number;
    campea: { numeracao: string; vendidos: number; pct: number } | null;
    vendidos_anterior: number; variacao_pct: number | null;
  };
  colunas: string[];
  categorias: string[];
  modelos: ModeloVendido[];
  numeracoes: LinhaPorNumeracao[];
  totais: { vendidos: number; receita: number; estoque: number; giro_pct: number | null; dura_dias: number | null; repor: number };
};

export type FiltrosDoRelatorio = {
  period: PeriodoDoRelatorio;
  start_date?: string;
  end_date?: string;
  category?: string | null;
  q?: string;
  por_cor?: boolean;
};

export function queryDoRelatorio(f: FiltrosDoRelatorio): string {
  const p = new URLSearchParams();
  p.set("period", f.period);
  if (f.period === "custom") {
    if (f.start_date) p.set("start_date", f.start_date);
    if (f.end_date) p.set("end_date", f.end_date);
  }
  if (f.category) p.set("category", f.category);
  if (f.q && f.q.trim()) p.set("q", f.q.trim());
  if (f.por_cor) p.set("por_cor", "1");
  return p.toString();
}

export const relatoriosApi = {
  vendasPorNumeracao: (cid: string, f: FiltrosDoRelatorio) =>
    request<VendasPorNumeracao>(`/companies/${cid}/reports/vendas-por-numeracao?${queryDoRelatorio(f)}`, { retry: 1, timeout: 20000 }),
};
