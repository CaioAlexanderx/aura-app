// ============================================================
// QA 23/09/2026 (produção, 16h): mesmo com app#952, trocar o tema pelo
// "Modo claro"/"Modo escuro" do menu lateral recarregava a página e o Caixa
// voltava com o carrinho vazio — e o sessionStorage estava vazio.
//
// Este teste monta o layout REAL das abas (app/(tabs)/_layout.tsx) com o
// Caixa (useCart) no lugar do <Slot />, clica no item do menu lateral e
// confere o sessionStorage no instante da recarga. Depois "recarrega":
// jest.resetModules() zera tudo o que vive em memória (store do tema,
// registro de guardiões, estado do React), como o navegador faz; só o
// sessionStorage da aba sobrevive.
//
// Causa raiz: o toggle fazia set({ isDark }) e o layout embrulha a página
// num <div key={themeKey}>. A chave nova desmontava e REMONTAVA o Caixa nos
// 200 ms antes do reload; o useCart novo montava com a empresa já conhecida,
// chamava recuperarVenda() — leitura única, que APAGA — e a recarga chegava
// com o sessionStorage vazio.
// ============================================================
/* eslint-disable @typescript-eslint/no-var-requires */

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/SidebarEditor", () => ({ SidebarEditor: () => null }));
jest.mock("@/components/CompanySwitcher", () => ({ CompanySwitcher: () => null }));
jest.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));
jest.mock("@/components/PageTransition", () => ({ PageTransition: (p: any) => p.children }));
jest.mock("@/components/ErrorBoundary", () => ({ ErrorBoundary: (p: any) => p.children }));
jest.mock("@/components/Toast", () => ({
  ToastContainer: () => null,
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/hooks/useModules", () => ({
  useModules: () => ({ activeModules: ["pdv"], hasModule: () => true, primaryModule: "pdv" }),
}));
jest.mock("@/hooks/useVerticalTheme", () => ({ useVerticalTheme: () => null }));
jest.mock("@/hooks/useVisibleModules", () => ({
  ...jest.requireActual("@/hooks/useVisibleModules"),
  useVisibleModules: () => new Set(["pdv"]),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {} }) }));
jest.mock("@/hooks/useSidebarLayout", () => ({
  useSidebarLayout: () => ({ layout: null }),
  applyLayoutToNav: (nav: any) => nav,
}));
jest.mock("@/services/api", () => ({ pdvApi: { createSale: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn() }),
}));
// Auth de verdade o bastante: um store zustand, para a empresa poder
// "chegar depois" (o /auth/me da abertura) e re-renderizar o Caixa.
jest.mock("@/stores/auth", () => {
  const { create } = require("zustand");
  const useAuthStore = create(() => ({
    company: null,
    user: { name: "Geovana" },
    token: "tok",
    isDemo: false,
    refreshMe: () => Promise.resolve(),
    logout: () => {},
  }));
  return { useAuthStore };
});
// O <Slot /> do Expo Router vira o Caixa (o usePdvState usa este useCart).
// A fábrica roda quando o layout é carregado, então o useCart é o do mesmo
// registro de módulos da "página".
jest.mock("expo-router", () => {
  const { useCart } = require("@/hooks/useCart");
  function Caixa() {
    (globalThis as any).__caixa = useCart();
    return null;
  }
  return {
    Slot: Caixa,
    usePathname: () => "/pdv",
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  };
});

const CHAVE = "aura:caixa:venda-em-andamento";

type Pagina = {
  renderer: any;
  auth: any;
  arvore: any;
};

const caixa = () => (globalThis as any).__caixa as ReturnType<typeof import("@/hooks/useCart").useCart>;

let recargas: number;
let storageNaRecarga: Record<string, string> | null;

function fotoDoStorage() {
  const snap: Record<string, string> = {};
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i)!;
    snap[k] = window.sessionStorage.getItem(k)!;
  }
  return snap;
}

/** Abre (ou "recarrega") a página: módulos novos, só o storage sobrevive. */
function abrirPagina(empresa: string | null): Pagina {
  jest.resetModules();
  (globalThis as any).__caixa = undefined;
  const React = require("react");
  const renderer = require("react-test-renderer");
  const auth = require("@/stores/auth").useAuthStore;
  // O jsdom não deixa trocar window.location.reload: a recarga passa por
  // utils/vendaGuardada.recarregarPagina, espionada aqui.
  const vendaGuardada = require("@/utils/vendaGuardada");
  jest.spyOn(vendaGuardada, "recarregarPagina").mockImplementation(() => {
    recargas++;
    storageNaRecarga = fotoDoStorage();
  });
  auth.setState({ company: empresa ? { id: empresa, plan: "negocio" } : null });
  const TabsLayout = require("@/app/(tabs)/_layout").default;
  let arvore: any;
  renderer.act(() => { arvore = renderer.create(React.createElement(TabsLayout)); });
  return { renderer, auth, arvore };
}

function texto(n: any): string {
  return (n.children || []).map((c: any) => (typeof c === "string" ? c : texto(c))).join("");
}

function clicarEmTrocarTema(p: Pagina) {
  const botoes = p.arvore.root.findAll((n: any) => n.type === "button" && /Modo (claro|escuro)/.test(texto(n)));
  expect(botoes).toHaveLength(1);
  p.renderer.act(() => { botoes[0].props.onClick({ preventDefault() {} }); });
}

function esperarRecarga(p: Pagina) {
  p.renderer.act(() => { jest.advanceTimersByTime(3000); });
}

function montarVenda(p: Pagina) {
  const { act } = p.renderer;
  act(() => { caixa().addToCart({ id: "piso", name: "Porcelanato", price: 64.8 }); });
  act(() => { caixa().setQty("piso", 18.56); });
  act(() => { caixa().addToCart({ id: "cim", name: "Cimento", price: 38 }); });
  act(() => { caixa().setPayment("cartao"); });
  act(() => { caixa().selectCustomer("cli-1", "Dona Maria", "11999990000"); });
}

function fechar(p: Pagina) {
  p.renderer.act(() => { p.arvore.unmount(); });
}

beforeEach(() => {
  jest.useFakeTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
  document.cookie = "aura_theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  recargas = 0;
  storageNaRecarga = null;
});
afterEach(() => {
  jest.useRealTimers();
});

describe("Menu lateral: trocar o tema com venda no Caixa", () => {
  test("a venda está no sessionStorage na hora da recarga e volta quando a empresa chega", () => {
    const p1 = abrirPagina("empresa-1");
    montarVenda(p1);
    expect(caixa().cart).toHaveLength(2);

    clicarEmTrocarTema(p1);
    // Nenhum Caixa remontado leu (e apagou) a venda antes da recarga.
    expect(caixa().cart).toHaveLength(2);
    esperarRecarga(p1);
    expect(recargas).toBe(1);
    expect(Object.keys(storageNaRecarga!)).toEqual([CHAVE]);
    fechar(p1);

    // Recarregou: a abertura do app ainda não tem a empresa (o /auth/me não
    // voltou). A venda ESPERA, não é descartada.
    const p2 = abrirPagina(null);
    expect(caixa().cart).toHaveLength(0);
    expect(window.sessionStorage.getItem(CHAVE)).not.toBeNull();

    p2.renderer.act(() => { p2.auth.setState({ company: { id: "empresa-1", plan: "negocio" } }); });
    expect(caixa().cart.map((i) => [i.productId, i.qty])).toEqual([["piso", 18.56], ["cim", 1]]);
    expect(caixa().payment).toBe("cartao");
    expect(caixa().selectedCustomerName).toBe("Dona Maria");
    // Leitura única.
    expect(window.sessionStorage.getItem(CHAVE)).toBeNull();
    fechar(p2);
  });

  test("a página volta com o tema novo salvo", () => {
    const p1 = abrirPagina("empresa-1");
    expect(window.localStorage.getItem("aura_theme")).toBe("dark");
    clicarEmTrocarTema(p1);
    esperarRecarga(p1);
    expect(window.localStorage.getItem("aura_theme")).toBe("light");
    fechar(p1);
  });

  test("multi-CNPJ: a abertura cai em outra empresa e a venda espera a empresa certa", () => {
    const p1 = abrirPagina("empresa-1");
    montarVenda(p1);
    clicarEmTrocarTema(p1);
    esperarRecarga(p1);
    fechar(p1);

    const p2 = abrirPagina("empresa-2");
    expect(caixa().cart).toHaveLength(0);
    expect(window.sessionStorage.getItem(CHAVE)).not.toBeNull();
    p2.renderer.act(() => { p2.auth.setState({ company: { id: "empresa-1", plan: "negocio" } }); });
    expect(caixa().cart).toHaveLength(2);
    fechar(p2);
  });

  test("com venda: avisa, e o item bipado durante o aviso vai junto", () => {
    const p1 = abrirPagina("empresa-1");
    montarVenda(p1);
    const { toast } = require("@/components/Toast");
    clicarEmTrocarTema(p1);
    expect(toast.info).toHaveBeenCalledWith("Vou recarregar a tela para trocar o tema. Sua venda continua aqui.");
    expect(recargas).toBe(0);

    p1.renderer.act(() => { caixa().addToCart({ id: "arg", name: "Argamassa", price: 22 }); });
    // Clique repetido durante o aviso não marca uma segunda recarga.
    clicarEmTrocarTema(p1);
    esperarRecarga(p1);
    expect(recargas).toBe(1);
    const env = JSON.parse(storageNaRecarga![CHAVE]);
    expect(env.dados.cart.map((i: any) => i.productId)).toEqual(["piso", "cim", "arg"]);
    fechar(p1);
  });

  test("sem venda: recarrega sem aviso e não guarda nada", () => {
    const p1 = abrirPagina("empresa-1");
    const { toast } = require("@/components/Toast");
    clicarEmTrocarTema(p1);
    esperarRecarga(p1);
    expect(recargas).toBe(1);
    expect(storageNaRecarga).toEqual({});
    expect(toast.info).not.toHaveBeenCalled();
    fechar(p1);
  });
});
