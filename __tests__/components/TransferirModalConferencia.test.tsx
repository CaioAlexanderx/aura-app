// ============================================================
// p-108 (entrega C): TransferirModal aberto pela conferência.
//
//   1. Sem as props novas, o modal é o de hoje: campos vazios, só os
//      produtos com grade até 5 abrem sozinhos, e o corpo do POST não
//      ganha stock_count_id.
//   2. Com quantidadesIniciais + stockCountId: campos preenchidos, a grade
//      do produto com variante preenchida abre mesmo com mais de 5 produtos
//      com grade, e o POST leva stock_count_id.
//
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  TextInput: "TextInput",
  ActivityIndicator: "ActivityIndicator",
  Modal: ({ visible, children }: any) => (visible ? children : null),
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: 375, height: 800 }),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: false }));
jest.mock("@/components/screens/estoque/VariantesConsulta", () => ({ rotuloDaVariante: (v: any) => v.rotulo || "Variante" }));

const mockVariantes = jest.fn();
jest.mock("@/services/api", () => ({ companiesApi: { variants: (...a: any[]) => mockVariantes(...a) } }));
const mockCriar = jest.fn();
jest.mock("@/services/estoqueTransferenciasApi", () => ({
  estoqueTransferenciasApi: { criar: (...a: any[]) => mockCriar(...a) },
  codigoDoErro: (e: any) => (e && e.data && e.data.code) || null,
}));

import { TransferirModal, type ProdutoParaTransferir } from "@/components/screens/estoque/transferencia/TransferirModal";

function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function um(tree: renderer.ReactTestRenderer, id: string) {
  const nos = porTestID(tree, id);
  expect(nos.length).toBeGreaterThan(0);
  return nos[0];
}
async function tocar(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { um(tree, id).props.onPress(); });
}

const ORIGEM = { id: "c1", nome: "Loja Centro" };
const DESTINOS = [{ id: "c2", nome: "Loja Shopping" }];
const SIMPLES: ProdutoParaTransferir[] = [
  { id: "p1", name: "Cinto de couro", stock: 12, unit: "un" },
  { id: "p2", name: "Lenço de seda", stock: 3, unit: "un" },
];
// 6 produtos com grade: acima do "abre sozinho até 5".
const SEIS_COM_GRADE: ProdutoParaTransferir[] = [1, 2, 3, 4, 5, 6].map((n) => ({ id: "g" + n, name: "Vestido " + n, stock: 4, unit: "un", has_variants: true }));

async function montar(produtos: ProdutoParaTransferir[], extra: any = {}) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<TransferirModal origem={ORIGEM} destinos={DESTINOS} produtos={produtos} onFechar={jest.fn()} {...extra} />);
  });
  return tree;
}

beforeEach(() => {
  mockVariantes.mockReset();
  mockCriar.mockReset();
  mockVariantes.mockImplementation((_c: string, pid: string) => Promise.resolve({
    variants: [{ id: pid + "-v1", rotulo: "P", stock_qty: "4", is_active: true }],
  }));
  mockCriar.mockResolvedValue({ transferencia: { id: "t1", numero: 7, total_pecas: 2 } });
});

describe("sem as props novas: igual a hoje", () => {
  it("campos vazios e POST sem stock_count_id", async () => {
    const tree = await montar(SIMPLES);
    expect(um(tree, "transferir-qtd-p:p1").props.value).toBe("");
    expect(um(tree, "transferir-qtd-p:p2").props.value).toBe("");
    await act(async () => { um(tree, "transferir-qtd-p:p1").props.onChangeText("2"); });
    await tocar(tree, "transferir-revisar");
    await tocar(tree, "transferir-confirmar");
    expect(mockCriar).toHaveBeenCalledTimes(1);
    const corpo = mockCriar.mock.calls[0][1];
    expect(corpo).toEqual({ destino_company_id: "c2", itens: [{ product_id: "p1", variant_id: null, quantidade: 2 }], observacao: null });
    expect(Object.prototype.hasOwnProperty.call(corpo, "stock_count_id")).toBe(false);
  });

  it("com mais de 5 produtos com grade, nenhuma grade abre sozinha", async () => {
    await montar(SEIS_COM_GRADE);
    expect(mockVariantes).not.toHaveBeenCalled();
  });
});

describe("aberto pela conferência", () => {
  it("quantidades preenchidas e stock_count_id no POST", async () => {
    const tree = await montar(SIMPLES, { quantidadesIniciais: { "p:p2": "1" }, stockCountId: "k9" });
    expect(um(tree, "transferir-qtd-p:p2").props.value).toBe("1");
    expect(um(tree, "transferir-qtd-p:p1").props.value).toBe("");
    await tocar(tree, "transferir-revisar");
    await tocar(tree, "transferir-confirmar");
    expect(mockCriar.mock.calls[0][0]).toBe("c1");
    expect(mockCriar.mock.calls[0][1]).toEqual({
      destino_company_id: "c2", itens: [{ product_id: "p2", variant_id: null, quantidade: 1 }], observacao: null, stock_count_id: "k9",
    });
  });

  it("grade com variante preenchida abre mesmo acima de 5 produtos com grade", async () => {
    const tree = await montar(SEIS_COM_GRADE, { quantidadesIniciais: { "v:g6:g6-v1": "2" }, stockCountId: "k9" });
    expect(mockVariantes).toHaveBeenCalledTimes(1);
    expect(mockVariantes.mock.calls[0][1]).toBe("g6");
    expect(um(tree, "transferir-qtd-v:g6:g6-v1").props.value).toBe("2");
    await tocar(tree, "transferir-revisar");
    await tocar(tree, "transferir-confirmar");
    expect(mockCriar.mock.calls[0][1].itens).toEqual([{ product_id: "g6", variant_id: "g6-v1", quantidade: 2 }]);
    expect(mockCriar.mock.calls[0][1].stock_count_id).toBe("k9");
  });
});
