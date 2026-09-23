// ============================================================
// Estoque · barra "ORDENAR:" (components/screens/estoque/OrdenarBarra).
// 23/09/2026: botões A–Z / Z–A aparecem, ordenam a lista e a escolha fica
// lembrada no navegador. O harness reproduz a ligação da tela
// (app/(tabs)/estoque.tsx): estado inicial de lerOrdemSalva, troca salva
// com salvarOrdem, lista passa por ordenarProdutos.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

import React, { useState } from "react";
import { Text, View } from "react-native";
import renderer, { act } from "react-test-renderer";
import { OrdenarBarra } from "@/components/screens/estoque/OrdenarBarra";
import {
  ordenarProdutos,
  lerOrdemSalva,
  salvarOrdem,
  CHAVE_ORDEM_ESTOQUE,
  type OrdemEstoque,
} from "@/utils/productSort";

const PRODUTOS = [
  { id: "1", name: "Piso 10", price: 50, stock: 4, created_at: "2026-09-20T10:00:00Z" },
  { id: "2", name: "Água sanitária", price: 8, stock: 30, created_at: "2026-09-01T10:00:00Z" },
  { id: "3", name: "Piso 9", price: 45, stock: 2, created_at: "2026-09-22T10:00:00Z" },
  { id: "4", name: "Cimento", price: 32, stock: 10, created_at: "2026-09-10T10:00:00Z" },
];

function TelaDeTeste() {
  const [ordem, setOrdemState] = useState<OrdemEstoque>(lerOrdemSalva);
  const setOrdem = (o: OrdemEstoque) => { setOrdemState(o); salvarOrdem(o); };
  return (
    <View>
      <OrdenarBarra value={ordem} onChange={setOrdem} />
      {ordenarProdutos(PRODUTOS, ordem).map((p) => (
        <Text key={p.id} testID="linha-produto">{p.name}</Text>
      ))}
    </View>
  );
}

function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function textoDe(node: renderer.ReactTestInstance): string {
  return node.findAllByType(Text as any).map((t) => [].concat(t.props.children).join("")).join("");
}
const linhas = (tree: renderer.ReactTestRenderer) =>
  porTestID(tree, "linha-produto").map((n) => [].concat(n.props.children).join(""));
const ativo = (tree: renderer.ReactTestRenderer, key: string) =>
  porTestID(tree, `ordenar-${key}`)[0].props.accessibilityState.selected;

function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<TelaDeTeste />); });
  return tree;
}

beforeEach(() => window.localStorage.clear());

test('mostra "A–Z" e "Z–A" junto das opções de sempre, na ordem da barra', () => {
  const tree = montar();
  const chaves = ["recent", "name_asc", "name_desc", "price_desc", "price_asc", "low_stock"];
  for (const k of chaves) expect(porTestID(tree, `ordenar-${k}`)).toHaveLength(1);
  expect(textoDe(porTestID(tree, "ordenar-name_asc")[0])).toBe("🔤 A–Z");
  expect(textoDe(porTestID(tree, "ordenar-name_desc")[0])).toBe("🔤 Z–A");
  expect(textoDe(porTestID(tree, "ordenar-recent")[0])).toBe("🕐 Últimos adicionados");
});

test('sem escolha salva: "Últimos adicionados" ativo e lista por data', () => {
  const tree = montar();
  expect(ativo(tree, "recent")).toBe(true);
  expect(linhas(tree)).toEqual(["Piso 9", "Piso 10", "Cimento", "Água sanitária"]);
});

test("tocar em A–Z ordena por nome (acento e número certos) e lembra a escolha", () => {
  const tree = montar();
  act(() => { porTestID(tree, "ordenar-name_asc")[0].props.onPress(); });
  expect(ativo(tree, "name_asc")).toBe(true);
  expect(ativo(tree, "recent")).toBe(false);
  expect(linhas(tree)).toEqual(["Água sanitária", "Cimento", "Piso 9", "Piso 10"]);
  expect(window.localStorage.getItem(CHAVE_ORDEM_ESTOQUE)).toBe("name_asc");
});

test("tocar em Z–A inverte", () => {
  const tree = montar();
  act(() => { porTestID(tree, "ordenar-name_desc")[0].props.onPress(); });
  expect(linhas(tree)).toEqual(["Piso 10", "Piso 9", "Cimento", "Água sanitária"]);
});

test("ao voltar para a tela, a escolha salva já vem ativa", () => {
  window.localStorage.setItem(CHAVE_ORDEM_ESTOQUE, "name_asc");
  const tree = montar();
  expect(ativo(tree, "name_asc")).toBe(true);
  expect(linhas(tree)[0]).toBe("Água sanitária");
});

test("consolidado: só as opções passadas aparecem", () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <OrdenarBarra value="name_asc" onChange={() => {}} opcoes={["name_asc", "name_desc", "price_desc", "price_asc", "low_stock"]} />,
    );
  });
  expect(porTestID(tree, "ordenar-recent")).toHaveLength(0);
  expect(porTestID(tree, "ordenar-name_asc")).toHaveLength(1);
});
