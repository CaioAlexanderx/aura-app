// ============================================================
// Comanda: "Dividir a conta" (17/10/2026, card tc-04) — render do modal.
//
// Mockup da Nina aprovado pelo Caio. O que estes testes seguram:
//  1. As contas: 160 em 3 = 53,34 + 53,33 + 53,33 (centavos na primeira);
//     soma, diferença, confere e o valor digitado com vírgula.
//  2. Modal: "Dividir a conta" mostra uma linha por pessoa; o botão só
//     libera quando a soma bate com o total (taxa incluída); trocar o número
//     de pessoas refaz as partes; "Cobrar" manda as partes com as formas.
//  3. "Cobrar tudo" continua igual: só a comanda e a taxa.
// O caminho até o POST da venda (uma venda, 3 pagamentos) fica em
// comandaDividirNoCaixa.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Modal: ({ visible, children }: any) => (visible ? children : null),
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
}));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: () => "#000" }) }));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));
jest.mock("@/components/screens/pdv/erroNoCaixa", () => ({ textoDoErro: (_e: any, padrao: string) => padrao }));

const mockApi = { listOpen: jest.fn(), get: jest.fn(), addItems: jest.fn(), removeItem: jest.fn(), cancel: jest.fn() };
jest.mock("@/services/comandaApi", () => ({ get comandaApi() { return mockApi; } }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { comandas: [] }, isLoading: false, refetch: jest.fn() }),
}));

import { FecharComandaModal } from "@/components/screens/pdv/ComandaModals";
import {
  partesIguais, somaDasPartes, diferencaDaDivisao, divisaoConfere, valorDigitado, valorNoCampo,
} from "@/utils/comanda";

// O exemplo do mockup: comanda 12 do João, 4 itens, R$ 160.
const COMANDA = {
  id: "c-12", number: 12, name: "João", status: "open", opened_at: "2026-10-17T20:00:00Z", items_count: 4, subtotal: 160,
  items: [
    { id: "i1", product_id: null, variant_id: null, name: "Heineken 600 ml", unit: null, quantity: 4, unit_price: 14, total: 56 },
    { id: "i2", product_id: null, variant_id: null, name: "Porção de fritas", unit: null, quantity: 1, unit_price: 38, total: 38 },
    { id: "i3", product_id: null, variant_id: null, name: "Caipirinha", unit: null, quantity: 3, unit_price: 18, total: 54 },
    { id: "i4", product_id: null, variant_id: null, name: "Água", unit: null, quantity: 2, unit_price: 6, total: 12 },
  ],
};

function porId(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props.testID === id, { deep: false })[0];
}
function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  const c = node.children || [];
  return c.map(texto).join("");
}
async function esperar() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => { jest.clearAllMocks(); });

describe("as contas da divisão", () => {
  it("partes iguais em centavos certos, sobra na primeira pessoa", () => {
    expect(partesIguais(160, 3)).toEqual([53.34, 53.33, 53.33]);
    expect(partesIguais(160, 2)).toEqual([80, 80]);
    expect(partesIguais(176, 6)).toEqual([29.35, 29.33, 29.33, 29.33, 29.33, 29.33]);
    expect(partesIguais(0.1, 3)).toEqual([0.04, 0.03, 0.03]);
    expect(partesIguais(10, 0)).toEqual([]);
    for (const n of [2, 3, 4, 5, 6]) expect(somaDasPartes(partesIguais(99.99, n))).toBe(99.99);
  });

  it("soma, diferença e confere ao centavo; parte zerada não confere", () => {
    expect(somaDasPartes([53.34, 53.33, 53.33])).toBe(160);
    expect(diferencaDaDivisao([53.34, 50, 53.33], 160)).toBe(3.33);
    expect(diferencaDaDivisao([60, 53.33, 53.33], 160)).toBe(-6.66);
    expect(divisaoConfere([53.34, 53.33, 53.33], 160)).toBe(true);
    expect(divisaoConfere([160, 0], 160)).toBe(false);
    expect(divisaoConfere([], 160)).toBe(false);
  });

  it("valor digitado com vírgula, ponto de milhar e R$", () => {
    expect(valorDigitado("53,33")).toBe(53.33);
    expect(valorDigitado("R$ 1.234,50")).toBe(1234.5);
    expect(valorDigitado("53.3")).toBe(53.3);
    expect(valorDigitado("")).toBeNull();
    expect(valorDigitado("abc")).toBeNull();
    expect(valorNoCampo(53.3)).toBe("53,30");
  });
});

describe("FecharComandaModal — Dividir a conta", () => {
  async function abrir(onCobrar = jest.fn()) {
    mockApi.get.mockResolvedValue({ comanda: COMANDA });
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FecharComandaModal visible companyId="e1" loja="Adega" onClose={jest.fn()} onCobrar={onCobrar} numeroInicial={12} />
      );
    });
    await esperar();
    return { tree, onCobrar };
  }

  it("dividir por 3: as partes somam o total, o botão só libera quando a soma bate", async () => {
    const { tree, onCobrar } = await abrir();
    expect(texto(porId(tree, "fechar-comanda-titulo"))).toBe("Cobrar comanda 12 · João");
    expect(porId(tree, "fechar-comanda-divisao")).toBeUndefined();

    act(() => { porId(tree, "fechar-comanda-modo-dividir").props.onPress(); });
    expect(porId(tree, "fechar-comanda-divisao")).toBeDefined();
    expect([0, 1, 2].map((i) => porId(tree, "dividir-valor-" + i).props.value)).toEqual(["53,34", "53,33", "53,33"]);
    expect(porId(tree, "dividir-valor-3")).toBeUndefined();
    expect(texto(porId(tree, "dividir-soma"))).toBe("R$ 160,00");
    expect(texto(porId(tree, "dividir-confere"))).toBe("Confere com a comanda");
    expect(porId(tree, "fechar-comanda-cobrar").props.disabled).toBe(false);
    expect(texto(porId(tree, "fechar-comanda-cobrar"))).toBe("Cobrar R$ 160,00");

    // a pessoa 2 paga menos: falta, e o botão trava
    act(() => { porId(tree, "dividir-valor-1").props.onChangeText("50,00"); });
    expect(texto(porId(tree, "dividir-confere"))).toBe("Faltam R$ 3,33");
    expect(porId(tree, "fechar-comanda-cobrar").props.disabled).toBe(true);
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).not.toHaveBeenCalled();

    // a pessoa 1 cobre a diferença: confere de novo
    act(() => { porId(tree, "dividir-valor-0").props.onChangeText("56,67"); });
    expect(texto(porId(tree, "dividir-confere"))).toBe("Confere com a comanda");
    expect(porId(tree, "fechar-comanda-cobrar").props.disabled).toBe(false);

    // sobra também trava
    act(() => { porId(tree, "dividir-valor-2").props.onChangeText("60"); });
    expect(texto(porId(tree, "dividir-confere"))).toBe("Sobram R$ 6,67");
    expect(porId(tree, "fechar-comanda-cobrar").props.disabled).toBe(true);
    act(() => { porId(tree, "dividir-valor-2").props.onChangeText("53,33"); });

    // formas: Pix (padrão), Cartão, Dinheiro
    act(() => { porId(tree, "dividir-forma-1-cartao").props.onPress(); });
    act(() => { porId(tree, "dividir-forma-2-dinheiro").props.onPress(); });
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).toHaveBeenCalledWith(COMANDA, 0, {
      partes: [
        { method: "pix", value: 56.67 },
        { method: "cartao", value: 50 },
        { method: "dinheiro", value: 53.33 },
      ],
    });
  });

  it("trocar o número de pessoas e marcar a taxa refazem as partes iguais", async () => {
    const { tree, onCobrar } = await abrir();
    act(() => { porId(tree, "fechar-comanda-modo-dividir").props.onPress(); });
    act(() => { porId(tree, "dividir-pessoas-2").props.onPress(); });
    expect([0, 1].map((i) => porId(tree, "dividir-valor-" + i).props.value)).toEqual(["80,00", "80,00"]);
    expect(porId(tree, "dividir-valor-2")).toBeUndefined();

    // taxa de 10% sobre o que está sendo cobrado: 176 em 2
    act(() => { porId(tree, "fechar-comanda-taxa").props.onPress(); });
    expect(texto(porId(tree, "fechar-comanda-total"))).toBe("R$ 176,00");
    expect([0, 1].map((i) => porId(tree, "dividir-valor-" + i).props.value)).toEqual(["88,00", "88,00"]);
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).toHaveBeenCalledWith(COMANDA, 10, {
      partes: [{ method: "pix", value: 88 }, { method: "pix", value: 88 }],
    });
  });

  it("Cobrar tudo continua o de sempre: lista os itens e manda só comanda e taxa", async () => {
    const { tree, onCobrar } = await abrir();
    act(() => { porId(tree, "fechar-comanda-modo-dividir").props.onPress(); });
    act(() => { porId(tree, "fechar-comanda-modo-tudo").props.onPress(); });
    expect(porId(tree, "fechar-comanda-divisao")).toBeUndefined();
    expect(texto(porId(tree, "fechar-comanda-consumo"))).toContain("Porção de fritas");
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).toHaveBeenCalledTimes(1);
    expect(onCobrar.mock.calls[0]).toEqual([COMANDA, 0]);
  });
});
