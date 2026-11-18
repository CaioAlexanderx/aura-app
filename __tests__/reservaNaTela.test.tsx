// ============================================================
// Pedido separado de venda (A4, p-63d): a reserva na tela, com a trava do
// Pedido liberada. Selo "N reservado" no cartão do Caixa (ProductGrid) e
// "N reservado · X livres para vender" na linha do Estoque (ProductRow e
// ProductTableWeb). Textos da parte 1 do mockup. A prova de que nada muda
// com a trava desligada está em reservaNaTelaIgual.test.tsx.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
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
  reservadoDoProduto, livresParaVender, vendaInvadeReserva, camposDaReserva, TEXTOS_DA_RESERVA,
} from "@/utils/reservaDoPedido";

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

const VESTIDO: any = {
  id: "11111111-1111-4111-8111-111111111111", name: "Vestido Midi Linho", code: "V1", barcode: "", category: "Vestidos",
  price: 189.9, cost: 80, stock: 4, minStock: 1, unit: "un", notes: "", color: "", size: "", reservedQty: 1,
};
const BLUSA: any = { ...VESTIDO, id: "33333333-3333-4333-8333-333333333333", name: "Blusa Tricot", stock: 2, reservedQty: 0 };

describe("regras da reserva", () => {
  test("só conta com a trava liberada", () => {
    expect(reservadoDoProduto(VESTIDO, false)).toBe(0);
    expect(reservadoDoProduto(VESTIDO, true)).toBe(1);
    expect(reservadoDoProduto({ reservedQty: 3, reservedByVariant: { vP: 2 } }, true, "vP")).toBe(2);
    expect(reservadoDoProduto({ reservedQty: 3, reservedByVariant: { vP: 2 } }, true, "vM")).toBe(0);
    expect(reservadoDoProduto(null, true)).toBe(0);
  });

  test("livres e quando o carrinho invade a reserva", () => {
    expect(livresParaVender(4, 1)).toBe(3);
    expect(livresParaVender(1, 2)).toBe(0);
    expect(vendaInvadeReserva({ estoque: 4, reservado: 1, noCarrinho: 2 })).toBe(false);
    expect(vendaInvadeReserva({ estoque: 4, reservado: 1, noCarrinho: 3 })).toBe(true);
    expect(vendaInvadeReserva({ estoque: 4, reservado: 0, noCarrinho: 9 })).toBe(false);
  });

  test("campos do GET /products: ausentes, nada; presentes, número", () => {
    expect(camposDaReserva({ id: "x" })).toEqual({});
    expect(camposDaReserva({ reserved_qty: "2", reserved_by_variant: { a: 2, b: 0 } })).toEqual({ reservedQty: 2, reservedByVariant: { a: 2 } });
  });

  test("mapApiProduct: sem os campos, o produto não ganha chave nova", () => {
    const sem = mapApiProduct({ id: "p1", name: "Saia", price: "10", stock_qty: "3" });
    expect(Object.keys(sem)).not.toContain("reservedQty");
    expect(Object.keys(sem)).not.toContain("reservedByVariant");
    const com = mapApiProduct({ id: "p1", name: "Saia", price: "10", stock_qty: "3", reserved_qty: 1, reserved_by_variant: {} });
    expect(com.reservedQty).toBe(1);
    expect(com.reservedByVariant).toEqual({});
  });

  test("textos do mockup", () => {
    expect(TEXTOS_DA_RESERVA.selo(1)).toBe("1 reservado");
    expect(TEXTOS_DA_RESERVA.livres(3)).toBe("3 livres para vender");
  });
});

describe("Caixa: selo no cartão", () => {
  test("com reserva: '1 reservado' ao lado do estoque, quantidade da prateleira", () => {
    const tree = montar(<ProductGrid products={[VESTIDO, BLUSA]} qtyById={{}} onAdd={() => {}} reservaLiberada />);
    const selo = porTestID(tree, "grid-reservado-" + VESTIDO.id);
    expect(selo).toHaveLength(1);
    expect(flattenText(selo[0].children)).toBe("1 reservado");
    expect(flattenText(tree.toJSON() as any)).toContain("4 em estoque");
    expect(porTestID(tree, "grid-reservado-" + BLUSA.id)).toHaveLength(0);
  });

  test("trava desligada: sem selo", () => {
    const tree = montar(<ProductGrid products={[VESTIDO]} qtyById={{}} onAdd={() => {}} />);
    expect(porTestID(tree, "grid-reservado-" + VESTIDO.id)).toHaveLength(0);
  });
});

describe("Estoque: reserva na linha", () => {
  test("linha (celular): '1 reservado' e '3 livres para vender'", () => {
    const tree = montar(<ProductRow product={VESTIDO} reservaLiberada />);
    const linha = porTestID(tree, "estoque-reservado-" + VESTIDO.id);
    expect(linha).toHaveLength(1);
    expect(flattenText(linha[0].children)).toBe("1 reservado" + "3 livres para vender");
  });

  test("tabela (computador): a mesma frase; sem reserva, nada", () => {
    const tree = montar(<ProductTableWeb items={[VESTIDO, BLUSA]} bulkMode={false} bulkSelected={new Set()} onSelect={() => {}} canLink={false} reservaLiberada />);
    expect(flattenText(porTestID(tree, "estoque-reservado-" + VESTIDO.id)[0].children)).toBe("1 reservado3 livres para vender");
    // A linha sem reserva não ganha nada: o texto aparece uma vez só, na do vestido.
    expect(flattenText(tree.toJSON() as any).split("reservado").length - 1).toBe(1);
  });
});
