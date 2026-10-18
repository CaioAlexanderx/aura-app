// ============================================================
// Gestão Aura › Receita com mês sem custo lançado (18/10/2026, backend t2-21)
//
// /admin/metrics/unit-economics passou a ler o snapshot e devolve null (não
// R$ 0) em costs.total, margin.* e cac.value quando o mês não tem custo
// lançado. fmt(null) quebrava a tela; agora ela mostra "sem custo lançado".
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));

var mockUnit: any = null;
jest.mock("@/services/api", () => ({
  request: async (url: string) => {
    if (url.includes("mrr-waterfall")) return { previous_mrr: 1000, current_mrr: 1200, new_mrr: 200, expansion_mrr: 0, churn_mrr: 0, contraction_mrr: 0, net_change: 200, net_revenue_retention: 100 };
    if (url.includes("unit-economics")) return mockUnit;
    if (url.includes("forecast")) return { current_mrr: 1200, growth_rate_pct: 5, projections: [], milestones: { mrr_1k: null, mrr_5k: null, mrr_10k: null } };
    return { months: [] };
  },
}));

import { ReceitaAdmin } from "@/components/admin/ReceitaAdmin";

const base = { paying_clients: 2, mrr: 398, arpu: 199, churn: { rate_pct: 5, count_3m: 0 }, ltv: { value: 3980, months: 20 }, ltv_cac_ratio: null };

async function montar() {
  var qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  var tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><ReceitaAdmin /></QueryClientProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}
const textos = (tree: any) => JSON.stringify(tree.toJSON());

test("mês sem custo lançado: não quebra e diz 'sem custo lançado'", async () => {
  mockUnit = { ...base, cac: { value: null }, costs: { total: null, lancado: false, rotulo: "sem custo lançado", breakdown: [] }, margin: { gross: null, pct: null } };
  const t = textos(await montar());
  expect(t).toContain("sem custo lançado");
  expect(t).toContain("\"—\"");
  expect(t).toContain("Mês sem custo lançado");
});

test("mês com custo lançado: valores e rótulo da categoria do snapshot", async () => {
  mockUnit = {
    ...base, cac: { value: 212.63 },
    costs: { total: 2150.5, lancado: true, rotulo: null, breakdown: [{ category: "anthropic", label: "Anthropic", amount: 1200 }] },
    margin: { gross: 1849.5, pct: 46 },
  };
  const t = textos(await montar());
  expect(t).toContain("R$ 2.150,50");
  expect(t).toContain("Anthropic");
  expect(t).toContain("46");
});
