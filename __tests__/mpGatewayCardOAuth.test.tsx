// ============================================================
// Mercado Pago por OAuth no Meu Site (tq-96, 29/10/2026)
//
// Cartão sem campos de token: botão "Conectar com Mercado Pago",
// "Conectado como <nome>", desconectar com confirmação, conexão caída e a
// volta do Mercado Pago (?mp=conectado|negado|erro). Sem a aplicação ligada
// na Aura (oauth_disponivel=false) o cartão não aparece.
// ============================================================
import React from "react";
import { render, screen, fireEvent, configure, act } from "@testing-library/react-native";
import {
  estadoDoMp, lerResultadoDoRetorno, nomeDaConta, urlSemRetorno, caminhoDeVolta,
  textoDosPedidosEmAndamento, mpRecebendo,
} from "@/utils/mpConexao";

(global as any).__DEV__ = false;

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
const mockToast: Record<string, jest.Mock> = jest.requireMock("@/components/Toast").toast;

let mockSessao: any = { isStaff: false, company: { id: "c1" } };
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockSessao) : mockSessao),
}));

let mockParams: any = {};
jest.mock("expo-router", () => ({
  useGlobalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn() }),
}));

let mockHook: any;
jest.mock("@/hooks/usePaymentGateways", () => ({ usePaymentGateways: () => mockHook }));

import { MpGatewayCard } from "@/components/screens/canal/MpGatewayCard";

function hook(over: any = {}) {
  return {
    mpGateway: null,
    isLoading: false,
    refetch: jest.fn().mockResolvedValue({ data: { gateways: [] } }),
    oauthDisponivel: true,
    podeConectar: true,
    pedidosEmAndamento: 0,
    removeGateway: jest.fn().mockResolvedValue({}),
    isRemoving: false,
    iniciarConexao: jest.fn().mockResolvedValue({ url: "https://auth.mercadopago.com.br/authorization?x=1" }),
    isIniciando: false,
    ...over,
  };
}

const CONECTADO = {
  gateway: "mercadopago", auth_method: "oauth", account_name: "LOJA TESTE",
  connection_status: "ok", sandbox: false, updated_at: "2026-10-21T12:00:00Z",
};

beforeEach(() => {
  mockParams = {};
  mockSessao = { isStaff: false, company: { id: "c1" } };
  Object.values(mockToast).forEach((f) => f.mockClear());
});

describe("regras puras", () => {
  test("estado do cartão", () => {
    expect(estadoDoMp(null, false)).toBe("oculto");
    expect(estadoDoMp(null, true)).toBe("desconectado");
    expect(estadoDoMp(CONECTADO as any, true)).toBe("conectado");
    expect(estadoDoMp({ ...CONECTADO, connection_status: "caiu" } as any, true)).toBe("caiu");
    expect(mpRecebendo({ ...CONECTADO, connection_status: "caiu" } as any)).toBe(false);
  });
  test("retorno, nome e URLs", () => {
    expect(lerResultadoDoRetorno("conectado")).toBe("conectado");
    expect(lerResultadoDoRetorno(["negado"])).toBe("negado");
    expect(lerResultadoDoRetorno("qualquer")).toBeNull();
    expect(nomeDaConta({ gateway: "mercadopago", account_name: "" })).toBe("sua conta do Mercado Pago");
    expect(urlSemRetorno("https://app.test/canal?tab=site&mp=conectado&empresa=c2")).toBe("/canal?tab=site");
    expect(urlSemRetorno("https://app.test/canal?tab=site")).toBeNull();
    expect(caminhoDeVolta("https://app.test/studio/vendas/loja-digital?mp=erro")).toBe("/studio/vendas/loja-digital");
    expect(caminhoDeVolta(null)).toBe("/canal?tab=site");
    expect(textoDosPedidosEmAndamento(0)).toBeNull();
    expect(textoDosPedidosEmAndamento(2)).toContain("2 pedidos");
  });
});

describe("MpGatewayCard", () => {
  test("sem a aplicação ligada e sem conexão, não aparece", () => {
    mockHook = hook({ oauthDisponivel: false });
    render(<MpGatewayCard />);
    expect(screen.queryByText("Mercado Pago")).toBeNull();
  });

  test("não conectado: botão, sem campo de token, sem modo de testes para a lojista", async () => {
    mockHook = hook();
    render(<MpGatewayCard />);
    expect(screen.getByText("Conectar com Mercado Pago")).toBeTruthy();
    expect(screen.queryByText(/Token de acesso/)).toBeNull();
    expect(screen.queryByText(/modo de testes/i)).toBeNull();
    expect(screen.queryByText(/taxa/i)).toBeNull();
    await act(async () => { fireEvent.press(screen.getByText("Conectar com Mercado Pago")); });
    expect(mockHook.iniciarConexao).toHaveBeenCalledWith(expect.objectContaining({ sandbox: false }));
  });

  test("equipe Aura vê o modo de testes", async () => {
    mockSessao = { isStaff: true, company: { id: "c1" } };
    mockHook = hook();
    render(<MpGatewayCard />);
    await act(async () => { fireEvent.press(screen.getByText("Equipe Aura: conectar em modo de testes")); });
    expect(mockHook.iniciarConexao).toHaveBeenCalledWith(expect.objectContaining({ sandbox: true }));
  });

  test("funcionário não vê o botão", () => {
    mockHook = hook({ podeConectar: false });
    render(<MpGatewayCard />);
    expect(screen.queryByText("Conectar com Mercado Pago")).toBeNull();
    expect(screen.getByText("Só o dono da conta conecta o Mercado Pago.")).toBeTruthy();
  });

  test("conectado como <nome>; desconectar pede confirmação e avisa pedidos em andamento", async () => {
    mockHook = hook({ mpGateway: CONECTADO, pedidosEmAndamento: 2 });
    render(<MpGatewayCard />);
    expect(screen.getByText("Conectado como LOJA TESTE")).toBeTruthy();
    expect(screen.getByText("Renova sozinha. Você não precisa fazer nada.")).toBeTruthy();
    fireEvent.press(screen.getByText("Desconectar"));
    expect(screen.getByText("Desconectar o Mercado Pago?")).toBeTruthy();
    expect(screen.getByText(/2 pedidos com pagamento em andamento/)).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getAllByText("Desconectar").slice(-1)[0]); });
    expect(mockHook.removeGateway).toHaveBeenCalledWith("mercadopago");
  });

  test("conexão caiu: pede para reconectar", () => {
    mockHook = hook({ mpGateway: { ...CONECTADO, connection_status: "caiu" } });
    render(<MpGatewayCard />);
    expect(screen.getByText("A conexão com o Mercado Pago caiu. Sua loja não está aceitando cartão agora.")).toBeTruthy();
    expect(screen.getByText("Reconectar")).toBeTruthy();
  });

  test("volta com negado: tom neutro e botão de novo", () => {
    mockParams = { mp: "negado" };
    mockHook = hook();
    render(<MpGatewayCard />);
    expect(screen.getByText(/nada foi alterado/)).toBeTruthy();
    expect(screen.getByText("Conectar com Mercado Pago")).toBeTruthy();
  });

  test("volta com erro: mensagem gentil e tentar de novo", () => {
    mockParams = { mp: "erro" };
    mockHook = hook();
    render(<MpGatewayCard />);
    expect(screen.getByText(/Nada mudou na sua conta do Mercado Pago/)).toBeTruthy();
    expect(screen.getByText("Tentar de novo")).toBeTruthy();
  });

  test("volta conectada com cartão desligado: confirma e pergunta se liga o cartão", async () => {
    mockParams = { mp: "conectado" };
    const onLigarCartao = jest.fn().mockResolvedValue(undefined);
    mockHook = hook({
      mpGateway: CONECTADO,
      refetch: jest.fn().mockResolvedValue({ data: { gateways: [CONECTADO] } }),
    });
    render(<MpGatewayCard cartaoLigado={false} onLigarCartao={onLigarCartao} />);
    await act(async () => {});
    expect(mockToast.success).toHaveBeenCalledWith("Mercado Pago conectado.");
    await act(async () => { fireEvent.press(screen.getByText("Ligar o cartão")); });
    expect(onLigarCartao).toHaveBeenCalled();
  });
});
