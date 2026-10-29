// ============================================================
// tq-39 (29/10/2026) — NFC-e da troca com valor a pagar.
//
// Antes: itens somavam o valor cheio dos itens novos e os pagamentos só o
// líquido (novo − devolvido); o backend recusava com 400. Agora:
//   1. itens com o desconto real no `discount` (lápis + desconto da troca
//      rateado), pagamentos = o que o cliente pagou + "credito_troca"
//      fechando o valor da nota — soma igual por construção;
//   2. cartão do wizard (cartao_credito/cartao_debito) vai como cartao/debito;
//   3. o Step5Success manda isso no /emit (emissão automática ligada);
//   4. sem origin_company_id nem origin_company_ids, a nota sai pela loja
//      (o fallback antigo devolvia false).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/QrCode", () => ({ QrCode: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api.test" }));

const mockGetConfig = jest.fn();
const mockEmit = jest.fn();
jest.mock("@/services/nfceApi", () => ({
  nfceApi: {
    getConfig: (...a: any[]) => mockGetConfig(...a),
    emit: (...a: any[]) => mockEmit(...a),
    get: jest.fn(),
  },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "loja-1", name: "Loja" }, token: "t", isDemo: false }),
}));

import { Step5Success } from "@/components/screens/pdv/troca/Step5Success";
import {
  itensDaNotaDaTroca, pagamentosDaNotaDaTroca, totalDaNota, metodoDaNota, METODO_CREDITO_TROCA,
} from "@/components/screens/pdv/troca/notaDaTroca";

const somaPag = (p: Array<{ value: number }>) => Math.round(p.reduce((s, x) => s + x.value, 0) * 100) / 100;

describe("notaDaTroca — regras puras", () => {
  it("sem desconto: itens cheios e o crédito da devolução fecha a soma", () => {
    const itens = itensDaNotaDaTroca([{ product_id: "p1", product_name: "Vestido", quantity: 1, unit_price: 200 }], 0);
    expect(itens).toEqual([{ product_id: "p1", product_name: "Vestido", quantity: 1, unit_price: 200 }]);
    const pag = pagamentosDaNotaDaTroca(itens, [{ method: "pix", value: 50 }]);
    expect(pag).toEqual([{ method: "pix", value: 50 }, { method: METODO_CREDITO_TROCA, value: 150 }]);
    expect(somaPag(pag)).toBe(totalDaNota(itens));
  });

  it("desconto do item + desconto da troca rateado pelo valor das linhas, centavos no fim", () => {
    const itens = itensDaNotaDaTroca([
      { product_id: "a", product_name: "A", quantity: 1, unit_price: 100, discount: 0 },
      { product_id: "b", product_name: "B", quantity: 2, unit_price: 100, discount: 20 },
    ], 10);
    // líquidos 100 e 180 (total 280); 10 rateado: 3,57 + 6,43
    expect(itens[0].discount).toBe(3.57);
    expect(itens[1].discount).toBe(26.43);
    expect(totalDaNota(itens)).toBe(270);
    const pag = pagamentosDaNotaDaTroca(itens, [{ method: "cartao_credito", value: 70 }]);
    expect(pag).toEqual([{ method: "cartao", value: 70 }, { method: "credito_troca", value: 200 }]);
    expect(somaPag(pag)).toBe(270);
  });

  it("linha sem produto fica de fora e desconto nunca passa da linha", () => {
    const itens = itensDaNotaDaTroca([
      { product_id: null, product_name: "avulso", quantity: 1, unit_price: 5 },
      { product_id: "x", product_name: "X", quantity: 1, unit_price: 10 },
    ], 50);
    expect(itens).toHaveLength(1);
    expect(itens[0].discount).toBe(10);
    expect(totalDaNota(itens)).toBe(0);
  });

  it("nomes do wizard viram os do /nfce/emit", () => {
    expect(metodoDaNota("cartao_credito")).toBe("cartao");
    expect(metodoDaNota("cartao_debito")).toBe("debito");
    expect(metodoDaNota("pix")).toBe("pix");
  });
});

const EMIT_OK = { nfce: { id: "e1", status: "autorizada", numero: 7, pdf_url: "x" }, pdf_url: "x" };

async function montar(result: any, props: any = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Step5Success
          companyId="loja-1"
          result={result}
          selectedSales={[]}
          returnedValue={150}
          newValue={200}
          netAmount={50}
          paymentSplits={[{ method: "pix", amount: 50 } as any]}
          onClose={() => {}}
          onNew={() => {}}
          {...props}
        />
      </QueryClientProvider>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => {
  mockGetConfig.mockReset();
  mockEmit.mockReset();
  mockEmit.mockResolvedValue(EMIT_OK);
  mockGetConfig.mockResolvedValue({ config: { auto_emit_nfce: true, is_active: true } });
});

describe("Step5Success — /emit da troca com valor a pagar", () => {
  it("pagamentos = pix pago + crédito da devolução; soma igual aos itens", async () => {
    await montar({
      origin_company_id: "loja-1",
      sale: { id: "troca-1", payment_method: "pix" },
      new_items: [{ product_id: "p1", product_name: "Vestido", quantity: 1, unit_price: 200, discount: 0 }],
      fiscal: { per_origin: [] },
    });
    expect(mockEmit).toHaveBeenCalledTimes(1);
    const body = mockEmit.mock.calls[0][1];
    expect(body.items).toEqual([{ product_id: "p1", product_name: "Vestido", quantity: 1, unit_price: 200 }]);
    expect(body.payments).toEqual([{ method: "pix", value: 50 }, { method: "credito_troca", value: 150 }]);
    expect(body.payment_method).toBeUndefined();
  });

  it("com desconto na troca: discount no item e pagamentos batendo com o líquido", async () => {
    // Tênis 339,99 com 20 no lápis + 10 da troca = 309,99; devolveu 189,90; pagou 120,09.
    await montar({
      origin_company_id: "loja-1",
      sale: { id: "troca-2", payment_method: "pix", discount_amount: "10.00" },
      discount_amount: 10,
      new_items: [{ product_id: "p9", product_name: "Tênis", quantity: 1, unit_price: "339.99", discount: "20.00" }],
      fiscal: { per_origin: [] },
    }, { returnedValue: 189.9, newValue: 309.99, netAmount: 120.09, paymentSplits: [{ method: "cartao_debito", amount: 120.09 }] });
    const body = mockEmit.mock.calls[0][1];
    expect(body.items).toEqual([{ product_id: "p9", product_name: "Tênis", quantity: 1, unit_price: 339.99, discount: 30 }]);
    expect(body.payments).toEqual([{ method: "debito", value: 120.09 }, { method: "credito_troca", value: 189.9 }]);
  });

  it("sem origin_company_id nem origin_company_ids: emite pela loja (fallback corrigido)", async () => {
    await montar({
      sale: { id: "troca-3", payment_method: "pix" },
      new_items: [{ product_id: "p1", product_name: "Vestido", quantity: 1, unit_price: 200 }],
      fiscal: { per_origin: [] },
    });
    expect(mockGetConfig).toHaveBeenCalledWith("loja-1");
    expect(mockEmit.mock.calls[0][0]).toBe("loja-1");
  });
});
