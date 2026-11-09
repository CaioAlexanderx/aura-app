// ============================================================
// Caixa: a trava da venda com frete (09/11/2026, parte 2) — usePdvState +
// useCart de verdade, rede mockada.
//   - frete sem cliente: "Finalizar venda" abre "Quem recebe" e NÃO manda
//     a venda; "Voltar" devolve ao carrinho sem perder nada; confirmar
//     retoma e manda o cliente inline + delivery_address + delivery_check;
//   - frete com cliente sem endereço: abre "Para onde vai" e, confirmado,
//     a venda leva o endereço do cliente;
//   - frete com cliente com endereço: sem trava, só o delivery_check;
//   - sem frete: corpo de sempre (sem nenhum campo de entrega).
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
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => {
      mockBodies.push(body);
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
  usePdvSettings: () => ({ settings: { frete_enabled: true }, isLoading: false, invalidate: jest.fn() }),
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
import type { EntregaDaVenda } from "@/utils/entregaDaVenda";

let st: ReturnType<typeof usePdvState>;
function Harness() { st = usePdvState(); return null; }

const PRODUTO = { id: "p1", name: "Vestido", price: 100, stock_qty: 10 };
const ENDERECO = { zip: "04538132", street: "Rua Jerônimo da Veiga", number: "45", complement: "", neighborhood: "Itaim Bibi", city: "São Paulo", state: "SP", reference: "", ibge: "" };

let tree: renderer.ReactTestRenderer;
beforeEach(() => {
  mockBodies.length = 0;
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  act(() => { tree = renderer.create(<Harness />); });
});
afterEach(() => { act(() => { tree.unmount(); }); });

function carrinho(frete: string | null) {
  act(() => { st.cartProps.onPay("pix"); });
  act(() => { st.handleAddProduct(PRODUTO as any); });
  if (frete) act(() => { st.cartProps.frete!.onChange(frete); });
}
const corpo = () => mockBodies[mockBodies.length - 1];

describe("venda com frete, sem cliente", () => {
  test("Finalizar abre 'Quem recebe' antes do pagamento; Voltar não perde nada", () => {
    carrinho("15");
    act(() => { st.handleFinalize(); });
    expect(st.pedidoDeEntrega).toBe("quem");
    expect(mockBodies).toHaveLength(0);

    const rascunho: EntregaDaVenda = { customerId: null, nome: "Pessoa Nova", telefone: "", endereco: { ...ENDERECO, number: "" }, recado: "", novoCliente: true };
    act(() => { st.voltarDaEntrega(rascunho); });
    expect(st.pedidoDeEntrega).toBeNull();
    expect(st.cartProps.items).toHaveLength(1);
    expect(st.cartProps.frete!.amount).toBe(15);
    expect(st.rascunhoDaEntrega).toEqual(rascunho);
    expect(st.lastSale).toBeNull();
    expect(mockBodies).toHaveLength(0);
  });

  test("confirmar retoma o Finalizar e manda cliente inline + endereço", () => {
    carrinho("15");
    act(() => { st.handleFinalize(); });
    act(() => {
      st.confirmarEntrega({ customerId: null, nome: "Pessoa Nova", telefone: "(21) 95555-4321", endereco: ENDERECO, recado: "interfone 32", novoCliente: true });
    });
    expect(mockBodies).toHaveLength(1);
    const b = corpo();
    expect(b.delivery_check).toBe(true);
    expect(b.customer_id).toBeUndefined();
    expect(b.customer).toMatchObject({ name: "Pessoa Nova", phone: "21955554321", street: "Rua Jerônimo da Veiga", number: "45", city: "São Paulo" });
    expect(b.delivery_address).toMatchObject({ name: "Pessoa Nova", street: "Rua Jerônimo da Veiga", note: "interfone 32" });
    expect(b.items.find((i: any) => i.product_name_snapshot === "Frete").unit_price).toBe(15);
    // A tela final já sabe para onde vai e quem é o cliente novo.
    expect(st.lastSale!.entrega).toMatchObject({ street: "Rua Jerônimo da Veiga" });
    expect(st.lastSale!.customerName).toBe("Pessoa Nova");
    expect(st.lastSale!.customerId).toBe("cli-novo");
  });
});

describe("venda com frete, cliente sem endereço", () => {
  test("abre 'Para onde vai'; confirmado, a venda leva o endereço do cliente", () => {
    carrinho("12");
    act(() => { st.selectCustomer("c-sem", "Pessoa Sem Endereço", "11933334444"); });
    expect(st.cartProps.frete!.faltaEndereco).toBe(true);
    act(() => { st.handleFinalize(); });
    expect(st.pedidoDeEntrega).toBe("endereco");
    expect(mockBodies).toHaveLength(0);
    act(() => {
      st.confirmarEntrega({ customerId: "c-sem", nome: "Pessoa Sem Endereço", telefone: "11933334444", endereco: ENDERECO, recado: "", novoCliente: false });
    });
    const b = corpo();
    expect(b.customer_id).toBe("c-sem");
    expect(b.customer).toBeUndefined();
    expect(b.delivery_check).toBe(true);
    expect(b.delivery_address).toMatchObject({ street: "Rua Jerônimo da Veiga", number: "45", name: "Pessoa Sem Endereço" });
  });

  test("trocar de cliente depois de preencher pergunta de novo", () => {
    carrinho("12");
    act(() => { st.selectCustomer("c-sem", "Pessoa Sem Endereço", null); });
    act(() => { st.handleFinalize(); });
    act(() => { st.voltarDaEntrega(null); });
    act(() => { st.selectCustomer("outro", "Outra Pessoa", null); });
    act(() => { st.handleFinalize(); });
    expect(st.pedidoDeEntrega).toBe("endereco");
    expect(mockBodies).toHaveLength(0);
  });
});

describe("sem trava", () => {
  test("frete com cliente que tem endereço: vende direto, com delivery_check", () => {
    carrinho("15");
    act(() => { st.selectCustomer("c-com", "Pessoa Com Endereço", null); });
    expect(st.cartProps.frete!.entregaResumo).toMatchObject({ street: "Av. Paulista" });
    act(() => { st.handleFinalize(); });
    expect(st.pedidoDeEntrega).toBeNull();
    expect(mockBodies).toHaveLength(1);
    expect(corpo().delivery_check).toBe(true);
    expect(corpo().delivery_address).toBeUndefined();
  });

  test("sem frete: corpo de sempre, sem nenhum campo de entrega", () => {
    carrinho(null);
    act(() => { st.handleFinalize(); });
    expect(st.pedidoDeEntrega).toBeNull();
    expect(mockBodies).toHaveLength(1);
    const b = corpo();
    expect("delivery_check" in b).toBe(false);
    expect("delivery_address" in b).toBe(false);
    expect("customer" in b).toBe(false);
  });
});
