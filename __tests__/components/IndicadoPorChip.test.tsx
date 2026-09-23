// ============================================================
// Chip "Indicado por" do Caixa (components/matcon/IndicadoPorChip.tsx) —
// QA 23/09/2026: preenchido, era um bloco de duas linhas dentro da barra
// de chips e desalinhava Cliente/Vendedora/Cupom. Agora o chip tem 40 px
// (a altura do ActPerson) e a frase dos pontos é <IndicadoPorPontos>, que
// o Caixa põe numa linha abaixo da barra.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: () => null }));
jest.mock("@/components/QuickCustomerModal", () => ({ QuickCustomerModal: () => null }));
jest.mock("@/components/matcon/MarcarProfissionalModal", () => ({ MarcarProfissionalModal: () => null }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import { IndicadoPorChip, IndicadoPorPontos } from "@/components/matcon/IndicadoPorChip";

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

function referral(referred: any) {
  return {
    active: true, referred, select: jest.fn(), clear: jest.fn(),
    search: jest.fn(), results: [], searching: false, searchError: false,
    pontosPrevistos: (t: number) => Math.floor(t / 100) * 10,
  } as any;
}

const ABBEY = { id: "pro-1", customer_id: "c1", customer_name: "Abbey", trade: "pedreiro", points_balance: 0 };

function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}

test("preenchido: uma linha só, 'Indicado por Abbey · pedreiro', 40 px como os outros chips", () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<IndicadoPorChip referral={referral(ABBEY)} saleTotal={100} matconOn />); });
  const chip = porTestID(tree, "indicadopor-chip");
  expect(chip.length).toBe(1);
  expect(flatten(chip[0].children)).toContain("Indicado por Abbey · pedreiro");
  expect(flatten(chip[0].children)).not.toContain("Indicado por:");
  expect(StyleSheet.flatten(chip[0].props.style).height).toBe(40);
  // A frase dos pontos NÃO mora mais no chip.
  expect(porTestID(tree, "indicadopor-pontos").length).toBe(0);
  tree.unmount();
});

test("IndicadoPorPontos: a frase numa linha, só com profissional e pontos", () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<IndicadoPorPontos referral={referral(ABBEY)} saleTotal={100} matconOn />); });
  expect(flatten(tree.toJSON())).toContain("Abbey ganha 10 pontos");
  act(() => { tree.update(<IndicadoPorPontos referral={referral(null)} saleTotal={100} matconOn />); });
  expect(tree.toJSON()).toBeNull();
  act(() => { tree.update(<IndicadoPorPontos referral={referral(ABBEY)} saleTotal={50} matconOn />); });
  expect(tree.toJSON()).toBeNull();
  tree.unmount();
});
