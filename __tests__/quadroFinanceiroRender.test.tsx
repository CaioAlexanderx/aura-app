// Quadro do Financeiro (28/09/2026) — render com o hook simulado: três
// colunas na ordem combinada, grupos do Caixa, cartão travado sem botão, e o
// botão "Recebi" abrindo a confirmação que chama o PATCH certo.
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
// O Modal nativo não monta no react-test-renderer: a folha entra sem ele.
jest.mock("@/components/screens/financeiro/quadro/MoverSheet", () => {
  const real = jest.requireActual("@/components/screens/financeiro/quadro/MoverSheet");
  const R = require("react");
  return { ...real, MoverSheet: (p: any) => (p.alvo ? R.createElement(real.MoverSheetConteudo, p) : null) };
});
jest.mock("@/components/CalendarioDoDia", () => ({ CalendarioDoDia: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));

const mockMover = jest.fn();
const mockQuadro = {
  type: "income", month: "2026-09", today: "2026-09-28", limit_per_column: 150,
  columns: {
    atrasado: { total: 97.5, count: 1, items: [
      { id: "a", description: "Parcela calça", category: "Vendas", amount: 97.5, status: "pending", date: "2026-08-30", due_date: "2026-08-30", paid_at: null, payment_method: null, notes: null, employee_name: null, recurrence_type: null, recurrence_index: null, movable: true },
    ] },
    aberto: { total: 432, count: 1, items: [
      { id: "b", description: "Encomenda 4 blusas", category: "Venda a prazo", amount: 432, status: "pending", date: "2026-09-30", due_date: "2026-09-30", paid_at: null, payment_method: null, notes: null, employee_name: null, recurrence_type: null, recurrence_index: null, movable: true },
    ] },
    feito: { total: 1534.7, count: 10, items: [
      { id: "c", description: "Pedido da vitrine", category: "Vendas", amount: 250, status: "confirmed", date: "2026-09-05", due_date: "2026-09-05", paid_at: "2026-09-05T03:00:00.000Z", payment_method: "pix", notes: null, employee_name: null, recurrence_type: null, recurrence_index: null, movable: false },
    ], grupos: [{ date: "2026-09-27", origem: "caixa", count: 9, total: 1284.7 }] },
  },
};

jest.mock("@/hooks/useQuadroFinanceiro", () => ({
  useQuadroFinanceiro: () => ({ quadro: mockQuadro, carregando: false, erro: false, recarregar: jest.fn(), mover: mockMover, salvando: false }),
}));

import { QuadroFinanceiro } from "@/components/screens/financeiro/quadro/QuadroFinanceiro";

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join(" ");
  return texto(node.children);
}

const mockEditar = jest.fn();

function render() {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<QuadroFinanceiro companyId="c1" onEditar={mockEditar} />); });
  return t;
}

const porTestID = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props && n.props.testID === id && typeof n.type !== "string")[0];

describe("QuadroFinanceiro", () => {
  beforeEach(() => mockMover.mockReset());

  it("colunas na ordem Atrasado · A receber · Recebido", () => {
    const t = render();
    const ids = t.root.findAll((n) => typeof n.props?.testID === "string" && n.props.testID.startsWith("quadro-coluna-") && typeof n.type !== "string")
      .map((n) => n.props.testID);
    expect(Array.from(new Set(ids))).toEqual(["quadro-coluna-atrasado", "quadro-coluna-aberto", "quadro-coluna-feito"]);
  });

  it("mostra o selo de atraso, o mês de origem e o grupo do Caixa", () => {
    const s = texto(render().toJSON());
    expect(s).toMatch(/Venceu há 29 dias/);
    expect(s).toMatch(/de agosto/);
    expect(s).toMatch(/Vendas do Caixa\s+·\s+27\/09/);
    expect(s).toMatch(/9\s+vendas/);
  });

  it("cartão travado não tem botão de ação", () => {
    const t = render();
    expect(porTestID(t, "quadro-desfazer-c")).toBeUndefined();
    expect(texto(t.toJSON())).toMatch(/Muda pela venda/);
  });

  it("Recebi abre a confirmação e confirma com data de hoje e Pix", () => {
    const t = render();
    act(() => { porTestID(t, "quadro-baixa-b").props.onPress(); });
    expect(texto(t.toJSON())).toMatch(/Recebido\?/);
    act(() => { porTestID(t, "quadro-confirmar").props.onPress(); });
    expect(mockMover).toHaveBeenCalledWith({ id: "b", mov: "baixa", data: "2026-09-28", forma: "pix" });
  });

  it("Nova data no atrasado sugere uma semana depois de hoje", () => {
    const t = render();
    act(() => { porTestID(t, "quadro-nova-data-a").props.onPress(); });
    act(() => { porTestID(t, "quadro-confirmar").props.onPress(); });
    expect(mockMover).toHaveBeenCalledWith({ id: "a", mov: "nova_data", data: "2026-10-05", forma: undefined });
  });

  it("Editar aparece nos cartões editáveis e abre o lançamento no formato do modal", () => {
    const t = render();
    expect(porTestID(t, "quadro-editar-c")).toBeUndefined();
    act(() => { porTestID(t, "quadro-editar-a").props.onPress(); });
    expect(mockEditar).toHaveBeenCalledWith(expect.objectContaining({ id: "a", desc: "Parcela calça", type: "income", amount: 97.5, employee_id: null }));
  });
});
