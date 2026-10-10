// ============================================================
// Comandas do Caixa (09/10/2026) — useCart + useComandaNoCaixa juntos.
//
// O que estes testes seguram:
//  1. Lançar: o carrinho vai para a comanda (itens com produto, variação,
//     nome e preço) e o balcão fica limpo.
//  2. Cobrar: o consumo vira o carrinho, com a taxa de serviço como linha;
//     a venda leva comanda_id e o percentual; a linha da taxa vai SEM
//     product_id (a chave sintética derrubava a venda no backend); depois
//     da venda o carrinho esquece a comanda.
//  3. Desistir de cobrar e esvaziar o carrinho na mão soltam a comanda — a
//     próxima venda não pode fechar comanda nenhuma.
//  4. Carrinho que já é uma comanda não é lançado de novo.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, isDemo: false }),
}));
jest.mock("@/services/api", () => ({ pdvApi: { createSale: jest.fn() } }));
jest.mock("@/components/screens/pdv/ComandaModals", () => ({
  chaveDasComandas: (id: string) => ["comandas-abertas", id],
}));

const mockAddItems = jest.fn();
jest.mock("@/services/comandaApi", () => ({
  comandaApi: { addItems: (...a: any[]) => mockAddItems(...a) },
}));

const mockBodies: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => {
      mockBodies.push(body);
      cb?.onSuccess?.({ sale: { id: "venda-1", sale_number: 9 } });
    },
  }),
}));

import { toast } from "@/components/Toast";
import { useCart } from "@/hooks/useCart";
import { useComandaNoCaixa } from "@/hooks/useComandaNoCaixa";
import type { Comanda } from "@/utils/comanda";

const GIN = "11111111-1111-4111-8111-111111111111";
const CERVEJA = "22222222-2222-4222-8222-222222222222";
const ML600 = "33333333-3333-4333-8333-333333333333";

let cart: ReturnType<typeof useCart>;
let comandas: ReturnType<typeof useComandaNoCaixa>;
function Harness() {
  cart = useCart();
  comandas = useComandaNoCaixa({
    companyId: "empresa-1", enabled: true, isDemo: false,
    cart: cart.cart, comanda: cart.comanda, setComanda: cart.setComanda,
    limpar: cart.newSale, addToCart: cart.addToCart, setQty: cart.setQty,
    products: [{ id: GIN, price: 25 }, { id: CERVEJA, price: 12 }],
  });
  return null;
}
function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness />); });
  return tree;
}
async function esperar() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

const COMANDA: Comanda = {
  id: "44444444-4444-4444-8444-444444444444", number: 12, status: "open", opened_at: "", items_count: 3, subtotal: 99,
  items: [
    { id: "i1", product_id: GIN, variant_id: null, name: "Copão Gin", unit: null, quantity: 2, unit_price: 25, total: 50 },
    { id: "i2", product_id: CERVEJA, variant_id: ML600, name: "Cerveja (600 ml)", unit: null, quantity: 2, unit_price: 12, total: 24 },
    { id: "i3", product_id: GIN, variant_id: null, name: "Copão Gin", unit: null, quantity: 1, unit_price: 25, total: 25 },
  ],
};

beforeEach(() => {
  mockBodies.length = 0;
  jest.clearAllMocks();
});

test("1. lançar manda o carrinho para a comanda e limpa o balcão", async () => {
  mockAddItems.mockResolvedValue({ comanda: { ...COMANDA, subtotal: 62 }, opened: true, added: 2 });
  const tree = montar();
  act(() => {
    cart.addToCart({ id: GIN, name: "Copão Gin", price: 25 });
    cart.addToCart({ id: GIN, name: "Copão Gin", price: 25 });
    cart.addToCart({ id: CERVEJA, name: "Cerveja", price: 12 }, { id: ML600, label: "600 ml", price: 12, stock: 9 } as any);
  });
  act(() => { comandas.abrirAdicionar(); });
  expect(comandas.showAdicionar).toBe(true);
  act(() => { comandas.lancar(12); });
  await esperar();

  expect(mockAddItems).toHaveBeenCalledWith("empresa-1", 12, [
    { product_id: GIN, variant_id: null, name: "Copão Gin", unit: null, quantity: 2, unit_price: 25 },
    { product_id: CERVEJA, variant_id: ML600, name: "Cerveja (600 ml)", unit: null, quantity: 1, unit_price: 12 },
  ]);
  expect(cart.cart).toEqual([]);
  expect(comandas.showAdicionar).toBe(false);
  expect(toast.success).toHaveBeenCalledWith("Comanda 12 aberta · total R$ 62,00");
  expect(mockBodies).toEqual([]); // lançar não é venda
  tree.unmount();
});

test("1b. carrinho vazio não abre o modal", () => {
  const tree = montar();
  act(() => { comandas.abrirAdicionar(); });
  expect(comandas.showAdicionar).toBe(false);
  tree.unmount();
});

test("2. cobrar: o consumo vira o carrinho com a taxa, e a venda fecha a comanda", () => {
  const tree = montar();
  // o que estava no balcão sai: a venda é a comanda e mais nada
  act(() => { cart.addToCart({ id: CERVEJA, name: "Cerveja avulsa", price: 12 }); });
  act(() => { comandas.cobrar(COMANDA, 10); });

  expect(cart.cart.map((i) => [i.name, i.qty, i.price])).toEqual([
    ["Copão Gin", 3, 25],
    ["Cerveja (600 ml)", 2, 12],
    ["Taxa de serviço (10%)", 1, 9.9],
  ]);
  expect(cart.total).toBe(108.9);
  expect(cart.comanda).toEqual({ id: COMANDA.id, number: 12, feePct: 10 });

  act(() => { cart.finalizeSale(); });
  expect(mockBodies).toHaveLength(1);
  const body = mockBodies[0];
  expect(body.comanda_id).toBe(COMANDA.id);
  expect(body.comanda_service_fee_pct).toBe(10);
  expect(body.items.map((i: any) => [i.product_id, i.variant_id, i.quantity, i.unit_price, i.product_name_snapshot])).toEqual([
    [GIN, undefined, 3, 25, "Copão Gin"],
    [CERVEJA, ML600, 2, 12, "Cerveja (600 ml)"],
    [undefined, undefined, 1, 9.9, "Taxa de serviço (10%)"],
  ]);
  // vendeu: o carrinho esquece a comanda
  expect(cart.comanda).toBeNull();

  // e a venda seguinte não leva comanda nenhuma
  act(() => { cart.newSale(); });
  act(() => { cart.addToCart({ id: GIN, name: "Copão Gin", price: 25 }); });
  act(() => { cart.finalizeSale(); });
  expect(mockBodies[1].comanda_id).toBeUndefined();
  expect(mockBodies[1].comanda_service_fee_pct).toBeUndefined();
  tree.unmount();
});

test("2b. sem taxa: nenhuma linha a mais e o percentual não viaja", () => {
  const tree = montar();
  act(() => { comandas.cobrar(COMANDA, 0); });
  expect(cart.cart).toHaveLength(2);
  expect(cart.total).toBe(99);
  act(() => { cart.finalizeSale(); });
  expect(mockBodies[0].comanda_id).toBe(COMANDA.id);
  expect(mockBodies[0].comanda_service_fee_pct).toBeUndefined();
  tree.unmount();
});

test("3. desistir de cobrar, ou esvaziar o carrinho, solta a comanda", () => {
  const tree = montar();
  act(() => { comandas.cobrar(COMANDA, 0); });
  act(() => { comandas.cancelarCobranca(); });
  expect(cart.cart).toEqual([]);
  expect(cart.comanda).toBeNull();
  expect(toast.info).toHaveBeenCalledWith("A comanda 12 continua aberta");

  act(() => { comandas.cobrar(COMANDA, 0); });
  act(() => { cart.cart.forEach((i) => cart.removeItem(i.productId)); });
  expect(cart.cart).toEqual([]);
  expect(cart.comanda).toBeNull();
  act(() => { cart.addToCart({ id: GIN, name: "Copão Gin", price: 25 }); });
  act(() => { cart.finalizeSale(); });
  expect(mockBodies[0].comanda_id).toBeUndefined();
  tree.unmount();
});

test("4. carrinho que já é uma comanda não é lançado de novo", () => {
  const tree = montar();
  act(() => { comandas.cobrar(COMANDA, 0); });
  act(() => { comandas.abrirAdicionar(); });
  expect(comandas.showAdicionar).toBe(false);
  expect(toast.info).toHaveBeenCalledWith("Este carrinho já é a comanda 12. Finalize ou cancele a cobrança.");
  tree.unmount();
});
