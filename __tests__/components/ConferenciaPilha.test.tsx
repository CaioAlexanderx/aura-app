// ============================================================
// p-108 (QA em produção, 11/11): fundo da pilha da conferência.
//
// Cada tela da pilha (expo-router Stack = native-stack) fica num contêiner
// absoluto pintado com o `colors.background` do tema do React Navigation —
// o padrão é rgb(242,242,242). As telas de começar e contar, com raiz
// transparente, apareciam cinza e o título claro sumia. A pilha agora usa o
// fundo do app: transparente na web (aparece o fundo das abas, nos dois
// temas) e Colors.bg no app nativo. As quatro telas ficam iguais.
//
// Mocks do padrão do repo (expo-font, expo-secure-store, fontes, FpktLogo);
// testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@expo-google-fonts/dm-sans", () => ({}), { virtual: true });
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

// A pilha vira um componente que mostra o fundo do tema que ela enxerga e o
// contentStyle que recebeu (é o que o native-stack usa para pintar a tela).
jest.mock("expo-router", () => {
  const R = jest.requireActual("react");
  const { useTheme } = jest.requireActual("@react-navigation/native");
  function Stack(p: any) {
    const tema = useTheme();
    return R.createElement("Pilha", {
      testID: "pilha",
      fundoDoTema: tema.colors.background,
      contentStyle: p.screenOptions && p.screenOptions.contentStyle,
      telas: R.Children.toArray(p.children).map((c: any) => c.props.name),
    });
  }
  Stack.Screen = (p: any) => R.createElement("Tela", p);
  return { Stack };
});

import { DefaultTheme, DarkTheme, ThemeProvider } from "@react-navigation/native";
import ConferenciaEstoqueLayout from "@/app/(tabs)/conferencia-estoque/_layout";
import { ce } from "@/components/screens/conferencia/estilos";
import { ui } from "@/components/screens/conferencia/diferencas/ui";

function montar(tema: any) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ThemeProvider value={tema}>
        <ConferenciaEstoqueLayout />
      </ThemeProvider>,
    );
  });
  return tree.root.findAll((n) => n.props && n.props.testID === "pilha", { deep: false })[0];
}

describe("fundo da pilha da conferência", () => {
  it("web: nunca o cinza padrão do React Navigation; transparente como o resto do app", () => {
    expect(DefaultTheme.colors.background).toBe("rgb(242, 242, 242)");
    const pilha = montar(DefaultTheme);
    expect(pilha.props.fundoDoTema).toBe("transparent");
    expect(pilha.props.contentStyle).toEqual({ backgroundColor: "transparent" });
    expect(pilha.props.telas).toEqual(["index", "[id]/index", "[id]/diferencas", "historico"]);
  });

  it("tema escuro do navegador também não vaza", () => {
    const pilha = montar(DarkTheme);
    expect(pilha.props.fundoDoTema).toBe("transparent");
  });

  it("as quatro telas têm a raiz igual: transparente, o fundo vem da pilha", () => {
    expect(ce.tela.backgroundColor).toBe("transparent");
    expect(ui.tela.backgroundColor).toBe("transparent");
  });

  it("app nativo: Colors.bg do tema atual (claro ou escuro)", () => {
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({
        ...jest.requireActual("react-native-web"),
        Platform: { OS: "ios", select: (o: any) => o.ios ?? o.default },
      }));
      const { fundoDaPilhaDaConferencia } = require("@/components/screens/conferencia/estilos");
      const { Colors } = require("@/constants/colors");
      expect(fundoDaPilhaDaConferencia()).toBe(Colors.bg);
      expect(fundoDaPilhaDaConferencia()).not.toBe(DefaultTheme.colors.background);
    });
  });
});
