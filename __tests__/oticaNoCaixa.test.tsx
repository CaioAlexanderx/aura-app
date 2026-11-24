// ============================================================
// p-208 (23/11/2026): a OS de ótica no Caixa.
//
// O que este arquivo trava:
//   1. faixa "Óculos deste cliente": receber o saldo chama o endpoint da OS
//      (quita a parcela), NUNCA o carrinho nem uma venda nova; a mesma chave
//      de idempotência em toda nova tentativa do mesmo recebimento;
//   2. "Entregar sem receber" só muda o status, sem sale_id;
//   3. OS sem sinal: "Lançar no carrinho" põe os itens da OS no carrinho;
//   4. OsActions (tela final): a OS de ótica COM sinal nunca aparece para
//      vincular venda (cobraria duas vezes); a SEM sinal aparece.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), info: jest.fn(), error: jest.fn() } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn(), back: jest.fn() } }));

var mockSettings: any = { otica_enabled: true, os_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockSettings }) }));

var mockOrders: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { orders: mockOrders }, isLoading: false, isError: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

const mockReceber = jest.fn();
const mockSetStatus = jest.fn().mockResolvedValue({});
const mockGet = jest.fn();
jest.mock("@/services/serviceOrdersApi", () => ({
  serviceOrdersApi: {
    receberSaldo: (...a: any[]) => mockReceber(...a),
    setStatus: (...a: any[]) => mockSetStatus(...a),
    get: (...a: any[]) => mockGet(...a),
    list: jest.fn(),
    oticaNoCaixa: jest.fn(),
  },
  printOs: jest.fn(),
}));
jest.mock("@/services/creditApi", () => ({ printReceipt: jest.fn() }));

import { OculosDoClienteBox } from "@/components/screens/pdv/OculosDoClienteBox";
import { OsActions } from "@/components/screens/pdv/OsActions";

const COM_SALDO = {
  id: "os-1aaaaaaa", os_number: 722, status: "pronta", estimated_amount: 180, deposit_sale_id: "venda-sinal",
  sale_id: null, lens: { design: "Multifocal", material: "1,56" }, frame: { description: "Acetato preta" },
  deposit_sale_total: 180, open_amount: 80, open_installments: 2, total_installments: 2, sem_venda: false,
};
const SEM_SINAL = {
  id: "os-2bbbbbbb", os_number: 723, status: "pronta", estimated_amount: 300, deposit_sale_id: null,
  sale_id: null, lens: null, frame: null, open_amount: 0, open_installments: 0, total_installments: 0, sem_venda: true,
};

const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n: any) => n.props?.testID === id && n.props.onPress)[0];
const tem = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n: any) => n.props?.testID === id).length > 0;
function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = { otica_enabled: true, os_enabled: false };
  mockOrders = [];
});

describe("faixa Óculos deste cliente", () => {
  function montar(onLancar = jest.fn()) {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<OculosDoClienteBox companyId="loja-1" customerId="cli-1" onLancarNoCarrinho={onLancar} />); });
    return t;
  }

  test("receber saldo e entregar: confirma, chama o endpoint da OS com a forma e a chave", async () => {
    mockOrders = [COM_SALDO];
    mockReceber.mockResolvedValue({ replayed: false, order: { os_number: 722, status: "entregue" }, paid: 80, method: "dinheiro", remaining: 0, settled: true, delivered: true, transaction_id: "tx-1", receipt_url: "/x" });
    const t = montar();
    expect(texto(t.toJSON())).toContain("saldo R$ 80,00 (2 parcelas)");
    act(() => { porId(t, "oculos-receber-722").props.onPress(); });
    expect(texto(t.toJSON())).toContain("Receber R$ 80,00 no Pix e entregar os óculos");
    act(() => { porId(t, "oculos-forma-dinheiro").props.onPress(); });
    await act(async () => { await porId(t, "oculos-confirmar-receber-722").props.onPress(); });

    expect(mockReceber).toHaveBeenCalledTimes(1);
    const [cid, osId, body, chave] = mockReceber.mock.calls[0];
    expect([cid, osId, body]).toEqual(["loja-1", "os-1aaaaaaa", { method: "dinheiro", entregar: true }]);
    expect(chave).toMatch(/^[A-Za-z0-9_:.-]{8,120}$/);
    expect(mockSetStatus).not.toHaveBeenCalled();
    expect(tem(t, "oculos-sucesso-722")).toBe(true);
    expect(texto(t.toJSON())).toContain("Recebido R$ 80,00 · Dinheiro · saldo da OS #722");
    expect(tem(t, "oculos-imprimir-recibo")).toBe(true);
  });

  test("erro de rede e nova tentativa: a MESMA chave (não cobra duas vezes)", async () => {
    mockOrders = [COM_SALDO];
    mockReceber.mockRejectedValueOnce({ status: 0, isNetworkError: true });
    mockReceber.mockResolvedValueOnce({ replayed: true, order: { os_number: 722 }, paid: 80, method: "pix", remaining: 0, settled: true, delivered: true, transaction_id: "tx-1", receipt_url: null });
    const t = montar();
    act(() => { porId(t, "oculos-receber-722").props.onPress(); });
    await act(async () => { await porId(t, "oculos-confirmar-receber-722").props.onPress(); });
    await act(async () => { await porId(t, "oculos-confirmar-receber-722").props.onPress(); });
    expect(mockReceber).toHaveBeenCalledTimes(2);
    expect(mockReceber.mock.calls[1][3]).toBe(mockReceber.mock.calls[0][3]);
  });

  test("entregar sem receber: só o status, sem venda vinculada", async () => {
    mockOrders = [COM_SALDO];
    const t = montar();
    await act(async () => { await porId(t, "oculos-entregar-722").props.onPress(); });
    expect(mockSetStatus).toHaveBeenCalledWith("loja-1", "os-1aaaaaaa", "entregue");
    expect(mockReceber).not.toHaveBeenCalled();
  });

  test("OS ainda no laboratório com saldo: 'Receber saldo' sem entregar e sem botão de entrega", async () => {
    mockOrders = [{ ...COM_SALDO, status: "em_execucao" }];
    mockReceber.mockResolvedValue({ replayed: false, order: { os_number: 722 }, paid: 80, method: "pix", remaining: 0, settled: true, delivered: false, transaction_id: "tx", receipt_url: null });
    const t = montar();
    expect(tem(t, "oculos-entregar-722")).toBe(false);
    act(() => { porId(t, "oculos-receber-722").props.onPress(); });
    await act(async () => { await porId(t, "oculos-confirmar-receber-722").props.onPress(); });
    expect(mockReceber.mock.calls[0][2]).toEqual({ method: "pix", entregar: false });
  });

  test("OS sem sinal: lança os itens no carrinho, sem receber saldo", async () => {
    mockOrders = [SEM_SINAL];
    mockGet.mockResolvedValue({ order: {}, items: [
      { description: "Armação", product_id: "prod-1", quantity: 1, unit_price: 200 },
      { description: "Lentes", product_id: null, quantity: 1, unit_price: 100 },
      { description: "Brinde", product_id: null, quantity: 1, unit_price: 0 },
    ] });
    const onLancar = jest.fn();
    const t = montar(onLancar);
    expect(tem(t, "oculos-receber-723")).toBe(false);
    await act(async () => { await porId(t, "oculos-lancar-723").props.onPress(); });
    expect(onLancar).toHaveBeenCalledWith("os-2bbbbbbb", [
      { description: "Armação", product_id: "prod-1", quantity: 1, unit_price: 200 },
      { description: "Lentes", product_id: null, quantity: 1, unit_price: 100 },
    ]);
    expect(mockReceber).not.toHaveBeenCalled();
    expect(tem(t, "oculos-lancada-723")).toBe(true);
  });

  test("Nova OS de óculos abre a OS com o cliente da venda", () => {
    const t = montar();
    act(() => { porId(t, "oculos-nova-os").props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/otica/nova?customer_id=cli-1");
    expect(tem(t, "oculos-vazio")).toBe(true);
  });
});

describe("OsActions (tela final) e a OS de ótica", () => {
  function montar() {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<OsActions companyId="loja-1" saleId="venda-9" customerId="cli-1" />); });
    return t;
  }
  const otica = (extra: any) => ({ id: "os-x", os_number: 50, status: "pronta", kind: "otica", estimated_amount: 300, reported_issue: "Óculos de grau", ...extra });

  test("OS de ótica COM sinal nunca aparece para vincular esta venda", () => {
    mockOrders = [otica({ deposit_sale_id: "venda-sinal" })];
    expect(montar().toJSON()).toBeNull();
  });

  test("OS de ótica sem sinal aparece e entrega vinculando esta venda", async () => {
    mockOrders = [otica({ deposit_sale_id: null, sale_id: null })];
    const t = montar();
    await act(async () => { await porId(t, "os-entregar-50").props.onPress(); });
    expect(mockSetStatus).toHaveBeenCalledWith("loja-1", "os-x", "entregue", { sale_id: "venda-9" });
  });

  test("só com a ótica ligada, OS de reparo não aparece; só com a OS ligada, a de ótica não aparece", () => {
    mockOrders = [{ id: "os-r", os_number: 9, status: "pronta", kind: "reparo", estimated_amount: 10, reported_issue: "tela" }];
    expect(montar().toJSON()).toBeNull();
    mockSettings = { os_enabled: true, otica_enabled: false };
    mockOrders = [otica({ deposit_sale_id: null })];
    expect(montar().toJSON()).toBeNull();
  });
});
