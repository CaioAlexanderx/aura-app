// Atrasos clicáveis no Financeiro (contas F4 · 29/09/2026). O "Cobre R$ X em
// atraso" e a faixa "Atrasadas" diziam só o total e levavam à aba Lançamentos.
// Agora dizem quanto é crediário e quanto é conta, e cada parte leva para
// onde se resolve: Crediário (filtrado em atraso) ou Quadro (coluna Atrasado).
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));

import { destinoPrincipal, detalheDoAtraso, partesDaFaixa, partesDoAtraso } from "@/utils/atrasos";
import { AcoesCard } from "@/components/screens/financeiro/v2/AcoesCard";
import { Timeline } from "@/components/screens/financeiro/v2/SharedCards";

const fmt = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join(" ");
  return texto(node.children);
}
const porTestID = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props && n.props.testID === id && typeof n.type !== "string")[0];

describe("utils/atrasos", () => {
  it("divide pelo split do backend e escolhe a parte maior", () => {
    const p = partesDoAtraso({ amount: 680, count: 5 }, { crediario: { amount: 480, count: 3 }, contas: { amount: 200, count: 2 } });
    expect(p).toEqual({ crediario: { amount: 480, count: 3 }, contas: { amount: 200, count: 2 } });
    expect(destinoPrincipal(p)).toBe("crediario");
    expect(detalheDoAtraso(p, fmt, { oldestDays: 12 }))
      .toBe("R$ 480,00 em 3 parcelas do crediário · R$ 200,00 em 2 contas a receber. A mais antiga está há 12 dias.");
  });

  it("sem split (backend antigo) tudo conta como contas", () => {
    const p = partesDoAtraso({ amount: 300, count: 2 }, undefined);
    expect(p).toEqual({ crediario: { amount: 0, count: 0 }, contas: { amount: 300, count: 2 } });
    expect(destinoPrincipal(p)).toBe("contas");
    expect(detalheDoAtraso(p, fmt, { oldestDays: 1 })).toBe("R$ 300,00 em 2 contas a receber. A mais antiga está há 1 dia.");
  });

  it("faixa da timeline", () => {
    expect(partesDaFaixa({ total: 680, count: 5, crediario: { total: 480, count: 3 } }).contas).toEqual({ amount: 200, count: 2 });
    expect(partesDaFaixa({ total: 90, count: 1 }).crediario).toEqual({ amount: 0, count: 0 });
  });
});

const insights: any = {
  biggest_lever: { type: "collect_overdue", headline: "", amount: 680, impact_days: 0, count: 5, oldest_days: 12, split: { crediario: { amount: 480, count: 3 }, contas: { amount: 200, count: 2 } } },
};

describe("AcoesCard · Cobre R$ X em atraso", () => {
  function render(props: any) {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<AcoesCard transactions={[]} insights={insights} onGoToLancamentos={jest.fn()} {...props} />); });
    return t;
  }

  it("diz quanto é crediário e quanto é conta, com um link para cada", () => {
    const verAtrasados = jest.fn();
    const verCred = jest.fn();
    const t = render({ onVerAtrasados: verAtrasados, onVerCrediarioAtrasado: verCred });
    const s = texto(t.toJSON());
    expect(s).toMatch(/R\$\s*480,00 em 3 parcelas do crediário · R\$\s*200,00 em 2 contas a receber/);
    act(() => { porTestID(t, "atraso-link-crediario").props.onPress(); });
    expect(verCred).toHaveBeenCalledTimes(1);
    act(() => { porTestID(t, "atraso-link-quadro").props.onPress(); });
    expect(verAtrasados).toHaveBeenCalledWith("income");
  });

  it("no consolidado (sem os caminhos) segue indo para Lançamentos", () => {
    const lanc = jest.fn();
    const t = render({ onGoToLancamentos: lanc, consolidated: true });
    expect(porTestID(t, "atraso-link-crediario")).toBeUndefined();
    const linha = t.root.findAll((n) => n.props && n.props.accessibilityRole === "button" && /Cobre/.test(String(n.props.accessibilityLabel || "")))[0];
    act(() => { linha.props.onPress(); });
    expect(lanc).toHaveBeenCalled();
  });
});

describe("Timeline · Atrasadas", () => {
  const buckets: any = {
    atrasadas: { total: 680, count: 5, crediario: { total: 480, count: 3 } },
    esta_semana: { total: 100, count: 1 },
    este_mes: { total: 0, count: 0 },
    futuras: { total: 0, count: 0 },
  };

  it("a linha é clicável, divide o valor e oferece os dois caminhos", () => {
    const verAtrasados = jest.fn();
    const verCred = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Timeline buckets={buckets} kind="receivable" onVerAtrasados={verAtrasados} onVerCrediarioAtrasado={verCred} />); });
    expect(texto(t.toJSON())).toMatch(/R\$\s*480,00 em 3 parcelas do crediário/);
    act(() => { porTestID(t, "timeline-atrasadas").props.onPress(); });
    expect(verCred).toHaveBeenCalledTimes(1); // parte maior
    act(() => { porTestID(t, "timeline-link-quadro").props.onPress(); });
    expect(verAtrasados).toHaveBeenCalledTimes(1);
  });

  it("despesas sem crediário: a linha leva direto ao quadro", () => {
    const verAtrasados = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Timeline buckets={{ ...buckets, atrasadas: { total: 300, count: 2, crediario: { total: 0, count: 0 } } }} kind="payable" onVerAtrasados={verAtrasados} />); });
    expect(porTestID(t, "timeline-link-crediario")).toBeUndefined();
    act(() => { porTestID(t, "timeline-atrasadas").props.onPress(); });
    expect(verAtrasados).toHaveBeenCalledTimes(1);
  });
});
