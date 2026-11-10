// ============================================================
// Caixa com produto que sai na NFS-e (10/11/2026, migration 442 do backend)
// O "Sai em: Nota de serviço" do cadastro vale no Caixa: o produto (com
// estoque) conta como item da nota de serviço — usePdvState + useCart de
// verdade, rede mockada (mesmos mocks de caixaNfseTomador.test.tsx).
//   - loja com a NFS-e automática: carimbo exige CPF ou CNPJ de quem contratou;
//     com o documento, vai no POST como nfse_tomador;
//   - carimbo + produto comum: aviso das duas notas;
//   - serviço com "Sai em: Cupom fiscal": não pede tomador;
//   - produto sem escolha: igual a hoje (sem tomador).
// ============================================================
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
const mockBodies: any[] = [];
let mockCfg: any = null;
// Erro da próxima venda (a venda não sai e o carrinho fica).
let mockFalha: any = null;
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => (o && o.queryKey && o.queryKey[0] === "nfse-automatica-config")
    ? { data: mockCfg, isLoading: false }
    : { data: undefined, isLoading: false },
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => {
      mockBodies.push(body);
      if (mockFalha) { const e = mockFalha; mockFalha = null; cb?.onError?.(e); return; }
      cb?.onSuccess?.({ sale: { id: "venda-1", sale_number: 7, customer_id: body.customer_id || "cli-novo" } });
    },
    mutateAsync: jest.fn(),
  }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), setParams: jest.fn() }),
  usePathname: () => "/pdv",
}));
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: [] }) }));
const mockClientes = [
  {
    id: "c-com", name: "Pessoa Com Endereço", phone: "11911112222", hasAddress: true,
    endereco: { zip: "01310100", street: "Av. Paulista", number: "1000", complement: "", neighborhood: "Bela Vista", city: "São Paulo", state: "SP", reference: "", ibge: "" },
  },
  {
    id: "c-sem", name: "Pessoa Sem Endereço", phone: "11933334444", hasAddress: false,
    endereco: { zip: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", reference: "", ibge: "" },
  },
];
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: mockClientes }) }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }),
  validateSaleAgainstSettings: () => ({ ok: true, missing: [] }),
}));
jest.mock("@/hooks/useCategories", () => ({ useCategories: () => ({ flattened: [] }) }));
jest.mock("@/hooks/useCaixa", () => ({ useCaixa: () => ({ sessaoAtiva: null, isAberto: true, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/hooks/useGlobalBarcodeScanner", () => ({ useGlobalBarcodeScanner: () => {} }));
jest.mock("@/hooks/useCompanyProfile", () => ({ useCompanyProfile: () => null }));
jest.mock("@/hooks/useMatconQuote", () => ({ useMatconQuote: () => ({}) }));
jest.mock("@/hooks/useMatconReferral", () => ({ useMatconReferral: () => ({ clear: () => {} }) }));
jest.mock("@/hooks/useOrcamentoNoCaixa", () => ({ useOrcamentoNoCaixa: () => {}, chaveDoOrcamento: () => null }));
jest.mock("@/hooks/useComandaNoCaixa", () => ({ useComandaNoCaixa: () => ({}) }));
jest.mock("@/components/screens/pdv/ComandasAbertasPanel", () => ({ useComandasAbertas: () => ({ comandas: [] }) }));
jest.mock("@/components/screens/pdv/flyToCart", () => ({ flyToCart: jest.fn() }));
jest.mock("@/services/nfceApi", () => ({ nfceApi: {} }));
jest.mock("@/services/creditApi", () => ({ creditApi: {} }));
jest.mock("@/services/warrantiesApi", () => ({ warrantiesApi: {} }));
jest.mock("@/services/api", () => ({
  companiesApi: { variants: jest.fn() },
  pdvApi: { scan: jest.fn(), createSale: jest.fn() },
  couponsApi: {},
  employeesApi: { list: jest.fn() },
}));
jest.mock("@/services/pdvApi", () => ({ pdvApi: { scan: jest.fn() } }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { usePdvState } from "@/hooks/usePdvState";
import { toast } from "@/components/Toast";

let st: ReturnType<typeof usePdvState>;
function Harness() { st = usePdvState(); return null; }

const PRODUTO = { id: "p1", name: "Shampoo hidratante 300 ml", price: 39.9, stock_qty: 10, unit: "un" };
const SERVICO = { id: "s1", name: "Corte feminino", price: 80, unit: "srv" };
const ATIVA = { ligada_no_servidor: true, tem_config: true, provider: "nacional", emissao_automatica: true, emissao_automatica_desde: null, ativa: true };

let tree: renderer.ReactTestRenderer;
function montar(cfg: any) {
  mockCfg = cfg;
  act(() => { tree = renderer.create(<Harness />); });
}
beforeEach(() => {
  mockBodies.length = 0;
  mockFalha = null;
  (toast.error as jest.Mock).mockClear();
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
});
afterEach(() => { act(() => { tree.unmount(); }); });

function carrinho(...itens: any[]) {
  act(() => { st.cartProps.onPay("pix"); });
  for (const i of itens) act(() => { st.handleAddProduct(i as any); });
}
const labels = () => st.requiredHints.map((h) => h.label);
const corpo = () => mockBodies[mockBodies.length - 1];

const CARIMBO = { id: "p-car", name: "Carimbo automático", price: 45, stock_qty: 7, unit: "un", notaFiscal: "nfse" };
const SERVICO_NFCE = { id: "s-imp", name: "Impressão", price: 25, unit: "srv", notaFiscal: "nfce" };

describe("produto com 'Sai em: Nota de serviço' no Caixa", () => {
  test("exige o documento de quem contratou; sem ele não fecha", () => {
    montar(ATIVA);
    carrinho(CARIMBO);
    expect(st.cartProps.tomador).toMatchObject({ exigido: true, temProduto: false });
    expect(labels()).toContain("Falta o CPF ou CNPJ do cliente");
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(0);
  });

  test("com CPF válido fecha e o tomador vai junto (nfse_tomador)", () => {
    montar(ATIVA);
    carrinho(CARIMBO);
    act(() => { st.cartProps.onCpfNaNotaChange!("52998224725"); });
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(1);
    expect(corpo().nfse_tomador).toEqual({ doc: "52998224725", nome: null });
    expect(corpo().items).toHaveLength(1);
  });

  test("carimbo + produto comum: aviso das duas notas", () => {
    montar(ATIVA);
    carrinho(CARIMBO, PRODUTO);
    expect(st.cartProps.tomador!.temProduto).toBe(true);
    expect(st.cartProps.avisoNotas).toMatch(/^Esta venda sai em duas notas/);
  });

  test("serviço com 'Sai em: Cupom fiscal' não pede tomador", () => {
    montar(ATIVA);
    carrinho(SERVICO_NFCE);
    expect(st.cartProps.tomador).toBeNull();
    expect(labels()).toEqual([]);
  });

  test("produto sem escolha segue como hoje (sem tomador)", () => {
    montar(ATIVA);
    carrinho(PRODUTO);
    expect(st.cartProps.tomador).toBeNull();
  });

  test("loja sem a emissão automática: o carimbo fecha sem documento", () => {
    montar({ ativa: false });
    carrinho(CARIMBO);
    expect(st.cartProps.tomador).toBeNull();
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(1);
    expect(corpo()).not.toHaveProperty("nfse_tomador");
  });
});
