// ============================================================
// Venda condicional (C13): bipar no Caixa peça que consta com cliente avisa.
// Mockup "Pedido separado de venda", parte 1: no toque e no bipe, quando o
// carrinho passaria do que está livre, "Não vender / Vender mesmo assim".
// Nunca trava. Sem a trava do Pedido (lojista), o toque e o bipe são os de
// sempre mesmo com reserved_qty na resposta. Mesmo harness de
// __tests__/bipeAchadoNoServidor.test.tsx (o usePdvState de verdade).
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
  const estado: any = { company: { id: "co-1", plan: "negocio" }, user: { id: "u-1", is_staff: false }, isDemo: false, companyLogo: null };
  (globalThis as any).__estadoAuth = estado;
  const useAuthStore = Object.assign(
    (sel?: (s: any) => any) => (typeof sel === "function" ? sel(estado) : estado),
    { getState: () => estado, setState: () => {}, subscribe: () => () => {} },
  );
  return { useAuthStore };
});
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: (...a: any[]) => mockPush(...a), replace: jest.fn(), setParams: jest.fn() }),
  usePathname: () => "/pdv",
}));
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: (globalThis as any).__produtos || [] }) }));
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [] }) }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }),
  validateSaleAgainstSettings: () => ({ ok: true, missing: [] }),
}));
jest.mock("@/hooks/useCategories", () => ({ useCategories: () => ({ flattened: [] }) }));
jest.mock("@/hooks/useCaixa", () => ({ useCaixa: () => ({ sessaoAtiva: null, isAberto: true, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/hooks/useGlobalBarcodeScanner", () => ({ useGlobalBarcodeScanner: () => {} }));
jest.mock("@/hooks/useCompanyProfile", () => ({ useCompanyProfile: () => null }));
jest.mock("@/hooks/useMatconQuote", () => ({ useMatconQuote: () => ({}) }));
jest.mock("@/hooks/useMatconReferral", () => ({ useMatconReferral: () => ({}) }));
jest.mock("@/hooks/useOrcamentoNoCaixa", () => ({ useOrcamentoNoCaixa: () => {}, chaveDoOrcamento: () => null }));
jest.mock("@/hooks/useComandaNoCaixa", () => ({ useComandaNoCaixa: () => ({}) }));
jest.mock("@/components/screens/pdv/ComandasAbertasPanel", () => ({ useComandasAbertas: () => ({ comandas: [] }) }));
jest.mock("@/components/screens/pdv/flyToCart", () => ({ flyToCart: jest.fn() }));
jest.mock("@/services/nfceApi", () => ({ nfceApi: {} }));
jest.mock("@/services/creditApi", () => ({ creditApi: {} }));
jest.mock("@/services/warrantiesApi", () => ({ warrantiesApi: {} }));

const mockScan = jest.fn((..._a: any[]) => Promise.resolve({} as any));
jest.mock("@/services/api", () => ({
  companiesApi: { variants: jest.fn(() => Promise.resolve({ variants: [] })) },
  pdvApi: { scan: (...a: any[]) => mockScan(...a), createSale: jest.fn() },
  couponsApi: {},
  employeesApi: { list: jest.fn() },
  request: jest.fn(),
}));

import { usePdvState } from "@/hooks/usePdvState";

const VESTIDO = { id: "11111111-1111-4111-8111-111111111111", name: "Vestido Midi Linho", price: 189.9, stock: 1, unit: "un", outQty: 1, outByVariant: {} };
const BLUSA = { id: "33333333-3333-4333-8333-333333333333", name: "Blusa Tricot", price: 139.9, stock: 4, unit: "un", outQty: 1, outByVariant: {} };
const SAIA = { id: "55555555-5555-4555-8555-555555555555", name: "Saia Plissada", price: 149.9, stock: 3, unit: "un", has_variants: true, outQty: 1, outByVariant: { vP: 1 } };
const CINTO_NO_BIPE = { id: "66666666-6666-4666-8666-666666666666", name: "Cinto Couro", price: 59.9, stock_qty: 1, out_qty: 1, variants: [] };

let host: HTMLDivElement;
let root: Root;
let st: ReturnType<typeof usePdvState>;
function Caixa() { st = usePdvState(); return null; }

function equipe(on: boolean) { (globalThis as any).__estadoAuth.user = { id: "u-1", is_staff: on }; }

async function montar() { await act(async () => { root.render(<Caixa />); }); }

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch {}
  (globalThis as any).__produtos = [VESTIDO, BLUSA, SAIA];
  mockScan.mockReset();
  equipe(true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => { root.unmount(); });
  host.remove();
  equipe(false);
});
async function esperar() { await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }); }
const carrinho = () => (st.displayItems as Array<{ productId: string; qty: number }>).map((i) => [i.productId, i.qty]);

describe("trava da condicional liberada (equipe Aura): peça com cliente avisa", () => {
  test("toque na última peça livre: aviso, nada no carrinho; Vender mesmo assim lança", async () => {
    await montar();
    expect(st.comClientesLiberado).toBe(true);
    await act(async () => { st.handleAddProduct(VESTIDO as any); });
    expect(st.avisoComClientes).toEqual(expect.objectContaining({ nome: "Vestido Midi Linho", estoque: 1, comClientes: 1 }));
    expect(st.avisoReserva).toBeNull();
    expect(carrinho()).toEqual([]);
    expect(st.scannerListening).toBe(false);
    await act(async () => { st.venderComClientes(); });
    expect(st.avisoComClientes).toBeNull();
    expect(carrinho()).toEqual([[VESTIDO.id, 1]]);
  });

  test("Não vender só fecha o aviso", async () => {
    await montar();
    await act(async () => { st.handleAddProduct(VESTIDO as any); });
    await act(async () => { st.naoVenderComClientes(); });
    expect(st.avisoComClientes).toBeNull();
    expect(carrinho()).toEqual([]);
  });

  test("ainda há peça livre: entra direto; a que passa do livre avisa", async () => {
    await montar();
    for (let i = 0; i < 3; i++) await act(async () => { st.handleAddProduct(BLUSA as any); });
    expect(st.avisoComClientes).toBeNull();
    expect(carrinho()).toEqual([[BLUSA.id, 3]]);
    await act(async () => { st.handleAddProduct(BLUSA as any); });
    expect(st.avisoComClientes).toEqual(expect.objectContaining({ estoque: 4, comClientes: 1 }));
  });

  test("tamanho com cliente no seletor avisa; tamanho sem, entra direto", async () => {
    await montar();
    await act(async () => { st.handleAddProduct(SAIA as any); });
    await act(async () => { st.handleVariantSelected({ id: "vM", label: "M", price: 149.9, stock: 2 }); });
    expect(st.avisoComClientes).toBeNull();
    expect(carrinho()).toEqual([[SAIA.id + "__vM", 1]]);
    await act(async () => { st.handleAddProduct(SAIA as any); });
    await act(async () => { st.handleVariantSelected({ id: "vP", label: "P", price: 149.9, stock: 1 }); });
    expect(st.avisoComClientes).toEqual(expect.objectContaining({ comClientes: 1, estoque: 1 }));
  });

  test("bipe achado no servidor com out_qty: avisa antes", async () => {
    (globalThis as any).__produtos = [];
    await montar();
    mockScan.mockImplementation(() => Promise.resolve({ match: "exact", source: "barcode", product: CINTO_NO_BIPE }));
    await act(async () => { await st.handleScan("7891234567890"); });
    await esperar();
    expect(st.avisoComClientes).toEqual(expect.objectContaining({ nome: "Cinto Couro", estoque: 1, comClientes: 1 }));
    expect(carrinho()).toEqual([]);
    await act(async () => { st.venderComClientes(); });
    expect(carrinho()).toEqual([[CINTO_NO_BIPE.id, 1]]);
  });
});

describe("trava desligada (lojista): toque e bipe de sempre", () => {
  test("mesmo com outQty no produto, entra direto e sem aviso", async () => {
    equipe(false);
    await montar();
    expect(st.comClientesLiberado).toBe(false);
    await act(async () => { st.handleAddProduct(VESTIDO as any); });
    expect(st.avisoComClientes).toBeNull();
    expect(carrinho()).toEqual([[VESTIDO.id, 1]]);
  });

  test("bipe com out_qty na resposta: entra direto", async () => {
    equipe(false);
    (globalThis as any).__produtos = [];
    await montar();
    mockScan.mockImplementation(() => Promise.resolve({ match: "exact", source: "barcode", product: CINTO_NO_BIPE }));
    await act(async () => { await st.handleScan("7891234567890"); });
    await esperar();
    expect(st.avisoComClientes).toBeNull();
    expect(carrinho()).toEqual([[CINTO_NO_BIPE.id, 1]]);
  });
});

describe("AvisoDeCondicional (componente)", () => {
  test("texto do mockup; 'Ver a condicional' leva à aba Condicionais e não vende", async () => {
    const { AvisoDeCondicional } = require("@/components/screens/pdv/AvisoDeCondicional");
    const naoVender = jest.fn();
    const vender = jest.fn();
    await act(async () => { root.render(<AvisoDeCondicional aviso={{ nome: "Saia", estoque: 1, comClientes: 1 }} onNaoVender={naoVender} onVender={vender} />); });
    const corpo = document.body.textContent || "";
    expect(corpo).toContain("Esta peça consta com uma cliente");
    expect(corpo).toContain("registre a devolução para o estoque ficar certo");
    const ver = document.querySelector('[data-testid="aviso-com-clientes-ver"]') as HTMLElement;
    expect(ver).toBeTruthy();
    await act(async () => { ver.click(); });
    expect(mockPush).toHaveBeenCalledWith("/vendas?tab=condicionais");
    expect(naoVender).toHaveBeenCalled();
    expect(vender).not.toHaveBeenCalled();
  });
});
