// ============================================================
// 09/11/2026 — Relatório com subcategoria (mockup, seção D)
//
//   1. DRE exportado: uma linha recuada por subcategoria (e "Sem
//      subcategoria"); texto antigo "Servicos" soma com "Serviços".
//   2. Aba Despesas: o bloco "Categorias de despesa" abre cada categoria nas
//      subcategorias, e tocar numa subcategoria leva aos Lançamentos
//      filtrados por ela.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/hooks/useFinancialInsights", () => ({
  useFinancialInsights: () => ({ expense_breakdown: { top5: [], payment_methods: [], timeline: null, anomalies: [] }, monthly_evolution: [] }),
}));
jest.mock("@/components/screens/financeiro/v2/Onda3Cards", () => ({ MonthlyEvolution: () => null }));
jest.mock("@/components/screens/financeiro/v2/SharedCards", () => ({ Top5List: () => null, HBarList: () => null, Timeline: () => null }));
// Os blocos abaixo da dobra abrem sob demanda: no teste, sempre abertos.
jest.mock("@/components/screens/financeiro/CollapsibleSection", () => ({ CollapsibleSection: ({ children }: any) => children }));

import { buildDreModel } from "@/utils/dreReport";
import { TabDespesas } from "@/components/screens/financeiro/v2/TabDespesas";

const TXS: any[] = [
  { id: "1", type: "expense", status: "confirmed", amount: 1850, category: "Fixas", category_name: "Fixas", subcategory: "Aluguel", desc: "a" },
  { id: "2", type: "expense", status: "confirmed", amount: 540, category: "Fixas", category_name: "Fixas", subcategory: "Energia", desc: "b" },
  { id: "3", type: "expense", status: "confirmed", amount: 240, category: "Fixas", desc: "c" },
  { id: "4", type: "expense", status: "confirmed", amount: 1980, category: "Fornecedores", desc: "d" },
  { id: "5", type: "income", status: "confirmed", amount: 50, category: "Servicos", desc: "e" },
  { id: "6", type: "income", status: "confirmed", amount: 30, category: "Servicos", category_name: "Serviços", desc: "f" },
  { id: "7", type: "income", status: "confirmed", amount: 9000, category: "Vendas", desc: "g" },
];

describe("DRE exportado", () => {
  it("linha recuada por subcategoria e nomes antigos somados", () => {
    const m = buildDreModel(TXS);
    expect(m.totalExpenses).toBe(4610);
    const fixas = m.expenses.find((r) => r.category === "Fixas")!;
    expect(fixas.amount).toBe(2630);
    expect(fixas.subs!.map((x) => [x.category, x.amount])).toEqual([["Aluguel", 1850], ["Energia", 540], ["Sem subcategoria", 240]]);
    expect(m.expenses.find((r) => r.category === "Fornecedores")!.subs).toBeUndefined();
    expect(m.income.map((r) => [r.category, r.amount])).toEqual([["Vendas", 9000], ["Serviços", 80]]);
  });
});

function porId(t: any, testID: string): any {
  return t.root.findAll((n: any) => n.props && n.props.testID === testID, { deep: false })[0];
}

describe("aba Despesas", () => {
  it("abre a maior categoria nas subcategorias; tocar numa sub leva aos Lançamentos filtrados", () => {
    const onVer = jest.fn();
    let t: any;
    act(() => {
      t = renderer.create(
        <TabDespesas transactions={TXS} summary={{ income: 9080, expenses: 4610, balance: 4470 }} period="month" consolidated={false} onVerCategoria={onVer} />
      );
    });
    expect(porId(t, "despesas-cat-Fixas")).toBeDefined();
    expect(porId(t, "despesas-sub-Fixas-Aluguel")).toBeDefined();
    expect(porId(t, "despesas-sub-Fixas-Sem subcategoria")).toBeDefined();
    act(() => { porId(t, "despesas-sub-Fixas-Aluguel").props.onPress(); });
    expect(onVer).toHaveBeenLastCalledWith("Fixas", "Aluguel");
    act(() => { porId(t, "despesas-sub-Fixas-Sem subcategoria").props.onPress(); });
    expect(onVer).toHaveBeenLastCalledWith("Fixas", "");
    // Categoria sem subcategoria leva direto; a com subcategoria fecha no toque.
    act(() => { porId(t, "despesas-cat-Fornecedores").props.onPress(); });
    expect(onVer).toHaveBeenLastCalledWith("Fornecedores", null);
    act(() => { porId(t, "despesas-cat-Fixas").props.onPress(); });
    expect(porId(t, "despesas-sub-Fixas-Aluguel")).toBeUndefined();
  });
});
