// ============================================================
// INC-2026-11-17-03 — o crédito da cliente abatido no Caixa.
//
// Relato: depois de uma troca com "Crédito para", a cliente volta e o
// lojista não vê o crédito para abater. Aqui:
//   · as regras puras (teto no saldo e no total, pagamentos com o crédito);
//   · o POST do useCart: venda de R$ 200 com R$ 50 de crédito e R$ 150 no
//     Pix vai com payments [{credito_cliente, 50}, {pix, 150}];
//   · sem crédito (ou sem cliente) o POST é exatamente o de sempre;
//   · a caixa "Crédito da cliente" do carrinho.
// Mesmo harness de __tests__/freteNoCaixa.test.tsx.
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

const mockBodies: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => {
      mockBodies.push(body);
      cb?.onSuccess?.({ sale: { id: "venda-1", sale_number: 77 } });
    },
  }),
}));

import { useCart } from "@/hooks/useCart";
import {
  creditoQueVale, creditoSugerido, pagamentosComCredito, lerValor, METODO_CREDITO, TEXTOS_DO_CREDITO,
} from "@/components/screens/pdv/creditoDaCliente";
import { CreditoDaClienteBox } from "@/components/screens/pdv/CreditoDaClienteBox";
import { nomeDoPagamento } from "@/components/screens/pdv/rotulosDoCaixa";
import { rotuloDaForma } from "@/components/screens/vendas/editarVendaUtils";

let api: ReturnType<typeof useCart>;
function Harness() {
  api = useCart();
  return null;
}
function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness />); });
  return tree;
}
/** Um vestido de R$ 200, a cliente escolhida. */
function vendaDoRelato({ comCliente = true } = {}) {
  act(() => { api.addToCart({ id: "vestido", name: "Vestido", price: 200 }); });
  if (comCliente) act(() => { api.selectCustomer("cliente-1", "Cliente", null); });
}

beforeEach(() => { mockBodies.length = 0; });

describe("regras puras", () => {
  test("o crédito que vale: teto no saldo e no total, nunca negativo", () => {
    expect(creditoQueVale(50, 50, 200)).toBe(50);
    expect(creditoQueVale(80, 50, 200)).toBe(50);
    expect(creditoQueVale(80, 500, 60)).toBe(60);
    expect(creditoQueVale(-5, 50, 200)).toBe(0);
    expect(creditoQueVale(10, 0, 200)).toBe(0);
    expect(creditoQueVale(10, 50, 0)).toBe(0);
    expect(creditoSugerido(50, 200)).toBe(50);
    expect(creditoSugerido(497.25, 129.9)).toBe(129.9);
  });

  test("os pagamentos com o crédito na frente", () => {
    expect(pagamentosComCredito(50, undefined, "pix", 150)).toEqual([
      { method: METODO_CREDITO, value: 50 }, { method: "pix", value: 150 },
    ]);
    expect(pagamentosComCredito(200, undefined, "pix", 0)).toEqual([{ method: METODO_CREDITO, value: 200 }]);
    expect(pagamentosComCredito(50, [{ method: "dinheiro", value: 100 }, { method: "pix", value: 50 }], "pix", 150)).toEqual([
      { method: METODO_CREDITO, value: 50 }, { method: "dinheiro", value: 100 }, { method: "pix", value: 50 },
    ]);
    // Sem crédito: o que veio, intacto.
    const de = [{ method: "pix", value: 10 }];
    expect(pagamentosComCredito(0, de, "pix", 10)).toBe(de);
    expect(pagamentosComCredito(0, undefined, "pix", 10)).toBeUndefined();
  });

  test("lê o valor digitado como o lojista escreve", () => {
    expect(lerValor("50")).toBe(50);
    expect(lerValor("50,5")).toBe(50.5);
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("R$ 49,90")).toBe(49.9);
    expect(lerValor("")).toBeNaN();
    expect(lerValor("abc")).toBeNaN();
  });

  test("o nome da forma no Caixa e no detalhe da venda", () => {
    expect(nomeDoPagamento(METODO_CREDITO)).toBe("Crédito da cliente");
    expect(rotuloDaForma(METODO_CREDITO)).toBe("Crédito da cliente");
    expect(TEXTOS_DO_CREDITO.disponivel(50)).toBe("R$ 50,00 disponível");
  });
});

describe("o POST da venda (useCart)", () => {
  test("sem crédito, com e sem cliente: o POST é o de sempre", () => {
    let tree = montar();
    vendaDoRelato();
    act(() => { api.finalizeSale(); });
    const comCliente = mockBodies[0];
    expect(comCliente.payments).toBeUndefined();
    expect(comCliente.payment_method).toBe("pix");
    expect(Object.keys(comCliente).filter((k) => comCliente[k] !== undefined).sort())
      .toEqual(["customer_id", "items", "payment_method"]);
    tree.unmount();

    tree = montar();
    vendaDoRelato({ comCliente: false });
    // Sem cliente o crédito pedido não vale.
    act(() => { api.setCreditoPedido(50); });
    expect(api.creditoUsado).toBe(0);
    act(() => { api.finalizeSale(); });
    expect(mockBodies[1].payments).toBeUndefined();
    expect(mockBodies[1].customer_id).toBeUndefined();
    tree.unmount();
  });

  test("venda de 200 com 50 de crédito e 150 no Pix", () => {
    const tree = montar();
    vendaDoRelato();
    act(() => { api.setCreditoPedido(50); });
    expect(api.creditoUsado).toBe(50);
    expect(api.aPagar).toBe(150);
    expect(api.totalAfterCoupon).toBe(200);
    act(() => { api.finalizeSale(); });
    const body = mockBodies[0];
    expect(body.payment_method).toBe("pix");
    expect(body.payments).toEqual([{ method: "credito_cliente", value: 50 }, { method: "pix", value: 150 }]);
    expect(body.customer_id).toBe("cliente-1");
    // A tela final mostra as duas formas; a venda seguinte começa sem crédito.
    expect(api.lastSale!.total).toBe(200);
    expect(api.lastSale!.payments).toEqual([{ method: "credito_cliente", value: 50 }, { method: "pix", value: 150 }]);
    expect(api.creditoPedido).toBe(0);
    tree.unmount();
  });

  test("venda toda no crédito: a forma principal é o crédito", () => {
    const tree = montar();
    act(() => { api.addToCart({ id: "casaco", name: "Casaco", price: 50 }); });
    act(() => { api.selectCustomer("cliente-1", "Cliente", null); });
    act(() => { api.setCreditoPedido(80); });
    expect(api.creditoUsado).toBe(50);
    expect(api.aPagar).toBe(0);
    act(() => { api.finalizeSale(); });
    expect(mockBodies[0].payment_method).toBe("credito_cliente");
    expect(mockBodies[0].payments).toEqual([{ method: "credito_cliente", value: 50 }]);
    tree.unmount();
  });

  test("no dividido o resto é o que se reparte", () => {
    const tree = montar();
    vendaDoRelato();
    act(() => { api.setCreditoPedido(50); });
    act(() => { api.toggleSplitMode(); });
    expect(api.splitPayments[0].value).toBe(150);
    expect(api.splitIsBalanced).toBe(true);
    act(() => { api.updateSplitPayment(0, { value: 100 }); });
    expect(api.splitRemaining).toBe(50);
    act(() => { api.addSplitPayment({ method: "dinheiro" }); });
    expect(api.splitPayments[1].value).toBe(50);
    act(() => { api.finalizeSale(); });
    expect(mockBodies[0].payments).toEqual([
      { method: "credito_cliente", value: 50 }, { method: "pix", value: 100 }, { method: "dinheiro", value: 50 },
    ]);
    tree.unmount();
  });

  test("crediário com crédito: o crediário leva só o resto", () => {
    const tree = montar();
    vendaDoRelato();
    act(() => { api.setPayment("crediario"); api.setCreditoPedido(50); });
    act(() => { api.finalizeSale(undefined, { installments: 3, first_due_date: "2026-12-17" }); });
    const body = mockBodies[0];
    expect(body.payment_method).toBe("crediario");
    expect(body.payments).toEqual([{ method: "credito_cliente", value: 50 }, { method: "crediario", value: 150 }]);
    expect(body.installments).toBe(3);
    tree.unmount();
  });

  test("o crédito acompanha o total: tirar o item baixa o crédito para o novo total", () => {
    const tree = montar();
    vendaDoRelato();
    act(() => { api.setCreditoPedido(150); });
    act(() => { api.setDiscountType("R$"); api.setDiscountValue("100"); });
    expect(api.totalAfterCoupon).toBe(100);
    expect(api.creditoUsado).toBe(100);
    expect(api.aPagar).toBe(0);
    tree.unmount();
  });

  test("nova venda zera o crédito", () => {
    const tree = montar();
    vendaDoRelato();
    act(() => { api.setCreditoPedido(50); });
    act(() => { api.newSale(); });
    expect(api.creditoPedido).toBe(0);
    expect(api.creditoUsado).toBe(0);
    tree.unmount();
  });
});

describe("a caixa do carrinho", () => {
  const achar = (tree: renderer.ReactTestRenderer, id: string) =>
    tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
  const textoDe = (tree: renderer.ReactTestRenderer, id: string) => {
    const [n] = achar(tree, id);
    const filhos = n.props.children;
    return Array.isArray(filhos) ? filhos.join("") : String(filhos);
  };
  const credito = (usado: number) => ({
    saldo: 50, usado, aPagar: 200 - usado,
    usar: jest.fn(), mudar: jest.fn(), naoUsar: jest.fn(),
  });

  test("mostra o saldo e o botão de usar", () => {
    const c = credito(0);
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<CreditoDaClienteBox credito={c} />); });
    expect(textoDe(tree, "credito-disponivel")).toBe("R$ 50,00 disponível");
    expect(achar(tree, "credito-valor")).toHaveLength(0);
    act(() => { achar(tree, "credito-usar")[0].props.onPress(); });
    expect(c.usar).toHaveBeenCalled();
    tree.unmount();
  });

  test("em uso: valor editável, o que falta pagar e o botão de não usar", () => {
    const c = credito(50);
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<CreditoDaClienteBox credito={c} />); });
    expect(achar(tree, "credito-valor")[0].props.value).toBe("50,00");
    expect(textoDe(tree, "credito-a-pagar")).toBe("Falta pagar R$ 150,00");
    act(() => { achar(tree, "credito-valor")[0].props.onChangeText("30"); });
    act(() => { achar(tree, "credito-valor")[0].props.onBlur(); });
    expect(c.mudar).toHaveBeenCalledWith(30);
    act(() => { achar(tree, "credito-valor")[0].props.onChangeText(""); });
    act(() => { achar(tree, "credito-valor")[0].props.onBlur(); });
    expect(c.naoUsar).toHaveBeenCalled();
    act(() => { achar(tree, "credito-nao-usar")[0].props.onPress(); });
    expect(c.naoUsar).toHaveBeenCalledTimes(2);
    tree.unmount();
  });
});
