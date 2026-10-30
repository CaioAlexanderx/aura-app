// ============================================================
// Etiquetas — "Reimprimir etiquetas" do reajuste de preço em lote (p-53).
//
// O Estoque abre a aba com os produtos reajustados em selectedIds e os
// mesmos ids em `marcarAoAbrir`: cada um fica marcado como um toque faria
// (variantes com estoque marcadas, quantidade = estoque). Sem a prop, a
// aba se comporta como sempre.
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
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({
  request: (...a: any[]) => mockRequest(...a),
  companiesApi: { variants: (...a: any[]) => mockVariants(...a) },
  pdvSettingsApi: { get: jest.fn(() => Promise.resolve({})), save: jest.fn(() => Promise.resolve({})), saveLabelConfig: jest.fn(() => Promise.resolve({})) },
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }) }));
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

const prod = (id: string, over: any = {}): any => ({ id, name: "Produto " + id, code: "C" + id, barcode: "7891033948208", category: "Roupas", price: 50, stock: 4, unit: "un", size: "", color: "", has_variants: false, ...over });
const vars = (pid: string): any[] => [
  { id: pid + "-p", product_id: pid, stock_qty: "3", is_active: true, attributes: [{ attribute: "Tamanho", value: "P" }] },
  { id: pid + "-g", product_id: pid, stock_qty: "0", is_active: true, attributes: [{ attribute: "Tamanho", value: "G" }] },
  { id: pid + "-m", product_id: pid, stock_qty: "1", is_active: true, attributes: [{ attribute: "Tamanho", value: "M" }] },
];

function Tela({ products, inicial, marcar }: { products: any[]; inicial: string[]; marcar?: string[] }) {
  const [sel, setSel] = useState<string[]>(inicial);
  return <PrintLabels products={products} selectedIds={sel} onSelectionChange={setSel} marcarAoAbrir={marcar} />;
}

const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const total = (t: renderer.ReactTestRenderer) => parseInt(flatten(acha(t, "etiquetas-total")[0]), 10);
async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); }

beforeEach(() => {
  window.localStorage.clear();
  mockVariants.mockReset();
  mockRequest.mockReset();
  mockRequest.mockImplementation((path: string) => {
    const ids = decodeURIComponent(path.split("product_ids=")[1] || "").split(",");
    const m: any = {};
    ids.forEach((id) => { m[id] = vars(id); });
    return Promise.resolve({ variants_by_product: m });
  });
});

const PRODUTOS = [prod("a", { has_variants: true }), prod("b", { stock: 6 }), prod("c")];

test("os reajustados chegam marcados como um toque: variantes com estoque e quantidade = estoque", async () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={PRODUTOS} inicial={["a", "b"]} marcar={["a", "b"]} />); });
  await flush();
  // a: P (3) + M (1); b: estoque 6. c não foi reajustado: fica de fora.
  expect(total(t)).toBe(10);
  expect(acha(t, "etiquetas-marcar-a")[0].props.accessibilityState).toEqual({ checked: true });
  expect(acha(t, "etiquetas-marcar-c")[0].props.accessibilityState).toMatchObject({ checked: false });
  t.unmount();
});

test("sem marcarAoAbrir, a aba é a de sempre", async () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={PRODUTOS} inicial={["a", "b"]} />); });
  await flush();
  // Comportamento antigo: marcado de fora não ganha variantes nem quantidade.
  expect(total(t)).toBe(1);
  t.unmount();
});
