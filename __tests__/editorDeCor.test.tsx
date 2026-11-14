// ============================================================
// Editor de cor do item (CP4a da revisão de cores, 14/11/2026)
//
// Paleta com nome e busca, nome próprio com amostra e renomear. REGRA
// CRÍTICA: o editor nunca grava sozinho um nome da paleta nova no
// color_name de uma cor antiga (mudaria a etiqueta sem ela pedir): a cor
// sem nome gravado só ganha nome quando a lojista RENOMEIA, e aí o PUT
// manda name_confirmado.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/components/BarcodeQRSection", () => ({ BarcodeQRSection: () => null }));
jest.mock("@/components/catalog/CategoryTreePicker", () => ({ CategoryTreePicker: () => null }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: () => null }));

// Uma cor antiga (color_name NULL: o GET manda name null e o pedaço do
// sufixo em name_sugerido) e uma com nome gravado.
const mockVariacoes = {
  product_id: "p-1",
  product_name: "Vestido",
  colors: [
    { hex: "#FAF9F6", name: null, name_sugerido: "OFF WHITE" },
    { hex: "#C3B091", name: "Caqui", name_sugerido: null },
  ],
  sizes: ["M"],
  matrix: { "#FAF9F6|M": 3, "#C3B091|M": 2 },
  barcodes: {},
  images: {},
  mode: "matrix",
  total_variants: 2,
};
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => {
    if (o.queryKey && o.queryKey[0] === "productVariations" && o.enabled) {
      return { data: mockVariacoes, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t" }) }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
const mockUpdateProduct = jest.fn();
jest.mock("@/hooks/useProducts", () => {
  const real = jest.requireActual("@/hooks/useProducts");
  return {
    camposNfseDoCorpo: real.camposNfseDoCorpo,
    useProducts: () => ({ products: [], addProduct: jest.fn(), updateProduct: mockUpdateProduct }),
  };
});
jest.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ byId: {}, assignProductCategories: jest.fn(), flattened: [], tree: [] }),
}));
jest.mock("@/hooks/useProductCategories", () => ({ useProductCategories: () => ({ categories: [] }) }));
jest.mock("@/hooks/useEmiteNfse", () => ({ useEmiteNfse: () => false }));
jest.mock("@/services/api", () => ({
  companiesApi: { checkDuplicate: jest.fn().mockResolvedValue({ duplicates: [] }) },
  request: jest.fn(),
}));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { getConfig: jest.fn() } }));
jest.mock("@/services/productImagesApi", () => ({ productImagesApi: { upload: jest.fn(), list: jest.fn() } }));
const mockSave = jest.fn();
jest.mock("@/services/productsVariationsApi", () => ({
  matrixKey: (hex: string | null, size: string | null) => (hex || "") + "|" + (size || ""),
  productsVariationsApi: { get: jest.fn(), save: (...a: any[]) => mockSave(...a) },
}));
jest.mock("@/services/matconApi", () => ({ matconApi: { createLot: jest.fn() } }));

import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import { SecaoEstoque } from "@/components/screens/estoque/item-form/SecaoEstoque";

function textoDe(node: any): string {
  return node.findAllByType(Text).map((t: any) => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join("") : String(c ?? "");
  }).join(" ");
}
function botao(tree: any, rotulo: string): any {
  return tree.root.findAll((n: any) => n.type === Pressable && textoDe(n).indexOf(rotulo) >= 0)[0];
}
function porId(tree: any, id: string): any[] {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
async function montar(el: React.ReactElement) {
  let tree: any;
  await act(async () => { tree = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}
function secao(tree: any): any {
  return tree.root.findByType(SecaoEstoque);
}

import { EditorDeCor } from "@/components/screens/estoque/item-form/EditorDeCor";
import {
  paletaFiltrada, comCorDaPaleta, comNomeProprio, renomear, sugestoesParaAmostra, hexValido,
} from "@/components/screens/estoque/item-form/regrasDaCor";
import { TextInput } from "react-native";

const VESTIDO: any = {
  id: "p-1", name: "Vestido Midi", code: "VES-1", barcode: "", category: "Roupas", price: 189.9,
  cost: 60, stock: 5, minStock: 0, unit: "un", brand: "", notes: "", color: "", size: "",
  has_variants: true, isGroupShared: false,
};

function porRotulo(tree: any, rotulo: string): any {
  return tree.root.findAll((n: any) => n.type === Pressable && n.props.accessibilityLabel === rotulo)[0];
}
function campo(tree: any, rotulo: string): any {
  return tree.root.findAll((n: any) => n.type === TextInput && n.props.accessibilityLabel === rotulo)[0];
}

beforeEach(() => {
  mockUpdateProduct.mockReset().mockResolvedValue(true);
  mockSave.mockReset().mockResolvedValue({});
});

describe("regras do editor", () => {
  const nomes = (q: string) => paletaFiltrada(q).flatMap((f) => f.cores.map((c) => c.nome));
  test("a busca acha pelo nome, apelido ou família, com ou sem acento", () => {
    expect(nomes("caq")).toEqual(["Caqui"]);
    expect(nomes("off")).toEqual(["Off white"]);
    expect(nomes("marinho")).toEqual(["Azul-marinho"]);
    expect(nomes("verde agua")).toEqual(["Verde-água"]);
    expect(nomes("lilas")).toEqual(["Lilás"]);
    expect(nomes("Roxos")).toEqual(["Roxo", "Violeta", "Lilás", "Uva"]);
    expect(paletaFiltrada("")).toHaveLength(7);
    expect(paletaFiltrada("rosa chiclete")).toEqual([]);
  });
  test("paleta e nome próprio não duplicam a amostra", () => {
    const caqui = paletaFiltrada("caqui")[0].cores[0];
    const um = comCorDaPaleta([], caqui);
    expect(um).toEqual([{ hex: "#C3B091", name: "Caqui" }]);
    expect(comCorDaPaleta(um, caqui)).toBe(um);
    expect(comNomeProprio(um, "Areia", "#c3b091")).toBe(um);
    expect(comNomeProprio(um, "Areia", "#d9c7a7")).toEqual([...um, { hex: "#D9C7A7", name: "Areia", nomeConfirmado: true }]);
    expect(comNomeProprio(um, "  ", "#d9c7a7")).toBe(um);
  });
  test("renomear: mesmo nome ou vazio não mexe (a cor antiga continua sem nome gravado)", () => {
    const antiga = [{ hex: "#1F2A44", name: "AZUL ESCUR", nomeSoParaMostrar: true }];
    expect(renomear(antiga, "#1F2A44", "AZUL ESCUR")).toEqual(antiga);
    expect(renomear(antiga, "#1F2A44", "  ")).toEqual(antiga);
    expect(renomear(antiga, "#1f2a44", "Azul escuro")).toEqual([{ hex: "#1F2A44", name: "Azul escuro", nomeConfirmado: true }]);
  });
  test("sugestões pela amostra e hex digitado", () => {
    expect(sugestoesParaAmostra("#C3B091")[0]).toBe("Caqui");
    expect(hexValido("c3b091")).toBe("#C3B091");
    expect(hexValido("caqui")).toBeNull();
  });
});

describe("no modal do item", () => {
  test("REGRA CRÍTICA: adicionar uma cor da paleta não dá nome à cor antiga", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
    await act(async () => { botao(tree, "+ Cor").props.onPress(); });
    await act(async () => { porRotulo(tree, "Adicionar Azul escuro").props.onPress(); });
    await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
    expect(mockSave.mock.calls[0][2].colors).toEqual([
      { hex: "#FAF9F6", name: null },
      { hex: "#C3B091", name: "Caqui" },
      { hex: "#1C2F6B", name: "Azul escuro" },
    ]);
    tree.unmount();
  });

  test("abrir 'Nome desta cor' e fechar sem trocar também não dá nome", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
    await act(async () => { porRotulo(tree, "Nome da cor OFF WHITE").props.onPress(); });
    await act(async () => { porRotulo(tree, "Salvar o nome da cor").props.onPress(); });
    act(() => { secao(tree).props.onCelula("#FAF9F6|M", "4"); });
    await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
    expect(mockSave.mock.calls[0][2].colors[0]).toEqual({ hex: "#FAF9F6", name: null });
    tree.unmount();
  });

  test("renomear a cor antiga manda o nome confirmado", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
    await act(async () => { porRotulo(tree, "Nome da cor OFF WHITE").props.onPress(); });
    await act(async () => { campo(tree, "Novo nome da cor").props.onChangeText("Off White"); });
    await act(async () => { porRotulo(tree, "Salvar o nome da cor").props.onPress(); });
    await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
    expect(mockSave.mock.calls[0][2].colors).toEqual([
      { hex: "#FAF9F6", name: "Off White", name_confirmado: true },
      { hex: "#C3B091", name: "Caqui" },
    ]);
    tree.unmount();
  });

  test("nome próprio com amostra digitada entra confirmado", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
    await act(async () => { botao(tree, "+ Cor").props.onPress(); });
    await act(async () => { campo(tree, "Nome da cor").props.onChangeText("Areia"); });
    await act(async () => { campo(tree, "Hex da amostra").props.onChangeText("#D9C7A7"); });
    await act(async () => { porRotulo(tree, "Adicionar a cor com nome próprio").props.onPress(); });
    await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
    expect(mockSave.mock.calls[0][2].colors[2]).toEqual({ hex: "#D9C7A7", name: "Areia", name_confirmado: true });
    tree.unmount();
  });

  test("o editor sozinho: busca filtra e a cor já adicionada fica marcada", async () => {
    const onCores = jest.fn();
    const tree = await montar(<EditorDeCor cores={[{ hex: "#C3B091", name: "Caqui" }]} onCores={onCores} />);
    await act(async () => { botao(tree, "+ Cor").props.onPress(); });
    await act(async () => { campo(tree, "Buscar cor pelo nome").props.onChangeText("caq"); });
    const ja = porRotulo(tree, "Já adicionada: Caqui");
    expect(ja).toBeTruthy();
    expect(ja.props.disabled).toBe(true);
    expect(porRotulo(tree, "Adicionar Preto")).toBeUndefined();
    tree.unmount();
  });
});
