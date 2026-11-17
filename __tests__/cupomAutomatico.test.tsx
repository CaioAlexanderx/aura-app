// p-160 (17/11/2026): impressão automática do cupom na tela de venda concluída.
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/QrCode", () => ({ QrCode: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api.test", request: jest.fn() }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "loja-1", name: "Loja Centro" }, token: "t", isDemo: false, companyCount: 1 }),
}));
const mockSituacao = jest.fn();
const mockEmitir = jest.fn();
const mockTentar = jest.fn();
const mockCompletar = jest.fn();
const mockConfig = jest.fn();
jest.mock("@/services/nfseAutomaticaApi", () => ({
  nfseAutomaticaApi: {
    situacao: (...a: any[]) => mockSituacao(...a),
    emitir: (...a: any[]) => mockEmitir(...a),
    tentarDeNovo: (...a: any[]) => mockTentar(...a),
    completar: (...a: any[]) => mockCompletar(...a),
    config: (...a: any[]) => mockConfig(...a),
    pdfPath: () => "/x.pdf",
  },
}));
const mockEmitNfce = jest.fn();
jest.mock("@/services/nfceApi", () => ({ nfceApi: { emit: (...a: any[]) => mockEmitNfce(...a), get: jest.fn(), getConfig: jest.fn() } }));
let mockCfgAtiva = true;
jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (o: any) => (o && o.queryKey && o.queryKey[0] === "nfse-automatica-config")
      ? { data: { ativa: mockCfgAtiva }, isLoading: false }
      : { data: undefined, isLoading: false },
  };
});
jest.mock("@/components/screens/pdv/OsActions", () => ({ OsActions: () => null }));
jest.mock("@/components/screens/pdv/WarrantySaleActions", () => ({ WarrantySaleActions: () => null }));
jest.mock("@/utils/entregarTomador", () => ({ entregarTomadorDaVenda: jest.fn(() => Promise.resolve(null)) }));


import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { imprimirNoQuadro, __zerarImpressoesParaTestes, ehVendaDoServidor } from "@/services/impressaoNoQuadro";
import { chaveDoAparelho } from "@/utils/impressaoAutomatica";

const VENDA = "3f2b9c1e-0a4d-4c7e-9b1a-2d5e8f7a6b01";
const sale: any = {
  id: VENDA, saleNumber: 77, total: 49.9, payment: "pix", date: "", subtotal: 49.9, discount: 0,
  items: [{ productId: "p1", name: "Blusa", price: 49.9, qty: 1, unit: "un" }],
};

const mockFetch = jest.fn();
let trees: renderer.ReactTestRenderer[] = [];
beforeEach(() => {
  __zerarImpressoesParaTestes();
  try { localStorage.clear(); } catch {}
  document.body.innerHTML = "";
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("<html><body>cupom</body></html>") });
  (global as any).fetch = mockFetch;
  (URL as any).createObjectURL = jest.fn(() => "blob:cupom");
  (URL as any).revokeObjectURL = jest.fn();
});
afterEach(() => { trees.forEach((t) => { try { t.unmount(); } catch {} }); trees = []; });

async function abrir(props: any) {
  let t!: renderer.ReactTestRenderer;
  const qc = new QueryClient();
  await act(async () => { t = renderer.create(<QueryClientProvider client={qc}><SaleComplete sale={sale} onNewSale={() => {}} {...props} /></QueryClientProvider>); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  trees.push(t);
  return t;
}
const quadros = () => document.querySelectorAll('[data-testid="quadro-do-cupom"]').length;

describe("cupom automático (p-160)", () => {
  test("loja ligada + computador: busca o cupom uma vez e imprime pelo quadro oculto", async () => {
    const t = await abrir({ pdvSettings: { auto_print_receipt: true } });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(`http://api.test/companies/loja-1/print/receipt/${VENDA}/preview`);
    expect(quadros()).toBe(1);
    // redesenhar a tela da mesma venda não imprime de novo
    await act(async () => { t.update(<QueryClientProvider client={new QueryClient()}><SaleComplete sale={{ ...sale }} onNewSale={() => {}} pdvSettings={{ auto_print_receipt: true }} /></QueryClientProvider>); });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("loja desligada: nada sai sozinho", async () => {
    await abrir({ pdvSettings: { auto_print_receipt: false } });
    await abrir({ pdvSettings: {} });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(quadros()).toBe(0);
  });

  test("aparelho em Neste aparelho não: nada sai", async () => {
    localStorage.setItem(chaveDoAparelho("loja-1"), "nao");
    await abrir({ pdvSettings: { auto_print_receipt: true } });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("venda do modo demonstração (sem UUID): nada sai", async () => {
    await abrir({ sale: { ...sale, id: "ABC123" }, pdvSettings: { auto_print_receipt: true } });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("servidor recusa o cupom: avisa e não cria quadro", async () => {
    const { toast } = require("@/components/Toast");
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("") });
    await abrir({ pdvSettings: { auto_print_receipt: true } });
    expect(quadros()).toBe(0);
    expect(toast.error).toHaveBeenCalled();
  });
});

describe("imprimirNoQuadro", () => {
  test("cria o quadro invisível com a blob URL", () => {
    expect(imprimirNoQuadro("<p>x</p>")).toBe("ok");
    const q = document.querySelector('[data-testid="quadro-do-cupom"]') as HTMLIFrameElement;
    expect(q).toBeTruthy();
    expect(q.getAttribute("aria-hidden")).toBe("true");
    expect(q.src).toContain("blob:cupom");
  });
  test("sem documento: sem_janela", () => {
    expect(imprimirNoQuadro("<p>x</p>", null)).toBe("sem_janela");
  });
  test("ehVendaDoServidor", () => {
    expect(ehVendaDoServidor(VENDA)).toBe(true);
    expect(ehVendaDoServidor("ABC123")).toBe(false);
    expect(ehVendaDoServidor(null)).toBe(false);
  });
});
