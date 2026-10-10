// ============================================================
// Comandas do Caixa (09/10/2026) — os dois modais, render.
//
// O que estes testes seguram:
//  1. Adicionar: sem número o botão não lança; com número lança ESSE
//     número; tocar numa comanda aberta preenche o número e avisa que soma.
//  2. Fechar: buscar lista o consumo e soma; a taxa de 10% entra só quando
//     marcada; "Cobrar" devolve a comanda e o percentual escolhido.
//  3. Fechar: comanda que não existe mostra o aviso e não libera "Cobrar".
//  4. Fechar: cancelar a comanda pede o segundo toque.
//
// Mesmo padrão de appointmentDetailModal.test.tsx: react-native mockado com
// tags simples e asserção por testID.
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

let mockAbertas: any[] = [];
const mockRefetch = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { comandas: mockAbertas }, isLoading: false, refetch: mockRefetch }),
}));

import { AdicionarAComandaModal, FecharComandaModal } from "@/components/screens/pdv/ComandaModals";

const COMANDA = {
  id: "c-12", number: 12, status: "open", opened_at: "2026-10-09T22:00:00Z", items_count: 2, subtotal: 74,
  items: [
    { id: "i1", product_id: null, variant_id: null, name: "Copão Gin", unit: null, quantity: 2, unit_price: 25, total: 50 },
    { id: "i2", product_id: null, variant_id: null, name: "Cerveja 600 ml", unit: null, quantity: 2, unit_price: 12, total: 24 },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockAbertas = [{ id: "c-12", number: 12, status: "open", opened_at: "", items_count: 2, subtotal: 74 }];
});

describe("AdicionarAComandaModal", () => {
  function montar(onConfirm = jest.fn()) {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AdicionarAComandaModal visible companyId="e1" itemCount={3} total={61} saving={false} onClose={jest.fn()} onConfirm={onConfirm} />
      );
    });
    return { tree, onConfirm };
  }

  it("sem número não lança; com número lança esse número", () => {
    const { tree, onConfirm } = montar();
    expect(porId(tree, "comanda-lancar").props.disabled).toBe(true);
    act(() => { porId(tree, "comanda-lancar").props.onPress(); });
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => { porId(tree, "comanda-numero").props.onChangeText("0a7"); });
    expect(porId(tree, "comanda-numero").props.value).toBe("07");
    expect(texto(porId(tree, "comanda-lancar"))).toBe("Lançar na comanda 7");
    expect(texto(tree.root)).toContain("A comanda 7 será aberta");
    act(() => { porId(tree, "comanda-lancar").props.onPress(); });
    expect(onConfirm).toHaveBeenCalledWith(7);
  });

  it("tocar numa comanda aberta preenche o número e avisa que soma", () => {
    const { tree, onConfirm } = montar();
    act(() => { porId(tree, "comanda-aberta-12").props.onPress(); });
    expect(porId(tree, "comanda-numero").props.value).toBe("12");
    expect(texto(tree.root)).toContain("A comanda 12 já tem R$ 74,00");
    act(() => { porId(tree, "comanda-numero").props.onSubmitEditing(); });
    expect(onConfirm).toHaveBeenCalledWith(12);
  });
});

describe("FecharComandaModal", () => {
  function montar(onCobrar = jest.fn()) {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FecharComandaModal visible companyId="e1" loja="Adega" onClose={jest.fn()} onCobrar={onCobrar} onMudou={jest.fn()} />
      );
    });
    return { tree, onCobrar };
  }

  it("lista e soma o consumo; a taxa de 10% só entra marcada; Cobrar devolve a comanda e o percentual", async () => {
    mockApi.get.mockResolvedValue({ comanda: COMANDA });
    const { tree, onCobrar } = montar();
    expect(porId(tree, "fechar-comanda-cobrar").props.disabled).toBe(true);

    act(() => { porId(tree, "fechar-comanda-numero").props.onChangeText("12"); });
    act(() => { porId(tree, "fechar-comanda-buscar").props.onPress(); });
    await esperar();
    expect(mockApi.get).toHaveBeenCalledWith("e1", 12);

    const consumo = texto(porId(tree, "fechar-comanda-consumo"));
    expect(consumo).toContain("Copão Gin");
    expect(consumo).toContain("Cerveja 600 ml");
    expect(texto(porId(tree, "fechar-comanda-total"))).toBe("R$ 74,00");
    expect(texto(porId(tree, "fechar-comanda-cobrar"))).toBe("Cobrar R$ 74,00");

    act(() => { porId(tree, "fechar-comanda-taxa").props.onPress(); });
    expect(texto(porId(tree, "fechar-comanda-total"))).toBe("R$ 81,40");
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).toHaveBeenCalledWith(COMANDA, 10);

    act(() => { porId(tree, "fechar-comanda-taxa").props.onPress(); });
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).toHaveBeenLastCalledWith(COMANDA, 0);
  });

  it("comanda que não existe: aviso e Cobrar continua travado", async () => {
    mockApi.get.mockRejectedValue({ status: 404, data: { code: "COMANDA_NOT_FOUND" } });
    const { tree, onCobrar } = montar();
    act(() => { porId(tree, "fechar-comanda-numero").props.onChangeText("99"); });
    act(() => { porId(tree, "fechar-comanda-numero").props.onSubmitEditing(); });
    await esperar();
    expect(texto(porId(tree, "fechar-comanda-erro"))).toBe("Não há comanda 99 aberta.");
    expect(porId(tree, "fechar-comanda-cobrar").props.disabled).toBe(true);
    act(() => { porId(tree, "fechar-comanda-cobrar").props.onPress(); });
    expect(onCobrar).not.toHaveBeenCalled();
  });

  it("sem número digitado, Buscar avisa e não chama a API", () => {
    const { tree } = montar();
    act(() => { porId(tree, "fechar-comanda-buscar").props.onPress(); });
    expect(mockApi.get).not.toHaveBeenCalled();
    expect(texto(porId(tree, "fechar-comanda-erro"))).toBe("Digite o número da comanda.");
  });

  it("cancelar a comanda pede o segundo toque", async () => {
    mockApi.get.mockResolvedValue({ comanda: COMANDA });
    mockApi.cancel.mockResolvedValue({ ok: true, number: 12 });
    const { tree } = montar();
    act(() => { porId(tree, "comanda-aberta-12").props.onPress(); });
    await esperar();
    act(() => { porId(tree, "fechar-comanda-cancelar").props.onPress(); });
    expect(mockApi.cancel).not.toHaveBeenCalled();
    expect(texto(porId(tree, "fechar-comanda-cancelar"))).toBe("Toque de novo para cancelar");
    act(() => { porId(tree, "fechar-comanda-cancelar").props.onPress(); });
    await esperar();
    expect(mockApi.cancel).toHaveBeenCalledWith("e1", 12);
    expect(porId(tree, "fechar-comanda-consumo")).toBeUndefined();
  });
});
