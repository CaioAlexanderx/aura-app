// ============================================================
// Transferir x peças com clientes (pós-C14, venda condicional).
//
//   1. Produto com grade: cada variante oferece estoque − com clientes
//      (por variante); "Tudo" preenche só o livre; passar do livre é erro
//      de tela e o servidor confere de novo.
//   2. Produto sem grade: o mesmo.
//   3. Regressão: sem a trava (comClientesLiberado) ou sem peça fora, o
//      modal é o de sempre (disponível = estoque, sem texto novo), mesmo
//      que o produto traga outQty.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

var mockLargura = 1024;
jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  TextInput: "TextInput",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: mockLargura, height: 800 }),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: true }));
jest.mock("@/components/screens/estoque/VariantesConsulta", () => ({ rotuloDaVariante: (v: any) => v.rotulo || "Variante" }));

const mockVariantes = jest.fn();
jest.mock("@/services/api", () => ({ companiesApi: { variants: (...a: any[]) => mockVariantes(...a) } }));
const mockCriar = jest.fn();
jest.mock("@/services/estoqueTransferenciasApi", () => ({
  estoqueTransferenciasApi: { criar: (...a: any[]) => mockCriar(...a) },
  codigoDoErro: (e: any) => (e && e.data && e.data.code) || null,
}));

import { TransferirModal, type ProdutoParaTransferir } from "@/components/screens/estoque/transferencia/TransferirModal";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function um(tree: renderer.ReactTestRenderer, id: string) {
  const nos = porTestID(tree, id);
  expect(nos.length).toBeGreaterThan(0);
  return nos[0];
}
function textoDe(tree: renderer.ReactTestRenderer, id: string): string {
  return porTestID(tree, id).map((n) => flattenText(n.children)).join("");
}
async function tocar(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { um(tree, id).props.onPress(); });
}
async function digitar(tree: renderer.ReactTestRenderer, id: string, v: string) {
  await act(async () => { um(tree, id).props.onChangeText(v); });
}
function estilo(no: any): any {
  const st = no.props.style;
  return Array.isArray(st) ? Object.assign({}, ...st.filter(Boolean)) : st;
}

const ORIGEM = { id: "c1", nome: "Loja Centro" };
const DESTINOS = [{ id: "c2", nome: "Loja Shopping" }];
const GRADE = { variants: [
  { id: "v1", rotulo: "Azul · P", stock_qty: "5" },
  { id: "v2", rotulo: "Azul · M", stock_qty: "3" },
] };

async function montar(produtos: ProdutoParaTransferir[], liberado?: boolean) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <TransferirModal origem={ORIGEM} destinos={DESTINOS} produtos={produtos} comClientesLiberado={liberado}
        onFechar={jest.fn()} onEstoqueMudou={jest.fn()} onConcluido={jest.fn()} />,
    );
  });
  return tree;
}

beforeEach(() => { mockLargura = 1024; mockVariantes.mockReset(); mockCriar.mockReset(); });

const VESTIDO: ProdutoParaTransferir = { id: "p9", name: "Vestido midi", stock: 8, unit: "un", has_variants: true, outQty: 4, outByVariant: { v1: 3, v2: 1 } };
const CINTO: ProdutoParaTransferir = { id: "p1", name: "Cinto", stock: 10, unit: "un", outQty: 4, outByVariant: {} };

describe("com a trava: só o livre", () => {
  it("grade: cada variante desconta o seu com clientes", async () => {
    mockVariantes.mockResolvedValueOnce(GRADE);
    const tree = await montar([VESTIDO], true);
    expect(textoDe(tree, "transferir-disp-v:p9:v1")).toBe("Tem 2 · 3 com clientes");
    expect(textoDe(tree, "transferir-disp-v:p9:v2")).toBe("Tem 2 · 1 com clientes");
    await tocar(tree, "transferir-tudo-v:p9:v1");
    expect(um(tree, "transferir-qtd-v:p9:v1").props.value).toBe("2");
  });

  it("grade: pedir mais que o livre dá erro de tela e não deixa revisar", async () => {
    mockVariantes.mockResolvedValueOnce(GRADE);
    const tree = await montar([VESTIDO], true);
    await digitar(tree, "transferir-qtd-v:p9:v1", "4"); // estoque 5, mas 3 estão fora
    await tocar(tree, "transferir-revisar");
    expect(porTestID(tree, "transferir-confirmar")).toHaveLength(0);
    expect(mockCriar).not.toHaveBeenCalled();
    expect(textoDe(tree, "transferir-erro-v:p9:v1")).toMatch(/Só tem 2/);
  });

  it("sem grade: estoque menos com clientes", async () => {
    const tree = await montar([CINTO], true);
    expect(textoDe(tree, "transferir-disp-p:p1")).toBe("Tem 6 · 4 com clientes");
    await tocar(tree, "transferir-tudo-p:p1");
    expect(um(tree, "transferir-qtd-p:p1").props.value).toBe("6");
  });

  it("peça fora maior que o estoque: oferece 0, nunca negativo", async () => {
    const tree = await montar([{ ...CINTO, stock: 2 }], true);
    expect(textoDe(tree, "transferir-disp-p:p1")).toBe("Tem 0 · 4 com clientes");
  });
});

describe("regressão: sem a trava o modal é o de sempre", () => {
  it("sem a prop: disponível = estoque, sem texto novo", async () => {
    mockVariantes.mockResolvedValueOnce(GRADE);
    const tree = await montar([VESTIDO, CINTO]);
    expect(textoDe(tree, "transferir-disp-v:p9:v1")).toBe("Tem 5");
    expect(textoDe(tree, "transferir-disp-p:p1")).toBe("Tem 10");
  });

  it("trava ligada mas produto sem peça fora: igual a antes", async () => {
    const tree = await montar([{ id: "p2", name: "Lenço", stock: 3, unit: "un" }], true);
    expect(textoDe(tree, "transferir-disp-p:p2")).toBe("Tem 3");
  });
});
