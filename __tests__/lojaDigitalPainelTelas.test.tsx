// ============================================================
// Loja Digital do Studio · QA do painel (26/09/2026) — testes de TELA
//
// O que só se vê montando a tela: a troca de aba com push e a pergunta
// antes de descartar edição, a confirmação de "sem retirada nem
// entrega", o campo da cor que não salva "#12" e a temporada fechada
// pela data limite (as duas últimas em lojaDigitalPainelAbas.test.tsx:
// aqui as abas são dublês).
// ============================================================
import React from "react";
import { render, screen, fireEvent, configure } from "@testing-library/react-native";

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

let mockSessao: any = { company: { id: "c1", name: "Sheid" }, consolidatedView: false };
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockSessao) : mockSessao),
}));

// ── Página: roteador e abas trocados por dublês ──────────
const mockPush = jest.fn();
let mockParams: any = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, setParams: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn() },
}));
jest.mock("@/hooks/useDigitalChannel", () => ({
  useDigitalChannel: () => ({
    config: { exists: true, is_published: false, slug: "sheid" }, isLoading: false,
    saveConfig: jest.fn(), isSaving: false, requestDomain: jest.fn(), isRequestingDomain: false,
    uploadImage: jest.fn(), isUploadingImage: false, deleteImage: jest.fn(), setupPix: jest.fn(), isSettingUpPix: false,
  }),
}));
jest.mock("@/components/studio/StudioScreen", () => ({ StudioScreen: ({ children }: any) => children }));
jest.mock("@/components/studio/StudioPageHeader", () => ({ StudioPageHeader: () => null }));
jest.mock("@/components/studio/StudioGradient", () => ({ StudioGradient: ({ children }: any) => children ?? null }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: () => null }));
// Meu Site dublê: um botão que "edita" e avisa pelo contrato.
jest.mock("@/components/screens/canal/TabMeuSite", () => {
  const { Pressable: P, Text: T } = require("react-native");
  return {
    TabMeuSite: ({ onAlteracoes }: any) => (
      <P onPress={() => onAlteracoes?.(true)}><T>editar meu site</T></P>
    ),
  };
});
jest.mock("@/components/screens/canal/TabDesign", () => ({ TabDesign: () => null }));
jest.mock("@/components/screens/canal/TabEntrega", () => ({ TabEntrega: () => null }));
jest.mock("@/components/screens/studio-loja-digital/TabStudioConfigurador", () => ({ TabStudioConfigurador: () => null }));
jest.mock("@/components/screens/studio-loja-digital/TabStudioAparencia", () => ({ TabStudioAparencia: () => null }));
jest.mock("@/components/screens/studio-loja-digital/TabStudioGaleria", () => ({ TabStudioGaleria: () => null }));
jest.mock("@/components/screens/studio-loja-digital/TabStudioRevisoes", () => ({ TabStudioRevisoes: () => null }));
jest.mock("@/components/screens/studio-loja-digital/TabStudioMarketplaces", () => ({ TabStudioMarketplaces: () => null }));
jest.mock("@/components/screens/studio-loja-digital/TabStudioPedidos", () => ({ TabStudioPedidos: () => null }));
jest.mock("@/components/screens/studio-loja-digital/TabStudioPedidosPelaLoja", () => ({ TabStudioPedidosPelaLoja: () => null }));

import LojaDigital from "@/app/studio/(estudio)/vendas/loja-digital";
import { SeletorDeCor, ERRO_DA_COR } from "@/components/screens/canal/SeletorDeCor";

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);

beforeEach(() => {
  mockPush.mockClear();
  mockParams = {};
  mockSessao = { company: { id: "c1", name: "Sheid" }, consolidatedView: false };
});

describe("página: troca de aba", () => {
  test("?tab= desconhecido abre Meu Site; trocar de aba faz PUSH (o voltar funciona)", () => {
    mockParams = { tab: "xyz" };
    render(<LojaDigital />);
    expect(naTela("editar meu site")).toBe(true);
    fireEvent.press(screen.getByText("Design"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/studio/vendas/loja-digital", params: { tab: "design" } });
  });

  test("com alteração não salva, pergunta; 'Ficar' fica e 'Sair sem salvar' troca", () => {
    render(<LojaDigital />);
    fireEvent.press(screen.getByText("editar meu site"));
    fireEvent.press(screen.getByText("Entrega"));
    expect(mockPush).not.toHaveBeenCalled();
    expect(naTela("Você tem alterações não salvas. Sair sem salvar?")).toBe(true);

    fireEvent.press(screen.getByText("Ficar"));
    expect(naTela("Você tem alterações não salvas")).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Entrega"));
    fireEvent.press(screen.getByText("Sair sem salvar"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/studio/vendas/loja-digital", params: { tab: "delivery" } });
  });
});

describe("Design: campo da cor", () => {
  test("'#12' não salva e mostra o aviso ao sair do campo", () => {
    const onMudar = jest.fn();
    render(<SeletorDeCor valor="#1e3a8a" onMudar={onMudar} />);
    const campo = screen.getByLabelText("Código da cor");
    fireEvent.changeText(campo, "#12");
    fireEvent(campo, "blur", { nativeEvent: {}, target: { value: "" } });
    expect(onMudar).not.toHaveBeenCalled();
    expect(naTela(ERRO_DA_COR)).toBe(true);
  });

  test("cor completa salva; #abc expande ao sair", () => {
    const onMudar = jest.fn();
    render(<SeletorDeCor valor="#1e3a8a" onMudar={onMudar} />);
    const campo = screen.getByLabelText("Código da cor");
    fireEvent.changeText(campo, "#EC4899");
    expect(onMudar).toHaveBeenLastCalledWith("#ec4899");
    fireEvent.changeText(campo, "#abc");
    fireEvent(campo, "blur", { nativeEvent: {}, target: { value: "" } });
    expect(onMudar).toHaveBeenLastCalledWith("#aabbcc");
  });

  test("sem config: esqueleto no lugar do #7c3aed", () => {
    render(<SeletorDeCor valor="" onMudar={jest.fn()} carregando />);
    expect(naTela("cor-carregando")).toBe(true);
    expect(naTela("#7c3aed")).toBe(false);
  });
});
