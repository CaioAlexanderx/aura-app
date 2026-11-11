// ============================================================
// Editar a grade não deixa estoque preso (10/11/2026)
//
// O backend passou a atualizar a grade no lugar e recusa tirar da grade
// uma cor/tamanho com peças sem confirmação. O modal:
//   1. pergunta ANTES de gravar qualquer coisa (nem o PATCH do produto vai);
//   2. com "Remover mesmo assim", grava e manda confirmar_remocao_com_estoque;
//   3. manda matrix_lida (o que a grade leu ao abrir) em todo PUT da edição;
//   4. mexer só numa célula não pergunta nada;
//   5. o 409 do servidor abre a mesma pergunta, com o texto dele.
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

const mockVariacoes = {
  product_id: "p-1",
  product_name: "Vestido",
  colors: [{ hex: "#000000", name: "Preto" }],
  sizes: ["P", "M"],
  matrix: { "#000000|P": 3, "#000000|M": 2 },
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

const VESTIDO: any = {
  id: "p-1", name: "Vestido Midi", code: "VES-1", barcode: "", category: "Roupas", price: 189.9,
  cost: 60, stock: 5, minStock: 0, unit: "un", brand: "", notes: "", color: "", size: "",
  has_variants: true, isGroupShared: false,
};

beforeEach(() => {
  mockUpdateProduct.mockReset().mockResolvedValue(true);
  mockSave.mockReset().mockResolvedValue({});
});

test("tirar um tamanho com peças pergunta antes e não grava nada", async () => {
  const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
  act(() => { secao(tree).props.onTamanhos(["P"]); });
  await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });

  const aviso = porId(tree, "confirmar-remocao-com-estoque");
  expect(aviso).toHaveLength(1);
  expect(textoDe(aviso[0])).toContain("Preto · M ainda tem 2 peças. Zere o estoque ou transfira antes de remover.");
  expect(mockUpdateProduct).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();

  // "Voltar e ajustar" fecha sem gravar.
  act(() => { botao(tree, "Voltar e ajustar").props.onPress(); });
  expect(porId(tree, "confirmar-remocao-com-estoque")).toHaveLength(0);
  expect(mockSave).not.toHaveBeenCalled();
  tree.unmount();
});

test("com \"Remover mesmo assim\" grava e manda a confirmação", async () => {
  const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
  act(() => { secao(tree).props.onTamanhos(["P"]); });
  await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });
  await act(async () => { botao(tree, "Remover mesmo assim").props.onPress(); await new Promise((x) => setTimeout(x, 0)); });

  expect(mockUpdateProduct).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledTimes(1);
  const corpo = mockSave.mock.calls[0][2];
  expect(corpo.sizes).toEqual(["P"]);
  expect(corpo.matrix).toEqual({ "#000000|P": 3 });
  expect(corpo.confirmar_remocao_com_estoque).toBe(true);
  expect(corpo.matrix_lida).toEqual({ "#000000|P": 3, "#000000|M": 2 });
  tree.unmount();
});

test("mexer só numa célula não pergunta e manda matrix_lida", async () => {
  const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
  act(() => { secao(tree).props.onCelula("#000000|M", "4"); });
  await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });

  expect(porId(tree, "confirmar-remocao-com-estoque")).toHaveLength(0);
  expect(mockSave).toHaveBeenCalledTimes(1);
  const corpo = mockSave.mock.calls[0][2];
  expect(corpo.matrix).toEqual({ "#000000|P": 3, "#000000|M": 4 });
  expect(corpo.matrix_lida).toEqual({ "#000000|P": 3, "#000000|M": 2 });
  expect("confirmar_remocao_com_estoque" in corpo).toBe(false);
  tree.unmount();
});

test("o 409 do servidor abre a mesma pergunta com o texto dele", async () => {
  const erro: any = new Error("Preto · P ainda tem 1 peça. Zere o estoque ou transfira antes de remover.");
  erro.status = 409;
  erro.data = { code: "GRADE_REMOCAO_COM_ESTOQUE" };
  mockSave.mockRejectedValueOnce(erro);
  const tree = await montar(<ItemFormModal visible onClose={jest.fn()} editProduct={VESTIDO} />);
  act(() => { secao(tree).props.onCelula("#000000|M", "4"); });
  await act(async () => { await botao(tree, "Salvar alterações").props.onPress(); });

  const aviso = porId(tree, "confirmar-remocao-com-estoque");
  expect(aviso).toHaveLength(1);
  expect(textoDe(aviso[0])).toContain("Preto · P ainda tem 1 peça.");
  tree.unmount();
});
