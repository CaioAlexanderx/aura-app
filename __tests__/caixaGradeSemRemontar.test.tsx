// ============================================================
// 17/11/2026 (p-148, R5): grade do Caixa sem remontar e sem cascata de 1 s.
//
// `ProductSection` e `StockToggle` eram declarados DENTRO da tela do Caixa:
// a cada render (cada tecla na busca, cada item lançado) o React recebia um
// tipo novo e remontava a grade inteira, repetindo a cascata de entrada.
// O que este arquivo trava:
//   1. a tela redesenha (busca, carrinho) e a grade NÃO remonta
//   2. a cascata roda só na primeira entrada; cartão que entra depois
//      (outra busca, outra página, a volta da tela final) aparece direto
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ProductGrid, __reiniciarEntradaDaGrade, type GridProduct } from "@/components/screens/pdv/ProductGrid";

const P = (id: string): GridProduct => ({ id, name: "Produto " + id, price: 10, stock: 5, unit: "un" });

// ─── 2. A cascata só na primeira entrada ─────────────────────────────
function animacoes(t: renderer.ReactTestRenderer): (string | null)[] {
  // O cartão é o Pressable de cada produto; o estilo web é o último do array.
  return t.root
    .findAll((n: any) => n.props && typeof n.props.onPress === "function" && Array.isArray(n.props.style), { deep: false })
    .map((n: any) => {
      const flat = Object.assign({}, ...n.props.style.filter(Boolean));
      return flat.animation || null;
    });
}

describe("ProductGrid: cascata de entrada", () => {
  beforeEach(() => __reiniciarEntradaDaGrade());

  test("primeira entrada anima; quem entra depois, não; quem já estava termina a animação", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<ProductGrid products={[P("a"), P("b")]} qtyById={{}} onAdd={jest.fn()} />); });
    expect(animacoes(t)).toHaveLength(2);
    expect(animacoes(t).every(a => !!a && a.includes("caixaFadeUp"))).toBe(true);

    // busca: entra "c", "a" e "b" continuam
    act(() => { t.update(<ProductGrid products={[P("a"), P("b"), P("c")]} qtyById={{ a: 1 }} onAdd={jest.fn()} />); });
    const depois = animacoes(t);
    expect(depois[0]).toContain("caixaFadeUp");
    expect(depois[1]).toContain("caixaFadeUp");
    expect(depois[2]).toBeNull();
    act(() => { t.unmount(); });

    // a grade volta (depois da tela final, outra página do app): sem cascata
    act(() => { t = renderer.create(<ProductGrid products={[P("a"), P("b")]} qtyById={{}} onAdd={jest.fn()} />); });
    expect(animacoes(t)).toEqual([null, null]);
    act(() => { t.unmount(); });
  });
});

// ─── 1. A tela redesenha e a grade não remonta ───────────────────────
// A tela inteira com o estado do Caixa mockado: só interessa quantas vezes a
// grade monta. Os filhos pesados viram nada.
let mockMontagens = 0;
jest.mock("@/components/screens/pdv/ProductGrid", () => {
  const real = jest.requireActual("@/components/screens/pdv/ProductGrid");
  const R = jest.requireActual("react");
  return {
    ...real,
    ProductGrid: (props: any) => {
      R.useEffect(() => { mockMontagens++; }, []);
      return R.createElement(real.ProductGrid, props);
    },
  };
});
jest.mock("@/components/RequireCompanyScope", () => ({ RequireCompanyScope: ({ children }: any) => children }));
jest.mock("expo-router", () => ({ router: { setParams: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, isDemo: false, trialEndsAt: null }),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {} }) }));
jest.mock("@/utils/muroDeAssinatura", () => ({
  semAssinatura: () => false, avisoDeAtraso: () => null, estadoDaLoja: () => ({}), temCaixaVivo: () => true,
}));
jest.mock("@/components/screens/pdv/CartPanel", () => ({ CartPanel: jest.requireActual("react").forwardRef(() => null) }));
jest.mock("@/components/screens/pdv/PdvModals", () => ({ PdvModals: () => null }));
jest.mock("@/components/screens/pdv/EntregaModal", () => ({ EntregaModal: () => null }));
jest.mock("@/components/screens/pdv/NovaVendedoraModal", () => ({ NovaVendedoraModal: () => null }));
jest.mock("@/components/ConviteDeAvisos", () => ({ ConviteDeAvisos: () => null }));
jest.mock("@/components/screens/pdv/AvisoAssine", () => ({ AvisoAssine: () => null }));
jest.mock("@/components/screens/pdv/CaixaBackdrop", () => ({ CaixaBackdrop: () => null }));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({ MerchantLogo: () => null, useMerchantBrand: () => ({}) }));
jest.mock("@/components/screens/pdv/ScannerStatusChip", () => ({ ScannerStatusChip: () => null }));
jest.mock("@/components/screens/pdv/SaleComplete", () => ({ SaleComplete: () => null }));
jest.mock("@/components/screens/pdv/WarrantyBox", () => ({ WarrantyBox: () => null }));
jest.mock("@/components/screens/pdv/CaixaButton", () => ({ CaixaButton: () => null }));
jest.mock("@/components/matcon/IndicadoPorChip", () => ({ IndicadoPorChip: () => null, IndicadoPorPontos: () => null }));
jest.mock("@/components/screens/pdv/AvisoVendaRecuperada", () => ({ AvisoVendaRecuperada: () => null }));
jest.mock("@/components/screens/pdv/CategoryChips", () => ({ CategoryChips: () => null }));
jest.mock("@/components/screens/pdv/ActionToolbar", () => {
  const R = jest.requireActual("react");
  const Nada = R.forwardRef(() => null);
  return { ActBarcode: Nada, ActPerson: Nada, ActCoupon: Nada, ActTroca: () => null, ActMais: Nada };
});

let mockSt: any;
jest.mock("@/hooks/usePdvState", () => ({ usePdvState: () => mockSt }));

function estado(extra: Record<string, any> = {}) {
  const produtos = [P("a"), P("b"), P("c")];
  return {
    company: { id: "empresa-1", name: "Loja" }, isDemo: false, isNegocioPlus: true, clientesEnabled: true,
    vp: { compact: false, sm: false, xxl: false }, wide: true,
    caixaEnabled: false, sessaoAtiva: null, isAberto: true, caixaLoading: false, invalidateCaixa: jest.fn(),
    employees: [], autoEmitNfce: false, scannerListening: true, lastScannedCode: null,
    query: "", setQuery: jest.fn(), cat: "all", setCat: jest.fn(), showOutOfStock: false, setShowOutOfStock: jest.fn(),
    categories: [], outOfStockCount: 0, paginated: produtos, page: 1, totalPages: 1, filteredTotal: 3, goTo: jest.fn(), qtyById: {},
    selectedCustomerId: null, selectedCustomerName: null, crediarioEnabled: false,
    couponApplied: null, setCouponApplied: jest.fn(), clearCoupon: jest.fn(),
    activeSellerValue: null, activeCustomerValue: null, customerOptions: [], customerRecentCount: 0, pickCustomerWithPhone: jest.fn(),
    sellerPickerRef: { current: null }, customerPickerRef: { current: null },
    handleScan: jest.fn(), handleSearchSubmit: jest.fn(), handleAddProduct: jest.fn(), handleVariantSelected: jest.fn(), handleValidateCoupon: jest.fn(),
    selectEmployee: jest.fn(), setSellerName: jest.fn(),
    cartProps: { items: [], payMethods: [], subtotal: 0 }, cartHeadRef: { current: null }, orderLabel: "Nova venda",
    referral: { active: false }, totalFinal: 0,
    requiredHints: [], products: produtos, customers: [], lastSale: null,
    matconEnabled: false, cardPriceOn: false, gridCardPrice: () => null, productCols: 4, cartWidth: 380,
    openTroca: jest.fn(), vendaRecuperada: null, comandas: {},
    ...extra,
  };
}

import CaixaScreen from "@/app/(tabs)/pdv";

describe("tela do Caixa: a grade não remonta", () => {
  beforeEach(() => { mockMontagens = 0; __reiniciarEntradaDaGrade(); });

  test("digitar na busca e lançar item redesenham a tela sem remontar a grade", () => {
    mockSt = estado();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<CaixaScreen />); });
    expect(mockMontagens).toBe(1);

    // cada tecla da busca é um render novo da tela
    for (const q of ["c", "ca", "cam"]) {
      mockSt = estado({ query: q, paginated: [P("a"), P("b")] });
      act(() => { t.update(<CaixaScreen />); });
    }
    // item lançado: o selo de quantidade muda
    mockSt = estado({ qtyById: { a: 1 }, cartProps: { items: [{ productId: "a" }], payMethods: [], subtotal: 10 } });
    act(() => { t.update(<CaixaScreen />); });
    expect(mockMontagens).toBe(1);
    act(() => { t.unmount(); });
  });

  test("\"Mostrar zerados\" continua alternando", () => {
    const setShowOutOfStock = jest.fn();
    mockSt = estado({ outOfStockCount: 2, setShowOutOfStock });
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<CaixaScreen />); });
    const texto = t.root.findAll((n: any) => typeof n.props?.children === "string" && n.props.children.includes("Mostrar zerados (2)"))[0];
    expect(texto).toBeTruthy();
    let botao: any = texto;
    while (botao && typeof botao.props?.onPress !== "function") botao = botao.parent;
    expect(botao).toBeTruthy();
    act(() => { botao!.props.onPress(); });
    expect(setShowOutOfStock).toHaveBeenCalledTimes(1);
    act(() => { t.unmount(); });
  });
});
