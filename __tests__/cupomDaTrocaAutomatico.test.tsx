// p-164 (17/11/2026): cupom da troca sai sozinho com a mesma opção da venda.
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
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));

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
import { __zerarImpressoesParaTestes } from "@/services/impressaoNoQuadro";
import { chaveDoAparelho } from "@/utils/impressaoAutomatica";

const TROCA = "7a1c2e3f-4b5d-4e6f-8a9b-0c1d2e3f4a5b";
const RESULT = { origin_company_id: "loja-1", origin_company_ids: ["loja-1"], sale: { id: TROCA, payment_method: "pix" }, new_items: [], fiscal: { per_origin: [] } };
const mockFetch = jest.fn();

beforeEach(() => {
  __zerarImpressoesParaTestes();
  try { localStorage.clear(); } catch {}
  document.body.innerHTML = "";
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("<html>cupom da troca</html>"), json: () => Promise.resolve({}) });
  (global as any).fetch = mockFetch;
  (URL as any).createObjectURL = jest.fn(() => "blob:troca");
  (URL as any).revokeObjectURL = jest.fn();
  mockGetConfig.mockResolvedValue({ config: null });
});

async function montar(pdvSettings: any, result: any = RESULT) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(
      <QueryClientProvider client={qc}>
        <Step5Success companyId="loja-1" result={result} selectedSales={[]} returnedValue={100} newValue={0} netAmount={-100}
          paymentSplits={[]} onClose={() => {}} onNew={() => {}} pdvSettings={pdvSettings} />
      </QueryClientProvider>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return t;
}
const chamadasDoCupom = () => mockFetch.mock.calls.filter((c) => String(c[0]).includes("/print/receipt/"));
const quadros = () => document.querySelectorAll('[data-testid="quadro-do-cupom"]').length;

describe("cupom da troca automático (p-164)", () => {
  test("loja ligada: busca o cupom da troca uma vez e imprime pelo quadro", async () => {
    const t = await montar({ auto_print_receipt: true });
    expect(chamadasDoCupom()).toHaveLength(1);
    expect(String(chamadasDoCupom()[0][0])).toContain(`/print/receipt/${TROCA}/preview`);
    expect(quadros()).toBe(1);
    act(() => { t.unmount(); });
    await montar({ auto_print_receipt: true });
    expect(chamadasDoCupom()).toHaveLength(1); // a mesma troca não imprime de novo
  });
  test("loja desligada ou aparelho em Neste aparelho não: nada sai", async () => {
    await montar({ auto_print_receipt: false });
    await montar(undefined);
    localStorage.setItem(chaveDoAparelho("loja-1"), "nao");
    await montar({ auto_print_receipt: true });
    expect(chamadasDoCupom()).toHaveLength(0);
    expect(quadros()).toBe(0);
  });
});
