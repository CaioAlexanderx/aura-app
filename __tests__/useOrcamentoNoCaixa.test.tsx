// ============================================================
// Caixa aberto com ?quote= (hooks/useOrcamentoNoCaixa.ts) — QA 23/09/2026.
//
// Em produção: 4 avisos ("virou pedido", "carregado no carrinho" ×2, "Não
// foi possível carregar o orçamento") e um GET /matcon/quotes/undefined. As
// causas: o Caixa montava duas vezes (PageTransition) e o
// setParams({ quote: undefined }) fazia o expo-router devolver a string
// "undefined". Aqui:
//   - montar, desmontar no meio da busca e montar de novo (o que o
//     PageTransition fazia) → UMA busca, UM aviso, carrinho aplicado uma vez;
//   - a URL com "undefined" depois da limpeza → nenhuma busca nova;
//   - orçamento já no cache (a tela de Orçamentos deixa lá) → zero busca.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockGetQuote = jest.fn();
jest.mock("@/services/matconApi", () => ({ matconApi: { getQuote: (...a: any[]) => mockGetQuote(...a) } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { setParams: jest.fn() } }));

import { toast } from "@/components/Toast";
import { router } from "expo-router";
import {
  useOrcamentoNoCaixa, orcamentoDaUrl, avisoDoOrcamento, chaveDoOrcamento,
} from "@/hooks/useOrcamentoNoCaixa";

const ORCAMENTO = {
  id: "q-1", number: 1, status: "approved", customer_id: null, customer_name: "Marlene",
  valid_until: "2026-09-30", public_token: "t", subtotal: 979.9, discount: 0, total: 979.9,
  created_at: "2026-09-23T10:00:00Z",
  items: [
    { product_id: "p1", name: "Tijolo baiano", unit: "mlh", quantity: 1, unit_price: 890 },
    { product_id: "p2", name: "Cimento", unit: "sc", quantity: 2, unit_price: 44.95 },
  ],
};

function Caixa({ quote, aplicar }: { quote: unknown; aplicar: (q: any) => void }) {
  useOrcamentoNoCaixa({ quoteParam: quote, companyId: "empresa-1", enabled: true, aplicar });
  return null;
}

async function flush() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

let qc: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => { qc.clear(); });

describe("orcamentoDaUrl / avisoDoOrcamento", () => {
  test("'undefined', 'null', vazio e ausente não são id", () => {
    expect(orcamentoDaUrl(undefined)).toBeNull();
    expect(orcamentoDaUrl("undefined")).toBeNull();
    expect(orcamentoDaUrl("null")).toBeNull();
    expect(orcamentoDaUrl("  ")).toBeNull();
    expect(orcamentoDaUrl(["q-1"])).toBe("q-1");
    expect(orcamentoDaUrl("q-1")).toBe("q-1");
  });

  test("um aviso só, com número e itens", () => {
    expect(avisoDoOrcamento(ORCAMENTO as any)).toBe("Orçamento #1 no carrinho — 2 itens");
    expect(avisoDoOrcamento({ number: 7, items: [ORCAMENTO.items[0]] } as any)).toBe("Orçamento #7 no carrinho — 1 item");
  });
});

describe("Caixa com ?quote=", () => {
  test("monta, desmonta no meio da busca e monta de novo: UMA busca, UM aviso", async () => {
    let resolver!: (v: any) => void;
    mockGetQuote.mockImplementation(() => new Promise((r) => { resolver = r; }));
    const aplicar = jest.fn();

    // 1ª montagem (a tela nova sob a key antiga do PageTransition).
    let primeira!: renderer.ReactTestRenderer;
    act(() => {
      primeira = renderer.create(<QueryClientProvider client={qc}><Caixa quote="q-1" aplicar={aplicar} /></QueryClientProvider>);
    });
    act(() => { primeira.unmount(); });

    // 2ª montagem, com a busca ainda no ar.
    let segunda!: renderer.ReactTestRenderer;
    act(() => {
      segunda = renderer.create(<QueryClientProvider client={qc}><Caixa quote="q-1" aplicar={aplicar} /></QueryClientProvider>);
    });

    await act(async () => { resolver({ quote: ORCAMENTO }); });
    await flush();

    expect(mockGetQuote).toHaveBeenCalledTimes(1);
    expect(mockGetQuote).toHaveBeenCalledWith("empresa-1", "q-1");
    expect(aplicar).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Orçamento #1 no carrinho — 2 itens");
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.setParams).toHaveBeenCalledWith({ quote: undefined });

    // Depois da limpeza, o expo-router devolve a STRING "undefined".
    act(() => {
      segunda.update(<QueryClientProvider client={qc}><Caixa quote="undefined" aplicar={aplicar} /></QueryClientProvider>);
    });
    await flush();
    expect(mockGetQuote).toHaveBeenCalledTimes(1);
    expect(mockGetQuote).not.toHaveBeenCalledWith("empresa-1", "undefined");
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();

    segunda.unmount();
  });

  test("orçamento já no cache (deixado por 'Virar pedido'): nenhuma busca, um aviso", async () => {
    qc.setQueryData(chaveDoOrcamento("empresa-1", "q-1"), { quote: ORCAMENTO });
    const aplicar = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<QueryClientProvider client={qc}><Caixa quote="q-1" aplicar={aplicar} /></QueryClientProvider>);
    });
    await flush();

    expect(mockGetQuote).not.toHaveBeenCalled();
    expect(aplicar).toHaveBeenCalledTimes(1);
    expect(aplicar.mock.calls[0][0].id).toBe("q-1");
    expect(toast.success).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("busca que falha: um aviso de erro, sem carrinho", async () => {
    mockGetQuote.mockRejectedValue(new Error("404"));
    const aplicar = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<QueryClientProvider client={qc}><Caixa quote="q-9" aplicar={aplicar} /></QueryClientProvider>);
    });
    await flush();

    expect(mockGetQuote).toHaveBeenCalledTimes(1);
    expect(aplicar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("sem ?quote: nada acontece", async () => {
    const aplicar = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<QueryClientProvider client={qc}><Caixa quote={undefined} aplicar={aplicar} /></QueryClientProvider>);
    });
    await flush();
    expect(mockGetQuote).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    tree.unmount();
  });
});
