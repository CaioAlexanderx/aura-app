// Smoke test de render do ResumoHero e do AcoesCard (F3).
//
// Typecheck nao pega erro de runtime em Animated.interpolate, prop faltando ou
// divisao por zero num periodo vazio. Estes testes montam os componentes de
// verdade nos cenarios que mais quebram: sem dados, sem receita, consolidado.
//
// Icon e mockado porque react-native-svg nao passa pelo transformIgnorePatterns
// do projeto (mesma razao de __tests__/studio/dataBR.test.ts falhar ao carregar).

import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

var mockCompanyId: string | undefined = "empresa-1";
jest.mock("@/stores/auth", () => ({
  useAuthStore: function (selector: any) {
    var state = { company: { id: mockCompanyId }, consolidatedView: false, token: "t", isDemo: false };
    return typeof selector === "function" ? selector(state) : state;
  },
}));

import { ResumoHero } from "@/components/screens/financeiro/v2/ResumoHero";
import { AcoesCard } from "@/components/screens/financeiro/v2/AcoesCard";
import type { Transaction } from "@/components/screens/financeiro/types";
import type { FinancialInsights } from "@/components/screens/financeiro/v2/types";

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: over.id || "t1",
    date: "01/08/2026",
    desc: "Lancamento",
    type: "income",
    category: "Vendas",
    amount: 100,
    status: "confirmed",
    source: "manual",
    due_date: "2026-08-01",
    ...over,
  } as Transaction;
}

var INSIGHTS: FinancialInsights = {
  health: {
    score: 72,
    label: "Saudavel",
    drivers: [],
    narrative: { headline: "Seu negócio está saudável.", subline: "Indicadores dentro da meta." },
  },
  runway: { days: 74, daily_burn: 505, cash_balance: 18400 },
  biggest_lever: null,
};

// React quebra texto interpolado ("{n} itens") em nos separados, entao
// JSON.stringify da arvore nao contem a frase montada. Achatamos os nos de
// texto pra poder afirmar sobre o que o usuario realmente le.
function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

// act assincrono: AccessibilityInfo.isReduceMotionEnabled() resolve numa
// microtask e chama setState. Sem awaitar dentro do act, o React avisa de
// update fora de act e o teste passaria por acidente, sem o estado final.
async function renderTree(el: React.ReactElement) {
  var tree: any;
  await act(async function () {
    tree = renderer.create(el);
  });
  return { tree: tree, text: flattenText(tree.toJSON()) };
}

describe("ResumoHero", () => {
  it("renderiza com dados normais", async () => {
    var r = await renderTree(
      <ResumoHero
        transactions={[
          tx({ id: "a", amount: 2000, due_date: "2026-08-01" }),
          tx({ id: "b", amount: 1500, type: "expense", due_date: "2026-08-02" }),
          tx({ id: "c", amount: 800, due_date: "2026-08-03" }),
        ]}
        summary={{ income: 2800, expenses: 1500, balance: 1300 }}
        previousSummary={{ income: 2400, expenses: 1400, balance: 1000 }}
        insights={INSIGHTS}
        period="month"
      />
    );
    var text = r.text;
    expect(text).toContain("Entrou");
    expect(text).toContain("Saiu");
    expect(text).toContain("Sobrou");
    // frase de status no lugar do score 0-100
    expect(text).toContain("Seu negócio está saudável.");
    expect(text).not.toContain("de 100");
  });

  it("nao quebra sem nenhuma transacao", async () => {
    await expect(
      renderTree(
        <ResumoHero
          transactions={[]}
          summary={{ income: 0, expenses: 0, balance: 0 }}
          previousSummary={null}
          insights={INSIGHTS}
          period="month"
        />
      )
    ).resolves.toBeDefined();
  });

  it("nao divide por zero quando nao ha receita no periodo", async () => {
    var r = await renderTree(
      <ResumoHero
        transactions={[tx({ id: "x", type: "expense", amount: 500 })]}
        summary={{ income: 0, expenses: 500, balance: -500 }}
        previousSummary={null}
        insights={INSIGHTS}
        period="month"
      />
    );
    var text = r.text;
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
    expect(text).toContain("sem receita no período");
  });

  it("omite o delta quando nao ha periodo anterior comparavel", async () => {
    var r = await renderTree(
      <ResumoHero
        transactions={[tx({ id: "a", amount: 1000 })]}
        summary={{ income: 1000, expenses: 300, balance: 700 }}
        previousSummary={{ income: 0, expenses: 0, balance: 0 }}
        insights={INSIGHTS}
        period="month"
      />
    );
    // previous.balance === 0 => sem base de comparacao, nao inventa "+100%"
    expect(r.text).not.toContain("100%");
  });

  it("rotula o periodo consolidado", async () => {
    var r = await renderTree(
      <ResumoHero
        transactions={[tx({ id: "a", amount: 1000 })]}
        summary={{ income: 1000, expenses: 300, balance: 700 }}
        previousSummary={null}
        insights={INSIGHTS}
        period="week"
        consolidated
      />
    );
    var text = r.text;
    expect(text).toContain("DA SEMANA");
    expect(text).toContain("TODAS AS EMPRESAS");
  });
});

describe("AcoesCard", () => {
  var noop = function () { /* nada */ };

  it("mostra estado positivo quando nao ha nada pendente", async () => {
    var r = await renderTree(
      <AcoesCard
        transactions={[tx({ id: "a", amount: 100 })]}
        insights={INSIGHTS}
        onGoToLancamentos={noop}
      />
    );
    expect(r.text).toContain("Nada precisa da sua atenção agora");
  });

  it("lista cobranca em atraso vinda do biggest_lever", async () => {
    var r = await renderTree(
      <AcoesCard
        transactions={[]}
        insights={{
          ...INSIGHTS,
          biggest_lever: {
            type: "collect_overdue",
            headline: "irrelevante — o card compoe a propria frase",
            amount: 2440,
            impact_days: 5,
            count: 5,
            oldest_days: 18,
          },
        }}
        onGoToLancamentos={noop}
      />
    );
    var text = r.text;
    expect(text).toContain("Para fazer agora");
    expect(text).toContain("em atraso");
    expect(text).toContain("18 dias");
  });

  it("nao passa de 3 acoes", async () => {
    var today = new Date();
    var soon = new Date(today.getTime() + 2 * 86400000);
    var iso = soon.getFullYear() + "-" + String(soon.getMonth() + 1).padStart(2, "0") + "-" + String(soon.getDate()).padStart(2, "0");

    var r = await renderTree(
      <AcoesCard
        transactions={[
          tx({ id: "p1", type: "expense", status: "pending", amount: 800, due_date: iso }),
          tx({ id: "p2", type: "expense", status: "pending", amount: 200, due_date: iso }),
          tx({ id: "r1", type: "income", status: "pending", amount: 500, due_date: iso }),
        ]}
        insights={{
          ...INSIGHTS,
          biggest_lever: { type: "collect_overdue", headline: "", amount: 2440, impact_days: 5, count: 5, oldest_days: 18 },
          expense_breakdown: {
            top5: [], payment_methods: [], timeline: {} as any, gauge: {} as any, total: 0,
            anomalies: [{ category: "Marketing", current: 1180, avg_3m: 840, diff_pct: 40 }],
          } as any,
        }}
        onGoToLancamentos={noop}
        onGoToDespesas={noop}
      />
    );
    var text = r.text;
    expect(text).toContain("3 itens");
    // a acao de menor peso (receber avulso) fica de fora
    expect(text).not.toContain("Acompanhar");
  });

  it("ignora despesas recorrentes no que precisa de acao", async () => {
    var today = new Date();
    var iso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    var r = await renderTree(
      <AcoesCard
        transactions={[
          // aluguel recorrente: previsivel, ja entra no orcamento
          tx({ id: "rec", type: "expense", status: "pending", amount: 800, due_date: iso, recurrence_group_id: "g1" } as any),
        ]}
        insights={INSIGHTS}
        onGoToLancamentos={noop}
      />
    );
    expect(r.text).toContain("Nada precisa da sua atenção agora");
  });
});
