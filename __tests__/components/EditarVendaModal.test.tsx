// ============================================================
// Editar venda (09/11/2026) — o modal de edição
//
//   1. trocar a forma pede a prévia ao servidor (dry_run) com SÓ a forma no
//      corpo, mostra o efeito no campo, Conferir e Salvar gravam com motivo
//   2. Crediário sem cliente: campo destacado e Continuar travado
//   3. venda com devolução: forma e cliente travados, com o motivo
//   4. NFC-e autorizada: aviso, crediário desligado, atalho de cancelar
//   5. entrar no crediário pede confirmação antes de gravar
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
  SHEET_NARROW_BP: 500,
}));
jest.mock("@/components/Button", () => {
  const R = require("react");
  return { Button: (p: any) => R.createElement("Button", p, p.title) };
});
jest.mock("@/services/employeesApi", () => ({ employeesApi: { list: jest.fn() } }));
jest.mock("@/services/salesApi", () => ({ salesApi: { cancelNfce: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { employees: [{ id: "ana", name: "Ana" }, { id: "bia", name: "Bia" }] }, isLoading: false }),
}));
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: [{ id: "cli", name: "Cliente Exemplo", phone: "(11) 98765-4321", email: "" }] }),
}));

let mockCtx: any = null;
const mockPreview = jest.fn();
const mockApply = jest.fn();
jest.mock("@/hooks/useSales", () => ({
  useSaleEditContext: () => ({ context: mockCtx, isLoading: false, error: null, refetch: jest.fn() }),
  useEditSale: () => ({
    previewEdit: (...a: any[]) => mockPreview(...a),
    applyEdit: (...a: any[]) => mockApply(...a),
    isPreviewing: false, isSaving: false,
  }),
}));

import { EditarVendaModal } from "@/components/screens/vendas/EditarVendaModal";

function contexto(over: any = {}) {
  return Object.assign({
    sale: { id: "v1", sale_number: 1042, total_amount: 189.7, created_at: "2026-11-07T18:42:00Z", dia: "2026-11-07", type: "sale", status: "completed", payment_method: "dinheiro", company_id: "c1" },
    editable: true, locked: null,
    current: { payments: [{ method: "dinheiro", amount: 189.7 }], credit: null, seller: { id: "ana", name: "Ana" }, customer: null },
    locks: { money: null, seller: null },
    permissions: { seller: true, money: true },
    nfce: null,
    caixa: { sessao_id: "s1", status: "fechada", dinheiro_contado: 412 },
  }, over);
}

const PLANO = {
  sale_id: "v1", sale_number: 1042, changes: ["payments"],
  before: { payments: [{ method: "dinheiro", amount: 189.7 }], seller: { id: "ana", name: "Ana" }, customer: null },
  after: { payments: [{ method: "pix", amount: 189.7 }], seller: { id: "ana", name: "Ana" }, customer: null },
  effects: [{ code: "CASH_CHANGED", text: "O Financeiro e o caixa de 07/11 passam a mostrar R$ 189,70 no Pix." }, { code: "NO_STOCK_CHANGE", text: "Os produtos e o estoque não mudam." }],
  warnings: [{ code: "CAIXA_CLOSED", text: "O caixa de 07/11 já foi fechado." }],
  credit: null, requires_confirmation: false, confirmation: null, nfce: null, caixa: null,
};

const porId = (tree: renderer.ReactTestRenderer, testID: string) => tree.root.findAllByProps({ testID }, { deep: false });
function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
function continuar(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll((n: any) => n.type === "Button" && n.props.title === "Continuar →")[0];
}
function botao(tree: renderer.ReactTestRenderer, titulo: string) {
  return tree.root.findAll((n: any) => n.type === "Button" && n.props.title === titulo)[0];
}

function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<EditarVendaModal visible saleId="v1" companyId="c1" onClose={jest.fn()} />); });
  return tree;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockCtx = contexto();
  mockPreview.mockResolvedValue({ dry_run: true, plan: PLANO });
  mockApply.mockResolvedValue({ ok: true, plan: { ...PLANO }, result: { credit: null, edit: { id: "e1", created_at: "x", edited_by_name: "Caio" } } });
});
afterEach(() => { jest.useRealTimers(); });

test("1. troca a forma: prévia com só a forma, efeito no campo, Conferir e Salvar com motivo", async () => {
  const tree = montar();
  expect(continuar(tree).props.disabled).toBe(true); // nada mudou ainda

  act(() => { porId(tree, "forma-pix")[0].props.onPress(); });
  await act(async () => { jest.advanceTimersByTime(450); await Promise.resolve(); });
  expect(mockPreview).toHaveBeenCalledWith({ saleId: "v1", body: { payments: [{ method: "pix", amount: 189.7 }] } });
  const campo = texto(porId(tree, "campo-forma")[0]);
  expect(campo).toContain("Era:");
  expect(campo).toContain("passam a mostrar R$ 189,70 no Pix");
  expect(campo).toContain("já foi fechado");
  expect(texto(porId(tree, "resumo-mudancas")[0])).toContain("1 mudança: forma de pagamento");

  await act(async () => { await continuar(tree).props.onPress(); });
  const conferir = texto(porId(tree, "passo-conferir")[0]);
  expect(conferir).toContain("Antes");
  expect(conferir).toContain("Dinheiro R$ 189,70");
  expect(conferir).toContain("Pix R$ 189,70");
  expect(conferir).toContain("Os produtos e o estoque não mudam.");

  act(() => { porId(tree, "motivo")[0].props.onChangeText("Parte foi no Pix"); });
  await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
  expect(mockApply).toHaveBeenCalledWith({ saleId: "v1", body: { payments: [{ method: "pix", amount: 189.7 }], reason: "Parte foi no Pix" } });
  expect(porId(tree, "passo-pronto").length).toBe(1);
  expect(texto(porId(tree, "passo-pronto")[0])).toContain("Venda #1042 atualizada");
  tree.unmount();
});

test("2. Crediário sem cliente: campo destacado e Continuar travado", async () => {
  const tree = montar();
  act(() => { porId(tree, "forma-crediario")[0].props.onPress(); });
  expect(porId(tree, "falta-cliente").length).toBe(1);
  expect(continuar(tree).props.disabled).toBe(true);
  await act(async () => { jest.advanceTimersByTime(450); await Promise.resolve(); });
  expect(mockPreview).not.toHaveBeenCalled();
  tree.unmount();
});

test("3. venda com devolução: forma e cliente travados com o motivo, vendedor(a) livre", () => {
  mockCtx = contexto({ locks: { money: { code: "SALE_HAS_ACTIVE_RETURN", message: "Esta venda tem a devolução #1051 registrada, então a forma e o cliente ficam como estão." }, seller: null } });
  const tree = montar();
  expect(texto(porId(tree, "trava-forma")[0])).toContain("#1051");
  expect(porId(tree, "forma-pix").length).toBe(0);
  expect(texto(porId(tree, "campo-vendedor")[0])).toContain("Trocar");
  expect(texto(porId(tree, "resumo-mudancas")[0])).toContain("Só o vendedor(a) pode mudar");
  tree.unmount();
});

test("4. NFC-e autorizada: aviso, crediário desligado e atalho de cancelar a nota", () => {
  const ate = new Date(Date.now() + 20 * 60000).toISOString();
  mockCtx = contexto({ nfce: { id: "n1", numero: 2318, authorized_at: new Date().toISOString(), cancel_until: ate, can_cancel: true } });
  const tree = montar();
  expect(texto(porId(tree, "aviso-nfce")[0])).toContain("NFC-e 2318");
  expect(porId(tree, "forma-crediario")[0].props.desligado).toBe(true);
  expect(tree.root.findAll((n: any) => n.type === "Button" && /Cancelar a nota e emitir outra/.test(n.props.title)).length).toBe(1);
  tree.unmount();
});

test("5. entrar no crediário pede confirmação antes de gravar", async () => {
  mockCtx = contexto({ current: { payments: [{ method: "pix", amount: 189.7 }], credit: null, seller: { id: "ana", name: "Ana" }, customer: { id: "cli", name: "Cliente Exemplo" } } });
  const planoCred = {
    ...PLANO,
    after: { ...PLANO.after, payments: [{ method: "crediario", amount: 189.7, installments: 3 }] },
    credit: { action: "enter", to: { amount: 189.7, installments: 3, first_due_date: "2026-12-07", account_name: "Compra de 07/11", customer: { id: "cli", name: "Cliente Exemplo" }, schedule: [
      { installment_number: 1, amount_due: 63.23, due_date: "2026-12-07" }, { installment_number: 2, amount_due: 63.23, due_date: "2027-01-07" }, { installment_number: 3, amount_due: 63.24, due_date: "2027-02-07" },
    ] } },
    requires_confirmation: true,
    confirmation: { title: "Lançar no crediário?", text: "Cliente Exemplo fica devendo R$ 189,70 em 3 parcelas.", confirm_label: "Sim, lançar" },
  };
  mockPreview.mockResolvedValue({ dry_run: true, plan: planoCred });
  const tree = montar();
  act(() => { porId(tree, "forma-crediario")[0].props.onPress(); });
  act(() => { tree.root.findAll((n: any) => n.props && n.props.accessibilityLabel === "Mais uma parcela")[0].props.onPress(); });
  act(() => { tree.root.findAll((n: any) => n.props && n.props.accessibilityLabel === "Mais uma parcela")[0].props.onPress(); });
  await act(async () => { jest.advanceTimersByTime(450); await Promise.resolve(); });
  const corpo5 = mockPreview.mock.calls[mockPreview.mock.calls.length - 1][0].body;
  expect(corpo5).toEqual({
    payments: [{ method: "crediario", amount: 189.7 }], installments: 3, first_due_date: expect.any(String),
  });
  // 1ª parcela sugerida: um mês depois de hoje (a venda é de antes de hoje).
  expect(corpo5.first_due_date > new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })).toBe(true);
  expect(texto(porId(tree, "campo-forma")[0])).toContain("63,24");

  await act(async () => { await continuar(tree).props.onPress(); });
  await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
  expect(mockApply).not.toHaveBeenCalled();
  expect(texto(porId(tree, "confirmar-crediario")[0])).toContain("Lançar no crediário?");
  await act(async () => { await botao(tree, "Sim, lançar").props.onPress(); });
  expect(mockApply).toHaveBeenCalledTimes(1);
  tree.unmount();
});

// ── Revisão de 09/11/2026 ───────────────────────────────────────────────────
import { toast as mockToast } from "@/components/Toast";

test("6. servidor sem mudança (plan.changes vazio): não avança e avisa sem erro", async () => {
  mockPreview.mockResolvedValue({ dry_run: true, plan: { ...PLANO, changes: [], effects: [], warnings: [] } });
  const tree = montar();
  act(() => { porId(tree, "forma-pix")[0].props.onPress(); });
  await act(async () => { jest.advanceTimersByTime(450); await Promise.resolve(); });
  await act(async () => { await continuar(tree).props.onPress(); });
  expect(porId(tree, "passo-conferir").length).toBe(0);
  expect(mockToast.info).toHaveBeenCalledWith("Nada mudou: a venda já está assim.");
  expect(mockToast.error).not.toHaveBeenCalled();
  tree.unmount();
});

test("7. salvar responde 400 NO_CHANGES: neutro, nunca erro", async () => {
  mockApply.mockRejectedValue(Object.assign(new Error("Nada mudou"), { status: 400, data: { code: "NO_CHANGES", error: "Nada mudou" } }));
  const tree = montar();
  act(() => { porId(tree, "forma-pix")[0].props.onPress(); });
  await act(async () => { jest.advanceTimersByTime(450); await Promise.resolve(); });
  await act(async () => { await continuar(tree).props.onPress(); });
  await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
  expect(mockToast.error).not.toHaveBeenCalled();
  expect(mockToast.info).toHaveBeenCalledWith("Nada mudou: a venda já está assim.");
  expect(porId(tree, "passo-pronto").length).toBe(0);
  tree.unmount();
});

test("8. NF-e 55 autorizada: mesmo aviso, com o nome da nota", () => {
  const ate = new Date(Date.now() + 20 * 60000).toISOString();
  mockCtx = contexto({ nfce: { id: "n1", tipo: "nfe", numero: 77, authorized_at: new Date().toISOString(), cancel_until: ate, can_cancel: true } });
  const tree = montar();
  expect(texto(porId(tree, "aviso-nfce")[0])).toContain("NF-e 77");
  expect(porId(tree, "forma-crediario")[0].props.desligado).toBe(true);
  tree.unmount();
});

test("9. venda antiga sem crediário: a 1ª parcela sugerida nunca fica no passado", async () => {
  mockCtx = contexto({
    sale: { ...contexto().sale, created_at: "2026-01-10T15:00:00Z", dia: "2026-01-10" },
    current: { payments: [{ method: "pix", amount: 189.7 }], credit: null, seller: { id: "ana", name: "Ana" }, customer: { id: "cli", name: "Cliente Exemplo" } },
  });
  const tree = montar();
  act(() => { porId(tree, "forma-crediario")[0].props.onPress(); });
  await act(async () => { jest.advanceTimersByTime(450); await Promise.resolve(); });
  const body = mockPreview.mock.calls[mockPreview.mock.calls.length - 1][0].body;
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  expect(body.first_due_date > hoje).toBe(true);
  tree.unmount();
});
