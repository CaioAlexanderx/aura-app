// ============================================================
// O editor não reenvia o pedaço do SKU como nome da cor (14/11/2026)
//
// O GET /variations devolvia o pedaço do sku_suffix ("AZUL ESCUR", cortado
// em 10) como nome da cor; o Salvar mandava de volta e o backend gravava.
// Agora o GET manda name null + name_sugerido, e o editor:
//   1. mostra o pedaço como antes (a tela não muda);
//   2. no Salvar, manda name null para a cor sem nome gravado;
//   3. manda o nome gravado e o nome da cor escolhida na paleta.
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

import { coresDoServidor, nomeDaCorParaGravar } from "@/components/screens/estoque/item-form/types";

const VESTIDO: any = {
  id: "p-1", name: "Vestido Midi", code: "VES-1", barcode: "", category: "Roupas", price: 189.9,
  cost: 60, stock: 5, minStock: 0, unit: "un", brand: "", notes: "", color: "", size: "",
  has_variants: true, isGroupShared: false,
};

beforeEach(() => {
  mockUpdateProduct.mockReset().mockResolvedValue(true);
  mockSave.mockReset().mockResolvedValue({});
});

describe("coresDoServidor / nomeDaCorParaGravar", () => {
  const paleta = (h: string) => (h.toUpperCase() === "#FAF9F6" ? "Branco" : "Cinza");

  test("nome gravado: mostra e devolve o nome", () => {
    const [c] = coresDoServidor([{ hex: "#c3b091", name: "Caqui", name_sugerido: null }], paleta);
    expect(c).toEqual({ hex: "#C3B091", name: "Caqui" });
    expect(nomeDaCorParaGravar(c)).toBe("Caqui");
  });

  test("sem nome gravado: mostra o pedaço do sufixo e devolve null", () => {
    const [c] = coresDoServidor([{ hex: "#1F2A44", name: null, name_sugerido: "AZUL ESCUR" }], paleta);
    expect(c).toEqual({ hex: "#1F2A44", name: "AZUL ESCUR", nomeSoParaMostrar: true });
    expect(nomeDaCorParaGravar(c)).toBeNull();
  });

  test("sem nome nem sugestão: mostra a paleta e devolve null", () => {
    const [c] = coresDoServidor([{ hex: "#FAF9F6", name: null }], paleta);
    expect(c.name).toBe("Branco");
    expect(nomeDaCorParaGravar(c)).toBeNull();
  });

  test("cor escolhida na tela (sem a marca) vai com o nome; vazio vai null", () => {
    expect(nomeDaCorParaGravar({ hex: "#3B82F6", name: "Azul" })).toBe("Azul");
    expect(nomeDaCorParaGravar({ hex: "#3B82F6", name: "  " })).toBeNull();
  });
});

describe("Salvar a grade no editor", () => {
  test("a tela mostra o pedaço como antes, mas o Salvar não o reenvia", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
    const cores = secao(tree).props.cores;
    expect(cores.map((c: any) => c.name)).toEqual(["OFF WHITE", "Caqui"]);

    act(() => { secao(tree).props.onCelula("#FAF9F6|M", "4"); });
    await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });

    expect(mockSave).toHaveBeenCalledTimes(1);
    const corpo = mockSave.mock.calls[0][2];
    expect(corpo.colors).toEqual([
      { hex: "#FAF9F6", name: null },
      { hex: "#C3B091", name: "Caqui" },
    ]);
    tree.unmount();
  });

  test("cor nova escolhida na paleta vai com o nome dela", async () => {
    const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
    const atuais = secao(tree).props.cores;
    act(() => { secao(tree).props.onCores([...atuais, { hex: "#3B82F6", name: "Azul" }]); });
    await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });

    const corpo = mockSave.mock.calls[0][2];
    expect(corpo.colors).toEqual([
      { hex: "#FAF9F6", name: null },
      { hex: "#C3B091", name: "Caqui" },
      { hex: "#3B82F6", name: "Azul" },
    ]);
    tree.unmount();
  });
});
