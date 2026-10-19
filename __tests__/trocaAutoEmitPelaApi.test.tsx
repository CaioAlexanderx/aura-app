// ============================================================
// Troca · NFC-e automática lida pela API (tq-25, 19/10/2026)
//
// Step5Success lia company.nfce_config.auto_emit_nfce, campo que nem o login
// nem o /auth/me devolvem (nfce_config é tabela) -> sempre false, a Troca
// nunca emitia sozinha. Agora lê pela mesma fonte do Caixa
// (hooks/usePdvState): GET /nfce/config, regra auto_emit_nfce && is_active.
//
// Renderiza o Step5Success de verdade, com o NfceActions real, e mocka só
// a API. Cobre: ligado -> dispara /emit uma vez; desligado, config inativa,
// sem config, falha do GET e sem NFC-e na tela -> não dispara; e que a
// consulta usa o id da empresa fiscal (origem), como o Caixa usa o da loja.
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

// Formato real da resposta do trocaV2 (origin_company_id sempre presente).
const RESULT = {
  origin_company_id: "loja-1",
  origin_company_ids: ["loja-1"],
  sale: { id: "troca-sale-1", customer_name: "Maria", payment_method: "pix" },
  new_items: [{ product_id: "p1", product_name: "Vestido", quantity: 1, unit_price: 200 }],
  fiscal: { per_origin: [] },
};

const EMIT_OK = { nfce: { id: "e1", status: "autorizada", numero: 7, pdf_url: "x" }, pdf_url: "x" };

async function limpar() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function montar(opts: { result?: any; netAmount?: number } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(
      <QueryClientProvider client={qc}>
        <Step5Success
          companyId="loja-1"
          result={opts.result ?? RESULT}
          selectedSales={[]}
          returnedValue={150}
          newValue={200}
          netAmount={opts.netAmount ?? 50}
          paymentSplits={[{ method: "pix", amount: 50 } as any]}
          onClose={() => {}}
          onNew={() => {}}
        />
      </QueryClientProvider>,
    );
  });
  await limpar();
  return t;
}

beforeEach(() => {
  mockGetConfig.mockReset();
  mockEmit.mockReset();
  mockEmit.mockResolvedValue(EMIT_OK);
});

describe("Troca · emissão automática de NFC-e pela API", () => {
  it("flag ligado pela API (ativo): dispara a emissão uma vez, com a venda da troca", async () => {
    mockGetConfig.mockResolvedValue({ config: { auto_emit_nfce: true, is_active: true } });
    await montar();
    expect(mockGetConfig).toHaveBeenCalledWith("loja-1");
    expect(mockEmit).toHaveBeenCalledTimes(1);
    const [cid, body] = mockEmit.mock.calls[0];
    expect(cid).toBe("loja-1");
    expect(body.sale_id).toBe("troca-sale-1");
    expect(body.tipo).toBe("nfce");
    expect(body.items).toEqual([{ product_id: "p1", product_name: "Vestido", quantity: 1, unit_price: 200 }]);
  });

  it("flag desligado: não emite sozinho", async () => {
    mockGetConfig.mockResolvedValue({ config: { auto_emit_nfce: false, is_active: true } });
    await montar();
    expect(mockGetConfig).toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("flag ligado mas config inativa (is_active=false): não emite, igual ao Caixa", async () => {
    mockGetConfig.mockResolvedValue({ config: { auto_emit_nfce: true, is_active: false } });
    await montar();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("sem config (config=null): segue como hoje, sem emitir", async () => {
    mockGetConfig.mockResolvedValue({ config: null });
    await montar();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("falha ao ler a config: segue sem emitir sozinho", async () => {
    mockGetConfig.mockRejectedValue(new Error("500"));
    await montar();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("não lê a config quando a NFC-e nem aparece (troca par-a-par, net = 0)", async () => {
    mockGetConfig.mockResolvedValue({ config: { auto_emit_nfce: true, is_active: true } });
    await montar({ netAmount: 0 });
    expect(mockGetConfig).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("cross-filial: lê a config e emite pela empresa fiscal (origem), não pela loja ativa", async () => {
    mockGetConfig.mockResolvedValue({ config: { auto_emit_nfce: true, is_active: true } });
    await montar({ result: { ...RESULT, cross_filial: true, origin_company_id: "filial-9" } });
    expect(mockGetConfig).toHaveBeenCalledWith("filial-9");
    expect(mockEmit.mock.calls[0][0]).toBe("filial-9");
  });
});
