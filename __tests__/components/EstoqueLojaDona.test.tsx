// ============================================================
// INC-2026-11-18-01 — Estoque: selo da loja dona na linha e filtro "Loja".
// Sem o nome da loja (fora de grupo), a linha fica como sempre.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn(), companiesApi: { variants: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "c1" } }) }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn(() => ({ data: undefined, isLoading: false })) }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: "ProductImageUpload" }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { FiltroDeLoja } from "@/components/screens/estoque/FiltroDeLoja";
import { contextoDeLojas } from "@/utils/lojaDona";

const P: any = { id: "p1", name: "Capa", code: "C1", barcode: "", category: "Capas", price: 35, cost: 5.5, stock: 4, minStock: 0, unit: "un", notes: "", color: "", size: "" };
const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const selo = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id && typeof n.props.accessibilityLabel === "string", { deep: false });

test("linha sem loja (fora de grupo): sem selo", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<ProductRow product={P} />); });
  expect(selo(t, "estoque-loja-do-p1")).toHaveLength(0);
  t.unmount();
});

test("linha com a loja dona: selo com o nome", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<ProductRow product={P} nomeDaLoja="Loja Matriz" />); });
  expect(selo(t, "estoque-loja-do-p1")[0].props.accessibilityLabel).toBe("Loja: Loja Matriz");
  t.unmount();
});

test("filtro: Todas as lojas + uma opção por loja; tocar escolhe", () => {
  const ctx = contextoDeLojas(
    [{ id: "f", trade_name: "Loja Filial" }, { id: "m", trade_name: "Loja Matriz" }], "f", ["f", "m"],
  )!;
  const onChange = jest.fn();
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<FiltroDeLoja ctx={ctx} value="todas" onChange={onChange} testIDBase="estoque" />); });
  expect(acha(t, "estoque-loja-todas")[0].props.accessibilityState.selected).toBe(true);
  expect(acha(t, "estoque-loja-f")).toHaveLength(1);
  act(() => { acha(t, "estoque-loja-m")[0].props.onPress(); });
  expect(onChange).toHaveBeenCalledWith("m");
  t.unmount();
});
