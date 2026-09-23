// ============================================================
// QA 23/09/2026 (Matcon): trocar o tema claro/escuro recarrega a página e o
// carrinho do Caixa sumia sem aviso. A recarga continua (as cores são
// congeladas na importação); o carrinho agora é guardado antes dela e
// recuperado ao voltar (utils/vendaGuardada + hooks/useCart).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
let mockEmpresa: string | null = "empresa-1";
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: mockEmpresa ? { id: mockEmpresa } : null, isDemo: false }),
}));
jest.mock("@/services/api", () => ({ pdvApi: { createSale: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn() }),
}));

import { useCart } from "@/hooks/useCart";
import {
  guardarAntesDeRecarregar, guardarVenda, recuperarVenda, VALIDADE_DA_VENDA_GUARDADA_MS,
  __zerarParaTestes,
} from "@/utils/vendaGuardada";

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

beforeEach(() => {
  __zerarParaTestes();
  window.sessionStorage.clear();
  mockEmpresa = "empresa-1";
});

describe("utils/vendaGuardada", () => {
  test("guarda e recupera uma vez só, na mesma empresa", () => {
    guardarVenda("empresa-1", { cart: [1] }, 1000);
    expect(recuperarVenda("empresa-2", 1000)).toBeNull();
    expect(recuperarVenda("empresa-1", 2000)).toEqual({ cart: [1] });
    // Leitura única: não ressuscita depois.
    expect(recuperarVenda("empresa-1", 2000)).toBeNull();
  });

  test("passou da validade: não devolve nada", () => {
    guardarVenda("empresa-1", { cart: [1] }, 0);
    expect(recuperarVenda("empresa-1", VALIDADE_DA_VENDA_GUARDADA_MS + 1)).toBeNull();
  });

  test("com a recarga marcada, esta página não lê nem apaga a venda guardada", () => {
    guardarVenda("empresa-1", { cart: [1] }, 1000);
    guardarAntesDeRecarregar();
    expect(recuperarVenda("empresa-1", 2000)).toBeNull();
    expect(window.sessionStorage.length).toBe(1);
    __zerarParaTestes(); // a página nova
    expect(recuperarVenda("empresa-1", 2000)).toEqual({ cart: [1] });
  });

  test("sem empresa não guarda nem recupera", () => {
    guardarVenda(null, { cart: [1] });
    expect(window.sessionStorage.length).toBe(0);
    expect(recuperarVenda(null)).toBeNull();
  });
});

describe("Caixa: trocar o tema não perde a venda", () => {
  test("o carrinho, a forma de pagamento, o cliente e o CPF voltam depois da recarga", () => {
    const antes = montar();
    act(() => { api.addToCart({ id: "piso", name: "Porcelanato", price: 64.8 }); });
    act(() => { api.setQty("piso", 18.56); });
    act(() => { api.addToCart({ id: "cim", name: "Cimento", price: 38 }); });
    act(() => { api.setPayment("cartao"); });
    act(() => { api.selectCustomer("cli-1", "Dona Maria", "11999990000"); });
    act(() => { api.setCpfNaNota("123.456.789-09"); });

    // O toggle do tema chama isto logo antes de window.location.reload().
    guardarAntesDeRecarregar();
    act(() => { antes.unmount(); });
    __zerarParaTestes(); // a recarga zera o que vive em memória

    // "Recarregou": um Caixa novo, com o estado zerado.
    const depois = montar();
    expect(api.cart.map((i) => [i.productId, i.qty])).toEqual([["piso", 18.56], ["cim", 1]]);
    expect(api.payment).toBe("cartao");
    expect(api.selectedCustomerId).toBe("cli-1");
    expect(api.selectedCustomerName).toBe("Dona Maria");
    expect(api.cpfNaNota).toBe("123.456.789-09");
    act(() => { depois.unmount(); });

    // Leitura única: abrir o Caixa de novo mais tarde começa vazio.
    const outra = montar();
    expect(api.cart).toHaveLength(0);
    act(() => { outra.unmount(); });
  });

  test("carrinho vazio não guarda nada", () => {
    const t = montar();
    guardarAntesDeRecarregar();
    act(() => { t.unmount(); });
    expect(window.sessionStorage.length).toBe(0);
  });

  test("a venda é da empresa: em outro CNPJ o Caixa começa vazio", () => {
    const antes = montar();
    act(() => { api.addToCart({ id: "cim", name: "Cimento", price: 38 }); });
    guardarAntesDeRecarregar();
    act(() => { antes.unmount(); });
    __zerarParaTestes(); // a recarga zera o que vive em memória

    mockEmpresa = "empresa-2";
    const outra = montar();
    expect(api.cart).toHaveLength(0);
    act(() => { outra.unmount(); });
  });

  test("Caixa desmontado não guarda (o registro sai no cleanup)", () => {
    const t = montar();
    act(() => { api.addToCart({ id: "cim", name: "Cimento", price: 38 }); });
    act(() => { t.unmount(); });
    guardarAntesDeRecarregar();
    expect(window.sessionStorage.length).toBe(0);
  });
});
