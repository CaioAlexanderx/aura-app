// ============================================================
// Canal Digital · Meu Site avisa antes de perder a edição (tq-49, 19/10/2026)
//
// Quem editava um campo e trocava de aba perdia o que digitou: a aba
// já avisava `onAlteracoes`, mas a tela nunca passava a prop. Agora, com
// alteração não salva, a troca pergunta: Salvar / Descartar / Continuar
// editando. Sem gravação automática.
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

let mockSessao: any = { company: { id: "c1", name: "Sheid", plan: "negocio" }, consolidatedView: false };
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockSessao) : mockSessao),
}));

let mockParams: any = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/hooks/useDigitalChannel", () => ({
  useDigitalChannel: () => ({
    config: { exists: true, is_published: false, slug: "sheid" }, isLoading: false,
    saveConfig: jest.fn(), isSaving: false, requestDomain: jest.fn(), isRequestingDomain: false,
    uploadImage: jest.fn(), isUploadingImage: false, deleteImage: jest.fn(), setupPix: jest.fn(), isSettingUpPix: false,
  }),
}));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: () => null }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));

// Meu Site dublê: "editar" avisa pelo contrato; a ref recebe o "handleSave".
const mockSalvar = jest.fn();
jest.mock("@/components/screens/canal/TabMeuSite", () => {
  const R = require("react");
  const { Pressable: P, Text: T } = require("react-native");
  return {
    TabMeuSite: ({ onAlteracoes, salvarRef }: any) => {
      R.useEffect(() => {
        if (salvarRef) salvarRef.current = mockSalvar;
        return () => { if (salvarRef) salvarRef.current = null; };
      });
      R.useEffect(() => () => onAlteracoes?.(false), [onAlteracoes]);
      return <P onPress={() => onAlteracoes?.(true)}><T>editar meu site</T></P>;
    },
  };
});
jest.mock("@/components/screens/canal/TabDesign", () => ({ TabDesign: () => { const { Text: T } = require("react-native"); return <T>conteudo design</T>; } }));
jest.mock("@/components/screens/canal/TabVitrine", () => ({ TabVitrine: () => null }));
jest.mock("@/components/screens/canal/TabEntrega", () => ({ TabEntrega: () => null }));
jest.mock("@/components/screens/canal/TabPedidos", () => ({
  TabPedidos: ({ orderIdInicial }: any) => { const { Text: T } = require("react-native"); return <T>{`conteudo pedidos ${orderIdInicial ?? ""}`}</T>; },
}));

import Canal from "@/app/(tabs)/canal";

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);
const PERGUNTA = "Você tem alterações não salvas em Meu Site. Salvar antes de sair?";

beforeEach(() => {
  mockParams = {};
  mockSalvar.mockReset();
  mockSessao = { company: { id: "c1", name: "Sheid", plan: "negocio" }, consolidatedView: false };
});

describe("Canal Digital: troca de aba com Meu Site editado", () => {
  test("sem alteração, troca direto e não pergunta", () => {
    render(<Canal />);
    fireEvent.press(screen.getByText("Design"));
    expect(naTela("conteudo design")).toBe(true);
    expect(naTela(PERGUNTA)).toBe(false);
  });

  test("editar e trocar de aba mostra a pergunta e ainda não troca", () => {
    render(<Canal />);
    fireEvent.press(screen.getByText("editar meu site"));
    fireEvent.press(screen.getByText("Design"));
    expect(naTela(PERGUNTA)).toBe(true);
    expect(naTela("conteudo design")).toBe(false);
    expect(naTela("Salvar")).toBe(true);
    expect(naTela("Descartar")).toBe(true);
    expect(naTela("Continuar editando")).toBe(true);
  });

  test("'Salvar' chama o save e troca de aba", async () => {
    mockSalvar.mockResolvedValue(true);
    render(<Canal />);
    fireEvent.press(screen.getByText("editar meu site"));
    fireEvent.press(screen.getByText("Design"));
    await act(async () => { fireEvent.press(screen.getByText("Salvar")); });
    expect(mockSalvar).toHaveBeenCalledTimes(1);
    expect(naTela("conteudo design")).toBe(true);
    expect(naTela(PERGUNTA)).toBe(false);
  });

  test("'Salvar' que falha não troca: a edição continua na tela", async () => {
    mockSalvar.mockResolvedValue(false);
    render(<Canal />);
    fireEvent.press(screen.getByText("editar meu site"));
    fireEvent.press(screen.getByText("Design"));
    await act(async () => { fireEvent.press(screen.getByText("Salvar")); });
    expect(mockSalvar).toHaveBeenCalledTimes(1);
    expect(naTela("conteudo design")).toBe(false);
    expect(naTela("editar meu site")).toBe(true);
    expect(naTela(PERGUNTA)).toBe(false);
  });

  test("'Descartar' troca sem salvar", () => {
    render(<Canal />);
    fireEvent.press(screen.getByText("editar meu site"));
    fireEvent.press(screen.getByText("Design"));
    fireEvent.press(screen.getByText("Descartar"));
    expect(mockSalvar).not.toHaveBeenCalled();
    expect(naTela("conteudo design")).toBe(true);
    expect(naTela(PERGUNTA)).toBe(false);
  });

  test("'Continuar editando' fica em Meu Site, sem salvar", () => {
    render(<Canal />);
    fireEvent.press(screen.getByText("editar meu site"));
    fireEvent.press(screen.getByText("Design"));
    fireEvent.press(screen.getByText("Continuar editando"));
    expect(mockSalvar).not.toHaveBeenCalled();
    expect(naTela("conteudo design")).toBe(false);
    expect(naTela("editar meu site")).toBe(true);
    expect(naTela(PERGUNTA)).toBe(false);
  });

  test("depois de descartar, a próxima troca não pergunta de novo", () => {
    render(<Canal />);
    fireEvent.press(screen.getByText("editar meu site"));
    fireEvent.press(screen.getByText("Design"));
    fireEvent.press(screen.getByText("Descartar"));
    fireEvent.press(screen.getByText("Pedidos"));
    expect(naTela(PERGUNTA)).toBe(false);
    expect(naTela("conteudo pedidos")).toBe(true);
  });
});

describe("Canal Digital: links diretos (?tab=&order_id=)", () => {
  test("?tab=pedidos&order_id= abre Pedidos com o pedido, sem perguntar", () => {
    mockParams = { tab: "pedidos", order_id: "o-9" };
    render(<Canal />);
    expect(naTela("conteudo pedidos o-9")).toBe(true);
    expect(naTela(PERGUNTA)).toBe(false);
  });

  test("link com a tela aberta e sem alteração troca direto", () => {
    const { rerender } = render(<Canal />);
    expect(naTela("editar meu site")).toBe(true);
    mockParams = { tab: "pedidos", order_id: "o-7" };
    rerender(<Canal />);
    expect(naTela("conteudo pedidos o-7")).toBe(true);
  });

  test("link com a tela aberta e Meu Site editado pergunta antes de trocar", () => {
    const { rerender } = render(<Canal />);
    fireEvent.press(screen.getByText("editar meu site"));
    mockParams = { tab: "pedidos", order_id: "o-7" };
    rerender(<Canal />);
    expect(naTela(PERGUNTA)).toBe(true);
    expect(naTela("conteudo pedidos")).toBe(false);
    fireEvent.press(screen.getByText("Descartar"));
    expect(naTela("conteudo pedidos o-7")).toBe(true);
  });
});
