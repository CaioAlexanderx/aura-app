// ============================================================
// NFC-e com o desconto da venda (13/11/2026)
//
// A nota do Caixa saía pelo bruto: o desconto da venda (cupom + manual)
// não chegava ao /nfce/emit. A fonte da verdade agora é o backend: com
// sale_id ele lê a venda gravada e rateia o desconto nos itens
// (aura-backend services/descontoDaVendaNaNfce.js). O app:
//   - continua mandando sale_id e os mesmos itens (nada recalculado aqui);
//   - manda `discount_amount` = o desconto que o servidor gravou, só quando
//     há desconto (conferência para o backend);
//   - venda sem desconto: corpo do /emit igual ao de antes, sem chave nova.
// ============================================================
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/QrCode", () => ({ QrCode: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api.test", request: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "loja-1", name: "Loja Centro" }, token: "t", isDemo: false, companyCount: 1 }),
}));
const mockEmitNfce = jest.fn();
jest.mock("@/services/nfceApi", () => ({ nfceApi: { emit: (...a: any[]) => mockEmitNfce(...a), get: jest.fn(), getConfig: jest.fn() } }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NfceActions } from "@/components/screens/pdv/NfceActions";

let tree: renderer.ReactTestRenderer;
async function render(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  mockEmitNfce.mockReset();
  mockEmitNfce.mockResolvedValue({ nfce: { id: "n1", numero: 1, status: "autorizada", pdf_url: "x" }, tipo: "nfce", pdf_url: "x" });
});
afterEach(() => { act(() => { tree && tree.unmount(); }); });

const ITENS = [
  { product_id: "p1__v1", product_name: "Camiseta", quantity: 1, unit_price: 100 },
  { product_id: "p2", product_name: "Meia", quantity: 2, unit_price: 25 },
];

describe("NfceActions — desconto da venda no /emit", () => {
  test("sem desconto: o corpo é o de sempre (sem discount_amount)", async () => {
    await render(<NfceActions companyId="loja-1" saleId="v1" items={ITENS} total={150} paymentMethod="pix" autoEmit />);
    expect(mockEmitNfce).toHaveBeenCalledTimes(1);
    const [cid, body] = mockEmitNfce.mock.calls[0];
    expect(cid).toBe("loja-1");
    expect(body).toEqual({
      items: [
        { product_id: "p1", product_name: "Camiseta", quantity: 1, unit_price: 100 },
        { product_id: "p2", product_name: "Meia", quantity: 2, unit_price: 25 },
      ],
      sale_id: "v1",
      customer_cpf: undefined,
      customer_name: undefined,
      tipo: "nfce",
      payment_method: "pix",
    });
    expect("discount_amount" in body).toBe(false);
  });

  test("desconto zerado também não manda a chave", async () => {
    await render(<NfceActions companyId="loja-1" saleId="v1" items={ITENS} total={150} paymentMethod="pix" saleDiscount={0} autoEmit />);
    expect("discount_amount" in mockEmitNfce.mock.calls[0][1]).toBe(false);
  });

  test("com desconto: sale_id + discount_amount gravado; itens e pagamentos como vieram", async () => {
    const payments = [{ method: "pix", value: 100 }, { method: "debito", value: 35 }];
    await render(<NfceActions companyId="loja-1" saleId="v1" items={ITENS} total={135} payments={payments} saleDiscount={15} autoEmit />);
    const body = mockEmitNfce.mock.calls[0][1];
    expect(body.sale_id).toBe("v1");
    expect(body.discount_amount).toBe(15);
    expect(body.payments).toEqual(payments);
    // O app não rateia nada: os itens seguem pelo preço da venda.
    expect(body.items.map((i: any) => [i.unit_price, i.discount])).toEqual([[100, undefined], [25, undefined]]);
  });
});
