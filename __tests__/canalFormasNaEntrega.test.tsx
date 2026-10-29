// ============================================================
// Meu Site · formas de pagar na entrega (tq-44, 29/10/2026)
//
// Desenho da Nina (19/10): a lojista marca dinheiro (com troco), cartão na
// máquina e Pix na hora. Com alguma marcada, o pedido chega para ela
// aceitar; sem nenhuma, fica como sempre foi. Aqui: as regras puras do
// formulário e a aba real (as formas só aparecem com "pagar na entrega"
// ligado e vão no corpo do salvar).
// ============================================================
import React from "react";
import { render, screen, fireEvent, configure, act } from "@testing-library/react-native";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Rect: stub("Rect"), Ellipse: stub("Ellipse"), G: stub("G"),
    Defs: stub("Defs"), LinearGradient: stub("LinearGradient"), Stop: stub("Stop"),
  };
});
jest.mock("@/components/Toast", () => ({ toast: { show: jest.fn(), error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const mockSessao: any = { company: { id: "c1", name: "Adega", plan: "negocio" }, consolidatedView: false };
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockSessao) : mockSessao),
}));
jest.mock("@/components/screens/canal/MpGatewayCard", () => ({ MpGatewayCard: () => null }));
jest.mock("@/hooks/usePaymentGateways", () => ({ usePaymentGateways: () => ({ mpGateway: null }) }));

import { TabMeuSite } from "@/components/screens/canal/TabMeuSite";
import {
  alternarFormaNaEntrega, corpoDoMeuSite, formDoMeuSite, lerFormasNaEntrega, meuSiteAlterado,
} from "@/components/screens/canal/meuSite";

describe("regras do formulário", () => {
  test("lê a lista do servidor na ordem da tela e ignora o que não conhece", () => {
    expect(lerFormasNaEntrega(["pix", "cash"])).toEqual(["cash", "pix"]);
    expect(lerFormasNaEntrega(null)).toEqual([]);
    expect(lerFormasNaEntrega(["boleto"])).toEqual([]);
  });
  test("marcar e desmarcar mantém a ordem", () => {
    expect(alternarFormaNaEntrega(["pix"], "cash")).toEqual(["cash", "pix"]);
    expect(alternarFormaNaEntrega(["cash", "pix"], "cash")).toEqual(["pix"]);
  });
  test("o corpo do salvar leva as formas; loja sem formas manda lista vazia", () => {
    expect(corpoDoMeuSite(formDoMeuSite({ pay_on_delivery_enabled: true, pay_on_delivery_methods: ["card", "cash"] })).pay_on_delivery_methods)
      .toEqual(["cash", "card"]);
    expect(corpoDoMeuSite(formDoMeuSite({})).pay_on_delivery_methods).toEqual([]);
  });
  test("mudar as formas conta como alteração", () => {
    const salvo = formDoMeuSite({ pay_on_delivery_enabled: true });
    expect(meuSiteAlterado({ ...salvo, payOnDeliveryMethods: ["cash"] }, salvo)).toBe(true);
    expect(meuSiteAlterado({ ...salvo }, salvo)).toBe(false);
  });
});

function montar(config: any) {
  const props: any = {
    config: { exists: true, slug: "adega", site_name: "Adega", ...config },
    saveConfig: jest.fn().mockResolvedValue({ config: {} }),
    isSaving: false,
    requestDomain: jest.fn(), isRequestingDomain: false,
    uploadImage: jest.fn(), isUploadingImage: false,
    setupPix: jest.fn(), isSettingUpPix: false,
  };
  const salvarRef: any = { current: null };
  render(<TabMeuSite {...props} salvarRef={salvarRef} />);
  return { props, salvarRef };
}

describe("aba Meu Site", () => {
  test("sem pagar na entrega ligado, as formas não aparecem", () => {
    montar({ pay_on_delivery_enabled: false });
    expect(screen.queryByTestId("formas-na-entrega")).toBeNull();
  });

  test("ligado: marca dinheiro e cartão, e o salvar manda as duas", async () => {
    const { props, salvarRef } = montar({ pay_on_delivery_enabled: true });
    expect(screen.getByText(/Sem nenhuma marcada, o pedido entra já confirmado/)).toBeTruthy();
    fireEvent.press(screen.getByText("Cartão na máquina"));
    fireEvent.press(screen.getByText("Dinheiro, com troco"));
    expect(screen.getByText(/O estoque só baixa quando você aceita/)).toBeTruthy();
    await act(async () => { await salvarRef.current(); });
    expect(props.saveConfig.mock.calls[0][0].pay_on_delivery_methods).toEqual(["cash", "card"]);
  });

  test("abre com as formas que estão salvas; desmarcar a última volta ao fluxo de hoje", async () => {
    const { props, salvarRef } = montar({ pay_on_delivery_enabled: true, pay_on_delivery_methods: ["pix"] });
    expect(screen.getByText(/O estoque só baixa quando você aceita/)).toBeTruthy();
    fireEvent.press(screen.getByText("Pix na hora"));
    expect(screen.getByText(/Sem nenhuma marcada, o pedido entra já confirmado/)).toBeTruthy();
    await act(async () => { await salvarRef.current(); });
    expect(props.saveConfig.mock.calls[0][0].pay_on_delivery_methods).toEqual([]);
  });
});
