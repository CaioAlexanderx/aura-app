// ============================================================
// ScreenTabs — `quebraNoCelular` (Venda condicional, C4, 25/11/2026)
//
// Mockup aprovado: com 5 abas em Vendas, abaixo de 700 px as pílulas quebram
// em linhas em vez de rolar de lado (sem rolagem em 375 e 320), com alvo de
// 44 px e texto de 13 px (R17). A prop é opcional: sem ela (todas as outras
// telas) o ScreenTabs continua um ScrollView horizontal em qualquer largura.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { ScrollView, StyleSheet } from "react-native";

let mockLargura = 375;
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("react-native", () => {
  const real = jest.requireActual("react-native");
  return { ...real, useWindowDimensions: () => ({ width: mockLargura, height: 900, scale: 1, fontScale: 1 }) };
});

import { ScreenTabs, LARGURA_QUEBRA_DAS_ABAS } from "@/components/ScreenHero";

const CINCO = [
  { key: "vendas", label: "Vendas", testID: "t-vendas" },
  { key: "condicionais", label: "Condicionais", testID: "t-condicionais" },
  { key: "pedidos", label: "Pedidos", testID: "t-pedidos" },
  { key: "ranking", label: "Ranking", testID: "t-ranking" },
  { key: "fechamentos", label: "Fechamentos de caixa", testID: "t-fechamentos" },
];

async function montar(quebra: boolean | undefined) {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<ScreenTabs tabs={CINCO} active="condicionais" onSelect={jest.fn()} quebraNoCelular={quebra} />);
  });
  return tree;
}

function caixaDeQuebra(tree: any) {
  return tree.root.findAllByProps({ testID: "screen-tabs-quebra" }, { deep: false });
}

describe("ScreenTabs — quebra em linhas no celular", () => {
  it("o limite é 700 px", () => {
    expect(LARGURA_QUEBRA_DAS_ABAS).toBe(700);
  });

  it.each([375, 320, 699])("com a prop, em %i px: linhas que quebram, sem ScrollView, alvo ≥ 44 e texto ≥ 12", async (w) => {
    mockLargura = w;
    const tree = await montar(true);
    expect(tree.root.findAllByType(ScrollView).length).toBe(0);
    const caixa = caixaDeQuebra(tree);
    expect(caixa.length).toBe(1);
    const st = StyleSheet.flatten(caixa[0].props.style);
    expect(st.flexDirection).toBe("row");
    expect(st.flexWrap).toBe("wrap");
    for (const t of CINCO) {
      const aba = tree.root.findAllByProps({ testID: t.testID }, { deep: false })[0];
      const estilo = StyleSheet.flatten(aba.props.style);
      expect(estilo.minHeight).toBeGreaterThanOrEqual(44);
    }
    const tamanhos = tree.root.findAll((n: any) => n.props?.style && typeof n.props.children === "string")
      .map((n: any) => StyleSheet.flatten(n.props.style).fontSize)
      .filter((f: any) => typeof f === "number");
    expect(tamanhos.length).toBeGreaterThan(0);
    tamanhos.forEach((f: number) => expect(f).toBeGreaterThanOrEqual(12));
    tree.unmount();
  });

  it("com a prop, em 700 px ou mais: rola de lado como hoje", async () => {
    mockLargura = 700;
    const tree = await montar(true);
    expect(tree.root.findAllByType(ScrollView).length).toBe(1);
    expect(caixaDeQuebra(tree).length).toBe(0);
    tree.unmount();
  });

  it("sem a prop (as outras telas), em 320 px: continua rolando de lado", async () => {
    mockLargura = 320;
    const tree = await montar(undefined);
    expect(tree.root.findAllByType(ScrollView).length).toBe(1);
    expect(caixaDeQuebra(tree).length).toBe(0);
    const aba = tree.root.findAllByProps({ testID: "t-vendas" }, { deep: false })[0];
    expect(StyleSheet.flatten(aba.props.style).minHeight).toBeUndefined();
    tree.unmount();
  });
});
