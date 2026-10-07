// ============================================================
// Matcon M1 — editar um orçamento (07/10/2026).
//
// "Editar" em /matcon/orcamentos abre o Caixa com ?quote=<id>&edit=1; o
// carrinho vira o orçamento e o botão "Orçamento" salva POR CIMA dele.
// Aqui, os dois hooks que carregam a regra:
//   - useOrcamentoNoCaixa: com `edit=1` avisa quem aplica (`editando`) e
//     fala "Editando o orçamento #N"; sem ele, tudo como antes. E abrir o
//     MESMO orçamento pela segunda vez carrega de novo.
//   - useMatconQuote: com `editing` chama updateQuote (nunca createQuote),
//     manda o desconto mesmo zerado, tira o cliente quando o Caixa ficou
//     sem, e avisa `onSaved` com `edited: true`.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), setParams: jest.fn() } }));
jest.mock("@/utils/whatsapp", () => ({ openWhatsApp: jest.fn() }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
const mockGetQuote = jest.fn();
const mockCreateQuote = jest.fn();
const mockUpdateQuote = jest.fn();
jest.mock("@/services/matconApi", () => ({
  matconApi: {
    getQuote: (...a: any[]) => mockGetQuote(...a),
    createQuote: (...a: any[]) => mockCreateQuote(...a),
    updateQuote: (...a: any[]) => mockUpdateQuote(...a),
    markQuoteSent: jest.fn(),
  },
}));

import { toast } from "@/components/Toast";
import { router } from "expo-router";
import { useOrcamentoNoCaixa, edicaoDaUrl, avisoDoOrcamento } from "@/hooks/useOrcamentoNoCaixa";
import { useMatconQuote, type MatconQuoteEditing } from "@/hooks/useMatconQuote";

const ORCAMENTO = {
  id: "q-1", number: 12, status: "open", customer_id: "c-1", customer_name: "Marlene",
  valid_until: "2026-10-14", public_token: "t", subtotal: 979.9, discount: 20, total: 959.9,
  created_at: "2026-10-07T10:00:00Z",
  items: [
    { product_id: "p1", name: "Tijolo baiano", unit: "mlh", quantity: 1, unit_price: 890 },
    { product_id: "p2", name: "Cimento", unit: "sc", quantity: 2, unit_price: 44.95 },
  ],
};

async function flush() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => { jest.clearAllMocks(); });

describe("Caixa com ?quote=&edit=1", () => {
  let qc: QueryClient;
  beforeEach(() => { qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
  afterEach(() => { qc.clear(); });

  function Caixa({ quote, edit, aplicar }: { quote: unknown; edit?: unknown; aplicar: (q: any, o: any) => void }) {
    useOrcamentoNoCaixa({ quoteParam: quote, editParam: edit, companyId: "empresa-1", enabled: true, aplicar });
    return null;
  }
  const tela = (p: { quote: unknown; edit?: unknown; aplicar: any }) =>
    <QueryClientProvider client={qc}><Caixa {...p} /></QueryClientProvider>;

  test("edicaoDaUrl: só '1' e 'true' ligam", () => {
    expect(edicaoDaUrl("1")).toBe(true);
    expect(edicaoDaUrl(["1"])).toBe(true);
    expect(edicaoDaUrl("true")).toBe(true);
    expect(edicaoDaUrl(undefined)).toBe(false);
    expect(edicaoDaUrl("undefined")).toBe(false);
    expect(edicaoDaUrl("0")).toBe(false);
  });

  test("o aviso de edição é outro; o de virar pedido não mudou", () => {
    expect(avisoDoOrcamento(ORCAMENTO as any, true)).toBe("Editando o orçamento #12 — 2 itens no carrinho");
    expect(avisoDoOrcamento(ORCAMENTO as any)).toBe("Orçamento #12 no carrinho — 2 itens");
  });

  test("edit=1: aplica com editando e limpa quote e edit da URL", async () => {
    mockGetQuote.mockResolvedValue({ quote: ORCAMENTO });
    const aplicar = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(tela({ quote: "q-1", edit: "1", aplicar })); });
    await flush();

    expect(aplicar).toHaveBeenCalledTimes(1);
    expect(aplicar.mock.calls[0][1]).toEqual({ editando: true });
    expect(toast.success).toHaveBeenCalledWith("Editando o orçamento #12 — 2 itens no carrinho");
    expect((router.setParams as jest.Mock).mock.calls[0][0]).toHaveProperty("edit", undefined);
    expect((router.setParams as jest.Mock).mock.calls[0][0]).toHaveProperty("quote", undefined);
    tree.unmount();
  });

  test("sem edit: aplica sem editando (virar pedido continua igual)", async () => {
    mockGetQuote.mockResolvedValue({ quote: ORCAMENTO });
    const aplicar = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(tela({ quote: "q-1", aplicar })); });
    await flush();

    expect(aplicar.mock.calls[0][1]).toEqual({ editando: false });
    expect(toast.success).toHaveBeenCalledWith("Orçamento #12 no carrinho — 2 itens");
    tree.unmount();
  });

  test("o mesmo orçamento aberto duas vezes, com o Caixa montado: carrega nas duas", async () => {
    mockGetQuote.mockResolvedValue({ quote: ORCAMENTO });
    const aplicar = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(tela({ quote: "q-1", edit: "1", aplicar })); });
    await flush();
    expect(aplicar).toHaveBeenCalledTimes(1);

    // A URL foi limpa (o expo-router devolve a string "undefined")...
    act(() => { tree.update(tela({ quote: "undefined", edit: "undefined", aplicar })); });
    await flush();
    expect(aplicar).toHaveBeenCalledTimes(1);

    // ...e a pessoa volta a Orçamentos e toca em Editar no mesmo card.
    act(() => { tree.update(tela({ quote: "q-1", edit: "1", aplicar })); });
    await flush();
    expect(aplicar).toHaveBeenCalledTimes(2);
    expect(aplicar.mock.calls[1][1]).toEqual({ editando: true });
    tree.unmount();
  });
});

describe("'Orçamento' do Caixa editando", () => {
  let api: ReturnType<typeof useMatconQuote>;
  type P = { editing?: MatconQuoteEditing | null; customerId?: string | null; discount?: number; sellerId?: string | null; onSaved?: any; onPrint?: () => void };
  function Harness(p: P) {
    api = useMatconQuote({
      companyId: "empresa-1",
      matconEnabled: true,
      cart: [{ productId: "p1__v1", name: "Cimento", price: 38, qty: 10, unit: "sc" }],
      ...p,
    });
    return null;
  }
  function montar(p: P) {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Harness {...p} />); });
    return tree;
  }
  const EDITANDO: MatconQuoteEditing = { id: "q-1", number: 12, customerId: "c-1" };
  const SALVO = { ...ORCAMENTO, total: 380 };

  test("salva por cima: updateQuote no mesmo id, nunca createQuote", async () => {
    mockUpdateQuote.mockResolvedValue({ quote: SALVO });
    const onSaved = jest.fn();
    const imprimir = jest.fn();
    const tree = montar({ editing: EDITANDO, customerId: "c-1", discount: 15, sellerId: "e-1", onSaved, onPrint: imprimir });
    await act(async () => { await api.saveQuote!(); });

    expect(mockCreateQuote).not.toHaveBeenCalled();
    expect(mockUpdateQuote).toHaveBeenCalledTimes(1);
    const [empresa, id, body] = mockUpdateQuote.mock.calls[0];
    expect(empresa).toBe("empresa-1");
    expect(id).toBe("q-1");
    expect(body.items[0]).toMatchObject({ product_id: "p1", quantity: 10, unit_price: 38, unit: "sc" });
    expect(body.discount).toBe(15);
    expect(body.customer_id).toBe("c-1");
    expect(body.seller_id).toBe("e-1");
    // O que o Caixa não conhece não vai — e por isso não muda.
    expect(body).not.toHaveProperty("valid_until");
    expect(body).not.toHaveProperty("notes");
    expect(body).not.toHaveProperty("reference");
    expect(body).not.toHaveProperty("status");

    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Orçamento #12 impresso e atualizado em Orçamentos");
    expect(onSaved).toHaveBeenCalledWith(SALVO, { edited: true });
    expect(api.savedQuote?.updated).toBe(true);
    tree.unmount();
  });

  test("tirou o desconto no Caixa: vai 0, não some do pedido", async () => {
    mockUpdateQuote.mockResolvedValue({ quote: SALVO });
    const tree = montar({ editing: EDITANDO, customerId: "c-1", discount: 0 });
    await act(async () => { await api.saveQuote!(); });
    expect(mockUpdateQuote.mock.calls[0][2].discount).toBe(0);
    tree.unmount();
  });

  test("tinha cliente e o Caixa ficou sem: o orçamento também fica sem", async () => {
    mockUpdateQuote.mockResolvedValue({ quote: SALVO });
    const tree = montar({ editing: EDITANDO, customerId: null });
    await act(async () => { await api.saveQuote!(); });
    expect(mockUpdateQuote.mock.calls[0][2]).toMatchObject({ customer_id: null, customer_name: null, customer_phone: null });
    tree.unmount();
  });

  test("nunca teve cliente cadastrado: o nome digitado no orçamento não é tocado", async () => {
    mockUpdateQuote.mockResolvedValue({ quote: SALVO });
    const tree = montar({ editing: { ...EDITANDO, customerId: null }, customerId: null });
    await act(async () => { await api.saveQuote!(); });
    const body = mockUpdateQuote.mock.calls[0][2];
    expect(body).not.toHaveProperty("customer_id");
    expect(body).not.toHaveProperty("customer_name");
    tree.unmount();
  });

  test("falhou ao salvar a edição: avisa das mudanças e não chama onSaved", async () => {
    mockUpdateQuote.mockRejectedValue(Object.assign(new Error("Rota nao encontrada"), { status: 404, data: { error: "Rota nao encontrada" }, isNetworkError: false }));
    const onSaved = jest.fn();
    const tree = montar({ editing: EDITANDO, customerId: "c-1", onSaved });
    await act(async () => { await api.saveQuote!(); });
    expect(toast.error).toHaveBeenCalledWith("Não consegui salvar as mudanças do orçamento. Tente de novo daqui a pouco.");
    expect(onSaved).not.toHaveBeenCalled();
    expect(api.savedQuote).toBeNull();
    tree.unmount();
  });

  test("sem editing: continua criando um orçamento novo", async () => {
    mockCreateQuote.mockResolvedValue({ quote: SALVO });
    const onSaved = jest.fn();
    const tree = montar({ onSaved });
    await act(async () => { await api.saveQuote!(); });
    expect(mockUpdateQuote).not.toHaveBeenCalled();
    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Orçamento #12 salvo em Orçamentos");
    expect(onSaved).toHaveBeenCalledWith(SALVO, { edited: false });
    expect(api.savedQuote?.updated).toBeUndefined();
    tree.unmount();
  });
});
