// ============================================================
// Etiquetas — ver variantes sem marcar, lote de variantes e barra fixa
// (30/10/2026, card p-72).
//
// · "Ver variantes" abre o produto sem marcar e mostra o estoque de cada uma;
// · variantes da lista visível chegam numa chamada (GET .../products/variants,
//   p-73); backend antigo (404) cai no caminho de uma chamada por produto,
//   no máximo 4 ao mesmo tempo;
// · "Marcar todos" marca só o que está na lista;
// · barra fixa com o total, "Ver no tamanho real" e Imprimir.
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React, { useState } from "react";
import renderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

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

const prod = (id: string, over: any = {}): any => ({ id, name: "Produto " + id, code: "C" + id, barcode: "7891033948208", category: "Roupas", price: 50, stock: 4, unit: "un", size: "", color: "", has_variants: true, ...over });
const vars = (pid: string): any[] => [
  { id: pid + "-p", product_id: pid, stock_qty: "3", is_active: true, attributes: [{ attribute: "Tamanho", value: "P" }] },
  { id: pid + "-g", product_id: pid, stock_qty: "0", is_active: true, attributes: [{ attribute: "Tamanho", value: "G" }] },
  { id: pid + "-m", product_id: pid, stock_qty: "1", is_active: true, attributes: [{ attribute: "Tamanho", value: "M" }] },
];

let onSel: jest.Mock;
function Tela({ products }: { products: any[] }) {
  const [sel, setSel] = useState<string[]>([]);
  return <PrintLabels products={products} selectedIds={sel} onSelectionChange={(ids) => { onSel(ids); setSel(ids); }} />;
}

const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const aperta = (t: renderer.ReactTestRenderer, id: string) => act(() => { acha(t, id)[0].props.onPress(); });
const total = (t: renderer.ReactTestRenderer) => parseInt(flatten(acha(t, "etiquetas-total")[0]), 10);
async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); }

function loteResponde() {
  mockRequest.mockImplementation((path: string) => {
    const ids = decodeURIComponent(path.split("product_ids=")[1] || "").split(",");
    const m: any = {};
    ids.forEach((id) => { m[id] = vars(id); });
    return Promise.resolve({ variants_by_product: m });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  onSel = jest.fn();
  mockVariants.mockReset();
  mockRequest.mockReset();
  mockVariants.mockImplementation((_cid: string, pid: string) => Promise.resolve({ variants: vars(pid) }));
});

test("variantes da lista visível chegam numa chamada só (lote, p-73)", async () => {
  loteResponde();
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[prod("a"), prod("b"), prod("c", { has_variants: false })]} />); });
  await flush();
  expect(mockRequest).toHaveBeenCalledTimes(1);
  const [path, opts] = mockRequest.mock.calls[0];
  expect(path).toBe("/companies/empresa-1/products/variants?product_ids=a,b");
  expect(opts).toEqual({ retry: 0 });
  expect(mockVariants).not.toHaveBeenCalled();
  // Já sabe quantas variantes cada um tem (com o interruptor, só as com estoque).
  expect(flatten(acha(t, "etiquetas-produto-a")[0])).toContain("2 variantes");
  t.unmount();
});

test("'Ver variantes' abre sem marcar e mostra o estoque de cada variante", async () => {
  loteResponde();
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[prod("a")]} />); });
  await flush();
  aperta(t, "etiquetas-ver-variantes-a");
  expect(acha(t, "etiquetas-variantes-a")).toHaveLength(1);
  expect(flatten(acha(t, "etiquetas-estoque-variante-a-p")[0])).toBe("3 em estoque");
  expect(flatten(acha(t, "etiquetas-estoque-variante-a-m")[0])).toBe("1 em estoque");
  expect(onSel).not.toHaveBeenCalled();
  expect(total(t)).toBe(0);
  expect(flatten(acha(t, "etiquetas-barra")[0])).toContain("Marque os produtos que quer imprimir");
  expect(flatten(acha(t, "etiquetas-ver-variantes-a")[0])).toBe("Fechar");

  // Marcar uma variante na mão marca o produto; desmarcar a última desmarca.
  aperta(t, "etiquetas-variante-a-m");
  expect(onSel).toHaveBeenLastCalledWith(["a"]);
  expect(total(t)).toBe(1);
  aperta(t, "etiquetas-variante-a-m");
  expect(onSel).toHaveBeenLastCalledWith([]);
  expect(total(t)).toBe(0);
  t.unmount();
});

test("o quadradinho do produto marca as variantes visíveis e fica pela metade quando só parte está marcada", async () => {
  loteResponde();
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[prod("a")]} />); });
  await flush();
  aperta(t, "etiquetas-marcar-a");
  expect(total(t)).toBe(4); // P (3) + M (1)
  expect(acha(t, "etiquetas-marcar-a")[0].props.accessibilityState).toEqual({ checked: true });
  aperta(t, "etiquetas-variante-a-p");
  expect(acha(t, "etiquetas-marcar-a")[0].props.accessibilityState).toEqual({ checked: "mixed" });
  aperta(t, "etiquetas-marcar-a");
  expect(total(t)).toBe(0);
  t.unmount();
});

test("backend antigo (404): uma chamada por produto, no máximo 4 ao mesmo tempo", async () => {
  mockRequest.mockImplementation(() => Promise.reject(Object.assign(new Error("Não encontrado"), { status: 404 })));
  let emVoo = 0; let maximo = 0; const pendentes: Array<() => void> = [];
  mockVariants.mockImplementation((_cid: string, pid: string) => {
    emVoo++; maximo = Math.max(maximo, emVoo);
    return new Promise((resolve) => { pendentes.push(() => { emVoo--; resolve({ variants: vars(pid) }); }); });
  });
  const lista = ["a", "b", "c", "d", "e", "f", "g"].map((id) => prod(id));
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={lista} />); });
  await flush();
  // Sem lote, nada é buscado antes do toque.
  expect(mockVariants).not.toHaveBeenCalled();

  aperta(t, "etiquetas-marcar-todos");
  await flush();
  expect(mockVariants).toHaveBeenCalledTimes(4);
  while (pendentes.length) { await act(async () => { pendentes.shift()!(); await Promise.resolve(); }); await flush(); }
  expect(mockVariants).toHaveBeenCalledTimes(7);
  expect(maximo).toBeLessThanOrEqual(4);
  expect(total(t)).toBe(28); // 7 produtos × (3 + 1)
  // O lote não é tentado de novo nesta visita.
  expect(mockRequest).toHaveBeenCalledTimes(1);
  t.unmount();
});

test("'Marcar todos' marca só o que está na lista; marcado fora da lista continua no total", async () => {
  loteResponde();
  const lista = [prod("a"), prod("z", { stock: 0, has_variants: false, name: "Zerado" }), prod("s", { has_variants: false, name: "Saia", stock: 2 })];
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={lista} />); });
  await flush();
  aperta(t, "etiquetas-marcar-todos");
  expect(onSel).toHaveBeenLastCalledWith(["a", "s"]);
  expect(total(t)).toBe(6); // a: 3 + 1; saia: 2

  // Busca esconde a saia: ela continua marcada e no total, e a barra avisa.
  const busca = t.root.findAll((n) => n.props && n.props.placeholder === "Buscar por nome ou código", { deep: false })[0];
  act(() => { busca.props.onChangeText("Produto"); });
  expect(total(t)).toBe(6);
  expect(flatten(acha(t, "etiquetas-barra")[0])).toContain("2 produtos · 1 fora da lista");
  t.unmount();
});

test("barra: Imprimir e 'Ver no tamanho real' juntos; em tela estreita ocupam a largura toda", async () => {
  loteResponde();
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Tela products={[prod("s", { has_variants: false, stock: 2 })]} />); });
  aperta(t, "etiquetas-marcar-todos");
  const barra = acha(t, "etiquetas-barra")[0];
  expect(flatten(barra)).toContain("2 etiquetas");
  expect(flatten(acha(t, "etiquetas-imprimir")[0])).toBe("Imprimir 2 etiquetas");
  expect(flatten(acha(t, "etiquetas-ver-tamanho-real")[0])).toBe("Ver no tamanho real");
  // A barra é o último bloco da tela (fica presa embaixo enquanto a lista rola).
  const irmaos = barra.parent!.children.filter((c: any) => typeof c !== "string");
  expect(irmaos[irmaos.length - 1]).toBe(barra);
  const estilo = StyleSheet.flatten(barra.props.style);
  expect(estilo.position).toBe("sticky");
  expect(estilo.bottom).toBe(0);
  // jsdom não tem largura de tela: conta como estreita (375 px).
  expect(estilo.flexDirection).toBe("column");
  t.unmount();
});
