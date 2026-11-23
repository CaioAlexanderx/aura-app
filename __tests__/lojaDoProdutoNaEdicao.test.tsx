// ============================================================
// Na edição (20/11/2026, A4 · D13, mockup "Na edição"):
//   1. "Este produto está em: Matriz · Filial Centro" e "Levar para outra
//      loja" (a rota da cópia, com estoque 0);
//   2. produto de uma loja só (ou backend sem a rota): nada aparece e o
//      Salvar fecha como hoje;
//   3. mudou preço ou nome e o produto está em outra loja: a oferta
//      "Aplicar também na Filial Centro?"; sem mudança, nada.
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

let mockLojasResp: any = undefined;
let mockLojasDoProduto: any = undefined;
const mockQueryKeys: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => {
    mockQueryKeys.push({ key: o.queryKey, enabled: o.enabled });
    if (o.queryKey && o.queryKey[0] === "lojas-para-cadastro") {
      return { data: o.enabled === false ? undefined : mockLojasResp, isLoading: false };
    }
    if (o.queryKey && o.queryKey[0] === "lojas-do-produto") {
      return { data: o.enabled === false ? undefined : mockLojasDoProduto, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "matriz" }, token: "t" }),
}));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));

const mockAddProduct = jest.fn();
const mockUpdateProduct = jest.fn();
jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({ products: [], addProduct: mockAddProduct, updateProduct: (...a: any[]) => mockUpdateProduct(...a) }),
}));
jest.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ byId: {}, assignProductCategories: jest.fn(), flattened: [], tree: [] }),
}));
jest.mock("@/hooks/useProductCategories", () => ({ useProductCategories: () => ({ categories: [] }) }));

const mockVariants = jest.fn();
jest.mock("@/services/api", () => ({
  companiesApi: {
    checkDuplicate: jest.fn().mockResolvedValue({ duplicates: [] }),
    variants: (...a: any[]) => mockVariants(...a),
  },
  request: jest.fn(),
}));
jest.mock("@/services/nfceApi", () => ({ nfceApi: { getConfig: jest.fn() } }));
const mockUpload = jest.fn();
jest.mock("@/services/productImagesApi", () => ({ productImagesApi: { upload: (...a: any[]) => mockUpload(...a), list: jest.fn() } }));
const mockSaveVariations = jest.fn();
jest.mock("@/services/productsVariationsApi", () => ({
  matrixKey: (hex: string | null, size: string | null) => (hex || "") + "|" + (size || ""),
  productsVariationsApi: { get: jest.fn(), save: (...a: any[]) => mockSaveVariations(...a) },
}));
jest.mock("@/services/matconApi", () => ({ matconApi: { createLot: jest.fn() } }));
const mockCopiar = jest.fn();
const mockAplicar = jest.fn();
jest.mock("@/services/lojasDoProdutoApi", () => ({
  lojasDoProdutoApi: {
    lojasParaCadastro: jest.fn(),
    copiarParaLojas: (...a: any[]) => mockCopiar(...a),
  },
  lojasDoProdutoEdicaoApi: {
    lojasDoProduto: jest.fn(),
    aplicarNasLojas: (...a: any[]) => mockAplicar(...a),
  },
}));

import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import { camposParaAplicar, textoDaOferta, lojasDoProdutoTxt } from "@/components/screens/estoque/item-form/lojasDoCadastro";

const PRODUTO: any = {
  id: "p1", name: "Vestido midi linho", code: "VML", barcode: "7891234567895", category: "Vestidos",
  price: 189.9, cost: 80, stock: 12, minStock: 3, unit: "un", notes: "", color: "", size: "", ncm: "",
};

function textoDe(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  return (node.children || []).map(textoDe).join("");
}
function porTestID(tree: any, id: string): any {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id)[0];
}
function comProp(tree: any, prop: string): any {
  return tree.root.findAll((n: any) => n.props && typeof n.props[prop] === "function")[0];
}
function montar(onClose = jest.fn()) {
  let tree: any;
  act(() => { tree = renderer.create(<ItemFormModal visible onClose={onClose} editProduct={PRODUTO} />); });
  return tree;
}
function precoInput(tree: any) {
  return tree.root.findAll((n: any) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function")[0];
}
function botaoSalvar(tree: any) {
  return tree.root.findAll((n: any) => n.type === Pressable && textoDe(n).indexOf("Salvar alterações") >= 0)[0];
}
async function clicar(node: any) {
  await act(async () => { await node.props.onPress(); });
}

beforeEach(() => {
  mockLojasDoProduto = {
    em: [{ company_id: "filial", nome: "Filial Centro", product_id: "p9" }, { company_id: "matriz", nome: "Matriz", product_id: "p1" }],
    pode_levar_para: [{ company_id: "loja3", nome: "Loja Shopping" }],
  };
  mockUpdateProduct.mockReset().mockResolvedValue(true);
  mockCopiar.mockReset().mockResolvedValue({
    master_sku: "AURA-1",
    resultados: [{ company_id: "loja3", nome: "Loja Shopping", status: "criado", product_id: "p10", stock_qty: 0 }],
  });
  mockAplicar.mockReset().mockResolvedValue({ resultados: [{ company_id: "filial", nome: "Filial Centro", status: "ok" }] });
  (global as any).innerWidth = 1024;
});

describe("regras da edição", () => {
  test("campos que mudaram, textos da oferta e da leitura", () => {
    expect(camposParaAplicar({ name: "A", price: 10 }, { name: "A", price: 10 })).toEqual([]);
    expect(camposParaAplicar({ name: "A", price: 10 }, { name: "A ", price: 12 })).toEqual(["price"]);
    expect(camposParaAplicar({ name: "A", price: 10 }, { name: "B", price: 12 })).toEqual(["price", "name"]);
    expect(textoDaOferta(["price"], ["Filial Centro"])).toBe("Você mudou o preço. A Filial Centro continua com o de antes até você aplicar lá. O estoque não muda.");
    expect(lojasDoProdutoTxt([{ company_id: "filial", nome: "Filial Centro" }, { company_id: "matriz", nome: "Matriz" }], "matriz")).toBe("Matriz · Filial Centro");
  });
});

describe("Na edição", () => {
  test("mostra onde o produto está, a dica do mockup e leva para outra loja com estoque 0", async () => {
    const tree = montar();
    const sec = textoDe(porTestID(tree, "lojas-da-edicao"));
    expect(sec).toContain("Este produto está em");
    expect(sec).toContain("Matriz · Filial Centro");
    expect(textoDe(tree.root)).toContain("O que você alterar aqui vale para a Matriz. Para mandar peças, use \"Transferir\".");
    await clicar(porTestID(tree, "levar-para-outra-loja"));
    expect(textoDe(porTestID(tree, "levar-para-loja3"))).toContain("Nasce lá com estoque 0.");
    await clicar(porTestID(tree, "levar-para-loja3"));
    expect(mockCopiar).toHaveBeenCalledWith("matriz", "p1", { lojas: [{ company_id: "loja3", stock_qty: 0 }] });
    expect(textoDe(porTestID(tree, "levar-para-loja3"))).toContain("Criado com 0 peças");
    tree.unmount();
  });

  test("produto de uma loja só (ou rota ausente): nada aparece e o Salvar fecha como hoje", async () => {
    mockLojasDoProduto = { em: [{ company_id: "matriz", nome: "Matriz", product_id: "p1" }], pode_levar_para: [] };
    let onClose = jest.fn();
    let tree = montar(onClose);
    expect(porTestID(tree, "lojas-da-edicao")).toBeUndefined();
    act(() => { precoInput(tree).props.onChangeText("19990"); });
    await clicar(botaoSalvar(tree));
    expect(porTestID(tree, "oferta-aplicar-nas-lojas")).toBeUndefined();
    expect(onClose).toHaveBeenCalledTimes(1);
    tree.unmount();

    mockLojasDoProduto = undefined;
    onClose = jest.fn();
    tree = montar(onClose);
    expect(porTestID(tree, "lojas-da-edicao")).toBeUndefined();
    act(() => { precoInput(tree).props.onChangeText("19990"); });
    await clicar(botaoSalvar(tree));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockAplicar).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("mudou o preço: oferece aplicar na Filial; 'Aplicar também' manda só o preço e fecha", async () => {
    const onClose = jest.fn();
    const tree = montar(onClose);
    act(() => { precoInput(tree).props.onChangeText("19990"); });
    await clicar(botaoSalvar(tree));
    expect(mockUpdateProduct).toHaveBeenCalledTimes(1);
    const oferta = textoDe(porTestID(tree, "oferta-aplicar-nas-lojas"));
    expect(oferta).toContain("Aplicar também na Filial Centro?");
    expect(onClose).not.toHaveBeenCalled();
    await clicar(porTestID(tree, "oferta-aplicar"));
    expect(mockAplicar).toHaveBeenCalledWith("matriz", "p1", { campos: ["price"], lojas: ["filial"] });
    expect(onClose).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("'Só nesta loja' fecha sem aplicar; sem mudança de preço ou nome, nem pergunta", async () => {
    let onClose = jest.fn();
    let tree = montar(onClose);
    act(() => { precoInput(tree).props.onChangeText("19990"); });
    await clicar(botaoSalvar(tree));
    await clicar(porTestID(tree, "oferta-so-nesta"));
    expect(mockAplicar).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    tree.unmount();

    onClose = jest.fn();
    tree = montar(onClose);
    act(() => { comProp(tree, "onMinimo").props.onMinimo("5"); });
    await clicar(botaoSalvar(tree));
    expect(porTestID(tree, "oferta-aplicar-nas-lojas")).toBeUndefined();
    expect(onClose).toHaveBeenCalledTimes(1);
    tree.unmount();
  });
});
