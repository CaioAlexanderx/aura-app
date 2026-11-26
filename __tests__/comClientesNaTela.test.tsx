// ============================================================
// Venda condicional (C13): selo tracejado "N com clientes" no Caixa, no
// Estoque e na consulta, e as regras de utils/comClientes.ts. Sem out_qty
// (trava desligada) a tela é idêntica à de hoje.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/services/api", () => ({ request: jest.fn(), companiesApi: { variants: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "c1" } }) }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn(() => ({ data: undefined, isLoading: false })) }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: "ProductImageUpload" }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ProductGrid } from "@/components/screens/pdv/ProductGrid";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { ProductTableWeb } from "@/components/screens/estoque/ProductTableWeb";
import { mapApiProduct } from "@/hooks/useProducts";
import {
  comClientesDoProduto, livresDaPeca, vendaInvadeComClientes, camposDeComClientes, TEXTOS_COM_CLIENTES,
} from "@/utils/comClientes";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function montar(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  return tree;
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
const igual = (a: renderer.ReactTestRenderer, b: renderer.ReactTestRenderer) =>
  expect(JSON.stringify(a.toJSON())).toBe(JSON.stringify(b.toJSON()));

const BASE: any = {
  id: "11111111-1111-4111-8111-111111111111", name: "Vestido Midi Linho", code: "V1", barcode: "", category: "Vestidos",
  price: 189.9, cost: 80, stock: 5, minStock: 1, unit: "un", notes: "", color: "", size: "",
};
const COM: any = { ...BASE, outQty: 2 };
const COM_E_RESERVA: any = { ...BASE, outQty: 2, reservedQty: 1 };
const tabela = (items: any[], extra: any = {}) =>
  <ProductTableWeb items={items} bulkMode={false} bulkSelected={new Set()} onSelect={() => {}} canLink={false} {...extra} />;

describe("regras de com clientes", () => {
  test("ausente = 0; só conta com a trava liberada", () => {
    expect(comClientesDoProduto(BASE, true)).toBe(0);
    expect(comClientesDoProduto(COM, false)).toBe(0);
    expect(comClientesDoProduto(COM, true)).toBe(2);
    expect(comClientesDoProduto({ outQty: 3, outByVariant: { vP: 2 } }, true, "vP")).toBe(2);
    expect(comClientesDoProduto({ outQty: 3, outByVariant: { vP: 2 } }, true, "vM")).toBe(0);
    expect(comClientesDoProduto({ outQty: "x" as any }, true)).toBe(0);
    expect(comClientesDoProduto(null, true)).toBe(0);
  });

  test("livres = estoque - com clientes - reservado, nunca negativo", () => {
    expect(livresDaPeca(5, 2, 1)).toBe(2);
    expect(livresDaPeca(5, 2)).toBe(3);
    expect(livresDaPeca(1, 2, 1)).toBe(0);
  });

  test("a venda só invade quando há peça com cliente e o carrinho passa do livre", () => {
    expect(vendaInvadeComClientes({ estoque: 1, comClientes: 1, noCarrinho: 0 })).toBe(true);
    expect(vendaInvadeComClientes({ estoque: 3, comClientes: 1, noCarrinho: 1 })).toBe(false);
    expect(vendaInvadeComClientes({ estoque: 3, comClientes: 1, noCarrinho: 2 })).toBe(true);
    expect(vendaInvadeComClientes({ estoque: 1, comClientes: 0, noCarrinho: 5 })).toBe(false);
  });

  test("campos do GET /products: ausentes, nada; presentes, número", () => {
    expect(camposDeComClientes({ id: "x" })).toEqual({});
    expect(camposDeComClientes({ out_qty: "2", out_by_variant: { a: 2, b: 0 } })).toEqual({ outQty: 2, outByVariant: { a: 2 } });
  });

  test("mapApiProduct: sem os campos, o produto não ganha chave nova", () => {
    const sem = mapApiProduct({ id: "p1", name: "Saia", price: "10", stock_qty: "3" });
    expect(Object.keys(sem)).not.toContain("outQty");
    expect(Object.keys(sem)).not.toContain("outByVariant");
    const com = mapApiProduct({ id: "p1", name: "Saia", price: "10", stock_qty: "3", out_qty: 2, out_by_variant: { v1: 2 } });
    expect(com.outQty).toBe(2);
    expect(com.outByVariant).toEqual({ v1: 2 });
  });

  test("textos do mockup", () => {
    expect(TEXTOS_COM_CLIENTES.selo(1)).toBe("1 com cliente");
    expect(TEXTOS_COM_CLIENTES.selo(2)).toBe("2 com clientes");
    expect(TEXTOS_COM_CLIENTES.avisoTitulo).toBe("Esta peça consta com uma cliente");
  });
});

describe("Caixa: selo no cartão", () => {
  test("com out_qty e a trava: '2 com clientes', estoque da prateleira", () => {
    const tree = montar(<ProductGrid products={[COM]} qtyById={{}} onAdd={() => {}} comClientesLiberado />);
    const selo = porTestID(tree, "grid-com-clientes-" + COM.id);
    expect(selo).toHaveLength(1);
    expect(flattenText(selo[0].children)).toBe("2 com clientes");
    expect(flattenText(tree.toJSON() as any)).toContain("5 em estoque");
  });

  test("selo de reserva convive com o de com clientes", () => {
    const tree = montar(<ProductGrid products={[COM_E_RESERVA]} qtyById={{}} onAdd={() => {}} comClientesLiberado reservaLiberada />);
    expect(porTestID(tree, "grid-com-clientes-" + BASE.id)).toHaveLength(1);
    expect(flattenText(porTestID(tree, "grid-reservado-" + BASE.id)[0].children)).toBe("1 reservado");
  });

  test("paridade: sem out_qty ou com a trava desligada, o cartão é o de sempre", () => {
    const sem = montar(<ProductGrid products={[BASE]} qtyById={{}} onAdd={() => {}} />);
    igual(montar(<ProductGrid products={[BASE]} qtyById={{}} onAdd={() => {}} comClientesLiberado />), sem);
    igual(montar(<ProductGrid products={[COM]} qtyById={{}} onAdd={() => {}} />), sem);
  });
});

describe("Estoque: selo na linha e na consulta", () => {
  test("linha (celular): selo e livres = estoque - com clientes", () => {
    const tree = montar(<ProductRow product={COM} comClientesLiberado />);
    const linha = porTestID(tree, "estoque-reservado-" + COM.id);
    expect(linha).toHaveLength(1);
    expect(flattenText(linha[0].children)).toBe("2 com clientes" + "3 livres para vender");
  });

  test("tabela: com reserva junto, livres desconta os dois", () => {
    const tree = montar(tabela([COM_E_RESERVA], { reservaLiberada: true, comClientesLiberado: true }));
    expect(flattenText(porTestID(tree, "estoque-reservado-" + BASE.id)[0].children)).toBe("2 com clientes1 reservado2 livres para vender");
  });

  test("consulta: o selo aparece também", () => {
    const tree = montar(<ProductRow product={COM} consulta comClientesLiberado />);
    expect(porTestID(tree, "estoque-reservado-" + COM.id)).toHaveLength(1);
  });

  test("paridade: sem out_qty ou com a trava desligada, a linha é a de sempre", () => {
    const sem = montar(<ProductRow product={BASE} />);
    igual(montar(<ProductRow product={BASE} comClientesLiberado />), sem);
    igual(montar(<ProductRow product={COM} />), sem);
    igual(montar(tabela([COM])), montar(tabela([BASE])));
  });
});
