// ============================================================
// 17/11/2026 (p-147 / R3b): bipe com a tela de venda concluída na frente
// começa a venda nova já com o item, pelo mesmo caminho do bipe no Caixa
// (usePdvState.handleScan). O que este arquivo trava:
//   1. o leitor fica ligado na tela final
//   2. bipe de produto: a venda nova começa (cliente da venda anterior sai)
//      com o item; o que esperava a próxima venda (p-146) vem junto
//   3. código que não existe: avisa e a tela final fica
//   4. Enter (Nova venda) e o bipe no mesmo tique não começam duas vendas
//      (a segunda apagaria o que esperava a próxima venda)
//   5. janela aberta por cima da tela final: o bipe é ignorado
// ============================================================
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/stores/auth", () => {
  const estado = { company: { id: "co-1", plan: "negocio" }, user: { id: "u-1" }, isDemo: false, companyLogo: null };
  const useAuthStore = Object.assign(
    (sel?: (s: any) => any) => (typeof sel === "function" ? sel(estado) : estado),
    { getState: () => estado, setState: () => {}, subscribe: () => () => {} },
  );
  return { useAuthStore };
});
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn(), getQueryData: jest.fn() }),
  // A venda volta na hora com o número 1048.
  useMutation: (cfg: any) => ({
    mutate: (body: any, cbs: any) => {
      Promise.resolve()
        .then(() => cfg.mutationFn(body))
        .then((r: any) => { cfg.onSuccess?.(r); cbs?.onSuccess?.(r); }, (e: any) => { cbs?.onError?.(e); });
    },
    mutateAsync: jest.fn(),
  }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), setParams: jest.fn() }),
  usePathname: () => "/pdv",
}));
const mockBlusa = { id: "blusa", name: "Blusa Alcinha", price: 40, stock_qty: 10, barcode: "7890000000011", is_active: true };
const mockCinto = { id: "cinto", name: "Cinto Couro Fino", price: 49.9, stock_qty: 10, barcode: "7890000000028", is_active: true };
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: [mockBlusa, mockCinto] }) }));
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [] }) }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }),
  validateSaleAgainstSettings: () => ({ ok: true, missing: [] }),
}));
jest.mock("@/hooks/useCategories", () => ({ useCategories: () => ({ flattened: [] }) }));
jest.mock("@/hooks/useCaixa", () => ({ useCaixa: () => ({ sessaoAtiva: null, isAberto: true, isLoading: false, invalidate: jest.fn() }) }));
// O leitor global: guarda o que o Caixa passou, para "bipar" daqui.
const mockLeitor: { onScan: ((c: string) => void) | null; enabled: boolean | undefined } = { onScan: null, enabled: undefined };
jest.mock("@/hooks/useGlobalBarcodeScanner", () => ({
  useGlobalBarcodeScanner: (o: any) => { mockLeitor.onScan = o.onScan; mockLeitor.enabled = o.enabled; },
}));
jest.mock("@/hooks/useCompanyProfile", () => ({ useCompanyProfile: () => null }));
jest.mock("@/hooks/useMatconQuote", () => ({ useMatconQuote: () => ({}) }));
jest.mock("@/hooks/useMatconReferral", () => ({ useMatconReferral: () => ({ clear: jest.fn() }) }));
jest.mock("@/hooks/useOrcamentoNoCaixa", () => ({ useOrcamentoNoCaixa: () => {}, chaveDoOrcamento: () => null }));
jest.mock("@/hooks/useComandaNoCaixa", () => ({ useComandaNoCaixa: () => ({}) }));
jest.mock("@/components/screens/pdv/ComandasAbertasPanel", () => ({ useComandasAbertas: () => ({ comandas: [] }) }));
jest.mock("@/components/screens/pdv/flyToCart", () => ({ flyToCart: jest.fn() }));
jest.mock("@/services/nfceApi", () => ({ nfceApi: {} }));
jest.mock("@/services/creditApi", () => ({ creditApi: {} }));
jest.mock("@/services/warrantiesApi", () => ({ warrantiesApi: {} }));
const mockScan = jest.fn((..._a: any[]) => Promise.resolve({ match: "none" } as any));
const mockCreateSale = jest.fn((..._a: any[]) => Promise.resolve({ sale: { id: "venda-1048", sale_number: 1048 } }));
jest.mock("@/services/api", () => ({
  companiesApi: { variants: jest.fn(() => Promise.resolve({ variants: [] })) },
  pdvApi: { scan: (...a: any[]) => mockScan(...a), createSale: (...a: any[]) => mockCreateSale(...a) },
  couponsApi: {},
  employeesApi: { list: jest.fn() },
}));
jest.mock("@/services/pdvApi", () => ({ pdvApi: { scan: (...a: any[]) => mockScan(...a) } }));

import { usePdvState } from "@/hooks/usePdvState";
import { __zerarParaTestes } from "@/utils/vendaGuardada";
import { toast as mockToast } from "@/components/Toast";

const BLUSA = mockBlusa;
const CINTO = mockCinto;

let host: HTMLDivElement;
let root: Root;
let st: ReturnType<typeof usePdvState>;
function Caixa() { st = usePdvState(); return null; }

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch {}
  __zerarParaTestes();
  jest.clearAllMocks();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => { root.unmount(); });
  host.remove();
  document.body.innerHTML = "";
});

async function esperar() {
  await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });
}
const carrinho = () => (st.displayItems as Array<{ productId: string; qty: number }>).map(i => i.productId + "×" + i.qty);

/** Abre o Caixa, lança a blusa para a cliente Marina e registra a venda. */
async function vendaRegistrada() {
  await act(async () => { root.render(<Caixa />); });
  await esperar();
  await act(async () => { st.handleAddProduct(BLUSA as any); st.selectCustomer("cli-1", "Marina", null); });
  await act(async () => { st.cartProps.onFinalize(); });
  await esperar();
  expect(st.lastSale?.id).toBe("venda-1048");
}

describe("bipe na tela de venda concluída", () => {
  it("o leitor fica ligado na tela final", async () => {
    await vendaRegistrada();
    expect(st.scannerListening).toBe(true);
    expect(mockLeitor.enabled).toBe(true);
  });

  it("bipe de produto: a venda nova começa já com o item, sem o cliente da venda anterior", async () => {
    await vendaRegistrada();
    await act(async () => { mockLeitor.onScan!(CINTO.barcode); });
    await esperar();
    expect(st.lastSale).toBeNull();
    expect(carrinho()).toEqual(["cinto×1"]);
    expect(st.selectedCustomerId).toBeNull();
  });

  it("o que esperava a próxima venda (bipado durante o Finalizando) vem junto", async () => {
    await act(async () => { root.render(<Caixa />); });
    await esperar();
    await act(async () => { st.handleAddProduct(BLUSA as any); });
    let soltar!: (v: any) => void;
    mockCreateSale.mockImplementationOnce(() => new Promise((r) => { soltar = r; }));
    await act(async () => { st.cartProps.onFinalize(); });
    await esperar();
    expect(st.isProcessing).toBe(true);
    await act(async () => { mockLeitor.onScan!(BLUSA.barcode); });
    await esperar();
    expect(st.cartProps.proximaVenda.map((i: any) => i.productId)).toEqual(["blusa"]);
    await act(async () => { soltar({ sale: { id: "venda-1049", sale_number: 1049 } }); });
    await esperar();
    expect(st.lastSale?.id).toBe("venda-1049");
    expect(st.itensDaProximaVenda).toHaveLength(1);
    await act(async () => { mockLeitor.onScan!(CINTO.barcode); });
    await esperar();
    expect(st.lastSale).toBeNull();
    expect(carrinho()).toEqual(["blusa×1", "cinto×1"]);
  });

  it("código que não existe: avisa e a tela final fica", async () => {
    await vendaRegistrada();
    await act(async () => { mockLeitor.onScan!("0000000000000"); });
    await esperar();
    expect(st.lastSale?.id).toBe("venda-1048");
    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining("Não achei produto com o código 0000000000000"));
  });

  it("Enter (Nova venda) e o bipe no mesmo tique: uma venda nova só, com o que esperava e o item", async () => {
    await act(async () => { root.render(<Caixa />); });
    await esperar();
    await act(async () => { st.handleAddProduct(BLUSA as any); });
    let soltar!: (v: any) => void;
    mockCreateSale.mockImplementationOnce(() => new Promise((r) => { soltar = r; }));
    await act(async () => { st.cartProps.onFinalize(); });
    await esperar();
    await act(async () => { mockLeitor.onScan!(BLUSA.barcode); });
    await act(async () => { soltar({ sale: { id: "venda-1050" } }); });
    await esperar();
    expect(st.lastSale?.id).toBe("venda-1050");
    // O listener dos atalhos e o do leitor ouvem o mesmo Enter: os dois
    // começam a venda nova, no mesmo tique.
    const onScan = mockLeitor.onScan!;
    await act(async () => { st.newSale(); onScan(CINTO.barcode); });
    await esperar();
    expect(st.lastSale).toBeNull();
    expect(carrinho()).toEqual(["blusa×1", "cinto×1"]);
  });

  it("janela aberta por cima da tela final: o bipe é ignorado", async () => {
    await vendaRegistrada();
    const dialogo = document.createElement("div");
    dialogo.setAttribute("role", "dialog");
    dialogo.setAttribute("aria-modal", "true");
    document.body.appendChild(dialogo);
    await act(async () => { mockLeitor.onScan!(CINTO.barcode); });
    await esperar();
    expect(st.lastSale?.id).toBe("venda-1048");
    dialogo.remove();
  });
});
