// 19/10/2026 — decisão do Caio: conta nova vem com o controle de caixa, o
// vendedor obrigatório e o cliente obrigatório DESLIGADOS ("bloqueador gigantesco
// da primeira venda"). O backend nasce assim (Aura-backend migration 399); aqui
// o default do app (usePdvSettings) acompanha.
//   · conta que nunca salvou nada (a tela ainda não recebeu o GET, ou ele falhou):
//     o Caixa não exige abrir, nem vendedor, nem cliente;
//   · conta que salvou caixa_enabled=true continua exigindo (o servidor vence o default).
// O usePdvState e o usePdvSettings são os de verdade; só a rede e o react-query
// (roteado por queryKey) são de mentira.
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
  const estado = { company: { id: "co-1", plan: "negocio" }, user: { id: "u-1" }, token: "t", isDemo: false, companyLogo: null };
  const useAuthStore = Object.assign(
    (sel?: (s: any) => any) => (typeof sel === "function" ? sel(estado) : estado),
    { getState: () => estado, setState: () => {}, subscribe: () => () => {} },
  );
  return { useAuthStore };
});
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn(), warning: jest.fn() } }));

// O que o GET /pdv-settings devolve nesta rodada; undefined = ainda não respondeu.
let mockRespostaDoServidor: { settings: any } | undefined;
jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => {
    if (opts?.queryKey?.[0] === "pdv-settings") return { data: mockRespostaDoServidor, isLoading: false, error: null };
    return { data: undefined, isLoading: false };
  },
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
// Caixa FECHADO: é o cenário em que o caixa ligado bloquearia a venda.
jest.mock("@/hooks/useCaixa", () => ({ useCaixa: () => ({ sessaoAtiva: null, isAberto: false, isLoading: false, invalidate: jest.fn() }) }));
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
jest.mock("@/services/api", () => ({
  companiesApi: { variants: jest.fn() },
  pdvApi: { scan: jest.fn(), createSale: jest.fn() },
  pdvSettingsApi: { get: jest.fn(), save: jest.fn() },
  couponsApi: {},
  employeesApi: { list: jest.fn() },
}));
jest.mock("@/services/pdvApi", () => ({ pdvApi: { scan: jest.fn() } }));

import { usePdvState } from "@/hooks/usePdvState";
import { usePdvSettings, validateSaleAgainstSettings } from "@/hooks/usePdvSettings";
import { toast } from "@/components/Toast";

let host: HTMLDivElement;
let root: Root;
let st: ReturnType<typeof usePdvState>;
let cfg: ReturnType<typeof usePdvSettings>;

function Caixa() {
  st = usePdvState();
  return null;
}
function Sonda() {
  cfg = usePdvSettings();
  return null;
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch {}
  jest.clearAllMocks();
  mockRespostaDoServidor = undefined;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => { root.unmount(); });
  host.remove();
});

async function abrirCaixa() {
  await act(async () => { root.render(<Caixa />); });
  await act(async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); });
}
const rotulos = () => st.requiredHints.map((h: any) => h.label);

describe("Caixa de conta que nunca salvou configuração", () => {
  it("sem o GET respondido: não exige abrir o caixa, vendedor nem cliente", async () => {
    mockRespostaDoServidor = undefined;
    await abrirCaixa();
    expect(st.caixaEnabled).toBe(false);
    expect(rotulos()).not.toContain("Caixa fechado");
    expect(rotulos()).not.toContain("Cliente obrigatório");
    expect(rotulos()).not.toContain("Vendedora obrigatória");
  });

  it("com o padrão do servidor (conta nova, tudo desligado): idem", async () => {
    mockRespostaDoServidor = { settings: { require_customer: false, require_seller: false, caixa_enabled: false, crediario_enabled: true } };
    await abrirCaixa();
    expect(st.caixaEnabled).toBe(false);
    expect(rotulos()).toEqual([]);
    await act(async () => { st.handleFinalize(); });
    const msgs = (toast.error as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(msgs.some((m) => m.includes("Abra o caixa"))).toBe(false);
    expect(msgs.some((m) => m.includes("Selecione cliente") || m.includes("Selecione vendedora"))).toBe(false);
  });
});

describe("Conta que salvou a própria escolha continua como salvou", () => {
  it("caixa_enabled=true salvo: exige abrir o caixa", async () => {
    mockRespostaDoServidor = { settings: { caixa_enabled: true, require_customer: false, require_seller: false } };
    await abrirCaixa();
    expect(st.caixaEnabled).toBe(true);
    expect(rotulos()).toContain("Caixa fechado");
    await act(async () => { st.handleFinalize(); });
    expect((toast.error as jest.Mock).mock.calls.map((c) => String(c[0]))).toContain("Abra o caixa antes de finalizar a venda");
  });

  it("require_customer e require_seller salvos: continuam exigindo", async () => {
    mockRespostaDoServidor = { settings: { caixa_enabled: false, require_customer: true, require_seller: true } };
    await abrirCaixa();
    expect(rotulos()).toEqual(expect.arrayContaining(["Cliente obrigatório", "Vendedora obrigatória"]));
    expect(rotulos()).not.toContain("Caixa fechado");
  });
});

describe("usePdvSettings: o default enquanto o servidor não respondeu", () => {
  it("caixa, vendedor e cliente desligados; crediário e troco seguem como estavam", async () => {
    mockRespostaDoServidor = undefined;
    await act(async () => { root.render(<Sonda />); });
    expect(cfg.settings).toMatchObject({
      caixa_enabled: false,
      require_seller: false,
      require_customer: false,
      crediario_enabled: true,
      cash_tender_modal_enabled: true,
    });
    expect(validateSaleAgainstSettings(cfg.settings, {})).toEqual({ ok: true, missing: [] });
    expect(validateSaleAgainstSettings(undefined, {})).toEqual({ ok: true, missing: [] });
  });

  it("o que o servidor devolve vence o default", async () => {
    mockRespostaDoServidor = { settings: { caixa_enabled: true, require_customer: true, require_seller: true } };
    await act(async () => { root.render(<Sonda />); });
    expect(cfg.settings.caixa_enabled).toBe(true);
    expect(validateSaleAgainstSettings(cfg.settings, {}).missing).toEqual(["cliente", "vendedora"]);
  });
});
