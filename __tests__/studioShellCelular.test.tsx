// ============================================================
// Studio no celular: a regra única do shell (QA de 05/10/2026)
//
// Em 375×812 o painel tinha duas linhas fixas de cabeçalho, a mesma ação
// em botão do cabeçalho E em flutuante (com rótulos diferentes), dois
// flutuantes empilhados em Pedidos e o flutuante por cima do Salvar da
// ficha do produto. O que estes testes seguram:
//   1. abaixo de 768 px há UM flutuante por tela;
//   2. a tela esconde o flutuante (ficha, modal, barra de salvar fixa) e
//      entrega a ação dele;
//   3. o cabeçalho do shell é UMA linha (logo, sino, Menu), sem atalhos;
//   4. o cabeçalho da página põe o título em uma linha e as ações embaixo;
//   5. no desktop nada muda.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import { create, act, type ReactTestRenderer } from "react-test-renderer";

(global as any).__DEV__ = false;

let mockLargura = 375;
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  const dims = () => ({ width: mockLargura, height: 812, scale: 1, fontScale: 1 });
  // O shell consulta "reduzir movimento" numa promise; aqui ela não resolve,
  // para não atualizar estado fora do act().
  const acessibilidade = {
    isReduceMotionEnabled: () => new Promise(() => {}),
    addEventListener: () => ({ remove() {} }),
  };
  return new Proxy(RN, {
    get: (alvo: any, k: string) =>
      k === "useWindowDimensions" ? dims : k === "AccessibilityInfo" ? acessibilidade : alvo[k],
  });
});

const mockPush = jest.fn();
let mockPathname = "/studio";
let mockTela: () => any = () => null;
jest.mock("expo-router", () => {
  const R = require("react");
  // Componente ESTÁVEL: um tipo novo a cada render remontaria a tela e
  // os efeitos dela (registrar/soltar o flutuante) entrariam em laço.
  const Tela = () => mockTela();
  const Slot = () => R.createElement(Tela, { key: mockPathname });
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    usePathname: () => mockPathname,
    Slot,
  };
});
jest.mock("react-native-reanimated", () => {
  const R = require("react");
  const View = ({ children }: any) => R.createElement(R.Fragment, null, children);
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: any) => v,
    Easing: { out: (f: any) => f, cubic: (x: any) => x },
  };
});
jest.mock("@/contexts/StudioThemeMode", () => {
  const { StudioColors } = jest.requireActual("@/constants/studio-tokens");
  return {
    useStudioTokens: () => StudioColors,
    useStudioTheme: () => ({ mode: "light", setMode: jest.fn() }),
  };
});
jest.mock("@/contexts/StudioAccentTheme", () => ({
  StudioAccentTheme: ({ children }: any) => children,
  studioDefaultAccent: {},
  deriveAccentFromColors: () => ({}),
}));
jest.mock("@/hooks/useDigitalChannel", () => ({ useDigitalChannel: () => ({ config: null }) }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: { name: "Caio" } }) }));

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/studio/AuraStudioMark", () => ({ AuraStudioLockup: () => null }));
jest.mock("@/components/NotificationBell", () => {
  const R = require("react");
  return { NotificationBell: (p: any) => R.createElement("stub-sino", p) };
});
jest.mock("@/components/studio/StudioFab", () => {
  const R = require("react");
  return { StudioFab: (p: any) => R.createElement("stub-fab", p) };
});
jest.mock("@/components/studio/FloatingApprovalButton", () => {
  const R = require("react");
  return { FloatingApprovalButton: () => R.createElement("stub-aprovar-arte") };
});
jest.mock("@/components/studio/StudioShell/Sidebar", () => ({ Sidebar: () => null }));
jest.mock("@/components/studio/StudioShell/Topbar", () => ({ Topbar: () => null }));
jest.mock("@/components/studio/StudioShell/MobileMenuSheet", () => ({ MobileMenuSheet: () => null }));
jest.mock("@/components/studio/StudioShell/MobileChip", () => {
  const R = require("react");
  return { MobileChip: (p: any) => R.createElement("stub-atalho", p) };
});

import { Text, StyleSheet } from "react-native";
import { StudioShell } from "@/components/studio/StudioShell";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { resolveFab } from "@/components/studio/StudioShell/fab";
import {
  useStudioFabHidden, useStudioFabAction, useStudioFabClearance,
} from "@/components/studio/StudioShell/fabControl";

// O controle do flutuante é estado de módulo: árvore de um teste que
// ficasse montada reagiria ao teste seguinte. Tudo é desmontado no fim.
const montados: ReactTestRenderer[] = [];
function montar(el: React.ReactElement): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => { r = create(el); });
  montados.push(r);
  return r;
}
afterEach(() => {
  act(() => { montados.splice(0).forEach((r) => r.unmount()); });
});
const quantos = (r: ReactTestRenderer, tipo: string) => r.root.findAll((n) => (n.type as any) === tipo).length;
const porTestID = (r: ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false });

beforeEach(() => {
  mockLargura = 375;
  mockPathname = "/studio";
  mockTela = () => null;
  mockPush.mockClear();
});

describe("um flutuante por tela", () => {
  test("cada lista tem um rótulo só, e ele não usa 'pra'", () => {
    expect(resolveFab("/studio")?.label).toBe("Novo produto");
    expect(resolveFab("/studio/estoque")?.label).toBe("Novo produto");
    expect(resolveFab("/studio/gestao/orcamentos")?.label).toBe("Novo orçamento");
    expect(resolveFab("/studio/pedidos")?.label).toBe("Novo pedido para evento");
    expect(resolveFab("/studio/pedidos/")?.accessibilityLabel).toBe("Criar novo pedido para evento");
  });

  test("ficha, detalhe e wizard não têm flutuante", () => {
    expect(resolveFab("/studio/pedidos/abc-123")).toBeNull();
    expect(resolveFab("/studio/pedidos/novo-evento")).toBeNull();
    expect(resolveFab("/studio/gestao/orcamentos/novo")).toBeNull();
    expect(resolveFab("/studio/producao")).toBeNull();
    expect(resolveFab("/studio/configuracoes")).toBeNull();
  });

  test("Pedidos no celular: só o flutuante da rota, sem o 'Aprovar arte' empilhado", () => {
    mockPathname = "/studio/pedidos";
    const r = montar(<StudioShell />);
    expect(quantos(r, "stub-fab")).toBe(1);
    expect(quantos(r, "stub-aprovar-arte")).toBe(0);
    expect(r.root.findByType("stub-fab" as any).props.label).toBe("Novo pedido para evento");
  });

  test("no desktop nada muda: sem flutuante da rota, 'Aprovar arte' continua montado", () => {
    mockLargura = 1280;
    mockPathname = "/studio/pedidos";
    const r = montar(<StudioShell />);
    expect(quantos(r, "stub-fab")).toBe(0);
    expect(quantos(r, "stub-aprovar-arte")).toBe(1);
  });
});

describe("a tela manda no flutuante", () => {
  test("some com a ficha aberta e volta quando ela fecha", () => {
    mockPathname = "/studio/estoque";
    let abrir!: (v: boolean) => void;
    mockTela = () => {
      const [ficha, setFicha] = React.useState(false);
      abrir = setFicha;
      useStudioFabHidden(ficha);
      return null;
    };
    const r = montar(<StudioShell />);
    expect(quantos(r, "stub-fab")).toBe(1);
    act(() => abrir(true));
    expect(quantos(r, "stub-fab")).toBe(0);
    act(() => abrir(false));
    expect(quantos(r, "stub-fab")).toBe(1);
  });

  test("a ação da tela vale no lugar do href; ao sair da tela volta o href", () => {
    mockPathname = "/studio/estoque";
    const acao = jest.fn();
    mockTela = () => { useStudioFabAction(acao); return null; };
    const r = montar(<StudioShell />);
    act(() => r.root.findByType("stub-fab" as any).props.onPress());
    expect(acao).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();

    mockTela = () => null;
    mockPathname = "/studio/pedidos";
    act(() => r.update(<StudioShell />));
    act(() => r.root.findByType("stub-fab" as any).props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/studio/pedidos/novo-evento");
  });

  test("o catálogo esconde o flutuante com a ficha (ou o cadastro) aberta e não repete o botão no cabeçalho", () => {
    const fonte = fs.readFileSync(path.join(__dirname, "..", "app", "studio", "(estudio)", "estoque.tsx"), "utf8");
    expect(fonte).toContain("useStudioFabHidden(!!expandedProduct || wizardOpen)");
    expect(fonte).toContain("useStudioFabAction(() => setWizardOpen(true))");
    expect(fonte).toMatch(/rightSlot=\{headerRight\}\s+mobileActions=\{null\}/);
  });

  test("a folga da rolagem só existe no celular e em rota com flutuante", () => {
    const folgas: number[] = [];
    const Sonda = () => { folgas.push(useStudioFabClearance()); return null; };
    mockPathname = "/studio/estoque"; montar(<Sonda />);
    mockPathname = "/studio/producao"; montar(<Sonda />);
    mockLargura = 1280; mockPathname = "/studio/estoque"; montar(<Sonda />);
    expect(folgas[0]).toBeGreaterThanOrEqual(80);
    expect(folgas.slice(1)).toEqual([0, 0]);
  });
});

describe("cabeçalho do shell", () => {
  test("celular: uma linha com logo, sino e Menu — sem atalhos", () => {
    const r = montar(<StudioShell />);
    const barra = porTestID(r, "studio-mobile-bar");
    expect(barra).toHaveLength(1);
    expect(StyleSheet.flatten(barra[0].props.style).flexDirection).toBe("row");
    expect(quantos(r, "stub-sino")).toBe(1);
    // O sino recebe a paleta do tema do Studio (não a do app).
    const { StudioColors } = jest.requireActual("@/constants/studio-tokens");
    expect(r.root.findByType("stub-sino" as any).props.colors.bg3).toBe(StudioColors.paperCard);
    expect(porTestID(r, "studio-mobile-menu")).toHaveLength(1);
    expect(quantos(r, "stub-atalho")).toBe(0);
  });

  test("tablet continua com os atalhos em linha", () => {
    mockLargura = 800;
    const r = montar(<StudioShell />);
    expect(porTestID(r, "studio-mobile-bar")).toHaveLength(0);
    expect(quantos(r, "stub-atalho")).toBeGreaterThan(4);
  });
});

describe("cabeçalho da página", () => {
  const acoes = <Text testID="acao-do-cabecalho">Atualizar</Text>;

  test("celular: título em uma linha e as ações numa linha própria, embaixo", () => {
    const r = montar(<StudioPageHeader eyebrow="FLUXO DE PRODUÇÃO" title="Fila de produção" subtitle="Use os botões." rightSlot={acoes} />);
    expect(porTestID(r, "studio-page-title")[0].props.numberOfLines).toBe(1);
    const linha = porTestID(r, "studio-page-actions");
    expect(linha).toHaveLength(1);
    expect(linha[0].findAllByProps({ testID: "acao-do-cabecalho" }, { deep: false })).toHaveLength(1);
    // O título não é irmão das ações numa linha: o contêiner empilha.
    const raiz = porTestID(r, "studio-page-header-mobile")[0];
    expect(StyleSheet.flatten(raiz.props.style).flexDirection).toBeUndefined();
  });

  test("celular: mobileActions={null} tira do cabeçalho a ação que já é do flutuante", () => {
    const r = montar(<StudioPageHeader eyebrow="X" title="Catálogo Studio" rightSlot={acoes} mobileActions={null} />);
    expect(porTestID(r, "studio-page-actions")).toHaveLength(0);
    expect(porTestID(r, "acao-do-cabecalho")).toHaveLength(0);
  });

  test("desktop: o rightSlot fica onde sempre esteve, mesmo com mobileActions", () => {
    mockLargura = 1280;
    const r = montar(<StudioPageHeader eyebrow="X" title="Catálogo Studio" rightSlot={acoes} mobileActions={null} />);
    expect(porTestID(r, "studio-page-header-mobile")).toHaveLength(0);
    expect(porTestID(r, "acao-do-cabecalho")).toHaveLength(1);
  });
});
