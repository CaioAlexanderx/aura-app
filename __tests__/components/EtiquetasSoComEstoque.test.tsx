// ============================================================
// Etiquetas — "Só com estoque" e as variantes (30/10/2026, card p-71).
//
// · variante sem estoque nunca vem marcada (interruptor ligado);
// · marcar na mão começa com 1 etiqueta;
// · variante com estoque mantém a quantidade de hoje (o estoque), e a
//   exceção do Matcon (unidade fracionada começa em 1) continua.
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1", name: "Loja" }, token: "t" }) }));
const mockVariants = jest.fn();
jest.mock("@/services/api", () => ({
  companiesApi: { variants: (...a: any[]) => mockVariants(...a) },
  pdvSettingsApi: { get: jest.fn(() => Promise.resolve({})), save: jest.fn(() => Promise.resolve({})), saveLabelConfig: jest.fn(() => Promise.resolve({})) },
}));
let mockSettings: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockSettings, isLoading: false, error: null, invalidate: jest.fn() }) }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));

import { PrintLabels } from "@/components/PrintLabels";

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

const VESTIDO: any = { id: "p1", name: "Vestido midi", code: "10020", barcode: "7891033948208", category: "Vestidos", price: 189.9, stock: 8, unit: "un", size: "", color: "", has_variants: true };
const VARIANTES = [
  { id: "v1", product_id: "p1", stock_qty: "3", is_active: true, barcode: "", attributes: [{ attribute: "Tamanho", value: "P" }] },
  { id: "v2", product_id: "p1", stock_qty: "0", is_active: true, barcode: "", attributes: [{ attribute: "Tamanho", value: "G" }] },
  { id: "v3", product_id: "p1", stock_qty: "5", is_active: true, barcode: "", attributes: [{ attribute: "Tamanho", value: "M" }] },
];

function Tela({ products }: { products: any[] }) {
  const [sel, setSel] = useState<string[]>([]);
  return <PrintLabels products={products} selectedIds={sel} onSelectionChange={setSel} />;
}

const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
// Total da barra fixa ("8 etiquetas").
const totalImpresso = (t: renderer.ReactTestRenderer) => parseInt(flatten(acha(t, "etiquetas-total")[0]), 10);
async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

beforeEach(() => {
  window.localStorage.clear();
  mockSettings = {};
  mockVariants.mockReset();
  mockVariants.mockImplementation(() => Promise.resolve({ variants: VARIANTES }));
});

test("marcar o produto não marca a variante sem estoque; as outras ficam com o estoque", async () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[VESTIDO]} />); });
  act(() => { acha(t, "etiquetas-marcar-p1")[0].props.onPress(); });
  await flush();
  expect(mockVariants).toHaveBeenCalledWith("empresa-1", "p1");
  // P (3) + M (5); G sem estoque fica de fora.
  expect(totalImpresso(t)).toBe(8);
  expect(flatten(t.toJSON())).toContain("2 marcadas");

  // p-72: com o interruptor ligado a G (sem estoque) nem aparece; a lista avisa.
  expect(acha(t, "etiquetas-variante-v2")).toHaveLength(0);
  expect(flatten(t.toJSON())).toContain("1 variante sem estoque não aparece");
  // Desligado, ela aparece desmarcada; marcar na mão começa com 1.
  act(() => { acha(t, "etiquetas-com-estoque")[0].props.onPress(); });
  expect(totalImpresso(t)).toBe(8);
  const g = acha(t, "etiquetas-variante-v2")[0];
  act(() => { g.props.onPress(); });
  expect(totalImpresso(t)).toBe(9);
  t.unmount();
});

test("interruptor desligado: marcar o produto marca todas, a sem estoque com 1", async () => {
  window.localStorage.setItem("aura:etiquetas:so-com-estoque", "0");
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[VESTIDO]} />); });
  act(() => { acha(t, "etiquetas-marcar-todos")[0].props.onPress(); });
  await flush();
  expect(totalImpresso(t)).toBe(9);
  t.unmount();
});

test("desmarcar e marcar de novo volta ao padrão (antes ficava sem nenhuma variante)", async () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[VESTIDO]} />); });
  act(() => { acha(t, "etiquetas-marcar-todos")[0].props.onPress(); });
  await flush();
  expect(totalImpresso(t)).toBe(8);
  act(() => { acha(t, "etiquetas-marcar-todos")[0].props.onPress(); });
  expect(totalImpresso(t)).toBe(0);
  act(() => { acha(t, "etiquetas-marcar-todos")[0].props.onPress(); });
  await flush();
  expect(totalImpresso(t)).toBe(8);
  expect(mockVariants).toHaveBeenCalledTimes(1);
  t.unmount();
});

test("Matcon: unidade fracionada continua começando em 1", async () => {
  mockSettings = { matcon_enabled: true };
  const piso = { ...VESTIDO, id: "p2", name: "Piso", unit: "m²" };
  mockVariants.mockImplementation(() => Promise.resolve({ variants: [{ id: "w1", product_id: "p2", stock_qty: "110", is_active: true, attributes: [] }] }));
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[piso]} />); });
  act(() => { acha(t, "etiquetas-marcar-todos")[0].props.onPress(); });
  await flush();
  expect(totalImpresso(t)).toBe(1);
  t.unmount();
});
