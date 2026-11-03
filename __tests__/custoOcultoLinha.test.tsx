// 03/11/2026 — custo oculto na linha do Estoque (ProductRow, prop semCusto).
// O detalhe de PRODUTO mostra Custo, Margem e Valor estoque; o de serviço,
// Preço, Custo e Margem. Com semCusto, nada de custo em nenhum dos dois.
jest.mock("@/services/api", () => ({ request: jest.fn(), companiesApi: { variants: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "c1" } }) }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn(() => ({ data: undefined, isLoading: false })) }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: "ProductImageUpload" }));

import React from "react";
import { Pressable, Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import { ProductRow } from "@/components/screens/estoque/ProductRow";

const P: any = { id: "p1", name: "Capa", code: "C1", barcode: "", category: "Capas", price: 35, cost: 5.5, stock: 4, minStock: 0, unit: "un", notes: "", color: "", size: "" };

function textoAberto(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  act(() => { tree.root.findAllByType(Pressable as any)[0].props.onPress(); });
  return tree.root.findAllByType(Text as any)
    .map((t) => [].concat(t.props.children).filter((c) => typeof c === "string" || typeof c === "number").join(""))
    .join(" | ");
}

test("produto, sem a prop: Custo, Margem e Valor estoque como antes", () => {
  expect(textoAberto(<ProductRow product={P} />)).toMatch(/Custo.*Margem.*Valor estoque/);
});

test("produto com semCusto: só o preço da linha e o estoque mínimo", () => {
  const t = textoAberto(<ProductRow product={P} semCusto />);
  expect(t).toMatch(/R\$ 35,00/);
  expect(t).toMatch(/Estoque mínimo/);
  expect(t).not.toMatch(/Custo|Margem|Valor estoque|R\$ 5,50|R\$ 22,00/);
});

test("serviço com semCusto: Preço fica, Custo e Margem somem", () => {
  const t = textoAberto(<ProductRow product={{ ...P, unit: "srv" }} semCusto />);
  expect(t).toMatch(/Preço/);
  expect(t).not.toMatch(/Custo|Margem/);
});
