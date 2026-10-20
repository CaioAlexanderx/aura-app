// 20/10/2026 — decisão do Caio: "logo em todos os lugares já previstos, não
// deveria ter gate de plano nisso". Um lojista do Essencial subia a logo em
// Configurações (companies.logo_url gravado), mas o orçamento impresso do
// Caixa saía só com a inicial: o handleGenerateQuote passava a logo pelo
// gate podeMostrarLogo(plan), que só deixava Negócio, Expansão e
// Personalizado. Aqui o usePdvState é o de verdade; o openQuotePdf é espiado.
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

let mockPlano = "essencial";
let mockCompanyLogo: string | null = null;
jest.mock("@/stores/auth", () => {
  const estado = () => ({
    company: { id: "co-1", plan: mockPlano, name: "Loja Teste" },
    user: { id: "u-1" }, token: "t", isDemo: false, companyLogo: mockCompanyLogo,
  });
  const useAuthStore = Object.assign(
    (sel?: (s: any) => any) => (typeof sel === "function" ? sel(estado()) : estado()),
    { getState: () => estado(), setState: () => {}, subscribe: () => () => {} },
  );
  return { useAuthStore };
});
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), setParams: jest.fn() }),
  usePathname: () => "/pdv",
}));
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: [] }) }));
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [] }) }));
jest.mock("@/hooks/useCategories", () => ({ useCategories: () => ({ flattened: [] }) }));
jest.mock("@/hooks/useCaixa", () => ({ useCaixa: () => ({ sessaoAtiva: null, isAberto: true, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/hooks/useGlobalBarcodeScanner", () => ({ useGlobalBarcodeScanner: () => {} }));

// Perfil da empresa (GET /companies/:id/profile) com a logo gravada.
let mockPerfil: { logoUrl: string | null; plan: string } = { logoUrl: null, plan: "essencial" };
jest.mock("@/hooks/useCompanyProfile", () => ({
  useCompanyProfile: () => ({
    profile: { logo_url: mockPerfil.logoUrl, phone: "(11) 99999-0000", address: "Rua A, 1" },
    logoUrl: mockPerfil.logoUrl,
    plan: mockPerfil.plan,
    tradeName: "Loja Teste",
  }),
}));
jest.mock("@/hooks/useMatconQuote", () => ({ useMatconQuote: () => ({}) }));
jest.mock("@/hooks/useMatconReferral", () => ({ useMatconReferral: () => ({}) }));
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
  pdvSettingsApi: { get: jest.fn(), save: jest.fn() },
  couponsApi: {},
  employeesApi: { list: jest.fn() },
}));
jest.mock("@/services/pdvApi", () => ({ pdvApi: { scan: jest.fn() } }));
jest.mock("@/utils/quotePdf", () => ({ openQuotePdf: jest.fn() }));

import { usePdvState } from "@/hooks/usePdvState";
import { openQuotePdf } from "@/utils/quotePdf";

let host: HTMLDivElement;
let root: Root;
let st: ReturnType<typeof usePdvState>;

function Caixa() {
  st = usePdvState();
  return null;
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch {}
  jest.clearAllMocks();
  mockPlano = "essencial";
  mockCompanyLogo = null;
  mockPerfil = { logoUrl: null, plan: "essencial" };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => { root.unmount(); });
  host.remove();
});

async function gerarOrcamento() {
  await act(async () => { root.render(<Caixa />); });
  await act(async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); });
  await act(async () => { st.handleAddProduct({ id: "p-1", name: "Camiseta", price: 50 } as any); });
  await act(async () => { st.handleGenerateQuote(null); });
  expect(openQuotePdf).toHaveBeenCalledTimes(1);
  return (openQuotePdf as jest.Mock).mock.calls[0][0];
}

describe("Orçamento do Caixa: logo do lojista em qualquer plano", () => {
  it("Essencial com logo cadastrada: o orçamento recebe companyLogoUrl", async () => {
    mockPerfil = { logoUrl: "https://cdn.aura/logo-loja.png", plan: "essencial" };
    const dados = await gerarOrcamento();
    expect(dados.companyLogoUrl).toBe("https://cdn.aura/logo-loja.png");
  });

  it("Essencial com a logo só no auth store (perfil sem logo): usa a do auth store", async () => {
    mockCompanyLogo = "https://cdn.aura/logo-auth.png";
    const dados = await gerarOrcamento();
    expect(dados.companyLogoUrl).toBe("https://cdn.aura/logo-auth.png");
  });

  it("Negócio com logo cadastrada: continua recebendo a logo", async () => {
    mockPlano = "negocio";
    mockPerfil = { logoUrl: "https://cdn.aura/logo-loja.png", plan: "negocio" };
    const dados = await gerarOrcamento();
    expect(dados.companyLogoUrl).toBe("https://cdn.aura/logo-loja.png");
  });

  it("sem logo em lugar nenhum: companyLogoUrl vazio (o PDF cai na inicial, como hoje)", async () => {
    const dados = await gerarOrcamento();
    expect(dados.companyLogoUrl).toBeNull();
  });
});
