// ============================================================
// Ordem de Serviço no PDV e na listagem.
//
// O que estes testes seguram:
//
// 1. OsActions (tela de sucesso da venda) é SILENCIOSO por desenho: sem
//    toggle, sem cliente ou sem OS pronta, não renderiza NADA. A tela de
//    sucesso do PDV é o lugar mais disputado do app — quem não usa OS não
//    pode ganhar um card vazio ali.
//
// 2. "Entregar e imprimir" manda o sale_id — é o único ponto onde a OS
//    encosta na venda. Sem esse vínculo o ciclo fecha sem rastro.
//
// 3. A listagem abre com o toggle DESLIGADO (aparelhos no balcão não
//    podem sumir da vista), mas o botão "Nova OS" some.
//
// react-test-renderer direto (não RTL) — mesma razão registrada em
// lojaSempreAberta.test.tsx: o moduleNameMapper aponta react-native ->
// react-native-web e o RTL quebra nos host components. Sob RN-web o
// testID vira data-testid.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({
  toast: { show: jest.fn(), error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "os-1" }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { company: { id: "empresa-1" }, token: "t", isDemo: false, consolidatedView: false };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

// pdv_settings controlável por teste
var mockOsEnabled = true;
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({
    settings: { os_enabled: mockOsEnabled },
    isLoading: false,
    invalidate: jest.fn(),
  }),
}));

// react-query: entrega o resultado da lista sem rede
var mockOrders: any[] = [];
var mockIsLoading = false;
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { orders: mockOrders }, isLoading: mockIsLoading, isFetching: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

var mockSetStatus = jest.fn().mockResolvedValue({});
var mockPrintOs = jest.fn();
jest.mock("@/services/serviceOrdersApi", () => {
  const real = jest.requireActual("@/services/serviceOrdersApi");
  return {
    ...real,
    serviceOrdersApi: { ...real.serviceOrdersApi, setStatus: (...a: any[]) => mockSetStatus(...a), list: jest.fn() },
    printOs: (...a: any[]) => mockPrintOs(...a),
  };
});

import { OsActions } from "@/components/screens/pdv/OsActions";
import OsListScreen from "@/app/(tabs)/os/index";

function nos(arvore: any): any[] {
  const out: any[] = [];
  const anda = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(anda);
    out.push(n);
    if (n.children) anda(n.children);
  };
  anda(arvore);
  return out;
}
const temTestId = (arvore: any, id: string) =>
  nos(arvore).some((n) => n.props && n.props["data-testid"] === id);

function osPronta(over: any = {}) {
  return {
    id: "os-1", os_number: 42, status: "pronta", customer_id: "cli-1",
    customer_name: "Marina", equipment_type: "Notebook", equipment_brand: "Dell",
    reported_issue: "Não liga", estimated_amount: "480.00",
    warranty_days: 90, created_at: "2026-08-25T09:15:00Z",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOsEnabled = true;
  mockOrders = [];
  mockIsLoading = false;
});

describe("OsActions na tela de sucesso do PDV", () => {
  function montar(props: any = {}) {
    let r: any;
    act(() => {
      r = renderer.create(
        <OsActions companyId="empresa-1" saleId="venda-9" customerId="cli-1" {...props} />
      );
    });
    return r;
  }

  test("some por inteiro sem cliente na venda", () => {
    mockOrders = [osPronta()];
    const r = montar({ customerId: undefined });
    expect(r.toJSON()).toBeNull();
  });

  test("some por inteiro com o toggle desligado", () => {
    mockOsEnabled = false;
    mockOrders = [osPronta()];
    expect(montar().toJSON()).toBeNull();
  });

  test("some por inteiro quando o cliente não tem OS pronta", () => {
    mockOrders = [];
    expect(montar().toJSON()).toBeNull();
  });

  test("com OS pronta do cliente, mostra o bloco com a ação de entrega", () => {
    mockOrders = [osPronta()];
    const r = montar();
    expect(temTestId(r.toJSON(), "os-actions")).toBe(true);
    expect(temTestId(r.toJSON(), "os-entregar-42")).toBe(true);
  });

  test("entregar manda o sale_id — o único vínculo entre OS e venda", async () => {
    mockOrders = [osPronta()];
    const r = montar();
    const btn = r.root.findAllByProps({ testID: "os-entregar-42" })[0];
    await act(async () => { await btn.props.onClick?.() ?? btn.props.onPress?.(); });
    expect(mockSetStatus).toHaveBeenCalledWith("empresa-1", "os-1", "entregue", { sale_id: "venda-9" });
  });

  test("depois de entregar, a ação vira reimprimir — não entrega duas vezes", async () => {
    mockOrders = [osPronta()];
    const r = montar();
    const btn = r.root.findAllByProps({ testID: "os-entregar-42" })[0];
    await act(async () => { await btn.props.onClick?.() ?? btn.props.onPress?.(); });
    expect(temTestId(r.toJSON(), "os-reimprimir-42")).toBe(true);
    expect(temTestId(r.toJSON(), "os-entregar-42")).toBe(false);
  });
});

describe("listagem de OS", () => {
  function montar() {
    let r: any;
    act(() => { r = renderer.create(<OsListScreen />); });
    return r;
  }

  test("com o toggle ligado, o botão Nova OS aparece", () => {
    expect(temTestId(montar().toJSON(), "os-nova")).toBe(true);
  });

  test("toggle desligado: a lista continua visível, mas sem criar OS nova", () => {
    // Aparelho de cliente no balcão não pode sumir da vista porque a loja
    // desligou o módulo — mesma decisão do backend (gate só na escrita).
    mockOsEnabled = false;
    mockOrders = [osPronta()];
    const arvore = montar().toJSON();
    expect(temTestId(arvore, "os-row-42")).toBe(true);
    expect(temTestId(arvore, "os-nova")).toBe(false);
  });

  test("as OS listadas mostram cliente e badge de status", () => {
    mockOrders = [osPronta()];
    const arvore = montar().toJSON();
    const texto = JSON.stringify(arvore);
    expect(texto).toContain("Marina");
    expect(texto).toContain("Pronta");
  });
});
