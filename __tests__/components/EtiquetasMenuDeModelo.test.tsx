// ============================================================
// Etiquetas — menu "Modelo" aberto por baixo da barra de busca (25/09/2026).
//
// No web o RNW dá a cada View o seu próprio z-index: 0. O zIndex 30 do
// menu de modelo só valia dentro do cabeçalho; a busca e o "Selecionar
// todos" (fundo translúcido), que vêm depois, eram pintados por cima da
// lista aberta e a segunda opção ficava ilegível.
//
// Trava: o cabeçalho que contém o menu fica ACIMA dos blocos seguintes, e
// o menu aberto lista todos os modelos.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1", name: "Loja" }, token: "t" }) }));
jest.mock("@/services/api", () => ({ companiesApi: {}, pdvSettingsApi: { get: jest.fn(() => Promise.resolve({})), save: jest.fn(() => Promise.resolve({})) } }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }) }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));

import { PrintLabels } from "@/components/PrintLabels";
import { LABEL_SIZE_KEYS, LABEL_SIZE_PRESETS } from "@/components/screens/estoque/labels/buildLabelHtml";

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

test("menu de modelo aberto fica acima da busca e do 'Selecionar todos'", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<PrintLabels products={[]} selectedIds={[]} onSelectionChange={() => {}} />); });

  const cabecalho = t.root.findAll((n) => n.props && n.props.testID === "etiquetas-cabecalho", { deep: false })[0];
  expect(cabecalho).toBeTruthy();
  const zCabecalho = Number(StyleSheet.flatten(cabecalho.props.style).zIndex) || 0;

  // Blocos que vêm DEPOIS do cabeçalho no mesmo container (loja, busca, lista).
  const container = cabecalho.parent!;
  const irmaos = container.children.filter((c: any) => typeof c !== "string" && c !== cabecalho) as renderer.ReactTestInstance[];
  expect(irmaos.length).toBeGreaterThan(0);
  irmaos.forEach((irmao) => {
    const z = Number(StyleSheet.flatten(irmao.props.style || {}).zIndex) || 0;
    expect(zCabecalho).toBeGreaterThan(z);
  });

  const botao = t.root.findAll((n) => n.props && typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Modelo de etiqueta:"), { deep: false })[0];
  act(() => { botao.props.onPress(); });
  const texto = flatten(t.toJSON());
  LABEL_SIZE_KEYS.forEach((k) => expect(texto).toContain(LABEL_SIZE_PRESETS[k].uiLabel));

  t.unmount();
});
