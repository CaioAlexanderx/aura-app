// ============================================================
// Caixa com NFS-e automática (10/11/2026, mockup nfse-cadastro-servico.html,
// tela 3) — usePdvState + useCart de verdade, rede mockada.
//   - serviço + opt-in: "Finalizar venda" exige CPF ou CNPJ válido (dígito
//     verificador); o aviso do rodapé leva ao campo; com o documento a
//     venda sai e a tela final leva o tomador;
//   - venda mista: aviso "Esta venda sai em duas notas";
//   - venda só de produto: corpo do POST e tela final idênticos aos de uma
//     loja sem a emissão automática (o "CPF na nota" opcional de sempre);
//   - loja sem o opt-in: serviço fecha sem documento, nada muda;
//   - o documento vai no POST /pdv/sale como nfse_tomador { doc, nome }
//     (vence o cadastro do cliente no backend); fora do campo
//     nfse_tomador o corpo não leva o documento.
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

describe("serviço numa loja com a NFS-e automática", () => {
  test("sem documento: não fecha, avisa e mostra o campo obrigatório", () => {
    montar(ATIVA);
    carrinho(SERVICO);
    expect(st.cartProps.tomador).toMatchObject({ exigido: true, temProduto: false, mostrarNome: true });
    expect(labels()).toContain("Falta o CPF ou CNPJ do cliente");
    expect(st.cartProps.finalizeDisabled).toBe(true);
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith("Informe o CPF ou CNPJ de quem contratou o serviço antes de finalizar.");
    expect(st.cartProps.avisoNotas).toBe("Ao finalizar, a nota de serviço (NFS-e) sai sozinha.");
  });

  test("dígito errado: não fecha e pede para conferir", () => {
    montar(ATIVA);
    carrinho(SERVICO);
    act(() => { st.cartProps.onCpfNaNotaChange!("529.982.247-26"); });
    expect(labels()).toContain("Confira o CPF ou CNPJ do cliente");
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(0);
  });

  test("CNPJ válido: fecha; o documento vai no POST como nfse_tomador e para a tela final, não para a NFC-e", () => {
    montar(ATIVA);
    carrinho(SERVICO);
    act(() => { st.cartProps.onCpfNaNotaChange!("11.222.333/0001-81"); });
    act(() => { st.cartProps.tomador!.onNome!("Studio Bela Ltda"); });
    expect(labels()).not.toContain("Falta o CPF ou CNPJ do cliente");
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(1);
    const b = corpo();
    expect(b.nfse_tomador).toEqual({ doc: "11222333000181", nome: "Studio Bela Ltda" });
    // fora do nfse_tomador, o corpo não leva o documento
    const { nfse_tomador: _t, ...resto } = b;
    expect(JSON.stringify(resto)).not.toMatch(/11222333000181|cpf|tomador|document/i);
    expect(st.lastSale!.tomador).toEqual({ doc: "11222333000181", nome: "Studio Bela Ltda" });
    expect(st.lastSale!.cpfNaNota).toBeUndefined();
  });

  test("CPF válido também vai no CPF da NFC-e", () => {
    montar(ATIVA);
    carrinho(PRODUTO, SERVICO);
    act(() => { st.cartProps.onCpfNaNotaChange!("52998224725"); });
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(1);
    expect(corpo().nfse_tomador).toEqual({ doc: "52998224725", nome: null });
    expect(st.lastSale!.cpfNaNota).toBe("52998224725");
    expect(st.lastSale!.tomador).toEqual({ doc: "52998224725", nome: null });
  });

  test("venda mista: aviso das duas notas", () => {
    montar(ATIVA);
    carrinho(PRODUTO, SERVICO);
    expect(st.cartProps.tomador!.temProduto).toBe(true);
    expect(st.cartProps.avisoNotas).toMatch(/^Esta venda sai em duas notas: o cupom fiscal \(NFC-e\) dos produtos e a nota de serviço \(NFS-e\) do serviço\./);
  });
});

describe("venda só de produto fica idêntica", () => {
  function vender(cfg: any, cpf?: string) {
    montar(cfg);
    carrinho(PRODUTO);
    if (cpf) act(() => { st.cartProps.onCpfNaNotaChange!(cpf); });
    expect(st.cartProps.tomador).toBeNull();
    expect(st.cartProps.avisoNotas).toBeNull();
    expect(labels()).toEqual([]);
    act(() => { st.handleFinalize(); });
    const b = corpo();
    const ls = st.lastSale!;
    act(() => { tree.unmount(); });
    return { b, ls };
  }

  test("com o opt-in ligado, o mesmo corpo e a mesma tela final da loja sem NFS-e", () => {
    const sem = vender(null, "529.982.247-25");
    mockBodies.length = 0;
    const com = vender(ATIVA, "529.982.247-25");
    expect(com.b).toEqual(sem.b);
    expect(com.b).not.toHaveProperty("nfse_tomador");
    expect(com.ls.cpfNaNota).toBe("52998224725");
    expect(com.ls.tomador).toBeUndefined();
    expect(sem.ls.tomador).toBeUndefined();
    act(() => { tree = renderer.create(<Harness />); });
  });

  test("sem CPF continua opcional", () => {
    const { b, ls } = vender(ATIVA);
    expect(b.items).toHaveLength(1);
    expect(ls.cpfNaNota).toBeUndefined();
    act(() => { tree = renderer.create(<Harness />); });
  });
});

describe("loja sem a emissão automática", () => {
  test("serviço fecha sem documento, sem aviso", () => {
    montar({ ativa: false });
    carrinho(SERVICO);
    expect(st.cartProps.tomador).toBeNull();
    expect(st.cartProps.avisoNotas).toBeNull();
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(1);
    expect(corpo()).not.toHaveProperty("nfse_tomador");
    expect(st.lastSale!.tomador).toBeUndefined();
  });
});

// 10/11/2026 (botão "Emitir NFS-e", Aura-backend#989): a loja emite NFS-e
// (config.emite) mas sem a automática — o campo aparece, OPCIONAL.
const SO_EMITE = { ligada_no_servidor: false, tem_config: true, provider: "nacional", emissao_automatica: false, emissao_automatica_desde: null, ativa: false, emite: true };

describe("loja que emite NFS-e só pelo botão", () => {
  test("serviço: o campo aparece opcional e a venda fecha sem documento", () => {
    montar(SO_EMITE);
    carrinho(SERVICO);
    expect(st.cartProps.tomador).toMatchObject({ exigido: false, temProduto: false, mostrarNome: true });
    expect(labels()).toEqual([]);
    expect(st.cartProps.finalizeDisabled).toBe(false);
    expect(st.cartProps.avisoNotas).toBeNull();
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(1);
    expect(corpo()).not.toHaveProperty("nfse_tomador");
    expect(st.lastSale!.tomador).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("preenchido e válido: vai como nfse_tomador, como na automática", () => {
    montar(SO_EMITE);
    carrinho(PRODUTO, SERVICO);
    act(() => { st.cartProps.onCpfNaNotaChange!("11.222.333/0001-81"); });
    act(() => { st.cartProps.tomador!.onNome!("Studio Bela Ltda"); });
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(1);
    expect(corpo().nfse_tomador).toEqual({ doc: "11222333000181", nome: "Studio Bela Ltda" });
    expect(st.lastSale!.tomador).toEqual({ doc: "11222333000181", nome: "Studio Bela Ltda" });
  });

  test("dígito errado não trava a venda (opcional) e não vai como nfse_tomador", () => {
    montar(SO_EMITE);
    carrinho(SERVICO);
    act(() => { st.cartProps.onCpfNaNotaChange!("529.982.247-26"); });
    expect(labels()).toEqual([]);
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(1);
    expect(corpo()).not.toHaveProperty("nfse_tomador");
  });

  test("com a automática ligada continua OBRIGATÓRIO", () => {
    montar({ ...SO_EMITE, ativa: true, emissao_automatica: true, ligada_no_servidor: true });
    carrinho(SERVICO);
    expect(st.cartProps.tomador).toMatchObject({ exigido: true });
    act(() => { st.handleFinalize(); });
    expect(mockBodies).toHaveLength(0);
  });

  test("venda só de produto: corpo do POST idêntico ao da loja sem NFS-e", () => {
    function vender(cfg: any) {
      montar(cfg);
      carrinho(PRODUTO);
      act(() => { st.cartProps.onCpfNaNotaChange!("529.982.247-25"); });
      expect(st.cartProps.tomador).toBeNull();
      expect(st.cartProps.avisoNotas).toBeNull();
      act(() => { st.handleFinalize(); });
      const b = corpo();
      const ls = st.lastSale!;
      act(() => { tree.unmount(); });
      return { b, ls };
    }
    const sem = vender(null);
    mockBodies.length = 0;
    const com = vender(SO_EMITE);
    expect(com.b).toEqual(sem.b);
    expect(com.b).not.toHaveProperty("nfse_tomador");
    expect(com.ls).toEqual(sem.ls);
    act(() => { tree = renderer.create(<Harness />); });
  });
});
